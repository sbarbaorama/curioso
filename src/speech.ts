// Voce: sintesi (ascolta la frase) e dettatura (parla invece di scrivere), con le API del browser.
// Su Chrome per Android funzionano entrambe; dove mancano i pulsanti non vengono mostrati.

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text: string, lang: string) {
  if (!canSpeak) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

const Recognition: (new () => RecognitionLike) | undefined =
  typeof window !== "undefined" ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as never : undefined;

export const canListen = Boolean(Recognition);

/** Ascolta una frase nella lingua indicata e restituisce il testo riconosciuto. */
export function listen(lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error("Dettatura non disponibile su questo browser"));
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let text = "";
    rec.onresult = (e) => {
      text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
    };
    rec.onerror = (e) => reject(new Error(e.error === "not-allowed" ? "Permesso microfono negato" : `Dettatura: ${e.error}`));
    rec.onend = () => resolve(text.trim());
    rec.start();
  });
}
