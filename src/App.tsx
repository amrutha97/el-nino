import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { PRESETS } from "../js/model.js";
import { createSimulation } from "@/sim/simulation.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlobeCard } from "@/components/globe-card";
import { PhaseChart, SeriesChart } from "@/components/charts";
import { Equations } from "@/components/equations";
import { Basin } from "@/components/basin";
import { Controls } from "@/components/controls";

type Sim = ReturnType<typeof createSimulation>;
type Snap = ReturnType<Sim["snapshot"]>;

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

  const shown = snap.shown;
  const stat = (label: string, value: string) => (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="mx-auto max-w-6xl px-4 pb-2 pt-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Equatorial Pacific · two equations</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Recharge oscillator</h1>
            <p className="intro-copy mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              El Niño in Fei-Fei Jin’s recharge oscillator. The default is his 1997 model: stored heat in the west warms the east, the winds drain it, and the Pacific swings back.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4">
        <GlobeCard tCelsius={shown.tCelsius} hWest={shown.hMeters} hEast={snap.hE} zonalShare={snap.diag.zonalShare} />

        <section className="status-block grid gap-3 sm:grid-cols-[1.4fr_1fr] sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="phase-title" className="text-2xl font-semibold tracking-tight">{snap.phase.title}</h2>
              <Badge>{snap.playing ? "Playing" : "Paused"}</Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{snap.phase.line}</p>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {stat("Period", snap.diag.periodYears ? `${snap.diag.periodYears.toFixed(1)} yr` : "no cycle")}
            {stat("Growth σ", `${snap.diag.growthPerYear >= 0 ? "+" : "−"}${Math.abs(snap.diag.growthPerYear).toFixed(2)} /yr`)}
            {stat("Heat leads", snap.diag.leadMonths ? `${snap.diag.leadMonths.toFixed(0)} mo` : "—")}
          </dl>
        </section>

        <Card>
          <CardHeader><CardTitle>Start from a preset</CardTitle></CardHeader>
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

        {snap.diverged && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
            The linear oscillator ran away. Jin’s cubic term εₙ is what keeps a growing El Niño finite. Raise εₙ, or press Reset.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Phase portrait</CardTitle>
              <p className="font-mono text-xs text-muted-foreground">
                T_E {shown.tCelsius >= 0 ? "+" : "−"}{Math.abs(shown.tCelsius).toFixed(2)} °C
                {" · "}
                h_W {shown.hMeters >= 0 ? "+" : "−"}{Math.abs(shown.hMeters).toFixed(1)} m
              </p>
            </CardHeader>
            <CardContent>
              <PhaseChart snap={snap} onDrag={onDrag} />
              <p className="mt-2 text-xs text-muted-foreground">
                Drag the dot to set the start. Right is recharged heat, left is discharged. Up is a warm east. Jin’s cycle runs clockwise.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>The equations</CardTitle></CardHeader>
            <CardContent>
              <Equations
                numbers={snap.numbers}
                regime={snap.regime}
                tendency={snap.tendency}
                rates={snap.rates}
                pieces={snap.diag.pieces}
                flavor={snap.diag.flavor}
                growthPerYear={snap.diag.growthPerYear}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Eastern temperature and western heat</CardTitle></CardHeader>
            <CardContent>
              <SeriesChart snap={snap} />
              <p className="mt-2 text-xs text-muted-foreground">
                Rose is the eastern temperature T_E. Amber is the western thermocline h_W. Heat peaks before the warm event.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recharge versus discharge</CardTitle></CardHeader>
            <CardContent>
              <Basin
                tCelsius={shown.tCelsius}
                hMeters={shown.hMeters}
                hE={snap.hE}
                discharge={snap.det.termsH.sverdrup < 0}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coefficients</CardTitle>
            <p className="text-sm text-muted-foreground">
              The first nine sliders are Jin’s 1997 coefficients. The last three are off by default: zonal advection from Jin and An (1999), the Ekman feedback restored in the 2006 Bjerknes index, and a quadratic stand-in for the nonlinear heating in An and Jin (2004). Playback speed is not a coefficient. Reset starts the current experiment over.
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

        <footer className="space-y-2 pb-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Default model: Jin, F.-F. (1997). An equatorial ocean recharge paradigm for ENSO. Part I: Conceptual model.{" "}
            <cite>Journal of the Atmospheric Sciences</cite>, 54(7), 811–829.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/1520-0469(1997)054%3C0811:AEORPF%3E2.0.CO;2">
              doi:10.1175/1520-0469(1997)054&lt;0811:AEORPF&gt;2.0.CO;2
            </a>
            . Part II derives the same oscillator. With ζ, κ, and ν at zero, those are the only equations being integrated.
          </p>
          <p>
            Jin, F.-F., and S.-I. An (1999). Thermocline and zonal advective feedbacks within the equatorial ocean recharge oscillator model for ENSO.{" "}
            <cite>Geophysical Research Letters</cite>, 26(19), 2989–2992.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1029/1999GL002297">doi:10.1029/1999GL002297</a>.
            Kug, J.-S., Jin, F.-F., and An, S.-I. (2009). Two types of El Niño events: cold tongue El Niño and warm pool El Niño.{" "}
            <cite>Journal of Climate</cite>, 22(6), 1499–1515.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/2008JCLI2624.1">doi:10.1175/2008JCLI2624.1</a>.
          </p>
          <p>
            Jin, F.-F., Kim, S. T., and Bejarano, L. (2006). A coupled-stability index for ENSO.{" "}
            <cite>Geophysical Research Letters</cite>, 33, L23708.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1029/2006GL027221">doi:10.1029/2006GL027221</a>.
            An, S.-I., and Jin, F.-F. (2004). Nonlinearity and asymmetry of ENSO.{" "}
            <cite>Journal of Climate</cite>, 17(12), 2399–2412.{" "}
            <a className="underline underline-offset-2" href="https://doi.org/10.1175/1520-0442(2004)017%3C2399:NAAOE%3E2.0.CO;2">doi:10.1175/1520-0442(2004)017&lt;2399:NAAOE&gt;2.0.CO;2</a>.
          </p>
          <p>
            His most-cited papers by count are coauthored projections and reviews — Cai and others (2014) on more frequent extreme El Niño, Yeh and others (2009), Collins and others (2010). They do not add a term to these two equations, so they are not integrated.
          </p>
        </footer>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-3 py-2 backdrop-blur" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Button id="play" type="button" className="flex-1" aria-pressed={snap.playing} onClick={() => { sim.current.play(); publish(); }}>
            <Play className="h-4 w-4" /> Play
          </Button>
          <Button id="pause" type="button" variant="outline" className="flex-1" aria-pressed={!snap.playing} onClick={() => { sim.current.pause(); publish(); }}>
            <Pause className="h-4 w-4" /> Pause
          </Button>
          <Button id="reset" type="button" variant="outline" className="flex-1" onClick={() => { sim.current.reset(); publish(); }}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <p id="year" className="m-0 shrink-0 whitespace-nowrap text-right font-mono text-sm tabular-nums">Year {snap.years.toFixed(1)}</p>
        </div>
      </div>
    </div>
  );
}
