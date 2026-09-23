import { api } from "./api.js";

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

export function showStatus(el: HTMLElement, message: string, kind: "info" | "error" | "success" = "info"): void {
  el.textContent = message;
  el.className = `status status-${kind}`;
  el.hidden = !message;
}

/** Redirects to the ontology screen if no approved ontology exists yet. */
export async function assertOntologyApproved(): Promise<boolean> {
  try {
    const ontology = await api.getOntology();
    if (ontology.status !== "approved") {
      window.location.href = "ontology.html";
      return false;
    }
    return true;
  } catch {
    window.location.href = "ontology.html";
    return false;
  }
}
