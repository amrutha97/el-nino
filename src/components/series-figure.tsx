import { useEffect, useRef } from "react";

type Series = { years: number[]; tC: number[]; hM: number[] };

export function SeriesFigure({
  runA,
  runB,
  windowYears,
}: {
  runA: Series;
  runB: Series | null;
  windowYears: number[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.max(1, Math.floor(rect.width * dpr));
    el.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, width, height);

    const [start, end] = windowYears;
    const span = Math.max(0.5, end - start);
    const pad = { l: 36, r: 12, t: 8, b: 18 };
    const panelH = (height - pad.t - pad.b - 8) / 2;

    drawPanel(ctx, runA, runB, start, span, pad.l, pad.t, width - pad.l - pad.r, panelH, "t", "T_E", "°C");
    drawPanel(ctx, runA, runB, start, span, pad.l, pad.t + panelH + 8, width - pad.l - pad.r, panelH, "h", "h_W", "m");

    ctx.fillStyle = "#737373";
    ctx.font = "11px Geist Mono Variable, ui-monospace, monospace";
    ctx.fillText(`${start.toFixed(0)}`, pad.l, height - 4);
    const endLabel = `${end.toFixed(0)} yr`;
    ctx.fillText(endLabel, width - pad.r - ctx.measureText(endLabel).width, height - 4);
  }, [runA, runB, windowYears]);

  return (
    <canvas
      ref={canvas}
      className="h-44 w-full"
      aria-label="Time series of eastern SST and western thermocline depth."
    />
  );
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  runA: Series,
  runB: Series | null,
  start: number,
  span: number,
  x: number,
  y: number,
  w: number,
  h: number,
  field: "t" | "h",
  label: string,
  unit: string,
) {
  const values = valuesOf(runA, field).concat(runB ? valuesOf(runB, field) : []);
  let peak = field === "t" ? 1.2 : 20;
  for (const value of values) peak = Math.max(peak, Math.abs(value));
  ctx.strokeStyle = "#e5e5e5";
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.fillStyle = "#737373";
  ctx.font = "11px Geist Variable, ui-sans-serif, sans-serif";
  ctx.fillText(label, x, y + 11);
  ctx.font = "11px Geist Mono Variable, ui-monospace, monospace";
  ctx.fillText(`+${peak.toFixed(field === "t" ? 1 : 0)} ${unit}`, x + 36, y + 11);
  stroke(ctx, runA, field, start, span, x, y, w, h, peak, "#171717", false);
  if (runB) stroke(ctx, runB, field, start, span, x, y, w, h, peak, "#b45309", true);
}

function valuesOf(run: Series, field: "t" | "h") {
  return field === "t" ? run.tC : run.hM;
}

function stroke(
  ctx: CanvasRenderingContext2D,
  run: Series,
  field: "t" | "h",
  start: number,
  span: number,
  x: number,
  y: number,
  w: number,
  h: number,
  peak: number,
  color: string,
  dashed: boolean,
) {
  const values = valuesOf(run, field);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.setLineDash(dashed ? [4, 3] : []);
  let moved = false;
  for (let i = 0; i < run.years.length; i += 1) {
    const px = x + ((run.years[i] - start) / span) * w;
    if (px < x || px > x + w) continue;
    const py = y + h / 2 - (values[i] / peak) * (h / 2 - 4);
    if (!moved) {
      ctx.moveTo(px, py);
      moved = true;
    } else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}
