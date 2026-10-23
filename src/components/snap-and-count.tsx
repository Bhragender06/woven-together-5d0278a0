import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scanRecyclingItems } from "@/lib/vision.functions";
import { CATEGORY_LABEL, scanTotal, type ScanCategory, type ScanResult } from "@/lib/vision-logic";

const BOX_CLASS: Record<ScanCategory, string> = {
  wrapper: "stroke-primary",
  bottle: "stroke-warning",
  expired: "stroke-destructive",
};
const CHIP_CLASS: Record<ScanCategory, string> = {
  wrapper: "bg-primary text-primary-foreground",
  bottle: "bg-warning text-foreground",
  expired: "bg-destructive text-destructive-foreground",
};

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function SnapAndCount({ onApply }: { onApply: (r: ScanResult) => void }) {
  const scan = useServerFn(scanRecyclingItems);
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [applied, setApplied] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null); setResult(null); setApplied(false);
    try {
      const dataUrl = await shrink(file);
      setPhoto(dataUrl); setBusy(true);
      const r = await scan({ data: { dataUrl, mimeType: "image/jpeg" } });
      if (r.error || !r.result) setError(r.error ?? "Scan failed.");
      else setResult(r.result);
    } catch { setError("We couldn't open that photo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  const total = result ? scanTotal(result) : 0;
  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">📸 Snap & Count with AI</div>
          <p className="text-sm text-muted-foreground">Lay your empty packs and bottles on a table and take one photo. We'll count them for you.</p>
        </div>
        <button type="button" className="btn btn-green" disabled={busy} onClick={() => input.current?.click()}>
          {photo ? "Take another photo" : "Take or upload photo"}
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      {photo && (
        <div className="relative mt-4 overflow-hidden rounded-lg">
          <img src={photo} alt="Your recycling photo" className="block w-full" />
          {result && (
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              {result.detections.map((d, i) => (
                <rect key={i} x={d.box[1]} y={d.box[0]} width={d.box[3] - d.box[1]} height={d.box[2] - d.box[0]}
                  className={`fill-transparent ${BOX_CLASS[d.category]}`} strokeWidth={4} vectorEffect="non-scaling-stroke" rx={6} />
              ))}
            </svg>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="absolute inset-x-0 top-0 h-1 animate-[scan_1.6s_ease-in-out_infinite] bg-primary shadow-lg" />
              <span className="rounded-full bg-background px-4 py-2 text-sm font-semibold">Counting items…</span>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-md bg-warning-soft p-3 text-sm">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-lg font-semibold">
            {total === 0 ? "No packaging found — try a clearer photo." : `🎯 ${total} item${total === 1 ? "" : "s"} detected (+${total} eco-points)`}
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            {(["wrapper", "bottle", "expired"] as ScanCategory[]).map((c) => (
              <span key={c} className={`rounded-full px-3 py-1 font-medium ${CHIP_CLASS[c]}`}>
                {result[c === "wrapper" ? "wrappers" : c === "bottle" ? "bottles" : "expired"]} {CATEGORY_LABEL[c]}
              </span>
            ))}
          </div>
          {total > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => { onApply(result); setApplied(true); }}>
              {applied ? "✓ Added to your return slip" : "Apply to return slip"}
            </button>
          )}
          <p className="text-xs text-muted-foreground">AI counts are a guide — our team still checks your parcel before points are added.</p>
        </div>
      )}
    </div>
  );
}
