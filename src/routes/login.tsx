import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BackButton, Field, Logo } from "@/components/site";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { getState } from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Medileaf" },
      { name: "description", content: "Log in to your Medileaf medication plan." },
      { property: "og:title", content: "Log in — Medileaf" },
      { property: "og:description", content: "Access your medication plan and reminders." },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const signup = mode === "signup";

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const goIn = () => navigate({ to: getState().onboarded ? "/dashboard" : "/onboarding" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Please enter a valid email address.");
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (signup && !name.trim()) return setErr("Please tell us your name.");
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin + "/dashboard", data: { name: name.trim() } } });
        if (error) return setErr(error.message);
        if (!data.session) return setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) return setErr(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
      }
      // Wait for the account's data to load before moving on.
      await new Promise((r) => setTimeout(r, 400));
      goIn();
    } finally { setBusy(false); }
  }

  async function google() {
    setErr("");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" });
    if (r.error) return setErr(r.error.message ?? "Google sign-in failed.");
    if (r.redirected) return;
    await new Promise((res) => setTimeout(res, 400));
    goIn();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setTimeout(goIn, 400); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <span className="font-display text-2xl">Medileaf</span>
        <p className="font-display text-5xl leading-tight">“Finally, I know exactly what to take and when.”</p>
        <span className="opacity-70">Calm medication management</span>
      </div>
      <div className="flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <BackButton />
          <div className="md:hidden mb-8"><Logo /></div>
          <h1 className="text-5xl">{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-2 text-muted-foreground">{signup ? "It takes less than a minute." : "Log in to see today’s doses."}</p>
          {sent ? (
            <div role="status" className="surface mt-8 p-6"><h2 className="text-2xl">Check your email</h2><p className="mt-2 text-muted-foreground">We sent a confirmation link to {email}. Click it to finish creating your account.</p></div>
          ) : <>
          <button type="button" onClick={google} className="btn btn-ghost mt-8 w-full">Continue with Google</button>
          <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            {signup && <Field label="Your name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
            <Field label="Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
            <Field label="Password"><input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} /></Field>
            {err && <p role="alert" className="text-sm font-semibold text-destructive">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Log in"}</button>
          </form>
          </>}
          <p className="mt-6 text-sm text-muted-foreground">
            {signup ? <>Already have an account? <Link to="/login" className="font-semibold text-primary underline">Log in</Link></>
              : <>New here? <Link to="/signup" className="font-semibold text-primary underline">Create an account</Link></>}
          </p>
        </div>
      </div>
    </div>
  );
}
