from fastapi import APIRouter, HTTPException

from app import llm, ner, storage
from app.config import settings
from app.models import (
    EntityExtractionRequest,
    EntityExtractionResult,
    ExtractionOptions,
    KnowledgeGraphOut,
    RelationshipExtractionRequest,
    RelationshipExtractionResult,
)

router = APIRouter(prefix="/api/extraction", tags=["extraction"])


def _require_approved_ontology():
    ontology = storage.load_ontology()
    if not ontology or ontology.status != "approved":
        raise HTTPException(409, "Ontology must be approved before running extraction")
    return ontology


@router.get("/options", response_model=ExtractionOptions)
def get_options():
    return ExtractionOptions(
        entity_methods=[
            {"id": "llm", "label": f"LLM ({settings.openai_model})"},
            {"id": "ner", "label": f"Local NER ({settings.ner_model})"},
        ],
        relationship_models=[{"id": "llm", "label": f"LLM ({settings.openai_model})"}],
    )


@router.post("/entities", response_model=EntityExtractionResult)
def extract_entities(req: EntityExtractionRequest):
    ontology = _require_approved_ontology()
    if not req.content.strip():
        raise HTTPException(400, "Content is empty")

    if req.method == "ner":
        entities, unmapped = ner.extract_entities_ner(req.content, ontology.node_labels)
        model_name = settings.ner_model
    else:
        try:
            entities = llm.extract_entities_llm(req.content, ontology.node_labels, model=req.model)
        except llm.LLMError as exc:
            raise HTTPException(502, str(exc)) from exc
        unmapped = []
        model_name = req.model or settings.openai_model

    result = EntityExtractionResult(
        entities=entities,
        method=req.method,
        model=model_name,
        content=req.content,
        unmapped_ner_labels=unmapped,
        generated_at=storage.now(),
    )
    storage.save_entities(result)
    return result


@router.post("/relationships", response_model=RelationshipExtractionResult)
def extract_relationships(req: RelationshipExtractionRequest):
    ontology = _require_approved_ontology()
    entities_result = storage.load_entities()
    if not entities_result:
        raise HTTPException(400, "Run entity extraction before extracting relationships")
    if not req.content.strip():
        raise HTTPException(400, "Content is empty")

    try:
        relationships, dropped = llm.extract_relationships_llm(
            req.content, ontology.relationship_types, entities_result.entities, model=req.model
        )
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc
    result = RelationshipExtractionResult(
        relationships=relationships,
        model=req.model or settings.openai_model,
        dropped_count=dropped,
        generated_at=storage.now(),
    )
    storage.save_relationships(result)

    graph = KnowledgeGraphOut(
        entities=entities_result.entities,
        relationships=relationships,
        generated_at=result.generated_at,
    )
    storage.save_graph(graph)
    return result


@router.get("/graph", response_model=KnowledgeGraphOut)
def get_graph():
    entities_result = storage.load_entities()
    relationships_result = storage.load_relationships()
    if not entities_result or not relationships_result:
        raise HTTPException(404, "Run entity and relationship extraction first")
    return KnowledgeGraphOut(
        entities=entities_result.entities,
        relationships=relationships_result.relationships,
        generated_at=relationships_result.generated_at,
    )
