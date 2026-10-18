import type { AppData, Settings, StudyCard } from "./types";

// Sincronizzazione con un repository GitHub privato (es. sbarbaorama/curioso-dati).
// Il token resta solo sul telefono e non viene mai scritto nel file di dati.

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function apiUrl(s: Settings["github"]) {
  return `https://api.github.com/repos/${s.repo.trim()}/contents/${encodeURIComponent(s.path.trim() || "curioso-data.json")}`;
}

function headers(s: Settings["github"]) {
  return { Authorization: `Bearer ${s.token.trim()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

export function syncConfigured(settings: Settings) {
  return Boolean(settings.github.token && settings.github.repo.includes("/"));
}

async function pull(s: Settings["github"]): Promise<{ data: AppData; sha: string } | null> {
  const res = await fetch(apiUrl(s), { headers: headers(s), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 ? "Token GitHub non valido" : `GitHub: errore ${res.status}`);
  const body = await res.json();
  let content: string = body.content ?? "";
  // File oltre 1 MB: l'API non include il contenuto, va scaricato a parte.
  if (!content && body.download_url) {
    const raw = await fetch(apiUrl(s), { headers: { ...headers(s), Accept: "application/vnd.github.raw+json" }, cache: "no-store" });
    return { data: JSON.parse(await raw.text()), sha: body.sha };
  }
  return { data: JSON.parse(fromBase64(content)), sha: body.sha };
}

async function push(s: Settings["github"], data: AppData, sha?: string): Promise<Response> {
  return fetch(apiUrl(s), {
    method: "PUT",
    headers: { ...headers(s), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Curioso: aggiornamento ${new Date().toISOString()}`,
      content: toBase64(JSON.stringify(data, null, 1)),
      ...(sha ? { sha } : {}),
    }),
  });
}

function newerCard(a: StudyCard, b: StudyCard): StudyCard {
  const ta = a.fsrs.last_review ? +new Date(a.fsrs.last_review) : 0;
  const tb = b.fsrs.last_review ? +new Date(b.fsrs.last_review) : 0;
  return tb > ta ? b : a;
}

/** Unione dei dati di due dispositivi: non si perde nessuna lezione, scheda o giorno di studio. */
export function merge(local: AppData, remote: AppData): AppData {
  const newer = remote.updatedAt > local.updatedAt ? remote : local;
  const lessons = new Map(local.lessons.map((l) => [l.id, l]));
  for (const l of remote.lessons) {
    const mine = lessons.get(l.id);
    if (!mine || (mine.score === null && l.score !== null)) lessons.set(l.id, l);
  }
  const cards = new Map(local.cards.map((c) => [c.id, c]));
  for (const c of remote.cards) cards.set(c.id, cards.has(c.id) ? newerCard(cards.get(c.id)!, c) : c);
  const max = (a: Record<string, number>, b: Record<string, number>) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  return {
    ...newer,
    lessons: [...lessons.values()].sort((a, b) => a.date.localeCompare(b.date)),
    cards: [...cards.values()],
    stats: {
      xp: max(local.stats.xp, remote.stats.xp) as AppData["stats"]["xp"],
      skill: newer.stats.skill,
      activeDays: [...new Set([...local.stats.activeDays, ...remote.stats.activeDays])].sort(),
      badges: [...new Set([...local.stats.badges, ...remote.stats.badges])],
      reviewsByDay: max(local.stats.reviewsByDay, remote.stats.reviewsByDay),
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Scarica, unisce e ricarica. Restituisce i dati uniti. */
export async function syncNow(settings: Settings, local: AppData): Promise<AppData> {
  const s = settings.github;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await pull(s);
    const merged = remote ? merge(local, remote.data) : local;
    const res = await push(s, merged, remote?.sha);
    if (res.ok) return merged;
    if (res.status !== 409 && res.status !== 422) {
      throw new Error(res.status === 404 ? "Repository non trovato o token senza permesso di scrittura" : `GitHub: errore ${res.status}`);
    }
    // Conflitto: un altro dispositivo ha scritto nel frattempo, riprova.
  }
  throw new Error("GitHub: conflitto di sincronizzazione, riprova");
}
