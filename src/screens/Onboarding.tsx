import { useState } from "react";
import { Chips } from "../components/Chips";
import { setData, useData } from "../store";
import type { Area, Cefr, LanguageGoal, Minutes, Profile, SchoolLevel, Style } from "../types";
import { AREAS, CEFR_LEVELS, LANGUAGES, LEVELS, MINUTES, STYLES } from "../types";

const INTERESTS = ["spazio", "biologia", "fisica", "chimica", "calcio", "videogiochi", "musica", "programmazione", "intelligenza artificiale", "viaggi", "storia", "arte", "cucina", "economia", "cinema", "fotografia"];
const GOALS = ["Capire concetti nuovi", "Preparare una verifica", "Imparare a programmare", "Migliorare l'inglese", "Cultura generale", "Crescere nel lavoro"];

export function Onboarding({ onDone }: { onDone?: () => void }) {
  const existing = useData().profile;
  const [name, setName] = useState(existing?.name ?? "");
  const [level, setLevel] = useState<SchoolLevel>(existing?.level ?? "hobbista");
  const [interests, setInterests] = useState<string[]>(existing?.interests ?? []);
  const [custom, setCustom] = useState("");
  const [goal, setGoal] = useState(existing?.goal ?? "");
  const [styles, setStyles] = useState<Style[]>(existing?.styles ?? ["esempi", "analogie"]);
  const [minutes, setMinutes] = useState<Minutes>(existing?.minutes ?? 10);
  const [areas, setAreas] = useState<Area[]>(existing?.areas ?? AREAS.map((a) => a.id));
  const [languages, setLanguages] = useState<LanguageGoal[]>(existing?.languages ?? []);

  function toggleLanguages(ids: string[]) {
    setLanguages(ids.map((id) => languages.find((l) => l.lang === id) ?? { lang: id, level: "A2" as Cefr }));
  }

  const allInterests = [...new Set([...INTERESTS, ...interests])];

  function addCustom() {
    const extra = custom.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (extra.length) setInterests([...new Set([...interests, ...extra])]);
    setCustom("");
  }

  function save() {
    const profile: Profile = { name: name.trim(), level, interests, goal, styles, minutes, areas: areas.length ? areas : AREAS.map((a) => a.id), languages };
    setData((d) => ({ ...d, profile, mission: existing ? d.mission : undefined }), { sync: true });
    onDone?.();
  }

  return (
    <div className="screen">
      <h1>{existing ? "Il tuo profilo" : "Ciao! Sono Curioso 👋"}</h1>
      {!existing && <p className="muted">Il tuo tutor personale. Rispondi a qualche domanda, così adatto ogni lezione a te.</p>}

      <label className="field">
        Come ti chiami?
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
      </label>

      <h3>Livello</h3>
      <Chips options={LEVELS} value={[level]} onChange={(v) => setLevel(v[0])} />

      <h3>Interessi</h3>
      <Chips options={allInterests.map((i) => ({ id: i, label: i }))} value={interests} onChange={setInterests} multi />
      <div className="row">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Altro (separati da virgola)" onKeyDown={(e) => e.key === "Enter" && addCustom()} />
        <button type="button" className="btn small" onClick={addCustom}>Aggiungi</button>
      </div>

      <h3>Obiettivo</h3>
      <Chips options={GOALS.map((g) => ({ id: g, label: g }))} value={[goal]} onChange={(v) => setGoal(v[0])} />
      <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Oppure scrivi il tuo obiettivo" />

      <h3>Come preferisci imparare?</h3>
      <Chips options={STYLES} value={styles} onChange={setStyles} multi />

      <h3>Tempo per sessione</h3>
      <Chips options={MINUTES.map((m) => ({ id: m, label: `${m} min` }))} value={[minutes]} onChange={(v) => setMinutes(v[0])} />

      <h3>Aree per la Missione del giorno</h3>
      <Chips options={AREAS.map((a) => ({ id: a.id, label: `${a.emoji} ${a.label}` }))} value={areas} onChange={setAreas} multi />

      <h3>Lingue che vuoi praticare</h3>
      <Chips options={LANGUAGES.map((l) => ({ id: l.id, label: `${l.flag} ${l.id}` }))} value={languages.map((l) => l.lang)} onChange={toggleLanguages} multi />
      {languages.map((g) => (
        <div key={g.lang} className="lang-level">
          <span className="small muted">{g.lang}</span>
          <Chips
            options={CEFR_LEVELS.map((c) => ({ id: c.id, label: c.id }))}
            value={[g.level]}
            onChange={(v) => setLanguages(languages.map((l) => (l.lang === g.lang ? { ...l, level: v[0] } : l)))}
          />
        </div>
      ))}

      <button className="btn primary block" onClick={save}>
        {existing ? "Salva profilo" : "Iniziamo!"}
      </button>
    </div>
  );
}
