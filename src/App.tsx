import { useEffect, useState } from "react";
import { HomeIcon, ProgressIcon, ReviewIcon, SettingsIcon } from "./components/Icons";
import { Home } from "./screens/Home";
import { Lesson } from "./screens/Lesson";
import { Onboarding } from "./screens/Onboarding";
import { Progress } from "./screens/Progress";
import { Review } from "./screens/Review";
import { SettingsScreen } from "./screens/Settings";
import { dueCards } from "./srs";
import { runSync, useData } from "./store";
import type { Mission } from "./types";

type Tab = "home" | "review" | "progress" | "settings";
type Overlay = { kind: "lesson"; source: { mission: Mission } | { lessonId: string }; key: number } | { kind: "profile" } | null;

export function App() {
  const data = useData();
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);

  // All'apertura scarica eventuali progressi fatti su un altro dispositivo.
  useEffect(() => {
    void runSync();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0); // nelle versioni recenti di Chrome restituisce una Promise: non va restituita all'effetto
  }, [tab, overlay]);

  if (!data.profile) return <Onboarding />;

  const openLesson = (source: { mission: Mission } | { lessonId: string }) => setOverlay({ kind: "lesson", source, key: Date.now() });

  if (overlay?.kind === "lesson") {
    return <Lesson key={overlay.key} source={overlay.source} onClose={() => setOverlay(null)} onNext={(m) => openLesson({ mission: m })} />;
  }
  if (overlay?.kind === "profile") {
    return <Onboarding onDone={() => setOverlay(null)} />;
  }

  const due = dueCards(data.cards).length;

  return (
    <div className="app">
      <main>
        {tab === "home" && <Home onStart={(m) => openLesson({ mission: m })} onOpenLesson={(id) => openLesson({ lessonId: id })} goSettings={() => setTab("settings")} goReview={() => setTab("review")} />}
        {tab === "review" && <Review />}
        {tab === "progress" && <Progress onOpenLesson={(id) => openLesson({ lessonId: id })} />}
        {tab === "settings" && <SettingsScreen onEditProfile={() => setOverlay({ kind: "profile" })} />}
      </main>
      <nav className="tabbar">
        <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}>
          <HomeIcon />
          Oggi
        </button>
        <button className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>
          <ReviewIcon />
          Ripasso{due > 0 && <i className="count">{due}</i>}
        </button>
        <button className={tab === "progress" ? "on" : ""} onClick={() => setTab("progress")}>
          <ProgressIcon />
          Progressi
        </button>
        <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>
          <SettingsIcon />
          Impostazioni
        </button>
      </nav>
    </div>
  );
}
