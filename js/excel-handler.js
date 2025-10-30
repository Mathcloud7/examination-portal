// --------------------------------------------
// Excel Handler Module (with KaTeX + Preview)
// --------------------------------------------
// Dependencies: utils.js, firebase-config.js, question-editor.js, preview.js
// --------------------------------------------

import { showToast, showLoader, hideLoader } from "./utils.js";
import { renderMath } from "./preview.js";
import { addQuestion } from "./question-editor.js";

// Include SheetJS from CDN
const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
const KATEX_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";

loadExternalLibraries();

/**
 * Loads required libraries (SheetJS + KaTeX)
 */
function loadExternalLibraries() {
  // Load SheetJS
  const script = document.createElement("script");
  script.src = XLSX_URL;
  script.defer = true;
  document.head.appendChild(script);

  // Load KaTeX CSS
  const katexCss = document.createElement("link");
  katexCss.rel = "stylesheet";
  katexCss.href = KATEX_CSS;
  document.head.appendChild(katexCss);

  // Load KaTeX JS
  const katexScript = document.createElement("script");
  katexScript.src = KATEX_JS;
  katexScript.defer = true;
  document.head.appendChild(katexScript);
}

// DOM Elements
const excelInput = document.getElementById("excelInput");
const previewContainer = document.getElementById("excelPreviewContainer");
const loadToEditorBtn = document.getElementById("loadToEditorBtn");

let parsedQuestions = [];

// --------------------------------------------
// Excel Upload + Preview
// --------------------------------------------

if (excelInput) {
  excelInput.addEventListener("change", handleExcelFile, false);
}

async function handleExcelFile(e) {
  const file = e.target.files[0];
  if (!file) {
    showToast("Please select an Excel file.", "error");
    return;
  }

  showLoader("Reading Excel...");

  try {
    const reader = new FileReader();

    reader.onload = function (event) {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!json || json.length === 0) {
        showToast("Excel file is empty.", "error");
        hideLoader();
        return;
      }

      parsedQuestions = parseExcelData(json);
      renderPreview(parsedQuestions);
      hideLoader();
      showToast("Excel loaded successfully!", "success");
    };

    reader.readAsArrayBuffer(file);
  } catch (error) {
    console.error(error);
    hideLoader();
    showToast("Error reading Excel file.", "error");
  }
}

/**
 * Converts Excel rows to structured question objects
 */
function parseExcelData(json) {
  const questions = [];

  json.forEach((row, index) => {
    const questionText = row["Question"] || row["question"] || "";
    const optionA = row["A"] || row["Option A"] || row["a"] || "";
    const optionB = row["B"] || row["Option B"] || row["b"] || "";
    const optionC = row["C"] || row["Option C"] || row["c"] || "";
    const optionD = row["D"] || row["Option D"] || row["d"] || "";
    const answer = row["Answer"] || row["Correct Answer"] || "";
    const marks = row["Marks"] || row["Score"] || 1;

    if (questionText.trim() !== "") {
      questions.push({
        id: `q_${index + 1}`,
        question: questionText,
        options: [optionA, optionB, optionC, optionD],
        answer,
        marks,
      });
    }
  });

  return questions;
}

/**
 * Renders Excel preview table with KaTeX math symbols
 */
function renderPreview(questions) {
  previewContainer.innerHTML = "";

  if (!questions || questions.length === 0) {
    previewContainer.innerHTML = `<p class="text-center text-gray-500">No questions found.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className =
    "w-full border border-gray-300 text-sm rounded-lg overflow-hidden shadow";

  // Table header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr class="bg-blue-100 font-semibold text-gray-800">
      <th class="p-2 border">#</th>
      <th class="p-2 border">Question</th>
      <th class="p-2 border">A</th>
      <th class="p-2 border">B</th>
      <th class="p-2 border">C</th>
      <th class="p-2 border">D</th>
      <th class="p-2 border">Answer</th>
      <th class="p-2 border">Marks</th>
    </tr>
  `;
  table.appendChild(thead);

  // Table body
  const tbody = document.createElement("tbody");

  questions.forEach((q, i) => {
    const row = document.createElement("tr");
    row.className = i % 2 === 0 ? "bg-white" : "bg-gray-50";

    row.innerHTML = `
      <td class="p-2 border text-center">${i + 1}</td>
      <td class="p-2 border question-cell">${q.question}</td>
      <td class="p-2 border">${q.options[0]}</td>
      <td class="p-2 border">${q.options[1]}</td>
      <td class="p-2 border">${q.options[2]}</td>
      <td class="p-2 border">${q.options[3]}</td>
      <td class="p-2 border text-center font-semibold text-green-700">${q.answer}</td>
      <td class="p-2 border text-center">${q.marks}</td>
    `;

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  previewContainer.appendChild(table);

  // Render KaTeX math in questions and options
  renderMath(previewContainer);
}

/**
 * When user clicks "Load to Editor"
 * → Sends parsed questions to the editor area.
 */
if (loadToEditorBtn) {
  loadToEditorBtn.addEventListener("click", () => {
    if (parsedQuestions.length === 0) {
      showToast("No questions to load. Upload an Excel file first.", "error");
      return;
    }

    showLoader("Loading questions to editor...");
    parsedQuestions.forEach((q) => addQuestion(q));
    hideLoader();
    showToast(`${parsedQuestions.length} questions loaded to editor.`, "success");
  });
}

export { parsedQuestions };
