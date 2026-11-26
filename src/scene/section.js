/**
 * Equatorial section. West holds the warm-water volume above the thermocline.
 * East is colored by T_E. Particles leave the equator in a warm phase
 * and return in a cold phase: the Sverdrup discharge and recharge.
 * Geometry is a drawing of h_W, h_E, and T_E, not another ocean model.
 */

import * as THREE from "three";

const WEST = -1.05;
const EAST = 1.05;

export function mountSection(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xf4f4f5, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
  camera.position.set(0.05, 0.72, 1.85);
  camera.lookAt(0, -0.12, 0);

  const sea = seaSurface();
  scene.add(sea.mesh);

  const thermo = thermoclineStrip();
  scene.add(thermo.mesh);

  const volume = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xe4b15a, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  scene.add(volume);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.86),
    new THREE.MeshBasicMaterial({ color: 0xe7e7ea }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.72;
  scene.add(floor);

  const particles = makeParticles();
  scene.add(particles.points);

  let running = true;
  let frame = 0;
  let last = performance.now();
  const state = { tCelsius: 0, hWest: 0, hEast: 0 };

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function render() {
    if (!running) return;
    frame = requestAnimationFrame(render);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    particles.tick(dt, state.tCelsius);
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas.parentElement || canvas);
  resize();
  requestAnimationFrame(render);

  return {
    update({ tCelsius, hWest, hEast }) {
      state.tCelsius = tCelsius;
      state.hWest = hWest;
      state.hEast = hEast;
      sea.paint(tCelsius);
      thermo.paint(hWest, hEast);
      const yWest = depthOf(hWest);
      const thickness = Math.max(0.04, -yWest);
      volume.scale.set(1, thickness, 0.52);
      volume.position.set(-0.52, yWest / 2, 0);
    },
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
    },
  };
}

function depthOf(meters) {
  const clamped = Math.max(-80, Math.min(80, meters));
  // +80 m (deep) sits near y = -0.62; -80 m (shoaled) stays just under the surface.
  return -0.35 - (clamped / 80) * 0.27;
}

function seaSurface() {
  const geometry = new THREE.PlaneGeometry(2.2, 0.7, 40, 1);
  geometry.rotateX(-Math.PI / 2);
  const count = geometry.attributes.position.count;
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true }),
  );
  mesh.position.y = 0.001;
  return {
    mesh,
    paint(tCelsius) {
      const colors = geometry.attributes.color;
      const position = geometry.attributes.position;
      const warm = tCelsius > 0 ? Math.min(1, tCelsius / 2.2) : 0;
      const cold = tCelsius < 0 ? Math.min(1, -tCelsius / 2.2) : 0;
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i);
        const east = Math.max(0, Math.min(1, (x - 0.05) / 0.9));
        const r = 0.78 + east * (0.86 * warm - 0.28 * cold);
        const g = 0.9 - east * (0.42 * warm + 0.12 * cold);
        const b = 0.88 - east * (0.28 * warm - 0.08 * cold);
        colors.setXYZ(i, r, g, b);
      }
      colors.needsUpdate = true;
    },
  };
}

function thermoclineStrip() {
  const columns = 48;
  const positions = new Float32Array(columns * 2 * 3);
  const colors = new Float32Array(columns * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const indices = [];
  for (let i = 0; i < columns - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  return {
    mesh,
    paint(hWest, hEast) {
      for (let i = 0; i < columns; i += 1) {
        const f = i / (columns - 1);
        const x = WEST + (EAST - WEST) * f;
        const meters = hWest + (hEast - hWest) * f;
        const y = depthOf(meters);
        const deep = Math.max(0, Math.min(1, (meters + 20) / 70));
        positions[i * 6] = x;
        positions[i * 6 + 1] = y;
        positions[i * 6 + 2] = -0.1;
        positions[i * 6 + 3] = x;
        positions[i * 6 + 4] = y;
        positions[i * 6 + 5] = 0.1;
        for (let k = 0; k < 2; k += 1) {
          const o = (i * 2 + k) * 3;
          colors[o] = 0.35 + deep * 0.55;
          colors[o + 1] = 0.38 + deep * 0.28;
          colors[o + 2] = 0.42 - deep * 0.2;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.computeBoundingSphere();
    },
  };
}

function makeParticles() {
  const count = 56;
  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    seeds.push({
      x: WEST + Math.random() * (EAST - WEST),
      z: (Math.random() - 0.5) * 0.55,
      lane: Math.random() < 0.5 ? 1 : -1,
    });
    positions[i * 3] = seeds[i].x;
    positions[i * 3 + 1] = -0.06;
    positions[i * 3 + 2] = seeds[i].z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0x3f3f46, size: 0.028, sizeAttenuation: true }),
  );
  return {
    points,
    tick(dt, tCelsius) {
      const speed = 0.15 + Math.min(0.55, Math.abs(tCelsius) * 0.22);
      const discharge = tCelsius >= 0;
      for (let i = 0; i < count; i += 1) {
        const seed = seeds[i];
        if (Math.abs(tCelsius) < 0.08) {
          seed.z *= 1 - dt * 0.4;
        } else if (discharge) {
          const away = seed.z === 0 ? seed.lane : Math.sign(seed.z);
          seed.z += away * speed * dt * 0.55;
          seed.x += speed * dt * 0.15;
          if (Math.abs(seed.z) > 0.34) {
            seed.z = seed.lane * 0.02;
            seed.x = WEST + Math.random() * 1.2;
          }
        } else {
          seed.z *= 1 - dt * speed * 1.4;
          seed.x -= speed * dt * 0.2;
          if (seed.x < WEST) seed.x = 0.2 + Math.random() * 0.7;
        }
        if (seed.x > EAST) seed.x = WEST + Math.random() * 0.4;
        positions[i * 3] = seed.x;
        positions[i * 3 + 2] = seed.z;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
