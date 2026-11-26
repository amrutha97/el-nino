import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { useFullscreen } from "@/components/use-fullscreen";

type EarthApi = {
  update: (state: { tCelsius: number; hWest: number; hEast: number; zonalShare: number }) => void;
  resize: () => void;
  setView: (name: string) => void;
  dispose: () => void;
};
type CycleApi = {
  update: (state: { range: { x: number[]; y: number[] }; a: Trail; b: Trail | null }) => void;
  resize: () => void;
  dispose: () => void;
};
type Trail = { h: number[]; t: number[] };

const BEATS = [
  { id: "recharged", className: "right", label: "Recharged" },
  { id: "warming", className: "warming", label: "Warming" },
  { id: "elnino", className: "top", label: "El Niño" },
  { id: "discharged", className: "left", label: "Discharge" },
  { id: "lanina", className: "bottom", label: "La Niña" },
  { id: "recharge", className: "recharge", label: "Recharge" },
];

export function Journey({
  tCelsius,
  hWest,
  hEast,
  zonalShare,
  phaseTitle,
  phaseLine,
  beatId,
  phaseRange,
  trailA,
  trailB,
  onDrag,
}: {
  tCelsius: number;
  hWest: number;
  hEast: number;
  zonalShare: number;
  phaseTitle: string;
  phaseLine: string;
  beatId: string;
  phaseRange: { x: number[]; y: number[] };
  trailA: Trail;
  trailB: Trail | null;
  onDrag: (tCelsius: number, hMeters: number) => void;
}) {
  const earthStage = useRef<HTMLDivElement>(null);
  const earthCanvas = useRef<HTMLCanvasElement>(null);
  const orbitCanvas = useRef<HTMLCanvasElement>(null);
  const earthApi = useRef<EarthApi | null>(null);
  const orbitApi = useRef<CycleApi | null>(null);
  const [camera, setCamera] = useState("pacific");
  const latest = useRef({ tCelsius, hWest, hEast, zonalShare, phaseRange, trailA, trailB });
  latest.current = { tCelsius, hWest, hEast, zonalShare, phaseRange, trailA, trailB };
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;
  const fullscreen = useFullscreen(() => earthStage.current);

  useEffect(() => {
    const el = earthCanvas.current;
    if (!el) return;
    let dead = false;
    import("@/globe/pacific.js")
      .then(({ mountPacific }) => mountPacific(el))
      .then((mounted: EarthApi) => {
        if (dead) {
          mounted.dispose();
          return;
        }
        earthApi.current = mounted;
        mounted.setView(camera);
        const data = latest.current;
        mounted.update({
          tCelsius: data.tCelsius,
          hWest: data.hWest,
          hEast: data.hEast,
          zonalShare: data.zonalShare,
        });
      })
      .catch((error: unknown) => {
        console.error(error);
        const fallback = document.getElementById("globe-fallback");
        if (fallback) fallback.hidden = false;
      });
    return () => {
      dead = true;
      earthApi.current?.dispose();
      earthApi.current = null;
    };
  }, []);

  useEffect(() => {
    earthApi.current?.setView(camera);
  }, [camera]);

  useEffect(() => {
    earthApi.current?.update({ tCelsius, hWest, hEast, zonalShare });
  }, [tCelsius, hWest, hEast, zonalShare]);

  useEffect(() => {
    const el = orbitCanvas.current;
    if (!el) return;
    let dead = false;
    import("@/scene/cycle.js")
      .then(({ mountCycle }) => {
        if (dead) return null;
        const mounted = mountCycle(el, (t: number, h: number) => onDragRef.current(t, h)) as CycleApi;
        orbitApi.current = mounted;
        const data = latest.current;
        mounted.update({ range: data.phaseRange, a: data.trailA, b: data.trailB });
        return mounted;
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      dead = true;
      orbitApi.current?.dispose();
      orbitApi.current = null;
    };
  }, []);

  useEffect(() => {
    orbitApi.current?.update({ range: phaseRange, a: trailA, b: trailB });
  }, [phaseRange, trailA, trailB]);

  useEffect(() => {
    earthApi.current?.resize();
    orbitApi.current?.resize();
  }, [fullscreen.active]);

  const sign = (value: number, digits: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="globe-views">
        {(["pacific", "equator", "globe"] as const).map((item) => (
          <Button
            key={item}
            type="button"
            variant="outline"
            data-globe-view={item}
            aria-pressed={camera === item}
            onClick={() => setCamera(item)}
          >
            {item === "pacific" ? "Pacific" : item === "equator" ? "Equator" : "Whole Earth"}
          </Button>
        ))}
      </div>
      <div className="journey">
        <div
          ref={earthStage}
          className={`scene-stage globe-stage on-dark ${fullscreen.fallback ? "is-fallback" : ""}`}
        >
          <canvas
            id="globe"
            ref={earthCanvas}
            aria-label="Equatorial Pacific. Eastern SST and the western warm pool."
          />
          <p className="pin" data-pin="pool">Warm pool</p>
          <p className="pin" data-pin="tongue">Cold tongue</p>
          <div className="earth-label">
            <p id="phase-title">{phaseTitle}</p>
            <p id="globe-caption">{phaseLine}</p>
            <p className="earth-numbers">
              T_E {sign(tCelsius, 2)} °C
              <span>h_W {sign(hWest, 0)} m</span>
            </p>
          </div>
          {fullscreen.active ? (
            <Button id="scene-close" type="button" variant="outline" className="scene-close" aria-label="Close" onClick={fullscreen.exit}>
              <Icon icon={Minimize2} />
            </Button>
          ) : (
            <Button id="fullscreen" type="button" variant="outline" className="scene-close" aria-label="Full screen" onClick={fullscreen.enter}>
              <Icon icon={Maximize2} />
            </Button>
          )}
          <p id="globe-fallback" hidden className="absolute inset-0 grid place-items-center bg-neutral-950/80 p-6 text-center text-sm text-white">
            WebGL is unavailable.
          </p>
        </div>
        <div className="scene-stage globe-stage on-light">
          <canvas
            id="orbit"
            ref={orbitCanvas}
            aria-label="Orbit of western thermocline depth and eastern SST."
          />
          {BEATS.map((beat) => (
            <p key={beat.id} className={`cycle-label ${beat.className} ${beatId === beat.id ? "is-current" : ""}`}>
              {beat.label}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
