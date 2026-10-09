// Tend never gives medical advice. Every outgoing text goes through checkText() or safe().
// "dose", "doses", "skip" and "treat" are deliberately not banned: the product's own copy uses them.
export const BANNED = ["dosage", "mg", "mcg", "ml", "units", "tablets of", "increase", "decrease", "double", "stop taking", "take more", "take less", "overdose", "diagnose", "diagnosis", "prescribe", "prescription", "cure"];

const RX = new RegExp("\\b(" + BANNED.map((b) => b.replace(/ /g, "\\s+")).join("|") + ")\\b", "i");
// Angle brackets and ASCII control characters.
const BAD_CHARS = new RegExp("[<>\\u0000-\\u001f\\u007f]");
const NAME_OK = new RegExp("^[\\p{L}\\p{N} .'\\-]+$", "u");

export class GuardrailError extends Error {
  constructor(public reason: string) { super(reason); }
}

export function findBanned(text: string): string | null {
  const m = RX.exec(text.normalize("NFKC"));
  return m ? m[1].toLowerCase() : null;
}

/** Returns the text if it is safe, otherwise throws. */
export function checkText(text: string): string {
  const hit = findBanned(text);
  if (hit) throw new GuardrailError(`Tend cannot show advice or dosing text ("${hit}").`);
  return text;
}

/** For outgoing templates: if a string trips the guardrail, fall back to a fixed safe sentence. */
export function safe(text: string, fallback = "Something needs your attention."): string {
  return findBanned(text) ? fallback : text;
}

/** Item names are user input. Letters, digits, spaces and . ' - only, 1..40 chars, no banned words. */
export function validateItemName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 40) return { ok: false, error: "Names must be 1 to 40 characters." };
  if (BAD_CHARS.test(name) || !NAME_OK.test(name)) return { ok: false, error: "Names can use letters, numbers, spaces, . ' and - only." };
  const hit = findBanned(name);
  if (hit) return { ok: false, error: `Names cannot contain advice or dosing words ("${hit}").` };
  return { ok: true, name };
}
