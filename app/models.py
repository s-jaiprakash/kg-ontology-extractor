from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

EntityMethod = Literal["llm", "ner"]
DocumentSource = Literal["upload", "paste"]
OntologyStatus = Literal["draft", "approved"]


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class Document(BaseModel):
    id: str
    filename: str
    category: str
    content: str
    source: DocumentSource
    created_at: datetime


class DocumentOut(BaseModel):
    id: str
    filename: str
    category: str
    preview: str
    char_count: int
    created_at: datetime


class DocumentDetail(Document):
    pass


# ---------------------------------------------------------------------------
# Ontology
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    document_id: str
    quote: str
    start_offset: int | None = None
    end_offset: int | None = None


class NodeLabel(BaseModel):
    id: str
    name: str
    description: str = ""
    citations: list[Citation] = Field(default_factory=list)
    ner_supported: bool = False


class RelationshipType(BaseModel):
    id: str
    name: str
    description: str = ""
    source_labels: list[str] = Field(default_factory=list)
    target_labels: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)


class Ontology(BaseModel):
    status: OntologyStatus = "draft"
    node_labels: list[NodeLabel] = Field(default_factory=list)
    relationship_types: list[RelationshipType] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None


class OntologyGenerateRequest(BaseModel):
    document_ids: list[str] | None = None
    model: str | None = None


class OntologyUpdateRequest(BaseModel):
    node_labels: list[NodeLabel]
    relationship_types: list[RelationshipType]


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


class Entity(BaseModel):
    id: str
    text: str
    label: str
    start: int | None = None
    end: int | None = None
    method: EntityMethod
    raw_ner_label: str | None = None
    confidence: float | None = None


class EntityExtractionRequest(BaseModel):
    content: str
    method: EntityMethod
    model: str | None = None


class EntityExtractionResult(BaseModel):
    entities: list[Entity]
    method: EntityMethod
    model: str
    content: str
    unmapped_ner_labels: list[str] = Field(default_factory=list)
    generated_at: datetime


class Relationship(BaseModel):
    id: str
    type: str
    source_entity_id: str
    target_entity_id: str
    quote: str | None = None
    confidence: float | None = None


class RelationshipExtractionRequest(BaseModel):
    content: str
    model: str | None = None


class RelationshipExtractionResult(BaseModel):
    relationships: list[Relationship]
    model: str
    dropped_count: int = 0
    generated_at: datetime


class ExtractionOptions(BaseModel):
    entity_methods: list[dict[str, str]]
    relationship_models: list[dict[str, str]]


class KnowledgeGraphOut(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]
    generated_at: datetime


# ---------------------------------------------------------------------------
# LLM-facing schemas (kept separate: the model never invents ids/offsets)
# ---------------------------------------------------------------------------


class LLMCitation(BaseModel):
    document_id: str
    quote: str


class LLMNodeLabel(BaseModel):
    name: str
    description: str = ""
    citations: list[LLMCitation] = Field(default_factory=list)


class LLMRelationshipType(BaseModel):
    name: str
    description: str = ""
    source_labels: list[str] = Field(default_factory=list)
    target_labels: list[str] = Field(default_factory=list)
    citations: list[LLMCitation] = Field(default_factory=list)


class LLMOntologyResult(BaseModel):
    node_labels: list[LLMNodeLabel]
    relationship_types: list[LLMRelationshipType]


class LLMEntity(BaseModel):
    text: str
    label: str
    quote: str


class LLMEntityResult(BaseModel):
    entities: list[LLMEntity]


class LLMRelationship(BaseModel):
    type: str
    source_entity_id: str
    target_entity_id: str
    quote: str = ""


class LLMRelationshipResult(BaseModel):
    relationships: list[LLMRelationship]
