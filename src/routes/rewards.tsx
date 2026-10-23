import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AppShell, Field, PageTitle } from "@/components/site";
import { useStore } from "@/lib/store";
import { claimReward, getMyRewards, submitReturn } from "@/lib/rewards.functions";
import { SnapAndCount } from "@/components/snap-and-count";
import {
  CLAIM_STATUS_LABEL, MAX_SEEDS_PER_CLAIM, RETURN_ADDRESS, RETURN_STATUS_LABEL, REWARD_TIERS, SEEDS,
  canClaim, isClaimStatus, nextGoal, type RewardTier, type SeedId,
} from "@/lib/rewards-logic";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Eco rewards — Medileaf" },
      { name: "description", content: "Send back empty medicine wrappers and expired medicines and earn free flower seeds." },
      { property: "og:title", content: "Eco rewards — Medileaf" },
      { property: "og:description", content: "Return 50 wrappers or expired medicines and choose free flower seeds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Rewards /></AppShell>,
});

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function useRewards() {
  const email = useStore((s) => s.user?.email);
  const f = useServerFn(getMyRewards);
  return useQuery({ queryKey: ["rewards", email], queryFn: () => f(), enabled: !!email, refetchInterval: 30_000 });
}

function Rewards() {
  const q = useRewards();
  const [sending, setSending] = useState(false);
  const [slip, setSlip] = useState<{ code: string; wrappers: number; bottles: number; expired: number } | null>(null);

  if (q.isLoading) return <p className="text-muted-foreground">Loading your rewards…</p>;
  if (q.error) return <p role="alert" className="rounded-md bg-warning-soft p-4">Couldn't load your rewards: {q.error.message}</p>;
  const { total, submissions, claims } = q.data ?? { total: 0, submissions: [], claims: [] };
  const claimed = claims.map((c) => c.tier);
  const goal = nextGoal(total);
  const firstGoal = REWARD_TIERS[0].items;
  const claimable = REWARD_TIERS.find((t) => canClaim(total, t.items, claimed));
  const pending = submissions.filter((s) => s.status === "pending").reduce((n, s) => n + s.wrappers + s.bottles + s.expired, 0);

  return (
    <>
      <PageTitle title="Eco rewards" sub="Send back empty medicine wrappers and expired medicines. Every 50 items earns you free flower seeds."
        action={!sending && !slip && <button className="btn btn-green" onClick={() => setSending(true)}>Send wrappers & expired meds</button>} />

      <div className="grid gap-6 md:grid-cols-3">
        <section className="surface flex flex-col items-center p-8 text-center md:col-span-1">
          <Gauge value={Math.min(total - goal.start, goal.goal - goal.start)} max={goal.goal - goal.start} label={`${total} / ${goal.goal}`} />
          <p className="mt-4 font-semibold">{goal.remaining > 0 ? `${goal.remaining} more items to unlock ${goal.name?.toLowerCase()}` : "You've reached every reward level"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Lifetime total — it never resets.</p>
          {pending > 0 && <p className="mt-3 rounded-full bg-muted px-3 py-1 text-sm">{pending} items on their way to be checked</p>}
        </section>
        <section className="surface p-8 md:col-span-2">
          <h2 className="text-3xl">Reward levels</h2>
          <ol className="mt-6 space-y-3">
            {REWARD_TIERS.map((t) => {
              const done = claimed.includes(t.items), open = total >= t.items;
              return (
                <li key={t.items} className="flex items-center gap-4 rounded-xl border p-4">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl ${open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t.items}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-sm text-muted-foreground">{t.items} checked items</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${done ? "bg-muted" : open ? "bg-accent text-accent-foreground" : "border text-muted-foreground"}`}>
                    {done ? "Claimed" : open ? "Ready to claim" : `Locked · ${t.items - total} to go`}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {sending && <ReturnForm onCancel={() => setSending(false)} onDone={(s) => { setSending(false); setSlip(s); }} />}
      {slip && <ReturnSlip slip={slip} onClose={() => setSlip(null)} />}

      <h2 className="mt-14 text-4xl">Choose your flower seeds</h2>
      {claimable ? (
        <ClaimForm tier={claimable.items} tierName={claimable.name} />
      ) : (
        <>
          <p className="mt-2 text-muted-foreground" role="status">
            {total < firstGoal
              ? `Locked until ${firstGoal} items have been checked. You need ${firstGoal - total} more.`
              : goal.remaining > 0 ? `Your next seeds unlock at ${goal.goal} items — ${goal.remaining} to go.` : "You've claimed every reward. Thank you for recycling!"}
          </p>
          <SeedGrid selected={[]} locked />
        </>
      )}

      {claims.length > 0 && (
        <>
          <h2 className="mt-14 text-3xl">Your seed orders</h2>
          <ul className="mt-4 divide-y rounded-xl border bg-card">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <div className="font-semibold">{REWARD_TIERS.find((t) => t.items === c.tier)?.name}</div>
                  <div className="text-sm text-muted-foreground">{c.seeds.map((id) => SEEDS.find((s) => s.id === id)?.name ?? id).join(", ")} · claimed {fmt(c.created_at)}</div>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">{isClaimStatus(c.status) ? CLAIM_STATUS_LABEL[c.status] : c.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-14 text-3xl">Your returns</h2>
      {submissions.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No returns yet. Start by sending your empty wrappers and expired medicines.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {submissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-56 flex-1">
                <div className="font-semibold">Return {s.code}</div>
                <div className="text-sm text-muted-foreground">{s.wrappers} wrappers · {s.bottles} bottles · {s.expired} expired medicines · sent {fmt(s.created_at)}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.status === "rejected" ? "bg-warning-soft" : "bg-muted"}`}>
                {s.status === "verified" ? `+${s.verified_count} items credited` : RETURN_STATUS_LABEL[s.status] ?? s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 70, c = 2 * Math.PI * r, pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 1;
  return (
    <div className="relative h-44 w-44" role="img" aria-label={`${label} checked items`}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="14" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-success)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 600ms ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-4xl">{label}</span>
      </div>
    </div>
  );
}

function ReturnForm({ onCancel, onDone }: { onCancel: () => void; onDone: (s: { code: string; wrappers: number; bottles: number; expired: number }) => void }) {
  const [v, setV] = useState({ wrappers: "", bottles: "", expired: "", tracking: "", note: "" });
  const qc = useQueryClient();
  const send = useServerFn(submitReturn);
  const m = useMutation({
    mutationFn: () => send({ data: { wrappers: Number(v.wrappers || 0), bottles: Number(v.bottles || 0), expired: Number(v.expired || 0), tracking: v.tracking, note: v.note } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["rewards"] }); onDone({ code: r.code, wrappers: Number(v.wrappers || 0), bottles: Number(v.bottles || 0), expired: Number(v.expired || 0) }); },
  });
  const num = (k: "wrappers" | "bottles" | "expired", label: string) => (
    <Field label={label}><input className="field" type="number" inputMode="numeric" min={0} max={500} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder="0" /></Field>
  );
  return (
    <form className="surface mt-6 space-y-5 p-8" onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
      <h2 className="text-3xl">What are you sending?</h2>
      <SnapAndCount onApply={(r) => setV((cur) => ({ ...cur, wrappers: String(r.wrappers), bottles: String(r.bottles), expired: String(r.expired),
        note: `AI photo count: ${r.wrappers} strips, ${r.bottles} bottles, ${r.expired} expired.${cur.note ? " " + cur.note : ""}`.slice(0, 300) }))} />
      <div className="grid gap-4 sm:grid-cols-3">
        {num("wrappers", "Empty blister packs / strips")}
        {num("bottles", "Empty pill bottles")}
        {num("expired", "Expired medicines")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Courier tracking number (optional)"><input className="field" maxLength={80} value={v.tracking} onChange={(e) => setV({ ...v, tracking: e.target.value })} /></Field>
        <Field label="Note for our team (optional)"><input className="field" maxLength={300} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
      <p className="text-sm text-muted-foreground">Items count once our team receives and checks your parcel.</p>
      {m.error && <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm">{m.error.message}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-green" disabled={m.isPending}>{m.isPending ? "Creating slip…" : "Create return slip"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ReturnSlip({ slip, onClose }: { slip: { code: string; wrappers: number; bottles: number; expired: number }; onClose: () => void }) {
  return (
    <section className="surface mt-6 p-8" aria-labelledby="slip-title">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Return slip</p>
      <h2 id="slip-title" className="mt-2 font-display text-5xl">{slip.code}</h2>
      <p className="mt-2 text-muted-foreground">Write this code on your parcel or put this slip inside.</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="font-semibold">Send to</div>
          <address className="not-italic text-muted-foreground">{RETURN_ADDRESS.map((l) => <div key={l}>{l}</div>)}</address>
        </div>
        <div>
          <div className="font-semibold">In this parcel</div>
          <div className="text-muted-foreground">{slip.wrappers} blister packs · {slip.bottles} pill bottles · {slip.expired} expired medicines</div>
        </div>
      </div>
      <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Keep expired medicines in their original packaging and seal the parcel well.</li>
        <li>Don't send needles, sharps, inhalers or liquids.</li>
        <li>Your progress updates once our team counts the items.</li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print slip</button>
        <button className="btn btn-green" onClick={onClose}>Done</button>
      </div>
    </section>
  );
}

function SeedGrid({ selected, locked, onToggle }: { selected: SeedId[]; locked?: boolean; onToggle?: (id: SeedId) => void }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SEEDS.map((s) => {
        const on = selected.includes(s.id);
        return (
          <button key={s.id} type="button" disabled={locked} aria-pressed={on} onClick={() => onToggle?.(s.id)}
            className={`surface p-6 text-left transition ${on ? "border-primary ring-2 ring-primary" : ""} ${locked ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-2xl">{s.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${locked ? "bg-muted" : on ? "bg-primary text-primary-foreground" : "border"}`}>{locked ? "Locked" : on ? "Chosen" : "Choose"}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{s.note}</p>
          </button>
        );
      })}
    </div>
  );
}

function ClaimForm({ tier, tierName }: { tier: RewardTier; tierName: string }) {
  const user = useStore((s) => s.user);
  const [seeds, setSeeds] = useState<SeedId[]>([]);
  const [ship, setShip] = useState({ name: user?.name ?? "", address: "", phone: "" });
  const qc = useQueryClient();
  const claim = useServerFn(claimReward);
  const m = useMutation({
    mutationFn: () => claim({ data: { tier, seeds, ...ship } }),
    onSuccess: () => { setSeeds([]); qc.invalidateQueries({ queryKey: ["rewards"] }); },
  });
  const toggle = (id: SeedId) => setSeeds((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SEEDS_PER_CLAIM ? s : [...s, id]));
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <p className="mt-2 text-muted-foreground">You've unlocked the <strong className="text-foreground">{tierName.toLowerCase()}</strong>. Pick up to {MAX_SEEDS_PER_CLAIM} varieties ({seeds.length} chosen).</p>
      <SeedGrid selected={seeds} onToggle={toggle} />
      <div className="surface mt-6 grid gap-4 p-8 sm:grid-cols-2">
        <h3 className="font-display text-2xl sm:col-span-2">Where should we send them?</h3>
        <Field label="Full name"><input className="field" required maxLength={120} value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} /></Field>
        <Field label="Phone (optional)"><input className="field" type="tel" maxLength={30} value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Delivery address"><textarea className="field min-h-24 py-3" required minLength={10} maxLength={500} value={ship.address} onChange={(e) => setShip({ ...ship, address: e.target.value })} /></Field>
        </div>
        {m.error && <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm sm:col-span-2">{m.error.message}</p>}
        <div className="sm:col-span-2">
          <button className="btn btn-green" disabled={m.isPending || seeds.length === 0}>{m.isPending ? "Sending request…" : "Request free seeds"}</button>
        </div>
      </div>
    </form>
  );
}
