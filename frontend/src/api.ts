import {
  DocumentDetail,
  DocumentOut,
  EntityExtractionResult,
  ExtractionOptions,
  KnowledgeGraphOut,
  Ontology,
  RelationshipExtractionResult,
} from "./types.js";

class ApiRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiRequestError(detail, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  // Documents
  listDocuments: () => request<DocumentOut[]>("/api/documents"),
  getDocument: (id: string) => request<DocumentDetail>(`/api/documents/${id}`),
  addDocumentFromText: (category: string, content: string) => {
    const form = new FormData();
    form.append("category", category);
    form.append("content", content);
    return request<DocumentOut>("/api/documents", { method: "POST", body: form });
  },
  addDocumentFromFile: (category: string, file: File) => {
    const form = new FormData();
    form.append("category", category);
    form.append("file", file);
    return request<DocumentOut>("/api/documents", { method: "POST", body: form });
  },
  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  // Ontology
  generateOntology: (documentIds?: string[], model?: string) =>
    request<Ontology>("/api/ontology/generate", json({ document_ids: documentIds ?? null, model: model ?? null })),
  getOntology: () => request<Ontology>("/api/ontology"),
  updateOntology: (ontology: Ontology) =>
    request<Ontology>("/api/ontology", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_labels: ontology.node_labels,
        relationship_types: ontology.relationship_types,
      }),
    }),
  approveOntology: () => request<Ontology>("/api/ontology/approve", { method: "POST" }),
  resetOntology: () => request<Ontology>("/api/ontology/reset", { method: "POST" }),

  // Extraction
  getExtractionOptions: () => request<ExtractionOptions>("/api/extraction/options"),
  extractEntities: (content: string, method: "llm" | "ner", model?: string) =>
    request<EntityExtractionResult>("/api/extraction/entities", json({ content, method, model: model ?? null })),
  extractRelationships: (content: string, model?: string) =>
    request<RelationshipExtractionResult>(
      "/api/extraction/relationships",
      json({ content, model: model ?? null })
    ),
  getGraph: () => request<KnowledgeGraphOut>("/api/extraction/graph"),
};

export { ApiRequestError };
