export function encodeSSE(event: string, data: any): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

// Parse SSE from OpenAI into individual data payload strings.
export function* parseSSEChunks(buffer: string): Generator<{ events: string[]; rest: string }, void, unknown> {
  // not used (kept for future)
}
