import { describe, expect, it } from "vitest";
import { attributeTriggers } from "../triggers";

const today = new Date();
function daysAgoIso(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysAgoDate(n: number): string {
  return daysAgoIso(n).slice(0, 10);
}

describe("attributeTriggers", () => {
  it("returns an empty array when no triggers are logged", () => {
    expect(
      attributeTriggers(
        {
          foodEntries: [],
          painPoints: [],
          symptomDays: [
            { date: daysAgoDate(0), hasSymptom: true },
          ],
        },
        14,
      ),
    ).toEqual([]);
  });

  it("attributes a food trigger to a same-day symptom day", () => {
    const result = attributeTriggers(
      {
        foodEntries: [
          {
            logged_at: daysAgoIso(1),
            food_items: "coffee",
            flagged_triggers: ["caffeine"],
          },
        ],
        painPoints: [],
        symptomDays: [{ date: daysAgoDate(1), hasSymptom: true }],
      },
      14,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Caffeine");
    expect(result[0].source).toBe("food");
    expect(result[0].linkedSymptomDays).toBe(1);
  });

  it("excludes entries outside the window", () => {
    const result = attributeTriggers(
      {
        foodEntries: [
          {
            logged_at: daysAgoIso(30),
            food_items: "ancient meal",
            flagged_triggers: ["dairy"],
          },
        ],
        painPoints: [],
        symptomDays: [{ date: daysAgoDate(30), hasSymptom: true }],
      },
      7,
    );
    expect(result).toEqual([]);
  });

  it("deduplicates per-day mentions and ranks by linked symptom days", () => {
    const result = attributeTriggers(
      {
        foodEntries: [
          {
            logged_at: daysAgoIso(1),
            food_items: "coffee",
            flagged_triggers: ["caffeine"],
          },
          {
            logged_at: daysAgoIso(1),
            food_items: "espresso",
            flagged_triggers: ["caffeine"],
          },
          {
            logged_at: daysAgoIso(2),
            food_items: "cheese",
            flagged_triggers: ["dairy"],
          },
        ],
        painPoints: [],
        symptomDays: [
          { date: daysAgoDate(1), hasSymptom: true },
          { date: daysAgoDate(2), hasSymptom: false },
        ],
      },
      14,
    );
    expect(result[0].label).toBe("Caffeine");
    expect(result[0].linkedSymptomDays).toBe(1);
    expect(result[0].occurrences).toBe(2);
    expect(result[1].label).toBe("Dairy");
    expect(result[1].linkedSymptomDays).toBe(0);
  });

  it("ignores blank trigger strings", () => {
    const result = attributeTriggers(
      {
        foodEntries: [
          {
            logged_at: daysAgoIso(1),
            food_items: "tea",
            flagged_triggers: ["", "  "],
          },
        ],
        painPoints: [],
        symptomDays: [{ date: daysAgoDate(1), hasSymptom: true }],
      },
      14,
    );
    expect(result).toEqual([]);
  });

  it("merges pain-point triggers with food triggers using a shared counter", () => {
    const result = attributeTriggers(
      {
        foodEntries: [
          {
            logged_at: daysAgoIso(1),
            food_items: "bread",
            flagged_triggers: ["gluten"],
          },
        ],
        painPoints: [
          { logged_at: daysAgoIso(2), triggers: ["gluten"] },
          { logged_at: daysAgoIso(2), triggers: ["stress"] },
        ],
        symptomDays: [
          { date: daysAgoDate(1), hasSymptom: true },
          { date: daysAgoDate(2), hasSymptom: true },
        ],
      },
      14,
    );
    const gluten = result.find((r) => r.label === "Gluten");
    expect(gluten?.occurrences).toBe(2);
    expect(gluten?.linkedSymptomDays).toBe(2);
  });
});
