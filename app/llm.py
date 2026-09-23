import re

from openai import AzureOpenAI, OpenAI

from app.config import settings
from app.models import (
    Document,
    Entity,
    LLMEntityResult,
    LLMOntologyResult,
    LLMRelationshipResult,
    NodeLabel,
    Relationship,
    RelationshipType,
)
from app.storage import resolve_citation_offsets


class LLMError(RuntimeError):
    """Raised when an LLM call fails after its retry."""


_client: OpenAI | AzureOpenAI | None = None


def get_client() -> OpenAI | AzureOpenAI:
    global _client
    if _client is None:
        if settings.llm_provider == "azure_openai":
            _client = AzureOpenAI(
                api_key=settings.azure_openai_api_key,
                azure_endpoint=settings.azure_openai_endpoint,
                api_version=settings.azure_openai_api_version,
            )
        else:
            _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def slugify(prefix: str, name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    return f"{prefix}_{slug or 'unnamed'}"


def _parse(model: str, system_prompt: str, user_prompt: str, response_format):
    client = get_client()
    last_error: Exception | None = None
    for _ in range(2):
        try:
            completion = client.chat.completions.parse(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=response_format,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is not None:
                return parsed
            last_error = RuntimeError("Model returned no parsed content")
        except Exception as exc:  # noqa: BLE001 - broad: retry any parse/API failure once
            last_error = exc
    raise LLMError(f"LLM call failed after retry: {last_error}") from last_error


ONTOLOGY_SYSTEM_PROMPT = """You are an ontology engineer building a knowledge-graph schema \
from a set of source documents. Propose a compact, reusable ontology: 5-15 node labels \
(entity types) and a modest set of relationship types connecting them.

Rules:
- Every node label and relationship type MUST be backed by at least one citation.
- Each citation's `quote` must be copied VERBATIM (exact substring, no paraphrasing) from \
the referenced document's content, and its `document_id` must match that document.
- Relationship types must declare plausible `source_labels` and `target_labels` drawn from \
the node labels you propose (by name).
- Keep names short, singular, PascalCase for node labels (e.g. "Person", "Organization") and \
UPPER_SNAKE_CASE for relationship types (e.g. "WORKS_FOR")."""


def generate_ontology(
    documents: list[Document], model: str | None = None
) -> tuple[list[NodeLabel], list[RelationshipType]]:
    model = model or settings.default_llm_model
    doc_blocks = "\n\n".join(
        f"### document_id: {doc.id}\ncategory: {doc.category}\n\n{doc.content}" for doc in documents
    )
    result: LLMOntologyResult = _parse(
        model, ONTOLOGY_SYSTEM_PROMPT, doc_blocks, LLMOntologyResult
    )
    content_by_doc = {doc.id: doc.content for doc in documents}

    node_labels: list[NodeLabel] = []
    for label in result.node_labels:
        citations = []
        for c in label.citations:
            start, end = resolve_citation_offsets(content_by_doc.get(c.document_id, ""), c.quote)
            citations.append(
                {"document_id": c.document_id, "quote": c.quote, "start_offset": start, "end_offset": end}
            )
        node_labels.append(
            NodeLabel(
                id=slugify("label", label.name),
                name=label.name,
                description=label.description,
                citations=citations,
            )
        )

    relationship_types: list[RelationshipType] = []
    for rel in result.relationship_types:
        citations = []
        for c in rel.citations:
            start, end = resolve_citation_offsets(content_by_doc.get(c.document_id, ""), c.quote)
            citations.append(
                {"document_id": c.document_id, "quote": c.quote, "start_offset": start, "end_offset": end}
            )
        relationship_types.append(
            RelationshipType(
                id=slugify("rel", rel.name),
                name=rel.name,
                description=rel.description,
                source_labels=rel.source_labels,
                target_labels=rel.target_labels,
                citations=citations,
            )
        )

    return node_labels, relationship_types


def extract_entities_llm(
    content: str, node_labels: list[NodeLabel], model: str | None = None
) -> list[Entity]:
    model = model or settings.default_llm_model
    allowed = [label.name for label in node_labels]
    system_prompt = (
        "You are an information-extraction system. Extract every entity mention from the "
        "user's text that belongs to ONE of the following closed set of entity types. Do NOT "
        "invent new types outside this list:\n"
        + "\n".join(f"- {name}" for name in allowed)
        + "\n\nFor each entity, `quote` must be the EXACT verbatim text span from the source "
        "that names the entity."
    )
    result: LLMEntityResult = _parse(model, system_prompt, content, LLMEntityResult)

    entities: list[Entity] = []
    for i, e in enumerate(result.entities):
        if e.label not in allowed:
            continue
        start, end = resolve_citation_offsets(content, e.quote)
        entities.append(
            Entity(
                id=f"ent_{i + 1}",
                text=e.text,
                label=e.label,
                start=start,
                end=end,
                method="llm",
                raw_ner_label=None,
                confidence=None,
            )
        )
    return entities


def extract_relationships_llm(
    content: str,
    relationship_types: list[RelationshipType],
    entities: list[Entity],
    model: str | None = None,
) -> tuple[list[Relationship], int]:
    model = model or settings.default_llm_model
    allowed_types = {rt.name: rt for rt in relationship_types}
    entity_ids = {e.id for e in entities}
    entity_lines = "\n".join(f"- id={e.id}, text={e.text!r}, label={e.label}" for e in entities)
    type_lines = "\n".join(
        f"- {rt.name}: source in {rt.source_labels or ['any']}, target in {rt.target_labels or ['any']}"
        for rt in relationship_types
    )
    system_prompt = (
        "You are an information-extraction system. Given a list of already-extracted entities "
        "and a closed set of relationship types, find every relationship between two of the "
        "listed entities that matches one of these types (do NOT invent new types):\n"
        f"{type_lines}\n\nEntities:\n{entity_lines}\n\n"
        "Reference entities ONLY by their `id` field above for `source_entity_id`/"
        "`target_entity_id`. Optionally include a short verbatim `quote` supporting the relation."
    )
    result: LLMRelationshipResult = _parse(model, system_prompt, content, LLMRelationshipResult)

    relationships: list[Relationship] = []
    dropped = 0
    for i, r in enumerate(result.relationships):
        if (
            r.type not in allowed_types
            or r.source_entity_id not in entity_ids
            or r.target_entity_id not in entity_ids
        ):
            dropped += 1
            continue
        relationships.append(
            Relationship(
                id=f"rel_{i + 1}",
                type=r.type,
                source_entity_id=r.source_entity_id,
                target_entity_id=r.target_entity_id,
                quote=r.quote or None,
                confidence=None,
            )
        )
    return relationships, dropped
