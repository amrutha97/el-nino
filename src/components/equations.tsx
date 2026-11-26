import { TERM_SPEC } from "@/sim/copy.js";

const HEAT = new Set(["memory", "sverdrup"]);

export function Equations({
  numbers,
  regime,
  tendency,
  rates,
}: {
  numbers: string;
  regime: string;
  tendency: string;
  rates: Record<string, number>;
}) {
  const scaleT = Math.max(0.15, ...["bjerknes", "thermocline", "cubic"].map((id) => Math.abs(rates[id] || 0)));
  const scaleH = Math.max(1.5, ...["memory", "sverdrup"].map((id) => Math.abs(rates[id] || 0)));
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="font-mono text-[15px] leading-snug">
        <span className="text-neutral-500">dT_E/dt</span> = R T_E + γ h_W − εₙ (h_W + b T_E)³ + γ ξ₁ + ξ₂
      </p>
      <p className="font-mono text-[15px] leading-snug">
        <span className="text-neutral-500">dh_W/dt</span> = −r h_W − α b T_E − α ξ₁
      </p>
      <p className="font-mono text-[13px] text-muted-foreground">
        R = γb − c, &nbsp; b = b₀ μ, &nbsp; h_E = h_W + b T_E
        <br />
        σ = (R − r) / 2, &nbsp; ω = √[α b γ − (R + r)² / 4]
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        Jin’s conceptual model only (Journal of the Atmospheric Sciences, 1997, Part I, eqs. 2.6, 3.1, and 3.4).
        The small Ekman term δₛb′ is left out, as Jin does after eq. 2.6. There is no seasonal cycle.
      </p>
    </div>
  );
}
