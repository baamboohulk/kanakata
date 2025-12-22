import "./globals.css";

export const metadata = {
  title: "KanaKata — Việt ↔ Katakana (AI + Rules + Streaming)",
  description: "Transliteration Việt ↔ Katakana với nhiều options + AI xếp hạng + streaming."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
