/**
 * Phase plane of the recharge oscillator.
 * x is h_W, y is T_E, both scaled into a square so the marker stays round.
 * The orbit is clockwise: positive h_W, then positive T_E, then discharge.
 */

import * as THREE from "three";

const HALF = 1.12;

export function mountCycle(canvas, onDrag) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xfafafa, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, -5, 5);
  camera.position.z = 2;

  scene.add(axes());
  const trailA = line(0x171717);
  const trailB = line(0xb45309);
  scene.add(trailA.object, trailB.object);

  const markerA = marker(0x171717);
  const markerB = marker(0xb45309);
  scene.add(markerA, markerB);

  let range = { x: [-45, 45], y: [-2.6, 2.6] };
  let dragging = false;
  let running = true;
  let frame = 0;

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    if (aspect >= 1) {
      camera.left = -HALF * aspect;
      camera.right = HALF * aspect;
      camera.top = HALF;
      camera.bottom = -HALF;
    } else {
      camera.left = -HALF;
      camera.right = HALF;
      camera.top = HALF / aspect;
      camera.bottom = -HALF / aspect;
    }
    camera.updateProjectionMatrix();
  }

  function toWorld(hMeters, tCelsius) {
    return new THREE.Vector3(
      hMeters / range.x[1],
      tCelsius / range.y[1],
      0,
    );
  }

  function fromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const worldX = (ndcX * (camera.right - camera.left)) / 2;
    const worldY = (ndcY * (camera.top - camera.bottom)) / 2;
    return {
      hMeters: worldX * range.x[1],
      tCelsius: worldY * range.y[1],
    };
  }

  function pointerDown(event) {
    dragging = true;
    canvas.setPointerCapture?.(event.pointerId);
    const point = fromEvent(event);
    onDrag(point.tCelsius, point.hMeters);
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!dragging) return;
    const point = fromEvent(event);
    onDrag(point.tCelsius, point.hMeters);
    event.preventDefault();
  }
  function pointerUp() {
    dragging = false;
  }

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);

  function render() {
    if (!running) return;
    frame = requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas.parentElement || canvas);
  resize();
  requestAnimationFrame(render);

  return {
    update({ range: nextRange, a, b }) {
      if (nextRange) range = nextRange;
      place(trailA, markerA, a?.h, a?.t, range);
      if (b) {
        trailB.object.visible = true;
        markerB.visible = true;
        place(trailB, markerB, b.h, b.t, range);
      } else {
        trailB.object.visible = false;
        markerB.visible = false;
      }
    },
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      renderer.dispose();
    },
  };
}

function place(trail, markerMesh, h, t, range) {
  const count = h ? Math.min(h.length, t.length) : 0;
  const positions = trail.positions;
  const limit = positions.length / 3;
  const start = Math.max(0, count - limit);
  let written = 0;
  for (let i = start; i < count; i += 1) {
    positions[written * 3] = h[i] / range.x[1];
    positions[written * 3 + 1] = t[i] / range.y[1];
    positions[written * 3 + 2] = 0;
    written += 1;
  }
  trail.geometry.setDrawRange(0, written);
  trail.geometry.attributes.position.needsUpdate = true;
  if (count > 0) {
    markerMesh.position.set(h[count - 1] / range.x[1], t[count - 1] / range.y[1], 0.01);
    markerMesh.visible = true;
  }
}

function line(color) {
  const positions = new Float32Array(2500 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const object = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color }),
  );
  return { object, positions, geometry };
}

function marker(color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 16),
    new THREE.MeshBasicMaterial({ color }),
  );
}

function axes() {
  const points = [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 1, 0),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xd4d4d8 }),
  );
}
