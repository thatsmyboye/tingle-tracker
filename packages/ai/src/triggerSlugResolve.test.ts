import { describe, expect, it } from "vitest";
import { buildTriggerSlugResolver } from "./triggerSlugResolve";

describe("buildTriggerSlugResolver", () => {
  const tags = [
    {
      id: "tag-1",
      label: "Close-up shots",
      slug: "close-up",
      category: "visual",
      display_group: "sensory",
    },
    {
      id: "tag-2",
      label: "Soft speaking",
      slug: "soft-speaking",
      category: "aural",
      display_group: "vocal_style",
    },
  ];

  const aliases = [
    { alias_slug: "close_up", trigger_tag_id: "tag-1" },
    { alias_slug: "soft_spoken", trigger_tag_id: "tag-2" },
  ];

  it("resolves canonical slugs", () => {
    const resolver = buildTriggerSlugResolver(tags, aliases);
    expect(resolver.resolve("close-up")?.id).toBe("tag-1");
    expect(resolver.resolve("soft-speaking")?.id).toBe("tag-2");
  });

  it("resolves alias slugs", () => {
    const resolver = buildTriggerSlugResolver(tags, aliases);
    expect(resolver.resolve("close_up")?.id).toBe("tag-1");
    expect(resolver.resolve("soft_spoken")?.id).toBe("tag-2");
  });

  it("resolves label-like LLM outputs", () => {
    const resolver = buildTriggerSlugResolver(tags, aliases);
    expect(resolver.resolve("Close-up shots")?.id).toBe("tag-1");
    expect(resolver.resolve("soft speaking")?.id).toBe("tag-2");
  });
});
