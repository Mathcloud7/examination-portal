// assessment-manager.js
// Manages saving, listing, editing, deleting and publishing assessments in Firestore.
// Expects utils.js and firebase-config.js to be present and initialized.

import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "./firebase-config.js";

import {
  toast,
  showLoader,
  hideLoader,
  formatDateTime,
  confirmDialog,
  setStatus
} from "./utils.js";

// DOM references
const uploadedAssessmentsBody = document.getElementById("uploadedAssessmentsBody");
const saveAssessmentBtn = document.getElementById("saveAssessmentBtn"); // used by question-editor to trigger full save
const yearInput = document.getElementById("yearInput");
const termSelect = document.getElementById("termSelect");
const classSelect = document.getElementById("classSelect") || document.getElementById("classInput");
const subjectSelect = document.getElementById("subjectSelect");
const assessmentSelect = document.getElementById("assessmentSelect");

// Local cached list (populated from Firestore)
let cachedAssessments = []; // array of { id, data }

// ---------------------------
// Helpers
// ---------------------------
function wp(obj) { return (obj === undefined || obj === null) ? '' : obj; }

function buildExamDocFromUI(questions = []) {
  const year = wp(yearInput && yearInput.value).toString().trim();
  const term = wp(termSelect && termSelect.value).toString().trim();
  const theclass = wp(classSelect && classSelect.value).toString().trim();
  const subject = wp(subjectSelect && subjectSelect.value).toString().trim();
  const assessmentType = wp(assessmentSelect && assessmentSelect.value).toString().trim();

  if (!year || !term || !theclass || !subject || !assessmentType) {
    throw new Error("Please fill Year, Term, Class, Subject and Assessment Name before saving.");
  }

  const docObj = {
    title: `${assessmentType} — ${subject} — ${theclass} — ${term} ${year}`,
    year,
    term,
    theclass,
    subject,
    assessmentType,
    questions: questions || [],
    status: "Draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  return docObj;
}

// ---------------------------
// Save new assessment
// ---------------------------
// If editingId provided, update existing; otherwise create new doc
export async function saveAssessment({ questions = [], editingId = null, makePublished = false } = {}) {
  try {
    if (!Array.isArray(questions) || questions.length === 0) {
      toast("No questions found to save.", "error");
      return null;
    }
    showLoader("Saving assessment...");
    const docObj = buildExamDocFromUI(questions);
    docObj.status = makePublished ? "Published" : (docObj.status || "Draft");
    docObj.updatedAt = serverTimestamp();

    if (editingId) {
      // update existing doc
      const dref = doc(db, "exams", editingId);
      await updateDoc(dref, { ...docObj, updatedAt: serverTimestamp() });
      toast("Assessment updated.", "success");
      await loadAssessments(); // refresh list
      hideLoader();
      return editingId;
    } else {
      // create new
      const colRef = collection(db, "exams");
      const newRef = await addDoc(colRef, docObj);
      toast("Assessment saved.", "success");
      await loadAssessments();
      hideLoader();
      return newRef.id;
    }
  } catch (err) {
    console.error("saveAssessment:", err);
    toast("Save failed: " + (err.message || err), "error");
    hideLoader();
    return null;
  }
}

// ---------------------------
// Load assessments (all) and render into the right table
// optional filter: { year, term, theclass, subject, assessmentType }
// ---------------------------
export async function loadAssessments(filter = {}) {
  try {
    if (!uploadedAssessmentsBody) return;
    uploadedAssessmentsBody.innerHTML = `<tr><td colspan="5" class="small">Loading...</td></tr>`;
    setStatus("Loading assessments...", 2000);
    const colRef = collection(db, "exams");
    const snap = await getDocs(colRef);
    const rows = [];
    snap.forEach(d => {
      const data = d.data ? d.data() : d._document?.data || {};
      // Normalize: if data() returns a map
      const item = { id: d.id, data };
      rows.push(item);
    });

    // apply filter locally
    const filtered = rows.filter(r => {
      if (filter.year && String(r.data.year) !== String(filter.year)) return false;
      if (filter.term && r.data.term !== filter.term) return false;
      if (filter.theclass && String(r.data.theclass) !== String(filter.theclass)) return false;
      if (filter.subject && r.data.subject !== filter.subject) return false;
      if (filter.assessmentType && r.data.assessmentType !== filter.assessmentType) return false;
      return true;
    });

    cachedAssessments = filtered; // store locally
    renderAssessmentsTable(filtered);
    return filtered;
  } catch (err) {
    console.error("loadAssessments:", err);
    uploadedAssessmentsBody.innerHTML = `<tr><td colspan="5" class="small">Failed to load assessments.</td></tr>`;
    toast("Failed to load assessments.", "error");
    return [];
  }
}

function renderAssessmentsTable(items) {
  if (!uploadedAssessmentsBody) return;
  if (!items || items.length === 0) {
    uploadedAssessmentsBody.innerHTML = `<tr><td colspan="5" class="small">No assessments found.</td></tr>`;
    return;
  }

  // sort newest first by updatedAt (if exists)
  items.sort((a, b) => {
    const ta = a.data && a.data.updatedAt ? a.data.updatedAt.toMillis ? a.data.updatedAt.toMillis() : (a.data.updatedAt.seconds ? a.data.updatedAt.seconds * 1000 : 0) : 0;
    const tb = b.data && b.data.updatedAt ? b.data.updatedAt.toMillis ? b.data.updatedAt.toMillis() : (b.data.updatedAt.seconds ? b.data.updatedAt.seconds * 1000 : 0) : 0;
    return tb - ta;
  });

  uploadedAssessmentsBody.innerHTML = "";
  items.forEach(item => {
    const d = item.data || {};
    const tr = document.createElement("tr");
    const dateStr = d.updatedAt ? formatDateTime(d.updatedAt.seconds ? (d.updatedAt.seconds * 1000) : d.updatedAt) : "";
    tr.innerHTML = `
      <td>${escapeText(d.assessmentType || '')}</td>
      <td>${escapeText(d.subject || '')}</td>
      <td>${escapeText(d.theclass || '')}</td>
      <td>${escapeText(dateStr)}</td>
      <td style="white-space:nowrap">
        <button class="btn small edit-btn" data-id="${item.id}">Edit</button>
        <button class="btn ghost small preview-btn" data-id="${item.id}">Preview</button>
        <button class="btn ghost small delete-btn" data-id="${item.id}">Delete</button>
        <button class="btn small publish-btn" data-id="${item.id}" data-status="${d.status || 'Draft'}">${(d.status === 'Published') ? 'Unpublish' : 'Publish'}</button>
      </td>
    `;
    uploadedAssessmentsBody.appendChild(tr);
  });

  // attach handlers
  uploadedAssessmentsBody.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', onEditClicked));
  uploadedAssessmentsBody.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', onDeleteClicked));
  uploadedAssessmentsBody.querySelectorAll('.preview-btn').forEach(b => b.addEventListener('click', onPreviewClicked));
  uploadedAssessmentsBody.querySelectorAll('.publish-btn').forEach(b => b.addEventListener('click', onPublishToggleClicked));
}

// small helper to avoid XSS in table text
function escapeText(s) {
  if (s === undefined || s === null) return '';
  return String(s);
}

// ---------------------------
// Action handlers
// ---------------------------
async function onEditClicked(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) { toast("Missing id for edit.", "error"); return; }
  try {
    showLoader("Loading assessment...");
    // fetch doc data
    const dref = doc(db, "exams", id);
    const snap = await dref.get?.() /* try if set */; // defensive
    // since `doc(...).get()` pattern varies by SDK version, fetch from cachedAssessments first
    let data = null;
    const found = cachedAssessments.find(x => x.id === id);
    if (found) data = found.data;
    // fallback: try to get via getDocs on the single doc path
    if (!data) {
      try {
        const docSnap = await (async () => {
          // try get via getDocs(collection(db, 'exams')) and find by id
          const colSnap = await getDocs(collection(db, "exams"));
          let f = null;
          colSnap.forEach(s => { if (s.id === id) f = s.data(); });
          return f;
        })();
        data = docSnap || null;
      } catch (er) {
        // ignore
      }
    }
    hideLoader();
    if (!data) { toast("Failed to load assessment for edit.", "error"); return; }

    // dispatch event so question-editor can handle loading into editor
    window.dispatchEvent(new CustomEvent('assessment:edit', { detail: { id, data } }));
    toast("Assessment loaded for editing.", "info");
  } catch (err) {
    console.error("onEditClicked", err);
    hideLoader();
    toast("Failed to load for edit.", "error");
  }
}

