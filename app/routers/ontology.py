from fastapi import APIRouter, HTTPException

from app import llm, ner, storage
from app.models import Ontology, OntologyGenerateRequest, OntologyUpdateRequest

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


def _with_ner_flags(ontology: Ontology) -> Ontology:
    supported = ner.ner_supported_labels(ontology.node_labels)
    for label in ontology.node_labels:
        label.ner_supported = label.name in supported
    return ontology


@router.post("/generate", response_model=Ontology)
def generate_ontology(req: OntologyGenerateRequest):
    existing = storage.load_ontology()
    if existing and existing.status == "approved":
        raise HTTPException(409, "Ontology is already approved; reset it before regenerating")

    all_docs = storage.list_documents()
    if req.document_ids:
        docs = [d for d in all_docs if d.id in req.document_ids]
    else:
        docs = all_docs
    if not docs:
        raise HTTPException(400, "No documents available to generate an ontology from")

    try:
        node_labels, relationship_types = llm.generate_ontology(docs, model=req.model)
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc
    now = storage.now()
    ontology = Ontology(
        status="draft",
        node_labels=node_labels,
        relationship_types=relationship_types,
        created_at=existing.created_at if existing else now,
        updated_at=now,
        approved_at=None,
    )
    storage.save_ontology(ontology)
    return _with_ner_flags(ontology)


@router.get("", response_model=Ontology)
def get_ontology():
    ontology = storage.load_ontology()
    if not ontology:
        raise HTTPException(404, "No ontology has been generated yet")
    return _with_ner_flags(ontology)


@router.put("", response_model=Ontology)
def update_ontology(req: OntologyUpdateRequest):
    existing = storage.load_ontology()
    if not existing:
        raise HTTPException(404, "No ontology exists yet; generate one first")
    if existing.status == "approved":
        raise HTTPException(409, "Ontology is approved; reset it before editing")

    existing.node_labels = req.node_labels
    existing.relationship_types = req.relationship_types
    existing.updated_at = storage.now()
    storage.save_ontology(existing)
    return _with_ner_flags(existing)


@router.post("/approve", response_model=Ontology)
def approve_ontology():
    ontology = storage.load_ontology()
    if not ontology:
        raise HTTPException(404, "No ontology exists yet; generate one first")
    ontology.status = "approved"
    ontology.approved_at = storage.now()
    ontology.updated_at = ontology.approved_at
    storage.save_ontology(ontology)
    return _with_ner_flags(ontology)


@router.post("/reset", response_model=Ontology)
def reset_ontology():
    ontology = storage.load_ontology()
    if not ontology:
        raise HTTPException(404, "No ontology exists yet; generate one first")
    ontology.status = "draft"
    ontology.approved_at = None
    ontology.updated_at = storage.now()
    storage.save_ontology(ontology)
    return _with_ner_flags(ontology)
