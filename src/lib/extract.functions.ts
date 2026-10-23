import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  dataUrl: z.string().startsWith("data:").max(15_000_000),
  mimeType: z.string().regex(/^(image\/(png|jpe?g|webp)|application\/pdf)$/),
});

export type ExtractedMed = {
  name: string; strength: string; form: string; dose: string; route: string; frequency: string;
  times: string[]; instructions: string; durationDays: string; quantity: string;
  confidence: number; uncertain: Record<string, string>; itemId?: string;
};

const PROMPT = `You read medical prescriptions. Extract every medicine on it.
Reply with ONLY a JSON object, no other text: {"medicines":[{"name","strength","form","dose","route","frequency","times":["HH:MM"],"instructions","durationDays","quantity","confidence","uncertain":{}}]}
Rules: all fields are strings except times (array of 24h "HH:MM" dose times you infer from frequency, e.g. twice daily -> ["09:00","21:00"]) and confidence (0..1 how sure you are about this medicine).
form is one of Tablet, Capsule, Syrup, Injection, Drops, Cream, Inhaler, Other. route like Oral. durationDays and quantity are digits only or "".
If a field is unreadable or missing, leave it "" and add a short plain-English note under uncertain with that field name as key.
If the image is not a prescription, return {"medicines":[]}.`;

export const extractPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<{ medicines: ExtractedMed[]; prescriptionId?: string; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { medicines: [], error: "AI reading isn't set up yet." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } = await import("./ai-run-id.server");
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(getRequest()));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const base64 = data.dataUrl.slice(data.dataUrl.indexOf(",") + 1);
    const { supabase, userId } = context;
    // Keep the original upload in private storage and record the prescription.
    const ext = data.mimeType === "application/pdf" ? "pdf" : data.mimeType.split("/")[1];
    const key = `${userId}/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const up = await supabase.storage.from("prescriptions").upload(key, bytes, { contentType: data.mimeType });
    if (up.error) console.error("Prescription upload failed", up.error.message);
    const rx = await supabase.from("prescriptions").insert({ user_id: userId, image_storage_key: up.error ? null : key, processing_status: "processing" }).select("id").single();
    const prescriptionId = rx.data?.id;
    const fail = async () => { if (prescriptionId) await supabase.from("prescriptions").update({ processing_status: "failed", processed_at: new Date().toISOString() }).eq("id", prescriptionId); };
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "file", data: base64, mediaType: data.mimeType },
        ] }],
        maxRetries: 0,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
      });
      const text = await result.text;
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as { medicines?: ExtractedMed[] };
      const meds = (parsed.medicines ?? []).map((m) => ({ ...m, times: Array.isArray(m.times) ? m.times : [], uncertain: m.uncertain ?? {}, confidence: Number(m.confidence) || 0.5 }));
      if (!prescriptionId) return { medicines: meds };
      const overall = meds.length ? meds.reduce((a, m) => a + m.confidence, 0) / meds.length : 0;
      await supabase.from("prescriptions").update({ processing_status: meds.length ? "needs_review" : "failed", extracted_text: text.slice(0, 20000), overall_confidence: overall, processed_at: new Date().toISOString() }).eq("id", prescriptionId);
      if (!meds.length) return { medicines: [], prescriptionId };
      const ins = await supabase.from("prescription_items").insert(meds.map((m) => ({
        prescription_id: prescriptionId, user_id: userId, medication_name: m.name, strength: m.strength, dosage: m.dose, frequency: m.frequency,
        timing: m.times.join(", "), duration: m.durationDays, quantity: m.quantity, instructions: m.instructions, confidence: m.confidence,
      }))).select("id");
      return { medicines: meds.map((m, i) => ({ ...m, ...(ins.data?.[i] ? { itemId: ins.data[i].id } : {}) })), prescriptionId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Prescription extraction failed", msg);
      await fail();
      if (/402|credit/i.test(msg)) return { medicines: [], error: "AI credits have run out for this workspace." };
      if (/429/.test(msg)) return { medicines: [], error: "Too many requests right now. Please try again in a minute." };
      return { medicines: [], error: "We couldn't read this prescription. Try a clearer photo, or add medicines by hand." };
    }
  });
