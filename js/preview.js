// js/preview.js
// preview.js — Final version (syntax-safe + KaTeX-ready + print/export support)

import {
  escapeHtml,
  htmlToPlainText,
  renderMixedText,
  toast,
  formatDateTime,
  setStatus
} from "./utils.js";

// ------------------------------------------------------------------
// DOM constants
// ------------------------------------------------------------------
const PREVIEW_MODAL_ID = "previewModal";
const PREVIEW_INNER_ID = "previewInner";
const SHOW_PREVIEW_BTN_ID = "showPreviewBtn";
const CLOSE_PREVIEW_BTN_ID = "closePreview";
const EXPORT_PRINT_BTN_ID = "previewPrintBtn";

// ------------------------------------------------------------------
// Helper to create an element
// ------------------------------------------------------------------
function el(tag = "div", attrs = {}, inner = "") {
  const d = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") d.className = attrs[k];
    else if (k === "style") d.style.cssText = attrs[k];
    else d.setAttribute(k, attrs[k]);
  }
  if (inner instanceof Node) d.appendChild(inner);
  else d.innerHTML = inner || "";
  return d;
}

// ------------------------------------------------------------------
// Render math inside container
// ------------------------------------------------------------------
export function renderMath(container) {
  if (!container) return;
  const targets = Array.from(
    container.querySelectorAll('[data-render-math="1"], .render-math')
  );

  if (targets.length === 0) {
    Array.from(container.children).forEach(ch => {
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(ch.tagName)) return;
      try {
        ch.innerHTML = renderMixedText(
          htmlToPlainText(ch.innerHTML || ch.textContent || "")
        );
      } catch (e) {
        // noop
      }
    });
    return;
  }

  targets.forEach(t => {
    try {
      t.innerHTML = renderMixedText(
        htmlToPlainText(t.innerHTML || t.textContent || "")
      );
    } catch (err) {
      t.textContent = t.textContent || "";
    }
  });
}

