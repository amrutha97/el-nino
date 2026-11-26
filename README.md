# El Niño recharge oscillator

A playable version of Fei-Fei Jin’s recharge oscillator: the two-equation picture of El Niño in which the eastern Pacific warms, the wind discharges equatorial heat, and that discharge swings the Pacific into La Niña.

The repository started as a README with only the title. The model implemented here is Jin’s 1997 conceptual oscillator, not a later extension.

Jin, F.-F. (1997). An equatorial ocean recharge paradigm for ENSO. Part I: Conceptual model. *Journal of the Atmospheric Sciences*, 54(7), 811–829. [doi:10.1175/1520-0469(1997)054<0811:AEORPF>2.0.CO;2](https://doi.org/10.1175/1520-0469(1997)054%3C0811:AEORPF%3E2.0.CO;2).

Part II of that paper derives the same two-equation system from a stripped-down coupled model. This app integrates the Part I form: equations (2.6), (3.1), and (3.4). The small Ekman feedback is omitted, as Jin does after (2.6). There is no seasonal cycle and no extra warm–cold asymmetry beyond his cubic thermocline term.

Charts use [Plotly](https://github.com/plotly/plotly.js) (MIT), vendored as `vendor/plotly-basic.min.js`. The Pacific view is a [Three.js](https://github.com/mrdoob/three.js) globe (MIT) on NASA’s Blue Marble photograph. Drag it, pinch to zoom, or use Pacific / Equator / Whole Earth. The color on the water is still only Jin’s \(T_E\) and \(h_W\), drawn where those anomalies live. It is not a second ocean model. The equatorial cross-section below the globe is the same two numbers as a slice.

## Run it

From this folder:

```bash
python3 serve.py
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

`serve.py` is the one command to use. It serves the page with the manifest content type a browser needs in order to install the app. The server listens on all interfaces, so a phone on the same network can open `http://<this-computer>:8080`.

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

Play, pause, and reset stay on the bottom edge. Drag the dot on the phase portrait to set the start, or use the initial-state sliders. The four presets — neutral, growing El Niño, La Niña, and strong recharge — replace both the coefficients and the starting point.
