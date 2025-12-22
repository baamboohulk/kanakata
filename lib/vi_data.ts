import fs from "node:fs";
import path from "node:path";

let _syllables: string[] | null = null;
let _syllableIndex: Map<string, string[]> | null = null;
let _givenNames: Set<string> | null = null;

function readLines(p: string): string[] {
  const txt = fs.readFileSync(p, "utf8");
  return txt
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripDiacritics(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function getVietnameseSyllables(): string[] {
  if (_syllables) return _syllables;
  const p = path.join(process.cwd(), "data/vi/syllables.txt");
  _syllables = readLines(p);
  return _syllables;
}

// Map "khong dau" -> [có dấu...]
export function getVietnameseSyllableIndex(): Map<string, string[]> {
  if (_syllableIndex) return _syllableIndex;

  const m = new Map<string, string[]>();
  for (const syl of getVietnameseSyllables()) {
    const key = stripDiacritics(syl.toLowerCase());
    const arr = m.get(key) ?? [];
    arr.push(syl);
    m.set(key, arr);
  }
  _syllableIndex = m;
  return m;
}

/*export function getVietnameseGivenNames(): Set<string> {
  if (_givenNames) return _givenNames;

  const base = path.join(process.cwd(), "data/vi");
  const boy = readLines(path.join(base, "boy.txt"));
  const girl = readLines(path.join(base, "girl.txt"));

  // given names có dấu, lowercase để match
  _givenNames = new Set([...boy, ...girl].map((x) => x.toLowerCase()));
  return _givenNames;
}*/ 

export function getVietnameseGivenNames(): Set<string> {
  if (_givenNames) return _givenNames;

  const base = path.join(process.cwd(), "data/vi");

  const files = [
    "boy.txt",
    "girl.txt",
    "boy_one_word.txt",
    "girl_one_word.txt"
  ].map((f) => path.join(base, f));

  const all: string[] = [];
  for (const p of files) {
    if (!fs.existsSync(p)) continue;
    all.push(...readLines(p));
  }

  // given names có dấu, lowercase để match
  _givenNames = new Set(all.map((x) => x.toLowerCase()));
  return _givenNames;
}

