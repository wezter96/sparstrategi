import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import {
  ScenarioInput,
  defaultScenarioInput,
  defaultTaxParams2026,
  documentTaxParams,
} from "../src/schema";

describe("ScenarioInput schema", () => {
  test("decodes the default input", () => {
    const decoded = Schema.decodeUnknownSync(ScenarioInput)(defaultScenarioInput);
    expect(decoded.taxParams.iskFreeAmount).toBe(300_000);
  });

  test("rejects malformed input", () => {
    expect(() =>
      Schema.decodeUnknownSync(ScenarioInput)({ startCapital: "much" }),
    ).toThrow();
  });

  test("2026 defaults match Swedish rules", () => {
    expect(defaultTaxParams2026.deductionBreakpoint).toBe(100_000);
    expect(defaultTaxParams2026.deductionRateLow).toBe(0.3);
    expect(defaultTaxParams2026.deductionRateHigh).toBe(0.21);
  });

  test("document params replicate the source document's flat model", () => {
    expect(documentTaxParams.iskFreeAmount).toBe(0);
    expect(documentTaxParams.deductionBreakpoint).toBe(0);
    expect(documentTaxParams.deductionRateHigh).toBe(0.21);
  });

  test("decodes a goal union member", () => {
    const withGoal = {
      ...defaultScenarioInput,
      goals: [{ type: "wealth", amount: 10_000_000, year: 10 }],
    };
    const decoded = Schema.decodeUnknownSync(ScenarioInput)(withGoal);
    expect(decoded.goals[0]?.type).toBe("wealth");
  });
});
