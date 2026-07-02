import { describe, expect, test } from "bun:test";
import { ENGINE_VERSION } from "../src/index";

describe("engine package", () => {
  test("is importable", () => {
    expect(ENGINE_VERSION).toBe(1);
  });
});
