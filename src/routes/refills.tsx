import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Empty, PageTitle } from "@/components/site";
import { daysLeft, needsRefill, useStore } from "@/lib/store";
import { ORDER_STATUS_LABEL } from "@/lib/admin-logic";

export const Route = createFileRoute("/refills")({
  head: () => ({
    meta: [
      { title: "Refills — Medileaf" },
      { name: "description", content: "See how many days of each medicine you have left." },
      { property: "og:title", content: "Refills — Medileaf" },
      { property: "og:description", content: "Refill timeline for your medicines." },
    ],
  }),
  component: () => <AppShell><Refills /></AppShell>,
});

function Refills() {
  const meds = useStore((s) => s.meds).filter((m) => m.status !== "archived");
  const threshold = useStore((s) => s.prefs.refillDays);
  const orders = useStore((s) => s.orders);
  const sorted = [...meds].sort((a, b) => daysLeft(a) - daysLeft(b));
  if (!meds.length) return <><PageTitle title="Refills" /><Empty title="Nothing to refill" body="Add a medicine to see its supply here." action={<Link to="/upload" className="btn btn-primary">Upload prescription</Link>} /></>;
  return (
    <>
      <PageTitle title="Refills" sub={`We’ll alert you when a medicine is down to ${threshold} days.`} />
      <ul className="space-y-4">
        {sorted.map((m) => {
          const left = daysLeft(m);
          const urgent = needsRefill(m, threshold);
          const runOut = new Date(Date.now() + left * 864e5).toLocaleDateString(undefined, { day: "numeric", month: "short" });
          return (
            <li key={m.id} className="surface flex flex-wrap items-center gap-6 p-6">
              <div className="min-w-48 flex-1">
                <Link to="/medications/$id" params={{ id: m.id }} className="text-xl font-semibold">{m.name} <span className="font-normal text-muted-foreground">{m.strength}</span></Link>
                <div className="mt-3 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${urgent ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, (m.remaining / m.quantity) * 100)}%` }} /></div>
                <p className="mt-2 text-sm text-muted-foreground">{m.remaining} left · runs out around {runOut}</p>
              </div>
              <p className={`font-display text-4xl ${urgent ? "text-warning" : ""}`}>{left}<span className="text-lg"> days</span></p>
              <Link to="/reorder/$id" params={{ id: m.id }} className={`btn ${urgent ? "btn-primary" : "btn-ghost"}`}>Reorder</Link>
            </li>
          );
        })}
      </ul>
      {orders.length > 0 && <>
        <h2 className="mt-14 text-3xl">Recent orders</h2>
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {orders.map((o) => <li key={o.id} className="flex justify-between px-5 py-3"><span>{meds.find((m) => m.id === o.medId)?.name ?? "Medicine"} × {o.qty} · {o.pharmacy}</span><span className="text-muted-foreground">{ORDER_STATUS_LABEL[o.status]} · {new Date(o.createdAt).toLocaleDateString()}</span></li>)}
        </ul>
      </>}
    </>
  );
}
