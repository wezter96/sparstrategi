import { describe, expect, test } from "bun:test";
import { fmtKr, fmtPct } from "./format";

describe("fmtKr", () => {
  test("small amounts in kr", () => {
    expect(fmtKr(1234)).toBe("1 234 kr");
  });
  test("thousands as tkr", () => {
    expect(fmtKr(12_300)).toBe("12,3 tkr");
  });
  test("millions as Mkr", () => {
    expect(fmtKr(45_700_000)).toBe("45,7 Mkr");
  });
  test("billions as Mdr", () => {
    expect(fmtKr(6_388_000_000)).toBe("6,39 Mdr kr");
  });
});

describe("fmtPct", () => {
  test("formats decimal fraction with sv-SE comma", () => {
    expect(fmtPct(0.07)).toBe("7,0 %");
  });
});
