import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Confirm, Empty, PageTitle } from "@/components/site";
import { Button } from "@/components/ui/button";
import { SafetyShield } from "@/components/safety-shield";
import { daysLeft, fmtTime, logDose, needsRefill, removeMedicine, today, useStore, type DoseStatus, type Medication } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — Medileaf" },
      { name: "description", content: "Today’s doses, next reminder and refill alerts." },
      { property: "og:title", content: "Today — Medileaf" },
      { property: "og:description", content: "Your daily medication plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Dashboard /></AppShell>,
});

const badge: Record<DoseStatus, string> = {
  taken: "bg-success text-primary-foreground", skipped: "bg-muted text-foreground", missed: "bg-destructive text-destructive-foreground", snoozed: "bg-warning-soft text-foreground",
};

function Dashboard() {
  const [removing, setRemoving] = useState<Medication | null>(null);
  const meds = useStore((s) => s.meds).filter((m) => m.status === "active");
  const logs = useStore((s) => s.logs);
  const user = useStore((s) => s.user);
  const refillDays = useStore((s) => s.prefs.refillDays);
  const d = today();
  const now = new Date().toTimeString().slice(0, 5);
  const doses = meds.flatMap((m) => m.times.map((t) => ({ m, t, log: logs.find((l) => l.medId === m.id && l.date === d && l.time === t) })))
    .sort((a, b) => a.t.localeCompare(b.t));
  const next = doses.find((x) => !x.log && x.t >= now) ?? doses.find((x) => !x.log);
  const done = doses.filter((x) => x.log?.status === "taken").length;
  const refills = meds.filter((m) => needsRefill(m, refillDays));

  if (meds.length === 0)
    return <>
      <PageTitle title={`Hello, ${user?.name ?? ""}`} />
      <Empty title="No medicines yet" body="Upload a prescription and we’ll help you build a clear daily plan. You can also add medicines by hand."
        action={<div className="flex flex-wrap justify-center gap-3"><Link to="/upload" className="btn btn-primary">Upload prescription</Link><Link to="/medications/new" className="btn btn-ghost">Add manually</Link></div>} />
    </>;

  return (
    <>
      <PageTitle title={`Hello, ${user?.name ?? ""}`} sub={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        action={<Link to="/medications/new" className="btn btn-ghost">+ Add medicine</Link>} />

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-2xl bg-primary p-8 text-primary-foreground md:col-span-2">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-70">Next dose</p>
          {next ? <>
            <p className="mt-3 font-display text-6xl">{fmtTime(next.t)}</p>
            <p className="mt-2 text-xl">{next.m.name} {next.m.strength} · {next.m.dose}</p>
            {next.m.instructions && <p className="opacity-80">{next.m.instructions}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={() => logDose(next.m.id, next.t, "taken")}>Mark as taken</button>
              <button className="btn border border-primary-foreground/50" onClick={() => logDose(next.m.id, next.t, "snoozed")}>Snooze</button>
            </div>
          </> : <p className="mt-3 font-display text-4xl">All done for today.</p>}
        </section>
        <section className="surface p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Today</p>
          <p className="mt-3 font-display text-6xl">{done}<span className="text-3xl text-muted-foreground"> / {doses.length}</span></p>
          <p className="text-muted-foreground">doses taken</p>
          <div className="mt-4 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-success" style={{ width: `${doses.length ? (done / doses.length) * 100 : 0}%` }} /></div>
        </section>
      </div>

      {refills.length > 0 && (
        <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warning bg-warning-soft p-5">
          <p><strong>Refill soon:</strong> {refills.map((m) => `${m.name} (${daysLeft(m)} days left)`).join(", ")}</p>
          <Link to="/refills" className="btn btn-green">Review refills</Link>
        </div>
      )}

      <div className="mt-6"><SafetyShield current={meds} compact title="Safety Shield" /></div>

      <h2 className="mt-14 text-4xl">Today’s schedule</h2>
      <ul className="mt-6 space-y-3">
        {doses.map(({ m, t, log }) => (
          <li key={m.id + t} className="surface flex flex-wrap items-center gap-4 p-5">
            <span className="w-24 font-display text-2xl">{fmtTime(t)}</span>
            <Link to="/medications/$id" params={{ id: m.id }} className="min-w-48 flex-1">
              <span className="block text-lg font-semibold">{m.name} <span className="font-normal text-muted-foreground">{m.strength}</span></span>
              <span className="text-sm text-muted-foreground">{m.dose}{m.instructions ? ` · ${m.instructions}` : ""}</span>
            </Link>
            {log && <span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${badge[log.status]}`}>{log.status}</span>}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-green min-h-11 px-4" onClick={() => logDose(m.id, t, "taken")}>Taken</button>
              <button className="btn btn-ghost min-h-11 px-4" onClick={() => logDose(m.id, t, "skipped")}>Skip</button>
              <Button variant="ghost" className="min-h-11 text-destructive" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}>Remove</Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">Missed a dose? Don’t take a double dose to make up for it. Check your medicine leaflet or ask your pharmacist.</p>
      <Confirm open={removing !== null} title={`Remove ${removing?.name ?? "medicine"}?`}
        body="This removes the medicine from your current plan and stops its reminders and refill alerts. Your dose history will be kept."
        confirmLabel="Remove" onCancel={() => setRemoving(null)}
        onConfirm={() => { if (removing) removeMedicine(removing.id); setRemoving(null); }} />
    </>
  );
}
