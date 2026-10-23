import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Confirm, Empty, Field } from "@/components/site";
import { daysLeft, setState, uid, useStore } from "@/lib/store";

export const Route = createFileRoute("/reorder/$id")({
  head: () => ({
    meta: [
      { title: "Reorder — Medileaf" },
      { name: "description", content: "Reorder a medicine from your plan." },
      { property: "og:title", content: "Reorder — Medileaf" },
      { property: "og:description", content: "Simple, confirmed medicine reorders." },
    ],
  }),
  component: () => <AppShell><Reorder /></AppShell>,
});

function Reorder() {
  const { id } = Route.useParams();
  const m = useStore((s) => s.meds.find((x) => x.id === id));
  const [qty, setQty] = useState(m?.quantity ?? 30);
  const [pharmacy, setPharmacy] = useState("Local pharmacy — pickup");
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState(false);
  if (!m) return <Empty title="Medicine not found" body="It may have been removed." action={<Link to="/refills" className="btn btn-primary">Back to refills</Link>} />;

  if (done) return <Empty title="Order request sent" body={`${pharmacy} will contact you to confirm ${m.name} × ${qty}. Your supply will update when you mark it received.`}
    action={<div className="flex gap-3"><Link to="/refills" className="btn btn-primary">Back to refills</Link><button className="btn btn-ghost" onClick={() => setState((s) => ({ ...s, meds: s.meds.map((x) => x.id === id ? { ...x, remaining: x.remaining + qty, quantity: Math.max(x.quantity, x.remaining + qty) } : x) }), `Received refill of ${m.name}`)}>Mark as received</button></div>} />;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/refills" className="text-sm font-semibold text-primary">← Refills</Link>
      <h1 className="mt-4 text-5xl">Reorder {m.name}</h1>
      <section className="surface mt-8 p-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-muted-foreground">Medicine</dt><dd className="font-semibold">{m.name} {m.strength}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Supply left</dt><dd className="font-semibold">{m.remaining} ({daysLeft(m)} days)</dd></div>
          <div><dt className="text-sm text-muted-foreground">Prescription</dt><dd className="font-semibold">{m.source === "prescription" ? "Verified" : "Not on file"}</dd></div>
        </dl>
        {m.source !== "prescription" && <p className="mt-4 rounded-md bg-warning-soft p-3 text-sm">Your pharmacy may ask for a valid prescription before dispensing.</p>}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Field label="Quantity"><input type="number" min={1} max={365} className="field" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(365, +e.target.value || 1)))} /></Field>
          <Field label="Pharmacy"><select className="field" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)}>
            <option>Local pharmacy — pickup</option><option>Local pharmacy — home delivery</option><option>Online pharmacy</option>
          </select></Field>
        </div>
        <button className="btn btn-primary mt-8 w-full" onClick={() => setAsk(true)}>Review order</button>
      </section>
      <Confirm open={ask} title="Send this order?" body={`${m.name} ${m.strength} × ${qty} to ${pharmacy}. Nothing is charged until the pharmacy confirms.`} confirmLabel="Send order"
        onCancel={() => setAsk(false)} onConfirm={() => { setState((s) => ({ ...s, orders: [{ id: uid(), medId: id, qty, pharmacy, createdAt: new Date().toISOString(), status: "submitted" }, ...s.orders] }), `Reordered ${m.name}`); setAsk(false); setDone(true); }} />
    </div>
  );
}
