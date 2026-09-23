import { api, ApiRequestError } from "./api.js";
import { assertOntologyApproved, showStatus } from "./state.js";
import { Entity, KnowledgeGraphOut, Relationship } from "./types.js";

const contentInput = document.getElementById("extraction-content") as HTMLTextAreaElement;
const entityMethodSelect = document.getElementById("entity-method") as HTMLSelectElement;
const relModelSelect = document.getElementById("rel-model") as HTMLSelectElement;
const extractEntitiesBtn = document.getElementById("extract-entities-btn") as HTMLButtonElement;
const extractRelsBtn = document.getElementById("extract-rels-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;
const entitiesTableBody = document.querySelector("#entities-table tbody") as HTMLElement;
const relsTableBody = document.querySelector("#rels-table tbody") as HTMLElement;
const graphJson = document.getElementById("graph-json") as HTMLElement;
const unmappedNote = document.getElementById("unmapped-note") as HTMLElement;

let lastEntities: Entity[] = [];

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
  graphJson.textContent = JSON.stringify(graph, null, 2);
}

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

async function init(): Promise<void> {
  const ok = await assertOntologyApproved();
  if (!ok) return;
  await populateOptions();
  extractRelsBtn.disabled = true;
}

init();
