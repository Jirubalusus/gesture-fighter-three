import * as THREE from 'three';
import './styles.css';
import { recognizeGesture } from './gestureRecognizer.js';

const canvas = document.querySelector('#game');
const trailCanvas = document.querySelector('#gestureTrail');
const trailCtx = trailCanvas.getContext('2d');
const hpPlayerEl = document.querySelector('#playerHp');
const hpEnemyEl = document.querySelector('#enemyHp');
const gestureName = document.querySelector('#gestureName');
const gestureMeta = document.querySelector('#gestureMeta');
const debugText = document.querySelector('#debugText');
const toast = document.querySelector('#toast');
const resetBtn = document.querySelector('#resetBtn');

const state = {
  playerHp: 100,
  enemyHp: 100,
  playerX: -3.2,
  enemyX: 3.2,
  shieldUntil: 0,
  enemyCooldown: 1.2,
  projectiles: [],
  impacts: [],
  points: [],
  drawing: false,
  lastActionAt: 0,
  gameOver: false,
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061018);
scene.fog = new THREE.Fog(0x061018, 8, 18);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 4.3, 9.2);
camera.lookAt(0, 1.05, 0);

const hemi = new THREE.HemisphereLight(0x88ffcc, 0x05070d, 1.6);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-3, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight);
const rim = new THREE.PointLight(0x22ff99, 2.2, 10);
rim.position.set(0, 2.5, -2.4);
scene.add(rim);

function mat(color, emissive = 0x000000, intensity = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08, emissive, emissiveIntensity: intensity });
}

const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.14, 4.2), mat(0x102134, 0x061018, 0.2));
floor.position.y = -0.08;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(10, 18, 0x29f1a1, 0x1b5264);
grid.position.y = 0.01;
scene.add(grid);
for (let i = -5; i <= 5; i++) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 4.4), mat(0x1ce59b, 0x1ce59b, 0.55));
  line.position.set(i, 0.04, 0);
  line.material.transparent = true;
  line.material.opacity = i === 0 ? 0.42 : 0.13;
  scene.add(line);
}

function makeFighter(color, accent, side = 1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.08, 8, 18), mat(color, accent, 0.18));
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), mat(0xf2cfa8, accent, 0.05));
  head.position.y = 1.92;
  head.castShadow = true;
  group.add(head);
  const armGeo = new THREE.CapsuleGeometry(0.095, 0.72, 6, 10);
  const leftArm = new THREE.Mesh(armGeo, mat(color, accent, 0.12));
  leftArm.position.set(-0.42 * side, 1.24, 0.04);
  leftArm.rotation.z = 0.7 * side;
  leftArm.castShadow = true;
  group.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.42 * side;
  rightArm.rotation.z = -0.95 * side;
  group.add(rightArm);
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.78, 6, 10);
  const l1 = new THREE.Mesh(legGeo, mat(0x111827, accent, 0.08));
  l1.position.set(-0.18, 0.42, 0);
  l1.castShadow = true;
  group.add(l1);
  const l2 = l1.clone(); l2.position.x = 0.18; group.add(l2);
  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.025, 8, 72), mat(accent, accent, 1));
  aura.position.y = 0.72;
  aura.rotation.x = Math.PI / 2;
  aura.material.transparent = true;
  aura.material.opacity = 0;
  group.add(aura);
  group.userData = { body, aura, baseY: 0 };
  return group;
}

const player = makeFighter(0x246bff, 0x22f3ff, 1);
const enemy = makeFighter(0xff365f, 0xffb020, -1);
player.position.x = state.playerX;
enemy.position.x = state.enemyX;
scene.add(player, enemy);

function makeProjectile(x, y, dir, owner = 'player') {
  const color = owner === 'player' ? 0x41f6ff : 0xff9f1c;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), mat(color, color, 1.8));
  mesh.position.set(x, y, 0);
  mesh.castShadow = true;
  scene.add(mesh);
  const light = new THREE.PointLight(color, 2.2, 3.5);
  mesh.add(light);
  const speed = owner === 'player' ? 5.9 : 3.9;
  state.projectiles.push({ mesh, dir: { x: dir.x, y: -dir.y * 0.35 }, owner, speed, life: 2.4 });
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 900);
}

