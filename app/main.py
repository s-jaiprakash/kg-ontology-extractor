from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import storage
from app.routers import documents, extraction, ontology

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.project_dir()
    yield


app = FastAPI(title="Ontology Extractor", lifespan=lifespan)

app.include_router(documents.router)
app.include_router(ontology.router)
app.include_router(extraction.router)

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
