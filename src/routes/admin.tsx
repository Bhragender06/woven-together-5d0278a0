import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell, Confirm, Empty, PageTitle } from "@/components/site";
import { useIsAdmin } from "@/lib/use-admin";
import {
  getAdminOrders, getAdminRecycling, getAdminUploads, getAdminUsers, getRefillAlerts, getUploadLink, setUserSuspended, updateClaimStatus, updateOrderStatus, verifyReturn,
} from "@/lib/admin.functions";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/admin-logic";
import { CLAIM_STATUSES, CLAIM_STATUS_LABEL, REWARD_TIERS, SEEDS, type ClaimStatus } from "@/lib/rewards-logic";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Medileaf" },
      { name: "description", content: "Manage Medileaf orders, users, prescription uploads and refill alerts." },
      { property: "og:title", content: "Admin panel — Medileaf" },
      { property: "og:description", content: "Medileaf admin tools for orders and accounts." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <AppShell><Admin /></AppShell>,
});

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "users", label: "Users" },
  { id: "uploads", label: "Prescription uploads" },
  { id: "refills", label: "Refill alerts" },
  { id: "eco", label: "Eco & recycling" },
] as const;
type Tab = (typeof tabs)[number]["id"];

const fmtDate = (d: string) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function useAdminData() {
  const fOrders = useServerFn(getAdminOrders);
  const fUsers = useServerFn(getAdminUsers);
  const fUploads = useServerFn(getAdminUploads);
  const fAlerts = useServerFn(getRefillAlerts);
  const fEco = useServerFn(getAdminRecycling);
  return {
    eco: useQuery({ queryKey: ["admin", "eco"], queryFn: () => fEco() }),
    orders: useQuery({ queryKey: ["admin", "orders"], queryFn: () => fOrders() }),
    users: useQuery({ queryKey: ["admin", "users"], queryFn: () => fUsers() }),
    uploads: useQuery({ queryKey: ["admin", "uploads"], queryFn: () => fUploads() }),
    alerts: useQuery({ queryKey: ["admin", "alerts"], queryFn: () => fAlerts() }),
  };
}

function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const [tab, setTab] = useState<Tab>("overview");
  if (loading) return <p className="text-muted-foreground">Checking access…</p>;
  if (!isAdmin) return <Empty title="Admins only" body="This area is for Medileaf admins. Ask an admin if you need access." action={<Link to="/dashboard" className="btn btn-primary">Go to Today</Link>} />;
  return (
    <>
      <PageTitle title="Admin panel" sub="Orders, accounts, uploads and refills across Medileaf." />
      <div role="tablist" aria-label="Admin sections" className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${tab === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <AdminBody tab={tab} go={setTab} />
    </>
  );
}

function AdminBody({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const d = useAdminData();
  if (tab === "overview") return <Overview d={d} go={go} />;
  if (tab === "orders") return <Orders q={d.orders} />;
  if (tab === "users") return <Users q={d.users} />;
  if (tab === "uploads") return <Uploads q={d.uploads} />;
  if (tab === "eco") return <Eco q={d.eco} />;
  return <Alerts q={d.alerts} />;
}

type Q<T> = { data: T | undefined; isLoading: boolean; error: Error | null };
function ListState<T>({ q, empty, children }: { q: Q<T[]>; empty: [string, string]; children: (rows: T[]) => ReactNode }) {
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error) return <p role="alert" className="rounded-md bg-warning-soft p-4">Couldn't load this list: {q.error.message}</p>;
  if (!q.data?.length) return <Empty title={empty[0]} body={empty[1]} />;
  return <>{children(q.data)}</>;
}

