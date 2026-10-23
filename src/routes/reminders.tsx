import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Field, PageTitle, Toggle } from "@/components/site";
import { fmtTime, setState, useStore } from "@/lib/store";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Medileaf" },
      { name: "description", content: "Customise reminder times, snooze, quiet hours and missed-dose alerts." },
      { property: "og:title", content: "Reminders — Medileaf" },
      { property: "og:description", content: "Reminders that fit your day." },
    ],
  }),
  component: () => <AppShell><Reminders /></AppShell>,
});

function Reminders() {
  const prefs = useStore((s) => s.prefs);
  const meds = useStore((s) => s.meds).filter((m) => m.status === "active");
  const set = (p: Partial<typeof prefs>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } }));
  const setTime = (id: string, i: number, v: string) =>
    setState((s) => ({ ...s, meds: s.meds.map((m) => m.id === id ? { ...m, times: m.times.map((t, j) => j === i ? v : t) } : m) }));

  return (
    <>
      <PageTitle title="Reminders" sub="Changes are saved automatically." />
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="surface p-8">
          <h2 className="text-3xl">Reminder times</h2>
          {meds.length === 0 ? <p className="mt-4 text-muted-foreground">No active medicines. <Link to="/upload" className="text-primary underline">Upload a prescription</Link>.</p> :
            <ul className="mt-6 space-y-6">
              {meds.map((m) => (
                <li key={m.id}>
                  <p className="font-semibold">{m.name} {m.strength}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.times.map((t, i) => <input key={i} type="time" aria-label={`${m.name} reminder ${fmtTime(t)}`} className="field w-36" value={t} onChange={(e) => setTime(m.id, i, e.target.value)} />)}
                  </div>
                </li>
              ))}
            </ul>}
        </section>
        <section className="surface divide-y p-8">
          <h2 className="pb-4 text-3xl">Behaviour</h2>
          <Toggle label="Sound" desc="Play a gentle chime" checked={prefs.sound} onChange={(v) => set({ sound: v })} />
          <div className="py-4"><Field label="Snooze for"><select className="field" value={prefs.snoozeMinutes} onChange={(e) => set({ snoozeMinutes: +e.target.value })}>
            {[5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></Field></div>
          <Toggle label="Missed-dose follow-up" desc="Remind again if I don’t respond" checked={prefs.escalate} onChange={(v) => set({ escalate: v })} />
          {prefs.escalate && <div className="py-4"><Field label="Follow up after"><select className="field" value={prefs.missedWindow} onChange={(e) => set({ missedWindow: +e.target.value })}>
            {[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></Field></div>}
          <div className="grid grid-cols-2 gap-4 py-4">
            <Field label="Quiet hours from"><input type="time" className="field" value={prefs.quietStart} onChange={(e) => set({ quietStart: e.target.value })} /></Field>
            <Field label="Until"><input type="time" className="field" value={prefs.quietEnd} onChange={(e) => set({ quietEnd: e.target.value })} /></Field>
          </div>
          <p className="pt-4 text-sm text-muted-foreground">Doses scheduled during quiet hours will still remind you, silently.</p>
        </section>
      </div>
    </>
  );
}
