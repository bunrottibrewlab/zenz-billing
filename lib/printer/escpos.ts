// ESC/POS command constants for thermal receipt printers
export const ESC = "\x1B";
export const GS  = "\x1D";

export const INIT         = ESC + "@";            // Reset printer
export const LF           = "\x0A";               // Line feed
export const ALIGN_LEFT   = ESC + "a\x00";
export const ALIGN_CENTER = ESC + "a\x01";
export const ALIGN_RIGHT  = ESC + "a\x02";
export const BOLD_ON      = ESC + "E\x01";
export const BOLD_OFF     = ESC + "E\x00";
export const UNDERLINE_ON = ESC + "-\x01";
export const UNDERLINE_OFF= ESC + "-\x00";

// Text size (GS ! n): high nibble = width mult-1, low nibble = height mult-1
export const TEXT_NORMAL       = GS + "!\x00";     // 1×1
export const TEXT_DOUBLE_HEIGHT= GS + "!\x01";     // 1×2
export const TEXT_DOUBLE_WIDTH = GS + "!\x10";     // 2×1
export const TEXT_DOUBLE       = GS + "!\x11";     // 2×2

// Paper cut
export const CUT_PARTIAL  = GS + "V\x01";          // Partial cut (leaves 1 point)
export const CUT_FULL     = GS + "V\x00";          // Full cut

/** Feed n lines then partial cut */
export function feedAndCut(lines = 4, fullCut = false): string {
  return ESC + "d" + String.fromCharCode(lines) + (fullCut ? CUT_FULL : CUT_PARTIAL);
}

// ── Text layout helpers ─────────────────────────────────────────────────────

/** Pad / truncate a string to exactly `n` characters. */
export function padRight(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n, " ");
}

/** Right-align a string in a field of `n` characters. */
export function padLeft(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s.padStart(n, " ");
}

/** Center a string in a field of `n` characters. */
export function center(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  const pad = Math.floor((n - s.length) / 2);
  return " ".repeat(pad) + s + " ".repeat(n - pad - s.length);
}

/** Two-column row: label on left, value on right, total width `n`. */
export function twoCol(left: string, right: string, n: number): string {
  const available = n - right.length;
  return padRight(left, available) + right;
}

/** Separator line of `char` repeated `n` times. */
export function sep(n: number, char = "─"): string {
  return char.repeat(n);
}
