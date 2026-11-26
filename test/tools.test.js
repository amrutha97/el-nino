import assert from "node:assert/strict";
import test from "node:test";
import { JIN_DEFAULTS, cloneParams } from "../js/model.js";
import { sweepLinear } from "../js/sweep.js";
import { parameterJson, seriesCsv } from "../js/export.js";

test("μ sweep crosses the stability boundary and the oscillatory window", () => {
  const points = sweepLinear(cloneParams(JIN_DEFAULTS), "mu");
  assert.ok(points.some((point) => point.growthPerYear < 0));
  assert.ok(points.some((point) => point.growthPerYear > 0));
  assert.ok(points.some((point) => point.oscillatory && point.periodYears > 2 && point.periodYears < 8));
  assert.ok(points.some((point) => !point.oscillatory && point.periodYears === null));
  const neutral = points.reduce((best, point) => (
    Math.abs(point.growthPerYear) < Math.abs(best.growthPerYear) ? point : best
  ));
  assert.ok(Math.abs(neutral.x - 2 / 3) < 0.04);
});

test("b sweep is the wind coupling b = b₀ μ", () => {
  const params = cloneParams({ ...JIN_DEFAULTS, b0: 2.5 });
  const points = sweepLinear(params, "b");
  assert.equal(points[0].x, 0);
  assert.ok(Math.abs(points[points.length - 1].x - 3.75) < 1e-9);
  assert.ok(points.some((point) => point.growthPerYear > 0 && point.oscillatory));
});

test("CSV carries the series and the coefficients; JSON is the parameter set", () => {
  const params = cloneParams(JIN_DEFAULTS);
  const csv = seriesCsv([{
    id: "A",
    params,
    series: { years: [0, 0.04], tC: [1.125, 1.1], hM: [0, -1] },
  }]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "run,year,T_E_celsius,h_W_meters,mu,b0,c,gamma,r,alpha,eps,sig1,sig2,zeta,kappa,nu");
  assert.ok(lines[1].startsWith("A,0,1.125,0,"));
  assert.equal(lines.length, 3);
  const json = JSON.parse(parameterJson({
    scales: { h_meters: 150, T_celsius: 7.5, t_months: 2 },
    runs: { A: { parameters: params, initial: { T_E_celsius: 1.125, h_W_meters: 0 } } },
  }));
  assert.equal(json.scales.h_meters, 150);
  assert.equal(json.runs.A.parameters.gamma, 0.75);
  assert.equal(json.runs.A.initial.T_E_celsius, 1.125);
});
