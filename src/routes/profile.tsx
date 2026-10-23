import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { cloudSignOut, deleteAccountData } from "@/lib/cloud";
import { Avatar, AppShell, Confirm, Field, PageTitle, Toggle } from "@/components/site";
import { setState, useStore } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & security — Medileaf" },
      { name: "description", content: "Manage your account, two-step verification and activity log." },
      { property: "og:title", content: "Profile & security — Medileaf" },
      { property: "og:description", content: "Account and security settings." },
    ],
  }),
  component: () => <AppShell><Profile /></AppShell>,
});

/** Shrinks the picked image to a 256px square so it fits in device storage. */
function setAvatarFromFile(file: File) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const m = Math.min(img.width, img.height);
    c.getContext("2d")!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 256, 256);
    setState((s) => ({ ...s, user: { ...s.user!, avatar: c.toDataURL("image/jpeg", 0.85) } }), "Updated profile photo");
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

function Profile() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user)!;
  const audit = useStore((s) => s.audit);
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);
  const [del, setDel] = useState(false);
  return (
    <>
      <PageTitle title="Profile & security" />
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="surface space-y-5 p-8">
          <h2 className="text-3xl">Account</h2>
          <div className="flex items-center gap-5">
            <Avatar size="h-20 w-20" />
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-ghost cursor-pointer">
                {user.avatar ? "Change photo" : "Add profile photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAvatarFromFile(f); e.target.value = ""; }} />
              </label>
              {user.avatar && <button className="btn btn-ghost" onClick={() => setState((s) => ({ ...s, user: { ...s.user!, avatar: undefined } }), "Removed profile photo")}>Remove</button>}
            </div>
          </div>
          <Field label="Name"><input className="field" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
          <Field label="Email"><input className="field" value={user.email} disabled /></Field>
          <button className="btn btn-green" disabled={!name.trim()} onClick={() => { setState((s) => ({ ...s, user: { ...s.user!, name: name.trim() } }), "Updated name"); setSaved(true); }}>Save</button>
          {saved && <span className="ml-3 text-sm text-success" role="status">Saved</span>}
          <div className="border-t pt-2">
            <Toggle label="Two-step verification" desc="Ask for a code when signing in on a new device" checked={user.mfa}
              onChange={(v) => setState((s) => ({ ...s, user: { ...s.user!, mfa: v } }), `${v ? "Enabled" : "Disabled"} two-step verification`)} />
          </div>
        </section>
        <section className="surface p-8">
          <h2 className="text-3xl">Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Important changes to your plan.</p>
          {audit.length === 0 ? <p className="mt-4 text-muted-foreground">No activity yet.</p> :
            <ul className="mt-4 max-h-80 divide-y overflow-auto">
              {audit.map((a, i) => <li key={i} className="flex justify-between gap-4 py-3 text-sm"><span>{a.text}</span><span className="shrink-0 text-muted-foreground">{new Date(a.at).toLocaleString()}</span></li>)}
            </ul>}
        </section>
      </div>
      <section className="mt-10 border-t pt-8">
        <h2 className="text-3xl">Delete account</h2>
        <p className="mt-2 text-muted-foreground">Permanently remove your account, medicines and history.</p>
        <button className="btn btn-ghost mt-4 border-destructive text-destructive" onClick={() => setDel(true)}>Delete my account</button>
      </section>
      <Confirm open={del} danger title="Delete everything?" body="All your medicines, reminders and history will be permanently removed." confirmLabel="Delete account"
        onCancel={() => setDel(false)} onConfirm={async () => { await deleteAccountData(); await cloudSignOut(); navigate({ to: "/", replace: true }); }} />
    </>
  );
}
