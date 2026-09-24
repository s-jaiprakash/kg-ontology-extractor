import { api, ApiRequestError } from "./api.js";
import { assertOntologyApproved, showStatus } from "./state.js";
import { Entity, KnowledgeGraphOut, Relationship } from "./types.js";

const contentInput = document.getElementById("extraction-content") as HTMLTextAreaElement;
const fileInput = document.getElementById("extraction-file-input") as HTMLInputElement;
const loadFilesBtn = document.getElementById("load-files-btn") as HTMLButtonElement;
const entityMethodSelect = document.getElementById("entity-method") as HTMLSelectElement;
const relModelSelect = document.getElementById("rel-model") as HTMLSelectElement;
const extractEntitiesBtn = document.getElementById("extract-entities-btn") as HTMLButtonElement;
const extractRelsBtn = document.getElementById("extract-rels-btn") as HTMLButtonElement;
const exportGraphBtn = document.getElementById("export-graph-btn") as HTMLButtonElement;
const statusEl = document.getElementById("extraction-status") as HTMLElement;
const entitiesTableBody = document.querySelector("#entities-table tbody") as HTMLElement;
const relsTableBody = document.querySelector("#rels-table tbody") as HTMLElement;
const graphJson = document.getElementById("graph-json") as HTMLElement;
const unmappedNote = document.getElementById("unmapped-note") as HTMLElement;

let lastEntities: Entity[] = [];
let lastGraph: KnowledgeGraphOut | null = null;

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function populateOptions(): Promise<void> {
  const options = await api.getExtractionOptions();
  entityMethodSelect.innerHTML = options.entity_methods
    .map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`)
    .join("");
  relModelSelect.innerHTML = options.relationship_models
    .map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`)
    .join("");
}

function renderEntities(entities: Entity[]): void {
  entitiesTableBody.innerHTML = entities
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(e.text)}</td>
        <td><span class="badge">${escapeHtml(e.label)}</span></td>
        <td>${escapeHtml(e.method)}${e.raw_ner_label ? ` (${escapeHtml(e.raw_ner_label)})` : ""}</td>
      </tr>`
    )
    .join("");
}

function renderRelationships(relationships: Relationship[], entities: Entity[]): void {
  const byId = new Map(entities.map((e) => [e.id, e]));
  relsTableBody.innerHTML = relationships
    .map((r) => {
      const source = byId.get(r.source_entity_id);
      const target = byId.get(r.target_entity_id);
      return `
      <tr>
        <td>${escapeHtml(source?.text ?? r.source_entity_id)}</td>
        <td><span class="badge">${escapeHtml(r.type)}</span></td>
        <td>${escapeHtml(target?.text ?? r.target_entity_id)}</td>
      </tr>`;
    })
    .join("");
}

function renderGraph(graph: KnowledgeGraphOut): void {
  lastGraph = graph;
  exportGraphBtn.disabled = false;
  graphJson.textContent = JSON.stringify(graph, null, 2);
}

loadFilesBtn.addEventListener("click", async () => {
  const files = fileInput.files;
  if (!files || files.length === 0) {
    showStatus(statusEl, "Choose one or more .md files first.", "error");
    return;
  }
  const parts = await Promise.all(
    Array.from(files).map(async (file) => `<!-- ${file.name} -->\n${await file.text()}`)
  );
  const combined = parts.join("\n\n---\n\n");
  contentInput.value = contentInput.value.trim()
    ? `${contentInput.value.trim()}\n\n---\n\n${combined}`
    : combined;
  fileInput.value = "";
  showStatus(statusEl, `Loaded ${files.length} file(s) into the content box.`, "success");
});

exportGraphBtn.addEventListener("click", () => {
  if (!lastGraph) return;
  const blob = new Blob([JSON.stringify(lastGraph, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "knowledge-graph.json";
  a.click();
  URL.revokeObjectURL(url);
});

extractEntitiesBtn.addEventListener("click", async () => {
  const content = contentInput.value.trim();
  if (!content) {
    showStatus(statusEl, "Paste some markdown content first.", "error");
    return;
  }
  try {
    showStatus(statusEl, "Extracting entities…", "info");
    const method = entityMethodSelect.value as "llm" | "ner";
    const result = await api.extractEntities(content, method);
    lastEntities = result.entities;
    lastGraph = null;
    exportGraphBtn.disabled = true;
    relsTableBody.innerHTML = "";
    graphJson.textContent = "{}";
    renderEntities(result.entities);
    unmappedNote.hidden = result.unmapped_ner_labels.length === 0;
    unmappedNote.textContent = result.unmapped_ner_labels.length
      ? `Local NER also found types not in your ontology (ignored): ${result.unmapped_ner_labels.join(", ")}`
      : "";
    extractRelsBtn.disabled = false;
    showStatus(statusEl, `Extracted ${result.entities.length} entities.`, "success");
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

extractRelsBtn.addEventListener("click", async () => {
  const content = contentInput.value.trim();
  try {
    showStatus(statusEl, "Extracting relationships…", "info");
    const result = await api.extractRelationships(content);
    renderRelationships(result.relationships, lastEntities);
    const graph = await api.getGraph();
    renderGraph(graph);
    showStatus(
      statusEl,
      `Extracted ${result.relationships.length} relationships` +
        (result.dropped_count ? ` (${result.dropped_count} dropped as invalid).` : "."),
      "success"
    );
  } catch (err) {
    showStatus(statusEl, err instanceof ApiRequestError ? err.message : String(err), "error");
  }
});

export async function activate(): Promise<void> {
  const ok = await assertOntologyApproved();
  if (!ok) return;
  if (entityMethodSelect.options.length === 0) {
    await populateOptions();
  }
  extractRelsBtn.disabled = lastEntities.length === 0;
}
