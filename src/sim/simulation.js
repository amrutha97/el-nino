/**
 * Playback for one or two integrations of the recharge oscillator.
 * The equations stay in js/model.js.
 */

import {
  PRESETS,
  SCALES,
  TIME_UNITS_PER_YEAR,
  boxMuller,
  cloneParams,
  diagnose,
  mulberry32,
  beatOf,
  step,
  tendencies,
  toDisplay,
  toNondim,
} from "../../js/model.js";

const LIMIT = 6;
const RECORD_EVERY_YEARS = 0.04;
const SUBSTEP_YEARS = 0.004;
const CYCLES_ON_RECORD = 4;
const HISTORY_LIMIT = 2400;
const PER_MONTH_T = SCALES.tCelsius / SCALES.monthsPerTime;
const PER_MONTH_H = SCALES.hMeters / SCALES.monthsPerTime;

function signed(value, digits) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + Math.abs(value).toFixed(digits);
}

function fmt(value, digits) {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return sign + Math.abs(value).toFixed(digits);
}

function nice(value) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(value, 1e-6)));
  return Math.ceil(value / pow) * pow;
}

function regimeSentence(diag) {
  if (!diag.oscillatory && diag.growth > 0) {
    return "Unstable and non-oscillatory. Growth exceeds the recharge coupling α b γ, so the mode does not turn over.";
  }
  if (!diag.oscillatory) {
    return "Damped and non-oscillatory. Anomalies decay without a zero crossing set by α b γ.";
  }
  const factor = Math.exp(diag.growthPerYear);
  if (diag.regime === "neutral") {
    return `Neutral. Period ${diag.periodYears.toFixed(1)} yr. Amplitude is set by the initial state.`;
  }
  if (diag.regime === "growing") {
    return `Unstable. Period ${diag.periodYears.toFixed(1)} yr. Linear amplitude grows by a factor ${factor.toFixed(2)} each year. −εₙ h_E³ saturates the orbit when εₙ > 0.`;
  }
  return `Damped. Period ${diag.periodYears.toFixed(1)} yr. Linear amplitude changes by a factor ${factor.toFixed(2)} each year.`;
}

function makeRun(seed) {
  return {
    params: cloneParams(),
    T: 0,
    h: 0,
    icT: 0,
    icH: 0,
    history: { years: [], tC: [], hM: [] },
    sinceRecord: 0,
    diverged: false,
    seed,
    randn: boxMuller(mulberry32(seed)),
  };
}