function Overview({ d, go }: { d: ReturnType<typeof useAdminData>; go: (t: Tab) => void }) {
  const orders = d.orders.data ?? [];
  const users = d.users.data ?? [];
  const cards: { label: string; value: number | string; tab: Tab; note?: string }[] = [
    { label: "Users", value: users.length, tab: "users", note: `${users.filter((u) => u.status === "suspended").length} suspended` },
    { label: "New orders", value: orders.filter((o) => o.status === "submitted").length, tab: "orders", note: `${orders.length} orders in total` },
    { label: "Active medicines", value: users.reduce((n, u) => n + u.activeMeds, 0), tab: "users", note: "across all users" },
    { label: "Prescription uploads", value: d.uploads.data?.length ?? 0, tab: "uploads", note: `${(d.uploads.data ?? []).filter((u) => u.status === "failed").length} couldn't be read` },
    { label: "Refill alerts", value: d.alerts.data?.length ?? 0, tab: "refills", note: "running low now" },
    { label: "Parcels to check", value: (d.eco.data?.returns ?? []).filter((r) => r.status === "pending").length, tab: "eco", note: `${(d.eco.data?.claims ?? []).filter((c) => c.status === "processing").length} seed orders to send` },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <button key={c.label} onClick={() => go(c.tab)} className="surface p-6 text-left transition hover:-translate-y-0.5">
            <div className="text-sm font-semibold text-muted-foreground">{c.label}</div>
            <div className="mt-2 font-display text-5xl">{d.orders.isLoading || d.users.isLoading ? "…" : c.value}</div>
            {c.note && <div className="mt-1 text-sm text-muted-foreground">{c.note}</div>}
          </button>
        ))}
      </div>
      <h2 className="mt-12 text-3xl">Latest orders</h2>
      <div className="mt-4"><Orders q={{ ...d.orders, data: orders.slice(0, 5) }} compact /></div>
    </>
  );
}

