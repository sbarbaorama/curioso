import type { AppData, Area } from "./types";
import { AREAS } from "./types";

export const todayKey = (d = new Date()) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export function skillLabel(skill: number): string {
  if (skill < 25) return "principiante";
  if (skill < 50) return "base";
  if (skill < 75) return "intermedio";
  return "avanzato";
}

/** Aggiornamento tipo Elo: domanda difficile giusta = sale molto, facile sbagliata = scende molto. */
export function updateSkill(skill: number, difficulty: number, result: number): number {
  const qRating = difficulty * 20;
  const expected = 1 / (1 + Math.pow(10, (qRating - skill) / 25));
  return Math.round(Math.min(100, Math.max(0, skill + 8 * (result - expected))) * 10) / 10;
}

export const TOPIC_LEVELS = [
  { name: "Novizio", min: 0 },
  { name: "Praticante", min: 100 },
  { name: "Competente", min: 300 },
  { name: "Esperto", min: 700 },
];

export function topicLevel(xp: number) {
  let i = 0;
  while (i + 1 < TOPIC_LEVELS.length && xp >= TOPIC_LEVELS[i + 1].min) i++;
  const next = TOPIC_LEVELS[i + 1];
  const cur = TOPIC_LEVELS[i];
  return { name: cur.name, progress: next ? (xp - cur.min) / (next.min - cur.min) : 1, next: next?.name };
}

/** Streak flessibile: un singolo giorno saltato non la interrompe; due giorni consecutivi sì. */
export function streak(activeDays: string[]): number {
  const set = new Set(activeDays);
  const d = new Date();
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1); // oggi non è ancora finito
  let count = 0;
  let misses = 0;
  for (let i = 0; i < 3650; i++) {
    if (set.has(todayKey(d))) {
      count++;
      misses = 0;
    } else if (++misses >= 2) break;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function lessonXp(score: number) {
  return Math.round(20 + 30 * score);
}

const countArea = (data: AppData, area: Area) => data.lessons.filter((l) => l.area === area && l.score !== null).length;
const totalReviews = (data: AppData) => Object.values(data.stats.reviewsByDay).reduce((a, b) => a + b, 0);

export const BADGES: { id: string; name: string; emoji: string; desc: string; check: (d: AppData) => boolean }[] = [
  { id: "primo-passo", name: "Primo passo", emoji: "👣", desc: "Completa la prima missione", check: (d) => d.lessons.some((l) => l.score !== null) },
  { id: "esploratore", name: "Esploratore scientifico", emoji: "🔭", desc: "5 missioni di scienza", check: (d) => countArea(d, "scienza") >= 5 },
  { id: "debug-master", name: "Debug master", emoji: "🐞", desc: "5 missioni di programmazione", check: (d) => countArea(d, "programmazione") >= 5 },
  { id: "polyglot", name: "Polyglot principiante", emoji: "🗣️", desc: "5 missioni di lingue", check: (d) => countArea(d, "lingue") >= 5 },
  { id: "inventore", name: "Inventore", emoji: "⚙️", desc: "5 missioni di tecnologia", check: (d) => countArea(d, "tecnologia") >= 5 },
  { id: "enciclopedia", name: "Enciclopedia vivente", emoji: "📖", desc: "5 missioni di cultura generale", check: (d) => countArea(d, "cultura") >= 5 },
  { id: "universale", name: "Curioso universale", emoji: "🌈", desc: "Almeno una missione in ogni area", check: (d) => AREAS.every((a) => countArea(d, a.id) > 0) },
  { id: "perfetto", name: "Centro perfetto", emoji: "🎯", desc: "Una verifica con il 100%", check: (d) => d.lessons.some((l) => l.score === 1) },
  { id: "costanza", name: "Costanza", emoji: "🔥", desc: "Streak di 7 giorni", check: (d) => streak(d.stats.activeDays) >= 7 },
  { id: "memoria", name: "Memoria di ferro", emoji: "🧠", desc: "100 ripassi completati", check: (d) => totalReviews(d) >= 100 },
];

export function newBadges(data: AppData): string[] {
  return BADGES.filter((b) => !data.stats.badges.includes(b.id) && b.check(data)).map((b) => b.id);
}

function weekStart(d = new Date()) {
  const s = new Date(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // lunedì
  return todayKey(s);
}

export function weeklyChallenges(data: AppData) {
  const start = weekStart();
  const lessons = data.lessons.filter((l) => l.date >= start && l.score !== null);
  const reviews = Object.entries(data.stats.reviewsByDay)
    .filter(([day]) => day >= start)
    .reduce((a, [, n]) => a + n, 0);
  const areas = new Set(lessons.map((l) => l.area)).size;
  const days = data.stats.activeDays.filter((d) => d >= start).length;
  return [
    { label: "3 missioni completate", value: lessons.length, target: 3 },
    { label: "30 schede ripassate", value: reviews, target: 30 },
    { label: "2 aree diverse", value: areas, target: 2 },
    { label: "Attivo 4 giorni", value: days, target: 4 },
  ];
}
