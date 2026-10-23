import { describe, expect, it } from "vitest";
import { daySlot, detectAcronyms, normalizeTimeline } from "@/lib/jargon-logic";

describe("detectAcronyms", () => {
  it("finds BID, AC, PRN, QHS once each in order", () => {
    expect(detectAcronyms("Metformin BID AC, Paracetamol PRN, Atorva QHS, again BID").map((a) => a.code)).toEqual(["BID", "AC", "PRN", "QHS"]);
  });
  it("decodes TID as three times a day", () => {
    expect(detectAcronyms("TID")[0]?.meaning).toBe("Three times a day");
  });
  it("ignores lowercase everyday words like 'od' or 'ac'", () => {
    expect(detectAcronyms("an od thing at ac")).toEqual([]);
  });
});

describe("daySlot", () => {
  it("maps times to parts of the day", () => {
    expect(daySlot("07:30")).toBe("morning");
    expect(daySlot("13:00")).toBe("afternoon");
    expect(daySlot("20:00")).toBe("evening");
    expect(daySlot("22:00")).toBe("night");
    expect(daySlot("02:00")).toBe("night");
  });
});

describe("normalizeTimeline", () => {
  it("drops invalid times and sorts", () => {
    const r = normalizeTimeline([
      { time: "20:00", medicine: "B", amount: "1", meal: "any", note: "" },
      { time: "25:00", medicine: "X", amount: "1", meal: "any", note: "" },
      { time: "08:00", medicine: "A", amount: "1", meal: "any", note: "" },
    ]);
    expect(r.map((d) => d.medicine)).toEqual(["A", "B"]);
  });
});
