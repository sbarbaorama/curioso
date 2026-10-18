# Curioso — tutor personale adattivo

App web installabile (PWA) per Android: ogni giorno propone una **Missione** adatta al tuo profilo, con lezione in 7 passi
(idea, spiegazione, analogia, esempio, errori comuni, verifica attiva, approfondimento), indizi progressivi, ripasso distribuito (FSRS),
livelli, streak flessibile, badge e sfide settimanali.

## Installazione sul telefono

1. Apri **https://sbarbaorama.github.io/curioso/** con Chrome su Android.
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").
3. Nell'app: **Impostazioni** → incolla la chiave Gemini gratuita ([Google AI Studio](https://aistudio.google.com/apikey)).
4. (Facoltativo) riserva OpenRouter: chiave da [openrouter.ai](https://openrouter.ai/settings/keys) → "Carica modelli gratuiti".
5. (Facoltativo) Claude: chiave dalla [Claude Console](https://platform.claude.com/settings/keys), a consumo.

## Sincronizzazione dei progressi (repository privato)

1. Crea su GitHub un repository **privato** vuoto, ad esempio `curioso-dati`.
2. Crea un [token fine-grained](https://github.com/settings/personal-access-tokens/new):
   accesso **solo** a `curioso-dati`, permesso **Contents: Read and write**.
3. Incollalo in Impostazioni → Sincronizzazione GitHub.

Chiavi e token restano **solo sul dispositivo** (localStorage): non sono mai nel codice, nel repository dati o nei backup.

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173/curioso/
npm run build    # controllo tipi + build in dist/
```

Ogni push su `main` pubblica automaticamente su GitHub Pages (`.github/workflows/deploy.yml`).

## Struttura

- `src/ai/engines.ts` — motori AI intercambiabili (Gemini, OpenRouter, Claude) con riserva automatica
- `src/ai/prompts.ts` — missione del giorno, lezione strutturata, "spiegamelo come a…", valutazione risposte aperte
- `src/srs.ts` — ripasso distribuito con FSRS
- `src/gamification.ts` — livello stimato (tipo Elo), livelli per area, streak flessibile, badge, sfide
- `src/sync.ts` — sincronizzazione con repository GitHub privato
- `public/sw.js` — funzionamento offline
