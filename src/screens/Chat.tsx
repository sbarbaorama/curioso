import { useEffect, useRef, useState } from "react";
import { continueConversation, startConversation, summarizeConversation } from "../ai/language";
import { newBadges, todayKey, updateSkill } from "../gamification";
import { canListen, canSpeak, listen, speak } from "../speech";
import { newCard } from "../srs";
import { getData, getSettings, setData, useData } from "../store";
import type { AppData, ChatCorrection, ChatMsg, Conversation, StudyCard } from "../types";
import { CEFR_LEVELS, LANGUAGES } from "../types";

const TRANSLATE_KEY = "curioso:alwaysTranslate";
function readPref(): boolean {
  try {
    return localStorage.getItem(TRANSLATE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Aggiorna una conversazione e, insieme, schede, XP e livello. */
function updateConversation(id: string, fn: (c: Conversation) => Conversation, extra?: (d: AppData, c: Conversation) => AppData, sync = false) {
  setData(
    (d) => {
      let updated: Conversation | undefined;
      const conversations = (d.conversations ?? []).map((c) => (c.id === id ? (updated = fn(c)) : c));
      let next: AppData = { ...d, conversations };
      if (extra && updated) next = extra(next, updated);
      return next;
    },
    { sync },
  );
}

function learnFromTurn(d: AppData, conv: Conversation, userText: string, correction: ChatCorrection | null, reply: ChatMsg, userTurn = true): AppData {
  const topic = `${conv.lang} · ${conv.scenario}`;
  const known = new Set(d.cards.filter((c) => c.area === "lingue").map((c) => c.front.trim().toLowerCase()));
  const cards: StudyCard[] = [];
  for (const v of reply.vocab ?? []) {
    if (known.has(v.term.trim().toLowerCase())) continue;
    known.add(v.term.trim().toLowerCase());
    cards.push(newCard(v.term, `${v.meaning}${v.example ? `\n\n*${v.example}*` : ""}`, "lingue", topic));
  }
  if (!userTurn) return { ...d, cards: [...d.cards, ...cards] };
  if (correction) cards.push(newCard(`Come si dice meglio?\n\n“${userText}”`, `${correction.corrected}\n\n${correction.explanation}`, "lingue", topic));
  const today = todayKey();
  const difficulty = CEFR_LEVELS.findIndex((l) => l.id === conv.level) + 1;
  const next: AppData = {
    ...d,
    cards: [...d.cards, ...cards],
    stats: {
      ...d.stats,
      xp: { ...d.stats.xp, lingue: d.stats.xp.lingue + 3 },
      skill: { ...d.stats.skill, lingue: updateSkill(d.stats.skill.lingue, difficulty, correction ? 0.3 : 1) },
      activeDays: d.stats.activeDays.includes(today) ? d.stats.activeDays : [...d.stats.activeDays, today],
    },
  };
  return { ...next, stats: { ...next.stats, badges: [...next.stats.badges, ...newBadges(next)] } };
}

export function Chat({ id, onClose }: { id: string; onClose: () => void }) {
  const data = useData();
  const conv = (data.conversations ?? []).find((c) => c.id === id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [alwaysTranslate, setAlwaysTranslate] = useState(readPref);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const speech = LANGUAGES.find((l) => l.id === conv?.lang)?.speech ?? "en-GB";
  const ended = Boolean(conv?.summary);
  const last = conv?.messages[conv.messages.length - 1];

  async function opening() {
    setBusy(true);
    setError("");
    try {
      const msg = await startConversation(getSettings(), getData(), conv!);
      updateConversation(id, (c) => ({ ...c, messages: [msg] }), (d, c) => learnFromTurn(d, c, "", null, msg, false));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (conv && conv.messages.length === 0 && !started.current) {
      started.current = true;
      void opening();
    }
  }, [conv?.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv?.messages.length, busy]);

  if (!conv) {
    return (
      <div className="screen">
        <button className="btn ghost" onClick={onClose}>← Indietro</button>
        <p className="muted">Conversazione non trovata.</p>
      </div>
    );
  }

  /** Invia (o reinvia dopo un errore) l'ultima frase dello studente. */
  async function reply(userText: string, alreadyAdded: boolean) {
    setBusy(true);
    setError("");
    if (!alreadyAdded) updateConversation(id, (c) => ({ ...c, messages: [...c.messages, { role: "user", text: userText }] }));
    try {
      const before = getData().conversations!.find((c) => c.id === id)!;
      const history = { ...before, messages: before.messages.slice(0, -1) };
      const { correction, reply: aiMsg } = await continueConversation(getSettings(), getData(), history, userText);
      updateConversation(
        id,
        (c) => ({
          ...c,
          messages: [...c.messages.slice(0, -1), { ...c.messages[c.messages.length - 1], correction }, aiMsg],
        }),
        (d, c) => learnFromTurn(d, c, userText, correction, aiMsg),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    void reply(t, false);
  }

  async function dictate() {
    setListening(true);
    setError("");
    try {
      const heard = await listen(speech);
      if (heard) setText((t) => (t ? `${t} ${heard}` : heard));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListening(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      const summary = await summarizeConversation(getSettings(), getData(), conv!);
      updateConversation(
        id,
        (c) => ({ ...c, summary }),
        (d) => {
          const next = { ...d, stats: { ...d.stats, xp: { ...d.stats.xp, lingue: d.stats.xp.lingue + 15 } } };
          return { ...next, stats: { ...next.stats, badges: [...next.stats.badges, ...newBadges(next)] } };
        },
        true,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleTranslate() {
    const v = !alwaysTranslate;
    setAlwaysTranslate(v);
    try {
      localStorage.setItem(TRANSLATE_KEY, v ? "1" : "0");
    } catch {
      /* preferenza non salvata */
    }
  }

  const userTurns = conv.messages.filter((m) => m.role === "user").length;
  const needsRetry = !busy && last?.role === "user" && !ended;

  return (
    <div className="chat">
      <header className="chat-top">
        <button className="btn ghost" onClick={onClose} aria-label="Chiudi">
          ✕
        </button>
        <div className="chat-title">
          <b>
            {LANGUAGES.find((l) => l.id === conv.lang)?.flag} {conv.scenario}
          </b>
          <span className="muted small">
            {conv.partner} · {conv.level}
          </span>
        </div>
        {!ended && (
          <button className="btn small" disabled={busy || userTurns === 0} onClick={finish}>
            Termina
          </button>
        )}
      </header>

      <div className="chat-body">
        <label className="check small translate-toggle">
          <input type="checkbox" checked={alwaysTranslate} onChange={toggleTranslate} />
          Mostra sempre la traduzione
        </label>

        {conv.messages.map((m, i) =>
          m.role === "ai" ? (
            <div key={i} className="bubble ai">
              <p>{m.text}</p>
              {(alwaysTranslate || shown.has(i)) && m.translation && <p className="translation">{m.translation}</p>}
              <div className="bubble-actions">
                {canSpeak && (
                  <button onClick={() => speak(m.text, speech)} aria-label="Ascolta">
                    🔊 Ascolta
                  </button>
                )}
                {!alwaysTranslate && m.translation && (
                  <button onClick={() => setShown((s) => new Set(s).add(i))} disabled={shown.has(i)}>
                    Traduci
                  </button>
                )}
              </div>
              {m.vocab && m.vocab.length > 0 && (
                <div className="vocab">
                  {m.vocab.map((v) => (
                    <span key={v.term} title={v.example}>
                      📌 <b>{v.term}</b> {v.meaning}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="bubble-wrap">
              <div className="bubble user">{m.text}</div>
              {m.correction && (
                <div className="correction">
                  <span className="muted small">✏️ Più naturale</span>
                  <p>{m.correction.corrected}</p>
                  {canSpeak && (
                    <button className="mini" onClick={() => speak(m.correction!.corrected, speech)}>
                      🔊
                    </button>
                  )}
                  <p className="small">{m.correction.explanation}</p>
                </div>
              )}
            </div>
          ),
        )}

        {busy && <div className="bubble ai typing">{ended || conv.messages.length === 0 ? "Preparo…" : "sta scrivendo…"}</div>}
        {error && (
          <div className="card warn">
            <p className="error">{error}</p>
            {needsRetry && (
              <button className="btn small" onClick={() => reply(last!.text, true)}>
                Riprova
              </button>
            )}
            {conv.messages.length === 0 && (
              <button className="btn small" onClick={opening}>
                Riprova
              </button>
            )}
          </div>
        )}

        {conv.summary && (
          <section className="card summary">
            <div className="eyebrow">Bilancio della conversazione</div>
            <p>{conv.summary.feedback}</p>
            {conv.summary.strengths.length > 0 && (
              <>
                <h4>Bene</h4>
                <ul>
                  {conv.summary.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {conv.summary.improve.length > 0 && (
              <>
                <h4>Da allenare</h4>
                <ul>
                  {conv.summary.improve.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted small">
              Livello stimato: <b>{conv.summary.levelEstimate}</b> · parole e correzioni sono già nel Ripasso.
            </p>
          </section>
        )}
        <div ref={bottom} />
      </div>

      {!ended && (
        <footer className="chat-input">
          {last?.role === "ai" && last.suggestions && last.suggestions.length > 0 && !busy && (
            <div className="suggestions">
              {last.suggestions.map((s) => (
                <button key={s} onClick={() => setText(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="chat-row">
            {canListen && (
              <button className={listening ? "btn icon listening" : "btn icon"} onClick={dictate} disabled={listening || busy} aria-label="Detta">
                🎤
              </button>
            )}
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Rispondi in ${conv.lang.toLowerCase()}…`}
            />
            <button className="btn primary icon" onClick={send} disabled={!text.trim() || busy || needsRetry} aria-label="Invia">
              ➤
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
