import OpenAI from "openai";
import type { Direction, Preset } from "./types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function guide(preset: Preset, direction: Direction): string {
  const base =
    preset === "hoso"
      ? "Ưu tiên ổn định, phù hợp hồ sơ/visa; tránh biến thể quá lạ; giải thích ngắn."
      : preset === "tunenhat"
        ? "Ưu tiên tự nhiên theo thói quen người Nhật; giải thích ngắn."
        : "Ưu tiên bám sát âm gốc; giải thích ngắn.";

  const dir = direction === "vi2ja"
    ? "Phiên âm tên tiếng Việt sang Katakana."
    //: "Suy đoán tên tiếng Việt (không dấu) từ Katakana (đa nghĩa) và ưu tiên phương án phổ biến.";
    : "Suy đoán tên tiếng Việt TỰ NHIÊN (CÓ DẤU) từ Katakana. Bắt buộc viết đúng dấu tiếng Việt, đúng chính tả và viết hoa kiểu tên người. Không tạo âm tiết vô nghĩa (ví dụ: 'Hoau,...'). Nếu không chắc, hãy đưa nhiều phương án hợp lệ.";

  return `${dir} ${base}`;
}

export async function rerankWithAI(args: {
  original: string;
  normalized: string;
  preset: Preset;
  direction: Direction;
  candidates: { text: string }[];
  nBest: number;
}): Promise<{ text: string; score: number; explain: string }[]> {
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  const input = `
Bạn là chuyên gia phiên âm phục vụ dịch thuật/hồ sơ Nhật.
Nhiệm vụ: CHỈ xếp hạng và giải thích các phương án có sẵn. KHÔNG tự tạo phương án mới.

Hướng dẫn: ${guide(args.preset, args.direction)}
Input gốc: ${args.original}
Input chuẩn hoá: ${args.normalized}

Candidates (chỉ chọn trong list này):
${args.candidates.map((c, i) => `${i + 1}. ${c.text}`).join("\n")}

Trả JSON:
{"ranked":[{"text":"...","score":0-100,"explain":"..."}, ...]}
Tối đa ${args.nBest} dòng.
`.trim();

  const resp = await client.responses.create({
    model,
    input,
    text: { format: { type: "json_object" } }
  });

  const raw = resp.output_text || "{}";
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { parsed = { ranked: [] }; }
  const ranked = Array.isArray(parsed?.ranked) ? parsed.ranked : [];
  return ranked
    .filter((r: any) => typeof r?.text === "string")
    .map((r: any) => ({
      text: r.text,
      score: typeof r.score === "number" ? r.score : 50,
      explain: typeof r.explain === "string" ? r.explain : ""
    }));
}