function resetGame() {
  state.playerHp = 100; state.enemyHp = 100; state.gameOver = false;
  for (const p of state.projectiles) scene.remove(p.mesh);
  state.projectiles = []; state.impacts = [];
  player.position.x = state.playerX; enemy.position.x = state.enemyX;
  showToast('Combate reiniciado');
}
resetBtn.addEventListener('click', resetGame);

function actionFromGesture(result) {
  const now = performance.now();
  if (state.gameOver) return;
  if (now - state.lastActionAt < 260) return;
  state.lastActionAt = now;
  if (result.type === 'hadoken') {
    const dir = result.direction.strength > 10 ? result.direction : { x: 1, y: 0, label: 'derecha' };
    makeProjectile(player.position.x + 0.55, 1.25, dir, 'player');
    punch(player, 0.18);
    showToast('HADOKEN · ' + Math.round(result.confidence * 100) + '%');
  } else if (result.type === 'shield') {
    state.shieldUntil = now + 1700;
    showToast('ESCUDO ACTIVADO');
  } else if (result.type === 'swipe') {
    const d = result.direction.label;
    if (d === 'derecha') player.position.x = Math.min(1.8, player.position.x + 0.7);
    if (d === 'izquierda') player.position.x = Math.max(-4.4, player.position.x - 0.7);
    if (d === 'arriba') { punch(player, 0.42); damageEnemy(7); showToast('UPPERCUT'); }
    if (d === 'abajo') { punch(player, -0.18); showToast('ESQUIVA BAJA'); }
  } else {
    showToast('Gesto no claro: prueba un 3 más grande');
  }
}

function punch(group, amount) {
  group.userData.punch = 0.22;
  group.userData.punchAmount = amount;
}

function damageEnemy(amount) {
  state.enemyHp = Math.max(0, state.enemyHp - amount);
  state.impacts.push({ x: enemy.position.x, y: 1.25, life: 0.45, color: 0x41f6ff });
  if (state.enemyHp <= 0) { state.gameOver = true; showToast('¡VICTORIA! Pulsa Reset'); }
}
function damagePlayer(amount) {
  if (performance.now() < state.shieldUntil) amount *= 0.25;
  state.playerHp = Math.max(0, state.playerHp - amount);
  state.impacts.push({ x: player.position.x, y: 1.25, life: 0.45, color: 0xff9f1c });
  if (state.playerHp <= 0) { state.gameOver = true; showToast('DERROTA · Pulsa Reset'); }
}

function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  trailCanvas.width = Math.floor(w * window.devicePixelRatio);
  trailCanvas.height = Math.floor(h * window.devicePixelRatio);
  trailCanvas.style.width = w + 'px'; trailCanvas.style.height = h + 'px';
  trailCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function drawTrail() {
  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  if (!state.points.length) return;
  trailCtx.lineCap = 'round'; trailCtx.lineJoin = 'round';
  trailCtx.shadowColor = '#31f6ff'; trailCtx.shadowBlur = 18;
  trailCtx.strokeStyle = 'rgba(54, 246, 255, .92)'; trailCtx.lineWidth = 7;
  trailCtx.beginPath();
  state.points.forEach((p, i) => { if (i === 0) trailCtx.moveTo(p.x, p.y); else trailCtx.lineTo(p.x, p.y); });
  trailCtx.stroke();
  const last = state.points[state.points.length - 1];
  trailCtx.fillStyle = '#ffffff';
  trailCtx.beginPath(); trailCtx.arc(last.x, last.y, 7, 0, Math.PI * 2); trailCtx.fill();
}

