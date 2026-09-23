import difflib

import spacy

from app.config import settings
from app.models import Entity, NodeLabel

_nlp = None

# spaCy's fixed built-in label set mapped to common synonym names a user
# might pick when defining their own ontology.
SPACY_LABEL_SYNONYMS: dict[str, list[str]] = {
    "PERSON": ["Person", "Individual", "People"],
    "NORP": ["NORP", "Nationality", "ReligiousGroup", "PoliticalGroup"],
    "FAC": ["Facility", "Building"],
    "ORG": ["Organization", "Organisation", "Company", "Institution"],
    "GPE": ["Location", "Place", "Country", "City", "GeopoliticalEntity"],
    "LOC": ["Location", "Place", "Region"],
    "PRODUCT": ["Product"],
    "EVENT": ["Event"],
    "WORK_OF_ART": ["WorkOfArt", "Artwork"],
    "LAW": ["Law", "Legislation"],
    "LANGUAGE": ["Language"],
    "DATE": ["Date"],
    "TIME": ["Time"],
    "PERCENT": ["Percent"],
    "MONEY": ["Money", "Currency"],
    "QUANTITY": ["Quantity"],
    "ORDINAL": ["Ordinal"],
    "CARDINAL": ["Cardinal", "Number"],
}


def get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load(settings.ner_model)
    return _nlp


def _normalize(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def build_label_map(node_labels: list[NodeLabel]) -> dict[str, str]:
    """Map spaCy label -> ontology label name, best-effort."""
    ontology_names = [label.name for label in node_labels]
    normalized_to_name = {_normalize(name): name for name in ontology_names}

    label_map: dict[str, str] = {}
    for spacy_label, synonyms in SPACY_LABEL_SYNONYMS.items():
        candidates = [spacy_label] + synonyms
        matched = None
        for candidate in candidates:
            norm = _normalize(candidate)
            if norm in normalized_to_name:
                matched = normalized_to_name[norm]
                break
        if matched is None:
            close = difflib.get_close_matches(
                _normalize(spacy_label), normalized_to_name.keys(), n=1, cutoff=0.8
            )
            if close:
                matched = normalized_to_name[close[0]]
        if matched:
            label_map[spacy_label] = matched
    return label_map


def ner_supported_labels(node_labels: list[NodeLabel]) -> set[str]:
    return set(build_label_map(node_labels).values())


def extract_entities_ner(content: str, node_labels: list[NodeLabel]) -> tuple[list[Entity], list[str]]:
    nlp = get_nlp()
    label_map = build_label_map(node_labels)
    doc = nlp(content)

    entities: list[Entity] = []
    unmapped: set[str] = set()
    for i, ent in enumerate(doc.ents):
        mapped_label = label_map.get(ent.label_)
        if mapped_label is None:
            unmapped.add(ent.label_)
            continue
        entities.append(
            Entity(
                id=f"ent_{i + 1}",
                text=ent.text,
                label=mapped_label,
                start=ent.start_char,
                end=ent.end_char,
                method="ner",
                raw_ner_label=ent.label_,
                confidence=None,
            )
        )
    return entities, sorted(unmapped)
