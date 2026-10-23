import { describe, expect, it } from "vitest";
import { conflictCount, normalizeWarnings, regimenKey, shieldLevel } from "@/lib/safety-logic";

describe("safety shield level", () => {
  it("is red when any warning is severe", () => {
    expect(shieldLevel([{ severity: "info" }, { severity: "severe" }])).toBe("danger");
  });
  it("is amber for moderate or food warnings", () => {
    expect(shieldLevel([{ severity: "moderate" }])).toBe("caution");
    expect(shieldLevel([{ severity: "dietary" }])).toBe("caution");
  });
  it("is green with only good-to-know tips or nothing", () => {
    expect(shieldLevel([{ severity: "info" }])).toBe("clear");
    expect(shieldLevel([])).toBe("clear");
  });
  it("does not count good-to-know tips as conflicts", () => {
    expect(conflictCount([{ severity: "info" }, { severity: "moderate" }, { severity: "severe" }])).toBe(2);
  });
});

describe("normalizeWarnings", () => {
  it("drops unknown severities and sorts most serious first", () => {
    const out = normalizeWarnings([
      { severity: "info", kind: "lifestyle", medicines: [], title: "Tip" },
      { severity: "panic", title: "Bad" },
      { severity: "severe", kind: "drug", medicines: ["Warfarin", "Ibuprofen"], title: "Bleeding risk" },
    ]);
    expect(out.map((w) => w.title)).toEqual(["Bleeding risk", "Tip"]);
  });
});

describe("regimenKey", () => {
  it("ignores order and letter case", () => {
    expect(regimenKey([{ name: "Metformin", strength: "850 mg" }, { name: "aspirin" }]))
      .toBe(regimenKey([{ name: "Aspirin" }, { name: "metformin", strength: "850 MG" }]));
  });
});
