# KanaKata — Việt ↔ Katakana (AI + Rules + Streaming)

## Tính năng
- Việt → Katakana: rules sinh nhiều options + AI xếp hạng/giải thích
- Katakana → Việt: reverse candidates + AI xếp hạng (đa nghĩa)
- Streaming output (SSE): hiển thị kết quả dần khi AI đang sinh (không phải chờ xong mới thấy)

## Streaming output là gì?
Thông thường API sẽ chờ model tạo xong toàn bộ output rồi mới trả 1 lần.
**Streaming** sẽ trả dữ liệu **từng mẩu (chunks)** trong lúc model đang sinh


Ở project này:
- `/api/convert` là kiểu thường (không streaming)
- `/api/convert/stream` là **SSE** (text/event-stream)
  - Server gửi `meta` + `candidates` ngay lập tức
  - Sau đó gọi OpenAI với `stream:true` và **forward** delta về client
  - Model được yêu cầu xuất **NDJSON** nên client có thể nhận từng dòng JSON kết quả

Tham khảo docs streaming của OpenAI: https://platform.openai.com/docs/guides/streaming-responses

## Run local
```bash
npm i
cp .env.example .env.local
# set OPENAI_API_KEY
npm run dev
```

## Deploy (Vercel)
- Import repo
- Set env:
  - OPENAI_API_KEY
  - OPENAI_MODEL (optional)
- Deploy

## Rules
- `lib/rules.ts`: bộ rules dày khởi đầu (họ/tên phổ biến)
- Có thể mở rộng dần.
