from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app import storage
from app.models import Document, DocumentDetail, DocumentOut

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _to_out(doc: Document) -> DocumentOut:
    preview = doc.content[:200]
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        category=doc.category,
        preview=preview,
        char_count=len(doc.content),
        created_at=doc.created_at,
    )


@router.post("", status_code=201, response_model=DocumentOut)
async def create_document(
    category: str = Form(...),
    content: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    if not file and not content:
        raise HTTPException(400, "Provide either 'content' or a 'file'")
    if file and content:
        raise HTTPException(400, "Provide only one of 'content' or 'file', not both")

    if file:
        raw = await file.read()
        text = raw.decode("utf-8")
        filename = file.filename or "upload.md"
        source = "upload"
    else:
        text = content or ""
        filename = f"pasted-{storage.now().strftime('%Y%m%dT%H%M%SZ')}.md"
        source = "paste"

    if not text.strip():
        raise HTTPException(400, "Document content is empty")

    doc = Document(
        id=storage.new_document_id(),
        filename=filename,
        category=category,
        content=text,
        source=source,
        created_at=storage.now(),
    )
    storage.save_document(doc)
    return _to_out(doc)


@router.get("", response_model=list[DocumentOut])
def list_documents():
    return [_to_out(doc) for doc in storage.list_documents()]


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: str):
    doc = storage.load_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return DocumentDetail(**doc.model_dump())


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str):
    if not storage.delete_document(doc_id):
        raise HTTPException(404, "Document not found")
