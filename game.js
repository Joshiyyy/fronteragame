// Zeigt eventuelle Fehler direkt auf dem Bildschirm an
window.addEventListener("error", (event) => {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;bottom:1rem;left:1rem;right:1rem;background:#7f1d1d;color:#fff;padding:1rem;border-radius:8px;font-family:monospace;z-index:9999;";
  box.textContent = "Fehler im Spiel: " + event.message;
  document.body.appendChild(box);
});

if (typeof THREE === "undefined") {
  throw new Error("Three.js konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
}

const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const gameOverScreen = document.getElementById("game-over");
const restartBtn = document.getElementById("restart-btn");

// 1. 3D-Szene, Kamera und Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
scene.fog = new THREE.Fog(0x0f172a, 24, 80);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  120
);
camera.position.set(0, 4.5, 8.5);
camera.lookAt(0, 0.5, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. Licht
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(6, 12, 8);
scene.add(dirLight);

// 3. Nahtlose Boden-Textur (kein Ruckeln)
function createFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111c33";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 60);
  return texture;
}

const floorTexture = createFloorTexture();
const floorGeo = new THREE.PlaneGeometry(28, 120);
const floorMat = new THREE.MeshStandardMaterial({
  map: floorTexture,
  roughness: 0.85,
  metalness: 0.1
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -40);
scene.add(floor);

// Leuchtende Seitenlinien
const railGeo = new THREE.BoxGeometry(0.14, 0.1, 120);
const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

const leftRail = new THREE.Mesh(railGeo, railMat);
leftRail.position.set(-4.95, 0.05, -40);
scene.add(leftRail);

const rightRail = new THREE.Mesh(railGeo, railMat);
rightRail.position.set(4.95, 0.05, -40);
scene.add(rightRail);

// 4. Spieler-Würfel
const playerGeo = new THREE.BoxGeometry(1, 1, 1);
const playerMat = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.3,
  metalness: 0.2
});
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.set(0, 0.5, 2);
scene.add(player);

let obstacles = [];
let coins = [];
let score = 0;
let speed = 18;
let spawnTimer = 0;
let isGameOver = false;

const keys = { left: false, right: false };

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space" && isGameOver) resetGame();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

restartBtn.addEventListener("click", resetGame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function spawnObject() {
  const randomX = (Math.random() - 0.5) * 8.5;

  if (Math.random() < 0.72) {
    const geo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(randomX, 0.65, -70);
    scene.add(mesh);
    obstacles.push(mesh);
  } else {
    const geo = new THREE.OctahedronGeometry(0.55);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(randomX, 0.75, -70);
    scene.add(mesh);
    coins.push(mesh);
  }
}

function triggerGameOver() {
  isGameOver = true;
  finalScoreEl.textContent = Math.floor(score);
  gameOverScreen.classList.remove("hidden");
}

function resetGame() {
  obstacles.forEach((obj) => scene.remove(obj));
  coins.forEach((coin) => scene.remove(coin));
  obstacles = [];
  coins = [];

  player.position.x = 0;
  player.rotation.z = 0;
  score = 0;
  speed = 18;
  spawnTimer = 0;
  isGameOver = false;

  scoreEl.textContent = "0";
  gameOverScreen.classList.add("hidden");
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (!isGameOver) {
    speed += dt * 0.45;
    score += dt * 5;
    scoreEl.textContent = Math.floor(score);

    floorTexture.offset.y += (speed * dt) / 2;

    const moveSpeed = 11;
    const tiltLerp = 1 - Math.exp(-14 * dt);

    if (keys.left) {
      player.position.x -= moveSpeed * dt;
      player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, 0.25, tiltLerp);
    } else if (keys.right) {
      player.position.x += moveSpeed * dt;
      player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -0.25, tiltLerp);
    } else {
      player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, 0, tiltLerp);
    }

    player.position.x = Math.max(-4.3, Math.min(4.3, player.position.x));

    spawnTimer += dt;
    if (spawnTimer > Math.max(0.28, 0.75 - speed * 0.012)) {
      spawnObject();
      spawnTimer = 0;
    }

    const playerBox = new THREE.Box3().setFromObject(player).expandByScalar(-0