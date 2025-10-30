//
// assessment-manager.js
// Handles creation, editing, deletion, previewing, and publishing of assessments.
// Requires firebase-config.js and utils.js to be loaded.
//

import {
db,
collection,
addDoc,
getDocs,
getDoc,
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

// ---------------------------
// DOM Elements
// ---------------------------
const uploadedAssessmentsBody = document.getElementById("uploadedAssessmentsBody");
const saveAssessmentBtn = document.getElementById("saveAssessmentBtn");
const yearInput = document.getElementById("yearInput");
const termSelect = document.getElementById("termSelect");
const classSelect = document.getElementById("classSelect") || document.getElementById("classInput");
const subjectSelect = document.getElementById("subjectSelect");
const assessmentSelect = document.getElementById("assessmentSelect");

let cachedAssessments = [];

// ---------------------------
// Helpers
// ---------------------------
function safe(v) {
return v === undefined || v === null ? "" : String(v).trim();
}

function buildAssessmentDoc(questions = []) {
const year = safe(yearInput?.value);
const term = safe(termSelect?.value);
const theclass = safe(classSelect?.value);
const subject = safe(subjectSelect?.value);
const assessmentName = safe(assessmentSelect?.value);

if (!year || !term || !theclass || !subject || !assessmentName) {
throw new Error("Please fill Year, Term, Class, Subject, and Assessment Name before saving.");
}

return {
year,
term,
theclass,
subject,
assessmentName,
title: `${assessmentName} — ${subject} — ${theclass} — ${term} ${year}`,
questions: questions || [],
status: "Draft",
createdAt: serverTimestamp(),
updatedAt: serverTimestamp()
};
}

// ---------------------------
// Save / Update Assessment
// ---------------------------
export async function saveAssessment({ questions = [], editingId = null, makePublished = false } = {}) {
try {
if (!Array.isArray(questions) || questions.length === 0) {
toast("No questions to save.", "error");
return;
}

```
showLoader("Saving assessment...");
const docObj = buildAssessmentDoc(questions);
docObj.status = makePublished ? "Published" : docObj.status;

if (editingId) {
  const ref = doc(db, "exams", editingId);
  await updateDoc(ref, { ...docObj, updatedAt: serverTimestamp() });
  toast("Assessment updated.", "success");
} else {
  const ref = await addDoc(collection(db, "exams"), docObj);
  toast("Assessment saved.", "success");
  editingId = ref.id;
}

await loadAssessments();
hideLoader();
return editingId;
```

} catch (err) {
console.error("saveAssessment:", err);
toast("Save failed: " + (err.message || err), "error");
hideLoader();
return null;
}
}

// ---------------------------
// Load & Render Assessments
// ---------------------------
export async function loadAssessments(filter = {}) {
try {
if (!uploadedAssessmentsBody) return;
uploadedAssessmentsBody.innerHTML = `<tr><td colspan="5" class="small">Loading...</td></tr>`;
const snap = await getDocs(collection(db, "exams"));
const list = [];

```
snap.forEach((d) => {
  const data = d.data();
  list.push({ id: d.id, data });
});

const filtered = list.filter((r) => {
  const d = r.data;
  if (filter.year && String(d.year) !== String(filter.year)) return false;
  if (filter.term && d.term !== filter.term) return false;
  if (filter.theclass && String(d.theclass) !== String(filter.theclass)) return false;
  if (filter.subject && d.subject !== filter.subject) return false;
  if (filter.assessmentName && d.assessmentName !== filter.assessmentName) return false;
  return true;
});

cachedAssessments = filtered;
renderAssessmentsTable(filtered);
return filtered;
```

} catch (err) {
console.error("loadAssessments:", err);
uploadedAssessmentsBody.innerHTML = `<tr><td colspan="5">Failed to load assessments.</td></tr>`;
toast("Error loading assessments.", "error");
return [];
}
}

// ---------------------------
// Render Table
// ---------------------------
function renderAssessmentsTable(items = []) {
if (!uploadedAssessmentsBody) return;
if (items.length === 0) {
uploadedAssessmentsBody.innerHTML = `<tr><td colspan="5" class="small">No assessments found.</td></tr>`;
return;
}

items.sort((a, b) => {
const ta = a.data?.updatedAt?.seconds || 0;
const tb = b.data?.updatedAt?.seconds || 0;
return tb - ta;
});

uploadedAssessmentsBody.innerHTML = items.map((item) => {
const d = item.data || {};
const dateStr = d.updatedAt
? formatDateTime(d.updatedAt.seconds ? d.updatedAt.seconds * 1000 : d.updatedAt)
: "";
const pubLabel = d.status === "Published" ? "Unpublish" : "Publish";

const esc = (x) =>
  String(x || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

// ✅ Properly formatted and escaped template literal:
return `
  <tr>
    <td>${esc(d.assessmentName)}</td>
    <td>${esc(d.subject)}</td>
    <td>${esc(d.theclass)}</td>
    <td>${esc(dateStr)}</td>
    <td style="white-space:nowrap">
      <button class="btn small edit-btn" data-id="${item.id}">Edit</button>
      <button class="btn ghost small preview-btn" data-id="${item.id}">Preview</button>
      <button class="btn ghost small delete-btn" data-id="${item.id}">Delete</button>
      <button class="btn small publish-btn" data-id="${item.id}" data-status="${d.status || "Draft"}">
        ${pubLabel}
      </button>
    </td>
  </tr>
`;
```

}).join("");

uploadedAssessmentsBody.querySelectorAll(".edit-btn").forEach((b) =>
b.addEventListener("click", onEdit)
);
uploadedAssessmentsBody.querySelectorAll(".delete-btn").forEach((b) =>
b.addEventListener("click", onDelete)
);
uploadedAssessmentsBody.querySelectorAll(".preview-btn").forEach((b) =>
b.addEventListener("click", onPreview)
);
uploadedAssessmentsBody.querySelectorAll(".publish-btn").forEach((b) =>
b.addEventListener("click", onPublishToggle)
);
}

// ---------------------------
// Button Actions
// ---------------------------
async function onEdit(e) {
const id = e.currentTarget.dataset.id;
if (!id) return toast("Missing ID.", "error");

showLoader("Loading...");
try {
const ref = doc(db, "exams", id);
const snap = await getDoc(ref);
hideLoader();
if (!snap.exists()) return toast("Assessment not found.", "error");
window.dispatchEvent(new CustomEvent("assessment:edit", { detail: { id, data: snap.data() } }));
toast("Loaded for editing.", "info");
} catch (err) {
console.error("onEdit:", err);
hideLoader();
toast("Failed to load for editing.", "error");
}
}

async function onDelete(e) {
const id = e.currentTarget.dataset.id;
if (!id) return toast("Missing ID.", "error");
const ok = await confirmDialog("Delete this assessment? This cannot be undone.");
if (!ok) return;
try {
showLoader("Deleting...");
await deleteDoc(doc(db, "exams", id));
toast("Deleted successfully.", "success");
await loadAssessments();
} catch (err) {
console.error("onDelete:", err);
toast("Delete failed: " + err.message, "error");
} finally {
hideLoader();
}
}

async function onPreview(e) {
const id = e.currentTarget.dataset.id;
if (!id) return;
const found = cachedAssessments.find((x) => x.id === id);
if (!found) return toast("Assessment not found for preview.", "error");
window.dispatchEvent(new CustomEvent("assessment:preview", { detail: found }));
}

async function onPublishToggle(e) {
const id = e.currentTarget.dataset.id;
if (!id) return;
try {
showLoader("Updating status...");
const found = cachedAssessments.find((x) => x.id === id);
const currentStatus = found?.data?.status || "Draft";
const newStatus = currentStatus === "Published" ? "Draft" : "Published";
await updateDoc(doc(db, "exams", id), {
status: newStatus,
updatedAt: serverTimestamp()
});
toast(newStatus === "Published" ? "Published." : "Unpublished.", "success");
await loadAssessments();
} catch (err) {
console.error("onPublishToggle:", err);
toast("Status update failed.", "error");
} finally {
hideLoader();
}
}

// ---------------------------
// Save Handler (from Editor)
// ---------------------------
function attachSaveHandler() {
if (!saveAssessmentBtn) return;
saveAssessmentBtn.addEventListener("click", async () => {
try {
let questions = [];
if (typeof window.getQuestions === "function") {
questions = window.getQuestions() || [];
}

```
  if (!Array.isArray(questions) || questions.length === 0) {
    const blocks = document.querySelectorAll(".question-card, .question-block, [data-qid]");
    blocks.forEach((b, i) => {
      const qText =
        b.querySelector("textarea, .questionInput, .editable")?.value ||
        b.textContent ||
        "";
      const opts = Array.from(b.querySelectorAll("input[type='text'], .optionInput")).map(
        (o) => o.value || ""
      );
      const ans =
        b.querySelector("select, .answerSelect")?.value || "";
      const img = b.querySelector("img")?.src || "";
      const marks = parseInt(b.querySelector(".marksInput")?.value || "1");
      if (qText.trim()) {
        questions.push({
          id: b.dataset.qid || `q_${i + 1}`,
          question: qText.trim(),
          options: opts,
          answer: ans,
          marks,
          imageUrl: img
        });
      }
    });
  }
  if (questions.length === 0) {
    toast("No questions found in editor.", "error");
    return;
  }

  await saveAssessment({ questions });
} catch (err) {
  console.error("attachSaveHandler:", err);
  toast("Save failed: " + err.message, "error");
}
}); // ✅ closes event listener properly
} // ✅ closes attachSaveHandler function

// ---------------------------
// Init
// ---------------------------
(function init() {
  attachSaveHandler();
})();

const year = safe(yearInput?.value);
loadAssessments(year ? { year } : {});
[yearInput, termSelect, classSelect, subjectSelect].forEach((el) => {
if (el)
el.addEventListener("change", () =>
loadAssessments({
year: yearInput?.value,
term: termSelect?.value,
theclass: classSelect?.value,
subject: subjectSelect?.value
})
);
});
})();

export default { saveAssessment, loadAssessments, cachedAssessments };



