import { NextResponse } from "next/server";
import type { ConvertRequest, ConvertResponse, SaveChoiceRequest } from "@/lib/types";
import { normalizeText, removeTonesVi } from "@/lib/util";
import { generateNBestVi2Ja } from "@/lib/candidates_vi2ja";
import { generateNBestJa2Vi } from "@/lib/candidates_ja2vi";
import { rerankWithAI } from "@/lib/ai";
import { getPreferred, putPreferred } from "@/lib/glossary";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ConvertRequest;
    const original = normalizeText(body.input || "");
    const preset = body.preset;
    const direction = body.direction;
    const nBest = Math.max(3, Math.min(30, Number(body.nBest) || 10));

    /*if (!original) {
      return NextResponse.json({ error: "Input rỗng." } satisfies ConvertResponse, { status: 400 });
    }*/

    if (!original) {
  return NextResponse.json(
    {
      original: "",
      normalized: "",
      preset,
      direction,
      results: [],
      error: "Input rỗng."
    } satisfies ConvertResponse,
    { status: 400 }
  );
}


    const normalized =
      direction === "vi2ja"
        ? removeTonesVi(original).toLowerCase().replace(/\s+/g, " ").trim()
        : original.replace(/\s+/g, " ").trim();

    const preferred = getPreferred(normalized, preset, direction);

    const gen = direction === "vi2ja"
      ? generateNBestVi2Ja(original, preset, nBest)
      : generateNBestJa2Vi(original, preset, nBest);

    const unique = Array.from(new Map(gen.paths.map((p: any) => [p.text, p])).values());

    let candidates = unique;
    if (preferred) {
      const found = candidates.find((c: any) => c.text === preferred);
      if (found) candidates = [found, ...candidates.filter((c: any) => c.text !== preferred)];
      else candidates = [{ text: preferred, breakdown: [] as any }, ...candidates];
    }

    const aiRanked = await rerankWithAI({
      original,
      normalized,
      preset,
      direction,
      candidates: candidates.slice(0, Math.max(24, nBest * 2)).map((c: any) => ({ text: c.text })),
      nBest
    });

    const scoreMap = new Map(aiRanked.map((r) => [r.text, r]));
    const results = candidates
      .slice(0, Math.max(40, nBest * 4))
      .map((c: any) => {
        const hit = scoreMap.get(c.text);
        return {
          text: c.text,
          score: hit?.score ?? 50,
          explain: hit?.explain ?? "",
          breakdown: c.breakdown
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, nBest);

    const out: ConvertResponse = { original, normalized, preset, direction, results };
    return NextResponse.json(out);
  /*} catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" } satisfies ConvertResponse,
      { status: 500 }
    );
  }*/
  
  } catch (e: any) {
  return NextResponse.json(
    {
      original: "",
      normalized: "",
      preset: "hoso",
      direction: "vi2ja",
      results: [],
      error: e?.message ?? "Server error"
    } satisfies ConvertResponse,
    { status: 500 }
  );
}




}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as SaveChoiceRequest;
    const normalized = normalizeText(body.normalized || "").toLowerCase();
    if (!normalized || !body.chosen) {
      return NextResponse.json({ ok: false, error: "Thiếu dữ liệu." }, { status: 400 });
    }
    putPreferred(normalized, body.preset, body.direction, body.chosen);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    /*return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });*/

    return NextResponse.json(
  {
    original: "",
    normalized: "",
    preset: "hoso",
    direction: "vi2ja",
    results: [],
    error: e?.message ?? "Server error"
  } satisfies ConvertResponse,
  { status: 500 }
);


  }
}
