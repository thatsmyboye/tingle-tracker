import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
// Import Inngest functions here as they are created:
// import { myFunction } from "@/inngest/functions/my.function";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Add functions here
  ],
});
