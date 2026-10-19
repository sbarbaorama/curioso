import type { AppData, Area, Lesson, Mission, Profile, QuizItem, Settings } from "../types";
import { AREAS, LEVELS, STYLES } from "../types";
import { generateJson } from "./engines";
import { skillLabel, todayKey } from "../gamification";

const SYSTEM = `Sei Curioso, un tutor personale adattivo che parla italiano.
Principi: spieghi il ragionamento passo per passo, adatti vocabolario, tono, lunghezza e difficoltà al profilo,
usi analogie legate agli interessi della persona, proponi verifiche attive e indizi progressivi invece di dare subito la risposta.
Sei accurato: se un fatto è incerto lo dici. Non inventi fonti.`;

export function describeProfile(p: Profile): string {
  const level = LEVELS.find((l) => l.id === p.level)?.label ?? p.level;
  const styles = p.styles.map((s) => STYLES.find((x) => x.id === s)?.label ?? s).join(", ");
  return [
    `Nome: ${p.name || "studente"}`,
    `Livello dichiarato: ${level}`,
    `Interessi: ${p.interests.join(", ") || "vari"}`,
    `Obiettivo: ${p.goal || "imparare cose nuove"}`,
    `Stile preferito: ${styles || "misto"}`,
    `Tempo a disposizione: ${p.minutes} minuti`,
  ].join("\n");
}

function recentTopics(data: AppData, n = 15): string {
  return data.lessons.slice(-n).map((l) => `${l.area}: ${l.topic}`).join("; ") || "nessuno";
}

function quizSize(minutes: number): number {
  return minutes <= 5 ? 2 : minutes <= 10 ? 3 : 4;
}

export async function proposeMission(settings: Settings, data: AppData, opts: { exclude?: string[]; request?: string } = {}): Promise<Mission> {
  const p = data.profile!;
  const areas = (p.areas.length ? p.areas : AREAS.map((a) => a.id)).join(", ");
  const skills = AREAS.map((a) => `${a.id}=${skillLabel(data.stats.skill[a.id])}`).join(", ");
  const prompt = `Profilo:
${describeProfile(p)}
Livello stimato per area: ${skills}
Argomenti già studiati di recente: ${recentTopics(data)}
${opts.exclude?.length ? `Non proporre questi argomenti: ${opts.exclude.join("; ")}` : ""}
${
  opts.request
    ? `La persona oggi vuole approfondire: "${opts.request}". Definisci un micro-argomento preciso e adatto su questo tema.`
    : `Scegli la "Missione del giorno": un micro-argomento preciso (non generico) in una di queste aree: ${areas}.
Varia rispetto agli argomenti recenti, ma puoi costruire sopra ciò che è già stato imparato. Collegalo agli interessi quando possibile.`
}
Rispondi in JSON: {"area": una tra ${AREAS.map((a) => `"${a.id}"`).join(", ")}, "topic": "titolo breve dell'argomento", "hook": "una curiosità sorprendente di 1-2 frasi legata all'argomento", "why": "perché può servire nella vita, nel lavoro o negli hobby della persona (1 frase)"}`;
  const m = await generateJson<Omit<Mission, "date">>(settings, { system: SYSTEM, prompt });
  const area = AREAS.some((a) => a.id === m.area) ? m.area : "cultura";
  return { date: todayKey(), area, topic: m.topic, hook: m.hook, why: m.why };
}

