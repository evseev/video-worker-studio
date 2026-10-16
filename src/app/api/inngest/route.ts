import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateVideo } from "@/lib/inngest/functions";
import { autopilotFunctions } from "@/lib/inngest/autopilot-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateVideo, ...autopilotFunctions],
});
