import type { EngineId, Settings } from "../types";
import { ENGINES } from "../types";

export interface AiRequest {
  system: string;
  prompt: string;
  json: boolean;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const engineLabel = (id: EngineId) => ENGINES.find((e) => e.id === id)?.label ?? id;

async function httpError(res: Response, engine: EngineId): Promise<AiError> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? JSON.stringify(body).slice(0, 200);
  } catch {
    /* corpo non JSON */
  }
  if (res.status === 429) return new AiError(`${engineLabel(engine)}: limite gratuito raggiunto, riprova più tardi.`, 429);
  if (res.status === 401 || res.status === 403 || /api key not valid/i.test(detail)) return new AiError(`${engineLabel(engine)}: chiave non valida o senza permessi.`, res.status);
  return new AiError(`${engineLabel(engine)}: errore ${res.status} ${detail}`, res.status);
}

// ---------- Google Gemini ----------
async function callGemini(key: string, model: string, req: AiRequest): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: { temperature: 0.7, ...(req.json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) throw await httpError(res, "gemini");
  const data = await res.json();
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  if (!text) throw new AiError(`Gemini: risposta vuota (${data?.candidates?.[0]?.finishReason ?? "sconosciuto"})`);
  return text;
}

async function listGemini(key: string): Promise<string[]> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": key },
  });
  if (!res.ok) throw await httpError(res, "gemini");
  const data = await res.json();
  return (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: { name: string }) => m.name.replace(/^models\//, ""))
    .filter((n: string) => n.includes("gemini"));
}

// ---------- OpenRouter (formato OpenAI) ----------
async function callOpenRouter(key: string, model: string, req: AiRequest): Promise<string> {
  if (!model) throw new AiError("OpenRouter: scegli un modello nelle Impostazioni.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "Curioso" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw await httpError(res, "openrouter");
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new AiError("OpenRouter: risposta vuota");
  return text;
}

async function listOpenRouter(): Promise<string[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw await httpError(res, "openrouter");
  const data = await res.json();
  return (data.data ?? [])
    .filter((m: { pricing?: { prompt?: string; completion?: string } }) => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
    .map((m: { id: string }) => m.id)
    .sort((a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b));
}

// Prima i modelli di famiglie note, che di solito rispondono meglio in italiano e in JSON.
const KNOWN = ["deepseek", "qwen", "llama", "gemma", "mistral", "gpt-oss"];
const rank = (id: string) => {
  const i = KNOWN.findIndex((k) => id.toLowerCase().includes(k));
  return i < 0 ? KNOWN.length : i;
};

// ---------- Claude (SDK ufficiale, caricato solo se serve) ----------
const FALLBACK_MODELS = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];

async function callClaude(key: string, model: string, req: AiRequest): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const system = req.json ? `${req.system}\n\nRispondi esclusivamente con un oggetto JSON valido, senza testo prima o dopo.` : req.system;
  const params = {
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: "user" as const, content: req.prompt }],
    output_config: { effort: "medium" },
    // Se il modello rifiuta per motivi di sicurezza, l'API riprova con un modello di riserva.
    ...(FALLBACK_MODELS.includes(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
  };
  try {
    const msg = await client.beta.messages.create(params as never);
    if (msg.stop_reason === "refusal") throw new AiError("Claude ha rifiutato la richiesta.");
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (!text) throw new AiError("Claude: risposta vuota");
    return text;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Claude: limite di richieste raggiunto, riprova più tardi.", 429);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("Claude: chiave non valida.", 401);
    if (e instanceof Anthropic.APIError) throw new AiError(`Claude: errore ${e.status ?? ""} ${e.message}`, e.status);
    throw e;
  }
}

async function listClaude(key: string): Promise<string[]> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const ids: string[] = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids;
}

// ---------- API pubblica ----------
export function isConfigured(settings: Settings, id: EngineId): boolean {
  return Boolean(settings.keys[id]) && (id !== "openrouter" || Boolean(settings.models.openrouter));
}

export function callEngine(id: EngineId, settings: Settings, req: AiRequest): Promise<string> {
  const key = settings.keys[id];
  if (!key) return Promise.reject(new AiError(`${engineLabel(id)}: manca la chiave nelle Impostazioni.`));
  const model = settings.models[id] || ENGINES.find((e) => e.id === id)!.defaultModel;
  if (id === "gemini") return callGemini(key, model, req);
  if (id === "openrouter") return callOpenRouter(key, model, req);
  return callClaude(key, model, req);
}

export function listModels(id: EngineId, key: string): Promise<string[]> {
  if (id === "gemini") return listGemini(key);
  if (id === "openrouter") return listOpenRouter();
  return listClaude(key);
}

/** Prova il motore principale; se fallisce e c'è un motore di riserva configurato, usa quello. */
export async function generate(settings: Settings, req: AiRequest): Promise<{ text: string; engine: EngineId }> {
  try {
    return { text: await callEngine(settings.primary, settings, req), engine: settings.primary };
  } catch (e) {
    const backup = settings.backup;
    if (backup === "none" || backup === settings.primary || !isConfigured(settings, backup)) throw e;
    console.warn("Motore principale non disponibile, uso la riserva:", e);
    return { text: await callEngine(backup, settings, req), engine: backup };
  }
}

export function parseJson<T>(text: string): T {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new AiError("La risposta dell'AI non era nel formato atteso. Riprova.");
  }
}

export async function generateJson<T>(settings: Settings, req: Omit<AiRequest, "json">): Promise<T> {
  const { text } = await generate(settings, { ...req, json: true });
  return parseJson<T>(text);
}
