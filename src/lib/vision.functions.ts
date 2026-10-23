import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeScan, type ScanResult } from "./vision-logic";

const Input = z.object({
  dataUrl: z.string().startsWith("data:").max(12_000_000),
  mimeType: z.string().regex(/^image\/(png|jpe?g|webp)$/),
});

const Schema = z.object({
  summary: z.string(),
  detections: z.array(z.object({
    category: z.enum(["wrapper", "bottle", "expired"]),
    label: z.string(),
    box: z.array(z.number()),
    confidence: z.number(),
  })),
});

const INSTRUCTIONS = `You count used medicine packaging in a photo for a recycling program.
Find every separate item and classify it:
- "wrapper": empty blister pack / foil strip (pills pushed out).
- "bottle": empty pill bottle, jar or vial.
- "expired": a medicine box or strip that still contains medicine (unused / expired).
For each item give box = [ymin, xmin, ymax, xmax] on a 0-1000 scale of the image, a short label (e.g. "Foil strip"), and confidence 0-1.
Count each physical item once. Ignore people, hands, furniture and non-medical objects. If none are visible, return an empty list.
summary: one short sentence, e.g. "10 foil strips and 2 bottles detected".`;

export const scanRecyclingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ result?: ScanResult; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "The photo scanner isn't set up yet." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } = await import("./ai-run-id.server");
    const request = getRequest();
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const base64 = data.dataUrl.slice(data.dataUrl.indexOf(",") + 1);
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", content: [
          { type: "text", text: "Detect and count the medicine packaging in this photo." },
          { type: "file", data: base64, mediaType: data.mimeType },
        ] }],
        output: Output.object({ schema: Schema }),
        maxRetries: 0,
        abortSignal: request.signal,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
      });
      try {
        return { result: normalizeScan(await result.output) };
      } catch (e) {
        if (NoObjectGeneratedError.isInstance(e)) return { error: "We couldn't read that photo. Try a clearer, well-lit picture." };
        throw e;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("Recycling scan failed", status, msg);
      if (status === 402 || /402|credit/i.test(msg)) return { error: "AI credits have run out for this workspace." };
      if (status === 429 || /429/.test(msg)) return { error: "Too many scans right now. Please try again in a minute." };
      if (status === 403) return { error: "The photo scanner isn't available right now." };
      return { error: "We couldn't scan that photo. Please try again." };
    }
  });
