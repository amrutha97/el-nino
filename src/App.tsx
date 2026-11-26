import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, FileJson, Pause, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { PRESETS, SCALES } from "../js/model.js";
import { parameterJson, seriesCsv } from "../js/export.js";
import { createSimulation } from "@/sim/simulation.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Journey } from "@/components/journey";
import { SectionFigure } from "@/components/section-figure";
import { Equations } from "@/components/equations";
import { SweepFigure } from "@/components/sweep-figure";
import { SeriesFigure } from "@/components/series-figure";
import { Controls } from "@/components/controls";
import { Icon } from "@/components/icon";

type Sim = ReturnType<typeof createSimulation>;
type Snap = ReturnType<Sim["snapshot"]>;

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function signed(value: number, digits: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
}

export default function App() {
  const sim = useRef<Sim>(createSimulation());
  const [snap, setSnap] = useState<Snap>(() => sim.current.snapshot());
  const publish = useCallback(() => setSnap(sim.current.snapshot()), []);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    let since = 0;
    const loop = (now: number) => {
      if (!last) last = now;
      const wall = Math.min(0.05, (now - last) / 1000);
      last = now;
      const playing = sim.current.state.playing;
      sim.current.advance(wall);
      since += wall;
      if (playing && (since >= 0.08 || !sim.current.state.playing)) {
        since = 0;
        setSnap(sim.current.snapshot());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const onDrag = useCallback((tCelsius: number, hMeters: number) => {
    sim.current.pause();
    sim.current.state.presetId = "";
    sim.current.placeAt(tCelsius, hMeters, true);
    publish();
  }, [publish]);

  const [tools, setTools] = useState(false);
  const shown = snap.shown;
  const diag = snap.diag;
  const stat = (id: string, label: string, value: string) => (
    <div id={id} className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );

  const exportRuns = () => {
    const runs = [snap.runA, snap.runB].filter((run): run is NonNullable<typeof snap.runB> => run != null);
    return runs.map((run) => ({ id: run.id, params: run.params, series: run.series }));
  };

  return (
    <div className="app-shell min-h-svh bg-background text-foreground">
      <header className="app-header">
        <p className="text-sm font-medium tracking-tight text-muted-foreground">Recharge oscillator</p>
      </header>

      <main className="app-main">
        <Journey
          tCelsius={shown.tCelsius}
          hWest={shown.hMeters}
          hEast={snap.hE}
          zonalShare={diag.zonalShare}
          phaseTitle={snap.compare ? `${snap.edit} · ${snap.phase.title}` : snap.phase.title}
          phaseLine={snap.phase.line}
          beatId={snap.phase.id}
          phaseRange={snap.phaseRange}
          trailA={snap.runA.trail}
          trailB={snap.runB ? snap.runB.trail : null}
          onDrag={onDrag}
        />

        <div>
          <Button
            id="coefficients"
            type="button"
            variant="outline"
            aria-expanded={tools}
            onClick={() => setTools((open) => !open)}
          >
            <Icon icon={SlidersHorizontal} />
            Coefficients
          </Button>
        </div>

        {tools && (
        <>
        <section className="grid gap-2 sm:grid-cols-4">
          {stat("diag-sigma", "σ", diag.growthPerYear != null ? `${signed(diag.growthPerYear, 2)} /yr` : "—")}
          {stat("diag-omega", "ω", diag.omega ? diag.omega.toFixed(3) : "—")}
          {stat("diag-period", "Period", diag.periodYears ? `${diag.periodYears.toFixed(1)} yr` : "—")}
          {stat("diag-lead", "h_W lead", diag.leadMonths ? `${diag.leadMonths.toFixed(0)} mo` : "—")}
        </section>

        <Card>
          <CardHeader><CardTitle>Section</CardTitle></CardHeader>
          <CardContent>
            <SectionFigure tCelsius={shown.tCelsius} hWest={shown.hMeters} hEast={snap.hE} />
            <p className="mt-2 text-xs text-muted-foreground">West is warm-water volume. East is T_E.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Initial states</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(PRESETS).map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-preset={preset.id}
                aria-pressed={snap.presetId === preset.id}
                className="min-h-11 rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent aria-pressed:border-neutral-900 aria-pressed:ring-1 aria-pressed:ring-neutral-900"
                onClick={() => {
                  sim.current.applyPreset(preset);
                  publish();
                }}
              >
                <span className="block font-medium">{preset.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{preset.detail}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Runs</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              id="run-a"
              type="button"
              variant={snap.edit === "A" ? "default" : "outline"}
              aria-pressed={snap.edit === "A"}
              onClick={() => { sim.current.selectRun("A"); publish(); }}
            >
              Run A
            </Button>
            <Button
              id="run-b"
              type="button"
              variant={snap.edit === "B" ? "default" : "outline"}
              aria-pressed={snap.edit === "B"}
              disabled={!snap.compare}
              onClick={() => { sim.current.selectRun("B"); publish(); }}
            >
              Run B
            </Button>
            <Button id="duplicate" type="button" variant="outline" onClick={() => { sim.current.duplicate(); publish(); }}>
              <Icon icon={Copy} />
              Copy A to B
            </Button>
            {snap.compare && (
              <Button id="drop-b" type="button" variant="outline" onClick={() => { sim.current.dropCompare(); publish(); }}>
                <Icon icon={X} />
                Drop B
              </Button>
            )}
            <Button
              id="export-csv"
              type="button"
              variant="outline"
              onClick={() => download("recharge-oscillator.csv", seriesCsv(exportRuns()), "text/csv")}
            >
              <Icon icon={Download} />
              CSV
            </Button>
            <Button
              id="export-json"
              type="button"
              variant="outline"
              onClick={() => download("recharge-oscillator.json", parameterJson({
                reference: "Jin (1997) J. Atmos. Sci. 54, 811–829, equations (2.6), (3.1), (3.4)",
                scales: { h_meters: SCALES.hMeters, T_celsius: SCALES.tCelsius, t_months: SCALES.monthsPerTime },
                time_years: snap.years,
                runs: {
                  A: {
                    parameters: snap.runA.params,
                    initial: { T_E_celsius: snap.runA.ic.tCelsius, h_W_meters: snap.runA.ic.hMeters },
                  },
                  B: snap.runB ? {
                    parameters: snap.runB.params,
                    initial: { T_E_celsius: snap.runB.ic.tCelsius, h_W_meters: snap.runB.ic.hMeters },
                  } : null,
                },
              }), "application/json")}
            >
              <Icon icon={FileJson} />
              JSON
            </Button>
          </CardContent>
          <p className="px-6 pb-4 text-xs text-muted-foreground">
            Run B starts as a copy of Run A. Subsequent coefficients apply to the selected run. The CSV repeats each coefficient on every time row. The JSON is the parameter set.
            {snap.compare && snap.runB
              ? ` Run B: σ = ${signed(snap.runB.diag.growthPerYear, 2)} /yr, period ${snap.runB.diag.periodYears ? `${snap.runB.diag.periodYears.toFixed(1)} yr` : "—"}.`
              : ""}
          </p>
          <div className="px-6 pb-4">
            <SeriesFigure
              runA={snap.runA.series}
              runB={snap.runB ? snap.runB.series : null}
              windowYears={snap.series.window}
            />
          </div>
        </Card>

        {snap.diverged && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
            The linear solution left the resolved range. εₙ h_E³ bounds a supercritical orbit. Increase εₙ, or reset the initial state.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Linear operator</CardTitle></CardHeader>
            <CardContent>
              <Equations
                numbers={snap.numbers}
                regime={snap.regime}
                tendency={snap.tendency}
                rates={snap.rates}
                pieces={diag.pieces}
                flavor={diag.flavor}
                growthPerYear={diag.growthPerYear}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Stability</CardTitle></CardHeader>
            <CardContent>
              <SweepFigure params={snap.params} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coefficients</CardTitle>
            <p className="text-sm text-muted-foreground">
              Values for {snap.edit === "B" ? "Run B" : "Run A"}. Time scale is 2 months. [h] = 150 m, [T] = 7.5 °C.
            </p>
          </CardHeader>
          <CardContent>
            <Controls
              params={snap.params}
              diag={snap.diag}
              ic={snap.ic}
              speed={snap.monthsPerSecond}
              onParam={(key, value) => {
                sim.current.setParam(key, value);
                publish();
              }}
              onInitial={(which, value) => {
                sim.current.state.presetId = "";
                const ic = snap.ic;
                sim.current.placeAt(which === "t" ? value : ic.tCelsius, which === "h" ? value : ic.hMeters, true);
                publish();
              }}
              onSpeed={(value) => {
                sim.current.setSpeed(value);
                publish();
              }}
            />
          </CardContent>
        </Card>
        </>
        )}

        <footer className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            Jin, F.-F. (1997). An equatorial ocean recharge paradigm for ENSO. Part I: Conceptual model.{" "}
            <cite>Journal of the Atmospheric Sciences</cite>, 54(7), 811–829.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/1520-0469(1997)054%3C0811:AEORPF%3E2.0.CO;2">
              doi:10.1175/1520-0469(1997)054&lt;0811:AEORPF&gt;2.0.CO;2
            </a>
            . Part II derives the same oscillator.
          </p>
          <p>
            Stein, K., Timmermann, A., Schneider, N., Jin, F.-F., and Stuecker, M. F. (2014). ENSO seasonal synchronization theory.{" "}
            <cite>Journal of Climate</cite>, 27, 5285–5310.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/JCLI-D-13-00525.1">doi:10.1175/JCLI-D-13-00525.1</a>.
            {" "}λₐ. Levine, A. F. Z., and Jin, F.-F. (2010). Noise-induced instability in the ENSO recharge oscillator.{" "}
            <cite>Journal of the Atmospheric Sciences</cite>, 67, 529–542.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/2009JAS3213.1">doi:10.1175/2009JAS3213.1</a>.
            {" "}B, with Jin, Lin, Timmermann, and Zhao (2007).
          </p>
          <p>
            Jin, F.-F., and S.-I. An (1999). Thermocline and zonal advective feedbacks within the equatorial ocean recharge oscillator model for ENSO.{" "}
            <cite>Geophysical Research Letters</cite>, 26(19), 2989–2992.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1029/1999GL002297">doi:10.1029/1999GL002297</a>.
            {" "}Kug, J.-S., Jin, F.-F., and An, S.-I. (2009). Two types of El Niño events: cold tongue El Niño and warm pool El Niño.{" "}
            <cite>Journal of Climate</cite>, 22(6), 1499–1515.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/2008JCLI2624.1">doi:10.1175/2008JCLI2624.1</a>.
          </p>
          <p>
            Jin, F.-F., Kim, S. T., and Bejarano, L. (2006). A coupled-stability index for ENSO.{" "}
            <cite>Geophysical Research Letters</cite>, 33, L23708.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1029/2006GL027221">doi:10.1029/2006GL027221</a>.
            {" "}An, S.-I., and Jin, F.-F. (2004). Nonlinearity and asymmetry of ENSO.{" "}
            <cite>Journal of Climate</cite>, 17(12), 2399–2412.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/1520-0442(2004)017%3C2399:NAAOE%3E2.0.CO;2">doi:10.1175/1520-0442(2004)017&lt;2399:NAAOE&gt;2.0.CO;2</a>.
          </p>
        </footer>
      </main>

      <div className="playbar">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Button id="play" type="button" variant={snap.playing ? "outline" : "default"} className="transport" aria-label="Play" aria-pressed={snap.playing} onClick={() => { sim.current.play(); publish(); }}>
            <Icon icon={Play} />
          </Button>
          <Button id="pause" type="button" variant="outline" className="transport" aria-label="Pause" aria-pressed={!snap.playing} onClick={() => { sim.current.pause(); publish(); }}>
            <Icon icon={Pause} />
          </Button>
          <Button id="reset" type="button" variant="outline" className="transport" aria-label="Reset" onClick={() => { sim.current.reset(); publish(); }}>
            <Icon icon={RotateCcw} />
          </Button>
          <p id="year" className="m-0 ml-auto shrink-0 whitespace-nowrap text-right font-mono text-sm tabular-nums">Year {snap.years.toFixed(1)}</p>
        </div>
      </div>
    </div>
  );
}
