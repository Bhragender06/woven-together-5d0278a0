import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { explainPrescription } from "@/lib/jargon.functions";
import {
  MEAL_LABEL, SAMPLES, SLOT_ICON, SLOT_LABEL, daySlot, detectAcronyms, type DaySlot, type PlainReport,
} from "@/lib/jargon-logic";
import { fmtTime } from "@/lib/store";

const SLOTS: DaySlot[] = ["morning", "afternoon", "evening", "night"];

export function AcronymChips({ text }: { text: string }) {
  const found = useMemo(() => detectAcronyms(text), [text]);
  const [open, setOpen] = useState<string | null>(null);
  if (!found.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-muted-foreground">Doctor shorthand found — tap to decode</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {found.map((a) => (
          <button key={a.code} type="button" onClick={() => setOpen(open === a.code ? null : a.code)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${open === a.code ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>
            {a.code}{open === a.code ? ` = ${a.meaning}` : ""}
          </button>
        ))}
      </div>
      {open && (() => { const a = found.find((x) => x.code === open)!; return <p className="mt-2 text-sm text-muted-foreground">From Latin <em>“{a.latin}”</em></p>; })()}
    </div>
  );
}

export function PlainReportView({ report }: { report: PlainReport }) {
  const asNeeded = report.medicines.filter((m) => m.asNeeded);
  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-primary/10 p-4 text-lg font-semibold">{report.summary}</p>

      {report.timeline.length > 0 && (
        <section>
          <h3 className="text-2xl">Your day, step by step</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SLOTS.map((slot) => {
              const doses = report.timeline.filter((d) => daySlot(d.time) === slot);
              return (
                <div key={slot} className={`rounded-xl border p-4 ${doses.length ? "bg-card" : "bg-muted/40 opacity-60"}`}>
                  <p className="text-lg font-semibold">{SLOT_ICON[slot]} {SLOT_LABEL[slot]}</p>
                  {doses.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing to take</p> : (
                    <ul className="mt-2 space-y-3">
                      {doses.map((d, i) => (
                        <li key={i}>
                          <p className="text-sm font-semibold text-primary">{fmtTime(d.time)} · {MEAL_LABEL[d.meal]}</p>
                          <p className="font-semibold">💊 {d.medicine}</p>
                          <p className="text-sm text-muted-foreground">{d.amount}{d.note ? ` — ${d.note}` : ""}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {asNeeded.length > 0 && (
        <section className="rounded-xl border border-dashed p-4">
          <p className="font-semibold">⏸️ Only when needed</p>
          <ul className="mt-1 list-disc pl-5">{asNeeded.map((m) => <li key={m.name}><strong>{m.name}:</strong> {m.plain}</li>)}</ul>
        </section>
      )}

      <section>
        <h3 className="text-2xl">In plain words</h3>
        <ul className="mt-3 space-y-3">
          {report.medicines.filter((m) => !m.asNeeded).map((m) => (
            <li key={m.name} className="rounded-xl border bg-card p-4">
              <p className="text-xl font-semibold">{m.name}{m.durationText && <span className="ml-2 text-base font-normal text-muted-foreground">· {m.durationText}</span>}</p>
              <p className="mt-1 text-lg">{m.plain}</p>
              {m.tips.length > 0 && <ul className="mt-2 space-y-1">{m.tips.map((t) => <li key={t} className="text-sm">✅ {t}</li>)}</ul>}
            </li>
          ))}
        </ul>
      </section>

      {report.warnings.length > 0 && (
        <section className="rounded-xl bg-warning-soft p-4">
          <p className="font-semibold">⚠️ Be careful</p>
          <ul className="mt-1 list-disc pl-5">{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}
      <p className="text-sm text-muted-foreground">This is a helper, not medical advice. If anything looks different from what your doctor said, ask your pharmacist.</p>
    </div>
  );
}

export function JargonBuster({ initialText = "", showSamples = true }: { initialText?: string; showSamples?: boolean }) {
  const explain = useServerFn(explainPrescription);
  const [text, setText] = useState(initialText);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [view, setView] = useState<"doctor" | "plain">("doctor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [report, setReport] = useState<PlainReport | null>(null);

  async function run() {
    if (text.trim().length < 3) return setErr("Type or paste the doctor's note first.");
    setBusy(true); setErr("");
    try {
      const r = await explain({ data: { text, language: lang } });
      if (r.error || !r.report) setErr(r.error ?? "Something went wrong.");
      else { setReport(r.report); setView("plain"); }
    } catch { setErr("Please sign in and try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {report && (
        <div className="inline-flex rounded-full border bg-card p-1" role="tablist">
          {(["doctor", "plain"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 font-semibold ${view === v ? "bg-primary text-primary-foreground" : ""}`}>
              {v === "doctor" ? "🩺 Doctor's version" : "🧒 Explain like I'm 10"}
            </button>
          ))}
        </div>
      )}

      {(!report || view === "doctor") && (
        <>
          {showSamples && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Try a sample:</span>
              {SAMPLES.map((s) => <button key={s.label} type="button" className="rounded-full border px-3 py-1 text-sm hover:border-primary" onClick={() => { setText(s.text); setReport(null); }}>{s.label}</button>)}
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={6000}
            placeholder="e.g. Amoxicillin 500mg PO TID AC x 7d, Paracetamol PRN"
            className="w-full rounded-xl border bg-card p-4 font-mono text-base" aria-label="Doctor's note" />
          <AcronymChips text={text} />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? "Translating…" : "✨ Explain simply"}</button>
            <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "hi")} className="rounded-lg border bg-card px-3 py-2" aria-label="Language">
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
          </div>
        </>
      )}
      {err && <p role="alert" className="font-semibold text-destructive">{err}</p>}
      {report && view === "plain" && <PlainReportView report={report} />}
    </div>
  );
}
