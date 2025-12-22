import { RULES } from "./rules";
import { removeToneMarksOnlyVi, removeTonesVi, splitWords, uniq } from "./util";
import type { Breakdown, Preset } from "./types";

type TokenAlt = { token: string; alts: string[] };

const ONSETS: Array<[string, string[]]> = [
  ["ngh", ["ゲ", "グ"]],
  ["ng", ["グ", "ンゴ"]],
  ["gh", ["グ"]],
  ["gi", ["ジ", "ギ"]],
  ["nh", ["ニ", "ン"]],
  ["ph", ["フ", "ファ"]],
  ["th", ["ト", "ティ"]],
  ["tr", ["チ", "トゥ"]],
  ["ch", ["チ", "チャ"]],
  ["kh", ["ク", "カ"]],
  ["qu", ["ク", "クァ", "クワ"]],
  ["x", ["ス"]],
  ["s", ["ス"]],
  ["v", ["ヴ", "ブ"]],
  ["d", ["ズ", "ジ", "ド"]],
  ["đ", ["ド"]],
  //["r", ["ラ", "ル", "リ"]],
  //["l", ["ル", "ラ", "リ"]],
  ["r", ["ラ", "リ", "ル", "レ", "ロ"]],
  ["l", ["ラ", "リ", "ル", "レ", "ロ"]],
  ["h", ["ホ", "フ"]],
  ["b", ["バ"]],
  ["c", ["ク", "カ"]],
  ["k", ["ク", "カ"]],
  ["g", ["グ", "ガ"]],
  ["t", ["ト"]],
  ["n", ["ン", "ナ"]],
  ["m", ["ム", "マ"]],
  ["p", ["プ"]],
];

const CODAS: Array<[string, string[]]> = [
  ["ng", ["ン"]],
  ["nh", ["ン", "ニ"]],
  ["ch", ["ック", "ク"]],
  ["c", ["ック", "ク"]],
  ["t", ["ット", "ト"]],
  ["p", ["ップ", "プ"]],
  ["n", ["ン"]],
  ["m", ["ム", "ン"]],
];

const NUCLEI: Array<[string, string[]]> = [
  // hardest rimes first
  ["uyê", ["ウエ", "ウィエ", "ユエ"]],
  ["uyê", ["ウエ", "ウィエ", "ユエ"]],
  ["uy", ["ウイ", "ウィ", "ユイ"]],
  ["ươ", ["ウォ", "ウオ", "ウー"]],
  ["uô", ["ウォ", "ウオ"]],
  ["iê", ["イエ", "イェ"]],
  ["yê", ["イエ", "イェ"]],
  ["ia", ["イア", "ヤ"]],
  ["ya", ["ヤ"]],
  ["ưa", ["ウア", "ユーア"]],
  ["uơ", ["ウォ", "ウオ"]],
  ["oe", ["オエ", "ウェ"]],
  ["oa", ["オア", "ワ"]],
  ["uê", ["ウエ", "ウェ"]],
  ["ua", ["ウア", "ワ"]],
  ["uo", ["ウォ", "ウオ"]],
  ["ươ", ["ウォ", "ウオ"]],
  ["ươ", ["ウォ", "ウオ"]],
  ["au", ["アウ"]],
  ["ao", ["アオ"]],
  ["ai", ["アイ"]],
  ["ay", ["アイ"]],
  ["oi", ["オイ"]],
  ["ui", ["ウイ"]],
  ["iu", ["イウ"]],
  ["ia", ["イア"]],
  ["a", ["ア", "アー"]],
  ["ă", ["ア"]],
  ["â", ["ア", "アー"]],
  ["e", ["エ", "エー"]],
  ["ê", ["エ", "エー"]],
  ["i", ["イ", "イー"]],
  ["o", ["オ", "オー"]],
  ["ô", ["オ", "オー"]],
  ["ơ", ["オ", "オー"]],
  ["u", ["ウ", "ウー"]],
  ["ư", ["ウ", "ユー", "ウー"]],
  ["y", ["イ", "イー"]],
];

function matchLongest<T>(s: string, table: Array<[string, T]>): [string, T] | null {
  for (const [k, v] of table) {
    if (k && s.startsWith(k)) return [k, v];
  }
  return null;
}

