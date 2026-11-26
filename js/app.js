import {
  JIN_DEFAULTS,
  PRESETS,
  SCALES,
  TIME_UNITS_PER_YEAR,
  boxMuller,
  cloneParams,
  diagnose,
  mulberry32,
  phaseOf,
  step,
  tendencies,
  tiltMetersPerCelsius,
  toDisplay,
  toNondim,
} from "./model.js";

const phaseEl = document.getElementById("phase");
const seriesEl = document.getElementById("series");
const fatalEl = document.getElementById("fatal");

let plotsReady = false;

const state = {
  params: cloneParams(PRESETS.neutral.params),
  T: 0,
  h: 0,
  icT: 0,
  icH: 0,
  years: 0,
  playing: false,
  presetId: "neutral",
  monthsPerSecond: 5,
  seed: 11,
  randn: () => 0,
  diverged: false,
  history: { years: [], tC: [], hM: [] },
  sinceRecord: 0,
  phaseRange: { x: [-45, 45], y: [-2.6, 2.6] },
  rangeKey: "",
};

const LIMIT = 6;
const RECORD_EVERY_YEARS = 0.04;
const SUBSTEP_YEARS = 0.004;

const CONTROLS = [
  {
    group: "Coupling",
    key: "mu",
    symbol: "μ",
    name: "Relative coupling",
    min: 0,
    max: 1.5,
    step: 0.01,
    digits: 2,
    sentence:
      "How strongly eastern SST pulls on the wind. Raising μ strengthens the Bjerknes feedback and the recharge–discharge together.",
    gloss: (p, d) => `b = ${d.b.toFixed(2)}`,
  },
  {
    group: "Coupling",
    key: "b0",
    symbol: "b₀",
    name: "Wind–SST coupling scale",
    min: 0.5,
    max: 4,
    step: 0.05,
    digits: 2,
    sentence:
      "How many meters of east–west thermocline tilt one degree would set up at μ = 1. Jin’s high-end value 2.5 is 50 m per °C.",
    gloss: (p) => `${tiltMetersPerCelsius(p.b0).toFixed(0)} m/°C at μ = 1`,
  },
  {
    group: "Coupling",
    key: "c",
    symbol: "c",
    name: "Eastern SST damping",
    min: 0.2,
    max: 2,
    step: 0.01,
    digits: 2,
    sentence:
      "How fast the eastern Pacific is pulled back toward normal by upwelling and heat loss to the air. Jin’s c = 1 is about two months.",
    gloss: (_p, d) => `${d.sstDampingMonths.toFixed(1)} mo damping`,
  },
  {
    group: "Coupling",
    key: "gamma",
    symbol: "γ",
    name: "Thermocline feedback",
    min: 0,
    max: 1.5,
    step: 0.01,
    digits: 2,
    sentence:
      "How strongly a deep thermocline warms the eastern Pacific. This is the γ h_W term in the temperature equation.",
    gloss: () => "warms the east when h_W > 0",
  },
  {
    group: "Ocean memory",
    key: "r",
    symbol: "r",
    name: "Ocean adjustment",
    min: 0.05,
    max: 1,
    step: 0.01,
    digits: 2,
    sentence:
      "How fast an extra-deep or extra-shallow western thermocline relaxes. Jin’s r = 0.25 is about an eight-month memory.",
    gloss: (_p, d) => `${d.oceanMemoryMonths.toFixed(1)} mo memory`,
  },
  {
    group: "Ocean memory",
    key: "alpha",
    symbol: "α",
    name: "Sverdrup recharge efficiency",
    min: 0,
    max: 0.5,
    step: 0.005,
    digits: 3,
    sentence:
      "How efficiently anomalous winds drain or pile equatorial heat. Jin sets α to about half of r.",
    gloss: (p) => `α / r = ${(p.r ? p.alpha / p.r : 0).toFixed(2)}`,
  },
  {
    group: "Saturation and noise",
    key: "eps",
    symbol: "εₙ",
    name: "Cubic thermocline saturation",
    min: 0,
    max: 8,
    step: 0.1,
    digits: 1,
    sentence:
      "Stops a very deep or very shallow thermocline from warming or cooling the east without limit. Zero is Jin’s linear oscillator.",
    gloss: (p) => (p.eps === 0 ? "linear model" : "nonlinear (3.1)"),
  },
  {
    group: "Saturation and noise",
    key: "sig1",
    symbol: "σ₁²",
    name: "Wind noise",
    min: 0,
    max: 0.4,
    step: 0.005,
    digits: 3,
    sentence:
      "Random wind. It shakes the western thermocline and, through the tilt, the SST. Zero is the deterministic model.",
    gloss: (p) => (p.sig1 === 0 ? "off" : "ξ₁ on"),
  },
  {
    group: "Saturation and noise",
    key: "sig2",
    symbol: "σ₂²",
    name: "Heating noise",
    min: 0,
    max: 0.4,
    step: 0.005,
    digits: 3,
    sentence:
      "Random heating of the eastern Pacific. Jin’s illustrated variance is 2/15, about 1°C per month of white noise. Zero turns it off.",
    gloss: (p) => (Math.abs(p.sig2 - 2 / 15) < 0.01 ? "Jin’s 2/15" : p.sig2 === 0 ? "off" : "ξ₂ on"),
  },
];

