import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeWarnings, shieldLevel, type SafetyReport } from "./safety-logic";

const Med = z.object({
  name: z.string().trim().min(1).max(120),
  strength: z.string().max(60).optional(),
  dose: z.string().max(80).optional(),
  frequency: z.string().max(80).optional(),
  instructions: z.string().max(200).optional(),
});
const Input = z.object({
  current: z.array(Med).max(30),
  incoming: z.array(Med).max(20),
});

const INSTRUCTIONS = `You are a careful clinical pharmacist helping a patient understand their medicines.
You get the patient's CURRENT medicines and optionally NEW medicines they are about to add.
Check for:
1. Drug-drug interactions (between new and current, and among new ones; if there are no new ones, among current ones).
2. Duplicate therapy (two products with the same active ingredient or same drug class doing the same job).
3. Food and drink conflicts (grapefruit, dairy/calcium, alcohol, caffeine, high-potassium foods, leafy greens with warfarin, etc.).
4. Important lifestyle notes (drowsiness and driving, sun sensitivity).
Rules:
- Only report well-established, clinically recognised issues. Never invent interactions. If unsure, leave it out.
- severity: "severe" = avoid combination / contraindicated / needs a doctor before taking; "moderate" = can be taken with care, timing or monitoring; "dietary" = food or drink conflict; "info" = minor, good-to-know tip.
- kind: "drug", "food", "duplicate" or "lifestyle".
- medicines: only the short medicine names involved (e.g. "Warfarin"), without strength or dose.
- title: short, e.g. "Warfarin + Ibuprofen: bleeding risk".
- explanation: 1-2 plain-English sentences a non-medical person understands (why it matters).
- advice: one practical step, e.g. "Take them at least 2 hours apart."
- askDoctor: one question the patient can ask their doctor or pharmacist.
- summary: one friendly sentence overall. If nothing is found, say so reassuringly.
- At most 10 warnings, most serious first. Never tell the patient to stop a prescribed medicine on their own.`;

const Schema = z.object({
  summary: z.string(),
  warnings: z.array(z.object({
    severity: z.enum(["severe", "moderate", "dietary", "info"]),
    kind: z.enum(["drug", "food", "duplicate", "lifestyle"]),
    medicines: z.array(z.string()),
    title: z.string(),
    explanation: z.string(),
    advice: z.string(),
    askDoctor: z.string(),
  })),
});

const line = (m: z.infer<typeof Med>) =>
  `- ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.dose ? `, ${m.dose}` : ""}${m.frequency ? `, ${m.frequency}` : ""}${m.instructions ? ` (${m.instructions})` : ""}`;

export const checkMedicationSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ report?: SafetyReport; error?: string }> => {
    const count = data.current.length + data.incoming.length;
    if (count === 0) return { error: "Add a medicine first." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "The safety check isn't set up yet." };

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

    const prompt = `CURRENT medicines:\n${data.current.map(line).join("\n") || "- none"}\n\nNEW medicines being added:\n${data.incoming.map(line).join("\n") || "- none (check the current list on its own)"}`;

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", content: prompt }],
        output: Output.object({ schema: Schema }),
        maxRetries: 0,
        abortSignal: request.signal,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
      });
      let parsed: z.infer<typeof Schema>;
      try {
        parsed = await result.output;
      } catch (e) {
        if (NoObjectGeneratedError.isInstance(e)) {
          console.error("Safety check returned no structured output");
          return { error: "We couldn't complete the safety check. Please try again." };
        }
        throw e;
      }
      const warnings = normalizeWarnings(parsed.warnings, 10);
      return {
        report: {
          level: shieldLevel(warnings),
          summary: parsed.summary.trim().slice(0, 300),
          warnings,
          checkedCount: count,
          checkedAt: new Date().toISOString(),
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("Safety check failed", status, msg);
      if (status === 402 || /402|credit/i.test(msg)) return { error: "AI credits have run out for this workspace." };
      if (status === 429 || /429/.test(msg)) return { error: "Too many checks right now. Please try again in a minute." };
      if (status === 403) return { error: "The safety check isn't available right now." };
      return { error: "We couldn't complete the safety check. Please try again." };
    }
  });
