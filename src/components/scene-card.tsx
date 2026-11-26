import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFullscreen } from "@/components/use-fullscreen";
import { SeriesFigure } from "@/components/series-figure";

type Mode = "earth" | "section" | "cycle";

type EarthApi = {
  update: (state: { tCelsius: number; hWest: number; hEast: number; zonalShare: number }) => void;
  resize: () => void;
  setView: (name: string) => void;
  dispose: () => void;
};
type SectionApi = {
  update: (state: { tCelsius: number; hWest: number; hEast: number }) => void;
  resize: () => void;
  dispose: () => void;
};
type CycleApi = {
  update: (state: { range: { x: number[]; y: number[] }; a: Trail; b: Trail | null }) => void;
  resize: () => void;
  dispose: () => void;
};
type Trail = { h: number[]; t: number[] };

const CAPTION: Record<Mode, string> = {
  earth: "T_E colors equatorial SST. h_W colors the western warm pool. The ribbon is the thermocline from h_W to h_E = h_W + b T_E. Wind along the equator follows the sign of T_E; off-equator arrows are the Sverdrup transport.",
  section: "West is warm-water volume above the thermocline. East is T_E. Particles leave the equator while T_E > 0 and return while T_E < 0.",
  cycle: "Clockwise orbit on the (h_W, T_E) plane: recharge, El Niño, discharge, La Niña. Positive h_W leads positive T_E. Drag the marker to set the initial state. Run B, when present, is amber.",
};

