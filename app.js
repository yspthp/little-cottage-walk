import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = selector => document.querySelector(selector);
const status = text => { $('#status').textContent = text; };
const clamp = THREE.MathUtils.clamp;
const MODEL_URL = 'https://huggingface.co/yspthp/lavender/resolve/main/Meshy_AI_Lavender_Parasol_Maid_0902202009_texture.glb?download=true';
// Shared painting coordinates: x right, y down, both in [0,1].
const GROUND = { left: .12, right: .88, far: .825, near: .962 };
const state = { x: .37, y: .90, vx: 0, vy: 0, phase: 0, heading: 0 };
const keys = new Set();
const pointers = new Map();
let enabled = false, neutral = null, latest = null, sensorTime = 0, sensorTimer;
let actor, ready = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
$('#viewport').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .01, 20);
camera.position.set(0, 0, 5);
scene.add(new THREE.HemisphereLight(0xfff3e4, 0x817481, 2.5));
const sun = new THREE.DirectionalLight(0xffe4c2, 3);
sun.position.set(-3, 5, 4);
scene.add(sun);
const root = new THREE.Group();
scene.add(root);

const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 64;
const ctx = shadowCanvas.getContext('2d');
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(66,49,51,0.35)');
gradient.addColorStop(1, 'rgba(66,49,51,0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
shadow.position.z = -.5;
scene.add(shadow);
shadow.visible = false;
new ResizeObserver(() => {
  const { width, height } = $('#viewport').getBoundingClientRect();
  renderer.setSize(width, height, false);
  const aspect = width / height;
  camera.left = -aspect / 2; camera.right = aspect / 2;
  camera.updateProjectionMatrix();
}).observe($('#viewport'));

new GLTFLoader().load(MODEL_URL, gltf => {
  actor = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(actor);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  // Keep the feet anchored to the same ground coordinate used by the shadow.
  actor.position.set(-center.x, -bounds.min.y, -center.z);
  const normalized = new THREE.Group();
  normalized.add(actor);
  normalized.scale.setScalar(1 / size.y);
  root.add(normalized);
  ready = true;
  shadow.visible = true;
  $('#loading').hidden = true;
  for (const id of ['motion', 'reset']) $(`#${id}`).disabled = false;
  status('女孩準備好了。開啟傾斜，或使用方向鍵／下方按鈕。');
}, event => {
  $('#progress').textContent = event.total
    ? `模型載入中 ${Math.round(event.loaded / event.total * 100)}%`
    : `已載入 ${(event.loaded / 1e6).toFixed(1)} MB / 約 118 MB`;
}, error => {
  console.error(error);
  $('#loading').textContent = '女孩未能載入。請確認 Hugging Face 檔案設為 Public，並檢查模型檔名是否完全一致。';
});

function orientationVector(event) {
  const beta = THREE.MathUtils.degToRad(event.beta);
  const gamma = THREE.MathUtils.degToRad(event.gamma);
  const angle = THREE.MathUtils.degToRad(screen.orientation?.angle ?? window.orientation ?? 0);
  // Project gravity onto the screen, accounting for landscape orientation.
  const x = Math.cos(beta) * Math.sin(gamma), y = Math.sin(beta);
  return { x: x * Math.cos(angle) + y * Math.sin(angle),
    y: -x * Math.sin(angle) + y * Math.cos(angle) };
}
window.addEventListener('deviceorientation', event => {
  if (!enabled || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  latest = orientationVector(event);
  sensorTime = performance.now();
  if (!neutral) {
    neutral = { ...latest };
    clearTimeout(sensorTimer);
    $('#calibrate').disabled = false;
    status('傾斜漫步已開啟。輕輕向左右或前後傾斜；回到校準姿勢即可停下。');
  }
});
function stopSensor() {
  enabled = false; neutral = null; latest = null;
  clearTimeout(sensorTimer);
  $('#calibrate').disabled = true;
  $('#motion').innerHTML = '開啟傾斜漫步 <span>↗</span>';
}
$('#motion').addEventListener('click', async () => {
  if (enabled) { stopSensor(); status('已切換為手動漫步。'); return; }
  if (!window.isSecureContext) { status('傾斜功能需要 HTTPS 安全網址。目前仍可用下方按鈕操作。'); return; }
  if (!window.DeviceOrientationEvent) { status('此裝置未提供傾斜感應器，請使用方向按鈕。'); return; }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') { status('未取得感應器權限，仍可用方向按鈕散步。'); return; }
    }
    enabled = true; neutral = null; latest = null;
    $('#motion').textContent = '關閉傾斜漫步';
    status('請以舒適的姿勢拿穩手機，正在等待感應器…');
    sensorTimer = setTimeout(() => {
      if (!neutral) { stopSensor(); status('未收到感應器資料，請檢查瀏覽器權限，或使用方向按鈕。'); }
    }, 5000);
  } catch (error) { stopSensor(); status('無法開啟感應器，請檢查權限，或使用方向按鈕。'); }
});
$('#calibrate').addEventListener('click', () => {
  if (latest) { neutral = { ...latest }; state.vx = state.vy = 0; status('已將現在的手機姿勢設為靜止位置。'); }
});
function clearInput() { keys.clear(); pointers.clear(); state.vx = state.vy = 0; }
function reorient() { clearInput(); neutral = latest = null; }
screen.orientation?.addEventListener('change', reorient);
window.addEventListener('orientationchange', reorient);
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { clearInput(); if (document.hidden) latest = neutral = null; });
$('#reset').addEventListener('click', () => {
  clearInput(); Object.assign(state, { x: .37, y: .90, phase: 0, heading: 0 });
  if (latest) neutral = { ...latest };
  status('已回到起點。');
});
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
window.addEventListener('keydown', event => {
  if (directions[event.key]) { event.preventDefault(); keys.add(event.key); }
});
window.addEventListener('keyup', event => keys.delete(event.key));
document.querySelectorAll('[data-x]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [Number(button.dataset.x), Number(button.dataset.y)]);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => pointers.delete(event.pointerId));
  }
});
const deadzone = value => Math.sign(value) * clamp((Math.abs(value) - .045) / .32, 0, 1);
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05);
  last = now;
  if (document.hidden || !ready) return;
  let x = 0, y = 0;
  if (enabled && neutral && latest && now - sensorTime < 1000) {
    x = deadzone(latest.x - neutral.x); y = deadzone(latest.y - neutral.y);
  }
  if (keys.size || pointers.size) {
    x = y = 0;
    for (const key of keys) { x += directions[key][0]; y += directions[key][1]; }
    for (const vector of pointers.values()) { x += vector[0]; y += vector[1]; }
  }
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  const smoothing = 1 - Math.exp(-12 * dt);
  state.vx += (x * .16 - state.vx) * smoothing;
  state.vy += (y * .075 - state.vy) * smoothing;
  const oldX = state.x, oldY = state.y;
  state.x = clamp(state.x + state.vx * dt, GROUND.left, GROUND.right);
  state.y = clamp(state.y + state.vy * dt, GROUND.far, GROUND.near);
  const dx = state.x - oldX, dy = state.y - oldY;
  const distance = Math.hypot(dx, dy);
  const moving = distance > .00001;
  if (moving) {
    const target = Math.atan2(dx, dy);
    const difference = Math.atan2(Math.sin(target - state.heading), Math.cos(target - state.heading));
    state.heading += difference * (1 - Math.exp(-10 * dt));
    state.phase = (state.phase + distance * 170) % (Math.PI * 2);
  }
  const depth = (state.y - GROUND.far) / (GROUND.near - GROUND.far);
  const scale = .17 + depth * .045;
  const bob = !reducedMotion.matches && moving ? Math.abs(Math.sin(state.phase)) * .003 : 0;
  const aspect = camera.right - camera.left;
  root.position.set((state.x - .5) * aspect, .5 - state.y + bob, 0);
  root.scale.setScalar(scale);
  root.rotation.set(0, state.heading, !reducedMotion.matches && moving ? Math.sin(state.phase) * .018 : 0);
  shadow.position.set((state.x - .5) * aspect, .5 - state.y, -.5);
  shadow.scale.set(scale * .48, scale * .095, 1);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
