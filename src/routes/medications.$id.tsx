import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Confirm, Empty } from "@/components/site";
import { MedForm, validateDraft, type Draft } from "@/components/med-form";
import { daysLeft, fmtTime, removeMedicine, setState, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { JargonBuster } from "@/components/jargon-buster";

export const Route = createFileRoute("/medications/$id")({
  head: () => ({
    meta: [
      { title: "Medicine details — Medileaf" },
      { name: "description", content: "Dose, schedule, supply and history for one medicine." },
      { property: "og:title", content: "Medicine details — Medileaf" },
      { property: "og:description", content: "Everything about one medicine in your plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Detail /></AppShell>,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const m = useStore((s) => s.meds.find((x) => x.id === id));
  const logs = useStore((s) => s.logs).filter((l) => l.medId === id);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState<null | "archive" | "delete">(null);

  if (!m) return <Empty title="Medicine not found" body="It may have been removed." action={<Link to="/dashboard" className="btn btn-primary">Back to today</Link>} />;

  const left = daysLeft(m);
  const facts = [["Strength", m.strength], ["Dose", m.dose], ["Form", m.form], ["Route", m.route], ["How often", m.frequency], ["Instructions", m.instructions || "—"],
    ["Started", m.startDate], ["Duration", m.durationDays ? `${m.durationDays} days` : "Ongoing"], ["Added from", m.source === "prescription" ? "Verified prescription" : "Entered by you"]];

  function save() {
    if (!edit) return;
    const e = validateDraft(edit);
    if (e) return setErr(e);
    setState((s) => ({ ...s, meds: s.meds.map((x) => x.id === id ? { ...x, name: edit.name, strength: edit.strength, form: edit.form, dose: edit.dose, route: edit.route, frequency: edit.frequency, times: [...edit.times].sort(), dosesPerDay: edit.times.length, instructions: edit.instructions, durationDays: edit.durationDays ? +edit.durationDays : null, quantity: +edit.quantity } : x) }), `Edited ${edit.name}`);
    setEdit(null); setErr("");
  }

  return (
    <>
      <Link to="/dashboard" className="text-sm font-semibold text-primary">← Today</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-6xl">{m.name}</h1>
          <p className="mt-2 text-xl text-muted-foreground">{m.strength} · {m.dose} · {m.frequency}</p>
          {m.status !== "active" && <span className="mt-3 inline-block rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold capitalize">{m.status}</span>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/reorder/$id" params={{ id }} className="btn btn-primary">Reorder</Link>
          <button className="btn btn-ghost" onClick={() => setEdit({ name: m.name, strength: m.strength, form: m.form, dose: m.dose, route: m.route, frequency: m.frequency, times: m.times, instructions: m.instructions, durationDays: m.durationDays?.toString() ?? "", quantity: String(m.quantity) })}>Edit</button>
        </div>
      </div>

      {edit ? (
        <section className="surface mt-10 p-6 md:p-8">
          <MedForm d={edit} onChange={setEdit} />
          {err && <p role="alert" className="mt-4 font-semibold text-destructive">{err}</p>}
          <div className="mt-6 flex justify-end gap-3"><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-green" onClick={save}>Save changes</button></div>
        </section>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <section className="surface p-8 md:col-span-2">
            <h2 className="text-3xl">Prescription details</h2>
            <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {facts.map(([k, v]) => <div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="text-lg font-semibold">{v}</dd></div>)}
            </dl>
          </section>
          <section className="space-y-6">
            <div className="surface p-8">
              <h2 className="text-3xl">Supply</h2>
              <p className="mt-3 font-display text-5xl">{m.remaining}<span className="text-2xl text-muted-foreground"> / {m.quantity}</span></p>
              <p className="text-muted-foreground">≈ {Number.isFinite(left) ? `${left} days left` : "—"}</p>
            </div>
            <div className="surface p-8">
              <h2 className="text-3xl">Reminders</h2>
              <ul className="mt-3 space-y-1 text-lg">{m.times.map((t) => <li key={t}>{fmtTime(t)}</li>)}</ul>
            </div>
          </section>
        </div>
      )}

      {!edit && (
        <section className="surface mt-10 p-6 md:p-8">
          <h2 className="text-3xl">🧒 Explain like I'm 10</h2>
          <p className="mt-1 text-muted-foreground">See this medicine in plain words and on a simple daily timeline.</p>
          <div className="mt-5"><JargonBuster key={m.id} showSamples={false} initialText={`${m.name} ${m.strength} ${m.form}. ${m.dose}, ${m.route}, ${m.frequency}. ${m.instructions || ""}${m.durationDays ? ` for ${m.durationDays} days` : ""}`} /></div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-3xl">History</h2>
        {logs.length === 0 ? <p className="mt-3 text-muted-foreground">No doses logged yet.</p> :
          <ul className="mt-4 divide-y rounded-xl border bg-card">
            {logs.slice(0, 20).map((l) => <li key={l.id} className="flex justify-between px-5 py-3"><span>{l.date} · {fmtTime(l.time)}</span><span className="font-semibold capitalize">{l.status}</span></li>)}
          </ul>}
      </section>

      <section className="mt-10 flex flex-wrap gap-3 border-t pt-8">
        <button className="btn btn-ghost" onClick={() => setState((s) => ({ ...s, meds: s.meds.map((x) => x.id === id ? { ...x, status: x.status === "paused" ? "active" : "paused" } : x) }), `${m.status === "paused" ? "Resumed" : "Paused"} ${m.name}`)}>
          {m.status === "paused" ? "Resume reminders" : "Pause reminders"}</button>
        {m.status !== "archived" && <Button variant="outline" onClick={() => setAsk("archive")}>Remove from plan</Button>}
        <button className="btn text-destructive" onClick={() => setAsk("delete")}>Delete</button>
      </section>

      <Confirm open={ask === "archive"} title={`Remove ${m.name}?`} body="This removes the medicine from your current plan and stops its reminders and refill alerts. Your dose history will be kept." confirmLabel="Remove"
        onCancel={() => setAsk(null)} onConfirm={() => { removeMedicine(id); setAsk(null); navigate({ to: "/dashboard" }); }} />
      <Confirm open={ask === "delete"} danger title="Delete this medicine?" body="This permanently removes the medicine and its history. This can’t be undone." confirmLabel="Delete"
        onCancel={() => setAsk(null)} onConfirm={() => { setState((s) => ({ ...s, meds: s.meds.filter((x) => x.id !== id), logs: s.logs.filter((l) => l.medId !== id) }), `Deleted ${m.name}`); navigate({ to: "/dashboard" }); }} />
    </>
  );
}
