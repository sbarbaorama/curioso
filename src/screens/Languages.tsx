import { useState } from "react";
import { PARTNERS, SCENARIOS } from "../ai/language";
import { Chips } from "../components/Chips";
import { todayKey } from "../gamification";
import { dueCards, uid } from "../srs";
import { setData, useData } from "../store";
import type { Cefr, Conversation, LanguageGoal } from "../types";
import { CEFR_LEVELS, LANGUAGES } from "../types";

const flag = (lang: string) => LANGUAGES.find((l) => l.id === lang)?.flag ?? "🌍";

export function Languages({ onOpenChat, goReview }: { onOpenChat: (id: string) => void; goReview: () => void }) {
  const data = useData();
  const goals = data.profile?.languages ?? [];
  const [lang, setLang] = useState(goals[0]?.lang ?? "");
  const [adding, setAdding] = useState(goals.length === 0);
  const [newLang, setNewLang] = useState("Inglese");
  const [newLevel, setNewLevel] = useState<Cefr>("A2");
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [custom, setCustom] = useState("");
  const [partner, setPartner] = useState(PARTNERS[0]);

  const goal = goals.find((g) => g.lang === lang);
  const conversations = (data.conversations ?? []).filter((c) => !lang || c.lang === lang);
  const langCards = data.cards.filter((c) => c.area === "lingue" && c.topic.startsWith(lang));
  const langDue = dueCards(langCards).length;

  function saveGoals(next: LanguageGoal[]) {
    setData((d) => ({ ...d, profile: d.profile && { ...d.profile, languages: next } }), { sync: true });
  }

  function addLanguage() {
    const next = [...goals.filter((g) => g.lang !== newLang), { lang: newLang, level: newLevel }];
    saveGoals(next);
    setLang(newLang);
    setAdding(false);
  }

  function start() {
    if (!goal) return;
    const conv: Conversation = {
      id: uid(),
      date: todayKey(),
      lang: goal.lang,
      level: goal.level,
      scenario: custom.trim() || scenario,
      partner,
      messages: [],
    };
    setData((d) => ({ ...d, conversations: [...(d.conversations ?? []), conv].slice(-40) }));
    onOpenChat(conv.id);
  }

  return (
    <div className="screen">
      <h1>Lingue</h1>

      {goals.length > 0 && (
        <div className="chips">
          {goals.map((g) => (
            <button key={g.lang} className={g.lang === lang && !adding ? "chip on" : "chip"} onClick={() => (setLang(g.lang), setAdding(false))}>
              {flag(g.lang)} {g.lang} · {g.level}
            </button>
          ))}
          <button className={adding ? "chip on" : "chip"} onClick={() => setAdding(true)}>
            + Lingua
          </button>
        </div>
      )}

      {adding ? (
        <section className="card">
          <h3>Che lingua vuoi praticare?</h3>
          <Chips options={LANGUAGES.map((l) => ({ id: l.id, label: `${l.flag} ${l.id}` }))} value={[newLang]} onChange={(v) => setNewLang(v[0])} />
          <h3>Il tuo livello</h3>
          <Chips options={CEFR_LEVELS} value={[newLevel]} onChange={(v) => setNewLevel(v[0])} />
          <p className="muted small">Non sai il livello? Parti da A2: l'app si adatta mentre parli e a fine conversazione ti stima il livello.</p>
          <button className="btn primary block" onClick={addLanguage}>
            Aggiungi {newLang}
          </button>
        </section>
      ) : (
        goal && (
          <>
            <section className="card mission">
              <div className="eyebrow">Nuova conversazione</div>
              <h3 style={{ marginTop: 14 }}>Livello</h3>
              <Chips
                options={CEFR_LEVELS}
                value={[goal.level]}
                onChange={(v) => saveGoals(goals.map((g) => (g.lang === goal.lang ? { ...g, level: v[0] } : g)))}
              />
              <h3>Situazione</h3>
              <Chips options={SCENARIOS.map((s) => ({ id: s, label: s }))} value={custom.trim() ? [] : [scenario]} onChange={(v) => (setScenario(v[0]), setCustom(""))} />
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Oppure inventa una situazione…" />
              <h3 style={{ marginTop: 16 }}>Con chi parli</h3>
              <Chips options={PARTNERS.map((p) => ({ id: p, label: p }))} value={[partner]} onChange={(v) => setPartner(v[0])} />
              <button className="btn primary block" onClick={start}>
                Inizia in {goal.lang}
              </button>
            </section>

            <div className="stats-row">
              <button className={langDue > 0 ? "stat hot" : "stat"} onClick={goReview}>
                <b>{langDue}</b>
                <span>da ripassare</span>
              </button>
              <div className="stat">
                <b>{langCards.length}</b>
                <span>parole e frasi</span>
              </div>
              <div className="stat">
                <b>{conversations.filter((c) => c.summary).length}</b>
                <span>conversazioni</span>
              </div>
            </div>

            {conversations.length > 0 && (
              <section className="card">
                <h3>Conversazioni recenti</h3>
                <ul className="list">
                  {[...conversations]
                    .reverse()
                    .slice(0, 10)
                    .map((c) => (
                      <li key={c.id}>
                        <button className="link" onClick={() => onOpenChat(c.id)}>
                          <span>{flag(c.lang)}</span>
                          <span style={{ flex: 1 }}>
                            {c.scenario}
                            <span className="muted small"> · {c.partner}</span>
                          </span>
                          <span className="muted small">{c.summary ? c.date.slice(5).split("-").reverse().join("/") : "in corso"}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
