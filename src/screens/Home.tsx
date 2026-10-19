import { useEffect, useRef, useState } from "react";
import { proposeMission } from "../ai/prompts";
import { isConfigured } from "../ai/engines";
import { skillLabel, streak, todayKey, weeklyChallenges } from "../gamification";
import { dueCards } from "../srs";
import { getData, getSettings, setData, useData, useSettings } from "../store";
import type { Mission } from "../types";
import { AREAS } from "../types";

export function Home({ onStart, onOpenLesson, goSettings, goReview }: { onStart: (m: Mission) => void; onOpenLesson: (id: string) => void; goSettings: () => void; goReview: () => void }) {
  const data = useData();
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wish, setWish] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const started = useRef(false);

  const ready = isConfigured(settings, settings.primary);
  const mission = data.mission?.date === todayKey() ? data.mission : undefined;
  const due = dueCards(data.cards).length;
  const todayDone = data.lessons.filter((l) => l.date === todayKey() && l.score !== null);
  const missionLesson = mission?.lessonId ? data.lessons.find((l) => l.id === mission.lessonId) : undefined;
  const missionDone = missionLesson?.score != null;
  const todayTopics = data.lessons.filter((l) => l.date === todayKey()).map((l) => l.topic);

  async function newMission(opts: { exclude?: string[]; request?: string } = {}) {
    setBusy(true);
    setError("");
    try {
      const m = await proposeMission(getSettings(), getData(), opts);
      setData((d) => ({ ...d, mission: { ...m, date: todayKey() } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!mission && ready && !started.current && navigator.onLine) {
      started.current = true;
      void newMission();
    }
  }, [mission, ready]);

  const area = mission ? AREAS.find((a) => a.id === mission.area) : undefined;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div className="screen">
      <header className="home-head">
        <div>
          <div className="hello">{hello}</div>
          <h1>{data.profile?.name || "Bentornato"}</h1>
          <p className="status">
            {todayDone.length === 0 ? "Pronto per la missione di oggi?" : `Oggi: ${todayDone.length} ${todayDone.length === 1 ? "missione completata" : "missioni completate"} ✓`}
          </p>
        </div>
        <div className="streak" title="Streak flessibile: un giorno saltato non la interrompe">
          🔥 {streak(data.stats.activeDays)}
        </div>
      </header>

      {!ready && (
        <div className="card warn">
          <p>Per generare le lezioni serve una chiave AI gratuita.</p>
          <button className="btn primary" onClick={goSettings}>Vai alle Impostazioni</button>
        </div>
      )}

      {ready && (
        <section className="card mission">
          <div className="eyebrow">{todayDone.length === 0 ? "Missione del giorno" : `Missione ${todayDone.length + (missionDone ? 0 : 1)} di oggi`}</div>
          {busy && <p className="loading">Sto preparando la missione…</p>}
          {!busy && mission && area && (
            <>
              <h2>
                {missionDone && <span className="ok">✓ </span>}
                {mission.topic}
              </h2>
              <div className="area-tag">
                {area.emoji} {area.label} · {data.profile?.minutes} min · livello {skillLabel(data.stats.skill[mission.area])}
              </div>
              <p className="hook">{mission.hook}</p>
              <p className="muted small">🎯 {mission.why}</p>
              <div className="mission-actions">
                {missionDone ? (
                  <button className="btn primary" onClick={() => newMission({ exclude: [...rejected, ...todayTopics] })}>
                    Nuova missione
                  </button>
                ) : missionLesson ? (
                  <button className="btn primary" onClick={() => onOpenLesson(missionLesson.id)}>
                    Continua missione
                  </button>
                ) : (
                  <button className="btn primary" onClick={() => onStart(mission)}>
                    Inizia missione
                  </button>
                )}
                <button
                  className="btn icon"
                  title="Sostituisci missione"
                  aria-label="Sostituisci missione"
                  onClick={() => {
                    const ex = [...rejected, mission.topic, ...todayTopics];
                    setRejected(ex);
                    void newMission({ exclude: ex });
                  }}
                >
                  ↻
                </button>
              </div>
            </>
          )}
          {!busy && !mission && <button className="btn primary" onClick={() => newMission()}>Genera missione</button>}
          {error && <p className="error">{error}</p>}
          <div className="wish">
            <input value={wish} onChange={(e) => setWish(e.target.value)} placeholder={todayDone.length ? "Ancora curioso? Approfondisci…" : "Oggi voglio approfondire…"} onKeyDown={(e) => e.key === "Enter" && wish.trim() && newMission({ request: wish.trim() })} />
            <button className="btn small" disabled={!wish.trim() || busy} onClick={() => newMission({ request: wish.trim() })}>
              Vai
            </button>
          </div>
        </section>
      )}

      <div className="stats-row">
        <button className={due > 0 ? "stat hot" : "stat"} onClick={goReview}>
          <b>{due}</b>
          <span>da ripassare</span>
        </button>
        <div className="stat">
          <b>{Object.values(data.stats.xp).reduce((a, b) => a + b, 0)}</b>
          <span>XP totali</span>
        </div>
        <div className="stat">
          <b>{data.stats.badges.length}</b>
          <span>badge</span>
        </div>
      </div>

      <section className="card">
        <h3>Sfide della settimana</h3>
        {weeklyChallenges(data).map((c) => (
          <div key={c.label} className="challenge">
            <span className={c.value >= c.target ? "ok" : ""}>
              {c.value >= c.target ? "✓ " : ""}
              {c.label}
            </span>
            <span className="muted small">
              {Math.min(c.value, c.target)}/{c.target}
            </span>
            <div className="bar">
              <div style={{ width: `${Math.min(100, (c.value / c.target) * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>

      {data.lessons.length > 0 && (
        <section className="card">
          <h3>Ultime lezioni</h3>
          <ul className="list">
            {data.lessons
              .slice(-5)
              .reverse()
              .map((l) => (
                <li key={l.id}>
                  <button className="link" onClick={() => onOpenLesson(l.id)}>
                    <span>{AREAS.find((a) => a.id === l.area)?.emoji}</span>
                    <span style={{ flex: 1 }}>{l.topic}</span>
                    <span className="muted small">{l.score === null ? "da completare" : `${Math.round(l.score * 100)}%`}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