const TERM_SPEC = [
  { id: "bjerknes", eq: "R T_E", meaning: "Bjerknes feedback on the east", color: "#ff6a45" },
  { id: "thermocline", eq: "γ h_W", meaning: "thermocline effect from the west", color: "#f0b45a" },
  { id: "cubic", eq: "−εₙ h_E³", meaning: "saturation of that feedback", color: "#c9a0ff" },
  { id: "memory", eq: "−r h_W", meaning: "western thermocline relaxing", color: "#9fb4ac" },
  { id: "sverdrup", eq: "−α b T_E", meaning: "wind draining or piling heat", color: "#8eb6ff" },
];

function fmt(value, digits) {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return sign + Math.abs(value).toFixed(digits);
}

function signed(value, digits) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + Math.abs(value).toFixed(digits);
}

function reseed() {
  state.randn = boxMuller(mulberry32(state.seed));
}

function clearHistory() {
  state.history = { years: [], tC: [], hM: [] };
  state.sinceRecord = RECORD_EVERY_YEARS;
  state.years = 0;
}

function record(force) {
  if (!force && state.sinceRecord < RECORD_EVERY_YEARS) return;
  state.sinceRecord = 0;
  const shown = toDisplay(state.T, state.h);
  state.history.years.push(state.years);
  state.history.tC.push(shown.tCelsius);
  state.history.hM.push(shown.hMeters);
  const cap = 900;
  if (state.history.years.length > cap) {
    state.history.years.splice(0, 120);
    state.history.tC.splice(0, 120);
    state.history.hM.splice(0, 120);
  }
}

function placeAt(tCelsius, hMeters, remember) {
  const nd = toNondim(tCelsius, hMeters);
  state.T = nd.T;
  state.h = nd.h;
  if (remember) {
    state.icT = nd.T;
    state.icH = nd.h;
  }
  state.diverged = false;
  clearHistory();
  record(true);
  expandRange(hMeters, tCelsius, true);
  renderReadouts();
  updatePlots();
}

function applyPreset(preset) {
  state.params = cloneParams(preset.params);
  state.presetId = preset.id;
  state.playing = true;
  reseed();
  const nd = toNondim(preset.tCelsius, preset.hMeters);
  state.icT = nd.T;
  state.icH = nd.h;
  state.T = nd.T;
  state.h = nd.h;
  state.diverged = false;
  clearHistory();
  record(true);
  expandRange(preset.hMeters, preset.tCelsius, true);
  syncControls();
  renderReadouts();
  updatePlots();
}

function resetRun() {
  state.T = state.icT;
  state.h = state.icH;
  state.diverged = false;
  reseed();
  clearHistory();
  record(true);
  const shown = toDisplay(state.T, state.h);
  expandRange(shown.hMeters, shown.tCelsius, true);
  renderReadouts();
  updatePlots();
}

