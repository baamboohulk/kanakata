"use client";

import React, { useMemo, useState, useEffect } from "react";
import type { Candidate, ConvertResponse, Direction, Preset, SaveChoiceRequest } from "@/lib/types";


const PRESETS: { value: Preset; label: string; desc: string }[] = [
  { value: "hoso", label: "Hồ sơ (ổn định)", desc: "Ưu tiên ổn định, dễ đọc, hợp hồ sơ/visa." },
  { value: "tunenhat", label: "Tự nhiên (như người Nhật)", desc: "Ưu tiên cách viết/đọc tự nhiên hơn." },
  { value: "ganamviet", label: "Gần âm Việt", desc: "Ưu tiên bám sát âm gốc hơn." }
];

export default function Page() {
  const [direction, setDirection] = useState<Direction>("vi2ja");
  const [input, setInput] = useState("");
  const [preset, setPreset] = useState<Preset>("hoso");
  const [nBest, setNBest] = useState(10);
  const [useStreaming, setUseStreaming] = useState(true);
  
   useEffect(() => {
   const v = localStorage.getItem("stream");
   if (v != null) setUseStreaming(v === "1");
  }, []);
  useEffect(() => {
  localStorage.setItem("stream", useStreaming ? "1" : "0");
  }, [useStreaming]);

  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ original: string; normalized: string } | null>(null);
  const [candidates, setCandidates] = useState<Array<{ text: string; breakdown?: any }>>([]);
  const [results, setResults] = useState<Candidate[]>([]);
  const [aiLive, setAiLive] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  //Show status
  const [status, setStatus] = useState<string>("");

  const top = useMemo(() => results?.[0], [results]);
  //
  const [mounted, setMounted] = useState(false);
    useEffect(() => {
    setMounted(true);
  }, []);


  async function runNonStream() {
    setLoading(true);
    setErr(null);
    setMeta(null);
    setResults([]);
    setCandidates([]);
    setAiLive("");
    //Show status
    setStatus("");

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, preset, nBest, direction })
      });
      const json = (await res.json()) as ConvertResponse;
      if (!res.ok) throw new Error(json.error || "Request failed");
      setMeta({ original: json.original, normalized: json.normalized });
      setResults(json.results);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function runStream() {
    setLoading(true);
    setErr(null);
    setMeta(null);
    setResults([]);
    setCandidates([]);
    setAiLive("");
    //Show status
    setStatus("");

    try {
      const res = await fetch("/api/convert/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, preset, nBest, direction })
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        throw new Error(txt || "Streaming failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames separated by double newline
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          let event = "message";
          let dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          const dataStr = dataLines.join("\n");
          if (!dataStr) continue;

          if (event === "error") {
            try {
              const obj = JSON.parse(dataStr);
              throw new Error(obj.message || "Error");
            } catch {
              throw new Error(dataStr);
            }
          }

          if (event === "meta") {
            const obj = JSON.parse(dataStr);
            setMeta({ original: obj.original, normalized: obj.normalized });
          } else if (event === "candidates") {
            setCandidates(JSON.parse(dataStr));
          } else if (event === "ai_delta") {
            // Keep raw stream log bounded so it doesn't grow forever
            setAiLive((prev) => (prev + dataStr).slice(-10000));
          } else if (event === "item") {
            const item = JSON.parse(dataStr);
            setResults((prev) => {
              const merged = [...prev, { text: item.text, score: item.score ?? 50, explain: item.explain ?? "" }];
              merged.sort((a, b) => b.score - a.score);
              return merged.slice(0, nBest);
            });
          } else if (event === "status") {
            try {
              const obj = JSON.parse(dataStr);
              setStatus(obj?.message ?? String(dataStr));
            } catch {
                setStatus(dataStr);
            }
          } else if (event === "done") {
            // nothing to do; UI already updated
            setStatus("Hoàn tất.");
          }
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function run() {
    if (useStreaming) return runStream();
    return runNonStream();
  }

  async function saveChoice(chosen: string) {
    if (!meta?.normalized) return;
    const payload: SaveChoiceRequest = {
      normalized: meta.normalized,
      preset,
      direction,
      chosen
    };
    await fetch("/api/convert", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    run();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">KanaKata — Việt ↔ Katakana</h1>
        <p className="text-sm text-zinc-600">
          Rules tạo nhiều phương án + AI xếp hạng/giải thích. Có streaming để hiện kết quả dần.
        </p>
      </header>

      <section className="rounded-2xl border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`rounded-xl border px-3 py-2 text-sm ${direction === "vi2ja" ? "bg-zinc-900 text-white" : ""}`}
            onClick={() => setDirection("vi2ja")}
          >
            Việt → Katakana
          </button>
          <button
            className={`rounded-xl border px-3 py-2 text-sm ${direction === "ja2vi" ? "bg-zinc-900 text-white" : ""}`}
            onClick={() => setDirection("ja2vi")}
          >
            Katakana → Việt
          </button>

          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useStreaming} onChange={(e) => setUseStreaming(e.target.checked)} />
            Streaming
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">
          {direction === "vi2ja" ? "Nhập tên tiếng Việt" : "Nhập Katakana (dùng ・ hoặc khoảng trắng để tách)"}
        </label>
        <textarea
          className="mt-2 w-full rounded-xl border p-3 text-base outline-none focus:ring-2"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={direction === "vi2ja" ? "Ví dụ: Lưu Thị Lan Hương" : "Ví dụ: グエン・ヴァン・ア"}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Preset</label>
            <select className="mt-2 w-full rounded-xl border p-2" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-600">{PRESETS.find((p) => p.value === preset)?.desc}</p>
          </div>

          <div>
            <label className="text-sm font-medium">Số options</label>
            <input
              type="number"
              className="mt-2 w-full rounded-xl border p-2"
              min={3}
              max={30}
              value={nBest}
              onChange={(e) => setNBest(Math.max(3, Math.min(30, Number(e.target.value) || 10)))}
            />
            <p className="mt-1 text-xs text-zinc-600">3–30 options</p>
          </div>

          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading || !input.trim()}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-white disabled:opacity-60"
            >
              {loading ? "Đang xử lý..." : "Chuyển đổi"}
            </button>
          </div>
              {mounted && loading && (
            <div className="mt-2 text-xs text-zinc-600">
              {status || "Đang xử lý..."}
            </div>
          )}
        </div>
      </section>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {meta && (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-zinc-600">Chuẩn hoá</div>
            <div className="font-medium">{meta.normalized}</div>

            {useStreaming && aiLive && (
              <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-zinc-600">AI streaming (raw)</div>
                  <button
                    className="rounded-lg border px-2 py-1 text-xs"
                    onClick={() => setShowRaw((v) => !v)}
                    type="button"
                  >
                    {showRaw ? "Ẩn" : "Hiện"}
                  </button>
                </div>

                {showRaw && (
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-zinc-700">
                    {aiLive}
                  </pre>
                )}
              </div>
            )}

            {top?.text && (
              <div className="mt-3 rounded-xl bg-zinc-50 p-3">
                <div className="text-sm text-zinc-600">Đề xuất #1</div>
                <div className="mt-1 text-xl font-semibold">{top.text}</div>
                {top.explain && <div className="mt-2 text-sm text-zinc-700">{top.explain}</div>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(top.text)} className="rounded-xl border px-3 py-2 text-sm">Copy</button>
                  <button onClick={() => saveChoice(top.text)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white">Chọn & lưu</button>
                </div>
              </div>
            )}
          </div>

          {candidates.length > 0 && (
            <div className="rounded-2xl border p-4">
              <div className="mb-2 text-sm font-medium">Candidates (rules)</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {candidates.slice(0, 12).map((c, idx) => (
                  <div key={idx} className="rounded-xl border p-3 text-sm">
                    {idx + 1}. {c.text}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-600">Hiện 12 candidates đầu (tổng nhiều hơn).</div>
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-2xl border p-4">
              <div className="mb-2 text-sm font-medium">Kết quả</div>
              <div className="space-y-2">
                {results.map((r, idx) => (
                  <div key={`${r.text}-${idx}`} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-lg font-semibold">
                        {idx + 1}. {r.text}
                        <span className="ml-2 text-xs font-normal text-zinc-500">score: {r.score.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(r.text)}>Copy</button>
                        <button className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white" onClick={() => saveChoice(r.text)}>Chọn</button>
                      </div>
                    </div>
                    {r.explain && <div className="mt-2 text-sm text-zinc-700">{r.explain}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="mt-10 text-xs text-zinc-500">
        Rules: <code className="rounded bg-zinc-100 px-1">lib/rules.ts</code> • Reverse: <code className="rounded bg-zinc-100 px-1">lib/candidates_ja2vi.ts</code>
      </footer>
    </main>
  );
}
