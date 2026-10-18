import { BADGES, skillLabel, streak, topicLevel } from "../gamification";
import { exportJson, replaceData, useData } from "../store";
import { reviveCard } from "../srs";
import type { AppData } from "../types";
import { AREAS } from "../types";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function notesMarkdown(d: AppData): string {
  return d.lessons
    .map(({ lesson: l, date, score }) =>
      [
        `# ${l.topic}`,
        `*${AREAS.find((a) => a.id === l.area)?.label} · ${date}${score !== null ? ` · verifica ${Math.round(score * 100)}%` : ""}*`,
        `**In una frase:** ${l.oneLiner}`,
        `## Spiegazione\n${l.explanation}`,
        `## Analogia\n${l.analogy}`,
        `## Esempio\n${l.example}`,
        `## Errori comuni\n${l.mistakes.map((m) => `- ${m}`).join("\n")}`,
        `## Approfondimento\n${l.deepDive}`,
      ].join("\n\n"),
    )
    .join("\n\n---\n\n");
}

function ankiTsv(d: AppData): string {
  const clean = (s: string) => s.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
  return ["#separator:tab", "#html:true", "#tags column:3", ...d.cards.map((c) => `${clean(c.front)}\t${clean(c.back)}\tcurioso::${c.area}`)].join("\n");
}

export function Progress({ onOpenLesson }: { onOpenLesson: (id: string) => void }) {
  const data = useData();
  const completed = data.lessons.filter((l) => l.score !== null);

  function importFile(file: File) {
    file.text().then((t) => {
      try {
        const parsed = JSON.parse(t) as AppData;
        if (!parsed.lessons || !parsed.stats) throw new Error();
        if (confirm("Sostituire i dati attuali con quelli del backup?")) replaceData({ ...parsed, cards: parsed.cards.map(reviveCard) });
      } catch {
        alert("File non valido");
      }
    });
  }

  return (
    <div className="screen">
      <h1>Progressi</h1>
      <div className="stats-row">
        <div className="stat">
          <b>🔥 {streak(data.stats.activeDays)}</b>
          <span>giorni di fila</span>
        </div>
        <div className="stat">
          <b>{completed.length}</b>
          <span>missioni</span>
        </div>
        <div className="stat">
          <b>{data.cards.length}</b>
          <span>schede</span>
        </div>
      </div>

      <section className="card">
        <h3>Livelli per area</h3>
        {AREAS.map((a) => {
          const lv = topicLevel(data.stats.xp[a.id]);
          return (
            <div key={a.id} className="level">
              <div className="row between">
                <span>
                  {a.emoji} {a.label}
                </span>
                <span className="small">
                  <b>{lv.name}</b> · {data.stats.xp[a.id]} XP
                </span>
              </div>
              <div className="bar">
                <div style={{ width: `${lv.progress * 100}%` }} />
              </div>
              <div className="muted small">Livello stimato: {skillLabel(data.stats.skill[a.id])}{lv.next ? ` · prossimo: ${lv.next}` : ""}</div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h3>Badge</h3>
        <div className="badges">
          {BADGES.map((b) => {
            const on = data.stats.badges.includes(b.id);
            return (
              <div key={b.id} className={on ? "badge on" : "badge"} title={b.desc}>
                <span className="emoji">{on ? b.emoji : "🔒"}</span>
                <span className="name">{b.name}</span>
                <span className="desc">{b.desc}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>Appunti ({data.lessons.length})</h3>
        <ul className="list">
          {[...data.lessons].reverse().map((l) => (
            <li key={l.id}>
              <button className="link" onClick={() => onOpenLesson(l.id)}>
                {AREAS.find((a) => a.id === l.area)?.emoji} {l.topic} <span className="muted small">· {l.date}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Esporta e backup</h3>
        <div className="row wrap">
          <button className="btn small" disabled={!data.lessons.length} onClick={() => download("curioso-appunti.md", notesMarkdown(data), "text/markdown")}>
            Appunti (Markdown)
          </button>
          <button className="btn small" disabled={!data.cards.length} onClick={() => download("curioso-anki.txt", ankiTsv(data), "text/plain")}>
            Schede per Anki
          </button>
          <button className="btn small" onClick={() => download(`curioso-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson(), "application/json")}>
            Backup JSON
          </button>
          <label className="btn small">
            Ripristina backup
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        </div>
        <p className="muted small">Il file per Anki si importa da Anki → File → Importa. Il backup non contiene chiavi né token.</p>
      </section>
    </div>
  );
}
