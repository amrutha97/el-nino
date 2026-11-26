function thermoY(meters: number) {
  const clamped = Math.max(-70, Math.min(70, meters));
  return 176 + clamped * 1.05;
}

function mix(a: string, b: string, t: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const pa = parse(a);
  const pb = parse(b);
  const ch = pa.map((channel, i) => Math.round(channel + (pb[i] - channel) * t));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

function sstColor(tCelsius: number) {
  const x = Math.max(-1, Math.min(1, tCelsius / 1.8));
  if (x >= 0) return mix("#b7ece8", "#e11d48", x);
  return mix("#b7ece8", "#0e7490", -x);
}

export function Basin({
  tCelsius,
  hMeters,
  hE,
  discharge,
}: {
  tCelsius: number;
  hMeters: number;
  hE: number;
  discharge: boolean;
}) {
  const yW = thermoY(hMeters);
  const yE = thermoY(hE);
  const curve = `M 36 ${yW} C 220 ${yW}, 430 ${yE}, 604 ${yE}`;
  const strength = Math.min(1, Math.abs(tCelsius) / 1.8);
  const half = 28 + strength * 90;
  const wind = tCelsius >= 0
    ? { x1: 320 - half, x2: 320 + half }
    : { x1: 320 + half, x2: 320 - half };
  const windText = Math.abs(tCelsius) < 0.08
    ? "Wind anomaly near zero"
    : tCelsius > 0
      ? "Westerly anomaly  τ = b T_E"
      : "Easterly anomaly  τ = b T_E";
  const flux = Math.abs(tCelsius) < 0.08
    ? "Little Sverdrup transport while the east is near normal."
    : discharge
      ? "Discharging: warm-east winds push equatorial heat poleward."
      : "Recharging: stronger trades pull heat back onto the equator.";
  const active = Math.abs(tCelsius) >= 0.08;
  const meter = Math.max(-50, Math.min(50, hMeters));
  const heat = hMeters >= 0
    ? `Equatorial heat is recharged by ${hMeters.toFixed(0)} m of extra-deep western thermocline.`
    : `Equatorial heat is discharged by ${Math.abs(hMeters).toFixed(0)} m of extra-shallow western thermocline.`;

  return (
    <div>
      <svg viewBox="0 0 640 280" className="w-full rounded-md bg-secondary" role="img" aria-label="Equatorial cross section">
        <text x="48" y="28" fill="#171717" fontSize="15" fontFamily="Geist Variable, sans-serif">West · warm pool</text>
        <text x="592" y="28" textAnchor="end" fill="#171717" fontSize="15" fontFamily="Geist Variable, sans-serif">East · cold tongue</text>
        <line x1={wind.x1} y1="52" x2={wind.x2} y2="52" stroke="#171717" strokeWidth="2.4" markerEnd="url(#wind-head)" />
        <text x="320" y="76" textAnchor="middle" fill="#525252" fontSize="13" fontFamily="Geist Variable, sans-serif">{windText}</text>
        <defs>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sstColor(tCelsius)} />
            <stop offset="72%" stopColor="#0c4a52" />
          </linearGradient>
          <marker id="wind-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1.2 L 9 5 L 0 8.8 Z" fill="#171717" />
          </marker>
          <clipPath id="basin-clip">
            <rect x="36" y="86" width="568" height="168" rx="18" />
          </clipPath>
        </defs>
        <g clipPath="url(#basin-clip)">
          <rect x="36" y="86" width="568" height="168" fill="url(#water)" />
          <path d={`M 36 86 L 36 ${yW} C 220 ${yW}, 430 ${yE}, 604 ${yE} L 604 86 Z`} fill="rgba(217,119,6,0.28)" />
          <path d={curve} fill="none" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="36" y1="176" x2="604" y2="176" stroke="rgba(23,23,23,0.28)" strokeDasharray="5 7" />
        </g>
        <text x="52" y="168" fill="#171717" fontSize="14" fontFamily="Geist Variable, sans-serif">h_W {hMeters >= 0 ? "+" : "−"}{Math.abs(hMeters).toFixed(0)} m</text>
        <text x="588" y="168" textAnchor="end" fill="#171717" fontSize="14" fontFamily="Geist Variable, sans-serif">h_E {hE >= 0 ? "+" : "−"}{Math.abs(hE).toFixed(0)} m</text>
      </svg>
      <p className="mt-3 text-sm text-muted-foreground">{flux}</p>
      <div className={`mt-2 grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground ${active ? "opacity-100" : "opacity-40"}`}>
        <i className={`mx-auto block h-0 w-0 border-x-8 border-b-[10px] border-x-transparent ${active && !discharge ? "border-b-sky-700" : "border-b-neutral-300"}`} />
        <i className={`mx-auto block h-0 w-0 border-x-8 border-b-[10px] border-x-transparent ${active && !discharge ? "border-b-sky-700" : "border-b-neutral-300"}`} />
        <span>Equator</span>
        <i className={`mx-auto block h-0 w-0 border-x-8 border-t-[10px] border-x-transparent ${active && discharge ? "border-t-sky-700" : "border-t-neutral-300"}`} />
        <i className={`mx-auto block h-0 w-0 border-x-8 border-t-[10px] border-x-transparent ${active && discharge ? "border-t-sky-700" : "border-t-neutral-300"}`} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span>Discharged</span>
        <div className="relative h-2 flex-1 rounded-full bg-gradient-to-r from-sky-700 via-neutral-200 to-amber-500">
          <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-white" style={{ left: `${((meter + 50) / 100) * 100}%` }} />
        </div>
        <span>Recharged</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{heat}</p>
    </div>
  );
}
