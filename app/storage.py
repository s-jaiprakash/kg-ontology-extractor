import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.config import settings
from app.models import (
    Document,
    EntityExtractionResult,
    KnowledgeGraphOut,
    Ontology,
    RelationshipExtractionResult,
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_document_id() -> str:
    ts = now().strftime("%Y%m%dT%H%M%SZ")
    return f"doc_{ts}_{uuid4().hex[:8]}"


def project_dir(project_id: str | None = None) -> Path:
    pid = project_id or settings.default_project_id
    base = settings.data_dir / "projects" / pid
    (base / "documents").mkdir(parents=True, exist_ok=True)
    (base / "extraction").mkdir(parents=True, exist_ok=True)
    return base


def atomic_write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    os.replace(tmp_path, path)


def read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


def save_document(doc: Document, project_id: str | None = None) -> None:
    path = project_dir(project_id) / "documents" / f"{doc.id}.json"
    atomic_write_json(path, doc.model_dump(mode="json"))


def load_document(doc_id: str, project_id: str | None = None) -> Document | None:
    path = project_dir(project_id) / "documents" / f"{doc_id}.json"
    data = read_json(path)
    return Document(**data) if data else None


def list_documents(project_id: str | None = None) -> list[Document]:
    docs_dir = project_dir(project_id) / "documents"
    docs = []
    for path in sorted(docs_dir.glob("*.json")):
        data = read_json(path)
        if data:
            docs.append(Document(**data))
    return docs


def delete_document(doc_id: str, project_id: str | None = None) -> bool:
    path = project_dir(project_id) / "documents" / f"{doc_id}.json"
    if not path.exists():
        return False
    path.unlink()
    return True


# ---------------------------------------------------------------------------
# Ontology
# ---------------------------------------------------------------------------


def save_ontology(ontology: Ontology, project_id: str | None = None) -> None:
    path = project_dir(project_id) / "ontology.json"
    atomic_write_json(path, ontology.model_dump(mode="json"))


def load_ontology(project_id: str | None = None) -> Ontology | None:
    path = project_dir(project_id) / "ontology.json"
    data = read_json(path)
    return Ontology(**data) if data else None


# ---------------------------------------------------------------------------
# Extraction results
# ---------------------------------------------------------------------------


def save_entities(result: EntityExtractionResult, project_id: str | None = None) -> None:
    path = project_dir(project_id) / "extraction" / "entities.json"
    atomic_write_json(path, result.model_dump(mode="json"))


def load_entities(project_id: str | None = None) -> EntityExtractionResult | None:
    path = project_dir(project_id) / "extraction" / "entities.json"
    data = read_json(path)
    return EntityExtractionResult(**data) if data else None


def save_relationships(result: RelationshipExtractionResult, project_id: str | None = None) -> None:
    path = project_dir(project_id) / "extraction" / "relationships.json"
    atomic_write_json(path, result.model_dump(mode="json"))


def load_relationships(project_id: str | None = None) -> RelationshipExtractionResult | None:
    path = project_dir(project_id) / "extraction" / "relationships.json"
    data = read_json(path)
    return RelationshipExtractionResult(**data) if data else None


def save_graph(graph: KnowledgeGraphOut, project_id: str | None = None) -> None:
    path = project_dir(project_id) / "extraction" / "graph.json"
    atomic_write_json(path, graph.model_dump(mode="json"))


def load_graph(project_id: str | None = None) -> KnowledgeGraphOut | None:
    path = project_dir(project_id) / "extraction" / "graph.json"
    data = read_json(path)
    return KnowledgeGraphOut(**data) if data else None


# ---------------------------------------------------------------------------
# Citation offset resolution
# ---------------------------------------------------------------------------


def resolve_citation_offsets(content: str, quote: str) -> tuple[int | None, int | None]:
    """Best-effort substring search for a verbatim LLM-quoted citation.

    Falls back to a whitespace-insensitive regex search if an exact match
    fails, since models sometimes collapse newlines/extra spaces when
    quoting. If the quote still can't be located, offsets stay None but the
    quote text itself is preserved by the caller as a best-effort citation.
    """
    if not quote:
        return None, None

    idx = content.find(quote)
    if idx != -1:
        return idx, idx + len(quote)

    tokens = quote.split()
    if not tokens:
        return None, None
    pattern = r"\s+".join(re.escape(token) for token in tokens)
    match = re.search(pattern, content)
    if match:
        return match.start(), match.end()
    return None, None