export function createSimulation() {
  const state = {
    A: makeRun(11),
    B: makeRun(29),
    edit: "A",
    compare: false,
    params: null,
    years: 0,
    playing: false,
    presetId: "neutral",
    monthsPerSecond: 2,
    phaseRange: { x: [-45, 45], y: [-2.6, 2.6] },
    rangeKey: "",
  };
  state.params = state.A.params;

  function edited() {
    return state.edit === "B" ? state.B : state.A;
  }

  function clearHistory(run) {
    run.history = { years: [], tC: [], hM: [] };
    run.sinceRecord = RECORD_EVERY_YEARS;
  }

  function record(run, force) {
    if (!force && run.sinceRecord < RECORD_EVERY_YEARS) return;
    run.sinceRecord = 0;
    const shown = toDisplay(run.T, run.h);
    run.history.years.push(state.years);
    run.history.tC.push(shown.tCelsius);
    run.history.hM.push(shown.hMeters);
    if (run.history.years.length > HISTORY_LIMIT) {
      run.history.years.splice(0, 400);
      run.history.tC.splice(0, 400);
      run.history.hM.splice(0, 400);
    }
  }

  function recordSpan(params) {
    const diag = diagnose(params);
    if (diag.oscillatory && diag.periodYears > 0) return diag.periodYears * CYCLES_ON_RECORD;
    return 12;
  }

  function expandRange(hMeters, tCelsius, reset) {
    if (reset) {
      state.phaseRange = {
        x: [-Math.max(45, Math.abs(hMeters) * 1.4), Math.max(45, Math.abs(hMeters) * 1.4)],
        y: [-Math.max(2.6, Math.abs(tCelsius) * 1.4), Math.max(2.6, Math.abs(tCelsius) * 1.4)],
      };
      state.rangeKey = "";
      return;
    }
    const xNeed = Math.abs(hMeters) * 1.25;
    const yNeed = Math.abs(tCelsius) * 1.25;
    if (xNeed > state.phaseRange.x[1]) state.phaseRange.x = [-nice(xNeed), nice(xNeed)];
    if (yNeed > state.phaseRange.y[1]) state.phaseRange.y = [-nice(yNeed), nice(yNeed)];
  }

  function trailOf(run) {
    const span = recordSpan(run.params);
    const start = state.years - span;
    const { years, tC, hM } = run.history;
    let i = 0;
    while (i < years.length && years[i] < start) i += 1;
    return { h: hM.slice(i), t: tC.slice(i) };
  }

  function seriesWindow() {
    const span = recordSpan(edited().params);
    const end = Math.max(state.years, span);
    const start = Math.max(0, end - span);
    return [start, end];
  }

  function paddedRange(values, floor) {
    let peak = floor;
    for (const value of values) peak = Math.max(peak, Math.abs(value));
    return [-nice(peak * 1.15), nice(peak * 1.15)];
  }

  function ratesOf(run) {
    const det = tendencies(run.h, run.T, run.params, state.years * TIME_UNITS_PER_YEAR);
    return {
      det,
      hE: det.hE * SCALES.hMeters,
      rates: {
        damping: det.termsT.damping * PER_MONTH_T,
        tilt: det.termsT.tilt * PER_MONTH_T,
        zonal: det.termsT.zonal * PER_MONTH_T,
        ekman: det.termsT.ekman * PER_MONTH_T,
        thermocline: det.termsT.thermocline * PER_MONTH_T,
        cubic: det.termsT.cubic * PER_MONTH_T,
        ndh: det.termsT.ndh * PER_MONTH_T,
        annual: det.termsT.annual * PER_MONTH_T,
        memory: det.termsH.memory * PER_MONTH_H,
        sverdrup: det.termsH.sverdrup * PER_MONTH_H,
      },
    };
  }

  function pack(id, run) {
    const shown = toDisplay(run.T, run.h);
    const diag = diagnose(run.params);
    const { det, hE, rates } = ratesOf(run);
    return {
      id,
      params: { ...run.params },
      shown,
      hE,
      diag,
      phase: beatOf(shown.tCelsius, shown.hMeters),
      trail: trailOf(run),
      series: {
        years: run.history.years.slice(),
        tC: run.history.tC.slice(),
        hM: run.history.hM.slice(),
      },
      rates,
      det,
      diverged: run.diverged,
      ic: toDisplay(run.icT, run.icH),
    };
  }

  function restartAtInitial() {
    for (const run of [state.A, state.B]) {
      run.T = run.icT;
      run.h = run.icH;
      run.diverged = false;
      run.randn = boxMuller(mulberry32(run.seed));
      clearHistory(run);
    }
    state.years = 0;
    record(state.A, true);
    if (state.compare) record(state.B, true);
    const shown = toDisplay(edited().T, edited().h);
    const other = state.compare ? toDisplay(state.B.T, state.B.h) : shown;
    expandRange(
      Math.max(Math.abs(shown.hMeters), Math.abs(other.hMeters)),
      Math.max(Math.abs(shown.tCelsius), Math.abs(other.tCelsius)),
      true,
    );
  }

  function snapshot() {
    const active = pack(state.edit, edited());
    const runA = state.edit === "A" ? active : pack("A", state.A);
    const runB = state.compare ? pack("B", state.B) : null;
    const bothT = runA.series.tC.concat(runB ? runB.series.tC : []);
    const bothH = runA.series.hM.concat(runB ? runB.series.hM : []);
    const diag = active.diag;
    const omegaText = diag.omega ? diag.omega.toFixed(3) : "—";
    const numbers =
      `R = ${fmt(diag.R, 3)}, b = ${fmt(diag.b, 3)}, h_E = ${fmt(active.hE, 1)} m. ` +
      `σ = ${fmt(diag.growth, 3)} per 2 months (${signed(diag.growthPerYear, 2)} /yr). ω = ${omegaText}.` +
      (diag.jinLagMonths
        ? ` η = ${diag.jinLagMonths.toFixed(1)} months, with h_W ∝ −T_E(t − η).`
        : "");
    const dTmonth = active.det.dT * PER_MONTH_T;
    const dhMonth = active.det.dh * PER_MONTH_H;
    const tendency = `∂T_E/∂t = ${signed(dTmonth, 2)} °C month⁻¹. ∂h_W/∂t = ${signed(dhMonth, 1)} m month⁻¹.` +
      ((edited().params.sig1 > 0 || edited().params.sig2 > 0) ? " Rates omit ξ₁ and ξ₂." : "");
    const rangeKey = `${state.phaseRange.x[1]}:${state.phaseRange.y[1]}`;
    const rangeChanged = rangeKey !== state.rangeKey;
    state.rangeKey = rangeKey;
    return {
      years: state.years,
      playing: state.playing,
      presetId: state.presetId,
      edit: state.edit,
      compare: state.compare,
      diverged: active.diverged,
      monthsPerSecond: state.monthsPerSecond,
      params: active.params,
      ic: active.ic,
      shown: active.shown,
      hE: active.hE,
      diag,
      phase: active.phase,
      rates: active.rates,
      det: active.det,
      numbers,
      regime: regimeSentence(diag),
      tendency,
      trail: active.trail,
      runA,
      runB,
      series: {
        years: runA.series.years,
        tC: runA.series.tC,
        hM: runA.series.hM,
        window: seriesWindow(),
        tRange: paddedRange(bothT, 2.2),
        hRange: paddedRange(bothH, 30),
      },
      phaseRange: { x: [...state.phaseRange.x], y: [...state.phaseRange.y] },
      rangeChanged,
    };
  }

  function placeAt(tCelsius, hMeters, remember) {
    const nd = toNondim(
      Math.min(4, Math.max(-4, tCelsius)),
      Math.min(80, Math.max(-80, hMeters)),
    );
    const run = edited();
    run.T = nd.T;
    run.h = nd.h;
    if (remember) {
      run.icT = nd.T;
      run.icH = nd.h;
    }
    restartAtInitial();
    run.T = nd.T;
    run.h = nd.h;
    if (remember) {
      run.icT = nd.T;
      run.icH = nd.h;
    }
    clearHistory(state.A);
    clearHistory(state.B);
    state.years = 0;
    record(state.A, true);
    if (state.compare) record(state.B, true);
  }

  function applyPreset(preset) {
    const run = edited();
    run.params = cloneParams(preset.params);
    state.params = run.params;
    state.presetId = preset.id;
    state.playing = true;
    const nd = toNondim(preset.tCelsius, preset.hMeters);
    run.icT = nd.T;
    run.icH = nd.h;
    run.T = nd.T;
    run.h = nd.h;
    run.seed += 1;
    restartAtInitial();
    showRecord();
  }

  function reset() {
    state.playing = state.playing;
    restartAtInitial();
    showRecord();
  }

  function setParam(key, value) {
    edited().params[key] = value;
    state.params = edited().params;
    state.presetId = "";
  }

  function selectRun(id) {
    if (id === "B" && !state.compare) return;
    state.edit = id === "B" ? "B" : "A";
    state.params = edited().params;
    state.presetId = "";
  }

  function duplicate() {
    const source = state.A;
    state.B.params = cloneParams(source.params);
    state.B.T = source.T;
    state.B.h = source.h;
    state.B.icT = source.icT;
    state.B.icH = source.icH;
    state.B.history = {
      years: source.history.years.slice(),
      tC: source.history.tC.slice(),
      hM: source.history.hM.slice(),
    };
    state.B.sinceRecord = source.sinceRecord;
    state.B.diverged = source.diverged;
    state.B.seed = source.seed + 17;
    state.B.randn = boxMuller(mulberry32(state.B.seed));
    state.compare = true;
    state.edit = "B";
    state.params = state.B.params;
    state.presetId = "";
  }

  function dropCompare() {
    state.compare = false;
    state.edit = "A";
    state.params = state.A.params;
  }

  function setSpeed(value) {
    state.monthsPerSecond = value;
  }

  function advanceRun(run, slice) {
    if (run.diverged) return;
    const next = step(run.h, run.T, run.params, slice * TIME_UNITS_PER_YEAR, run.randn, state.years * TIME_UNITS_PER_YEAR);
    run.h = next.h;
    run.T = next.T;
    run.sinceRecord += slice;
    if (!Number.isFinite(run.T) || Math.abs(run.T) > LIMIT || Math.abs(run.h) > LIMIT) {
      run.diverged = true;
    }
  }

  function integrate(years) {
    const active = [state.A];
    if (state.compare) active.push(state.B);
    let left = years;
    while (left > 1e-9) {
      if (active.every((run) => run.diverged)) {
        state.playing = false;
        break;
      }
      const slice = Math.min(SUBSTEP_YEARS, left);
      advanceRun(state.A, slice);
      if (state.compare) advanceRun(state.B, slice);
      state.years += slice;
      left -= slice;
      record(state.A, false);
      if (state.compare) record(state.B, false);
    }
    const shownA = toDisplay(state.A.T, state.A.h);
    expandRange(shownA.hMeters, shownA.tCelsius, false);
    if (state.compare) {
      const shownB = toDisplay(state.B.T, state.B.h);
      expandRange(shownB.hMeters, shownB.tCelsius, false);
    }
  }

  function expandHistory(run) {
    const { tC, hM } = run.history;
    for (let i = 0; i < tC.length; i += 6) expandRange(hM[i], tC[i], false);
  }

  /** Draw several cycles immediately. Play keeps integrating past this record. */
  function showRecord() {
    integrate(recordSpan(state.A.params));
    expandHistory(state.A);
    if (state.compare) expandHistory(state.B);
  }

  function advance(wallSeconds) {
    if (!state.playing) return;
    const active = [state.A];
    if (state.compare) active.push(state.B);
    if (active.every((run) => run.diverged)) {
      state.playing = false;
      return;
    }
    integrate(Math.min(0.45, wallSeconds * (state.monthsPerSecond / 12)));
  }

  function applyInitial(preset) {
    state.edit = "A";
    state.compare = false;
    state.A.params = cloneParams(preset.params);
    state.params = state.A.params;
    state.presetId = preset.id;
    state.playing = true;
    const nd = toNondim(preset.tCelsius, preset.hMeters);
    state.A.icT = nd.T;
    state.A.icH = nd.h;
    state.A.T = nd.T;
    state.A.h = nd.h;
    restartAtInitial();
    showRecord();
  }

  // Fig. 3 neutral orbit, begun where the west is recharged and the east has not warmed.
  applyInitial({ ...PRESETS.neutral, id: "", tCelsius: -0.4, hMeters: 14 });
  state.playing = false;
  return {
    state,
    snapshot,
    placeAt,
    applyPreset,
    reset,
    setParam,
    setSpeed,
    selectRun,
    duplicate,
    dropCompare,
    advance,
    play() {
      const runs = state.compare ? [state.A, state.B] : [state.A];
      if (runs.some((run) => !run.diverged)) state.playing = true;
    },
    pause() {
      state.playing = false;
    },
  };
}