type OrderRow = Awaited<ReturnType<typeof getAdminOrders>>[number];
function Orders({ q, compact }: { q: Q<OrderRow[]>; compact?: boolean }) {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const update = useServerFn(updateOrderStatus);
  const m = useMutation({
    mutationFn: (v: { orderId: string; status: OrderStatus }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "orders"] }),
  });
  const rows = useMemo(() => (q.data ?? []).filter((o) => (filter === "all" || o.status === filter)
    && (!search || `${o.customer} ${o.email} ${o.medicine} ${o.pharmacy}`.toLowerCase().includes(search.toLowerCase()))), [q.data, filter, search]);
  return (
    <>
      {!compact && (
        <div className="mb-4 flex flex-wrap gap-3">
          <input className="field max-w-xs" placeholder="Search customer or medicine" aria-label="Search orders" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field max-w-60" aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | "all")}>
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      )}
      {m.error && <p role="alert" className="mb-4 rounded-md bg-warning-soft p-3 text-sm">Couldn't update the order: {m.error.message}</p>}
      <ListState q={{ ...q, data: q.data ? rows : undefined }} empty={["No orders yet", "Orders appear here when people reorder from their Refills page."]}>
        {(list) => (
          <ul className="divide-y rounded-xl border bg-card">
            {list.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <div className="font-semibold">{o.medicine} × {o.quantity}</div>
                  <div className="text-sm text-muted-foreground">{o.customer}{o.email && ` · ${o.email}`} · {o.pharmacy} · {fmtDate(o.createdAt)}</div>
                </div>
                <select className="field max-w-60" aria-label={`Status for ${o.medicine} order from ${o.customer}`} value={o.status} disabled={m.isPending}
                  onChange={(e) => m.mutate({ orderId: o.id, status: e.target.value as OrderStatus })}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </ListState>
    </>
  );
}

type UserRow = Awaited<ReturnType<typeof getAdminUsers>>[number];
function Users({ q }: { q: Q<UserRow[]> }) {
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState<UserRow | null>(null);
  const qc = useQueryClient();
  const suspend = useServerFn(setUserSuspended);
  const m = useMutation({
    mutationFn: (v: { userId: string; suspended: boolean }) => suspend({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const rows = (q.data ?? []).filter((u) => !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <input className="field mb-4 max-w-xs" placeholder="Search name or email" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
      {m.error && <p role="alert" className="mb-4 rounded-md bg-warning-soft p-3 text-sm">Couldn't change this account: {m.error.message}</p>}
      <ListState q={{ ...q, data: q.data ? rows : undefined }} empty={["No users found", "Accounts appear here once people sign up."]}>
        {(list) => (
          <ul className="divide-y rounded-xl border bg-card">
            {list.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <div className="font-semibold">{u.name || "No name"} {u.isAdmin && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Admin</span>}
                    {u.status === "suspended" && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs">Suspended</span>}</div>
                  <div className="text-sm text-muted-foreground">{u.email} · joined {new Date(u.joined).toLocaleDateString()}</div>
                </div>
                <div className="text-sm text-muted-foreground">{u.activeMeds} medicines · {u.orders} orders · {u.uploads} uploads</div>
                {!u.isYou && (
                  <button className={`btn ${u.status === "suspended" ? "btn-green" : "btn-ghost"}`} disabled={m.isPending} onClick={() => setAsk(u)}>
                    {u.status === "suspended" ? "Reactivate" : "Suspend"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </ListState>
      <Confirm open={!!ask} danger={ask?.status !== "suspended"}
        title={ask?.status === "suspended" ? "Reactivate this account?" : "Suspend this account?"}
        body={ask?.status === "suspended" ? `${ask?.email} will be able to sign in again.` : `${ask?.email} won't be able to sign in until you reactivate them. Their data is kept.`}
        confirmLabel={ask?.status === "suspended" ? "Reactivate" : "Suspend"}
        onCancel={() => setAsk(null)}
        onConfirm={() => { if (ask) m.mutate({ userId: ask.id, suspended: ask.status !== "suspended" }); setAsk(null); }} />
    </>
  );
}

type UploadRow = Awaited<ReturnType<typeof getAdminUploads>>[number];
const uploadLabel: Record<string, string> = { uploaded: "Waiting", processing: "Reading", needs_review: "Waiting for user to confirm", verified: "Confirmed by user", failed: "Couldn't read" };
function Uploads({ q }: { q: Q<UploadRow[]> }) {
  const link = useServerFn(getUploadLink);
  const [err, setErr] = useState("");
  async function open(id: string) {
    setErr("");
    const w = window.open("", "_blank");
    try { const { url } = await link({ data: { id } }); if (w) w.location.href = url; else window.location.href = url; }
    catch (e) { w?.close(); setErr(e instanceof Error ? e.message : "Couldn't open the file"); }
  }
  return (
    <>
      {err && <p role="alert" className="mb-4 rounded-md bg-warning-soft p-3 text-sm">{err}</p>}
      <ListState q={q} empty={["No uploads yet", "Prescription photos appear here when people upload them."]}>
        {(list) => (
          <ul className="divide-y rounded-xl border bg-card">
            {list.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <div className="font-semibold">{u.customer} <span className="font-normal text-muted-foreground">{u.email}</span></div>
                  <div className="text-sm text-muted-foreground">{fmtDate(u.uploadedAt)} · {u.medicines} medicines found · {u.verified} confirmed by user
                    {u.confidence !== null && ` · ${Math.round(u.confidence * (u.confidence <= 1 ? 100 : 1))}% confidence`}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${u.status === "failed" ? "bg-warning-soft" : "bg-muted"}`}>{uploadLabel[u.status] ?? u.status}</span>
                {u.hasFile && <button className="btn btn-ghost" onClick={() => open(u.id)}>View file</button>}
              </li>
            ))}
          </ul>
        )}
      </ListState>
    </>
  );
}

type AlertRow = Awaited<ReturnType<typeof getRefillAlerts>>[number];
function Alerts({ q }: { q: Q<AlertRow[]> }) {
  return (
    <ListState q={q} empty={["No one is running low", "Medicines show up here when they reach the user's refill-alert level."]}>
      {(list) => (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((a) => (
            <li key={a.medicationId} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-56 flex-1">
                <div className="font-semibold">{a.medicine}</div>
                <div className="text-sm text-muted-foreground">{a.customer}{a.email && ` · ${a.email}`} · {a.remaining} left · alert at {a.thresholdDays} days</div>
              </div>
              <p className={`font-display text-3xl ${a.daysLeft <= 1 ? "text-warning" : ""}`}>{a.daysLeft}<span className="text-base"> days</span></p>
            </li>
          ))}
        </ul>
      )}
    </ListState>
  );
}

type EcoData = Awaited<ReturnType<typeof getAdminRecycling>>;
function Eco({ q }: { q: Q<EcoData> }) {
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const verify = useServerFn(verifyReturn);
  const setClaim = useServerFn(updateClaimStatus);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "eco"] });
  const mv = useMutation({ mutationFn: (v: { id: string; count: number; reject?: boolean }) => verify({ data: v }), onSuccess: refresh });
  const mc = useMutation({ mutationFn: (v: { id: string; status: ClaimStatus }) => setClaim({ data: v }), onSuccess: refresh });
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error) return <p role="alert" className="rounded-md bg-warning-soft p-4">Couldn't load this list: {q.error.message}</p>;
  const term = search.trim().toLowerCase();
  const match = (r: { customer: string; email: string; code?: string }) => !term || `${r.customer} ${r.email} ${r.code ?? ""}`.toLowerCase().includes(term);
  const returns = (q.data?.returns ?? []).filter(match).sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const claims = (q.data?.claims ?? []).filter(match);
  const err = mv.error ?? mc.error;
  return (
    <>
      <input className="field mb-4 max-w-sm" placeholder="Search name, email or return code (ML-…)" aria-label="Search parcels" value={search} onChange={(e) => setSearch(e.target.value)} />
      {err && <p role="alert" className="mb-4 rounded-md bg-warning-soft p-3 text-sm">{err.message}</p>}
      <h2 className="text-3xl">Incoming parcels</h2>
      {returns.length === 0 ? <div className="mt-4"><Empty title="No parcels" body="Return notices appear here when people send wrappers or expired medicines." /></div> : (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {returns.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-56 flex-1">
                <div className="font-semibold">{r.code} · {r.customer} <span className="font-normal text-muted-foreground">{r.email}</span></div>
                <div className="text-sm text-muted-foreground">Says: {r.wrappers} wrappers · {r.bottles} bottles · {r.expired} expired · sent {fmtDate(r.createdAt)}
                  {r.tracking && ` · tracking ${r.tracking}`} · lifetime total {r.userTotal}</div>
                {r.note && <div className="text-sm text-muted-foreground">Note: {r.note}</div>}
              </div>
              {r.status === "pending" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input className="field w-28" type="number" min={0} max={1500} aria-label={`Items counted in ${r.code}`}
                    value={counts[r.id] ?? String(r.declared)} onChange={(e) => setCounts({ ...counts, [r.id]: e.target.value })} />
                  <button className="btn btn-green" disabled={mv.isPending} onClick={() => mv.mutate({ id: r.id, count: Number(counts[r.id] ?? r.declared) })}>Confirm & credit points</button>
                  <button className="btn btn-ghost" disabled={mv.isPending} onClick={() => mv.mutate({ id: r.id, count: 0, reject: true })}>Not accepted</button>
                </div>
              ) : (
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${r.status === "rejected" ? "bg-warning-soft" : "bg-muted"}`}>
                  {r.status === "verified" ? `Credited ${r.verifiedCount} items` : "Not accepted"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-12 text-3xl">Seed reward orders</h2>
      {claims.length === 0 ? <div className="mt-4"><Empty title="No seed orders yet" body="Seed requests appear here once someone reaches 50 checked items." /></div> : (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-56 flex-1">
                <div className="font-semibold">{REWARD_TIERS.find((t) => t.items === c.tier)?.name} · {c.customer} <span className="font-normal text-muted-foreground">{c.email}</span></div>
                <div className="text-sm text-muted-foreground">Seeds: {c.seeds.map((id) => SEEDS.find((s) => s.id === id)?.name ?? id).join(", ")} · {fmtDate(c.createdAt)}</div>
                <div className="text-sm text-muted-foreground">Ship to: {c.shipName}, {c.shipAddress}{c.shipPhone && ` · ${c.shipPhone}`}</div>
              </div>
              <select className="field max-w-48" aria-label={`Status for seed order from ${c.customer}`} value={c.status} disabled={mc.isPending}
                onChange={(e) => mc.mutate({ id: c.id, status: e.target.value as ClaimStatus })}>
                {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{CLAIM_STATUS_LABEL[s]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
