/**
 * Playback state for Jin's oscillator. The equations live in js/model.js.
 * This file only steps them, stores history, and builds the readout.
 */

import {
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
  toDisplay,
  toNondim,
} from "../../js/model.js";

const LIMIT = 6;
const RECORD_EVERY_YEARS = 0.04;
const SUBSTEP_YEARS = 0.004;
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

export function createSimulation() {
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
    if (state.history.years.length > 900) {
      state.history.years.splice(0, 120);
      state.history.tC.splice(0, 120);
      state.history.hM.splice(0, 120);
    }
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

  function trail() {
    const diag = diagnose(state.params);
    const span = diag.periodYears ? Math.min(14, Math.max(8, diag.periodYears * 3)) : 10;
    const start = state.years - span;
    const { years, tC, hM } = state.history;
    let i = 0;
    while (i < years.length && years[i] < start) i += 1;
    return { h: hM.slice(i), t: tC.slice(i) };
  }

  function seriesWindow() {
    const end = Math.max(state.years, 4);
    const start = state.years > 12 ? state.years - 12 : 0;
    return [start, Math.max(end, start + 4)];
  }

  function paddedRange(values, floor) {
    let peak = floor;
    for (const value of values) peak = Math.max(peak, Math.abs(value));
    return [-nice(peak * 1.15), nice(peak * 1.15)];
  }

  function snapshot() {
    const shown = toDisplay(state.T, state.h);
    const diag = diagnose(state.params);
    const phase = phaseOf(shown.tCelsius, shown.hMeters);
    const det = tendencies(state.h, state.T, state.params);
    const hE = det.hE * SCALES.hMeters;
    const rates = {
      bjerknes: det.termsT.bjerknes * PER_MONTH_T,
      thermocline: det.termsT.thermocline * PER_MONTH_T,
      cubic: det.termsT.cubic * PER_MONTH_T,
      memory: det.termsH.memory * PER_MONTH_H,
      sverdrup: det.termsH.sverdrup * PER_MONTH_H,
    };
    const omegaText = diag.omega ? diag.omega.toFixed(3) : "not real";
    const numbers =
      `With these sliders: R = ${fmt(diag.R, 3)}, b = ${fmt(diag.b, 3)}, ` +
      `h_E = ${fmt(hE, 1)} m, σ = ${fmt(diag.growth, 3)} per 2 months ` +
      `(${signed(diag.growthPerYear, 2)} /yr), ω = ${omegaText}.` +
      (diag.jinLagMonths
        ? ` Jin’s lag η = ${diag.jinLagMonths.toFixed(1)} months: h_W is opposite the SST of that long ago.`
        : "");
    const dTmonth = det.dT * PER_MONTH_T;
    const dhMonth = det.dh * PER_MONTH_H;
    const east = dTmonth >= 0
      ? `The east is warming at ${dTmonth.toFixed(2)} °C per month.`
      : `The east is cooling at ${Math.abs(dTmonth).toFixed(2)} °C per month.`;
    const west = dhMonth >= 0
      ? `The west is deepening at ${dhMonth.toFixed(1)} m per month, so recharge is winning.`
      : `The west is shoaling at ${Math.abs(dhMonth).toFixed(1)} m per month, so discharge is winning.`;
    const noise = state.params.sig1 > 0 || state.params.sig2 > 0
      ? " Noise is on, so these bars are the smooth part of eq. 3.4."
      : "";
    const rangeKey = `${state.phaseRange.x[1]}:${state.phaseRange.y[1]}`;
    const rangeChanged = rangeKey !== state.rangeKey;
    state.rangeKey = rangeKey;
    return {
      years: state.years,
      playing: state.playing,
      presetId: state.presetId,
      diverged: state.diverged,
      monthsPerSecond: state.monthsPerSecond,
      params: { ...state.params },
      ic: toDisplay(state.icT, state.icH),
      shown,
      hE,
      diag,
      phase,
      rates,
      det,
      numbers,
      regime: regimeSentence(diag),
      tendency: `${east} ${west}${noise}`,
      trail: trail(),
      series: {
        years: state.history.years.slice(),
        tC: state.history.tC.slice(),
        hM: state.history.hM.slice(),
        window: seriesWindow(),
        tRange: paddedRange(state.history.tC, 2.2),
        hRange: paddedRange(state.history.hM, 30),
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
    state.T = nd.T;
    state.h = nd.h;
    if (remember) {
      state.icT = nd.T;
      state.icH = nd.h;
    }
    state.diverged = false;
    clearHistory();
    record(true);
    expandRange(nd.T * SCALES.tCelsius, nd.h * SCALES.hMeters, true);
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
  }

  function reset() {
    state.T = state.icT;
    state.h = state.icH;
    state.diverged = false;
    reseed();
    clearHistory();
    record(true);
    const shown = toDisplay(state.T, state.h);
    expandRange(shown.hMeters, shown.tCelsius, true);
  }

  function setParam(key, value) {
    state.params[key] = value;
    state.presetId = "";
  }

  function setSpeed(value) {
    state.monthsPerSecond = value;
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
    const shown = toDisplay(state.T, state.h);
    expandRange(shown.hMeters, shown.tCelsius, false);
  }

  reseed();
  applyPreset(PRESETS.neutral);
  return {
    state,
    snapshot,
    placeAt,
    applyPreset,
    reset,
    setParam,
    setSpeed,
    advance,
    play() {
      if (!state.diverged) state.playing = true;
    },
    pause() {
      state.playing = false;
    },
  };
}
