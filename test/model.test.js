import assert from "node:assert/strict";
import test from "node:test";
import {
  JIN_DEFAULTS,
  PRESETS,
  SCALES,
  TIME_UNITS_PER_YEAR,
  beatOf,
  boxMuller,
  diagnose,
  eulerMaruyamaStep,
  growthPieces,
  linearNeutralSolution,
  monthsFromRate,
  mulberry32,
  phaseOf,
  rk4Step,
  step,
  tendencies,
  tiltMetersPerCelsius,
  toDisplay,
  toNondim,
} from "../js/model.js";

const MC = 2 / 3;

test("Jin default scales and coefficients", () => {
  assert.equal(SCALES.hMeters, 150);
  assert.equal(SCALES.tCelsius, 7.5);
  assert.equal(SCALES.monthsPerTime, 2);
  assert.equal(JIN_DEFAULTS.c, 1);
  assert.equal(JIN_DEFAULTS.gamma, 0.75);
  assert.equal(JIN_DEFAULTS.r, 0.25);
  assert.equal(JIN_DEFAULTS.alpha, 0.125);
  assert.equal(JIN_DEFAULTS.b0, 2.5);
  assert.equal(monthsFromRate(1), 2);
  assert.equal(monthsFromRate(0.25), 8);
  assert.equal(tiltMetersPerCelsius(2.5), 50);
});

test("critical coupling is neutral with Jin's frequency", () => {
  const d = diagnose({ ...JIN_DEFAULTS, mu: MC });
  assert.ok(Math.abs(d.growth) < 1e-12);
  assert.ok(Math.abs(d.R - d.b * JIN_DEFAULTS.gamma + JIN_DEFAULTS.c) < 1e-12);
  assert.ok(Math.abs(d.omega ** 2 - 3 / 32) < 1e-12);
  assert.ok(Math.abs(d.periodYears - 3.42) < 0.03);
  assert.ok(d.leadMonths > 12 && d.leadMonths < 18);
  assert.ok(Math.abs(d.jinLagMonths - 5.8) < 0.3);
  assert.equal(d.regime, "neutral");
  assert.ok(Math.abs(d.tilt - 50 * MC) < 1e-9);
});

test("oscillation window matches Jin's μ1 and μ2 for the default coefficients", () => {
  const mu1 = (8 - Math.sqrt(28)) / 15;
  const mu2 = (8 + Math.sqrt(28)) / 15;
  const d1 = diagnose({ ...JIN_DEFAULTS, mu: mu1 });
  const d2 = diagnose({ ...JIN_DEFAULTS, mu: mu2 });
  assert.ok(Math.abs(d1.disc) < 1e-9);
  assert.ok(Math.abs(d2.disc) < 1e-9);
  assert.equal(diagnose({ ...JIN_DEFAULTS, mu: 0.5 }).regime, "damped");
  assert.equal(diagnose({ ...JIN_DEFAULTS, mu: 0.75 }).regime, "growing");
  assert.equal(diagnose({ ...JIN_DEFAULTS, mu: 0.05 }).regime, "damped-nonoscillatory");
  assert.equal(diagnose({ ...JIN_DEFAULTS, mu: 1.2 }).regime, "growing-nonoscillatory");
});

test("tendencies are equations (2.6) and (3.1)", () => {
  const p = { ...JIN_DEFAULTS, mu: 0.8, eps: 2 };
  const h = 0.2;
  const T = -0.1;
  const b = p.b0 * p.mu;
  const R = p.gamma * b - p.c;
  const hE = h + b * T;
  const got = tendencies(h, T, p);
  assert.equal(got.b, b);
  assert.equal(got.R, R);
  assert.equal(got.hE, hE);
  assert.ok(Math.abs(got.dT - (R * T + p.gamma * h - p.eps * hE ** 3)) < 1e-12);
  assert.ok(Math.abs(got.dh - (-p.r * h - p.alpha * b * T)) < 1e-12);
});

test("a warm east discharges the west, and the portrait turns clockwise", () => {
  const p = { ...JIN_DEFAULTS, mu: MC, eps: 0 };
  const warm = tendencies(0, 0.2, p);
  assert.ok(warm.dh < 0);
  const cold = tendencies(0, -0.2, p);
  assert.ok(cold.dh > 0);
  const deep = tendencies(0.2, 0, p);
  assert.ok(deep.dT > 0);
  const next = rk4Step(0, 0.2, p, 0.05);
  assert.ok(next.h < 0);
  assert.ok(next.T > 0);
});

