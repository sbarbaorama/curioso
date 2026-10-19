import { useSyncExternalStore } from "react";
import type { AppData, Settings } from "./types";
import { AREAS, ENGINES } from "./types";
import { syncConfigured, syncNow } from "./sync";

const DATA_KEY = "curioso:data";
const SETTINGS_KEY = "curioso:settings"; // chiavi e token: solo su questo dispositivo, mai sincronizzati

const zero = () => Object.fromEntries(AREAS.map((a) => [a.id, 0])) as AppData["stats"]["xp"];

export function emptyData(): AppData {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    lessons: [],
    cards: [],
    conversations: [],
    stats: { xp: zero(), skill: Object.fromEntries(AREAS.map((a) => [a.id, 40])) as AppData["stats"]["skill"], activeDays: [], badges: [], reviewsByDay: {} },
  };
}

export function defaultSettings(): Settings {
  return {
    primary: "gemini",
    backup: "openrouter",
    keys: { gemini: "", openrouter: "", claude: "" },
    models: Object.fromEntries(ENGINES.map((e) => [e.id, e.defaultModel])) as Settings["models"],
    github: { token: "", repo: "sbarbaorama/curioso-dati", path: "curioso-data.json", auto: true },
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return typeof fallback === "object" && fallback && !Array.isArray(fallback) ? { ...fallback, ...parsed } : parsed;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Salvataggio locale non riuscito", e);
  }
}

let data: AppData = read(DATA_KEY, emptyData());
let settings: Settings = read(SETTINGS_KEY, defaultSettings());
settings = { ...defaultSettings(), ...settings, keys: { ...defaultSettings().keys, ...settings.keys }, models: { ...defaultSettings().models, ...settings.models }, github: { ...defaultSettings().github, ...settings.github } };

export type SyncState = { status: "idle" | "syncing" | "ok" | "error"; message?: string; at?: string };
let syncState: SyncState = { status: "idle" };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getData = () => data;
export const getSettings = () => settings;

export function setData(update: (d: AppData) => AppData, opts: { sync?: boolean } = {}) {
  data = { ...update(data), updatedAt: new Date().toISOString() };
  write(DATA_KEY, data);
  emit();
  if (opts.sync && settings.github.auto) scheduleSync();
}

export function replaceData(next: AppData) {
  data = next;
  write(DATA_KEY, data);
  emit();
}

export function setSettings(update: (s: Settings) => Settings) {
  settings = update(settings);
  write(SETTINGS_KEY, settings);
  emit();
}

let syncTimer: number | undefined;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void runSync(), 1500);
}

export async function runSync(): Promise<void> {
  if (!syncConfigured(settings) || !navigator.onLine) return;
  syncState = { status: "syncing" };
  emit();
  try {
    const merged = await syncNow(settings, data);
    replaceData(merged);
    syncState = { status: "ok", at: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) };
  } catch (e) {
    syncState = { status: "error", message: (e as Error).message };
  }
  emit();
}

export const useData = () => useSyncExternalStore(subscribe, getData);
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
export const useSyncState = () => useSyncExternalStore(subscribe, () => syncState);

/** Backup manuale: file JSON senza chiavi. */
export function exportJson(): string {
  return JSON.stringify(data, null, 1);
}
