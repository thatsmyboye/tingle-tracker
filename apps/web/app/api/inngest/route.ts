import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { contentProcess } from "@/inngest/functions/content.process";
import { audioAnalyze } from "@/inngest/functions/audio.analyze";
import { catalogRefresh } from "@/inngest/functions/catalog.refresh";

// Allow up to 5 minutes per step invocation so the Fly audio worker step has
// enough time to wake from suspend and complete extraction without being killed
// by Vercel's default timeout.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [contentProcess, audioAnalyze, catalogRefresh],
});