test("RK4 tracks the neutral closed-form orbit", () => {
  const p = { ...JIN_DEFAULTS, mu: MC, eps: 0 };
  const T0 = 1.125 / SCALES.tCelsius;
  let h = 0;
  let T = T0;
  const dt = 0.02;
  const period = (2 * Math.PI) / diagnose(p).omega;
  const steps = Math.round((3 * period) / dt);
  for (let i = 1; i <= steps; i += 1) {
    ({ h, T } = rk4Step(h, T, p, dt));
    if (i % 50 === 0) {
      const exact = linearNeutralSolution(0, T0, p, i * dt);
      assert.ok(Math.abs(h - exact.h) < 2e-3);
      assert.ok(Math.abs(T - exact.T) < 2e-3);
    }
  }
  const shown = toDisplay(T0, 0);
  assert.ok(Math.abs(shown.tCelsius - 1.125) < 1e-12);
  assert.deepEqual(toNondim(1.125, 30), {
    T: 1.125 / 7.5,
    h: 30 / 150,
  });
});

test("cubic saturation keeps a supercritical run bounded and finite", () => {
  const p = { ...PRESETS.growing.params };
  let { h, T } = toNondim(PRESETS.growing.tCelsius, PRESETS.growing.hMeters);
  const start = Math.abs(T);
  const dt = 0.05;
  let peak = 0;
  for (let i = 0; i < 8000; i += 1) {
    ({ h, T } = rk4Step(h, T, p, dt));
    peak = Math.max(peak, Math.abs(T));
    assert.ok(Math.abs(T) < 1);
    assert.ok(Math.abs(h) < 1);
  }
  assert.ok(peak > start * 3, "the warm event should grow out of the small start");
  assert.ok(peak * SCALES.tCelsius < 3);
});

test("wind noise uses one draw in both equations", () => {
  const p = {
    ...JIN_DEFAULTS,
    mu: MC,
    eps: 0,
    c: 0,
    gamma: 0.5,
    r: 0,
    alpha: 0.25,
    b0: 0,
    sig1: 0.16,
    sig2: 0.09,
  };
  // b = 0 and the state is at rest, so only the noise increments remain.
  const draws = [0.5, -1.5];
  let n = 0;
  const randn = () => draws[n++];
  const dt = 0.04;
  const got = eulerMaruyamaStep(0, 0, p, dt, randn);
  const dw1 = Math.sqrt(dt) * draws[0];
  const dw2 = Math.sqrt(dt) * draws[1];
  assert.ok(Math.abs(got.h - (-p.alpha * Math.sqrt(p.sig1) * dw1)) < 1e-12);
  assert.ok(
    Math.abs(got.T - (p.gamma * Math.sqrt(p.sig1) * dw1 + Math.sqrt(p.sig2) * dw2)) <
      1e-12,
  );
  assert.equal(n, 2);
});

test("phase labels follow the recharge cycle, not a new rule in the ODE", () => {
  assert.equal(phaseOf(1.2, -5).id, "elnino");
  assert.equal(phaseOf(-1.2, 5).id, "lanina");
  assert.equal(phaseOf(0, 20).id, "recharged");
  assert.equal(phaseOf(0, -20).id, "discharged");
});

test("the neutral orbit names recharged, warming, El Niño, discharge, La Niña, recharge", () => {
  const p = { ...JIN_DEFAULTS, mu: MC, eps: 0, sig1: 0, sig2: 0 };
  let { h, T } = toNondim(-0.4, 14);
  const names = [];
  let previous = "";
  const period = diagnose(p).periodYears;
  for (let y = 0; y <= period + 0.05; y += 0.02) {
    const shown = toDisplay(T, h);
    const name = beatOf(shown.tCelsius, shown.hMeters).title;
    if (name !== previous) {
      names.push(name);
      previous = name;
    }
    ({ h, T } = step(h, T, p, 0.02 * TIME_UNITS_PER_YEAR, () => 0));
  }
  assert.deepEqual(names.slice(0, 6), ["Recharged", "Warming", "El Niño", "Discharge", "La Niña", "Recharge"]);
  assert.equal(names[6], "Recharged");
});

