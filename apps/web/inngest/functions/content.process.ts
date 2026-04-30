import { z } from "zod";
import { inngest } from "@/inngest/client";
import { getSupabaseServerClient } from "@tingle/database";
import {
  getAnthropicClient,
  CLAUDE_MODEL,
  buildTriggerClassificationPrompt,
  buildContentNarrativePrompt,
  buildContentListenerProfilePrompt,
  buildTriggerSlugResolver,
  normalizeTriggerSlug,
} from "@tingle/ai";
import { fetchYouTubeTimedTranscript, fetchYouTubeTranscript } from "@/lib/youtube";
import type { InsightReport, ListenerProfile, NarrativeInputSource } from "@tingle/types";

// =============================================================================
// content.process
// Triggered by "content/ingested" — runs the full LLM classification pipeline.
// =============================================================================

const EventPayloadSchema = z.object({
  contentId: z.string().uuid(),
  creatorId: z.string().uuid(),
});

/** Shape Claude is expected to return for each trigger match */
const ClaudeMatchSchema = z.array(
  z.object({
    slug: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  })
);

const ClaudeResponseSchema = z.union([
  ClaudeMatchSchema,
  z.object({
    matches: ClaudeMatchSchema,
  }),
]);

const ListenerProfileSchema = z.object({
  style_genre: z.array(z.string()).max(8),
  vocal_style: z.array(z.string()).max(8),
  background_music: z.enum(["none", "detected", "unclear"]),
  notes: z.string().max(400).optional(),
});

const PHRASE_SLUG_HINTS: Array<{ phrase: string; slug: string }> = [
  { phrase: "cranial nerve exam", slug: "cranial-nerve-exam" },
  { phrase: "ear to ear", slug: "binaural" },
  { phrase: "ear-to-ear", slug: "binaural" },
  { phrase: "soft spoken", slug: "soft-speaking" },
  { phrase: "soft-spoken", slug: "soft-speaking" },
  { phrase: "mouth sounds", slug: "mouth-sounds" },
  { phrase: "sticky sounds", slug: "sticky-sounds" },
  { phrase: "hand movements", slug: "hand-movements" },
  { phrase: "hair play", slug: "hair-play" },
  { phrase: "haircut", slug: "haircut" },
  { phrase: "dentist", slug: "dentist" },
  { phrase: "barbershop", slug: "haircut" },
];

function inferPhraseBasedSlugCandidates(input: {
  title: string;
  description: string | null;
  transcript: string | null;
}): string[] {
  const haystack = [input.title, input.description ?? "", input.transcript ?? ""]
    .join(" ")
    .toLowerCase();
  if (!haystack.trim()) return [];
  const candidates = new Set<string>();
  for (const hint of PHRASE_SLUG_HINTS) {
    if (haystack.includes(hint.phrase)) {
      candidates.add(hint.slug);
    }
  }
  return [...candidates];
}

