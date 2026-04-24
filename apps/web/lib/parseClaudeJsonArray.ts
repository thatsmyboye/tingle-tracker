/**
 * Parse a JSON array from Claude (or similar) model output.
 * Strips optional markdown fences, then tries strict JSON.parse.
 * If that fails (truncated max_tokens, extra prose), extracts complete
 * top-level `{...}` objects from inside the first `[...]` and parses each.
 */

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Find index of closing `}` matching `{` at start, or -1 if unbalanced before end */
function indexOfMatchingBrace(s: string, openIdx: number): number {
  if (s[openIdx] !== "{") return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseObjectsFromArrayPrefix(s: string): unknown[] {
  const start = s.indexOf("[");
  if (start === -1) return [];

  const out: unknown[] = [];
  let i = start + 1;
  while (i < s.length) {
    while (i < s.length && /\s|,/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "]") break;
    if (s[i] !== "{") break;
    const close = indexOfMatchingBrace(s, i);
    if (close === -1) break;
    const slice = s.slice(i, close + 1);
    try {
      out.push(JSON.parse(slice));
    } catch {
      break;
    }
    i = close + 1;
  }
  return out;
}

export function parseClaudeJsonArray(rawText: string): unknown {
  const jsonText = stripCodeFences(rawText);

  try {
    return JSON.parse(jsonText);
  } catch {
    const recovered = parseObjectsFromArrayPrefix(jsonText);
    if (recovered.length > 0) return recovered;
    throw new Error(`Claude returned non-JSON: ${rawText.slice(0, 200)}`);
  }
}