function advance(wallSeconds) {
  if (!state.playing || state.diverged) return;
  let yearsLeft = Math.min(0.45, wallSeconds * (state.monthsPerSecond / 12));
  while (yearsLeft > 1e-8) {
    const slice = Math.min(SUBSTEP_YEARS, yearsLeft);
    const next = step(state.h, state.T, state.params, slice * TIME_UNITS_PER_YEAR, state.randn);
    state.h = next.h;
    state.T = next.T;
    state.years += slice;
    state.sinceRecord += slice;
    yearsLeft -= slice;
    if (!Number.isFinite(state.T) || Math.abs(state.T) > LIMIT || Math.abs(state.h) > LIMIT) {
      state.diverged = true;
      state.playing = false;
      break;
    }
  }
  record(false);
}

function expandRange(hMeters, tCelsius, reset) {
  if (reset) {
    state.phaseRange = {
      x: [-Math.max(45, Math.abs(hMeters) * 1.4), Math.max(45, Math.abs(hMeters) * 1.4)],
      y: [-Math.max(2.6, Math.abs(tCelsius) * 1.4), Math.max(2.6, Math.abs(tCelsius) * 1.4)],
    };
    return;
  }
  const xNeed = Math.abs(hMeters) * 1.25;
  const yNeed = Math.abs(tCelsius) * 1.25;
  if (xNeed > state.phaseRange.x[1]) {
    const edge = nice(xNeed);
    state.phaseRange.x = [-edge, edge];
  }
  if (yNeed > state.phaseRange.y[1]) {
    const edge = nice(yNeed);
    state.phaseRange.y = [-edge, edge];
  }
}

function nice(value) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(value, 1e-6)));
  return Math.ceil(value / pow) * pow;
}

function trail() {
  const diag = diagnose(state.params);
  const span = diag.periodYears ? Math.min(14, Math.max(8, diag.periodYears * 3)) : 10;
  const start = state.years - span;
  const { years, tC, hM } = state.history;
  let i = 0;
  while (i < years.length && years[i] < start) i += 1;
  return {
    h: hM.slice(i),
    t: tC.slice(i),
  };
}

function seriesWindow() {
  const end = Math.max(state.years, 4);
  const start = state.years > 12 ? state.years - 12 : 0;
  return [start, Math.max(end, start + 4)];
}

function paddedRange(values, floor) {
  let peak = floor;
  for (const value of values) peak = Math.max(peak, Math.abs(value));
  const edge = nice(peak * 1.15);
  return [-edge, edge];
}

function plotLayout(extra) {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(8, 24, 27, 0.65)",
    font: { family: "Avenir Next, Segoe UI, sans-serif", color: "#d5e4dc", size: 12 },
    margin: { l: 52, r: 52, t: 12, b: 42 },
    showlegend: false,
    hovermode: false,
    dragmode: false,
    xaxis: {
      gridcolor: "rgba(231,240,234,0.08)",
      zerolinecolor: "rgba(231,240,234,0.28)",
      color: "#d5e4dc",
    },
    yaxis: {
      gridcolor: "rgba(231,240,234,0.08)",
      zerolinecolor: "rgba(231,240,234,0.28)",
      color: "#d5e4dc",
    },
    ...extra,
  };
}