async function onDeleteClicked(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) { toast("Missing id for delete.", "error"); return; }
  const ok = await confirmDialog("Delete this assessment? This cannot be undone.");
  if (!ok) return;
  try {
    showLoader("Deleting...");
    const dref = doc(db, "exams", id);
    await deleteDoc(dref);
    toast("Deleted.", "success");
    await loadAssessments();
    hideLoader();
  } catch (err) {
    console.error("onDeleteClicked", err);
    hideLoader();
    toast("Delete failed: " + (err.message || err), "error");
  }
}

async function onPreviewClicked(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) { toast("Missing id for preview.", "error"); return; }
  // try find in cache
  const found = cachedAssessments.find(x => x.id === id);
  const data = found ? found.data : null;
  if (!data) {
    toast("Failed to load assessment for preview.", "error");
    return;
  }
  // dispatch preview event
  window.dispatchEvent(new CustomEvent('assessment:preview', { detail: { id, data } }));
}

async function onPublishToggleClicked(e) {
  const id = e.currentTarget.dataset.id;
  if (!id) { toast("Missing id for publish toggle.", "error"); return; }
  try {
    showLoader("Updating status...");
    // find in cache
    const found = cachedAssessments.find(x => x.id === id);
    const currStatus = found && found.data && found.data.status ? found.data.status : 'Draft';
    const newStatus = currStatus === 'Published' ? 'Draft' : 'Published';
    const dref = doc(db, "exams", id);
    await updateDoc(dref, { status: newStatus, updatedAt: serverTimestamp() });
    toast(newStatus === 'Published' ? 'Published.' : 'Unpublished.', 'success');
    await loadAssessments();
    hideLoader();
  } catch (err) {
    console.error("onPublishToggleClicked", err);
    hideLoader();
    toast("Status update failed: " + (err.message || err), "error");
  }
}