export function SceneCard({
  tCelsius,
  hWest,
  hEast,
  zonalShare,
  phaseTitle,
  phaseRange,
  trailA,
  trailB,
  seriesA,
  seriesB,
  windowYears,
  onDrag,
}: {
  tCelsius: number;
  hWest: number;
  hEast: number;
  zonalShare: number;
  phaseTitle: string;
  phaseRange: { x: number[]; y: number[] };
  trailA: Trail;
  trailB: Trail | null;
  seriesA: { years: number[]; tC: number[]; hM: number[] };
  seriesB: { years: number[]; tC: number[]; hM: number[] } | null;
  windowYears: number[];
  onDrag: (tCelsius: number, hMeters: number) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<EarthApi | SectionApi | CycleApi | null>(null);
  const [mode, setMode] = useState<Mode>("earth");
  const [camera, setCamera] = useState("pacific");
  const latest = useRef({ tCelsius, hWest, hEast, zonalShare, phaseRange, trailA, trailB });
  latest.current = { tCelsius, hWest, hEast, zonalShare, phaseRange, trailA, trailB };
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;
  const fullscreen = useFullscreen(() => stage.current);

  const push = useCallback((mounted: EarthApi | SectionApi | CycleApi, next: Mode) => {
    const data = latest.current;
    if (next === "earth") {
      (mounted as EarthApi).update({
        tCelsius: data.tCelsius,
        hWest: data.hWest,
        hEast: data.hEast,
        zonalShare: data.zonalShare,
      });
    } else if (next === "section") {
      (mounted as SectionApi).update({
        tCelsius: data.tCelsius,
        hWest: data.hWest,
        hEast: data.hEast,
      });
    } else {
      (mounted as CycleApi).update({
        range: data.phaseRange,
        a: data.trailA,
        b: data.trailB,
      });
    }
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let dead = false;
    const fail = (error: unknown) => {
      console.error(error);
      const fallback = document.getElementById("globe-fallback");
      if (fallback) fallback.hidden = false;
    };
    if (mode === "earth") {
      import("@/globe/pacific.js").then(({ mountPacific }) => mountPacific(el)).then((mounted: EarthApi) => {
        if (dead) {
          mounted.dispose();
          return;
        }
        api.current = mounted;
        mounted.setView(camera);
        push(mounted, "earth");
      }).catch(fail);
    } else if (mode === "section") {
      import("@/scene/section.js").then(({ mountSection }) => {
        if (dead) return null;
        const mounted = mountSection(el) as SectionApi;
        api.current = mounted;
        push(mounted, "section");
        return mounted;
      }).catch(fail);
    } else {
      import("@/scene/cycle.js").then(({ mountCycle }) => {
        if (dead) return null;
        const mounted = mountCycle(el, (t: number, h: number) => onDragRef.current(t, h)) as CycleApi;
        api.current = mounted;
        push(mounted, "cycle");
        return mounted;
      }).catch(fail);
    }
    return () => {
      dead = true;
      api.current?.dispose();
      api.current = null;
    };
  }, [mode, push]);

  useEffect(() => {
    const mounted = api.current;
    if (!mounted) return;
    push(mounted, mode);
  }, [tCelsius, hWest, hEast, zonalShare, phaseRange, trailA, trailB, mode, push]);

  useEffect(() => {
    if (mode !== "earth") return;
    (api.current as EarthApi | null)?.setView?.(camera);
  }, [camera, mode]);

  useEffect(() => {
    api.current?.resize();
  }, [fullscreen.active]);

  const sign = (value: number, digits: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Equatorial Pacific</CardTitle>
        <div className="flex flex-wrap gap-2">
          {(["earth", "section", "cycle"] as Mode[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant="outline"
              data-scene={item}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {item === "earth" ? "Earth" : item === "section" ? "Section" : "Cycle"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {mode === "earth" && (
          <div className="globe-views mb-3 flex flex-wrap gap-2">
            {(["pacific", "equator", "globe"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                variant="outline"
                data-globe-view={item}
                aria-pressed={camera === item}
                onClick={() => {
                  setCamera(item);
                  (api.current as EarthApi | null)?.setView?.(item);
                }}
              >
                {item === "pacific" ? "Pacific" : item === "equator" ? "Equator" : "Whole Earth"}
              </Button>
            ))}
          </div>
        )}
        <div
          ref={stage}
          className={`scene-stage globe-stage ${mode === "earth" ? "on-dark" : "on-light"} ${fullscreen.fallback ? "is-fallback" : ""}`}
        >
          <canvas
            key={mode}
            id="globe"
            ref={canvas}
            aria-label={
              mode === "earth"
                ? "Equatorial Pacific. Drag to look around. Pinch or scroll to zoom."
                : mode === "section"
                  ? "Equatorial section. West is warm-water volume. East is SST."
                  : "Phase plane of western thermocline depth and eastern SST. Drag the marker to set the initial state."
            }
          />
          {mode === "earth" && (
            <>
              <p className="pin" data-pin="pool">Warm pool</p>
              <p className="pin" data-pin="tongue">Cold tongue</p>
            </>
          )}
          {mode === "cycle" && (
            <>
              <p className="cycle-label top">El Niño</p>
              <p className="cycle-label right">Recharged</p>
              <p className="cycle-label bottom">La Niña</p>
              <p className="cycle-label left">Discharged</p>
            </>
          )}
          {mode === "section" && (
            <>
              <p className="cycle-label left">West</p>
              <p className="cycle-label right">East</p>
            </>
          )}
          <p className="scene-readout">
            <span className="font-medium">{phaseTitle}</span>
            <span className="font-mono"> T_E {sign(tCelsius, 2)} °C</span>
            <span className="font-mono"> h_W {sign(hWest, 0)} m</span>
          </p>
          {fullscreen.active ? (
            <Button id="scene-close" type="button" className="scene-close" onClick={fullscreen.exit}>Close</Button>
          ) : (
            <Button id="fullscreen" type="button" variant="outline" className="scene-close" onClick={fullscreen.enter}>Full screen</Button>
          )}
          <p id="globe-fallback" hidden className="absolute inset-0 grid place-items-center bg-neutral-950/80 p-6 text-center text-sm text-white">
            WebGL is unavailable. The coefficients and the linear operator remain below.
          </p>
        </div>
        <p id="globe-caption" className="mt-3 text-sm leading-relaxed text-muted-foreground">{CAPTION[mode]}</p>
        {mode === "cycle" && (
          <div className="mt-4">
            <SeriesFigure runA={seriesA} runB={seriesB} windowYears={windowYears} />
            <p className="mt-2 text-xs text-muted-foreground">
              Upper panel T_E, lower panel h_W. Run A is black. Run B is amber and dashed. h_W peaks before T_E.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
