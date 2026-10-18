import { useEffect, useRef, useState } from "react";
import { AUDIENCES, createLesson, evaluateOpen, reexplain, type OpenEvaluation } from "../ai/prompts";
import { Md } from "../components/Md";
import { BADGES, lessonXp, newBadges, todayKey, updateSkill } from "../gamification";
import { newCard, uid } from "../srs";
import { getData, getSettings, setData, useData } from "../store";
import type { Lesson as LessonT, LessonRecord, Mission, QuizItem } from "../types";
import { AREAS } from "../types";

const STEPS = ["Idea", "Spiegazione", "Analogia", "Esempio", "Errori comuni", "Verifica", "Approfondimento"];

type Source = { mission: Mission } | { lessonId: string };

export function Lesson({ source, onClose, onNext }: { source: Source; onClose: () => void; onNext: (m: Mission) => void }) {
  const data = useData();
  const [recordId, setRecordId] = useState<string | null>("lessonId" in source ? source.lessonId : null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<(number | null)[]>([]);
  const [summary, setSummary] = useState<{ score: number; xp: number; badges: string[] } | null>(null);
  const started = useRef(false);

  const record = data.lessons.find((l) => l.id === recordId);

  async function generate(mission: Mission) {
    setError("");
    try {
      const lesson = await createLesson(getSettings(), getData(), mission);
      const rec: LessonRecord = { id: uid(), date: todayKey(), area: mission.area, topic: lesson.topic, score: null, lesson };
      setData((d) => ({ ...d, lessons: [...d.lessons, rec].slice(-200) }), { sync: true });
      setRecordId(rec.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if ("mission" in source && !started.current) {
      started.current = true;
      void generate(source.mission);
    }
  }, [source]);

  useEffect(() => {
    if (record) setResults(new Array(record.lesson.quiz.length).fill(null));
  }, [record?.id]);

  if (!record) {
    return (
      <div className="screen">
        <button className="btn ghost" onClick={onClose}>← Indietro</button>
        {error ? (
          <div className="card">
            <p className="error">{error}</p>
            {"mission" in source && <button className="btn primary" onClick={() => generate(source.mission)}>Riprova</button>}
          </div>
        ) : (
          <div className="card">
            <p className="loading">Sto preparando la tua lezione su “{"mission" in source ? source.mission.topic : ""}”…</p>
            <p className="muted small">Adatto spiegazione, esempi e domande al tuo profilo.</p>
          </div>
        )}
      </div>
    );
  }

  const lesson = record.lesson;
  const area = AREAS.find((a) => a.id === record.area)!;

  function updateLesson(patch: Partial<LessonT>) {
    setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.id === record!.id ? { ...l, lesson: { ...l.lesson, ...patch } } : l)) }));
  }

  function complete() {
    const answered = results.map((r) => r ?? 0);
    const score = answered.length ? answered.reduce((a, b) => a + b, 0) / answered.length : 1;
    if (record!.score !== null) {
      setSummary({ score, xp: 0, badges: [] });
      return;
    }
    const xp = lessonXp(score);
    let earned: string[] = [];
    setData(
      (d) => {
        let skill = d.stats.skill[record!.area];
        lesson.quiz.forEach((q, i) => (skill = updateSkill(skill, q.difficulty, answered[i])));
        const cards = [
          ...lesson.flashcards.map((f) => newCard(f.front, f.back, record!.area, lesson.topic)),
          ...lesson.quiz
            .filter((_, i) => answered[i] < 0.6)
            .map((q) => newCard(q.question, q.kind === "mcq" && q.options ? `${q.options[q.answer ?? 0]}\n\n${q.explanation}` : q.explanation, record!.area, lesson.topic)),
        ];
        const today = todayKey();
        const next = {
          ...d,
          lessons: d.lessons.map((l) => (l.id === record!.id ? { ...l, score } : l)),
          cards: [...d.cards, ...cards],
          stats: {
            ...d.stats,
            xp: { ...d.stats.xp, [record!.area]: d.stats.xp[record!.area] + xp },
            skill: { ...d.stats.skill, [record!.area]: skill },
            activeDays: d.stats.activeDays.includes(today) ? d.stats.activeDays : [...d.stats.activeDays, today],
          },
        };
        earned = newBadges(next);
        return { ...next, stats: { ...next.stats, badges: [...next.stats.badges, ...earned] } };
      },
      { sync: true },
    );
    setSummary({ score, xp, badges: earned });
  }

  if (summary) {
    return (
      <div className="screen">
        <div className="card center">
          <div className="big-emoji">{summary.score >= 0.8 ? "🏆" : summary.score >= 0.5 ? "👏" : "💪"}</div>
          <h2>Missione completata!</h2>
          <p>
            Punteggio verifica: <b>{Math.round(summary.score * 100)}%</b>
          </p>
          {summary.xp > 0 && (
            <p>
              +{summary.xp} XP in {area.emoji} {area.label}
            </p>
          )}
          {summary.badges.map((id) => {
            const b = BADGES.find((x) => x.id === id)!;
            return (
              <p key={id} className="badge-new">
                {b.emoji} Nuovo badge: <b>{b.name}</b>
              </p>
            );
          })}
          <p className="muted small">Le schede di ripasso e gli errori torneranno a intervalli crescenti.</p>
          <button className="btn primary block" onClick={onClose}>Torna alla home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen lesson">
      <div className="lesson-top">
        <button className="btn ghost" onClick={onClose}>✕</button>
        <div className="steps">
          {STEPS.map((s, i) => (
            <button key={s} className={i === step ? "dot on" : i < step ? "dot done" : "dot"} onClick={() => setStep(i)} aria-label={s} />
          ))}
        </div>
      </div>
      <div className="area-tag">
        {area.emoji} {area.label}
      </div>
      <h1>{lesson.topic}</h1>
      <div className="eyebrow">
        {step + 1}. {STEPS[step]}
      </div>

      <div className="card">
        {step === 0 && (
          <>
            <p className="one-liner">{lesson.oneLiner}</p>
            {lesson.whyUseful && (
              <>
                <h4>Perché mi serve?</h4>
                <Md text={lesson.whyUseful} />
              </>
            )}
          </>
        )}
        {step === 1 && <Explanation lesson={lesson} onChange={updateLesson} />}
        {step === 2 && <Md text={lesson.analogy} />}
        {step === 3 && <Md text={lesson.example} />}
        {step === 4 && (
          <ul className="mistakes">
            {lesson.mistakes.map((m, i) => (
              <li key={i}>
                ⚠️ <Md text={m} />
              </li>
            ))}
          </ul>
        )}
        {step === 5 && (
          <div>
            {lesson.quiz.map((q, i) => (
              <Question key={`${record.id}-${i}`} n={i + 1} q={q} lesson={lesson} onResult={(r) => setResults((rs) => rs.map((x, j) => (j === i ? r : x)))} />
            ))}
          </div>
        )}
        {step === 6 && (
          <>
            <Md text={lesson.deepDive} />
            {lesson.prerequisites.length > 0 && (
              <>
                <h4>Prerequisiti</h4>
                <p className="muted">{lesson.prerequisites.join(" · ")}</p>
              </>
            )}
            {lesson.nextTopics.length > 0 && (
              <>
                <h4>Prossimi passi</h4>
                <div className="chips">
                  {lesson.nextTopics.map((t) => (
                    <button key={t} className="chip" onClick={() => onNext({ date: todayKey(), area: record.area, topic: t, hook: "", why: "" })}>
                      {t} →
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="row nav">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Indietro
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setStep(step + 1)}>
            Avanti →
          </button>
        ) : (
          <button className="btn primary" onClick={complete}>
            {record.score === null ? "Completa missione" : "Fine"}
          </button>
        )}
      </div>
      {step === 5 && results.some((r) => r === null) && <p className="muted small center">Rispondi alle domande prima di proseguire: è la parte che fa imparare davvero.</p>}
    </div>
  );
}

function Explanation({ lesson, onChange }: { lesson: LessonT; onChange: (p: Partial<LessonT>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function redo(audience: string) {
    setBusy(true);
    setError("");
    try {
      const r = await reexplain(getSettings(), getData(), lesson, audience);
      onChange({ explanation: r.explanation, analogy: r.analogy || lesson.analogy });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {busy ? <p className="loading">Riscrivo la spiegazione…</p> : <Md text={lesson.explanation} />}
      <div className="explain-as">
        <span className="muted small">Spiegamelo come a…</span>
        <select disabled={busy} value="" onChange={(e) => e.target.value && redo(e.target.value)}>
          <option value="">scegli</option>
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}

function Question({ n, q, lesson, onResult }: { n: number; q: QuizItem; lesson: LessonT; onResult: (r: number) => void }) {
  const [hints, setHints] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [evaluation, setEvaluation] = useState<OpenEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = chosen !== null || evaluation !== null;

  function pick(i: number) {
    if (done) return;
    setChosen(i);
    onResult(i === q.answer ? Math.max(0.5, 1 - 0.25 * hints) : 0);
  }

  async function evaluate() {
    setBusy(true);
    setError("");
    try {
      const ev = await evaluateOpen(getSettings(), getData(), lesson, q, text);
      setEvaluation(ev);
      onResult(Math.max(0, ev.score - 0.1 * hints));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="question">
      <div className="q">
        <b>{n}.</b> <Md text={q.question} />
      </div>
      {q.kind === "mcq" && q.options ? (
        <div className="options">
          {q.options.map((o, i) => (
            <button
              key={i}
              className={`option ${done && i === q.answer ? "right" : ""} ${chosen === i && i !== q.answer ? "wrong" : ""}`}
              onClick={() => pick(i)}
              disabled={done}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi la tua risposta con parole tue…" rows={4} disabled={done} />
          {!done && (
            <button className="btn primary small" disabled={!text.trim() || busy} onClick={evaluate}>
              {busy ? "Valuto…" : "Valuta risposta"}
            </button>
          )}
        </>
      )}
      {!done &&
        q.hints.slice(0, hints).map((h, i) => (
          <p key={i} className="hint">
            💡 {h}
          </p>
        ))}
      {!done && hints < q.hints.length && (
        <button className="btn ghost small" onClick={() => setHints(hints + 1)}>
          {hints === 0 ? "Dammi un indizio" : "Un altro indizio"}
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {chosen !== null && (
        <div className={chosen === q.answer ? "feedback ok" : "feedback ko"}>
          <b>{chosen === q.answer ? "Esatto!" : "Non proprio."}</b> <Md text={q.explanation} />
        </div>
      )}
      {evaluation && (
        <div className={evaluation.score >= 0.6 ? "feedback ok" : "feedback ko"}>
          <b>{Math.round(evaluation.score * 100)}%</b> <Md text={evaluation.feedback} />
          {evaluation.missing.length > 0 && <p className="small">Da rivedere: {evaluation.missing.join("; ")}</p>}
          <details>
            <summary>Risposta modello</summary>
            <Md text={q.explanation} />
          </details>
        </div>
      )}
    </div>
  );
}