async function initPlots() {
  if (!window.Plotly) throw new Error("Plotly missing");
  const shown = toDisplay(state.T, state.h);
  await window.Plotly.newPlot(
    phaseEl,
    [
      {
        x: state.history.hM,
        y: state.history.tC,
        mode: "lines",
        line: { color: "#f0b45a", width: 2.4 },
        hoverinfo: "skip",
      },
      {
        x: [shown.hMeters],
        y: [shown.tCelsius],
        mode: "markers",
        marker: { size: 16, color: "#ff6a45", line: { color: "#071416", width: 2 } },
        hoverinfo: "skip",
      },
    ],
    plotLayout({
      xaxis: {
        title: "h_W (m)",
        range: state.phaseRange.x,
        gridcolor: "rgba(231,240,234,0.08)",
        zerolinecolor: "rgba(231,240,234,0.28)",
      },
      yaxis: {
        title: "T_E (°C)",
        range: state.phaseRange.y,
        gridcolor: "rgba(231,240,234,0.08)",
        zerolinecolor: "rgba(231,240,234,0.28)",
      },
    }),
    { responsive: true, displayModeBar: false, scrollZoom: false },
  );
  await window.Plotly.newPlot(
    seriesEl,
    [
      {
        x: state.history.years,
        y: state.history.tC,
        mode: "lines",
        line: { color: "#ff6a45", width: 2.4 },
        hoverinfo: "skip",
      },
      {
        x: state.history.years,
        y: state.history.hM,
        mode: "lines",
        yaxis: "y2",
        line: { color: "#f0b45a", width: 2.4 },
        hoverinfo: "skip",
      },
    ],
    plotLayout({
      margin: { l: 48, r: 48, t: 12, b: 42 },
      xaxis: {
        title: "Years",
        range: seriesWindow(),
        gridcolor: "rgba(231,240,234,0.08)",
        zeroline: false,
      },
      yaxis: {
        title: "T_E (°C)",
        range: [-2.6, 2.6],
        gridcolor: "rgba(231,240,234,0.08)",
        zerolinecolor: "rgba(255,106,69,0.35)",
      },
      yaxis2: {
        title: "h_W (m)",
        overlaying: "y",
        side: "right",
        range: [-45, 45],
        gridcolor: "rgba(0,0,0,0)",
        zeroline: false,
      },
    }),
    { responsive: true, displayModeBar: false, scrollZoom: false },
  );
}

function updatePlots() {
  if (!plotsReady) return;
  const shown = toDisplay(state.T, state.h);
  expandRange(shown.hMeters, shown.tCelsius, false);
  const path = trail();
  const phase = phaseOf(shown.tCelsius, shown.hMeters);
  const marker =
    phase.id === "elnino" ? "#ff6a45" : phase.id === "lanina" ? "#3ec6d6" : phase.id === "recharged" ? "#f0b45a" : "#8eb6ff";
  window.Plotly.restyle(phaseEl, { x: [path.h], y: [path.t] }, [0]);
  window.Plotly.restyle(
    phaseEl,
    { x: [[shown.hMeters]], y: [[shown.tCelsius]], "marker.color": marker },
    [1],
  );
  const key = `${state.phaseRange.x[1]}:${state.phaseRange.y[1]}`;
  if (key !== state.rangeKey) {
    state.rangeKey = key;
    window.Plotly.relayout(phaseEl, {
      "xaxis.range": state.phaseRange.x,
      "yaxis.range": state.phaseRange.y,
    });
  }
  window.Plotly.restyle(
    seriesEl,
    {
      x: [state.history.years, state.history.years],
      y: [state.history.tC, state.history.hM],
    },
    [0, 1],
  );
  window.Plotly.relayout(seriesEl, {
    "xaxis.range": seriesWindow(),
    "yaxis.range": paddedRange(state.history.tC, 2.2),
    "yaxis2.range": paddedRange(state.history.hM, 30),
  });
}

function eventToData(ev) {
  const area = phaseEl.querySelector(".nsewdrag") || phaseEl.querySelector(".xy");
  const box = (area || phaseEl).getBoundingClientRect();
  if (box.width < 10 || box.height < 10) return null;
  const fx = (ev.clientX - box.left) / box.width;
  const fy = (ev.clientY - box.top) / box.height;
  if (fx < -0.02 || fx > 1.02 || fy < -0.02 || fy > 1.02) return null;
  const xr = phaseEl._fullLayout?.xaxis?.range || state.phaseRange.x;
  const yr = phaseEl._fullLayout?.yaxis?.range || state.phaseRange.y;
  return {
    hMeters: xr[0] + Math.min(1, Math.max(0, fx)) * (xr[1] - xr[0]),
    tCelsius: yr[1] - Math.min(1, Math.max(0, fy)) * (yr[1] - yr[0]),
  };
}

