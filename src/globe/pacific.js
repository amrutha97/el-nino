/**
 * Geographic view of Jin's two numbers on a NASA Blue Marble Earth.
 * The color and the thermocline ribbon are a display of T_E, h_W, and
 * h_E = h_W + b T_E. They are not an extra ocean model.
 *
 * Earth image: NASA Blue Marble (public domain), equirectangular.
 */

import * as THREE from "three";

const VIEWS = {
  pacific: { lat: 6, lon: -150, dist: 2.05 },
  equator: { lat: 22, lon: -145, dist: 1.48 },
  globe: { lat: 10, lon: -155, dist: 3.15 },
};

const WIND_LONS = [152, 168, 184, 200, 216];
const FLUX_LONS = [176, 196, 216];

export async function mountPacific(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0x02060c, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);

  const loader = new THREE.TextureLoader();
  const earthTex = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/earth.jpg`);
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.MeshPhongMaterial({
      map: earthTex,
      specular: new THREE.Color(0x163044),
      shininess: 10,
    }),
  );
  scene.add(earth);
  scene.add(createStars());

  const paint = createAnomalyPainter();
  const anomaly = new THREE.Mesh(
    new THREE.SphereGeometry(1.006, 96, 64),
    new THREE.MeshBasicMaterial({
      map: paint.texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(anomaly);

  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 40), atmosphereMaterial());
  scene.add(atmosphere);

  const ribbon = createRibbon();
  scene.add(ribbon.mesh);

  const windMat = new THREE.MeshBasicMaterial({ color: 0xf4e2c0 });
  const fluxMat = new THREE.MeshBasicMaterial({ color: 0x8eb6ff });
  const winds = WIND_LONS.map(() => makeArrow(windMat));
  const fluxes = [];
  for (const lon of FLUX_LONS) {
    fluxes.push({ lat: 8, lon: lon > 180 ? lon - 360 : lon, arrow: makeArrow(fluxMat) });
    fluxes.push({ lat: -8, lon: lon > 180 ? lon - 360 : lon, arrow: makeArrow(fluxMat) });
  }
  for (const arrow of winds) scene.add(arrow);
  for (const item of fluxes) scene.add(item.arrow);

  scene.add(new THREE.AmbientLight(0xc5d4ea, 0.85));
  const sun = new THREE.DirectionalLight(0xfff4e4, 1.35);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6ea0ff, 0.28);
  scene.add(fill);

  const view = { ...VIEWS.pacific };
  const target = { ...VIEWS.pacific };
  let frame = 0;
  let running = true;
  let paintedAt = 0;
  let paintedT = null;
  let paintedH = null;

  function applyCamera() {
    const pos = latLon(view.lat, view.lon, view.dist);
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    sun.position.copy(latLon(view.lat + 18, view.lon - 30, 4));
    fill.position.copy(latLon(view.lat - 10, view.lon + 50, 3));
  }

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
    }
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function render() {
    if (!running) return;
    frame = requestAnimationFrame(render);
    view.lat += (target.lat - view.lat) * 0.12;
    let dLon = target.lon - view.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    view.lon += dLon * 0.12;
    view.dist += (target.dist - view.dist) * 0.12;
    applyCamera();
    placeLabels();
    renderer.render(scene, camera);
  }

  const stage = canvas.parentElement;
  const labels = {
    pool: stage.querySelector("[data-pin='pool']"),
    tongue: stage.querySelector("[data-pin='tongue']"),
  };
  const look = new THREE.Vector3();

  function placeLabels() {
    pin(labels.pool, 2, 155);
    pin(labels.tongue, -2, -115);
  }

  function pin(el, lat, lon) {
    if (!el) return;
    const pos = latLon(lat, lon, 1.02);
    const toPoint = pos.clone().sub(camera.position);
    camera.getWorldDirection(look);
    if (toPoint.dot(look) < 0.15) {
      el.hidden = true;
      return;
    }
    const projected = pos.clone().project(camera);
    el.hidden = false;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const x = Math.min(width - 78, Math.max(78, (projected.x * 0.5 + 0.5) * width));
    const y = Math.min(height - 28, Math.max(16, (-projected.y * 0.5 + 0.5) * height));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function update({ tCelsius, hWest, hEast }) {
    const now = performance.now();
    const moved = paintedT === null || Math.abs(tCelsius - paintedT) > 0.04 || Math.abs(hWest - paintedH) > 0.8;
    if (moved || now - paintedAt > 90) {
      paint.draw(tCelsius, hWest);
      paintedAt = now;
      paintedT = tCelsius;
      paintedH = hWest;
    }
    ribbon.update(hWest, hEast);
    const windEast = tCelsius >= 0;
    const windScale = Math.max(0.35, Math.min(1.35, 0.4 + Math.abs(tCelsius) / 2.2));
    winds.forEach((arrow, index) => {
      const lon = WIND_LONS[index] > 180 ? WIND_LONS[index] - 360 : WIND_LONS[index];
      aim(arrow, 0, lon, windEast ? eastVector(0, lon) : eastVector(0, lon).multiplyScalar(-1), windScale);
      arrow.visible = Math.abs(tCelsius) > 0.08;
    });
    const poleward = tCelsius >= 0;
    for (const item of fluxes) {
      const north = item.lat > 0;
      const towardPole = north ? northVector(item.lat, item.lon) : northVector(item.lat, item.lon).multiplyScalar(-1);
      const towardEquator = towardPole.clone().multiplyScalar(-1);
      aim(item.arrow, item.lat, item.lon, poleward ? towardPole : towardEquator, 0.7);
      item.arrow.visible = Math.abs(tCelsius) > 0.08;
    }
    const caption = document.getElementById("globe-caption");
    if (caption) {
      const wind = Math.abs(tCelsius) < 0.08
        ? "Winds are near normal."
        : tCelsius > 0
          ? "Pale arrows are the westerly anomaly, blowing toward the Americas."
          : "Pale arrows are the stronger trades, blowing back toward the warm pool.";
      const flux = Math.abs(tCelsius) < 0.08
        ? ""
        : tCelsius > 0
          ? " Blue arrows leave the equator: the warm east is discharging heat."
          : " Blue arrows return to the equator: the cold east is recharging heat.";
      caption.textContent =
        `The photograph is NASA’s Blue Marble. Coral or teal on the water is Jin’s one eastern temperature, ${signed(tCelsius)} °C, drawn only over the central and eastern equatorial Pacific. Gold or blue in the west is the warm-pool heat, h_W = ${signed(hWest, 0)} m. The ribbon is the thermocline from that west value to h_E = ${signed(hEast, 0)} m in the east: gold is deeper, blue is shallower. ${wind}${flux}`;
    }
  }

  bindOrbit(canvas, target);
  for (const button of document.querySelectorAll("[data-globe-view]")) {
    button.addEventListener("click", () => {
      const next = VIEWS[button.dataset.globeView];
      if (!next) return;
      target.lat = next.lat;
      target.lon = next.lon;
      target.dist = next.dist;
      for (const other of document.querySelectorAll("[data-globe-view]")) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      }
    });
  }
  document.querySelector("[data-globe-view='pacific']")?.setAttribute("aria-pressed", "true");

  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  resize();
  applyCamera();
  requestAnimationFrame(render);

  return {
    update,
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
    },
  };
}

function createAnomalyPainter() {
  const canvas = document.createElement("canvas");
  const width = 720;
  const height = 360;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.createImageData(width, height);
  const lats = new Float32Array(height);
  const lons = new Float32Array(width);
  for (let y = 0; y < height; y += 1) lats[y] = 90 - ((y + 0.5) / height) * 180;
  for (let x = 0; x < width; x += 1) lons[x] = -180 + ((x + 0.5) / width) * 360;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {
    texture,
    draw(tCelsius, hWest) {
      const data = image.data;
      data.fill(0);
      for (let y = 0; y < height; y += 1) {
        const lat = lats[y];
        if (Math.abs(lat) > 26) continue;
        for (let x = 0; x < width; x += 1) {
          const lon = lons[x];
          const x360 = lon < 0 ? lon + 360 : lon;
          const i = (y * width + x) * 4;
          const sst = sstPatch(lat, x360, tCelsius);
          const heat = heatPatch(lat, x360, hWest);
          if (sst === 0 && heat === 0) continue;
          if (Math.abs(sst) >= Math.abs(heat)) {
            const mag = Math.min(1, Math.abs(sst) / 2.4);
            if (sst > 0) {
              data[i] = 255;
              data[i + 1] = Math.round(70 + 90 * (1 - mag));
              data[i + 2] = 48;
            } else {
              data[i] = 28;
              data[i + 1] = 150;
              data[i + 2] = 214;
            }
            data[i + 3] = Math.round(18 + 105 * mag);
          } else {
            const mag = Math.min(1, Math.abs(heat) / 45);
            if (heat > 0) {
              data[i] = 232;
              data[i + 1] = 168;
              data[i + 2] = 64;
            } else {
              data[i] = 90;
              data[i + 1] = 130;
              data[i + 2] = 210;
            }
            data[i + 3] = Math.round(16 + 80 * mag);
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      texture.needsUpdate = true;
    },
  };
}

/** T_E spread over the central and eastern equatorial Pacific only. */
function sstPatch(lat, lon360, tCelsius) {
  if (lon360 < 175 || lon360 > 282 || Math.abs(lat) > 18) return 0;
  const latWeight = Math.exp(-(lat * lat) / (2 * 5.2 * 5.2));
  const zonal = Math.exp(-((lon360 - 235) ** 2) / (2 * 16 * 16));
  const fade = smoothstep(lon360, 175, 198)
    * smoothstep(282 - lon360, 0, 12)
    * smoothstep(18 - Math.abs(lat), 0, 5);
  return tCelsius * latWeight * zonal * fade;
}

/** h_W shown on the western equatorial Pacific, the warm-pool side of the model. */
function heatPatch(lat, lon360, hWest) {
  if (lon360 < 128 || lon360 > 188 || Math.abs(lat) > 14) return 0;
  const latWeight = Math.exp(-(lat * lat) / (2 * 4 * 4));
  const zonal = Math.exp(-((lon360 - 152) ** 2) / (2 * 11 * 11));
  const fade = smoothstep(lon360, 128, 145)
    * smoothstep(188 - lon360, 0, 14)
    * smoothstep(14 - Math.abs(lat), 0, 5);
  return hWest * latWeight * zonal * fade;
}

function smoothstep(x, edge0, edge1) {
  if (x <= edge0) return 0;
  if (x >= edge1) return 1;
  const t = (x - edge0) / (edge1 - edge0);
  return t * t * (3 - 2 * t);
}

function createRibbon() {
  const columns = 56;
  const positions = new Float32Array(columns * 2 * 3);
  const colors = new Float32Array(columns * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  const indices = [];
  for (let i = 0; i < columns - 1; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  return {
    mesh,
    update(hWest, hEast) {
      for (let i = 0; i < columns; i += 1) {
        const f = i / (columns - 1);
        const lon360 = 140 + f * (270 - 140);
        const lon = lon360 > 180 ? lon360 - 360 : lon360;
        const depth = hWest + (hEast - hWest) * f;
        const clamped = Math.max(-55, Math.min(55, depth));
        const radius = 1.018 - Math.max(0, clamped) / 55 * 0.012;
        const top = latLon(1.15, lon, radius);
        const bot = latLon(-1.15, lon, radius);
        const mag = Math.min(1, Math.abs(clamped) / 40);
        const deep = clamped >= 0;
        const tint = deep ? [0.95, 0.62, 0.18] : [0.28, 0.55, 0.95];
        const red = 0.82 * (1 - mag) + tint[0] * mag;
        const green = 0.86 * (1 - mag) + tint[1] * mag;
        const blue = 0.78 * (1 - mag) + tint[2] * mag;
        for (const [slot, point] of [[i * 2, top], [i * 2 + 1, bot]]) {
          positions[slot * 3] = point.x;
          positions[slot * 3 + 1] = point.y;
          positions[slot * 3 + 2] = point.z;
          colors[slot * 3] = red;
          colors[slot * 3 + 1] = green;
          colors[slot * 3 + 2] = blue;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
  };
}

function makeArrow(material) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.055, 7), material);
  shaft.position.y = 0.028;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.026, 8), material);
  head.position.y = 0.066;
  group.add(shaft, head);
  return group;
}

const yAxis = new THREE.Vector3(0, 1, 0);

function aim(arrow, lat, lon, direction, scale) {
  const pos = latLon(lat, lon, 1.018);
  arrow.position.copy(pos);
  arrow.quaternion.setFromUnitVectors(yAxis, direction.clone().normalize());
  arrow.scale.setScalar(scale);
}

function eastVector(lat, lon) {
  return latLon(lat, lon + 0.8, 1).sub(latLon(lat, lon, 1)).normalize();
}

function northVector(lat, lon) {
  return latLon(lat + 0.8, lon, 1).sub(latLon(lat, lon, 1)).normalize();
}

function latLon(lat, lon, radius) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    -radius * Math.cos(theta) * sinPhi,
    radius * Math.cos(phi),
    radius * Math.sin(theta) * sinPhi,
  );
}

function createStars() {
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const lat = Math.asin(2 * Math.random() - 1) * (180 / Math.PI);
    const lon = Math.random() * 360 - 180;
    const point = latLon(lat, lon, 7.5 + Math.random() * 2.5);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xe7eefc, size: 0.018, sizeAttenuation: true }),
  );
}

function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(0x7eb6ff) } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 color;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
        gl_FragColor = vec4(color, rim * 0.85);
      }
    `,
  });
}

function bindOrbit(canvas, target) {
  const pointers = new Map();
  let pinch = null;

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch = null;
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      target.lon -= (event.clientX - previous.x) * 0.22;
      target.lat = clamp(target.lat + (event.clientY - previous.y) * 0.16, -62, 62);
    } else if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch) target.dist = clamp(target.dist * (pinch / dist), 1.28, 4.2);
      pinch = dist;
    }
    event.preventDefault();
  });
  const end = (event) => {
    pointers.delete(event.pointerId);
    pinch = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1.08 : 0.92;
    target.dist = clamp(target.dist * direction, 1.28, 4.2);
  }, { passive: false });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signed(value, digits = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + Math.abs(value).toFixed(digits);
}