// ------------------------------------------------------------------
// Open preview modal from data
// ------------------------------------------------------------------
export function openPreviewModalFromData(questions = [], meta = {}) {
  const modal = document.getElementById(PREVIEW_MODAL_ID);
  const inner = document.getElementById(PREVIEW_INNER_ID);
  if (!modal || !inner) {
    toast("Preview modal not found in DOM.", "error");
    return;
  }

  inner.innerHTML = "";

  // Header
  const header = el("div", {
    style:
      "display:flex;justify-content:space-between;align-items:center;gap:12px"
  });
  const left = el(
    "div",
    {},
    `<div style="font-weight:700;font-size:1.05rem">${escapeHtml(
      meta.title ||
        (meta.subject
          ? meta.subject + " — " + (meta.assessmentName || "")
          : "Assessment Preview")
    )}</div>
     <div class="small" style="margin-top:6px">${escapeHtml(
       (meta.theclass || meta.class || "") +
         " • " +
         (meta.term || "") +
         " • " +
         (meta.year || "")
     )}</div>`
  );
  header.appendChild(left);

  const actions = el("div", {});
  const printBtn = el(
    "button",
    { class: "btn ghost", id: EXPORT_PRINT_BTN_ID, style: "margin-left:8px" },
    "Print"
  );
  actions.appendChild(printBtn);
  header.appendChild(actions);
  inner.appendChild(header);

  const info = el(
    "div",
    { style: "margin-top:10px;color:#475569" },
    `Questions: ${questions.length} • Generated: ${formatDateTime(new Date())}`
  );
  inner.appendChild(info);

  const qwrap = el("div", {
    style: "margin-top:16px;display:flex;flex-direction:column;gap:12px"
  });

  questions.forEach((q, idx) => {
    const qcard = el("div", {
      style:
        "padding:12px;border-radius:8px;background:#fff;border:1px solid #e6eefc"
    });

    const qheader = el("div", {
      style:
        "display:flex;justify-content:space-between;align-items:center;gap:8px"
    });
    qheader.innerHTML = `<div style="font-weight:700">Q${idx + 1}</div><div class="small">Marks: ${escapeHtml(String(q.marks || 1))}</div>`;
    qcard.appendChild(qheader);

    const qtext = el(
      "div",
      { class: "render-math", style: "margin-top:8px;line-height:1.45" },
      renderMixedText(htmlToPlainText(q.question || ""))
    );
    qcard.appendChild(qtext);

    if (q.imageUrl) {
      const imgWrap = el("div", { style: "margin-top:10px" });
      const img = el("img", {
        src: q.imageUrl,
        style:
          "max-width:320px;display:block;border-radius:6px;border:1px solid #eef2ff"
      });
      imgWrap.appendChild(img);
      qcard.appendChild(imgWrap);
    }

    const opts = el("div", {
      style:
        "margin-top:10px;display:flex;flex-direction:column;gap:6px"
    });

    (q.options || []).forEach((opt, i) => {
      const optLabel = String.fromCharCode(65 + i);
      const isCorrect =
        String(q.answer || "").toUpperCase() === optLabel ||
        String(q.answer) === String(i);
      const optDiv = el(
        "div",
        {
          style: `padding:8px;border-radius:6px;border:1px solid ${
            isCorrect ? "#d1fae5" : "#eef4ff"
          };background:${isCorrect ? "#ecfdf5" : "#fbfdff"};display:flex;gap:8px;align-items:flex-start;`
        },
        `<strong style="width:28px;display:inline-block">${optLabel}.</strong> ${renderMixedText(
          htmlToPlainText(opt || "")
        )}`
      );
      opts.appendChild(optDiv);
    });

    qcard.appendChild(opts);
    qwrap.appendChild(qcard);
  });

  inner.appendChild(qwrap);
  modal.style.display = "flex";

  // ------------------------------------------------------------------
  // Print Handler (safe template)
  // ------------------------------------------------------------------
  const printHandler = () => {
    const safe = str =>
      escapeHtml(String(str || "").replace(/`/g, "‵").replace(/\$\{/g, "＄{"));
    const printable = `
      <html>
        <head>
          <title>Print Preview</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
          <style>
            body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#0f172a;}
            .q{margin-bottom:14px;padding:8px;border-bottom:1px solid #e6eefc;}
            .q h4{margin:0 0 8px 0;}
          </style>
        </head>
        <body>
          <h2>${safe(meta.title || "Assessment Preview")}</h2>
          <div>Class: ${safe(meta.theclass || meta.class || "")}</div>
          <div>Term: ${safe(meta.term || "")}</div>
          <div>Subject: ${safe(meta.subject || "")}</div>
          <hr/>
          ${questions
            .map(
              (q, idx) => `
            <div class="q">
              <div style="font-weight:700">Q${idx + 1}. ${safe(htmlToPlainText(q.question || ""))}</div>
              ${q.imageUrl ? `<div style="margin-top:8px"><img src="${safe(q.imageUrl)}" style="max-width:320px"></div>` : ''}
              <div style="margin-top:8px">
                ${(q.options || []).map((o, i) => `<div><strong>${String.fromCharCode(65 + i)}.</strong> ${safe(htmlToPlainText(o || ""))}</div>`).join('')}
              </div>
            </div>`
            )
            .join('')}
        </body>
      </html>
    `;
    const w = window.open("", "_blank", "noopener");
    if (!w) {
      toast("Popup blocked. Allow popups to print.", "error");
      return;
    }
    w.document.open();
    w.document.write(printable);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const pb = document.getElementById(EXPORT_PRINT_BTN_ID);
  if (pb) pb.onclick = printHandler;
}

// ------------------------------------------------------------------
// Collect questions from DOM (fallback)
// ------------------------------------------------------------------
function collectQuestionsFromDOM() {
  const out = [];
  const blocks = Array.from(
    document.querySelectorAll(".question-block, .question-card, [data-qid]")
  );

  if (blocks.length > 0) {
    for (const b of blocks) {
      const qInput = b.querySelector(".questionInput, textarea, [data-field='text'], .editable");
      const qText = qInput ? (qInput.value ?? qInput.innerHTML ?? qInput.textContent) : (b.querySelector("h4")?.textContent || b.querySelector(".qtext")?.textContent || "");
      const optionEls = b.querySelectorAll(".optionInput, .option input, .editable-option, [data-field^='opt-']");
      let options = [];
      if (optionEls.length >= 1) {
        options = Array.from(optionEls).map(o => (o.value ?? o.innerHTML ?? o.textContent || "").trim());
      } else {
        const lis = b.querySelectorAll("li");
        if (lis.length > 0) options = Array.from(lis).map(li => li.textContent.trim());
      }
      const answerEl = b.querySelector(".answerSelect, select, [data-answer]");
      const answer = answerEl ? (answerEl.value ?? answerEl.textContent ?? "") : (b.querySelector(".correct")?.textContent || "");
      const marksEl = b.querySelector(".marksInput, [data-marks]");
      const marks = marksEl ? (marksEl.value ?? marksEl.textContent ?? 1) : 1;
      const imgEl = b.querySelector("img") || b.querySelector(".imageName");
      const imageUrl = imgEl ? (imgEl.src ?? imgEl.dataset?.url ?? "") : "";
      out.push({
        id: b.dataset.qid || b.getAttribute("data-id") || `q_${out.length + 1}`,
        question: String(qText || "").trim(),
        options,
        answer: String(answer || "").trim(),
        marks: Number(marks) || 1,
        imageUrl
      });
    }
    return out;
  }

  if (typeof window.getQuestions === "function") {
    try {
      const g = window.getQuestions();
      if (Array.isArray(g)) return g;
    } catch (e) {
      // ignore
    }
  }

  return [];
}

// ------------------------------------------------------------------
// Attach preview modal handlers
// ------------------------------------------------------------------
function attachPreviewHandlers() {
  const showBtn = document.getElementById(SHOW_PREVIEW_BTN_ID);
  const closeBtn = document.getElementById(CLOSE_PREVIEW_BTN_ID);
  const modal = document.getElementById(PREVIEW_MODAL_ID);

  if (showBtn) {
    showBtn.addEventListener("click", async () => {
      try {
        setStatus("Preparing preview...", 2500);
        let questions = [];
        if (typeof window.getQuestions === "function") {
          try {
            const got = window.getQuestions();
            if (Array.isArray(got) && got.length > 0) questions = got;
          } catch (e) {
            // ignore
          }
        }
        if (questions.length === 0) questions = collectQuestionsFromDOM();
        if (questions.length === 0) {
          toast("No questions found to preview. Make sure the editor has questions.", "error");
          return;
        }
        const meta = {
          title: document.getElementById("assessmentSelect")?.value || "",
          theclass: document.getElementById("classSelect")?.value || document.getElementById("classInput")?.value || "",
          term: document.getElementById("termSelect")?.value || "",
          year: document.getElementById("yearInput")?.value || new Date().getFullYear(),
          subject: document.getElementById("subjectSelect")?.value || ""
        };
        openPreviewModalFromData(questions, meta);
      } catch (err) {
        console.error(err);
        toast("Failed to open preview.", "error");
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => (modal.style.display = "none"));
  }

  if (modal) {
    modal.addEventListener("click", ev => {
      if (ev.target === modal) modal.style.display = "none";
    });
  }
}

// ------------------------------------------------------------------
// Initialize on DOM ready
// ------------------------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachPreviewHandlers);
} else {
  attachPreviewHandlers();
}

// ------------------------------------------------------------------
// Default export
// ------------------------------------------------------------------
export default { renderMath, openPreviewModalFromData };
