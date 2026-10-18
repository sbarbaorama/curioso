import type { Card as FsrsCard } from "ts-fsrs";

export type Area = "scienza" | "tecnologia" | "programmazione" | "lingue" | "cultura";

export const AREAS: { id: Area; label: string; emoji: string }[] = [
  { id: "scienza", label: "Scienza", emoji: "🔬" },
  { id: "tecnologia", label: "Tecnologia", emoji: "💡" },
  { id: "programmazione", label: "Programmazione", emoji: "💻" },
  { id: "lingue", label: "Lingue", emoji: "🌍" },
  { id: "cultura", label: "Cultura generale", emoji: "📚" },
];

export type SchoolLevel = "primaria" | "media" | "superiori" | "universita" | "professionista" | "hobbista";

export const LEVELS: { id: SchoolLevel; label: string }[] = [
  { id: "primaria", label: "Scuola primaria" },
  { id: "media", label: "Scuola media" },
  { id: "superiori", label: "Superiori" },
  { id: "universita", label: "Università" },
  { id: "professionista", label: "Professionista" },
  { id: "hobbista", label: "Hobbista curioso" },
];

export type Style = "esempi" | "analogie" | "formule" | "immagini" | "codice" | "socratico";

export const STYLES: { id: Style; label: string }[] = [
  { id: "esempi", label: "Esempi pratici" },
  { id: "analogie", label: "Analogie" },
  { id: "formule", label: "Formule" },
  { id: "immagini", label: "Immagini mentali" },
  { id: "codice", label: "Codice" },
  { id: "socratico", label: "Domande socratiche" },
];

export const MINUTES = [5, 10, 20, 45] as const;
export type Minutes = (typeof MINUTES)[number];

export interface Profile {
  name: string;
  level: SchoolLevel;
  interests: string[];
  goal: string;
  styles: Style[];
  minutes: Minutes;
  areas: Area[]; // aree preferite per la missione del giorno
}

export interface Mission {
  date: string; // YYYY-MM-DD
  area: Area;
  topic: string;
  hook: string; // curiosità / gancio
  why: string; // perché ti serve
}

export interface QuizItem {
  kind: "mcq" | "open";
  question: string;
  options?: string[];
  answer?: number; // indice risposta corretta (mcq)
  hints: string[]; // indizi progressivi
  explanation: string; // spiegazione / risposta modello
  difficulty: number; // 1-5
}

export interface Lesson {
  area: Area;
  topic: string;
  oneLiner: string;
  explanation: string;
  analogy: string;
  example: string;
  mistakes: string[];
  quiz: QuizItem[];
  deepDive: string;
  whyUseful: string;
  flashcards: { front: string; back: string }[];
  prerequisites: string[];
  nextTopics: string[];
}

export interface LessonRecord {
  id: string;
  date: string;
  area: Area;
  topic: string;
  score: number | null; // 0..1, null se non completata
  lesson: Lesson;
}

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  area: Area;
  topic: string;
  fsrs: FsrsCard;
}

export interface Stats {
  xp: Record<Area, number>;
  skill: Record<Area, number>; // livello reale stimato 0-100
  activeDays: string[]; // giorni con studio o ripasso (YYYY-MM-DD)
  badges: string[];
  reviewsByDay: Record<string, number>;
}

export interface AppData {
  version: 1;
  updatedAt: string;
  profile?: Profile;
  mission?: Mission;
  lessons: LessonRecord[];
  cards: StudyCard[];
  stats: Stats;
}

export type EngineId = "gemini" | "openrouter" | "claude";

export const ENGINES: { id: EngineId; label: string; keyHelp: string; keyUrl: string; defaultModel: string }[] = [
  {
    id: "gemini",
    label: "Google Gemini (gratuito)",
    keyHelp: "Crea una chiave gratuita su Google AI Studio",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-flash-latest",
  },
  {
    id: "openrouter",
    label: "OpenRouter (modelli gratuiti)",
    keyHelp: "Crea una chiave su OpenRouter, poi carica l'elenco dei modelli gratuiti",
    keyUrl: "https://openrouter.ai/settings/keys",
    defaultModel: "",
  },
  {
    id: "claude",
    label: "Claude (a pagamento)",
    keyHelp: "Crea una chiave nella Claude Console (consumo a pagamento)",
    keyUrl: "https://platform.claude.com/settings/keys",
    defaultModel: "claude-opus-5-5",
  },
];

export interface Settings {
  primary: EngineId;
  backup: EngineId | "none";
  keys: Record<EngineId, string>;
  models: Record<EngineId, string>;
  github: { token: string; repo: string; path: string; auto: boolean };
}
