import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, Confirm, PageTitle } from "@/components/site";
import { draftToMed, MedForm, validateDraft, type Draft, type Uncertain } from "@/components/med-form";
import { setState, uid, useStore } from "@/lib/store";
import { SafetyShield } from "@/components/safety-shield";
import type { SafetyReport } from "@/lib/safety-logic";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { extractPrescription } from "@/lib/extract.functions";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload prescription — Medileaf" },
      { name: "description", content: "Upload a prescription photo or PDF and review what we found." },
      { property: "og:title", content: "Upload prescription — Medileaf" },
      { property: "og:description", content: "Turn a prescription into a clear plan." },
    ],
  }),
  component: () => <AppShell><Upload /></AppShell>,
});

type Item = { itemId?: string | undefined; key: string; draft: Draft; uncertain: Uncertain; confidence: number; state: "pending" | "confirmed" | "rejected" };

const stages = ["Checking image quality", "Reading the text", "Finding medicines", "Understanding doses and timing", "Checking confidence"];

function Upload() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "processing" | "review">("pick");
  const [stage, setStage] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [rxId, setRxId] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyReport | null>(null);
  const allMeds = useStore((s) => s.meds);
  const activeMeds = useMemo(() => allMeds.filter((m) => m.status === "active"), [allMeds]);

  function pick(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(f.type)) return setError("Please choose a JPG, PNG, WEBP image or a PDF.");
    if (f.size > 10 * 1024 * 1024) return setError("That file is larger than 10 MB. Try a smaller photo.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  const extract = useServerFn(extractPrescription);
  useEffect(() => {
    if (phase !== "processing") return;
    const t = setTimeout(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 1500);
    return () => clearTimeout(t);
  }, [phase, stage]);

  useEffect(() => {
    if (phase !== "processing" || !file) return;
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await extract({ data: { dataUrl: String(reader.result), mimeType: file.type } }).catch(() => ({ medicines: [], error: "We couldn't reach the reader. Check your connection and try again." }));
      if (cancelled) return;
      if (res.error || res.medicines.length === 0) {
        setError(res.error ?? "We didn't find any medicines on this file. Try a clearer photo, or add medicines by hand.");
        setPhase("pick"); return;
      }
      setRxId("prescriptionId" in res ? res.prescriptionId ?? null : null);
      setItems(res.medicines.map((m) => ({ itemId: m.itemId, key: uid(), confidence: m.confidence, state: "pending", uncertain: m.uncertain as Uncertain,
        draft: { name: m.name, strength: m.strength, form: m.form || "Tablet", dose: m.dose, route: m.route || "Oral", frequency: m.frequency, times: m.times.length ? m.times : ["09:00"], instructions: m.instructions, durationDays: m.durationDays, quantity: m.quantity } })));
      setPhase("review");
    };
    reader.readAsDataURL(file);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, file]);

  const update = (k: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === k ? { ...x, ...p } : x)));

  function confirmItem(it: Item) {
    const err = validateDraft(it.draft);
    if (err) return setError(`${it.draft.name || "Medicine"}: ${err}`);
    setError("");
    update(it.key, { state: "confirmed", uncertain: {} });
  }

  function activate() {
    const ok = items.filter((i) => i.state === "confirmed");
    setState((s) => ({ ...s, meds: [...s.meds, ...ok.map((i) => ({ id: uid(), ...draftToMed(i.draft, "prescription"), prescriptionItemId: i.itemId }))] }),
      `Activated ${ok.length} medicine(s) from prescription`);
    // Only confirmed items become verified; the prescription is verified once reviewed.
    const ids = ok.map((i) => i.itemId).filter((x): x is string => !!x);
    if (ids.length) supabase.from("prescription_items").update({ user_verified: true }).in("id", ids).then();
    if (rxId) supabase.from("prescriptions").update({ processing_status: "verified" }).eq("id", rxId).then();
    navigate({ to: "/dashboard" });
  }

  if (phase === "processing")
    return (
      <div className="mx-auto max-w-lg py-10" aria-live="polite">
        <h1 className="text-5xl">Reading your prescription…</h1>
        <ol className="mt-10 space-y-4">
          {stages.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 text-lg ${i < stage ? "text-foreground" : i === stage ? "font-semibold" : "text-muted-foreground"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${i < stage ? "bg-success text-primary-foreground" : i === stage ? "animate-pulse bg-accent" : "bg-muted"}`}>{i < stage ? "✓" : i + 1}</span>{s}
            </li>
          ))}
        </ol>
      </div>
    );

  if (phase === "review") {
    const pending = items.filter((i) => i.state === "pending").length;
    const confirmed = items.filter((i) => i.state === "confirmed").length;
    return (
      <>
        <PageTitle title="Check what we found" sub="Review each medicine. Fix anything that’s wrong. Nothing is added to your plan until you confirm it." />
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            {preview ? <img src={preview} alt="Your uploaded prescription" className="w-full rounded-xl border" /> : <div className="surface p-6 text-sm">{file?.name}</div>}
            <button className="btn btn-ghost w-full" onClick={() => { setPhase("pick"); setItems([]); }}>Re-upload</button>
            <p className="text-sm text-muted-foreground">Highlighted fields could not be read with confidence. Please compare them with your paper prescription.</p>
          </aside>
          <div className="space-y-6">
            {items.map((it) => (
              <article key={it.key} className={`surface p-6 md:p-8 ${it.state === "rejected" ? "opacity-50" : ""}`}>
                <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl">{it.draft.name || "Unnamed medicine"}</h2>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${it.state === "confirmed" ? "bg-success text-primary-foreground" : it.confidence < 0.8 ? "bg-warning-soft" : "bg-muted"}`}>
                    {it.state === "confirmed" ? "Confirmed" : it.state === "rejected" ? "Removed" : it.confidence < 0.8 ? "Needs your review" : "Looks clear"}
                  </span>
                </header>
                {it.state === "pending" ? <>
                  <MedForm d={it.draft} uncertain={it.uncertain} onChange={(draft) => update(it.key, { draft })} />
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button className="btn btn-green" onClick={() => confirmItem(it)}>Confirm medicine</button>
                    <button className="btn btn-ghost" onClick={() => update(it.key, { state: "rejected" })}>Remove</button>
                  </div>
                </> : <button className="font-semibold text-primary underline" onClick={() => update(it.key, { state: "pending" })}>{it.state === "rejected" ? "Restore" : "Edit again"}</button>}
              </article>
            ))}
            <SafetyShield title="Safety check" current={activeMeds} onReport={setSafety}
              incoming={items.filter((i) => i.state !== "rejected").map((i) => i.draft)} />
            {error && <p role="alert" className="font-semibold text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted p-5">
              <span>{confirmed} confirmed · {pending} still to review</span>
              <button className="btn btn-primary" disabled={confirmed === 0 || pending > 0} onClick={() => setConfirmAll(true)}>Create my medication plan</button>
            </div>
          </div>
        </div>
        <Confirm open={confirmAll} title="Start this plan?" danger={safety?.level === "danger"}
          body={`${confirmed} medicine(s) will be added with reminders at the times you set.${safety?.level === "danger" ? " The safety check found a serious warning — please talk to your doctor or pharmacist before you start." : ""}`}
          confirmLabel={safety?.level === "danger" ? "Start anyway" : "Start plan"}
          onConfirm={activate} onCancel={() => setConfirmAll(false)} />
      </>
    );
  }

  return (
    <>
      <PageTitle title="Upload a prescription" sub="A clear, well-lit photo works best. We’ll read it and ask you to check everything." />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        className="surface flex flex-col items-center gap-4 border-2 border-dashed px-6 py-16 text-center"
      >
        {preview ? <img src={preview} alt="Selected prescription" className="max-h-72 rounded-lg" /> :
          file ? <p className="font-semibold">{file.name}</p> :
            <p className="font-display text-3xl">Drop your prescription here</p>}
        <p className="text-muted-foreground">JPG, PNG, WEBP or PDF · up to 10 MB</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button className="btn btn-ghost" onClick={() => input.current?.click()}>{file ? "Replace file" : "Choose file"}</button>
          <label className="btn btn-ghost">Take photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
        </div>
        <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <p role="alert" className="mt-4 font-semibold text-destructive">{error}</p>}
      <div className="mt-8 flex justify-end">
        <button className="btn btn-primary" disabled={!file} onClick={() => { setStage(0); setPhase("processing"); }}>Read prescription</button>
      </div>
    </>
  );
}
