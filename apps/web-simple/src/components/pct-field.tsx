import { NumberField } from "@sparstrategi/ui/components/number-field";

/** Ett procentfält: UI i %, state i decimal. */
export function PctField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
}) {
  return (
    <NumberField
      label={props.label}
      value={props.value * 100}
      onChange={(v) => props.onChange(v / 100)}
      min={0}
      max={props.max ?? 30}
      step={props.step ?? 0.1}
      suffix="%"
    />
  );
}
