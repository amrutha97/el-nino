import { useEffect, useRef } from "react";
import Plotly from "plotly.js-basic-dist-min";

const FONT = '"Geist Variable", Geist, sans-serif';
const AXIS = {
  gridcolor: "#eee",
  zerolinecolor: "#d4d4d4",
  color: "#171717",
  tickfont: { family: FONT, size: 11, color: "#666" },
  titlefont: { family: FONT, size: 12, color: "#171717" },
};

function layout(extra: object) {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "#fafafa",
    font: { family: FONT, color: "#171717", size: 12 },
    margin: { l: 52, r: 52, t: 8, b: 40 },
    showlegend: false,
    hovermode: false,
    dragmode: false,
    ...extra,
  };
}

function markerColor(id: string) {
  if (id === "elnino") return "#e11d48";
  if (id === "lanina") return "#0891b2";
  if (id === "recharged") return "#d97706";
  return "#2563eb";
}

type Snap = {
  shown: { tCelsius: number; hMeters: number };
  phase: { id: string };
  trail: { h: number[]; t: number[] };
  phaseRange: { x: number[]; y: number[] };
  series: {
    years: number[];
    tC: number[];
    hM: number[];
    window: number[];
    tRange: number[];
    hRange: number[];
  };
};

export function PhaseChart({
  snap,
  onDrag,
}: {
  snap: Snap;
  onDrag: (tCelsius: number, hMeters: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const rangeKey = useRef("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    Plotly.newPlot(
      el,
      [
        {
          x: snap.trail.h,
          y: snap.trail.t,
          mode: "lines",
          line: { color: "#d97706", width: 2.2 },
          hoverinfo: "skip",
        },
        {
          x: [snap.shown.hMeters],
          y: [snap.shown.tCelsius],
          mode: "markers",
          marker: { size: 14, color: markerColor(snap.phase.id), line: { color: "#fff", width: 2 } },
          hoverinfo: "skip",
        },
      ],
      layout({
        xaxis: { ...AXIS, title: "h_W (m)", range: snap.phaseRange.x },
        yaxis: { ...AXIS, title: "T_E (°C)", range: snap.phaseRange.y },
      }),
      { responsive: true, displayModeBar: false, scrollZoom: false },
    ).then(() => {
      if (!cancelled) ready.current = true;
    });
    return () => {
      cancelled = true;
      ready.current = false;
      Plotly.purge(el);
    };
    // Mount once. Later frames go through the update effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready.current) return;
    Plotly.restyle(el, { x: [snap.trail.h], y: [snap.trail.t] }, [0]);
    Plotly.restyle(
      el,
      {
        x: [[snap.shown.hMeters]],
        y: [[snap.shown.tCelsius]],
        "marker.color": markerColor(snap.phase.id),
      },
      [1],
    );
    const key = `${snap.phaseRange.x[1]}:${snap.phaseRange.y[1]}`;
    if (key !== rangeKey.current) {
      rangeKey.current = key;
      Plotly.relayout(el, { "xaxis.range": snap.phaseRange.x, "yaxis.range": snap.phaseRange.y });
    }
  }, [snap]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dragging = false;
    const read = (ev: PointerEvent) => {
      const area = el.querySelector(".nsewdrag") || el.querySelector(".xy");
      const box = (area || el).getBoundingClientRect();
      if (box.width < 10) return null;
      const fx = (ev.clientX - box.left) / box.width;
      const fy = (ev.clientY - box.top) / box.height;
      if (fx < -0.02 || fx > 1.02 || fy < -0.02 || fy > 1.02) return null;
      const plot = el as HTMLElement & { _fullLayout?: { xaxis?: { range?: number[] }; yaxis?: { range?: number[] } } };
      const xr = plot._fullLayout?.xaxis?.range || snap.phaseRange.x;
      const yr = plot._fullLayout?.yaxis?.range || snap.phaseRange.y;
      return {
        hMeters: xr[0] + Math.min(1, Math.max(0, fx)) * (xr[1] - xr[0]),
        tCelsius: yr[1] - Math.min(1, Math.max(0, fy)) * (yr[1] - yr[0]),
      };
    };
    const down = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const data = read(ev);
      if (!data) return;
      dragging = true;
      el.setPointerCapture?.(ev.pointerId);
      onDrag(data.tCelsius, data.hMeters);
      ev.preventDefault();
    };
    const move = (ev: PointerEvent) => {
      if (!dragging) return;
      const data = read(ev);
      if (data) onDrag(data.tCelsius, data.hMeters);
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [onDrag, snap.phaseRange]);

  return (
    <div
      ref={ref}
      id="phase"
      className="h-[320px] w-full touch-none lg:h-[380px]"
      role="img"
      aria-label="Phase portrait of western thermocline against eastern Pacific temperature. Drag to set the starting state."
    />
  );
}

export function SeriesChart({ snap }: { snap: Snap }) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    Plotly.newPlot(
      el,
      [
        {
          x: snap.series.years,
          y: snap.series.tC,
          mode: "lines",
          line: { color: "#e11d48", width: 2.2 },
          hoverinfo: "skip",
        },
        {
          x: snap.series.years,
          y: snap.series.hM,
          mode: "lines",
          yaxis: "y2",
          line: { color: "#d97706", width: 2.2 },
          hoverinfo: "skip",
        },
      ],
      layout({
        margin: { l: 48, r: 48, t: 8, b: 40 },
        xaxis: { ...AXIS, title: "Years", range: snap.series.window, zeroline: false },
        yaxis: { ...AXIS, title: "T_E (°C)", range: snap.series.tRange, zerolinecolor: "rgba(225,29,72,0.35)" },
        yaxis2: {
          ...AXIS,
          title: "h_W (m)",
          overlaying: "y",
          side: "right",
          range: snap.series.hRange,
          gridcolor: "rgba(0,0,0,0)",
          zeroline: false,
        },
      }),
      { responsive: true, displayModeBar: false, scrollZoom: false },
    ).then(() => {
      if (!cancelled) ready.current = true;
    });
    const onResize = () => Plotly.Plots.resize(el);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      ready.current = false;
      window.removeEventListener("resize", onResize);
      Plotly.purge(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready.current) return;
    Plotly.restyle(el, { x: [snap.series.years, snap.series.years], y: [snap.series.tC, snap.series.hM] }, [0, 1]);
    Plotly.relayout(el, {
      "xaxis.range": snap.series.window,
      "yaxis.range": snap.series.tRange,
      "yaxis2.range": snap.series.hRange,
    });
  }, [snap]);

  return (
    <div
      ref={ref}
      id="series"
      className="h-[240px] w-full"
      role="img"
      aria-label="Time series of eastern Pacific temperature and western thermocline."
    />
  );
}
