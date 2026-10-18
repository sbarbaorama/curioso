import { createEmptyCard, fsrs, generatorParameters, Rating, type Grade } from "ts-fsrs";
import type { Area, StudyCard } from "./types";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export { Rating };
export type { Grade };

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function newCard(front: string, back: string, area: Area, topic: string): StudyCard {
  return { id: uid(), front, back, area, topic, fsrs: createEmptyCard(new Date()) };
}

/** Le date arrivano come stringhe dopo JSON: le riconvertiamo. */
export function reviveCard(c: StudyCard): StudyCard {
  return {
    ...c,
    fsrs: { ...c.fsrs, due: new Date(c.fsrs.due), last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review) : undefined },
  };
}

export function dueCards(cards: StudyCard[], now = new Date()): StudyCard[] {
  return cards.filter((c) => new Date(c.fsrs.due) <= now).sort((a, b) => +new Date(a.fsrs.due) - +new Date(b.fsrs.due));
}

export function reviewCard(card: StudyCard, grade: Grade, now = new Date()): StudyCard {
  const { card: next } = scheduler.next(reviveCard(card).fsrs, now, grade);
  return { ...card, fsrs: next };
}

/** Anteprima dell'intervallo per ciascun voto (es. "10 min", "3 g"). */
export function previewIntervals(card: StudyCard, now = new Date()): Record<number, string> {
  const preview = scheduler.repeat(reviveCard(card).fsrs, now);
  const out: Record<number, string> = {};
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    const mins = (+preview[g].card.due - +now) / 60000;
    out[g] = mins < 60 ? `${Math.max(1, Math.round(mins))} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} g`;
  }
  return out;
}
