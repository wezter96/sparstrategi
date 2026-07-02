import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import { defaultScenarioInput } from "@sparstrategi/engine";
import { Scenario, ScenarioUpsert, api } from "../src/index";

describe("contract", () => {
  test("Scenario schema round-trips", () => {
    const scenario = {
      id: "abc",
      name: "Min strategi",
      input: defaultScenarioInput,
      engineVersion: 1,
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    };
    expect(Schema.decodeUnknownSync(Scenario)(scenario).name).toBe("Min strategi");
  });

  test("ScenarioUpsert validates", () => {
    const ok = Schema.decodeUnknownSync(ScenarioUpsert)({
      name: "x",
      input: defaultScenarioInput,
    });
    expect(ok.name).toBe("x");
  });

  test("api exposes the scenarios group", () => {
    expect(api.groups.scenarios).toBeDefined();
  });
});