function pickRaKana(restRoman: string): string {
  const r = (restRoman || "").toLowerCase();

  if (r.startsWith("a") || r.startsWith("ă") || r.startsWith("â") || r.startsWith("oa") || r.startsWith("oe")) return "ラ";
  if (r.startsWith("i") || r.startsWith("y") || r.startsWith("ia") || r.startsWith("ya") || r.startsWith("iê") || r.startsWith("yê") || r.startsWith("uy") || r.startsWith("uyê")) return "リ";
  if (r.startsWith("e") || r.startsWith("ê")) return "レ";
  if (r.startsWith("o") || r.startsWith("ô") || r.startsWith("ơ") || r.startsWith("uô") || r.startsWith("ươ")) return "ロ";
  return "ル"; // u/ư/ua/ưa... => ル
}


function lookupRule(tokenNoToneLower: string): string[] | null {
  const hit = RULES.find((r) => r.vi === tokenNoToneLower);
  return hit ? hit.kana : null;
}

//
function pickRaRowByVowel(restShaped: string): string[] {
  // restShaped là phần NUCLEUS sau khi đã cắt onset/coda, ví dụ:
  // lan -> "a", linh -> "i", long -> "o", luu -> "u"/"uu" (tùy shaped)
  const r = (restShaped || "").toLowerCase();

  // Ưu tiên hàng theo nguyên âm đầu của nucleus
  // a/ă/â => ラ
  if (r.startsWith("a") || r.startsWith("ă") || r.startsWith("â") || r.startsWith("oa") || r.startsWith("oe")) {
    return ["ラ", "リ", "ル", "レ", "ロ"];
  }

  // i/y/ia/iê/uy... => リ
  if (
    r.startsWith("i") || r.startsWith("y") ||
    r.startsWith("ia") || r.startsWith("ya") ||
    r.startsWith("iê") || r.startsWith("yê") ||
    r.startsWith("uy") || r.startsWith("uyê")
  ) {
    return ["リ", "ラ", "ル", "レ", "ロ"];
  }

  // e/ê => レ
  if (r.startsWith("e") || r.startsWith("ê")) {
    return ["レ", "リ", "ラ", "ル", "ロ"];
  }

  // o/ô/ơ/uô/ươ => ロ
  if (
    r.startsWith("o") || r.startsWith("ô") || r.startsWith("ơ") ||
    r.startsWith("uô") || r.startsWith("ươ")
  ) {
    return ["ロ", "ル", "ラ", "リ", "レ"];
  }

  // u/ư/ua/ưa... => ル
  return ["ル", "ラ", "リ", "レ", "ロ"];
}


/**
 * Convert ONE Vietnamese token (usually one syllable in names) into multiple Katakana candidates.
 * - Uses explicit RULES first (house style / common names).
 * - Otherwise uses phonology-ish fallback that handles difficult rimes/codas.
 */
