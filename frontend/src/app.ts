import * as documentsView from "./home.js";
import * as ontologyView from "./ontology.js";
import * as extractionView from "./extraction.js";
import { ViewName } from "./state.js";

const VIEW_NAMES: ViewName[] = ["documents", "ontology", "extraction"];

const activate: Record<ViewName, () => void | Promise<void>> = {
  documents: documentsView.activate,
  ontology: ontologyView.activate,
  extraction: extractionView.activate,
};

function currentView(): ViewName {
  const hash = window.location.hash.replace(/^#/, "");
  return (VIEW_NAMES as string[]).includes(hash) ? (hash as ViewName) : "documents";
}

function showView(view: ViewName): void {
  for (const name of VIEW_NAMES) {
    const section = document.getElementById(`view-${name}`);
    if (section) section.hidden = name !== view;
  }
  document.querySelectorAll<HTMLAnchorElement>("nav a[data-view]").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === view);
  });
  activate[view]();
}

window.addEventListener("hashchange", () => showView(currentView()));
showView(currentView());
