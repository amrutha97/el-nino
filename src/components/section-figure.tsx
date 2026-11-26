import { useEffect, useRef } from "react";

type SectionApi = {
  update: (state: { tCelsius: number; hWest: number; hEast: number }) => void;
  resize: () => void;
  dispose: () => void;
};

export function SectionFigure({
  tCelsius,
  hWest,
  hEast,
}: {
  tCelsius: number;
  hWest: number;
  hEast: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<SectionApi | null>(null);

  const latest = useRef({ tCelsius, hWest, hEast });
  latest.current = { tCelsius, hWest, hEast };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let dead = false;
    import("@/scene/section.js").then(({ mountSection }) => {
      if (dead) return;
      const mounted = mountSection(el) as SectionApi;
      api.current = mounted;
      const data = latest.current;
      mounted.update(data);
    }).catch((error: unknown) => console.error(error));
    return () => {
      dead = true;
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.update({ tCelsius, hWest, hEast });
  }, [tCelsius, hWest, hEast]);

  return (
    <div className="scene-stage globe-stage on-light section-stage">
      <canvas ref={canvas} aria-label="Equatorial section. West is warm-water volume. East is SST." />
      <p className="cycle-label left is-current">West</p>
      <p className="cycle-label right is-current">East</p>
    </div>
  );
}
