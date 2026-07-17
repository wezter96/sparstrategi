import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import { simulateWithdrawal, type WithdrawalInput } from "../src/withdrawal";

const base: WithdrawalInput = {
  startCapital: 1_200_000,
  monthlyWithdrawal: 10_000,
  expectedReturn: 0,
  inflation: 0,
  accountType: "none",
  afBasisShare: 1,
  taxParams: defaultTaxParams2026,
  horizonYears: 40,
};

describe("uttagsfas — grundmekanik", () => {
  test("skattefritt konto, 0% avkastning: 1,2 Mkr räcker exakt 10 år à 120 tkr", () => {
    const r = simulateWithdrawal(base);
    expect(r.depletedYear).toBe(10);
    expect(r.totalWithdrawn).toBeCloseTo(1_200_000, 6);
    expect(r.totalTax).toBe(0);
    expect(r.rows[10]!.capital).toBe(0);
    expect(r.rows[9]!.capital).toBeCloseTo(120_000, 6);
  });

  test("positiv avkastning förlänger: 7% på 1,2 Mkr täcker 72 tkr/år för evigt", () => {
    const r = simulateWithdrawal({ ...base, expectedReturn: 0.07, monthlyWithdrawal: 6_000 });
    expect(r.depletedYear).toBeNull();
    expect(r.rows.at(-1)!.capital).toBeGreaterThan(1_200_000);
  });

  test("inflation räknar upp uttagen: realt uttag konstant, nominellt växer", () => {
    const r = simulateWithdrawal({ ...base, inflation: 0.02, horizonYears: 5, startCapital: 10_000_000 });
    expect(r.rows[1]!.withdrawn).toBeCloseTo(120_000, 6);
    expect(r.rows[2]!.withdrawn).toBeCloseTo(120_000 * 1.02, 6);
    expect(r.rows[5]!.withdrawn).toBeCloseTo(120_000 * 1.02 ** 4, 4);
  });

  test("realt värde deflateras med inflationen", () => {
    const r = simulateWithdrawal({
      ...base,
      startCapital: 1_000_000,
      monthlyWithdrawal: 0,
      expectedReturn: 0.02,
      inflation: 0.02,
      horizonYears: 3,
    });
    // Avkastning = inflation ⇒ realt värde konstant.
    expect(r.rows[3]!.capitalReal).toBeCloseTo(1_000_000, 4);
    expect(r.rows[3]!.capital).toBeCloseTo(1_000_000 * 1.02 ** 3, 4);
  });
});

describe("uttagsfas — skatt", () => {
  test("ISK: schablonskatt på kapital över fribeloppet dras ur kapitalet", () => {
    const r = simulateWithdrawal({
      ...base,
      accountType: "isk",
      startCapital: 1_300_000,
      monthlyWithdrawal: 0,
      horizonYears: 1,
    });
    // (1 300 000 − 300 000) × 1,05% = 10 500 kr
    expect(r.rows[1]!.paidTax).toBeCloseTo(10_500, 6);
    expect(r.rows[1]!.capital).toBeCloseTo(1_300_000 - 10_500, 6);
  });

  test("AF utan vinst (anskaffningsvärde = kapital): ingen skatt på uttag", () => {
    const r = simulateWithdrawal({ ...base, accountType: "af", afBasisShare: 1, horizonYears: 2 });
    expect(r.rows[1]!.paidTax).toBeCloseTo(0, 6);
  });

  test("AF med 50% vinstandel: bruttoförsäljning > nettouttag, 30% skatt på vinstdelen", () => {
    const r = simulateWithdrawal({
      ...base,
      accountType: "af",
      afBasisShare: 0.5,
      startCapital: 2_000_000,
      horizonYears: 1,
    });
    // g = 0,5 ⇒ sälj S = 120 000 / (1 − 0,3·0,5) = 141 176,47; skatt = S − 120 000.
    const S = 120_000 / (1 - 0.3 * 0.5);
    expect(r.rows[1]!.paidTax).toBeCloseTo(S - 120_000, 2);
    expect(r.rows[1]!.withdrawn).toBeCloseTo(120_000, 2);
  });

  test("AF: genomsnittsmetoden — vinstandelen växer när kursen stiger, skatten per krona uttag ökar över tid", () => {
    const r = simulateWithdrawal({
      ...base,
      accountType: "af",
      afBasisShare: 1,
      startCapital: 3_000_000,
      expectedReturn: 0.07,
      horizonYears: 15,
    });
    expect(r.rows[2]!.paidTax).toBeGreaterThan(0); // år 1:s tillväxt är obeskattad vinst
    expect(r.rows[15]!.paidTax).toBeGreaterThan(r.rows[2]!.paidTax);
  });

  test("AF:s bruttokapital ser större ut, men netto efter latent skatt vinner ISK", () => {
    const mk = (accountType: "isk" | "af") =>
      simulateWithdrawal({
        ...base,
        accountType,
        afBasisShare: 1,
        startCapital: 3_000_000,
        expectedReturn: 0.07,
        monthlyWithdrawal: 12_000,
        horizonYears: 30,
      });
    const isk = mk("isk").rows.at(-1)!;
    const af = mk("af").rows.at(-1)!;
    // AF skjuter skatten framför sig: brutto större, netto mindre.
    expect(af.capital).toBeGreaterThan(isk.capital);
    expect(isk.capitalNet).toBeGreaterThan(af.capitalNet);
  });
});

describe("uttagsfas — utarmning", () => {
  test("sista året betalas det som finns kvar ut; kapital 0, depletedYear satt", () => {
    const r = simulateWithdrawal({ ...base, startCapital: 500_000 });
    expect(r.depletedYear).toBe(5);
    expect(r.rows[5]!.withdrawn).toBeCloseTo(20_000, 6); // 500' − 4×120'
    expect(r.rows[5]!.capital).toBe(0);
    for (const row of r.rows.slice(6)) expect(row.capital).toBe(0);
  });
});
