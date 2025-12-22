import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ConvertRequest, Preset } from "@/lib/types";
import { normalizeText, removeTonesVi } from "@/lib/util";
import { generateNBestVi2Ja } from "@/lib/candidates_vi2ja";
import { generateNBestJa2Vi } from "@/lib/candidates_ja2vi";
import { encodeSSE } from "@/lib/streaming";
import { getPreferred } from "@/lib/glossary";

export const runtime = "nodejs";

// This endpoint streams results using Server-Sent Events (SSE).
// Client should use fetch() and read response.body as a stream.

export async function POST(req: Request) {
  const body = (await req.json()) as ConvertRequest;
  const original = normalizeText(body.input || "");
  const preset = body.preset;
  const direction = body.direction;
  const nBest = Math.max(3, Math.min(30, Number(body.nBest) || 10));

  if (!original) {
    return new Response(encodeSSE("error", { message: "Input rỗng." }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    });
  }

  const normalized =
    direction === "vi2ja"
      ? removeTonesVi(original).toLowerCase().replace(/\s+/g, " ").trim()
      : original.replace(/\s+/g, " ").trim();

  const preferred = getPreferred(normalized, preset, direction);

  /*const gen = direction === "vi2ja"
    ? generateNBestVi2Ja(original, preset, nBest)
    : generateNBestJa2Vi(original, preset, nBest);

  const unique = Array.from(new Map(gen.paths.map((p: any) => [p.text, p])).values());*/
  let gen: any;
try {
  gen = direction === "vi2ja"
    ? generateNBestVi2Ja(original, preset, nBest)
    : generateNBestJa2Vi(original, preset, nBest);
} catch (e: any) {
  return new Response(encodeSSE("error", {
    message: `Generate candidates failed: ${e?.message ?? String(e)}`
  }), {
    status: 500,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" }
  });
}

// validate để tránh crash
if (!gen || !Array.isArray(gen.paths)) {
  return new Response(encodeSSE("error", {
    message: "Generate candidates failed: gen.paths is missing"
  }), {
    status: 500,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" }
  });
}

const unique = Array.from(new Map(gen.paths.map((p: any) => [p.text, p])).values());



  let candidates = unique;
  if (preferred) {
    const found = candidates.find((c: any) => c.text === preferred);
    if (found) candidates = [found, ...candidates.filter((c: any) => c.text !== preferred)];
    else candidates = [{ text: preferred, breakdown: [] as any }, ...candidates];
  }
  const candidateList = candidates.slice(0, Math.max(24, nBest * 2));

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(encodeSSE("error", { message: "Thiếu OPENAI_API_KEY." }), {
      status: 500,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    });
  }

  const prompt = `
Bạn là chuyên gia phiên âm phục vụ dịch thuật/hồ sơ Nhật.
CHỈ xếp hạng và giải thích các phương án có sẵn, KHÔNG tự tạo phương án mới.
Hãy xuất theo dạng NDJSON (mỗi dòng 1 JSON), để streaming parse được:

Mỗi dòng: {"text":"...","score":0-100,"explain":"..."}
Dòng cuối: {"done":true}

Direction: ${direction}
Preset: ${preset}
Input gốc: ${original}
Input chuẩn hoá: ${normalized}

Candidates:
${candidateList.map((c: any, i: number) => `${i + 1}. ${c.text}`).join("\n")}
`.trim();

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(encodeSSE("meta", { original, normalized, preset, direction })));
      //Show status
      controller.enqueue(encoder.encode(encodeSSE("status", {
      phase: "candidates",
      message: "Đang tạo candidates..."
      })));

      controller.enqueue(encoder.encode(encodeSSE("candidates", candidateList.map((c: any) => ({ text: c.text, breakdown: c.breakdown })))));
      //Show status
      controller.enqueue(encoder.encode(encodeSSE("status", {
      phase: "ai_request",
      message: "Đang gửi yêu cầu tới AI để xếp hạng..."
      })));

      // Call OpenAI Responses API with SSE streaming. Docs: stream=true emits SSE. 
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({
          model,
          input: prompt,
          stream: true
        })
      });

      if (!upstream.ok || !upstream.body) {
        controller.enqueue(encoder.encode(encodeSSE("error", { message: `OpenAI upstream error: ${upstream.status}` })));
        controller.close();
        return;
      }
      //Show status
        controller.enqueue(encoder.encode(encodeSSE("status", {
        phase: "ai_stream",
        message: "AI đang xếp hạng (đang nhận dữ liệu)...",
        total: nBest
        })));


      const reader = upstream.body.getReader();
      let buf = "";
      let ndjsonBuf = "";
      const results: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // OpenAI SSE events are separated by double newlines.
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;

              // Most useful events contain a JSON object; we only want text deltas.
              // We'll heuristically extract any field named 'delta' or 'text' inside the event payload.
              // But easiest: forward raw data to client as debug, and also try to extract textual deltas.
              let delta = "";
              try {
                const obj = JSON.parse(data);
                // Try common places for streaming text
                delta =
                  obj?.delta ??
                  obj?.text ??
                  obj?.output_text ??
                  obj?.response?.output_text ??
                  "";
                // Some events: {type:'response.output_text.delta', delta:'...'}
                if (typeof obj?.delta === "string") delta = obj.delta;
                if (obj?.type === "response.output_text.delta" && typeof obj?.delta === "string") delta = obj.delta;
              } catch {
                // ignore
              }
              if (delta) {
                controller.enqueue(encoder.encode(encodeSSE("ai_delta", delta)));
                ndjsonBuf += delta;

                // Parse NDJSON lines as they complete
                let idx;
                while ((idx = ndjsonBuf.indexOf("\n")) >= 0) {
                  const line = ndjsonBuf.slice(0, idx).trim();
                  ndjsonBuf = ndjsonBuf.slice(idx + 1);
                  if (!line) continue;
                  try {
                    const item = JSON.parse(line);
                    if (item?.done) {
                      controller.enqueue(encoder.encode(encodeSSE("done", { ok: true, results })));
                      controller.close();
                      return;
                    }
                    if (typeof item?.text === "string") {
                      results.push(item);
                      controller.enqueue(encoder.encode(encodeSSE("item", item)));

                      //Show status
                      controller.enqueue(encoder.encode(encodeSSE("status", {
                      phase: "ai_progress",
                      message: `AI đang xếp hạng: ${results.length}/${nBest} kết quả`,
                      got: results.length,
                      total: nBest
                      })));
                    }
                  } catch {
                    // if JSON is partial, put back (rare with line buffering)
                  }
                }
              }
            }
          }
        }
      } catch (e: any) {
        controller.enqueue(encoder.encode(encodeSSE("error", { message: e?.message ?? "Streaming error" })));
      }

      // If upstream ended without done, send what we have.
      controller.enqueue(encoder.encode(encodeSSE("done", { ok: true, results })));
      //Show status
      controller.enqueue(encoder.encode(encodeSSE("status", {
      phase: "done",
      message: "Hoàn tất.",
      total: candidateList.length
      })));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
