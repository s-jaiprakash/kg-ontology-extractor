# Ontology Extractor

A knowledge-graph ontology and entity/relationship extraction tool.

1. **Documents** — upload `.md` files or paste markdown content, each tagged with a category.
2. **Ontology** — generate a proposed ontology (node labels + relationship types, each backed
   by a citation into the source text) from your documents using an LLM, edit it, and approve it.
3. **Extraction** — paste content, extract entities (via the LLM or a local spaCy NER pipeline)
   and relationships constrained to the approved ontology, and view the resulting knowledge
   graph as JSON and as a table.

Backend: Python + FastAPI (serves the API and the static frontend). Frontend: plain HTML/CSS +
TypeScript compiled with `tsc` (no framework, no bundler). Data is persisted as flat JSON files
under `data/` — no database.

## Setup

```bash
uv sync
uv run python -m spacy download en_core_web_sm   # one-time, for local NER

cp .env.example .env   # then set OPENAI_API_KEY

cd frontend
npm install
npm run build           # compiles TypeScript into ../static/js
cd ..
```

## Run

```bash
uv run python main.py
```

Open <http://127.0.0.1:8931/>. (Change the port in `main.py` if 8931 is unavailable on your
machine — port 8000 is commonly reserved by a Windows system service.)

While developing the frontend, run `npm run watch` in `frontend/` to recompile TypeScript on
save; the backend serves the compiled output directly from `static/js/`.
