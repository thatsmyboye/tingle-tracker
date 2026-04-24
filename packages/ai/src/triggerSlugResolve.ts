// =============================================================================
// Trigger slug normalization + resolution (canonical slug + DB aliases)
// =============================================================================

export interface TriggerTagForResolve {
  id: string;
  label: string;
  slug: string;
  category: string;
  display_group?: string | null;
}

export interface TriggerTagAliasRow {
  alias_slug: string;
  trigger_tag_id: string;
}

/** Normalize a raw LLM slug for lookup: trim, lower, whitespace → hyphen, underscore → hyphen. */
export function normalizeTriggerSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildTriggerSlugResolver(
  tags: TriggerTagForResolve[],
  aliases: TriggerTagAliasRow[]
): {
  resolve: (rawSlug: string) => TriggerTagForResolve | null;
} {
  const byNormSlug = new Map<string, TriggerTagForResolve>();
  for (const t of tags) {
    byNormSlug.set(normalizeTriggerSlug(t.slug), t);
  }

  const aliasNormToTagId = new Map<string, string>();
  for (const a of aliases) {
    aliasNormToTagId.set(normalizeTriggerSlug(a.alias_slug), a.trigger_tag_id);
  }

  const idToTag = new Map(tags.map((t) => [t.id, t]));

  return {
    resolve(rawSlug: string): TriggerTagForResolve | null {
      const n = normalizeTriggerSlug(rawSlug);
      if (!n) return null;
      const direct = byNormSlug.get(n);
      if (direct) return direct;
      const tagId = aliasNormToTagId.get(n);
      if (!tagId) return null;
      return idToTag.get(tagId) ?? null;
    },
  };
}
