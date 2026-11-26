import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type View = { update: (state: { tCelsius: number; hWest: number; hEast: number }) => void; dispose: () => void };

export function GlobeCard({ tCelsius, hWest, hEast }: { tCelsius: number; hWest: number; hEast: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View | null>(null);
  const latest = useRef({ tCelsius, hWest, hEast });
  latest.current = { tCelsius, hWest, hEast };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let dead = false;
    import("@/globe/pacific.js").then(({ mountPacific }) => mountPacific(el)).then((mounted: View) => {
      if (dead) {
        mounted.dispose();
        return;
      }
      view.current = mounted;
      mounted.update(latest.current);
    }).catch((error: unknown) => {
      console.error(error);
      const fallback = document.getElementById("globe-fallback");
      if (fallback) fallback.hidden = false;
    });
    return () => {
      dead = true;
      view.current?.dispose();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    view.current?.update({ tCelsius, hWest, hEast });
  }, [tCelsius, hWest, hEast]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Over the Pacific</CardTitle>
        <div className="globe-views flex flex-wrap gap-2">
          <Button type="button" variant="outline" data-globe-view="pacific" aria-pressed="true">Pacific</Button>
          <Button type="button" variant="outline" data-globe-view="equator">Equator</Button>
          <Button type="button" variant="outline" data-globe-view="globe">Whole Earth</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="globe-stage border border-border">
          <canvas id="globe" ref={canvas} aria-label="Draggable Earth centered on the equatorial Pacific. Drag to look around. Pinch or scroll to zoom." />
          <p className="pin" data-pin="pool">Warm pool</p>
          <p className="pin" data-pin="tongue">Cold tongue</p>
          <ul className="absolute bottom-2.5 left-2.5 right-2.5 m-0 flex list-none flex-wrap gap-x-3 gap-y-1 rounded-md bg-black/70 px-3 py-2 text-xs text-white">
            <li className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#e11d48]" /> Warm east</li>
            <li className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0891b2]" /> Cold east</li>
            <li className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#d97706]" /> Deeper thermocline</li>
            <li className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563eb]" /> Shallower thermocline</li>
          </ul>
          <p id="globe-fallback" hidden className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white">
            The globe needs WebGL. The charts below still run the same model.
          </p>
        </div>
        <p id="globe-caption" className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Drag the Earth. This is Jin’s two numbers painted on a NASA photograph, not a second ocean model.
        </p>
      </CardContent>
    </Card>
  );
}
