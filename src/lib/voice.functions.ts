import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Med = z.object({
  id: z.string().max(80),
  name: z.string().max(120),
  strength: z.string().max(60),
  dose: z.string().max(80),
  times: z.array(z.string().max(10)).max(12),
  instructions: z.string().max(200),
  remaining: z.number(),
});
const Input = z.object({
  question: z.string().trim().min(1).max(500),
  lang: z.enum(["en", "hi"]),
  now: z.string().max(40),
  meds: z.array(Med).max(30),
});

const Schema = z.object({
  reply: z.string(),
  medicationId: z.string().nullable(),
  action: z.enum(["none", "refill", "add_medicine", "emergency"]),
});

export type VoiceAnswer = z.infer<typeof Schema>;

const INSTRUCTIONS = `You are Medileaf's friendly voice helper for elderly patients.
Answer the patient's question using ONLY their medicine list and the current time given.
Rules:
- Reply in the requested language (en = simple English, hi = simple Hindi in Devanagari script).
- 1 to 3 short, warm sentences. No jargon, no markdown, no lists. It will be read aloud.
- For "next dose" questions, use the medicine times and the current time.
- For food / empty stomach questions, use the medicine instructions and well-known facts; if unsure, say to ask the pharmacist.
- Never tell them to stop a prescribed medicine. Never invent medicines.
- If they describe chest pain, trouble breathing, overdose, fainting or similar, set action "emergency" and tell them to call emergency services (112) now.
- medicationId: the id of the one medicine the answer is mainly about, or null.
- action: "refill" if they want to order more, "add_medicine" if they want to add one, else "none".`;

export const askVoiceAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ answer?: VoiceAnswer; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "The voice helper isn't set up yet." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } = await import("./ai-run-id.server");
    const request = getRequest();
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const list = data.meds.map((m) =>
      `- id=${m.id}: ${m.name} ${m.strength}, ${m.dose}, at ${m.times.join(", ") || "no set time"}; instructions: ${m.instructions || "none"}; pills left: ${m.remaining}`,
    ).join("\n") || "- no medicines added yet";
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", content: `Language: ${data.lang}\nCurrent time: ${data.now}\nMedicines:\n${list}\n\nQuestion: ${data.question}` }],
        output: Output.object({ schema: Schema }),
        maxRetries: 0,
        abortSignal: request.signal,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      const known = data.meds.some((m) => m.id === out.medicationId);
      return { answer: { ...out, reply: out.reply.trim().slice(0, 600), medicationId: known ? out.medicationId : null } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("Voice assistant failed", status, msg);
      if (status === 402) return { error: "AI credits have run out for this workspace." };
      if (status === 429) return { error: "Too many questions right now. Please try again in a minute." };
      return { error: "Sorry, I couldn't answer that. Please try again." };
    }
  });
