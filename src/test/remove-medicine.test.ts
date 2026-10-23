import { describe, expect, it } from "vitest";
import { emptyState, removeMedicineFromPlan, type Medication } from "@/lib/store";

const med: Medication = { id: "one", name: "Example", strength: "10 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Once daily", times: ["09:00"], instructions: "", startDate: "2026-10-23", durationDays: null, quantity: 30, remaining: 20, dosesPerDay: 1, source: "manual", status: "active" };

describe("remove medicine from current plan", () => {
  it("removes only the selected medicine from active reminders and refills", () => {
    const next = removeMedicineFromPlan({ ...emptyState(), meds: [med, { ...med, id: "two" }] }, "one");
    expect(next.meds.find((m) => m.id === "one")?.status).toBe("archived");
    expect(next.meds.filter((m) => m.status === "active").map((m) => m.id)).toEqual(["two"]);
    expect(next.meds.filter((m) => m.status !== "archived").map((m) => m.id)).toEqual(["two"]);
  });
  it("keeps the medicine and its previous dose history", () => {
    const logs = [{ id: "dose", medId: "one", date: "2026-10-22", time: "09:00", status: "taken" as const, at: "2026-10-22T09:00:00Z" }];
    const next = removeMedicineFromPlan({ ...emptyState(), meds: [med], logs }, "one");
    expect(next.meds).toHaveLength(1);
    expect(next.meds[0]?.remaining).toBe(20);
    expect(next.logs).toEqual(logs);
  });
});