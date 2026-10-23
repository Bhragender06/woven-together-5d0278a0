import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Printer, RefreshCw } from "lucide-react";
import { checkMedicationSafety } from "@/lib/safety.functions";
import {
  regimenKey, SEVERITY_LABEL, shieldHeadline,
  type InteractionWarning, type SafetyMed, type SafetyReport, type SeverityLevel, type ShieldLevel,
} from "@/lib/safety-logic";

const CACHE = "medileaf-safety-v1";

function readCache(key: string): SafetyReport | null {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) ?? "{}") as Record<string, SafetyReport>;
    return all[key] ?? null;
  } catch { return null; }
}
function writeCache(key: string, r: SafetyReport) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) ?? "{}") as Record<string, SafetyReport>;
    const keys = Object.keys(all);
    if (keys.length > 10) delete all[keys[0]!];
    all[key] = r;
    localStorage.setItem(CACHE, JSON.stringify(all));
  } catch { /* ignore */ }
}

const pick = (m: SafetyMed): SafetyMed => ({
  name: m.name.trim(),
  ...(m.strength ? { strength: m.strength.slice(0, 60) } : {}),
  ...(m.dose ? { dose: m.dose.slice(0, 80) } : {}),
  ...(m.frequency ? { frequency: m.frequency.slice(0, 80) } : {}),
  ...(m.instructions ? { instructions: m.instructions.slice(0, 200) } : {}),
});

/** Runs the AI safety check. Results are cached per set of medicines so the same list isn't re-checked. */
export function useSafetyCheck() {
  const check = useServerFn(checkMedicationSafety);
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const run = useCallback(async (current: SafetyMed[], incoming: SafetyMed[], opts: { force?: boolean } = {}) => {
    const cur = current.filter((m) => m.name.trim()).map(pick);
    const inc = incoming.filter((m) => m.name.trim()).map(pick);
    const key = `${regimenKey(cur)}>>${regimenKey(inc)}`;
    if (!opts.force) {
      const hit = readCache(key);
      if (hit) { setReport(hit); setError(""); return hit; }
    }
    const id = ++seq.current;
    setLoading(true); setError("");
    const res = await check({ data: { current: cur, incoming: inc } })
      .catch(() => ({ error: "We couldn't reach the safety check. Check your connection and try again." } as { report?: SafetyReport; error?: string }));
    if (id !== seq.current) return null;
    setLoading(false);
    if (res.error || !res.report) { setError(res.error ?? "We couldn't complete the safety check."); return null; }
    writeCache(key, res.report);
    setReport(res.report);
    return res.report;
  }, [check]);

  const reset = useCallback(() => { seq.current++; setReport(null); setError(""); setLoading(false); }, []);
  return { run, report, loading, error, reset };
}

const tone: Record<ShieldLevel, { box: string; icon: typeof ShieldCheck; label: string }> = {
  danger: { box: "border-destructive bg-destructive/10", icon: ShieldAlert, label: "Serious warning found" },
  caution: { box: "border-warning bg-warning-soft", icon: ShieldQuestion, label: "Some things to check" },
  clear: { box: "border-success bg-success/10", icon: ShieldCheck, label: "Looks safe together" },
};

const chip: Record<SeverityLevel, string> = {
  severe: "bg-destructive text-destructive-foreground",
  moderate: "bg-warning text-primary-foreground",
  dietary: "bg-warning-soft text-foreground border border-warning",
  info: "bg-muted text-foreground",
};

