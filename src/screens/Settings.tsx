import { useState } from "react";
import { callEngine, listModels } from "../ai/engines";
import { syncConfigured } from "../sync";
import { getSettings, runSync, setSettings, useSettings, useSyncState } from "../store";
import type { EngineId } from "../types";
import { ENGINES } from "../types";

export function SettingsScreen({ onEditProfile }: { onEditProfile: () => void }) {
  const s = useSettings();
  const sync = useSyncState();

  return (
    <div className="screen">
      <h1>Impostazioni</h1>

      <section className="card">
        <h3>Motore AI</h3>
        <label className="field">
          Principale
          <select value={s.primary} onChange={(e) => setSettings((x) => ({ ...x, primary: e.target.value as EngineId }))}>
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Riserva (se il principale non risponde o ha finito il limite gratuito)
          <select value={s.backup} onChange={(e) => setSettings((x) => ({ ...x, backup: e.target.value as EngineId | "none" }))}>
            <option value="none">Nessuna</option>
            {ENGINES.filter((e) => e.id !== s.primary).map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">Le chiavi restano solo su questo telefono: non vengono mai inviate a GitHub né incluse nei backup.</p>
      </section>

      {ENGINES.map((e) => (
        <EngineCard key={e.id} id={e.id} />
      ))}

      <section className="card">
        <h3>Sincronizzazione GitHub</h3>
        <p className="muted small">
          Salva i progressi in un repository <b>privato</b> (es. <code>sbarbaorama/curioso-dati</code>). Crea un token “fine-grained” con accesso solo a quel repository e
          permesso <i>Contents: Read and write</i>.{" "}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            Crea token
          </a>
        </p>
        <label className="field">
          Repository
          <input value={s.github.repo} onChange={(e) => setSettings((x) => ({ ...x, github: { ...x.github, repo: e.target.value } }))} placeholder="utente/curioso-dati" />
        </label>
        <label className="field">
          File
          <input value={s.github.path} onChange={(e) => setSettings((x) => ({ ...x, github: { ...x.github, path: e.target.value } }))} />
        </label>
        <label className="field">
          Token
          <input type="password" autoComplete="off" value={s.github.token} onChange={(e) => setSettings((x) => ({ ...x, github: { ...x.github, token: e.target.value.trim() } }))} placeholder="github_pat_…" />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.github.auto} onChange={(e) => setSettings((x) => ({ ...x, github: { ...x.github, auto: e.target.checked } }))} />
          Sincronizza automaticamente dopo ogni lezione
        </label>
        <div className="row">
          <button className="btn small" disabled={!syncConfigured(s) || sync.status === "syncing"} onClick={() => runSync()}>
            {sync.status === "syncing" ? "Sincronizzo…" : "Sincronizza ora"}
          </button>
          {sync.status === "ok" && <span className="ok small">✓ Sincronizzato alle {sync.at}</span>}
          {sync.status === "error" && <span className="error small">{sync.message}</span>}
        </div>
      </section>

      <section className="card">
        <h3>Profilo</h3>
        <button className="btn small" onClick={onEditProfile}>
          Modifica profilo, interessi e obiettivi
        </button>
      </section>

      <p className="muted small center">Curioso v0.1</p>
    </div>
  );
}

function EngineCard({ id }: { id: EngineId }) {
  const s = useSettings();
  const info = ENGINES.find((e) => e.id === id)!;
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setStatus("");
    try {
      const list = await listModels(id, s.keys[id]);
      setModels(list);
      if (!s.models[id] && list[0]) setSettings((x) => ({ ...x, models: { ...x.models, [id]: list[0] } }));
      setStatus(`${list.length} modelli disponibili`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setStatus("Provo…");
    try {
      const t = await callEngine(id, getSettings(), { system: "Rispondi in italiano in modo brevissimo.", prompt: "Di' 'Ciao, funziono!'", json: false });
      setStatus(`✓ ${t.slice(0, 80)}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3>{info.label}</h3>
      <p className="muted small">
        {info.keyHelp}:{" "}
        <a href={info.keyUrl} target="_blank" rel="noreferrer">
          ottieni la chiave
        </a>
      </p>
      <label className="field">
        Chiave
        <input type="password" autoComplete="off" value={s.keys[id]} onChange={(e) => setSettings((x) => ({ ...x, keys: { ...x.keys, [id]: e.target.value.trim() } }))} />
      </label>
      <label className="field">
        Modello
        <input list={`models-${id}`} value={s.models[id]} onChange={(e) => setSettings((x) => ({ ...x, models: { ...x.models, [id]: e.target.value.trim() } }))} placeholder={info.defaultModel || "carica l'elenco"} />
        <datalist id={`models-${id}`}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <div className="row wrap">
        <button className="btn small" disabled={busy || (id !== "openrouter" && !s.keys[id])} onClick={load}>
          {id === "openrouter" ? "Carica modelli gratuiti" : "Carica modelli"}
        </button>
        <button className="btn small" disabled={busy || !s.keys[id]} onClick={test}>
          Prova
        </button>
      </div>
      {status && <p className="small">{status}</p>}
    </section>
  );
}
