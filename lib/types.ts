export type Preset = "hoso" | "tunenhat" | "ganamviet";
export type Direction = "vi2ja" | "ja2vi";

export type Breakdown = { syllable: string; chosen: string; alts: string[] };

export type Candidate = {
  text: string;        // result string (Katakana or Vietnamese)
  score: number;       // final score after AI rerank (0-100)
  explain?: string;    // AI explanation
  breakdown?: Breakdown[];
};

export type ConvertRequest = {
  input: string;
  preset: Preset;
  nBest: number;
  direction: Direction;
};

export type ConvertResponse = {
  original: string;
  normalized: string;
  preset: Preset;
  direction: Direction;
  results: Candidate[];
  error?: string;
};

export type SaveChoiceRequest = {
  normalized: string;
  preset: Preset;
  direction: Direction;
  chosen: string;
};