test("ζ = κ = ν = 0 leaves the 1997 growth rate and tendencies", () => {
  const plain = { ...JIN_DEFAULTS, mu: 0.8, eps: 2 };
  delete plain.zeta;
  delete plain.kappa;
  delete plain.nu;
  const pieces = growthPieces(plain);
  const b = plain.b0 * plain.mu;
  assert.equal(pieces.R, plain.gamma * b - plain.c);
  assert.equal(pieces.zonal, 0);
  assert.equal(pieces.ekman, 0);
  const got = tendencies(0.2, -0.1, plain);
  assert.ok(Math.abs(got.dT - (pieces.R * -0.1 + plain.gamma * 0.2 - plain.eps * got.hE ** 3)) < 1e-12);
  assert.equal(got.termsT.ndh, 0);
  assert.equal(diagnose(plain).flavor, "cold-tongue");
});

test("Bjerknes index pieces sum to R, and Ekman and zonal advection only warm the SST equation", () => {
  const p = { ...JIN_DEFAULTS, mu: 0.7, zeta: 0.4, kappa: 0.15 };
  const pieces = growthPieces(p);
  assert.ok(Math.abs(pieces.thermocline + pieces.zonal + pieces.ekman + pieces.damping - pieces.R) < 1e-12);
  assert.ok(Math.abs(pieces.zonal - 0.4 * pieces.b) < 1e-12);
  assert.ok(Math.abs(pieces.ekman - 0.15 * pieces.b) < 1e-12);
  const withFeedbacks = tendencies(0.1, 0.2, p);
  const without = tendencies(0.1, 0.2, { ...p, zeta: 0, kappa: 0 });
  assert.ok(Math.abs(withFeedbacks.dh - without.dh) < 1e-12);
  assert.ok(withFeedbacks.dT > without.dT);
  const d = diagnose(p);
  assert.equal(d.flavor, "cold-tongue");
  assert.ok(Math.abs(d.growth - (pieces.R - p.r) / 2) < 1e-12);
});

test("warm-pool preset is the Jin and An zonal feedback, near neutral, anomaly placed west", () => {
  const p = PRESETS.warmpool.params;
  const d = diagnose(p);
  assert.equal(d.flavor, "warm-pool");
  assert.ok(d.zonalShare > 0.6);
  assert.equal(d.regime, "neutral");
  assert.ok(Math.abs(d.periodYears - 3.76) < 0.05);
  assert.equal(d.pieces.kappa, 0);
  assert.equal(p.nu, 0);
});

test("quadratic heating warms both phases, so El Niño outgrows La Niña", () => {
  const p = { ...JIN_DEFAULTS, nu: 0.5, eps: 0 };
  const warm = tendencies(0, 0.2, p);
  const cold = tendencies(0, -0.2, p);
  assert.ok(warm.termsT.ndh > 0);
  assert.ok(cold.termsT.ndh > 0);
  assert.ok(Math.abs(warm.termsT.ndh - p.nu * 0.04) < 1e-12);
  assert.ok(Math.abs(warm.termsT.ndh - cold.termsT.ndh) < 1e-12);
  assert.ok(warm.dh < 0);
  assert.ok(cold.dh > 0);

  const preset = PRESETS.asymmetric;
  let { T, h } = toNondim(preset.tCelsius, preset.hMeters);
  const dt = 0.004 * TIME_UNITS_PER_YEAR;
  let maxT = -Infinity;
  let minT = Infinity;
  const steps = Math.round(30 / 0.004);
  for (let i = 0; i < steps; i += 1) {
    const next = rk4Step(h, T, preset.params, dt);
    h = next.h;
    T = next.T;
    if (i > steps * 0.5) {
      const shown = toDisplay(T, h);
      maxT = Math.max(maxT, shown.tCelsius);
      minT = Math.min(minT, shown.tCelsius);
    }
  }
  assert.ok(maxT > 1.8);
  assert.ok(minT < -1);
  assert.ok(maxT > Math.abs(minT) * 1.4);
});

test("seeded noise generator is deterministic", () => {
  const a = boxMuller(mulberry32(7));
  const b = boxMuller(mulberry32(7));
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.every((x) => Number.isFinite(x)));
});
