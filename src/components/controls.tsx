import { CONTROLS, CONTROL_GROUPS } from "@/sim/copy.js";
import { Slider } from "@/components/ui/slider";

type Control = (typeof CONTROLS)[number];

function Field({
  id,
  symbol,
  name,
  value,
  min,
  max,
  step,
  digits,
  gloss,
  sentence,
  onChange,
}: {
  id: string;
  symbol: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  gloss: string;
  sentence: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block py-1.5" htmlFor={id}>
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span><span className="font-mono">{symbol}</span> {name}</span>
        <span className="font-mono text-xs text-muted-foreground">{value.toFixed(digits)} · {gloss}</span>
      </span>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        aria-describedby={`${id}-help`}
      />
      <span id={`${id}-help`} className="block text-xs leading-relaxed text-muted-foreground">{sentence}</span>
    </label>
  );
}

export function Controls({
  params,
  diag,
  ic,
  speed,
  onParam,
  onInitial,
  onSpeed,
}: {
  params: Record<string, number>;
  diag: {
    b: number;
    sstDampingMonths: number;
    oceanMemoryMonths: number;
    pieces: { zonal: number; ekman: number };
  };
  ic: { tCelsius: number; hMeters: number };
  speed: number;
  onParam: (key: string, value: number) => void;
  onInitial: (which: "t" | "h", value: number) => void;
  onSpeed: (value: number) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {CONTROL_GROUPS.map((group) => (
        <fieldset key={group} className="min-w-0">
          <legend className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{group}</legend>
          {CONTROLS.filter((control) => control.group === group).map((control: Control) => (
            <Field
              key={control.key}
              id={`param-${control.key}`}
              symbol={control.symbol}
              name={control.name}
              value={params[control.key]}
              min={control.min}
              max={control.max}
              step={control.step}
              digits={control.digits}
              gloss={control.gloss(params, diag)}
              sentence={control.sentence}
              onChange={(value) => onParam(control.key, value)}
            />
          ))}
        </fieldset>
      ))}
      <fieldset className="min-w-0 md:col-span-2">
        <legend className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Initial state and playback</legend>
        <div className="grid gap-2 md:grid-cols-3">
          <Field
            id="ic-t"
            symbol="T_E(0)"
            name="Starting temperature"
            value={ic.tCelsius}
            min={-4}
            max={4}
            step={0.01}
            digits={2}
            gloss="°C"
            sentence="Where the eastern Pacific starts. Warm is El Niño; cold is La Niña."
            onChange={(value) => onInitial("t", value)}
          />
          <Field
            id="ic-h"
            symbol="h_W(0)"
            name="Starting heat"
            value={ic.hMeters}
            min={-80}
            max={80}
            step={0.5}
            digits={1}
            gloss="m"
            sentence="Western thermocline at the start. Positive is recharged."
            onChange={(value) => onInitial("h", value)}
          />
          <Field
            id="speed"
            symbol="speed"
            name="Playback"
            value={speed}
            min={0.5}
            max={24}
            step={0.5}
            digits={1}
            gloss="mo/s"
            sentence="Clock rate, in model months per second of wall time."
            onChange={onSpeed}
          />
        </div>
      </fieldset>
    </div>
  );
}
