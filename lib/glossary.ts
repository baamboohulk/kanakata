import fs from "node:fs";
import path from "node:path";
import type { Direction, Preset } from "./types";

const GLOSSARY_PATH = path.join(process.cwd(), "data", "glossary.json");

type Glossary = {
  entries: Array<{
    normalized: string;
    preset: Preset;
    direction: Direction;
    chosen: string;
    createdAt: string;
  }>;
};

function ensureFile() {
  const dir = path.dirname(GLOSSARY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(GLOSSARY_PATH)) {
    const init: Glossary = { entries: [] };
    fs.writeFileSync(GLOSSARY_PATH, JSON.stringify(init, null, 2), "utf-8");
  }
}

export function loadGlossary(): Glossary {
  ensureFile();
  const raw = fs.readFileSync(GLOSSARY_PATH, "utf-8");
  return JSON.parse(raw) as Glossary;
}

export function saveGlossary(g: Glossary) {
  ensureFile();
  fs.writeFileSync(GLOSSARY_PATH, JSON.stringify(g, null, 2), "utf-8");
}

export function getPreferred(normalized: string, preset: Preset, direction: Direction): string | null {
  const g = loadGlossary();
  const hit = g.entries
    .filter((e) => e.normalized === normalized && e.preset === preset && e.direction === direction)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return hit?.chosen ?? null;
}

export function putPreferred(normalized: string, preset: Preset, direction: Direction, chosen: string) {
  const g = loadGlossary();
  g.entries.push({ normalized, preset, direction, chosen, createdAt: new Date().toISOString() });
  saveGlossary(g);
}
