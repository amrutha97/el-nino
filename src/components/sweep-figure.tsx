import { useMemo, useState } from "react";
import { sweepLinear } from "../../js/sweep.js";

type Params = Record<string, number>;

export function SweepFigure({ params }: { params: Params }) {
  const [which, setWhich] = useState<"mu" | "b">("mu");
  const points = useMemo(() => sweepLinear(params, which), [params, which]);
  const current = which === "b" ? params.b0 * params.mu : params.mu;
  const width = 640;
  const height = 200;
  const pad = { l: 44, r: 44, t: 16, b: 28 };
  const xMax = which === "b" ? 3.75 : 1.5;
  const growths = points.map((point) => point.growthPerYear);
  const gMax = Math.max(0.4, ...growths.map((value) => Math.abs(value)));
  const periods = points.filter((point) => point.periodYears != null).map((point) => point.periodYears as number);
  const pMax = Math.max(6, ...periods, 1);
  const X = (x: number) => pad.l + (x / xMax) * (width - pad.l - pad.r);
  const Yg = (g: number) => pad.t + (1 - (g + gMax) / (2 * gMax)) * (height - pad.t - pad.b);
  const Yp = (p: number) => pad.t + (1 - p / pMax) * (height - pad.t - pad.b);
  const growthPath = points.map((point, i) => `${i ? "L" : "M"}${X(point.x).toFixed(1)},${Yg(point.growthPerYear).toFixed(1)}`).join(" ");
  let periodPath = "";
  let pen = false;
  for (const point of points) {
    if (point.periodYears == null) {
      pen = false;
      continue;
    }
    periodPath += `${pen ? "L" : "M"}${X(point.x).toFixed(1)},${Yp(point.periodYears).toFixed(1)} `;
    pen = true;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          id="sweep-mu"
          aria-pressed={which === "mu"}
          className="min-h-11 rounded-md border border-border px-3 text-sm aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
          onClick={() => setWhich("mu")}
        >
          Sweep μ
        </button>
        <button
          type="button"
          id="sweep-b"
          aria-pressed={which === "b"}
          className="min-h-11 rounded-md border border-border px-3 text-sm aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
          onClick={() => setWhich("b")}
        >
          Sweep b
        </button>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label="Growth rate and period against the swept coefficient. The zero line is the stability boundary.">
        <line x1={pad.l} x2={width - pad.r} y1={Yg(0)} y2={Yg(0)} stroke="#e5e5e5" />
        <path d={growthPath} fill="none" stroke="#171717" strokeWidth="1.6" />
        <path d={periodPath} fill="none" stroke="#b45309" strokeWidth="1.6" />
        <line x1={X(current)} x2={X(current)} y1={pad.t} y2={height - pad.b} stroke="#e11d48" strokeDasharray="3 3" />
        <text x={pad.l} y={12} fill="#737373" fontSize="11" fontFamily="Geist, sans-serif">σ /yr</text>
        <text x={width - pad.r} y={12} fill="#b45309" fontSize="11" textAnchor="end" fontFamily="Geist, sans-serif">period, yr</text>
        <text x={pad.l} y={height - 8} fill="#737373" fontSize="11" fontFamily="Geist Mono Variable, monospace">0</text>
        <text x={width - pad.r} y={height - 8} fill="#737373" fontSize="11" textAnchor="end" fontFamily="Geist Mono Variable, monospace">{which === "b" ? "b" : "μ"} = {xMax}</text>
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Black is the growth rate σ. Amber is the period where ω is real. The red line is the current {which === "b" ? "b = b₀ μ" : "μ"}. σ = 0 is the stability boundary.
      </p>
    </div>
  );
}
