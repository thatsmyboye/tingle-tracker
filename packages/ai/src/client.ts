import Anthropic from "@anthropic-ai/sdk";

// =============================================================================
// Model constant — change here only, never hardcode elsewhere
// =============================================================================
export const CLAUDE_MODEL = "claude-sonnet-4-20250514" as const;

// =============================================================================
// Anthropic client factory
// Always call from server-side code only (Inngest functions, API routes).
// Never import this in browser or Expo client code.
// =============================================================================

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable.");
  }

  client = new Anthropic({ apiKey });
  return client;
}