function WarningCard({ w }: { w: InteractionWarning }) {
  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${chip[w.severity]}`}>{SEVERITY_LABEL[w.severity]}</span>
        {w.medicines.length > 0 && <span className="text-sm text-muted-foreground">{w.medicines.join(" + ")}</span>}
      </div>
      <h4 className="mt-2 text-lg font-semibold">{w.title}</h4>
      {w.advice && <p className="mt-1"><strong>What to do:</strong> {w.advice}</p>}
      {(w.explanation || w.askDoctor) && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-semibold text-primary underline">Why this matters</summary>
          {w.explanation && <p className="mt-2 text-muted-foreground">{w.explanation}</p>}
          {w.askDoctor && <p className="mt-2 rounded-lg bg-muted p-3 text-sm"><strong>Ask your doctor:</strong> “{w.askDoctor}”</p>}
        </details>
      )}
    </li>
  );
}

export function SafetyReportView({ report, loading, error, onRetry, title = "Safety Shield", compact = false }: {
  report: SafetyReport | null; loading: boolean; error: string; onRetry?: (() => void) | undefined; title?: string | undefined; compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  if (loading)
    return (
      <section aria-live="polite" className="surface flex items-center gap-4 p-6">
        <ShieldQuestion className="h-10 w-10 shrink-0 animate-pulse text-primary" aria-hidden />
        <div>
          <p className="font-semibold">{title}: checking for interactions…</p>
          <p className="text-sm text-muted-foreground">Comparing medicines with each other and with common foods and drinks.</p>
        </div>
      </section>
    );
  if (error)
    return (
      <section role="alert" className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="font-semibold text-destructive">{error}</p>
        {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}
      </section>
    );
  if (!report) return null;
  const t = tone[report.level];
  const Icon = t.icon;
  return (
    <section aria-live="polite" className={`rounded-2xl border-2 p-6 md:p-8 ${t.box}`}>
      <div className="flex flex-wrap items-start gap-4">
        <Icon className="h-12 w-12 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-70">{title} · {t.label}</p>
          <h3 className="mt-1 text-2xl md:text-3xl">{shieldHeadline(report.level, report.warnings, report.checkedCount)}</h3>
          {report.summary && <p className="mt-2">{report.summary}</p>}
        </div>
        <div className="flex gap-2 print:hidden">
          {onRetry && <button className="btn btn-ghost min-h-11 px-3" onClick={onRetry} aria-label="Check again"><RefreshCw className="h-4 w-4" /></button>}
          <button className="btn btn-ghost min-h-11 px-3" onClick={() => window.print()} aria-label="Print for my doctor"><Printer className="h-4 w-4" /></button>
        </div>
      </div>
      {report.warnings.length > 0 && compact && (
        <button className="mt-4 font-semibold text-primary underline print:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide details" : `See ${report.warnings.length} detail${report.warnings.length === 1 ? "" : "s"}`}
        </button>
      )}
      {report.warnings.length > 0 && open && <ul className="mt-6 space-y-3">{report.warnings.map((w, i) => <WarningCard key={i} w={w} />)}</ul>}
      <p className="mt-5 text-xs text-muted-foreground">
        AI-assisted check, not medical advice. Don’t stop or change a prescribed medicine without talking to your doctor or pharmacist.
      </p>
    </section>
  );
}

/** Self-running shield: checks `incoming` against `current` (or the current list alone) whenever the list changes. */
export function SafetyShield({ current, incoming = [], title, compact = false, onReport }: {
  current: SafetyMed[]; incoming?: SafetyMed[]; title?: string | undefined; compact?: boolean; onReport?: (r: SafetyReport | null) => void;
}) {
  const { run, report, loading, error } = useSafetyCheck();
  const notify = useRef(onReport);
  notify.current = onReport;
  useEffect(() => { notify.current?.(loading ? null : report); }, [report, loading]);
  const key = `${regimenKey(current)}>>${regimenKey(incoming)}`;
  const latest = useRef({ current, incoming });
  latest.current = { current, incoming };
  useEffect(() => {
    if (current.length + incoming.length === 0) return;
    const t = setTimeout(() => { void run(latest.current.current, latest.current.incoming); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, run]);
  if (current.length + incoming.length === 0) return null;
  return <SafetyReportView report={report} loading={loading || (!report && !error)} error={error} title={title} compact={compact}
    onRetry={() => void run(latest.current.current, latest.current.incoming, { force: true })} />;
}
