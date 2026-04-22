import type { TriggerTag } from "@tingle/types";

// =============================================================================
// Prompt: Trigger Classification
// Used by the llm-pipeline Inngest job to classify content triggers
// =============================================================================

export interface TriggerClassificationInput {
  title: string;
  description: string | null;
  transcript: string | null;
  availableTags: Pick<TriggerTag, "id" | "label" | "slug" | "category">[];
}

export function buildTriggerClassificationPrompt(input: TriggerClassificationInput): string {
  const tagList = input.availableTags
    .map((t) => `- ${t.slug} (${t.category}): ${t.label}`)
    .join("\n");

  return `You are analyzing an ASMR video to identify which trigger types are present.

## Video Information
**Title:** ${input.title}
${input.description ? `**Description:** ${input.description}` : ""}
${input.transcript ? `**Transcript excerpt:**\n${input.transcript.slice(0, 3000)}` : "No transcript available."}

## Available Trigger Tags
${tagList}

## Instructions
Return a JSON array of trigger matches. For each trigger present in the video, include:
- \`slug\`: the trigger tag slug from the list above
- \`confidence\`: a number from 0.0 to 1.0 indicating how confident you are
- \`reasoning\`: one sentence explaining why this trigger is present

Only include triggers you are reasonably confident about (confidence >= 0.4).
Order results by confidence descending.
Use ONLY slugs that appear in the list above — do not invent or guess slugs.

Respond with ONLY valid JSON, no markdown or explanation outside the array.

Example format:
[
  { "slug": "whispering", "confidence": 0.95, "reasoning": "Creator speaks in a soft whisper throughout." },
  { "slug": "tapping", "confidence": 0.7, "reasoning": "Audible tapping on wooden surfaces in the second half." }
]`;
}
