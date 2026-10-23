import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, Volume2, X } from "lucide-react";
import { useStore, fmtTime } from "@/lib/store";
import { askVoiceAssistant, type VoiceAnswer } from "@/lib/voice.functions";

type Lang = "en" | "hi";
const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN" };
const T = {
  en: { title: "Ask Medileaf", tap: "Tap the mic and ask a question", listening: "Listening…", thinking: "Thinking…", examples: ["When is my next dose?", "Can I take this on an empty stomach?"], type: "Or type your question", ask: "Ask", again: "Hear again", refill: "Order a refill", add: "Add a medicine", noMic: "Voice input isn't supported in this browser. Please type instead." },
  hi: { title: "मेडीलीफ़ से पूछें", tap: "माइक दबाएँ और सवाल पूछें", listening: "सुन रहा हूँ…", thinking: "सोच रहा हूँ…", examples: ["मेरी अगली दवा कब है?", "क्या मैं यह खाली पेट ले सकता हूँ?"], type: "या अपना सवाल लिखें", ask: "पूछें", again: "फिर से सुनें", refill: "दवा मँगाएँ", add: "दवा जोड़ें", noMic: "इस ब्राउज़र में आवाज़ से पूछना संभव नहीं है। कृपया लिखें।" },
};

function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALE[lang];
  u.rate = 0.9;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function VoiceAssistant() {
  const user = useStore((s) => s.user);
  const meds = useStore((s) => s.meds).filter((m) => m.status === "active");
  const ask = useServerFn(askVoiceAssistant);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking">("idle");
  const [question, setQuestion] = useState("");
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<VoiceAnswer | null>(null);
  const [error, setError] = useState("");
  const recRef = useRef<{ stop: () => void } | null>(null);
  const t = T[lang];

  useEffect(() => () => { recRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  if (!user) return null;

  async function submit(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuestion(text); setAnswer(null); setError(""); setPhase("thinking");
    const res = await ask({ data: {
      question: text, lang, now: new Date().toLocaleString("en-IN", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }),
      meds: meds.map((m) => ({ id: m.id, name: m.name, strength: m.strength, dose: m.dose, times: m.times, instructions: m.instructions, remaining: m.remaining })),
    } }).catch(() => ({ error: "Sorry, something went wrong." } as { answer?: VoiceAnswer; error?: string }));
    setPhase("idle");
    if (res.error || !res.answer) { setError(res.error ?? "Sorry, something went wrong."); return; }
    setAnswer(res.answer);
    speak(res.answer.reply, lang);
  }

  function listen() {
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { setError(t.noMic); return; }
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = LOCALE[lang]; rec.interimResults = true; rec.maxAlternatives = 1;
    let final = "";
    rec.onresult = (e: any) => {
      final = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(" ");
      setQuestion(final);
    };
    rec.onerror = () => { setPhase("idle"); setError(t.noMic); };
    rec.onend = () => { recRef.current = null; if (final) void submit(final); else setPhase("idle"); };
    recRef.current = rec;
    setError(""); setAnswer(null); setQuestion(""); setPhase("listening");
    rec.start();
  }

  const med = answer?.medicationId ? meds.find((m) => m.id === answer.medicationId) : undefined;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open voice helper"
        className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20 transition hover:scale-105"
      >
        <Mic className="h-7 w-7" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label={t.title} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border bg-card p-6 text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">{t.title}</h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full border p-1 text-base">
                  {(["en", "hi"] as Lang[]).map((l) => (
                    <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-primary text-primary-foreground" : ""}`}>
                      {l === "en" ? "English" : "हिन्दी"}
                    </button>
                  ))}
                </div>
                <button aria-label="Close" onClick={() => { setOpen(false); recRef.current?.stop(); window.speechSynthesis?.cancel(); }} className="rounded-full p-2 hover:bg-muted"><X className="h-6 w-6" /></button>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={phase === "listening" ? () => recRef.current?.stop() : listen}
                disabled={phase === "thinking"}
                aria-label={phase === "listening" ? "Stop listening" : "Start speaking"}
                className={`flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg disabled:opacity-60 ${phase === "listening" ? "animate-pulse ring-8 ring-primary/30" : ""}`}
              >
                {phase === "listening" ? <Square className="h-9 w-9" /> : <Mic className="h-10 w-10" />}
              </button>
              <p className="text-lg font-medium text-muted-foreground">
                {phase === "listening" ? t.listening : phase === "thinking" ? t.thinking : t.tap}
              </p>
            </div>

            {question && <p className="mt-4 rounded-2xl bg-muted p-4 text-lg">“{question}”</p>}

            {answer && (
              <div className={`mt-4 rounded-2xl border-2 p-4 ${answer.action === "emergency" ? "border-destructive bg-destructive/10" : "border-primary/40 bg-primary/5"}`}>
                <p className="text-xl leading-relaxed">{answer.reply}</p>
                {med && (
                  <div className="mt-3 rounded-xl border-2 border-primary bg-card p-3">
                    <p className="text-lg font-bold">{med.name} {med.strength}</p>
                    <p className="text-base text-muted-foreground">{med.dose} · {med.times.map(fmtTime).join(", ")}</p>
                    {med.instructions && <p className="text-base">{med.instructions}</p>}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => speak(answer.reply, lang)} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base font-semibold"><Volume2 className="h-5 w-5" />{t.again}</button>
                  {answer.action === "refill" && med && <Link to="/reorder/$id" params={{ id: med.id }} onClick={() => setOpen(false)} className="rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground">{t.refill}</Link>}
                  {answer.action === "add_medicine" && <Link to="/medications/new" onClick={() => setOpen(false)} className="rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground">{t.add}</Link>}
                </div>
              </div>
            )}

            {error && <p className="mt-4 rounded-2xl bg-destructive/10 p-4 text-lg text-destructive">{error}</p>}

            {phase === "idle" && !answer && (
              <div className="mt-4 flex flex-wrap gap-2">
                {t.examples.map((ex) => <button key={ex} onClick={() => submit(ex)} className="rounded-full border px-4 py-2 text-base hover:bg-muted">{ex}</button>)}
              </div>
            )}

            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(typed); setTyped(""); }}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.type} className="min-w-0 flex-1 rounded-full border bg-background px-4 py-3 text-lg" />
              <button disabled={phase !== "idle"} className="rounded-full bg-primary px-5 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60">{t.ask}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
