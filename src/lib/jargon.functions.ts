import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeTimeline, type PlainReport } from "./jargon-logic";

const Input = z.object({
  text: z.string().trim().min(3).max(6000),
  language: z.enum(["en", "hi"]).default("en"),
});

const INSTRUCTIONS = `You turn confusing doctor notes, prescriptions and medicine leaflets into instructions a 10-year-old could follow.
Rules:
- Decode every abbreviation (BID, TID, AC, PC, PRN, QHS, PO, OD, SOS, etc.) into everyday words. Never leave jargon in your answer.
- Use short, warm sentences. Say "pill" or "tablet", "by mouth", "before breakfast", etc.
- For each medicine: name (short), plain (1-3 sentences: how much, how often, when, how), asNeeded (true if PRN/SOS), durationText (e.g. "For 7 days", or "" if ongoing/unknown), tips (0-3 short safety tips like "Finish the whole course", "Don't take more than 4 a day").
- timeline: one entry per scheduled dose in a normal day, 24h "HH:MM" times using typical times (breakfast 08:00, lunch 13:00, dinner 20:00, bedtime 22:00; before-food doses 30 minutes earlier). Do NOT add as-needed medicines to the timeline. meal is one of before_food, with_food, after_food, empty_stomach, bedtime, any. amount like "1 tablet". note is a tiny cue like "30 min before breakfast" or "".
- warnings: 0-4 important cautions found in the text (max daily dose, avoid alcohol, don't drive). Never invent medical facts not supported by the text or well-known safety basics.
- summary: one friendly sentence overview.
- If the text is not medical, return empty lists and say so in summary.
- If something is unreadable or unclear, say "ask your pharmacist" instead of guessing.
- Write all text fields in the requested language; keep medicine names as written.`;

const Schema = z.object({
  summary: z.string(),
  medicines: z.array(z.object({ name: z.string(), plain: z.string(), asNeeded: z.boolean(), durationText: z.string(), tips: z.array(z.string()) })),
  timeline: z.array(z.object({
    time: z.string(), medicine: z.string(), amount: z.string(),
    meal: z.enum(["before_food", "with_food", "after_food", "empty_stomach", "bedtime", "any"]), note: z.string(),
  })),
  warnings: z.array(z.string()),
});

export const explainPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ report?: PlainReport; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "The translator isn't set up yet." };
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
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", content: `Language: ${data.language === "hi" ? "Hindi (simple, everyday)" : "English"}\n\nText to explain:\n${data.text}` }],
        output: Output.object({ schema: Schema }),
        maxRetries: 0,
        abortSignal: request.signal,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
      });
      let p: z.infer<typeof Schema>;
      try { p = await result.output; } catch (e) {
        if (NoObjectGeneratedError.isInstance(e)) return { error: "We couldn't explain this. Please try again." };
        throw e;
      }
      return {
        report: {
          summary: p.summary.trim().slice(0, 300),
          medicines: p.medicines.slice(0, 15).map((m) => ({ ...m, tips: m.tips.slice(0, 3) })),
          timeline: normalizeTimeline(p.timeline),
          warnings: p.warnings.slice(0, 4),
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("Explain failed", status, msg);
      if (status === 402) return { error: "AI credits have run out for this workspace." };
      if (status === 429) return { error: "Too many requests right now. Please try again in a minute." };
      if (status === 403) return { error: "The translator isn't available right now." };
      return { error: "We couldn't explain this. Please try again." };
    }
  });
