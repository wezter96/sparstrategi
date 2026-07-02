import { describe, expect, test } from "bun:test";
import { defaultScenarioInput } from "@sparstrategi/engine";
import { parseShared, serializeShared } from "./simulator";

describe("share-url round trip", () => {
  test("serialize → parse returns the same input", () => {
    const s = serializeShared({ ...defaultScenarioInput, startCapital: 2_500_000 });
    const parsed = parseShared(s);
    expect(parsed?.startCapital).toBe(2_500_000);
  });

  test("garbage returns null", () => {
    expect(parseShared("not-base64-json")).toBeNull();
  });
});