function pointerPoint(e) { return { x: e.clientX, y: e.clientY, t: performance.now() }; }
trailCanvas.addEventListener('pointerdown', (e) => {
  trailCanvas.setPointerCapture(e.pointerId);
  state.drawing = true; state.points = [pointerPoint(e)];
  gestureName.textContent = 'Leyendo gesto...';
  gestureMeta.textContent = 'Dibuja grande y termina con dirección clara';
  e.preventDefault();
});
trailCanvas.addEventListener('pointermove', (e) => {
  if (!state.drawing) return;
  const p = pointerPoint(e);
  const last = state.points[state.points.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 2) state.points.push(p);
  drawTrail();
  e.preventDefault();
});
function finishPointer(e) {
  if (!state.drawing) return;
  state.drawing = false;
  const result = recognizeGesture(state.points);
  gestureName.textContent = result.label;
  gestureMeta.textContent = `Confianza ${Math.round(result.confidence * 100)}% · dir ${result.direction.label}`;
  debugText.textContent = JSON.stringify({ type: result.type, confidence: +result.confidence.toFixed(2), direction: result.direction, debug: result.debug }, null, 2);
  actionFromGesture(result);
  setTimeout(() => { state.points = []; drawTrail(); }, 180);
  e.preventDefault();
}
trailCanvas.addEventListener('pointerup', finishPointer);
trailCanvas.addEventListener('pointercancel', finishPointer);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  const time = now / 1000;
  player.position.y = Math.sin(time * 5) * 0.025;
  enemy.position.y = Math.sin(time * 4.5 + 1) * 0.025;
  player.lookAt(enemy.position.x, 1, 0);
  enemy.lookAt(player.position.x, 1, 0);
  for (const f of [player, enemy]) {
    if (f.userData.punch > 0) {
      f.userData.punch -= dt;
      f.position.z = Math.sin(f.userData.punch * 30) * f.userData.punchAmount;
    } else f.position.z *= 0.8;
  }
  player.userData.aura.material.opacity = performance.now() < state.shieldUntil ? 0.86 + Math.sin(time * 18) * 0.12 : 0;
  player.userData.aura.rotation.z += dt * 3.5;

  if (!state.gameOver) {
    state.enemyCooldown -= dt;
    enemy.position.x += Math.sin(time * 0.9) * dt * 0.22;
    enemy.position.x = Math.max(1.8, Math.min(4.0, enemy.position.x));
    if (state.enemyCooldown <= 0) {
      state.enemyCooldown = 1.8 + Math.random() * 1.4;
      makeProjectile(enemy.position.x - 0.55, 1.18, { x: -1, y: 0 }, 'enemy');
      punch(enemy, -0.14);
    }
  }

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life -= dt;
    p.mesh.position.x += p.dir.x * p.speed * dt;
    p.mesh.position.y += p.dir.y * p.speed * dt;
    p.mesh.scale.setScalar(1 + Math.sin(time * 20) * 0.12);
    const target = p.owner === 'player' ? enemy : player;
    if (Math.abs(p.mesh.position.x - target.position.x) < 0.48 && Math.abs(p.mesh.position.y - 1.15) < 0.7) {
      if (p.owner === 'player') damageEnemy(13); else damagePlayer(8);
      scene.remove(p.mesh); state.projectiles.splice(i, 1); continue;
    }
    if (p.life <= 0 || Math.abs(p.mesh.position.x) > 7 || p.mesh.position.y < 0.3 || p.mesh.position.y > 3.2) {
      scene.remove(p.mesh); state.projectiles.splice(i, 1);
    }
  }
  for (let i = state.impacts.length - 1; i >= 0; i--) {
    const im = state.impacts[i]; im.life -= dt;
    if (!im.mesh) {
      im.mesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 48), mat(im.color, im.color, 1.2));
      im.mesh.position.set(im.x, im.y, 0.05); scene.add(im.mesh);
    }
    im.mesh.scale.setScalar(1 + (0.45 - im.life) * 3.2);
    im.mesh.material.opacity = Math.max(0, im.life * 2.2); im.mesh.material.transparent = true;
    if (im.life <= 0) { scene.remove(im.mesh); state.impacts.splice(i, 1); }
  }

  hpPlayerEl.style.width = state.playerHp + '%';
  hpEnemyEl.style.width = state.enemyHp + '%';
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
