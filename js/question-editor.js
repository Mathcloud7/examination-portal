// ------------------------------------------------------
// Question Editor Module — Final Complete Version
// ------------------------------------------------------
// Dependencies: firebase-config.js, utils.js, preview.js
// ------------------------------------------------------

import { showToast, showLoader, hideLoader, confirmAction } from "./utils.js";
import { renderMath } from "./preview.js";
import { storage } from "./firebase-config.js";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Main elements
const questionList = document.getElementById("questionList");
const addQuestionBtn = document.getElementById("addQuestionBtn");
const saveAssessmentBtn = document.getElementById("saveAssessmentBtn");

let questions = [];

// ------------------------------------------------------
// Add a new blank question
// ------------------------------------------------------
if (addQuestionBtn) {
  addQuestionBtn.addEventListener("click", () => {
    const q = {
      id: `q_${Date.now()}`,
      question: "",
      options: ["", "", "", ""],
      answer: "",
      marks: 1,
      imageUrl: ""
    };
    questions.push(q);
    renderQuestionEditor(q);
  });
}

// ------------------------------------------------------
// Render question editor block
// ------------------------------------------------------
function renderQuestionEditor(q) {
  const div = document.createElement("div");
  div.className =
    "p-4 bg-white rounded-xl shadow-md border border-gray-200 my-3 relative question-block";
  div.setAttribute("data-id", q.id);

  div.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-lg font-semibold text-gray-700">Question</h3>
      <button class="deleteBtn text-red-600 text-sm hover:underline">Delete</button>
    </div>

    <textarea class="questionInput w-full border rounded-md p-2 mb-2 text-gray-700" 
      placeholder="Enter question text (you can use math: $a^2 + b^2 = c^2$)">${q.question}</textarea>

    <div class="image-section flex items-center gap-2 mb-2">
      <input type="file" class="imageInput hidden" accept="image/*">
      <button class="uploadImageBtn bg-blue-50 text-blue-700 px-3 py-1 rounded-md border border-blue-200 hover:bg-blue-100 text-sm">Upload Image</button>
      <span class="imageName text-sm text-gray-500">${q.imageUrl ? "Image uploaded ✓" : ""}</span>
    </div>

    <div class="grid grid-cols-2 gap-2 mb-2">
      ${q.options
        .map(
          (opt, i) => `
          <input type="text" class="optionInput border rounded-md p-2" 
            data-index="${i}" placeholder="Option ${String.fromCharCode(65 + i)}"
            value="${opt}">
        `
        )
        .join("")}
    </div>

    <div class="flex items-center gap-2 mb-2">
      <label class="font-medium text-gray-600">Correct Answer:</label>
      <select class="answerSelect border rounded-md p-1">
        <option value="">Select</option>
        ${["A", "B", "C", "D"]
          .map(
            (letter) =>
              `<option value="${letter}" ${
                q.answer === letter ? "selected" : ""
              }>${letter}</option>`
          )
          .join("")}
      </select>

      <label class="font-medium text-gray-600 ml-3">Marks:</label>
      <input type="number" class="marksInput border rounded-md p-1 w-20" min="1" value="${q.marks}">
    </div>

    <div class="text-right">
      <button class="previewBtn text-blue-600 hover:underline text-sm">Preview</button>
    </div>

    <div class="previewArea hidden bg-gray-50 border border-gray-200 p-3 mt-2 rounded-md"></div>
  `;

  // Append to container
  questionList.appendChild(div);

  // Event listeners
  const deleteBtn = div.querySelector(".deleteBtn");
  const previewBtn = div.querySelector(".previewBtn");
  const imageBtn = div.querySelector(".uploadImageBtn");
  const imageInput = div.querySelector(".imageInput");
  const imageName = div.querySelector(".imageName");

  // Delete Question
  deleteBtn.addEventListener("click", () => {
    confirmAction("Delete this question?", () => {
      div.remove();
      questions = questions.filter((x) => x.id !== q.id);
      showToast("Question deleted.", "info");
    });
  });

  // Preview Question (with Math Rendering)
  previewBtn.addEventListener("click", () => {
    const previewArea = div.querySelector(".previewArea");
    const questionText = div.querySelector(".questionInput").value;
    const options = Array.from(div.querySelectorAll(".optionInput")).map((i) => i.value);

    previewArea.innerHTML = `
      <p class="mb-2 font-semibold text-gray-700">${questionText}</p>
      ${
        q.imageUrl
          ? `<img src="${q.imageUrl}" class="w-40 h-auto rounded-md mb-2 border border-gray-200">`
          : ""
      }
      <ul class="list-disc ml-5 text-gray-600">
        ${options.map((opt) => `<li>${opt}</li>`).join("")}
      </ul>
    `;
    renderMath(previewArea);
    previewArea.classList.toggle("hidden");
  });

  // Upload Image
  imageBtn.addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showLoader("Uploading image...");
    try {
      const fileRef = ref(storage, `exam-images/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          imageName.textContent = `Uploading... ${progress}%`;
        },
        (error) => {
          console.error(error);
          hideLoader();
          showToast("Image upload failed.", "error");
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          q.imageUrl = url;
          imageName.textContent = "Image uploaded ✓";
          hideLoader();
          showToast("Image uploaded successfully!", "success");
        }
      );
    } catch (err) {
      console.error(err);
      hideLoader();
      showToast("Error uploading image.", "error");
    }
  });
}

// ------------------------------------------------------
// Add question from Excel or other imports
// ------------------------------------------------------
function addQuestion(q) {
  questions.push(q);
  renderQuestionEditor(q);
}

// ------------------------------------------------------
// Collect all question data
// ------------------------------------------------------
function getQuestions() {
  const all = [];
  const blocks = document.querySelectorAll(".question-block");

  blocks.forEach((div) => {
    const id = div.dataset.id;
    const questionText = div.querySelector(".questionInput").value.trim();
    const options = Array.from(div.querySelectorAll(".optionInput")).map((i) =>
      i.value.trim()
    );
    const answer = div.querySelector(".answerSelect").value;
    const marks = parseInt(div.querySelector(".marksInput").value) || 1;

    const current = questions.find((q) => q.id === id);
    const imageUrl = current?.imageUrl || "";

    if (questionText !== "") {
      all.push({ id, question: questionText, options, answer, marks, imageUrl });
    }
  });

  return all;
}

// ------------------------------------------------------
// Save Assessment Button (stub — Firebase saving next)
// ------------------------------------------------------
if (saveAssessmentBtn) {
  saveAssessmentBtn.addEventListener("click", () => {
    const all = getQuestions();
    if (all.length === 0) {
      showToast("No questions to save.", "error");
      return;
    }

    console.log("Questions ready to save:", all);
    showToast(`${all.length} questions ready to save. (Firebase integration next)`, "success");
  });
}

export { addQuestion, getQuestions, questions };
