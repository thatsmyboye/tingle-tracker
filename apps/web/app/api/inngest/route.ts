import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { contentProcess } from "@/inngest/functions/content.process";
import { audioAnalyze } from "@/inngest/functions/audio.analyze";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [contentProcess, audioAnalyze],
});
