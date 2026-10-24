import { useSyncExternalStore } from "react";

// Installazione come app: Chrome invia "beforeinstallprompt" quando l'app è installabile.
// Lo intercettiamo subito (prima che React disegni le schermate) e lo usiamo dal pulsante "Installa l'app".

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  emit();
});

window.addEventListener("appinstalled", () => {
  deferred = null;
  installed = true;
  emit();
});

export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Stato per il pulsante: già in uso come app, appena installata, installabile con un tocco, oppure solo dal menu del browser. */
export function useInstallState(): "standalone" | "installed" | "ready" | "manual" {
  return useSyncExternalStore(subscribe, () => (isStandalone() ? "standalone" : installed ? "installed" : deferred ? "ready" : "manual"));
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null; // il prompt si può mostrare una sola volta per evento
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}
