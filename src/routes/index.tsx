import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "@/components/site";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medileaf — your prescription, made clear" },
      { name: "description", content: "Turn a confusing prescription into a clear daily medication plan with reminders, dose tracking and refills." },
      { property: "og:title", content: "Medileaf — your prescription, made clear" },
      { property: "og:description", content: "Upload a prescription, verify it, and follow a calm daily medication plan." },
    ],
  }),
  component: Landing,
});

const steps = [
  ["Upload", "Snap a photo or add a PDF of your prescription."],
  ["Review", "We read it for you and flag anything uncertain. You confirm every detail."],
  ["Follow", "Gentle reminders at the right times. Mark doses taken or skipped."],
  ["Refill", "See days left at a glance and reorder before you run out."],
];

function Landing() {
  return (
    <div>
      <PublicHeader />
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">Medication clarity</p>
          <h1 className="text-6xl leading-[1.02] md:text-7xl">Your medication,<br /><em className="text-primary">made simple.</em></h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Medileaf turns a hard-to-read prescription into a plan you can actually follow — with reminders, tracking, and refills in one calm place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-primary">Upload a prescription</Link>
            <Link to="/login" className="btn btn-ghost">I have an account</Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Nothing becomes part of your plan until you confirm it.</p>
        </div>
        <img src={hero} alt="A handwritten prescription beside a pill bottle" width={1280} height={1024} className="w-full rounded-2xl object-cover" />
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="max-w-2xl text-5xl">From paper to a daily routine, in four quiet steps.</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-4">
            {steps.map(([t, d], i) => (
              <li key={t} className="border-t border-primary-foreground/30 pt-6">
                <span className="font-display text-4xl opacity-60">0{i + 1}</span>
                <h3 className="mt-2 text-xl font-semibold">{t}</h3>
                <p className="mt-2 opacity-80">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
        {[
          ["You stay in control", "AI helps read your prescription. You verify every medicine, dose and time."],
          ["Honest about uncertainty", "Anything hard to read is clearly marked — we never guess a dose."],
          ["Private by design", "Your health information is yours. No ads, no selling data."],
        ].map(([t, d]) => (
          <div key={t}>
            <h3 className="font-display text-3xl">{t}</h3>
            <p className="mt-3 text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span>© 2026 Medileaf</span>
          <span>Medileaf does not provide medical advice. Always follow your doctor or pharmacist.</span>
        </div>
      </footer>
    </div>
  );
}
