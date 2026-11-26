import { TERM_SPEC } from "@/sim/copy.js";

const HEAT = new Set(["memory", "sverdrup"]);
const SST_TERMS = ["damping", "tilt", "zonal", "ekman", "thermocline", "cubic", "ndh", "annual"];

type Pieces = {
  thermocline: number;
  zonal: number;
  ekman: number;
  damping: number;
};

export function Equations({
  numbers,
  regime,
  tendency,
  rates,
  pieces,
  flavor,
  growthPerYear,
}: {
  numbers: string;
  regime: string;
  tendency: string;
  rates: Record<string, number>;
  pieces: Pieces;
  flavor: string;
  growthPerYear: number;
}) {
  const scaleT = Math.max(0.15, ...SST_TERMS.map((id) => Math.abs(rates[id] || 0)));
  const scaleH = Math.max(1.5, ...["memory", "sverdrup"].map((id) => Math.abs(rates[id] || 0)));
  const perYear = 6;
  const bj = [
    { name: "Damping −c", value: pieces.damping * perYear },
    { name: "Thermocline γb", value: pieces.thermocline * perYear },
    { name: "Zonal advection ζb", value: pieces.zonal * perYear },
    { name: "Ekman κb", value: pieces.ekman * perYear },
  ];
  const bjScale = Math.max(0.4, ...bj.map((item) => Math.abs(item.value)));
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="font-mono text-[15px] leading-snug">
        <span className="text-neutral-500">dT_E/dt</span> = R T_E + γ h_W − εₙ h_E³ + ν T_E² + γ ξ₁ + ξ₂
      </p>
      <p className="font-mono text-[15px] leading-snug">
        <span className="text-neutral-500">dh_W/dt</span> = −r h_W − α b T_E − α ξ₁
      </p>
      <p className="font-mono text-[13px] text-muted-foreground">
        R = (γ + ζ + κ) b − c, &nbsp; b = b₀ μ, &nbsp; h_E = h_W + b T_E
        <br />
        σ = (R − r) / 2, &nbsp; ω = √[α b γ − (R + r)² / 4]
        <br />
        λₐ cos(2π t) T_E and G = 1 + B T_E stay out until those controls move.
      </p>
      <p>{numbers}</p>
      <p className="text-muted-foreground">{regime}</p>
      <h3 className="pt-1 text-sm font-semibold">What each term is doing now</h3>
      <div className="space-y-2.5">
        {TERM_SPEC.map((term) => {
          const rate = rates[term.id] || 0;
          const heat = HEAT.has(term.id);
          const scale = heat ? scaleH : scaleT;
          const fraction = Math.max(-1, Math.min(1, rate / scale));
          const unit = heat ? "m/mo" : "°C/mo";
          const sign = rate > 0 ? "+" : rate < 0 ? "−" : "";
          return (
            <div key={term.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[13px]">{term.eq}</span>
                <span className="text-xs text-muted-foreground">{sign}{Math.abs(rate).toFixed(2)} {unit}</span>
              </div>
              <p className="text-xs text-muted-foreground">{term.meaning}</p>
              <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <i className="absolute left-1/2 top-0 h-full w-px bg-neutral-300" />
                <i
                  className="absolute top-0 h-full bg-neutral-900"
                  style={{
                    width: `${Math.abs(fraction) * 50}%`,
                    left: fraction >= 0 ? "50%" : `${50 - Math.abs(fraction) * 50}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p>{tendency}</p>
      <h3 className="pt-1 text-sm font-semibold">Bjerknes index</h3>
      <p className="text-xs text-muted-foreground">
        Jin, Kim, and Bejarano (2006) identify the Bjerknes index with the growth rate. σ = {growthPerYear >= 0 ? "+" : "−"}{Math.abs(growthPerYear).toFixed(2)} /yr.
        The four contributions sum to R, and σ = (R − r) / 2.
        {flavor === "warm-pool"
          ? " ζb > γb: warm-pool SST, Kug, Jin, and An (2009)."
          : " γb ≥ ζb: cold-tongue SST."}
      </p>
      <div className="space-y-2">
        {bj.map((item) => {
          const fraction = Math.max(-1, Math.min(1, item.value / bjScale));
          return (
            <div key={item.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs">{item.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.value >= 0 ? "+" : "−"}{Math.abs(item.value).toFixed(2)} /yr
                </span>
              </div>
              <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <i className="absolute left-1/2 top-0 h-full w-px bg-neutral-300" />
                <i
                  className="absolute top-0 h-full bg-neutral-900"
                  style={{
                    width: `${Math.abs(fraction) * 50}%`,
                    left: fraction >= 0 ? "50%" : `${50 - Math.abs(fraction) * 50}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        ζ = κ = ν = 0 recovers Jin (1997), (2.6), (3.1), and (3.4). κ is the Ekman contribution in the Bjerknes index. ν T_E² has the sign of the nonlinear dynamical heating in An and Jin (2004).
      </p>
    </div>
  );
}
