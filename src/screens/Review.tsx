import { useMemo, useState } from "react";
import { Md } from "../components/Md";
import { newBadges, todayKey } from "../gamification";
import { dueCards, previewIntervals, Rating, reviewCard, type Grade } from "../srs";
import { setData, useData } from "../store";
import { AREAS } from "../types";

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: Rating.Again, label: "Non ricordo", cls: "again" },
  { g: Rating.Hard, label: "Difficile", cls: "hard" },
  { g: Rating.Good, label: "Bene", cls: "good" },
  { g: Rating.Easy, label: "Facile", cls: "easy" },
];

export function Review() {
  const data = useData();
  // La coda viene fissata all'apertura; le schede "Non ricordo" tornano in fondo nella stessa sessione.
  const [queue, setQueue] = useState(() => dueCards(data.cards).map((c) => c.id));
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(0);

  const card = useMemo(() => data.cards.find((c) => c.id === queue[0]), [data.cards, queue]);
  const upcoming = data.cards.filter((c) => new Date(c.fsrs.due) > new Date()).sort((a, b) => +new Date(a.fsrs.due) - +new Date(b.fsrs.due))[0];

  function grade(g: Grade) {
    if (!card) return;
    const updated = reviewCard(card, g);
    const today = todayKey();
    setData(
      (d) => {
        const next = {
          ...d,
          cards: d.cards.map((c) => (c.id === card.id ? updated : c)),
          stats: {
            ...d.stats,
            xp: { ...d.stats.xp, [card.area]: d.stats.xp[card.area] + 2 },
            reviewsByDay: { ...d.stats.reviewsByDay, [today]: (d.stats.reviewsByDay[today] ?? 0) + 1 },
            activeDays: d.stats.activeDays.includes(today) ? d.stats.activeDays : [...d.stats.activeDays, today],
          },
        };
        return { ...next, stats: { ...next.stats, badges: [...next.stats.badges, ...newBadges(next)] } };
      },
      { sync: queue.length === 1 },
    );
    setQueue((q) => (g === Rating.Again ? [...q.slice(1), q[0]] : q.slice(1)));
    setShow(false);
    setDone(done + 1);
  }

  if (!card) {
    return (
      <div className="screen">
        <h1>Ripasso</h1>
        <div className="card center">
          <div className="big-emoji">{done ? "🎉" : "😌"}</div>
          <p>{done ? `Hai ripassato ${done} schede. Ottimo lavoro!` : "Nessuna scheda da ripassare adesso."}</p>
          {upcoming && <p className="muted small">Prossimo ripasso: {new Date(upcoming.fsrs.due).toLocaleString("it-IT", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</p>}
          <p className="muted small">Schede totali: {data.cards.length}</p>
        </div>
      </div>
    );
  }

  const area = AREAS.find((a) => a.id === card.area);
  const intervals = previewIntervals(card);

  return (
    <div className="screen">
      <h1>Ripasso</h1>
      <p className="muted small">
        Rimaste: {queue.length} · {area?.emoji} {card.topic}
      </p>
      <div className="card flashcard">
        <div className="front">
          <Md text={card.front} />
        </div>
        {show && (
          <div className="back">
            <Md text={card.back} />
          </div>
        )}
      </div>
      {!show ? (
        <button className="btn primary block" onClick={() => setShow(true)}>
          Mostra risposta
        </button>
      ) : (
        <div className="grades">
          {GRADES.map(({ g, label, cls }) => (
            <button key={g} className={`btn grade ${cls}`} onClick={() => grade(g)}>
              {label}
              <span>{intervals[g]}</span>
            </button>
          ))}
        </div>
      )}
      <p className="muted small center">Prova a rispondere a mente prima di girare la scheda.</p>
    </div>
  );
}