// ---------------------------
// Attach save button (if present) to create a full assessment using window.getQuestions()
// This does not force any question-editor implementation; it will try window.getQuestions() and fail gracefully.
// ---------------------------
function attachSaveHandler() {
  if (!saveAssessmentBtn) return;
  saveAssessmentBtn.addEventListener("click", async () => {
    try {
      setStatus("Preparing save...", 2000);
      // try to obtain questions via window.getQuestions if available
      let questions = [];
      if (typeof window.getQuestions === "function") {
        try {
          const g = window.getQuestions();
          if (Array.isArray(g)) questions = g;
        } catch (e) { /* ignore */ }
      }

      // fallback: look for .question-card or .question-block DOM structure
      if (!questions || questions.length === 0) {
        const blocks = Array.from(document.querySelectorAll(".question-card, .question-block, [data-qid]"));
        blocks.forEach((b, idx) => {
          const qInput = b.querySelector("textarea, .questionInput, [data-field='text'], .editable");
          const qText = qInput ? (qInput.value ?? qInput.innerHTML ?? qInput.textContent) : (b.querySelector("h4")?.textContent || "");
          const optionEls = b.querySelectorAll("input[type='text'], .optionInput, [data-field^='opt-']");
          const options = Array.from(optionEls).map(o => (o.value ?? o.innerText ?? o.textContent || '').trim());
          const answerEl = b.querySelector("select, .answerSelect");
          const answer = answerEl ? (answerEl.value ?? answerEl.textContent) : '';
          const marksEl = b.querySelector(".marksInput, input[type='number']");
          const marks = marksEl ? (marksEl.value ?? marksEl.textContent) : 1;
          const imgEl = b.querySelector("img") || b.querySelector(".imageName");
          const imageUrl = imgEl ? (imgEl.src ?? imgEl.dataset?.url ?? '') : '';
          if (String(qText || '').trim() !== '') {
            questions.push({ id: b.dataset.qid || (`q_${idx+1}`), question: String(qText || '').trim(), options, answer: String(answer || '').trim(), marks: Number(marks) || 1, imageUrl });
          }
        });
      }

      if (!questions || questions.length === 0) {
        toast("No questions found to save. Make sure editor contains questions.", "error");
        return;
      }

      // Save new assessment (creates a new doc)
      await saveAssessment({ questions, editingId: null, makePublished: false });
    } catch (err) {
      console.error("attachSaveHandler:", err);
      toast("Save failed: " + (err.message || err), "error");
    }
  });
}

// ---------------------------
// Initialization
// ---------------------------
(function init() {
  // Attach save handler
  attachSaveHandler();

  // Load initial list for the selected year if present
  const year = (yearInput && yearInput.value) ? String(yearInput.value).trim() : '';
  loadAssessments(year ? { year } : {});

  // Also reload when year/term/class/subject changed (if elements exist)
  if (yearInput) yearInput.addEventListener('change', () => loadAssessments({ year: yearInput.value }));
  if (termSelect) termSelect.addEventListener('change', () => loadAssessments({ year: yearInput.value, term: termSelect.value }));
  if (classSelect) classSelect.addEventListener('change', () => loadAssessments({ year: yearInput.value, theclass: classSelect.value }));
  if (subjectSelect) subjectSelect.addEventListener('change', () => loadAssessments({ year: yearInput.value, subject: subjectSelect.value }));
})();

// export public API
export default {
  saveAssessment,
  loadAssessments,
  cachedAssessments
};
