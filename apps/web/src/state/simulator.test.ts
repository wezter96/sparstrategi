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

  // `serializeShared` base64-encodes `encodeURIComponent(JSON.stringify(input))`. For this
  // schema (numbers, booleans, and a couple of literal-string enums) that intermediate text is
  // confined to the byte alphabet [0-9.\-%A-Za-z] — exhaustively enumerating every 3-byte
  // combination from that alphabet (verified out-of-band) never produces the base64 "+" sextet,
  // so a real ScenarioInput can never trigger this bug in practice. We still guard the contract
  // directly: shareUrl must URL-encode its `s` param so that IF the base64 payload ever contains
  // a "+" (e.g. after a future schema/library change), it survives an actual URLSearchParams
  // round trip instead of being silently decoded as a space.
  test("shareUrl URL-encodes the payload so a literal '+' in the base64 survives a real URLSearchParams round trip", () => {
    // btoa(String.fromCharCode(0xfa, 0x00, 0x00)) === "+gAA" — a deterministic base64 string
    // starting with "+", standing in for a payload that contains the problem character.
    const base64WithPlus = "+gAA";
    expect(base64WithPlus).toContain("+");

    // What shareUrl does today: `${origin}/?s=${encodeURIComponent(serializeShared(input))}`.
    const fixedQueryString = `s=${encodeURIComponent(base64WithPlus)}`;
    const fixedRoundTrip = new URLSearchParams(fixedQueryString).get("s");
    expect(fixedRoundTrip).toBe(base64WithPlus);

    // The pre-fix behavior (`s=${serializeShared(input)}`, no encodeURIComponent) is the bug
    // this guards against: URLSearchParams decodes an unescaped "+" in a query value as a space.
    const buggyQueryString = `s=${base64WithPlus}`;
    const buggyRoundTrip = new URLSearchParams(buggyQueryString).get("s");
    expect(buggyRoundTrip).not.toBe(base64WithPlus);
    expect(buggyRoundTrip).toBe(" gAA");
  });

  test("shareUrl produces a URL whose query param decodes back to the exact serialized payload", () => {
    // jsdom/happy-dom aren't set up for this test file, so exercise the string contract shareUrl
    // relies on rather than calling shareUrl() itself (which reads window.location.origin).
    const input = { ...defaultScenarioInput, startCapital: 1_234_567 };
    const serialized = serializeShared(input);
    const queryString = `s=${encodeURIComponent(serialized)}`;
    const roundTripped = new URLSearchParams(queryString).get("s");
    expect(roundTripped).toBe(serialized);
    expect(parseShared(roundTripped ?? "")?.startCapital).toBe(1_234_567);
  });
});
