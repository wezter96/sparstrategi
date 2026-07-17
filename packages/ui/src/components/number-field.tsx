import { Input } from "@sparstrategi/ui/components/input";
import { Label } from "@sparstrategi/ui/components/label";
import * as React from "react";

/** "5000000000" → "5 000 000 000". Swedish grouping, comma decimal separator. */
const formatDisplay = (raw: string): string => {
  const negative = raw.startsWith("-");
  const [intPart = "", decPart] = raw.replace("-", "").split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const withDecimal = decPart !== undefined ? `${grouped},${decPart}` : grouped;
  return negative ? `-${withDecimal}` : withDecimal;
};

/** Strip everything except digits, one leading minus, and one decimal separator (`.` or `,`). */
const toRawDigits = (input: string): string => {
  const negative = input.trimStart().startsWith("-");
  let seenDecimal = false;
  let out = "";
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if ((ch === "." || ch === ",") && !seenDecimal) {
      seenDecimal = true;
      out += ".";
    }
  }
  return negative ? `-${out}` : out;
};

const countDigitsBefore = (s: string, index: number): number => {
  let n = 0;
  for (let i = 0; i < index && i < s.length; i++) {
    if (/\d/.test(s[i]!)) n++;
  }
  return n;
};

const indexAfterNDigits = (s: string, n: number): number => {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i]!)) {
      seen++;
      if (seen === n) return i + 1;
    }
  }
  return s.length;
};

/**
 * Labeled numeric input with thousand-space grouping (5 000 000 kr instead of
 * 5000000) and an optional paired range slider. Formats live while typing,
 * preserving cursor position, and reports plain numbers via `onChange`.
 */
export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rawFromValue = Number.isFinite(props.value) ? String(+props.value.toFixed(4)) : "0";
  const [raw, setRaw] = React.useState(rawFromValue);
  const focused = React.useRef(false);

  // Keep in sync with external changes (e.g. slider, shared-link load) while
  // not fighting the user's own keystrokes mid-edit.
  React.useEffect(() => {
    if (!focused.current) setRaw(rawFromValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawFromValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const displayBefore = el.value;
    const cursorBefore = el.selectionStart ?? displayBefore.length;
    const digitsBeforeCursor = countDigitsBefore(displayBefore, cursorBefore);

    const nextRaw = toRawDigits(displayBefore);
    setRaw(nextRaw);
    const parsed = Number(nextRaw);
    props.onChange(Number.isFinite(parsed) ? parsed : 0);

    const nextDisplay = formatDisplay(nextRaw);
    requestAnimationFrame(() => {
      const pos = indexAfterNDigits(nextDisplay, digitsBeforeCursor);
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={formatDisplay(raw)}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            setRaw(rawFromValue);
          }}
          onChange={handleChange}
        />
        {props.suffix ? (
          <span className="text-xs text-muted-foreground">{props.suffix}</span>
        ) : null}
      </div>
      {props.min !== undefined && props.max !== undefined ? (
        <input
          type="range"
          className="w-full accent-primary"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      ) : null}
    </div>
  );
}
