# El Niño recharge oscillator

A playable version of Fei-Fei Jin’s recharge oscillator: the two-equation picture of El Niño in which the eastern Pacific warms, the wind discharges equatorial heat, and that discharge swings the Pacific into La Niña.

The repository started as a README with only the title. The default model is Jin’s 1997 conceptual oscillator. Three later results that extend that oscillator are in the same equations, and they are off until you turn them on.

Jin, F.-F. (1997). An equatorial ocean recharge paradigm for ENSO. Part I: Conceptual model. *Journal of the Atmospheric Sciences*, 54(7), 811–829. [doi:10.1175/1520-0469(1997)054<0811:AEORPF>2.0.CO;2](https://doi.org/10.1175/1520-0469(1997)054%3C0811:AEORPF%3E2.0.CO;2).

Part II of that paper derives the same two-equation system from a stripped-down coupled model. This app integrates the Part I form: equations (2.6), (3.1), and (3.4). With the later sliders at zero, the Ekman feedback is omitted, as Jin does after (2.6).

What the citation list actually looks like, and what of it is in the app:

- Jin (1997) Part I is his most cited paper as sole author, about 1,600–1,800 citations. It is the default.
- Kug, Jin, and An (2009), *Journal of Climate*, 22, 1499–1515, [doi:10.1175/2008JCLI2624.1](https://doi.org/10.1175/2008JCLI2624.1), is among his most cited, about 1,400 citations. It separates cold-tongue El Niño (thermocline feedback) from warm-pool El Niño (zonal advection). The zonal term itself is Jin and An (1999), *Geophysical Research Letters*, 26, 2989–2992, [doi:10.1029/1999GL002297](https://doi.org/10.1029/1999GL002297). The Warm-pool preset raises that term above the thermocline feedback and paints the anomaly farther west. Their further result, that a warm-pool event discharges heat too weakly to bring on La Niña, is a statement about the wind pattern. These two equations do not add that spatial discharge.
- Jin, Kim, and Bejarano (2006), *Geophysical Research Letters*, 33, L23708, [doi:10.1029/2006GL027221](https://doi.org/10.1029/2006GL027221), define the Bjerknes stability index as the growth rate σ and split it into damping, thermocline feedback, zonal advection, and Ekman feedback. The index is on the equations card. The Ekman slider is the term Jin set to zero in 1997.
- An and Jin (2004), *Journal of Climate*, 17, 2399–2412, [doi:10.1175/1520-0442(2004)017<2399:NAAOE>2.0.CO;2](https://doi.org/10.1175/1520-0442(2004)017%3C2399:NAAOE%3E2.0.CO;2), about 500 citations, show nonlinear dynamical heating that warms the east in both phases, so El Niño outgrows La Niña. The 1997 cubic is an odd function and cannot do that. The ν slider is ν T², a schematic of the forcing they add to equation (2.6). They diagnose the heating from a heat budget. They do not publish ν T² as a closed formula.
- The papers with still higher citation counts — Cai and others (2014) on more frequent extreme El Niño, Yeh and others (2009), Collins and others (2010), Timmermann and others (2018) — are projections and reviews. Jin is a coauthor. They do not change these two equations, so they are not integrated.

There is no seasonal cycle.

Charts use [Plotly](https://github.com/plotly/plotly.js) (MIT). The Pacific view is a [Three.js](https://github.com/mrdoob/three.js) globe (MIT) on NASA’s Blue Marble photograph. Drag it, pinch to zoom, or use Pacific / Equator / Whole Earth. The color on the water is still only the model’s \(T_E\) and \(h_W\). When the zonal advective feedback is the larger one, that temperature is drawn farther west, which is the warm-pool pattern in Kug, Jin, and An (2009). It is not a second ocean model. The equatorial cross-section below the globe is the same two numbers as a slice.

## Run it

The interface is a React app (Vite, Tailwind, shadcn components) in a light Vercel palette: Geist, white cards, black buttons. Jin’s equations stay in `js/model.js` and are not part of the UI code.

```bash
npm install
npm run dev
```

Open the address Vite prints. For the built site, the same one a host will serve:

```bash
npm run build
python3 serve.py
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). `serve.py` serves the `dist` folder and listens on all interfaces, so a phone on the same network can open `http://<this-computer>:8080`.

## Put it on a URL

**Vercel** detects Vite. The repository is public; Vercel also works if it is private.

1. Open [vercel.com/new](https://vercel.com/new) and import `amrutha97/el-nino`.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist`. Leave that as the default if Vercel fills it in.
3. Production branch: `main`.
4. Deploy. That `*.vercel.app` address stays put and updates on every push to `main`.

**GitHub Pages** is [https://amrutha97.github.io/el-nino/](https://amrutha97.github.io/el-nino/). The repository source is GitHub Actions. `.github/workflows/pages.yml` builds `dist` on every push to `main` and publishes it. The repository is public, which the free plan requires. Vercel does not.

Check the equations without the browser:

```bash
node --test test/model.test.js
```

## Install on iPhone or iPad

The page is a progressive web app: standalone display, a home-screen icon, safe areas for the notch and the home indicator, and touch controls that do not depend on hover. It works in portrait and landscape, including iPhone widths and iPad mini widths.

1. Open the page in Safari. On the phone itself, that has to be an address the phone can reach. `127.0.0.1` on your computer is not the phone.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open **Recharge** from the home screen. It launches without the Safari toolbar.

iOS only lets the offline cache (the service worker) install from a secure address: localhost on that device, or https. Add to Home Screen still works over plain http on your local network; the app then needs the network the first time it opens. A computer can install it from Chrome or Edge at `http://127.0.0.1:8080` with the install icon in the address bar.

Play, pause, and reset stay on the bottom edge. Drag the dot on the phase portrait to set the start, or use the initial-state sliders. The presets — neutral, growing El Niño, warm-pool El Niño, asymmetric ENSO, La Niña, and strong recharge — replace both the coefficients and the starting point.
