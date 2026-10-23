import { describe, expect, it } from "vitest";
import { normalizeScan, scanTotal } from "@/lib/vision-logic";

describe("normalizeScan", () => {
  it("counts each category from detected boxes", () => {
    const r = normalizeScan({ summary: "x", detections: [
      { category: "wrapper", label: "Foil", box: [0, 0, 100, 100], confidence: 0.9 },
      { category: "wrapper", label: "Foil", box: [200, 0, 300, 100], confidence: 0.9 },
      { category: "bottle", label: "Bottle", box: [0, 200, 100, 300], confidence: 0.8 },
    ] });
    expect([r.wrappers, r.bottles, r.expired]).toEqual([2, 1, 0]);
    expect(scanTotal(r)).toBe(3);
  });
  it("drops unknown categories and malformed boxes", () => {
    const r = normalizeScan({ summary: "", detections: [
      { category: "phone", label: "x", box: [0, 0, 100, 100], confidence: 1 },
      { category: "bottle", label: "x", box: [0, 0, 100], confidence: 1 },
    ] });
    expect(r.detections).toHaveLength(0);
  });
  it("clamps boxes to the 0-1000 range", () => {
    const r = normalizeScan({ summary: "", detections: [{ category: "expired", label: "Box", box: [-50, 10, 1200, 500], confidence: 2 }] });
    expect(r.detections[0]!.box).toEqual([0, 10, 1000, 500]);
    expect(r.detections[0]!.confidence).toBe(1);
  });
});
