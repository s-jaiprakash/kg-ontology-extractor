# Ontology Extractor

A knowledge-graph ontology and entity/relationship extraction tool.

1. **Documents** — upload `.md` files or paste markdown content, each tagged with a category.
2. **Ontology** — generate a proposed ontology (node labels + relationship types, each backed
   by a citation into the source text) from your documents using an LLM, edit it, and approve it.
   You can also export the ontology to a JSON file or import one (e.g. hand-authored, or
   exported from another run) in place of generating it.
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

cp .env.example .env   # then fill in your LLM provider credentials, see below

cd frontend
npm install
npm run build           # compiles TypeScript into ../static/js
cd ..
```

### LLM provider

The app talks to either standard OpenAI or Azure OpenAI, chosen via `LLM_PROVIDER` in `.env`:

- `LLM_PROVIDER=openai` (default) — set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`
  (default `gpt-4o-mini`).
- `LLM_PROVIDER=azure_openai` — set `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` (e.g.
  `https://<resource>.openai.azure.com`), `AZURE_OPENAI_DEPLOYMENT` (your deployment name — used
  as the model for every call), and optionally `AZURE_OPENAI_API_VERSION` (default
  `2024-08-01-preview`). The deployment must be a model version that supports structured outputs
  (e.g. `gpt-4o-2024-08-06` or later).

See `.env.example` for the full list of variables.

## Run

```bash
uv run python main.py
```

Open <http://127.0.0.1:8931/>. (Change the port in `main.py` if 8931 is unavailable on your
machine — port 8000 is commonly reserved by a Windows system service.)

While developing the frontend, run `npm run watch` in `frontend/` to recompile TypeScript on
save; the backend serves the compiled output directly from `static/js/`.
