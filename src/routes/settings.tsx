import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Field, PageTitle, Toggle } from "@/components/site";
import { setState, useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Notifications & devices — Medileaf" },
      { name: "description", content: "Choose how Medileaf notifies you and manage synced devices." },
      { property: "og:title", content: "Notifications & devices — Medileaf" },
      { property: "og:description", content: "Notification and device settings." },
    ],
  }),
  component: () => <AppShell><Settings /></AppShell>,
});

function Settings() {
  const prefs = useStore((s) => s.prefs);
  const set = (p: Partial<typeof prefs>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } }));
  return (
    <>
      <PageTitle title="Notifications & devices" />
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="surface divide-y p-8">
          <h2 className="pb-4 text-3xl">Notify me by</h2>
          <Toggle label="Push notifications" desc="On this device" checked={prefs.push} onChange={async (v) => {
            if (v && !("Notification" in window)) { alert("This browser doesn't support notifications."); return; }
            if (v) { const r = await Notification.requestPermission(); set({ push: r === "granted" }); if (r !== "granted") alert("Notifications are blocked. Allow them in your browser's site settings."); } else set({ push: v });
          }} />
          {prefs.push && (
            <div className="py-4">
              <button className="btn btn-ghost" onClick={() => {
                if (!("Notification" in window)) return alert("This browser doesn't support notifications.");
                if (Notification.permission !== "granted") return alert("Notifications are blocked. Allow them in your browser's site settings.");
                new Notification("Medileaf reminder", { body: "This is how your dose reminders will look.", icon: "/favicon.png" });
              }}>Send a test notification</button>
            </div>
          )}
          <Toggle label="Email" desc="Refill alerts and weekly summary" checked={prefs.email} onChange={(v) => set({ email: v })} />
          <div className="py-4"><Field label="Refill alert when supply reaches"><select className="field" value={prefs.refillDays} onChange={(e) => set({ refillDays: +e.target.value })}>
            {[3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} days</option>)}</select></Field></div>
        </section>
        <section className="surface p-8">
          <h2 className="text-3xl">Devices</h2>
          <ul className="mt-6 divide-y">
            <li className="flex justify-between py-4"><span><strong>This browser</strong><br /><span className="text-sm text-muted-foreground">Active now</span></span><span className="text-sm font-semibold text-success">● Synced</span></li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">Sign in on another device to keep reminders in sync.</p>
        </section>
      </div>
    </>
  );
}