function viTokenToKanaCandidates(tokenOriginal: string, preset: Preset): { alts: string[]; breakdown: Breakdown } {
  const shaped = removeToneMarksOnlyVi(tokenOriginal).toLowerCase().replace(/\s+/g, "");
  const noTone = removeTonesVi(tokenOriginal).toLowerCase().replace(/\s+/g, "");

  // Explicit dictionary rule wins
  const fromRule = lookupRule(noTone);
  if (fromRule) {
    return {
      alts: fromRule,
      breakdown: { syllable: noTone, chosen: fromRule[0], alts: fromRule }
    };
  }

  // Parse onset
  let onset = "";
  let rest = shaped;
  for (const [k] of ONSETS) {
    if (k && rest.startsWith(k)) {
      onset = k;
      rest = rest.slice(k.length);
      break;
    }
  }

  // Parse coda (from rest)
  let coda = "";
  for (const [k] of CODAS) {
    if (k && rest.endsWith(k)) {
      coda = k;
      rest = rest.slice(0, rest.length - k.length);
      break;
    }
  }

  // Nucleus (rest). Match known nuclei patterns; else, degrade by per-letter mapping.
  let nucleusAlts: string[] = [];
  const nucHit = matchLongest(rest, NUCLEI);
  if (nucHit) {
    const [nucKey, kana] = nucHit;
    // If rest has extra after nucleus (rare), keep mapping char-by-char
    const tail = rest.slice(nucKey.length);
    if (tail) {
      const tailMapped = tail.split("").map((ch) => (matchLongest(ch, NUCLEI)?.[1] as any)?.[0] ?? ""); // best effort
      nucleusAlts = (kana as string[]).map((k0) => k0 + tailMapped.join(""));
    } else {
      nucleusAlts = kana as string[];
    }
  } else {
    // char-by-char fallback using NUCLEI single letters
    nucleusAlts = [rest.split("").map((ch) => (matchLongest(ch, NUCLEI)?.[1] as any)?.[0] ?? "").join("")].filter(Boolean);
  }
  if (!nucleusAlts.length) nucleusAlts = [""];

  // onset candidates
  /*const onsetAlts = onset
    ? (ONSETS.find(([k]) => k === onset)?.[1] ?? [""])
    : [""];*/ 

   // onset candidates
let onsetAlts = onset ? (ONSETS.find(([k]) => k === onset)?.[1] ?? [""]) : [""];

// FIX CHUNG: L/R phải theo nguyên âm của nucleus để tránh ルアン, リュアン...
if (onset === "l" || onset === "r") {
  onsetAlts = pickRaRowByVowel(rest);
}


  // coda candidates
  const codaAlts = coda ? (CODAS.find(([k]) => k === coda)?.[1] ?? [""]) : [""];

  // combine with mild heuristics
  /*const combined: string[] = [];
  for (const o of onsetAlts) {
    for (const n of nucleusAlts) {
      for (const c of codaAlts) {
        const out = (o + n + c).replace(/ーー+/g, "ー");
        if (out) combined.push(out);
      }
    }
  }*/


  const combined: string[] = [];

//  SPECIAL: onset l/r => dùng luôn ラ/リ/ル/レ/ロ và KHÔNG cộng nucleus "ア" nữa
if (onset === "l" || onset === "r") {
  const ra = pickRaKana(rest); // rest lúc này là phần nucleus roman sau khi cắt onset/coda

  for (const c of codaAlts) {
    const out = (ra + c).replace(/ーー+/g, "ー");
    if (out) combined.push(out);
  }
} else {
  // default combine
  for (const o of onsetAlts) {
    for (const n of nucleusAlts) {
      for (const c of codaAlts) {
        const out = (o + n + c).replace(/ーー+/g, "ー");
        if (out) combined.push(out);
      }
    }
  }
}


  // preset tuning: hồ sơ ưu tiên ngắn/ổn định; gần âm Việt thì giữ nhiều biến thể hơn
  let uniqCombined = uniq(combined);
  if (preset === "hoso") {
    uniqCombined = uniqCombined.sort((a, b) => a.length - b.length).slice(0, 4);
  } else if (preset === "tunenhat") {
    uniqCombined = uniqCombined.slice(0, 6);
  } else {
    uniqCombined = uniqCombined.slice(0, 8);
  }

  return {
    alts: uniqCombined.length ? uniqCombined : [noTone],
    breakdown: { syllable: noTone, chosen: (uniqCombined[0] ?? noTone), alts: uniqCombined.length ? uniqCombined : [noTone] }
  };
}

export function generateNBestVi2Ja(fullName: string, preset: Preset, nBest: number) {
  const tokens = splitWords(fullName);

  // For breakdown we store tone-removed tokens; for generation we use original tokens to keep vowel shapes.
  const lattice: TokenAlt[] = tokens.map((tok) => {
    const { alts } = viTokenToKanaCandidates(tok, preset);
    return { token: removeTonesVi(tok).toLowerCase(), alts };
  });

  type BeamItem = { s: string[]; score: number; breakdown: Breakdown[] };
  let beam: BeamItem[] = [{ s: [], score: 0, breakdown: [] }];
  const beamWidth = Math.max(120, nBest * 16);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const tokenNoTone = removeTonesVi(tok).toLowerCase();
    const { alts, breakdown } = viTokenToKanaCandidates(tok, preset);

    const next: BeamItem[] = [];
    for (const b of beam) {
      for (let k = 0; k < alts.length; k++) {
        const chosen = alts[k];
        // heuristic: prefer earlier alts; prefer moderate length
        const heur = (k === 0 ? 0 : -0.12) + (chosen.length > 10 ? -0.08 : 0) + (chosen.length <= 2 ? -0.04 : 0);
        next.push({
          s: [...b.s, chosen],
          score: b.score + heur,
          breakdown: [...b.breakdown, { ...breakdown, syllable: tokenNoTone, chosen, alts }]
        });
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, beamWidth);
  }

  const paths = beam
    .slice(0, nBest * 5)
    .map((b) => ({ text: b.s.join("・"), breakdown: b.breakdown }));

  return { normalizedTokens: tokens, lattice, paths };
}
