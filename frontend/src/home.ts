import { api, ApiRequestError } from "./api.js";
import { formatTimestamp, navigateTo, showStatus } from "./state.js";
import { DocumentOut } from "./types.js";

const categoryInput = document.getElementById("category") as HTMLInputElement;
const pasteContent = document.getElementById("paste-content") as HTMLTextAreaElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const addPasteBtn = document.getElementById("add-paste-btn") as HTMLButtonElement;
const addFileBtn = document.getElementById("add-file-btn") as HTMLButtonElement;
const documentList = document.getElementById("document-list") as HTMLElement;
const statusEl = document.getElementById("documents-status") as HTMLElement;
const continueBtn = document.getElementById("documents-continue-btn") as HTMLButtonElement;

function requireCategory(): string | null {
  const category = categoryInput.value.trim();
  if (!category) {
    showStatus(statusEl, "Please enter a category before adding a document.", "error");
    categoryInput.focus();
    return null;
  }
  return category;
}

async function refreshDocuments(): Promise<void> {
  const docs = await api.listDocuments();
  documentList.innerHTML = "";
  continueBtn.disabled = docs.length === 0;

  if (docs.length === 0) {
    documentList.innerHTML = '<p class="empty-hint">No documents added yet.</p>';
    return;
  }

  for (const doc of docs) {
    documentList.appendChild(renderDocumentCard(doc));
  }
}

function renderDocumentCard(doc: DocumentOut): HTMLElement {
  const card = document.createElement("div");
  card.className = "doc-card";
  card.innerHTML = `
    <div class="doc-card-header">
      <strong>${escapeHtml(doc.filename)}</strong>
      <span class="badge">${escapeHtml(doc.category)}</span>
    </div>
    <p class="doc-preview">${escapeHtml(doc.preview)}${doc.char_count > doc.preview.length ? "…" : ""}</p>
    <div class="doc-card-footer">
      <span class="muted">${doc.char_count} chars · added ${formatTimestamp(doc.created_at)}</span>
      <button class="link-btn danger" data-id="${doc.id}">Remove</button>
    </div>
  `;
  card.querySelector("button")?.addEventListener("click", async () => {
    await api.deleteDocument(doc.id);
    await refreshDocuments();
  });
  return card;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

addPasteBtn.addEventListener("click", async () => {
  const category = requireCategory();
  if (!category) return;
  const content = pasteContent.value.trim();
  if (!content) {
    showStatus(statusEl, "Paste some markdown content first.", "error");
    return;
  }
  try {
    await api.addDocumentFromText(category, content);
    pasteContent.value = "";
    showStatus(statusEl, "Document added.", "success");
    await refreshDocuments();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

addFileBtn.addEventListener("click", async () => {
  const category = requireCategory();
  if (!category) return;
  const files = fileInput.files;
  if (!files || files.length === 0) {
    showStatus(statusEl, "Choose one or more .md files first.", "error");
    return;
  }
  try {
    for (const file of Array.from(files)) {
      await api.addDocumentFromFile(category, file);
    }
    fileInput.value = "";
    showStatus(statusEl, `Added ${files.length} document(s).`, "success");
    await refreshDocuments();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

continueBtn.addEventListener("click", () => {
  navigateTo("ontology");
});

export function activate(): void {
  refreshDocuments();
}