export async function createLesson(settings: Settings, data: AppData, mission: { area: Area; topic: string }): Promise<Lesson> {
  const p = data.profile!;
  const n = quizSize(p.minutes);
  const skill = skillLabel(data.stats.skill[mission.area]);
  const length = p.minutes <= 5 ? "molto concisa (circa 120 parole)" : p.minutes <= 10 ? "concisa (circa 200 parole)" : p.minutes <= 20 ? "completa (circa 350 parole)" : "approfondita (circa 600 parole)";
  const prompt = `Profilo:
${describeProfile(p)}
Livello reale stimato in "${mission.area}": ${skill}
Argomento: ${mission.topic} (area: ${mission.area})
Argomenti già studiati: ${recentTopics(data)}
${mission.area === "lingue" ? "Per le lingue: spiega in italiano, ma con esempi nella lingua target e relativa traduzione." : ""}

Crea una micro-lezione strutturata. La spiegazione deve essere ${length}. Usa paragrafi brevi; puoi usare **grassetto** e liste con "- ".
Il codice (se serve) va in blocchi \`\`\`.
Rispondi in JSON con esattamente questi campi:
{
 "topic": "titolo",
 "oneLiner": "che cos'è in una frase semplice",
 "explanation": "spiegazione adatta al livello",
 "analogy": "analogia concreta legata agli interessi della persona",
 "example": "esempio pratico: calcolo, codice, esperimento, dialogo o caso reale",
 "mistakes": ["errore comune 1", "errore comune 2", "..."],
 "quiz": [ ${n} domande di verifica, mescolando:
   {"kind":"mcq","question":"...","options":["A","B","C","D"],"answer": indice 0-3 della risposta corretta,"hints":["indizio leggero","indizio più forte"],"explanation":"perché è corretta","difficulty": 1-5}
   e almeno una {"kind":"open","question":"domanda aperta che richiede di spiegare o applicare","hints":["indizio 1","indizio 2"],"explanation":"risposta modello","difficulty": 1-5}
 ],
 "deepDive": "approfondimento opzionale per andare oltre",
 "whyUseful": "a cosa serve nella vita reale, nel lavoro o negli hobby",
 "flashcards": [{"front":"domanda o termine","back":"risposta breve"}] (3-5 schede per il ripasso),
 "prerequisites": ["concetti che conviene conoscere prima"],
 "nextTopics": ["argomenti successivi naturali"]
}
Calibra la difficoltà delle domande sul livello stimato: leggermente sopra, per far crescere.`;
  const l = await generateJson<Partial<Lesson>>(settings, { system: SYSTEM, prompt });
  return normalizeLesson(l, mission);
}

function normalizeLesson(l: Partial<Lesson>, mission: { area: Area; topic: string }): Lesson {
  const arr = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  const quiz: QuizItem[] = arr(l.quiz)
    .filter((q) => q && q.question)
    .map((q) => ({
      kind: q.kind === "mcq" && Array.isArray(q.options) && q.options.length > 1 ? "mcq" : "open",
      question: q.question,
      options: q.options,
      answer: typeof q.answer === "number" ? q.answer : Number(q.answer) || 0,
      hints: arr(q.hints),
      explanation: q.explanation ?? "",
      difficulty: Math.min(5, Math.max(1, Number(q.difficulty) || 3)),
    }));
  return {
    area: mission.area,
    topic: l.topic || mission.topic,
    oneLiner: l.oneLiner ?? "",
    explanation: l.explanation ?? "",
    analogy: l.analogy ?? "",
    example: l.example ?? "",
    mistakes: arr(l.mistakes),
    quiz,
    deepDive: l.deepDive ?? "",
    whyUseful: l.whyUseful ?? "",
    flashcards: arr(l.flashcards).filter((f) => f && f.front && f.back),
    prerequisites: arr(l.prerequisites),
    nextTopics: arr(l.nextTopics),
  };
}

export const AUDIENCES = [
  "un bambino di 8 anni",
  "un adolescente",
  "uno studente universitario",
  "un esperto del settore",
  "una persona senza background tecnico",
];

export async function reexplain(settings: Settings, data: AppData, lesson: Lesson, audience: string): Promise<{ explanation: string; analogy: string }> {
  const prompt = `Profilo:
${describeProfile(data.profile!)}
Argomento: ${lesson.topic}
Spiegazione attuale: ${lesson.explanation}

Rispiega l'argomento come se parlassi a ${audience}: adatta vocabolario, lunghezza e tono.
Rispondi in JSON: {"explanation": "...", "analogy": "un'analogia adatta a questo pubblico"}`;
  return generateJson(settings, { system: SYSTEM, prompt });
}

export interface OpenEvaluation {
  score: number; // 0..1
  feedback: string;
  missing: string[];
}

export async function evaluateOpen(settings: Settings, data: AppData, lesson: Lesson, q: QuizItem, answer: string): Promise<OpenEvaluation> {
  const prompt = `Profilo:
${describeProfile(data.profile!)}
Argomento: ${lesson.topic}
Domanda: ${q.question}
Risposta modello: ${q.explanation}
Risposta della persona: """${answer}"""

Valuta la risposta in modo gentile e onesto, adattando il tono al livello. Riconosci ciò che è corretto,
indica le lacune principali e suggerisci come migliorare, senza riscrivere tutta la risposta modello.
Rispondi in JSON: {"score": numero da 0 a 1, "feedback": "2-4 frasi", "missing": ["concetto mancante o impreciso", ...]}`;
  const r = await generateJson<OpenEvaluation>(settings, { system: SYSTEM, prompt });
  return { score: Math.min(1, Math.max(0, Number(r.score) || 0)), feedback: r.feedback ?? "", missing: Array.isArray(r.missing) ? r.missing : [] };
}
