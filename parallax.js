const root = document.documentElement;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let neutral = null;
let target = { x: 0, y: 0 };
let current = { x: 0, y: 0 };

function setParallax(x, y) {
  target.x = clamp(x, -1, 1);
  target.y = clamp(y, -1, 1);
}

function render() {
  current.x += (target.x - current.x) * 0.08;
  current.y += (target.y - current.y) * 0.08;
  root.style.setProperty('--parallax-x', `${(current.x * 18).toFixed(2)}px`);
  root.style.setProperty('--parallax-y', `${(current.y * 11).toFixed(2)}px`);
  root.style.setProperty('--parallax-cloud-x', `${(current.x * 9).toFixed(2)}px`);
  root.style.setProperty('--parallax-cloud-y', `${(current.y * 5).toFixed(2)}px`);
  root.style.setProperty('--parallax-foreground-x', `${(current.x * -26).toFixed(2)}px`);
  requestAnimationFrame(render);
}

window.addEventListener('deviceorientation', event => {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  const x = Math.sin(event.gamma * Math.PI / 180);
  const y = Math.sin((event.beta - 45) * Math.PI / 180);
  if (!neutral) neutral = { x, y };
  setParallax((x - neutral.x) * 2.4, (y - neutral.y) * 1.8);
});

window.addEventListener('pointermove', event => {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  setParallax((event.clientX / innerWidth - .5) * 2, (event.clientY / innerHeight - .5) * 2);
});
window.addEventListener('blur', () => { neutral = null; setParallax(0, 0); });
window.addEventListener('orientationchange', () => { neutral = null; setParallax(0, 0); });
requestAnimationFrame(render);