export const contentProcess = inngest.createFunction(
  { id: "content.process", name: "Process Content: Classify Triggers", triggers: [{ event: "content/ingested" }] },
  async ({ event, step }) => {
    const { contentId, creatorId } = EventPayloadSchema.parse(event.data);
    const db = getSupabaseServerClient();

    // ---- 1. Mark as processing -----------------------------------------------
    await step.run("update-status-processing", async () => {
      const [contentRes, insightRes] = await Promise.all([
        db.from("content").update({ status: "processing" }).eq("id", contentId),
        db
          .from("insights_cache")
          .upsert(
            { content_id: contentId, status: "generating", error_message: null },
            { onConflict: "content_id" }
          ),
      ]);
      const { error } = contentRes;
      if (error) throw new Error(`Failed to update content status: ${error.message}`);
      if (insightRes.error) throw new Error(`Failed to set insights status: ${insightRes.error.message}`);
    });

    try {
      // ---- 2. Fetch transcript (best-effort) -----------------------------------
      // Always attempt regardless of transcript_available flag — the Data API
      // misreports auto-generated captions as unavailable.
      const transcript = await step.run("fetch-transcript", async () => {
        const { data: content } = await db
          .from("content")
          .select("youtube_video_id")
          .eq("id", contentId)
          .single();

        if (!content) return null;
        return fetchYouTubeTranscript(content.youtube_video_id);
      });
      const timedTranscript = await step.run("fetch-timed-transcript", async () => {
        const { data: content } = await db
          .from("content")
          .select("youtube_video_id")
          .eq("id", contentId)
          .single();
        if (!content) return null;
        return fetchYouTubeTimedTranscript(content.youtube_video_id);
      });

      // ---- 3. Fetch content row + trigger tags + aliases ---------------------
      const { content, triggerTags, tagAliases } = await step.run("fetch-trigger-tags", async () => {
        const [contentRes, tagsRes, aliasesRes] = await Promise.all([
          db
            .from("content")
            .select("id, title, description")
            .eq("id", contentId)
            .single(),
          db.from("trigger_tags").select("id, label, slug, category, display_group"),
          db.from("trigger_tag_aliases").select("alias_slug, trigger_tag_id"),
        ]);

        if (contentRes.error || !contentRes.data) {
          throw new Error(`Content not found: ${contentRes.error?.message}`);
        }
        if (tagsRes.error) {
          throw new Error(`Failed to fetch trigger tags: ${tagsRes.error.message}`);
        }
        if (aliasesRes.error) {
          throw new Error(`Failed to fetch trigger tag aliases: ${aliasesRes.error.message}`);
        }

        return {
          content: contentRes.data,
          triggerTags: tagsRes.data ?? [],
          tagAliases: aliasesRes.data ?? [],
        };
      });

      const aliasSlugsByTagId: Record<string, string[]> = {};
      for (const row of tagAliases) {
        const norm = normalizeTriggerSlug(row.alias_slug);
        if (!norm) continue;
        const list = aliasSlugsByTagId[row.trigger_tag_id] ?? [];
        list.push(norm);
        aliasSlugsByTagId[row.trigger_tag_id] = list;
      }

      const slugResolver = buildTriggerSlugResolver(triggerTags, tagAliases);

      // ---- 4. Classify with Claude --------------------------------------------
      const claudeMatches = await step.run("classify-with-claude", async () => {
        const prompt = buildTriggerClassificationPrompt({
          title: content.title,
          description: content.description ?? null,
          transcript: transcript ?? null,
          availableTags: triggerTags,
          aliasSlugsByTagId,
        });

        console.log(`[content.process] classifying contentId=${contentId} tags=${triggerTags.length} transcriptChars=${transcript?.length ?? 0}`);
        const anthropic = getAnthropicClient();
        const message = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        const rawText =
          message.content[0]?.type === "text" ? message.content[0].text : "";

        // Strip any accidental markdown fencing
        const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error(`Claude returned non-JSON: ${rawText.slice(0, 200)}`);
        }

        const parsedResponse = ClaudeResponseSchema.parse(parsed);
        return Array.isArray(parsedResponse) ? parsedResponse : parsedResponse.matches;
      });

      // ---- 5. Resolve slugs → tag UUIDs (canonical + aliases) ------------------
      type ResolvedRow = {
        content_id: string;
        trigger_tag_id: string;
        source: "llm";
        confidence: number;
        _label: string;
        _category: "visual" | "aural" | "tactile_adjacent";
        _display_group: string;
        _reasoning: string;
        _timestamps: number[];
      };

      const resolvedTriggers = await step.run("resolve-tag-ids", async () => {
        const mapped = claudeMatches
          .map((match) => {
            const tag = slugResolver.resolve(match.slug);
            if (!tag) return null;
            return {
              content_id: contentId,
              trigger_tag_id: tag.id,
              source: "llm" as const,
              confidence: match.confidence,
              _label: tag.label,
              _category: tag.category as "visual" | "aural" | "tactile_adjacent",
              _display_group: tag.display_group ?? "sensory",
              _reasoning: match.reasoning,
              _timestamps: inferTimestampsFromTimedTranscript(timedTranscript, tag.label, tag.slug),
            };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        const byTag = new Map<string, ResolvedRow>();
        for (const row of mapped) {
          const prev = byTag.get(row.trigger_tag_id);
          if (!prev || row.confidence > prev.confidence) {
            byTag.set(row.trigger_tag_id, row);
          }
        }
        return [...byTag.values()];
      });

      const unresolvedMatches = claudeMatches.filter((match) => slugResolver.resolve(match.slug) === null);
      let phraseFallbackResolved = 0;
      if (unresolvedMatches.length > 0) {
        const phraseCandidates = inferPhraseBasedSlugCandidates({
          title: content.title,
          description: content.description ?? null,
          transcript: transcript ?? null,
        });
        for (const slug of phraseCandidates) {
          const tag = slugResolver.resolve(slug);
          if (!tag) continue;
          const exists = resolvedTriggers.some((row) => row.trigger_tag_id === tag.id);
          if (exists) continue;
          resolvedTriggers.push({
            content_id: contentId,
            trigger_tag_id: tag.id,
            source: "llm",
            confidence: 0.45,
            _label: tag.label,
            _category: tag.category as "visual" | "aural" | "tactile_adjacent",
            _display_group: tag.display_group ?? "sensory",
            _reasoning: `Phrase fallback match from metadata/transcript for "${slug}".`,
            _timestamps: inferTimestampsFromTimedTranscript(timedTranscript, tag.label, tag.slug),
          });
          phraseFallbackResolved += 1;
        }
      }
      if (unresolvedMatches.length > 0) {
        console.warn(
          `[content.process] unresolved slugs for contentId=${contentId}: ${unresolvedMatches
            .map((m) => m.slug)
            .join(", ")}`
        );
      }

      // ---- 6. Upsert content_triggers ----------------------------------------
      await step.run("upsert-content-triggers", async () => {
        if (resolvedTriggers.length === 0) return;

        const rows = resolvedTriggers.map(
          ({ _label: _l, _category: _c, _display_group: _d, _reasoning: _r, _timestamps: _t, ...row }) => row
        );

        const { error } = await db
          .from("content_triggers")
          .upsert(rows, { onConflict: "content_id,trigger_tag_id" });

        if (error) throw new Error(`Failed to upsert content_triggers: ${error.message}`);
      });

      await step.run("upsert-trigger-moments", async () => {
        if (resolvedTriggers.length === 0) return;
        const rows = resolvedTriggers.flatMap((trigger) =>
          trigger._timestamps.map((timestamp) => ({
            content_id: contentId,
            trigger_tag_id: trigger.trigger_tag_id,
            timestamp_ms: Math.max(0, timestamp - 5000),
            confidence: trigger.confidence,
            source: "llm" as const,
          }))
        );
        if (rows.length === 0) return;
        const { error } = await db
          .from("content_trigger_moments")
          .upsert(rows, {
            onConflict: "content_id,trigger_tag_id,timestamp_ms",
          });
        if (error) throw new Error(`Failed to upsert content_trigger_moments: ${error.message}`);
      });

      // ---- 7. Generate Claude narrative paragraph ----------------------------
      const narrativeText = await step.run("generate-narrative", async () => {
        const topLabels = resolvedTriggers
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5)
          .map((t) => t._label);

        const prompt = buildContentNarrativePrompt({
          title: content.title,
          description: content.description ?? null,
          transcript: transcript ?? null,
          topTriggerLabels: topLabels,
        });

        const anthropic = getAnthropicClient();
        const message = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          message.content[0]?.type === "text" ? message.content[0].text.trim() : null;
        return text;
      });

      const listenerProfile = await step.run("generate-listener-profile", async () => {
        const labels = resolvedTriggers
          .sort((a, b) => b.confidence - a.confidence)
          .map((t) => t._label);

        const prompt = buildContentListenerProfilePrompt({
          title: content.title,
          description: content.description ?? null,
          transcript: transcript ?? null,
          resolvedTriggerLabels: labels,
        });

        const anthropic = getAnthropicClient();
        const message = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });

        const rawText =
          message.content[0]?.type === "text" ? message.content[0].text : "";
        const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          console.warn(
            `[content.process] listener profile non-JSON for contentId=${contentId}: ${rawText.slice(0, 120)}`
          );
          return null;
        }

        const parsedProfile = ListenerProfileSchema.safeParse(parsed);
        if (!parsedProfile.success) {
          console.warn(`[content.process] listener profile schema fail contentId=${contentId}`);
          return null;
        }

        const p = parsedProfile.data;
        const profile: ListenerProfile = {
          style_genre: [...new Set(p.style_genre.map((s) => s.trim()).filter(Boolean))].slice(0, 8),
          vocal_style: [...new Set(p.vocal_style.map((s) => s.trim()).filter(Boolean))].slice(0, 8),
          background_music: p.background_music,
          notes: p.notes?.trim() || undefined,
        };
        return profile;
      });

      // ---- 8. Write insights_cache -------------------------------------------
      await step.run("cache-insights", async () => {
        const sortedTriggers = resolvedTriggers.sort((a, b) => b.confidence - a.confidence);
        const narrativeInputSource: NarrativeInputSource = transcript ? "transcript" : "title_description_only";

        const unresolvedUnique = Array.from(new Set(unresolvedMatches.map((m) => normalizeTriggerSlug(m.slug))));
        const lowConfidenceCount = resolvedTriggers.filter((row) => row.confidence < 0.5).length;
        const report: InsightReport = {
          generated_at: new Date().toISOString(),
          content_id: contentId,
          summary: `Identified ${resolvedTriggers.length} ASMR trigger${resolvedTriggers.length !== 1 ? "s" : ""} in this video.`,
          transcript_analysis: narrativeText ?? undefined,
          narrative_input_source: narrativeInputSource,
          listener_profile: listenerProfile ?? undefined,
          top_triggers: sortedTriggers
            .slice(0, 10)
            .map((t) => ({
              trigger_tag_id: t.trigger_tag_id,
              label: t._label,
              category: t._category,
              display_group: t._display_group,
              confidence: t.confidence,
              timestamp_examples_ms: t._timestamps.slice(0, 5).map((ts) => Math.max(0, ts - 5000)),
            })),
          heatmap_highlights: [],
          tagging_health: {
            candidate_count: claudeMatches.length,
            resolved_count: resolvedTriggers.length,
            unresolved_count: unresolvedMatches.length,
            unresolved_unique_slugs: unresolvedUnique.slice(0, 25),
            low_confidence_count: lowConfidenceCount,
            phrase_fallback_resolved_count: phraseFallbackResolved,
          },
        };

        const { error } = await db
          .from("insights_cache")
          .upsert(
            {
              content_id: contentId,
              status: "ready",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InsightReport lacks Supabase Json index signature
              report: report as any,
              generated_at: report.generated_at,
              error_message:
                resolvedTriggers.length === 0 && unresolvedMatches.length > 0
                  ? `Claude returned ${unresolvedMatches.length} trigger slug(s) not found in trigger_tags.`
                  : null,
            },
            { onConflict: "content_id" }
          );

        if (error) throw new Error(`Failed to write insights_cache: ${error.message}`);
      });

      // ---- 9. Mark content ready ---------------------------------------------
      await step.run("mark-ready", async () => {
        const { error } = await db
          .from("content")
          .update({ status: "ready" })
          .eq("id", contentId);
        if (error) throw new Error(`Failed to mark content ready: ${error.message}`);
      });

      return { contentId, creatorId, triggersFound: resolvedTriggers.length };
    } catch (err) {
      // On any unrecoverable error: mark content + insights_cache as error
      const message = err instanceof Error ? err.message : String(err);
      await Promise.allSettled([
        db.from("content").update({ status: "error" }).eq("id", contentId),
        db
          .from("insights_cache")
          .upsert(
            { content_id: contentId, status: "error", error_message: message },
            { onConflict: "content_id" }
          ),
      ]);
      throw err; // re-throw so Inngest marks the run as failed
    }
  }
);

function inferTimestampsFromTimedTranscript(
  timedTranscript: Array<{ text: string; start_ms: number }> | null,
  label: string,
  slug: string
): number[] {
  if (!timedTranscript || timedTranscript.length === 0) return [];
  const labelNeedles = label
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const slugNeedles = slug
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const needles = new Set([...labelNeedles, ...slugNeedles]);
  if (needles.size === 0) return [];
  const hits = timedTranscript
    .filter((segment) => {
      const lower = segment.text.toLowerCase();
      return [...needles].some((needle) => lower.includes(needle));
    })
    .slice(0, 5)
    .map((segment) => segment.start_ms);
  return Array.from(new Set(hits));
}