function buildPresets() {
  const root = document.getElementById("presets");
  for (const preset of Object.values(PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.preset = preset.id;
    button.innerHTML = `${preset.label}<small>${preset.detail}</small>`;
    button.addEventListener("click", () => applyPreset(preset));
    root.appendChild(button);
  }
}

function buildControls() {
  const root = document.getElementById("controls");
  const groups = new Map();
  for (const control of CONTROLS) {
    if (!groups.has(control.group)) {
      const field = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = control.group;
      field.appendChild(legend);
      groups.set(control.group, field);
      root.appendChild(field);
    }
    groups.get(control.group).appendChild(sliderControl(control));
  }

  const initial = document.createElement("fieldset");
  initial.innerHTML = "<legend>Initial state and playback</legend>";
  initial.appendChild(
    manualSlider({
      id: "ic-t",
      symbol: "T_E(0)",
      name: "Starting eastern temperature",
      min: -4,
      max: 4,
      step: 0.01,
      sentence: "Where the eastern Pacific starts, in °C. Warm is the El Niño side; cold is the La Niña side.",
      onInput: (value) => {
        const hMeters = toDisplay(state.icT, state.icH).hMeters;
        state.presetId = null;
        placeAt(value, hMeters, true);
        syncPresetPressed();
      },
    }),
  );
  initial.appendChild(
    manualSlider({
      id: "ic-h",
      symbol: "h_W(0)",
      name: "Starting western thermocline",
      min: -80,
      max: 80,
      step: 0.5,
      sentence: "Where equatorial heat starts, in meters of western thermocline. Positive is recharged; negative is discharged.",
      onInput: (value) => {
        const tCelsius = toDisplay(state.icT, state.icH).tCelsius;
        state.presetId = null;
        placeAt(tCelsius, value, true);
        syncPresetPressed();
      },
    }),
  );
  initial.appendChild(
    manualSlider({
      id: "speed",
      symbol: "speed",
      name: "Playback",
      min: 0.5,
      max: 24,
      step: 0.5,
      sentence: "Viewing speed only, in months of model time per second. It does not change Jin’s equations.",
      onInput: (value) => {
        state.monthsPerSecond = value;
      },
    }),
  );
  root.appendChild(initial);
}

function sliderControl(control) {
  return manualSlider({
    id: `param-${control.key}`,
    symbol: control.symbol,
    name: control.name,
    min: control.min,
    max: control.max,
    step: control.step,
    sentence: control.sentence,
    dataset: { param: control.key },
    onInput: (value) => {
      state.params[control.key] = value;
      state.presetId = null;
      syncPresetPressed();
      renderReadouts();
    },
  });
}

function manualSlider({ id, symbol, name, min, max, step, sentence, onInput, dataset }) {
  const wrap = document.createElement("div");
  wrap.className = "slider";
  const top = document.createElement("div");
  top.className = "slider-top";
  const label = document.createElement("strong");
  label.textContent = `${symbol}  ${name}`;
  const value = document.createElement("em");
  value.id = `${id}-value`;
  top.append(label, value);
  const input = document.createElement("input");
  input.type = "range";
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.setAttribute("aria-describedby", `${id}-help`);
  if (dataset?.param) input.dataset.param = dataset.param;
  const help = document.createElement("p");
  help.id = `${id}-help`;
  help.textContent = sentence;
  input.addEventListener("input", () => {
    onInput(Number(input.value));
    paintSliderValue(input);
  });
  wrap.append(top, input, help);
  return wrap;
}

function paintSliderValue(input) {
  const value = document.getElementById(`${input.id}-value`);
  if (!value) return;
  if (input.dataset.param) {
    const control = CONTROLS.find((item) => item.key === input.dataset.param);
    const diag = diagnose(state.params);
    value.textContent = `${Number(input.value).toFixed(control.digits)} · ${control.gloss(state.params, diag)}`;
    return;
  }
  if (input.id === "speed") {
    value.textContent = `${Number(input.value).toFixed(1)} mo/s`;
    return;
  }
  if (input.id === "ic-t") value.textContent = `${fmt(Number(input.value), 2)} °C`;
  if (input.id === "ic-h") value.textContent = `${fmt(Number(input.value), 1)} m`;
}

function syncControls() {
  for (const input of document.querySelectorAll("[data-param]")) {
    input.value = String(state.params[input.dataset.param]);
    paintSliderValue(input);
  }
  const shown = toDisplay(state.icT, state.icH);
  const t = document.getElementById("ic-t");
  const h = document.getElementById("ic-h");
  const speed = document.getElementById("speed");
  t.value = String(shown.tCelsius);
  h.value = String(shown.hMeters);
  speed.value = String(state.monthsPerSecond);
  paintSliderValue(t);
  paintSliderValue(h);
  paintSliderValue(speed);
  syncPresetPressed();
}

function syncPresetPressed() {
  for (const button of document.querySelectorAll(".preset")) {
    button.setAttribute("aria-pressed", button.dataset.preset === state.presetId ? "true" : "false");
  }
  document.getElementById("play").setAttribute("aria-pressed", state.playing ? "true" : "false");
  document.getElementById("pause").setAttribute("aria-pressed", state.playing ? "false" : "true");
}

function buildTerms() {
  const root = document.getElementById("terms");
  for (const term of TERM_SPEC) {
    const row = document.createElement("div");
    row.className = "term";
    row.innerHTML = `
      <div class="term-name"><b></b><span></span></div>
      <div class="term-track"><i class="term-zero"></i><i class="term-bar"></i></div>`;
    row.querySelector("b").textContent = term.eq;
    row.querySelector(".term-bar").style.background = term.color;
    row.dataset.term = term.id;
    root.appendChild(row);
  }
}

function renderReadouts() {
  const shown = toDisplay(state.T, state.h);
  const diag = diagnose(state.params);
  const phase = phaseOf(shown.tCelsius, shown.hMeters);
  document.getElementById("phase-title").textContent = phase.title;
  document.getElementById("phase-line").textContent = phase.line;
  document.getElementById("now-state").textContent =
    `Now: T_E = ${signed(shown.tCelsius, 2)} °C,  h_W = ${signed(shown.hMeters, 1)} m`;
  document.getElementById("year").textContent = `Year ${state.years.toFixed(1)}`;

  document.getElementById("stat-period").textContent = diag.periodYears
    ? `${diag.periodYears.toFixed(1)} yr`
    : "no cycle";
  document.getElementById("stat-growth").textContent = `${signed(diag.growthPerYear, 2)} /yr`;
  document.getElementById("stat-lead").textContent = diag.leadMonths
    ? `${diag.leadMonths.toFixed(0)} mo`
    : "—";

  const hE = tendencies(state.h, state.T, state.params).hE * SCALES.hMeters;
  const omegaText = diag.omega ? diag.omega.toFixed(3) : "not real";
  document.getElementById("numbers").textContent =
    `With these sliders: R = ${fmt(diag.R, 3)}, b = ${fmt(diag.b, 3)}, ` +
    `h_E = ${fmt(hE, 1)} m, σ = ${fmt(diag.growth, 3)} per 2 months ` +
    `(${signed(diag.growthPerYear, 2)} /yr), ω = ${omegaText}.` +
    (diag.jinLagMonths
      ? ` Jin’s lag η = ${diag.jinLagMonths.toFixed(1)} months: h_W is opposite the SST of that long ago.`
      : "");

  document.getElementById("regime").textContent = regimeSentence(diag);

  const det = tendencies(state.h, state.T, state.params);
  const perMonthT = SCALES.tCelsius / SCALES.monthsPerTime;
  const perMonthH = SCALES.hMeters / SCALES.monthsPerTime;
  const rates = {
    bjerknes: det.termsT.bjerknes * perMonthT,
    thermocline: det.termsT.thermocline * perMonthT,
    cubic: det.termsT.cubic * perMonthT,
    memory: det.termsH.memory * perMonthH,
    sverdrup: det.termsH.sverdrup * perMonthH,
  };
  const scaleT = Math.max(0.15, ...["bjerknes", "thermocline", "cubic"].map((id) => Math.abs(rates[id])));
  const scaleH = Math.max(1.5, ...["memory", "sverdrup"].map((id) => Math.abs(rates[id])));
  for (const term of TERM_SPEC) {
    const row = document.querySelector(`[data-term="${term.id}"]`);
    const rate = rates[term.id];
    const unit = term.id === "memory" || term.id === "sverdrup" ? "m/mo" : "°C/mo";
    const scale = unit.startsWith("m") ? scaleH : scaleT;
    row.querySelector("span").textContent = `${signed(rate, 2)} ${unit}`;
    const fraction = Math.max(-1, Math.min(1, rate / scale));
    const bar = row.querySelector(".term-bar");
    bar.style.width = `${Math.abs(fraction) * 50}%`;
    bar.style.left = fraction >= 0 ? "50%" : `${50 - Math.abs(fraction) * 50}%`;
  }

  const dTmonth = det.dT * perMonthT;
  const dhMonth = det.dh * perMonthH;
  const east = dTmonth >= 0
    ? `The east is warming at ${dTmonth.toFixed(2)} °C per month.`
    : `The east is cooling at ${Math.abs(dTmonth).toFixed(2)} °C per month.`;
  const west = dhMonth >= 0
    ? `The west is deepening at ${dhMonth.toFixed(1)} m per month, so recharge is winning.`
    : `The west is shoaling at ${Math.abs(dhMonth).toFixed(1)} m per month, so discharge is winning.`;
  const noise = state.params.sig1 > 0 || state.params.sig2 > 0
    ? " Noise is on, so these bars are the smooth part of eq. 3.4."
    : "";
  document.getElementById("tendency").textContent = `${east} ${west}${noise}`;

  drawBasin(shown, det, hE);
  const banner = document.getElementById("banner");
  if (state.diverged) {
    banner.hidden = false;
    banner.textContent =
      "The linear oscillator ran away. Jin’s cubic term εₙ is what keeps a growing El Niño finite. Raise εₙ, or press Reset.";
  } else {
    banner.hidden = true;
  }
  syncPresetPressed();
}

function regimeSentence(diag) {
  if (!diag.oscillatory && diag.growth > 0) {
    return "These coefficients do not oscillate: the Bjerknes growth is too fast for the ocean memory to turn it into a cycle. Jin’s moderate coupling does oscillate.";
  }
  if (!diag.oscillatory) {
    return "These coefficients do not oscillate. The recharge coupling α b γ is too weak compared with the damping, so anomalies just fade.";
  }
  const factor = Math.exp(diag.growthPerYear);
  if (diag.regime === "neutral") {
    return `Neutral cycle, period ${diag.periodYears.toFixed(1)} years. Amplitude stays where you set it, which is Jin’s critical coupling when the other coefficients are his defaults (μ = 2/3).`;
  }
  if (diag.regime === "growing") {
    return `Growing cycle, period ${diag.periodYears.toFixed(1)} years. Linear amplitude multiplies by about ${factor.toFixed(2)} each year until the cubic term, if it is on, levels it off.`;
  }
  return `Damped cycle, period ${diag.periodYears.toFixed(1)} years. Linear amplitude multiplies by about ${factor.toFixed(2)} each year. Wind or heating noise can keep a faded cycle alive, which is Jin’s subcritical case.`;
}

function drawBasin(shown, det, hEMeters) {
  const yW = thermoY(shown.hMeters);
  const yE = thermoY(hEMeters);
  const curve = `M 36 ${yW} C 220 ${yW}, 430 ${yE}, 604 ${yE}`;
  document.getElementById("thermo").setAttribute("d", curve);
  document.getElementById("warm-layer").setAttribute(
    "d",
    `M 36 86 L 36 ${yW} C 220 ${yW}, 430 ${yE}, 604 ${yE} L 604 86 Z`,
  );
  document.getElementById("water-top").setAttribute("stop-color", sstColor(shown.tCelsius));
  document.getElementById("hw-tag").textContent = `h_W ${signed(shown.hMeters, 0)} m`;
  document.getElementById("he-tag").textContent = `h_E ${signed(hEMeters, 0)} m`;

  const wind = document.getElementById("wind-line");
  const strength = Math.min(1, Math.abs(shown.tCelsius) / 1.8);
  const half = 28 + strength * 90;
  if (shown.tCelsius >= 0) {
    wind.setAttribute("x1", String(320 - half));
    wind.setAttribute("x2", String(320 + half));
  } else {
    wind.setAttribute("x1", String(320 + half));
    wind.setAttribute("x2", String(320 - half));
  }
  const windText = document.getElementById("wind-text");
  if (Math.abs(shown.tCelsius) < 0.08) windText.textContent = "Wind anomaly near zero";
  else if (shown.tCelsius > 0) windText.textContent = "Westerly anomaly  τ = b T_E";
  else windText.textContent = "Easterly anomaly  τ = b T_E";

  const discharge = det.termsH.sverdrup < 0;
  const equator = document.getElementById("equator");
  equator.classList.toggle("discharge", discharge && Math.abs(shown.tCelsius) >= 0.08);
  equator.classList.toggle("recharge", !discharge && Math.abs(shown.tCelsius) >= 0.08);
  document.getElementById("flux-label").textContent = Math.abs(shown.tCelsius) < 0.08
    ? "Little Sverdrup transport while the east is near normal."
    : discharge
      ? "Discharging: warm-east winds push equatorial heat poleward."
      : "Recharging: stronger trades pull heat back onto the equator.";

  const meter = Math.max(-50, Math.min(50, shown.hMeters));
  document.getElementById("heat-thumb").style.left = `${((meter + 50) / 100) * 100}%`;
  document.getElementById("heat-readout").textContent =
    shown.hMeters >= 0
      ? `Equatorial heat is recharged by ${shown.hMeters.toFixed(0)} m of extra-deep western thermocline.`
      : `Equatorial heat is discharged by ${Math.abs(shown.hMeters).toFixed(0)} m of extra-shallow western thermocline.`;
  document.getElementById("basin-caption").textContent =
    "A slice along the equator. The gold curve is the thermocline: deeper means more warm water above it. El Niño tilts it down toward the east while the whole west shoals.";
}

function thermoY(meters) {
  const clamped = Math.max(-70, Math.min(70, meters));
  return 176 + clamped * 1.05;
}

function sstColor(tCelsius) {
  const x = Math.max(-1, Math.min(1, tCelsius / 1.8));
  if (x >= 0) return mix("#9fd8d4", "#ff6a45", x);
  return mix("#9fd8d4", "#147f98", -x);
}

function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const ch = pa.map((channel, i) => Math.round(channel + (pb[i] - channel) * t));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

function hex(value) {
  return [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
}

function bindTransport() {
  document.getElementById("play").addEventListener("click", () => {
    if (state.diverged) return;
    state.playing = true;
    syncPresetPressed();
  });
  document.getElementById("pause").addEventListener("click", () => {
    state.playing = false;
    syncPresetPressed();
  });
  document.getElementById("reset").addEventListener("click", () => {
    resetRun();
  });
}

function bindDrag() {
  let dragging = false;
  const stop = (ev) => {
    if (!dragging) return;
    dragging = false;
    if (phaseEl.hasPointerCapture?.(ev.pointerId)) phaseEl.releasePointerCapture(ev.pointerId);
  };
  phaseEl.addEventListener("pointerdown", (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    const data = eventToData(ev);
    if (!data) return;
    dragging = true;
    phaseEl.setPointerCapture?.(ev.pointerId);
    state.playing = false;
    state.presetId = null;
    placeAt(clamp(data.tCelsius, -4, 4), clamp(data.hMeters, -80, 80), true);
    syncControls();
    ev.preventDefault();
  });
  phaseEl.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const data = eventToData(ev);
    if (!data) return;
    placeAt(clamp(data.tCelsius, -4, 4), clamp(data.hMeters, -80, 80), true);
    syncControls();
    ev.preventDefault();
  });
  phaseEl.addEventListener("pointerup", stop);
  phaseEl.addEventListener("pointercancel", stop);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

let plotDue = 0;
let lastFrame = 0;

function loop(now) {
  if (!lastFrame) lastFrame = now;
  const wall = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const wasPlaying = state.playing;
  advance(wall);
  if (wasPlaying) renderReadouts();
  if (wasPlaying && now >= plotDue) {
    plotDue = now + 90;
    updatePlots();
  }
  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  if (!window.Plotly) return;
  window.Plotly.Plots.resize(phaseEl);
  window.Plotly.Plots.resize(seriesEl);
});

buildPresets();
buildControls();
buildTerms();
bindTransport();
reseed();

try {
  applyPreset(PRESETS.neutral);
  await initPlots();
  plotsReady = true;
  bindDrag();
  updatePlots();
  requestAnimationFrame(loop);
} catch (error) {
  console.error(error);
  fatalEl.hidden = false;
}
