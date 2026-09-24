// Zero-width characters, bidi controls, and Unicode tag characters. Kept as
// numeric ranges so formatters cannot rewrite them into literal characters.
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00ad, 0x00ad],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
  [0xe0000, 0xe007f],
];

/**
 * Make untrusted text safe to print on one line: control characters become
 * spaces and invisible characters are shown as `<U+XXXX>`.
 */
export function toSafeText(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (isControlCode(code)) {
      out += ' ';
    } else if (
      INVISIBLE_RANGES.some(([start, end]) => code >= start && code <= end)
    ) {
      out += `<U+${code.toString(16).toUpperCase().padStart(4, '0')}>`;
    } else {
      out += char;
    }
  }
  return out;
}

// All C0/C1 control characters. File names and messages from the audited
// repository could otherwise carry terminal escape sequences or line breaks.
function isControlCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/** Escape untrusted text for Markdown prose and table cells. */
export function escapeMarkdown(value: string): string {
  return toSafeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|');
}

/** Inline code whose fence is longer than any backtick run in the value. */
export function codeSpan(value: string): string {
  const text = toSafeText(value);
  const longestRun = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = '`'.repeat(longestRun + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}
