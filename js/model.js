/**
 * Fei-Fei Jin's recharge oscillator, Part I conceptual model.
 *
 * Jin, F.-F. (1997). An equatorial ocean recharge paradigm for ENSO.
 * Part I: Conceptual model. Journal of the Atmospheric Sciences, 54(7),
 * 811–829. https://doi.org/10.1175/1520-0469(1997)054<0811:AEORPF>2.0.CO;2
 *
 * Integrated equations are Jin's (2.6), (3.1), and (3.4). The Ekman
 * feedback δ_s b′ is omitted, so R = γ b − c, as Jin does after (2.6).
 * Part II derives this same two-equation system from a stripped-down
 * coupled model; the playground integrates the Part I conceptual form.
 *
 * Nondimensional scales stated in Part I (section 2):
 *   [h] = 150 m,  [T] = 7.5 K,  [t] = 2 months.
 * Default coefficients: c = 1, γ = 0.75, r = 0.25, α = 0.125, b0 = 2.5.
 */

export const SCALES = {
  hMeters: 150,
  tCelsius: 7.5,
  monthsPerTime: 2,
};

/** Time units per year: 12 months / 2 months. */
export const TIME_UNITS_PER_YEAR = 12 / SCALES.monthsPerTime;

export const JIN_DEFAULTS = Object.freeze({
  mu: 2 / 3,
  b0: 2.5,
  c: 1,
  gamma: 0.75,
  r: 0.25,
  alpha: 0.125,
  /** Cubic saturation ε_n in (3.1). Zero is the linear oscillator (2.6). */
  eps: 0,
  /** Wind-stress noise variance σ₁² in (3.4). */
  sig1: 0,
  /** Heating noise variance σ₂² in (3.4). Jin's illustrated value is 2/15. */
  sig2: 0,
});

/**
 * Presets are initial states and coefficients, not extra physics.
 * Neutral matches the Fig. 3 initial SST (1.125°C, h_W = 0) at critical coupling.
 */
export const PRESETS = {
  neutral: {
    id: "neutral",
    label: "Neutral",
    detail: "Jin’s critical coupling, a steady cycle",
    params: { ...JIN_DEFAULTS, mu: 2 / 3, eps: 0, sig1: 0, sig2: 0 },
    tCelsius: 1.125,
    hMeters: 0,
  },
  growing: {
    id: "growing",
    label: "Growing El Niño",
    detail: "Supercritical coupling, cubic term limits the growth",
    // Jin's Fig. 11 uses μ = 0.7 and ε_n = 3, close to the Hopf point.
    // μ = 0.75 and ε_n = 0.8 is the same equation (3.1), a little further
    // above critical so the warm event grows to about ±1.7°C and then levels off.
    params: { ...JIN_DEFAULTS, mu: 0.75, eps: 0.8, sig1: 0, sig2: 0 },
    tCelsius: 0.3,
    hMeters: 4,
  },
  lanina: {
    id: "lanina",
    label: "La Niña",
    detail: "Cold eastern Pacific on the neutral cycle",
    params: { ...JIN_DEFAULTS, mu: 2 / 3, eps: 0, sig1: 0, sig2: 0 },
    tCelsius: -1.5,
    hMeters: -8,
  },
  recharge: {
    id: "recharge",
    label: "Strong recharge",
    detail: "Heat piled in the west, east still normal",
    params: { ...JIN_DEFAULTS, mu: 2 / 3, eps: 0, sig1: 0, sig2: 0 },
    tCelsius: 0,
    hMeters: 40,
  },
};

export function cloneParams(partial = {}) {
  return { ...JIN_DEFAULTS, ...partial };
}

export function toNondim(tCelsius, hMeters) {
  return {
    T: tCelsius / SCALES.tCelsius,
    h: hMeters / SCALES.hMeters,
  };
}

export function toDisplay(T, h) {
  return {
    tCelsius: T * SCALES.tCelsius,
    hMeters: h * SCALES.hMeters,
  };
}

/** b = b0 μ, in nondimensional depth per temperature. */
export function couplingB(p) {
  return p.b0 * p.mu;
}

/** Dimensional east–west tilt: meters of thermocline difference per °C. */
export function tiltMetersPerCelsius(bNondim) {
  return bNondim * (SCALES.hMeters / SCALES.tCelsius);
}

/** Damping or adjustment time, in months, for a nondimensional rate. */
export function monthsFromRate(rate) {
  if (!(rate > 0)) return Infinity;
  return SCALES.monthsPerTime / rate;
}

/**
 * Linear operator diagnostics for the current coefficients.
 * Growth rate σ = (R − r) / 2.
 * Frequency ω = sqrt(α b γ − (R + r)² / 4), when that is positive.
 */
export function diagnose(p) {
  const b = couplingB(p);
  const R = p.gamma * b - p.c;
  const growth = (R - p.r) / 2;
  const disc = p.alpha * b * p.gamma - ((R + p.r) ** 2) / 4;
  const oscillatory = disc > 0;
  const omega = oscillatory ? Math.sqrt(disc) : null;
  const growthPerYear = growth * TIME_UNITS_PER_YEAR;

  let periodYears = null;
  let leadMonths = null;
  let jinLagMonths = null;
  if (omega) {
    periodYears = (2 * Math.PI) / omega / TIME_UNITS_PER_YEAR;
    // Eigenvector: h/T = −α b / (r + σ + iω).
    // Positive lead means the h_W maximum occurs before the T_E maximum.
    const phi = Math.PI - Math.atan2(omega, p.r + growth);
    leadMonths = (phi / omega) * SCALES.monthsPerTime;
    // Jin's η in (2.9): h_W(t) ∝ −T_E(t − η), η = arctan(ω/r) / ω
    // at the neutral point. The same arctan form is reported for the
    // current r and ω so the lag readout follows the sliders.
    const eta = Math.atan2(omega, p.r) / omega;
    jinLagMonths = eta * SCALES.monthsPerTime;
  }

  let regime = "oscillatory";
  if (!oscillatory && growth > 0) regime = "growing-nonoscillatory";
  else if (!oscillatory && growth < 0) regime = "damped-nonoscillatory";
  else if (oscillatory && growth > 1e-3) regime = "growing";
  else if (oscillatory && growth < -1e-3) regime = "damped";
  else if (oscillatory) regime = "neutral";

  return {
    b,
    R,
    growth,
    growthPerYear,
    disc,
    omega,
    oscillatory,
    periodYears,
    leadMonths,
    jinLagMonths,
    regime,
    tilt: tiltMetersPerCelsius(b),
    sstDampingMonths: monthsFromRate(p.c),
    oceanMemoryMonths: monthsFromRate(p.r),
  };
}

