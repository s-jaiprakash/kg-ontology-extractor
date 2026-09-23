export type EntityMethod = "llm" | "ner";
export type DocumentSource = "upload" | "paste";
export type OntologyStatus = "draft" | "approved";

export interface DocumentOut {
  id: string;
  filename: string;
  category: string;
  preview: string;
  char_count: number;
  created_at: string;
}

export interface DocumentDetail extends DocumentOut {
  content: string;
  source: DocumentSource;
}

export interface Citation {
  document_id: string;
  quote: string;
  start_offset: number | null;
  end_offset: number | null;
}

export interface NodeLabel {
  id: string;
  name: string;
  description: string;
  citations: Citation[];
  ner_supported: boolean;
}

export interface RelationshipType {
  id: string;
  name: string;
  description: string;
  source_labels: string[];
  target_labels: string[];
  citations: Citation[];
}

export interface Ontology {
  status: OntologyStatus;
  node_labels: NodeLabel[];
  relationship_types: RelationshipType[];
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface Entity {
  id: string;
  text: string;
  label: string;
  start: number | null;
  end: number | null;
  method: EntityMethod;
  raw_ner_label: string | null;
  confidence: number | null;
}

export interface EntityExtractionResult {
  entities: Entity[];
  method: EntityMethod;
  model: string;
  content: string;
  unmapped_ner_labels: string[];
  generated_at: string;
}

export interface Relationship {
  id: string;
  type: string;
  source_entity_id: string;
  target_entity_id: string;
  quote: string | null;
  confidence: number | null;
}

export interface RelationshipExtractionResult {
  relationships: Relationship[];
  model: string;
  dropped_count: number;
  generated_at: string;
}

export interface ExtractionOptions {
  entity_methods: { id: string; label: string }[];
  relationship_models: { id: string; label: string }[];
}

export interface KnowledgeGraphOut {
  entities: Entity[];
  relationships: Relationship[];
  generated_at: string;
}

export interface ApiError {
  detail: string;
}
