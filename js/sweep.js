/**
 * Linear diagnostics along one coefficient. Uses diagnose() only.
 * The sweep does not integrate the ODE.
 */

import { diagnose } from "./model.js";

const STEPS = 61;

/**
 * @param {object} params current coefficients
 * @param {"mu" | "b"} which μ, or the wind coupling b = b₀ μ
 * @returns {{ x: number, growthPerYear: number, periodYears: number | null, oscillatory: boolean }[]}
 */
export function sweepLinear(params, which) {
  const points = [];
  for (let i = 0; i < STEPS; i += 1) {
    const x = which === "b" ? (3.75 * i) / (STEPS - 1) : (1.5 * i) / (STEPS - 1);
    const next = { ...params };
    if (which === "b") next.mu = params.b0 ? x / params.b0 : 0;
    else next.mu = x;
    const diag = diagnose(next);
    points.push({
      x,
      growthPerYear: diag.growthPerYear,
      periodYears: diag.oscillatory ? diag.periodYears : null,
      oscillatory: diag.oscillatory,
    });
  }
  return points;
}
