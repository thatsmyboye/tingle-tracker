// =============================================================================
// Prompt: structured listener-facing taxonomy (dashboard Content Analysis)
// =============================================================================

export interface ContentListenerProfileInput {
  title: string;
  description: string | null;
  transcript: string | null;
  /** Human-readable labels of resolved triggers (canonical taxonomy) */
  resolvedTriggerLabels: string[];
}

export function buildContentListenerProfilePrompt(input: ContentListenerProfileInput): string {
  const triggerBlock =
    input.resolvedTriggerLabels.length > 0
      ? input.resolvedTriggerLabels.map((l) => `- ${l}`).join("\n")
      : "No triggers were classified for this video.";

  return `You are filling a structured listener profile for an ASMR video. Use ONLY evidence from the title, description, and transcript excerpt — do not invent specifics not supported by the text.

## Video
**Title:** ${input.title}
${input.description ? `**Description:** ${input.description.slice(0, 600)}` : ""}
${input.transcript ? `**Transcript excerpt:**\n${input.transcript.slice(0, 2500)}` : "No transcript available — infer conservatively from title/description only."}

## Classified triggers (canonical)
${triggerBlock}

## Output
Return ONLY valid JSON with this exact shape (no markdown):
{
  "style_genre": string[],
  "vocal_style": string[],
  "background_music": "none" | "detected" | "unclear",
  "notes": string
}

Rules:
- style_genre: short phrases a listener might search (e.g. "Roleplay", "Personal attention", "Sleep aid"). Empty array if unknown.
- vocal_style: short phrases (e.g. "Whispered", "Soft-spoken"). Empty array if unknown.
- background_music: "detected" only if music/instrumental bed is clearly implied; "none" if clearly no music or voice-only ASMR; "unclear" otherwise.
- notes: one optional sentence; use "" if nothing to add.
- Arrays: at most 8 items each; each item max 60 characters; no duplicates.`;
}
