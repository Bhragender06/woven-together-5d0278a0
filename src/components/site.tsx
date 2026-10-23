import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import mark from "@/assets/medileaf-mark.png.asset.json";
import { useEffect, useState, type ReactNode } from "react";
import { getState, useStore } from "@/lib/store";
import { cloudSignOut, useAuthReady } from "@/lib/cloud";
import { useIsAdmin } from "@/lib/use-admin";
import { DemoBar } from "@/components/demo-bar";
import { Toaster } from "@/components/ui/sonner";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-primary">
      <img src={mark.url} alt="Medileaf logo" className="h-9 w-9" />
      <span className="font-display text-2xl text-foreground">Medileaf</span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Logo />
      <nav className="flex items-center gap-3">
        <Link to="/login" className="px-3 py-2 font-semibold hover:underline">Log in</Link>
        <Link to="/signup" className="btn btn-primary">Get started</Link>
      </nav>
    </header>
  );
}

const nav = [
  { to: "/dashboard", label: "Today" },
  { to: "/upload", label: "Upload" },
  { to: "/refills", label: "Refills" },
  { to: "/reminders", label: "Reminders" },
  { to: "/rewards", label: "Rewards" },
  { to: "/explain", label: "Explain" },
  { to: "/settings", label: "Settings" },
  { to: "/profile", label: "Profile" },
] as const;

function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(navigator.onLine);
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return on;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [ready, setReady] = useState(false);
  const authReady = useAuthReady();
  const online = useOnline();
  const { isAdmin } = useIsAdmin();
  useEffect(() => {
    if (!authReady) return;
    if (!getState().user) navigate({ to: "/login" });
    else setReady(true);
  }, [navigate, user, authReady]);
  if (!ready || !user) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="border-b bg-background/90 backdrop-blur sticky top-0 z-20">
        <DemoBar />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Logo />
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-muted"
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}>
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-muted"
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}>Admin</Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-success" : "bg-warning"}`} />
              {online ? "Synced to your account" : "Offline — changes will sync when you reconnect"}
            </span>
            <Avatar />
            <button className="font-semibold hover:underline" onClick={async () => { await cloudSignOut(); navigate({ to: "/", replace: true }); }}>Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10"><BackButton />{children}</main>
    </div>
  );
}

export function BackButton() {
  const router = useRouter();
  const navigate = useNavigate();
  return (
    <button type="button" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      onClick={() => (window.history.length > 1 ? router.history.back() : navigate({ to: "/" }))}>
      <span aria-hidden>←</span> Back
    </button>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl md:text-5xl">{title}</h1>
        {sub && <p className="mt-2 text-lg text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-6">
      <div className="surface w-full max-w-md p-8">
        <h2 className="text-3xl">{title}</h2>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <div className="mt-8 flex justify-end gap-3">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button autoFocus className={`btn ${danger ? "btn-danger" : "btn-green"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-8 py-16 text-center">
      <h2 className="text-3xl">{title}</h2>
      <p className="mt-3 max-w-md text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div><div className="font-semibold">{label}</div>{desc && <div className="text-sm text-muted-foreground">{desc}</div>}</div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-input"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-card transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

export function Avatar({ size = "h-9 w-9" }: { size?: string }) {
  const user = useStore((s) => s.user);
  if (!user) return null;
  return user.avatar
    ? <img src={user.avatar} alt="Your profile photo" className={`${size} rounded-full object-cover`} />
    : <span className={`${size} grid place-items-center rounded-full bg-primary font-semibold text-primary-foreground`}>{user.name.slice(0, 1).toUpperCase()}</span>;
}
