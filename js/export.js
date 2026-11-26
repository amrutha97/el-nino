/**
 * Tables for a notebook. Coefficients repeat on each row so a CSV
 * reader keeps the parameter set with the series.
 */

const COEFFICIENTS = ["mu", "b0", "c", "gamma", "r", "alpha", "eps", "sig1", "sig2", "zeta", "kappa", "nu", "ann", "bee"];

function cell(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(Math.round(value * 1e6) / 1e6);
  }
  return value == null ? "" : String(value);
}

export function seriesCsv(runs) {
  const header = ["run", "year", "T_E_celsius", "h_W_meters", ...COEFFICIENTS];
  const lines = [header.join(",")];
  for (const run of runs) {
    const years = run.series?.years || [];
    for (let i = 0; i < years.length; i += 1) {
      const row = [
        run.id,
        years[i],
        run.series.tC[i],
        run.series.hM[i],
        ...COEFFICIENTS.map((key) => run.params[key]),
      ];
      lines.push(row.map(cell).join(","));
    }
  }
  return `${lines.join("\n")}\n`;
}

export function parameterJson(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
