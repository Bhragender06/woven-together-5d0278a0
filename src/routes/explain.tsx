import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/site";
import { JargonBuster } from "@/components/jargon-buster";

export const Route = createFileRoute("/explain")({
  head: () => ({
    meta: [
      { title: "Explain my prescription — Medileaf" },
      { name: "description", content: "Turn doctor shorthand like BID, AC and PRN into simple instructions and a daily timeline." },
      { property: "og:title", content: "Explain my prescription — Medileaf" },
      { property: "og:description", content: "Doctor notes in plain words, with a picture of your day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <PageTitle title="Explain like I'm 10" sub="Paste a doctor's note or medicine leaflet. We'll decode the shorthand and show your day step by step." />
      <section className="surface mt-8 p-6 md:p-8"><JargonBuster /></section>
    </AppShell>
  ),
});
