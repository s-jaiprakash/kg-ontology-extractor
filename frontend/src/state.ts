import { api } from "./api.js";

export type ViewName = "documents" | "ontology" | "extraction";

export function navigateTo(view: ViewName): void {
  window.location.hash = `#${view}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

export function showStatus(el: HTMLElement, message: string, kind: "info" | "error" | "success" = "info"): void {
  el.textContent = message;
  el.className = `status status-${kind}`;
  el.hidden = !message;
}

/** Navigates to the ontology view if no approved ontology exists yet. */
export async function assertOntologyApproved(): Promise<boolean> {
  try {
    const ontology = await api.getOntology();
    if (ontology.status !== "approved") {
      navigateTo("ontology");
      return false;
    }
    return true;
  } catch {
    navigateTo("ontology");
    return false;
  }
}
