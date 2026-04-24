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

// =============================================================================
// Prompt: Content Narrative Analysis
// Issues a focused second Claude call to produce a human-readable paragraph
// describing the ASMR character of the video — shown on the creator dashboard.
// =============================================================================

export interface ContentNarrativeInput {
  title: string;
  description: string | null;
  transcript: string | null;
  /** Top trigger slugs already resolved by the classification step */
  topTriggerLabels: string[];
}

export function buildContentNarrativePrompt(input: ContentNarrativeInput): string {
  const triggerList =
    input.topTriggerLabels.length > 0
      ? input.topTriggerLabels.map((l) => `- ${l}`).join("\n")
      : "No triggers detected.";

  return `You are writing a short creator insight for an ASMR video dashboard. Your job is to describe what makes this video relaxing or tingle-inducing in 2–4 plain sentences — no fluff, no filler phrases.

## Video Information
**Title:** ${input.title}
${input.description ? `**Description:** ${input.description.slice(0, 400)}` : ""}
${input.transcript ? `**Transcript excerpt:**\n${input.transcript.slice(0, 2500)}` : "No transcript available."}

## Detected ASMR Triggers
${triggerList}

## Instructions
Write 2–4 sentences characterising the ASMR style and likely audience of this video. Focus on:
- The dominant sensory experience (sound textures, pacing, voice style)
- Which moments are most likely to trigger tingles and why
- The overall mood or roleplay scenario if applicable

Do NOT start with "This video…" — vary the opening. Do NOT use bullet points. Write in plain prose, present tense.
Respond with ONLY the paragraph — no labels, headers, or extra text.`;
}
