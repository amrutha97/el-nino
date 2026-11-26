# Recharge oscillator

Eastern Pacific SST anomaly \(T_E\) and western thermocline anomaly \(h_W\), from Fei-Fei Jin’s recharge oscillator.

Jin, F.-F. (1997). An equatorial ocean recharge paradigm for ENSO. Part I: Conceptual model. *Journal of the Atmospheric Sciences*, 54(7), 811–829. [doi:10.1175/1520-0469(1997)054<0811:AEORPF>2.0.CO;2](https://doi.org/10.1175/1520-0469(1997)054%3C0811:AEORPF%3E2.0.CO;2).

Part II derives the same two equations from a stripped-down coupled model. The integration is the Part I system, equations (2.6), (3.1), and (3.4), in the nondimensional units of section 2, displayed in °C, meters, and years. Scales: \([h] = 150\,\mathrm{m}\), \([T] = 7.5\,^\circ\mathrm{C}\), \([t] = 2\) months.

```text
h_E = h_W + b T_E
R = (γ + ζ + κ) b − c
dT_E/dt = R T_E + γ h_W − ε_n h_E³ + ν T_E² + γ ξ₁ + ξ₂
dh_W/dt = −r h_W − α b T_E − α ξ₁
```

\(b = b_0 \mu\). With \(\zeta = \kappa = \nu = 0\) this is (2.6), (3.1), and (3.4): thermocline feedback, cubic saturation on \(h_E^3\), and white wind and heating noise. \(\zeta\) is the zonal advective feedback of Jin and An (1999) and the warm-pool branch of Kug, Jin, and An (2009). \(\kappa\) is the Ekman feedback in the Bjerknes index of Jin, Kim, and Bejarano (2006). \(\nu T_E^2\) is a schematic of the nonlinear dynamical heating diagnosed by An and Jin (2004). The linear operator gives the growth rate \(\sigma = (R - r)/2\), the frequency \(\omega\), the period, and the lead of \(h_W\) ahead of \(T_E\).

The page shows one state at a time: the equatorial SST and warm pool on a Blue Marble globe, an equatorial section of warm-water volume, or the clockwise \((h_W, T_E)\) orbit with the time series. A second run can be copied from the first and overlaid. Coefficients and the integrated series export as CSV; the parameter set exports as JSON. A sweep of \(\mu\) or \(b\) plots period and \(\sigma\), with \(\sigma = 0\) the stability boundary.

The equations are in `js/model.js`.

## Run

```bash
npm install
npm run dev
```

The built page:

```bash
npm run build
python3 serve.py
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). `serve.py` serves `dist` on all interfaces.

GitHub Pages: [https://amrutha97.github.io/el-nino/](https://amrutha97.github.io/el-nino/). `.github/workflows/pages.yml` publishes `dist` on each push to `main`.

Vercel: import the repository, framework Vite, build `npm run build`, output `dist`, production branch `main`.

Check the equations and the sweep and export helpers:

```bash
node --test test/model.test.js test/tools.test.js
```

## On iPhone or iPad

Safari, Share, Add to Home Screen, then open **Recharge**. The play controls sit above the home indicator. Full screen uses a fixed viewport on iPhone and iPad, because Safari often refuses element fullscreen. Escape, or Close, returns to the page. The offline cache installs from localhost or https.
