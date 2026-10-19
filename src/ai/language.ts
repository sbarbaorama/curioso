import type { AppData, ChatCorrection, ChatMsg, Conversation, ConversationSummary, Settings, VocabItem } from "../types";
import { generateJson } from "./engines";
import { describeProfile } from "./prompts";

const SYSTEM = `Sei Curioso, un tutor di lingue straniere paziente e incoraggiante.
Conduci conversazioni realistiche nella lingua target restando nel personaggio assegnato.
Adatti sempre lessico, lunghezza e complessità delle frasi al livello CEFR dello studente:
- A1/A2: frasi brevi e semplici, presente, parole di uso frequentissimo, una sola domanda per volta.
- B1/B2: frasi naturali, tempi verbali vari, qualche espressione idiomatica comune.
- C1: lingua naturale e ricca, idiomi, registro adeguato alla situazione.
Correzione gentile: correggi SOLO gli errori importanti (che cambiano il senso o sono grammaticalmente gravi); ignora refusi e sbavature minori.
Le spiegazioni per lo studente sono in italiano, brevi e senza giudizio.`;

export const SCENARIOS = [
  "Ordinare al ristorante",
  "Presentarsi a un colloquio di lavoro",
  "Spiegare un problema tecnico",
  "Chiedere indicazioni in città",
  "Check-in in hotel",
  "Fare la spesa al mercato",
  "Conversazione libera sui miei interessi",
];

export const PARTNERS = ["Cameriere o commesso", "Selezionatore", "Collega", "Cliente", "Insegnante", "Compagno di viaggio", "Amico"];

function setup(conv: Conversation): string {
  return `Lingua target: ${conv.lang}
Livello CEFR dello studente: ${conv.level}
Situazione: ${conv.scenario}
Tu interpreti: ${conv.partner}`;
}

function transcript(conv: Conversation): string {
  return conv.messages.map((m) => `${m.role === "ai" ? `Tu (${conv.partner})` : "Studente"}: ${m.text}`).join("\n");
}

function knownTerms(data: AppData, lang: string): string {
  return data.cards
    .filter((c) => c.area === "lingue" && c.topic.startsWith(lang))
    .slice(-80)
    .map((c) => c.front)
    .join(", ");
}

const SHAPE = `"reply": "la tua prossima battuta nella lingua target (1-3 frasi, nel personaggio; spesso chiudi con una domanda per far continuare lo studente)",
 "translation": "traduzione italiana di reply",
 "vocab": [{"term": "parola o espressione utile presente in reply", "meaning": "significato in italiano", "example": "breve frase d'esempio nella lingua target"}] (0-3 elementi adatti al livello, evitando quelli già noti),
 "suggestions": ["2-3 possibili risposte brevi dello studente, nella lingua target e adatte al livello"]`;

interface Turn {
  reply: string;
  translation: string;
  vocab: VocabItem[];
  suggestions: string[];
}

function normalizeTurn(t: Partial<Turn>): Turn {
  const arr = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  return {
    reply: t.reply ?? "",
    translation: t.translation ?? "",
    vocab: arr(t.vocab).filter((v) => v && v.term && v.meaning),
    suggestions: arr(t.suggestions).filter((s) => typeof s === "string").slice(0, 3),
  };
}

export async function startConversation(settings: Settings, data: AppData, conv: Conversation): Promise<ChatMsg> {
  const prompt = `Profilo dello studente:
${describeProfile(data.profile!)}
${setup(conv)}
Parole già note allo studente: ${knownTerms(data, conv.lang) || "nessuna"}

Apri la scena con la prima battuta, come farebbe davvero ${conv.partner} in questa situazione.
Rispondi in JSON: {
 ${SHAPE}
}`;
  const t = normalizeTurn(await generateJson<Partial<Turn>>(settings, { system: SYSTEM, prompt }));
  return { role: "ai", text: t.reply, translation: t.translation, vocab: t.vocab, suggestions: t.suggestions };
}

export async function continueConversation(
  settings: Settings,
  data: AppData,
  conv: Conversation,
  userText: string,
): Promise<{ correction: ChatCorrection | null; reply: ChatMsg }> {
  const prompt = `Profilo dello studente:
${describeProfile(data.profile!)}
${setup(conv)}
Parole già note allo studente: ${knownTerms(data, conv.lang) || "nessuna"}

Conversazione finora:
${transcript(conv)}
Studente: ${userText}

1) Valuta l'ultima frase dello studente. Se contiene errori importanti, proponi la versione corretta e naturale; altrimenti correction = null.
   Se lo studente scrive in italiano, aiutalo proponendo come si direbbe nella lingua target.
2) Continua la conversazione restando nel personaggio.
Rispondi in JSON: {
 "correction": null oppure {"corrected": "la frase dello studente corretta e naturale", "explanation": "spiegazione breve in italiano"},
 ${SHAPE}
}`;
  const r = await generateJson<Partial<Turn> & { correction?: Partial<ChatCorrection> | null }>(settings, { system: SYSTEM, prompt });
  const t = normalizeTurn(r);
  const correction = r.correction && r.correction.corrected ? { corrected: r.correction.corrected, explanation: r.correction.explanation ?? "" } : null;
  return { correction, reply: { role: "ai", text: t.reply, translation: t.translation, vocab: t.vocab, suggestions: t.suggestions } };
}

export async function summarizeConversation(settings: Settings, data: AppData, conv: Conversation): Promise<ConversationSummary> {
  const corrections = conv.messages
    .filter((m) => m.role === "user" && m.correction)
    .map((m) => `"${m.text}" → "${m.correction!.corrected}"`)
    .join("\n");
  const prompt = `Profilo dello studente:
${describeProfile(data.profile!)}
${setup(conv)}

Conversazione:
${transcript(conv)}

Correzioni fatte durante la conversazione:
${corrections || "nessuna"}

Scrivi un bilancio breve e incoraggiante in italiano.
Rispondi in JSON: {"feedback": "2-3 frasi", "strengths": ["cosa è andato bene"], "improve": ["1-3 cose concrete su cui lavorare"], "levelEstimate": "livello CEFR stimato da questa conversazione, es. B1"}`;
  const r = await generateJson<Partial<ConversationSummary>>(settings, { system: SYSTEM, prompt });
  return {
    feedback: r.feedback ?? "",
    strengths: Array.isArray(r.strengths) ? r.strengths : [],
    improve: Array.isArray(r.improve) ? r.improve : [],
    levelEstimate: r.levelEstimate ?? conv.level,
  };
}
