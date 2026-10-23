import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageTitle } from "@/components/site";
import { draftToMed, emptyDraft, MedForm, validateDraft } from "@/components/med-form";
import { SafetyReportView, useSafetyCheck } from "@/components/safety-shield";
import { getState, setState, uid } from "@/lib/store";

export const Route = createFileRoute("/medications/new")({
  head: () => ({
    meta: [
      { title: "Add medicine — Medileaf" },
      { name: "description", content: "Add a medicine to your plan by hand." },
      { property: "og:title", content: "Add medicine — Medileaf" },
      { property: "og:description", content: "Add a medicine and set reminder times." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><NewMed /></AppShell>,
});

function NewMed() {
  const navigate = useNavigate();
  const [d, setD] = useState(emptyDraft);
  const [err, setErr] = useState("");
  const safety = useSafetyCheck();
  const checked = safety.report !== null && !safety.loading;

  function commit() {
    setState((s) => ({ ...s, meds: [...s.meds, { id: uid(), ...draftToMed(d, "manual") }] }), `Added ${d.name} manually`);
    navigate({ to: "/dashboard" });
  }

  async function save() {
    const e = validateDraft(d);
    if (e) return setErr(e);
    setErr("");
    const current = getState().meds.filter((m) => m.status === "active");
    const report = await safety.run(current, [d]);
    // Clear result: save straight away. Warnings: let the person read them first.
    if (report && report.level === "clear") commit();
  }

  return (
    <>
      <PageTitle title="Add a medicine" sub="Enter the details exactly as they appear on your prescription or pack. We’ll check it against your other medicines before saving." />
      <div className="surface p-6 md:p-8"><MedForm d={d} onChange={(next) => { setD(next); if (safety.report || safety.error) safety.reset(); }} /></div>
      {err && <p role="alert" className="mt-4 font-semibold text-destructive">{err}</p>}
      {(safety.loading || safety.report || safety.error) && (
        <div className="mt-6">
          <SafetyReportView title="Safety check" report={safety.report} loading={safety.loading} error={safety.error} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button className="btn btn-ghost" onClick={() => navigate({ to: "/dashboard" })}>Cancel</button>
        {safety.error && <button className="btn btn-ghost" onClick={commit}>Save without check</button>}
        {checked
          ? <button className={`btn ${safety.report?.level === "danger" ? "btn-danger" : "btn-primary"}`} onClick={commit}>Save anyway</button>
          : <button className="btn btn-primary" disabled={safety.loading} onClick={save}>{safety.loading ? "Checking…" : "Check & save medicine"}</button>}
      </div>
    </>
  );
}
