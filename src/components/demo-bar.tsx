import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { buildPersona, personas, type PersonaId } from "@/lib/demo-personas";
import { setState } from "@/lib/store";
import { submitReturn } from "@/lib/rewards.functions";

export function DemoBar() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PersonaId | null>(null);

  async function load(id: PersonaId) {
    setBusy(id);
    const p = personas[id];
    setState((s) => buildPersona(s, id), `Loaded demo persona: ${p.label}`);
    try { await submitReturn({ data: { ...p.returns, note: "Demo blister-pack return" } }); } catch { /* rewards optional */ }
    setBusy(null);
    toast.warning(`${p.label}: a dose was missed 2 hours ago`, { description: "Next dose is due in 10 minutes. Safety Shield is checking for conflicts." });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="border-b bg-accent text-accent-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-6 py-2 text-sm">
        <span className="font-semibold">Demo mode:</span>
        {(Object.keys(personas) as PersonaId[]).map((id) => (
          <button key={id} disabled={busy !== null} onClick={() => load(id)}
            className="rounded-full border border-current px-3 py-1 font-semibold hover:bg-background/40 disabled:opacity-50">
            {busy === id ? "Loading…" : `${personas[id].label} (${personas[id].tagline})`}
          </button>
        ))}
      </div>
    </div>
  );
}
