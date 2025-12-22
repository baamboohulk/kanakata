/*export function normalizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\s+/g, " ").trim().normalize("NFC");
}*/


export function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, " ").normalize("NFC");
}

/**
 * Remove ONLY tone marks (sắc/huyền/hỏi/ngã/nặng) but keep vowel-shape diacritics
 * (ă â ê ô ơ ư) so we can map difficult rimes like ươ/uyê/iê precisely.
 */
export function removeToneMarksOnlyVi(input: string): string {
  return input
    .normalize("NFD")
    // tone marks: grave, acute, tilde, hook above, dot below
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
    .normalize("NFC");
}

export function removeTonesVi(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}

export function splitWords(input: string): string[] {
  return input.trim().split(/\s+/g).filter(Boolean);
}

export function splitKatakanaTokens(input: string): string[] {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .split(/[・\s]+/g)
    .filter(Boolean);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