/**
 * Deterministic tendencies.
 * dT_E/dt = R T_E + γ h_W − ε_n (h_W + b T_E)³
 * dh_W/dt = −r h_W − α b T_E
 * h_E = h_W + b T_E   (eq. 2.1 with τ = b T_E)
 */
export function tendencies(h, T, p) {
  const b = couplingB(p);
  const R = p.gamma * b - p.c;
  const hE = h + b * T;
  const cubic = -p.eps * hE * hE * hE;
  const bjerknes = R * T;
  const thermocline = p.gamma * h;
  const memory = -p.r * h;
  const sverdrup = -p.alpha * b * T;
  return {
    b,
    R,
    hE,
    dT: bjerknes + thermocline + cubic,
    dh: memory + sverdrup,
    termsT: { bjerknes, thermocline, cubic },
    termsH: { memory, sverdrup },
  };
}

export function rk4Step(h, T, p, dt) {
  const k1 = tendencies(h, T, p);
  const k2 = tendencies(h + 0.5 * dt * k1.dh, T + 0.5 * dt * k1.dT, p);
  const k3 = tendencies(h + 0.5 * dt * k2.dh, T + 0.5 * dt * k2.dT, p);
  const k4 = tendencies(h + dt * k3.dh, T + dt * k3.dT, p);
  return {
    h: h + (dt / 6) * (k1.dh + 2 * k2.dh + 2 * k3.dh + k4.dh),
    T: T + (dt / 6) * (k1.dT + 2 * k2.dT + 2 * k3.dT + k4.dT),
  };
}

/**
 * Euler–Maruyama step for (3.4), with the cubic of (3.1) kept on the
 * resolved thermocline. White noises satisfy ⟨ξ_i(t) ξ_j(s)⟩ = δ_ij δ(t−s),
 * and σ₁², σ₂² are the variances Jin writes in front of the spectra.
 * One wind draw ξ₁ enters both equations, as in (3.4): −α ξ₁ and +γ ξ₁.
 * The heating draw ξ₂ enters only the SST equation.
 */
export function eulerMaruyamaStep(h, T, p, dt, randn) {
  const det = tendencies(h, T, p);
  const z1 = randn();
  const z2 = randn();
  const dw1 = Math.sqrt(dt) * z1;
  const dw2 = Math.sqrt(dt) * z2;
  const wind = Math.sqrt(Math.max(0, p.sig1));
  const heat = Math.sqrt(Math.max(0, p.sig2));
  return {
    h: h + det.dh * dt - p.alpha * wind * dw1,
    T: T + det.dT * dt + p.gamma * wind * dw1 + heat * dw2,
  };
}

export function step(h, T, p, dt, randn) {
  if (p.sig1 > 0 || p.sig2 > 0) {
    return eulerMaruyamaStep(h, T, p, dt, randn);
  }
  return rk4Step(h, T, p, dt);
}

/** Closed-form neutral orbit at the supplied coefficients, for h(0), T(0). */
export function linearNeutralSolution(h0, T0, p, time) {
  const d = diagnose(p);
  if (!d.omega) return null;
  const { b, omega } = d;
  const { r, gamma, alpha } = p;
  const T =
    T0 * Math.cos(omega * time) +
    ((r * T0 + gamma * h0) / omega) * Math.sin(omega * time);
  const h =
    h0 * Math.cos(omega * time) -
    ((r * h0 + alpha * b * T0) / omega) * Math.sin(omega * time);
  return { h, T };
}

/**
 * Which part of Jin's four-phase cycle the state is in.
 * Thresholds are only for the label; they do not affect the equations.
 */
export function phaseOf(tCelsius, hMeters) {
  if (tCelsius > 0.35) {
    return {
      id: "elnino",
      title: "El Niño",
      line: "The eastern Pacific is warm. Westerly wind anomalies are draining equatorial heat, so the western thermocline is shoaling.",
    };
  }
  if (tCelsius < -0.35) {
    return {
      id: "lanina",
      title: "La Niña",
      line: "The eastern Pacific is cold. Stronger trades are recharging equatorial heat, so the western thermocline is deepening.",
    };
  }
  if (hMeters > 0) {
    return {
      id: "recharged",
      title: "Recharged",
      line: "The east is near normal and the west is still deep. That stored heat is what warms the east next.",
    };
  }
  return {
    id: "discharged",
    title: "Discharged",
    line: "The east is near normal and equatorial heat has been drained. The shallow thermocline is what cools the east next.",
  };
}

export function boxMuller(rng) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    const ang = 2 * Math.PI * v;
    spare = mag * Math.sin(ang);
    return mag * Math.cos(ang);
  };
}

/** Mulberry32, for reproducible noise tests and the optional noise slider. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
