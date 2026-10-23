import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackButton, Field, Logo, Toggle } from "@/components/site";
import { getState, seedDemo, setState, useStore } from "@/lib/store";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up — Medileaf" },
      { name: "description", content: "Set your reminder and refill preferences." },
      { property: "og:title", content: "Set up — Medileaf" },
      { property: "og:description", content: "Personalise reminders and refills." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const prefs = useStore((s) => s.prefs);
  const [step, setStep] = useState(0);
  const set = (p: Partial<typeof prefs>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } }));

  async function askPermission() {
    if ("Notification" in window) {
      const r = await Notification.requestPermission();
      set({ push: r === "granted" });
    }
    setStep(2);
  }
  function finish(demo: boolean) {
    setState((s) => ({ ...s, onboarded: true }), "Completed onboarding");
    if (demo && getState().meds.length === 0) seedDemo();
    navigate({ to: demo ? "/dashboard" : "/upload" });
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <BackButton />
      <Logo />
      <div className="mt-10 flex gap-2" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-input"}`} />)}
      </div>
      {step === 0 && (
        <section className="mt-10">
          <h1 className="text-5xl">How should we remind you?</h1>
          <div className="surface mt-8 divide-y px-6">
            <Toggle label="Reminder sound" checked={prefs.sound} onChange={(v) => set({ sound: v })} />
            <Toggle label="Remind me again if I miss a dose" checked={prefs.escalate} onChange={(v) => set({ escalate: v })} />
            <div className="grid grid-cols-2 gap-4 py-4">
              <Field label="Quiet hours from"><input type="time" className="field" value={prefs.quietStart} onChange={(e) => set({ quietStart: e.target.value })} /></Field>
              <Field label="Until"><input type="time" className="field" value={prefs.quietEnd} onChange={(e) => set({ quietEnd: e.target.value })} /></Field>
            </div>
          </div>
          <button className="btn btn-primary mt-8 w-full" onClick={() => setStep(1)}>Continue</button>
        </section>
      )}
      {step === 1 && (
        <section className="mt-10">
          <h1 className="text-5xl">Allow notifications</h1>
          <p className="mt-4 text-lg text-muted-foreground">So we can remind you when a dose is due — even when Medileaf isn’t open.</p>
          <button className="btn btn-primary mt-8 w-full" onClick={askPermission}>Allow notifications</button>
          <button className="btn mt-3 w-full" onClick={() => setStep(2)}>Not now</button>
        </section>
      )}
      {step === 2 && (
        <section className="mt-10">
          <h1 className="text-5xl">Refill alerts</h1>
          <Field label="Warn me when supply is down to"><select className="field mt-6" value={prefs.refillDays} onChange={(e) => set({ refillDays: +e.target.value })}>
            {[3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select></Field>
          <button className="btn btn-primary mt-8 w-full" onClick={() => finish(false)}>Upload my first prescription</button>
          <button className="btn btn-ghost mt-3 w-full" onClick={() => finish(true)}>Explore with sample medicines</button>
        </section>
      )}
    </div>
  );
}
