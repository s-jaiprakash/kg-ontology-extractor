import { api, ApiRequestError } from "./api.js";
import { showStatus } from "./state.js";
import { NodeLabel, Ontology, RelationshipType } from "./types.js";

const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
const importFileInput = document.getElementById("import-file-input") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const approveBtn = document.getElementById("approve-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const continueBtn = document.getElementById("continue-btn") as HTMLButtonElement;
const addLabelBtn = document.getElementById("add-label-btn") as HTMLButtonElement;
const addRelBtn = document.getElementById("add-rel-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;
const statusBanner = document.getElementById("status-banner") as HTMLElement;
const labelsContainer = document.getElementById("labels-container") as HTMLElement;
const relsContainer = document.getElementById("rels-container") as HTMLElement;
const emptyState = document.getElementById("empty-state") as HTMLElement;
const editorArea = document.getElementById("editor-area") as HTMLElement;

let ontology: Ontology | null = null;

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function citationHtml(citations: NodeLabel["citations"]): string {
  if (citations.length === 0) return '<p class="muted small">No citations.</p>';
  return citations
    .map(
      (c) => `
      <div class="citation">
        <span class="citation-doc">${escapeHtml(c.document_id)}</span>
        <blockquote>${escapeHtml(c.quote)}</blockquote>
      </div>`
    )
    .join("");
}

function setEditable(disabled: boolean): void {
  labelsContainer.querySelectorAll("input, textarea").forEach((el) => ((el as HTMLInputElement).disabled = disabled));
  relsContainer.querySelectorAll("input, textarea").forEach((el) => ((el as HTMLInputElement).disabled = disabled));
  addLabelBtn.disabled = disabled;
  addRelBtn.disabled = disabled;
  saveBtn.hidden = disabled;
  generateBtn.disabled = disabled;
  importBtn.disabled = disabled;
  approveBtn.hidden = disabled;
  resetBtn.hidden = !disabled;
  continueBtn.hidden = !disabled;
}

function render(): void {
  exportBtn.disabled = !ontology;
  if (!ontology) {
    emptyState.hidden = false;
    editorArea.hidden = true;
    return;
  }
  emptyState.hidden = true;
  editorArea.hidden = false;

  labelsContainer.innerHTML = "";
  ontology.node_labels.forEach((label, i) => labelsContainer.appendChild(renderLabelCard(label, i)));

  relsContainer.innerHTML = "";
  ontology.relationship_types.forEach((rel, i) => relsContainer.appendChild(renderRelCard(rel, i)));

  const approved = ontology.status === "approved";
  setEditable(approved);

  if (approved) {
    showStatus(statusBanner, "Ontology approved. You can reset it to make further edits.", "success");
  } else {
    showStatus(statusBanner, "Draft ontology — edit labels and relationships, then approve.", "info");
  }
}

function renderLabelCard(label: NodeLabel, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.innerHTML = `
    <div class="card-row">
      <input class="name-input" value="${escapeHtml(label.name)}" placeholder="Label name (e.g. Person)" />
      <span class="badge ${label.ner_supported ? "badge-ok" : "badge-muted"}">
        ${label.ner_supported ? "NER supported" : "LLM only"}
      </span>
      <button class="link-btn danger">Remove</button>
    </div>
    <textarea class="desc-input" placeholder="Description">${escapeHtml(label.description)}</textarea>
    ${citationHtml(label.citations)}
  `;
  const nameInput = card.querySelector(".name-input") as HTMLInputElement;
  const descInput = card.querySelector(".desc-input") as HTMLTextAreaElement;
  nameInput.addEventListener("input", () => (ontology!.node_labels[index].name = nameInput.value));
  descInput.addEventListener("input", () => (ontology!.node_labels[index].description = descInput.value));
  card.querySelector(".danger")?.addEventListener("click", () => {
    ontology!.node_labels.splice(index, 1);
    render();
  });
  return card;
}

function renderRelCard(rel: RelationshipType, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.innerHTML = `
    <div class="card-row">
      <input class="name-input" value="${escapeHtml(rel.name)}" placeholder="RELATIONSHIP_NAME" />
      <button class="link-btn danger">Remove</button>
    </div>
    <textarea class="desc-input" placeholder="Description">${escapeHtml(rel.description)}</textarea>
    <div class="card-row">
      <label class="small">Source labels (comma-separated)
        <input class="source-input" value="${escapeHtml(rel.source_labels.join(", "))}" />
      </label>
      <label class="small">Target labels (comma-separated)
        <input class="target-input" value="${escapeHtml(rel.target_labels.join(", "))}" />
      </label>
    </div>
    ${citationHtml(rel.citations)}
  `;
  const nameInput = card.querySelector(".name-input") as HTMLInputElement;
  const descInput = card.querySelector(".desc-input") as HTMLTextAreaElement;
  const sourceInput = card.querySelector(".source-input") as HTMLInputElement;
  const targetInput = card.querySelector(".target-input") as HTMLInputElement;
  const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  nameInput.addEventListener("input", () => (ontology!.relationship_types[index].name = nameInput.value));
  descInput.addEventListener("input", () => (ontology!.relationship_types[index].description = descInput.value));
  sourceInput.addEventListener(
    "input",
    () => (ontology!.relationship_types[index].source_labels = splitList(sourceInput.value))
  );
  targetInput.addEventListener(
    "input",
    () => (ontology!.relationship_types[index].target_labels = splitList(targetInput.value))
  );
  card.querySelector(".danger")?.addEventListener("click", () => {
    ontology!.relationship_types.splice(index, 1);
    render();
  });
  return card;
}

async function loadOntology(): Promise<void> {
  try {
    ontology = await api.getOntology();
  } catch {
    ontology = null;
  }
  render();
}

generateBtn.addEventListener("click", async () => {
  try {
    showStatus(statusEl, "Generating ontology from your documents…", "info");
    ontology = await api.generateOntology();
    showStatus(statusEl, "Ontology generated.", "success");
    render();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

addLabelBtn.addEventListener("click", () => {
  if (!ontology) return;
  ontology.node_labels.push({
    id: `label_new_${ontology.node_labels.length}`,
    name: "",
    description: "",
    citations: [],
    ner_supported: false,
  });
  render();
});

addRelBtn.addEventListener("click", () => {
  if (!ontology) return;
  ontology.relationship_types.push({
    id: `rel_new_${ontology.relationship_types.length}`,
    name: "",
    description: "",
    source_labels: [],
    target_labels: [],
    citations: [],
  });
  render();
});

saveBtn.addEventListener("click", async () => {
  if (!ontology) return;
  try {
    ontology = await api.updateOntology(ontology);
    showStatus(statusEl, "Changes saved.", "success");
    render();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

approveBtn.addEventListener("click", async () => {
  if (!ontology) return;
  try {
    await api.updateOntology(ontology);
    ontology = await api.approveOntology();
    showStatus(statusEl, "Ontology approved.", "success");
    render();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

resetBtn.addEventListener("click", async () => {
  try {
    ontology = await api.resetOntology();
    showStatus(statusEl, "Ontology reset to draft.", "info");
    render();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

continueBtn.addEventListener("click", () => {
  window.location.href = "extraction.html";
});

exportBtn.addEventListener("click", () => {
  if (!ontology) return;
  const blob = new Blob([JSON.stringify(ontology, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ontology.json";
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];
  importFileInput.value = "";
  if (!file) return;

  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    showStatus(statusEl, "That file isn't valid JSON.", "error");
    return;
  }

  try {
    showStatus(statusEl, "Importing ontology…", "info");
    ontology = await api.importOntology(data);
    showStatus(statusEl, "Ontology imported.", "success");
    render();
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

loadOntology();
