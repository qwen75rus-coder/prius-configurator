import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/controls/OrbitControls.js';

const viewer = document.getElementById('viewer');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('error');
const errorText = document.getElementById('errorText');
const colorName = document.getElementById('colorName');
const saveMessage = document.getElementById('saveMessage');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#273344');
scene.fog = new THREE.Fog('#273344', 18, 60);

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
camera.position.set(5, 2.5, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewer.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdceaff, 0x4a5260, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x9bcaff, 1.6);
fillLight.position.set(-6, 4, -4);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
rimLight.position.set(0, 5, -7);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: '#263241', roughness: 0.78, metalness: 0.08 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.03;
scene.add(floor);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0.8, 0);
controls.minDistance = 1.5;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

let carRoot = null;
let colorMaterials = [];
let initialCamera = { position: new THREE.Vector3(5, 2.5, 7), target: new THREE.Vector3(0, 0.8, 0) };
let modelCenter = new THREE.Vector3();
let modelSize = new THREE.Vector3();

function resize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
new ResizeObserver(resize).observe(viewer);
resize();

function showError(message) {
  loading.classList.add('hidden');
  errorBox.classList.remove('hidden');
  errorText.textContent = message;
}

const loader = new GLTFLoader();
loader.load('./assets/toyota prius002.glb', (gltf) => {
  carRoot = gltf.scene;
  scene.add(carRoot);

  // Center and scale the model to a convenient viewer size without changing its shape.
  const box = new THREE.Box3().setFromObject(carRoot);
  modelCenter = box.getCenter(new THREE.Vector3());
  modelSize = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  if (maxDim > 0) {
    const scale = 5 / maxDim;
    carRoot.scale.setScalar(scale);
    carRoot.position.sub(modelCenter.multiplyScalar(scale));
  }
  carRoot.position.y -= new THREE.Box3().setFromObject(carRoot).min.y;

  const fitted = new THREE.Box3().setFromObject(carRoot);
  const fittedCenter = fitted.getCenter(new THREE.Vector3());
  controls.target.copy(fittedCenter);
  const size = fitted.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  camera.position.set(fittedCenter.x + maxSize * 1.25, fittedCenter.y + maxSize * 0.55, fittedCenter.z + maxSize * 1.55);
  camera.near = Math.max(maxSize / 1000, 0.001);
  camera.far = maxSize * 100;
  camera.updateProjectionMatrix();
  controls.minDistance = maxSize * 0.35;
  controls.maxDistance = maxSize * 5;
  controls.update();
  initialCamera = { position: camera.position.clone(), target: controls.target.clone() };

  const seen = new Set();
  carRoot.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat || seen.has(mat.uuid)) return;
      seen.add(mat.uuid);
      // Avoid recoloring obvious glass/light materials based on material names.
      const n = (mat.name || '').toLowerCase();
      if (/glass|window|lamp|light|glass|tyre|tire|rubber|chrome|metal|wheel|rim|window/.test(n)) return;
      if (mat.color && mat.isMeshStandardMaterial) colorMaterials.push(mat);
    });
  });

  loading.classList.add('hidden');
  document.querySelectorAll('.swatch').forEach((button) => {
    button.addEventListener('click', () => applyColor(button.dataset.color, button.dataset.name, button));
  });
  // Apply the default swatch to materials, if the model has recolorable materials.
  const defaultSwatch = document.querySelector('.swatch.active');
  if (defaultSwatch) applyColor(defaultSwatch.dataset.color, defaultSwatch.dataset.name, defaultSwatch, false);
}, undefined, (err) => {
  console.error(err);
  showError('Проверь, что файл assets/toyota-prius-30.glb загружен вместе с сайтом и доступен по этому адресу.');
});

function applyColor(hex, name, button, updateUI = true) {
  if (colorMaterials.length === 0) {
    saveMessage.textContent = 'В модели не найдены подходящие материалы для перекраски.';
  } else {
    colorMaterials.forEach((mat) => {
      mat.color.set(hex);
      mat.needsUpdate = true;
    });
    saveMessage.textContent = '';
  }
  if (updateUI) {
    colorName.textContent = name;
    document.querySelectorAll('.swatch').forEach((el) => el.classList.toggle('active', el === button));
  }
  try { localStorage.setItem('prius30-color', JSON.stringify({ hex, name })); } catch {}
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!carRoot) return;
    const box = new THREE.Box3().setFromObject(carRoot);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const d = Math.max(s.x, s.y, s.z) * 1.7;
    const views = {
      front: new THREE.Vector3(0, s.y * 0.25, d),
      rear: new THREE.Vector3(0, s.y * 0.25, -d),
      side: new THREE.Vector3(d, s.y * 0.25, 0),
      top: new THREE.Vector3(0, d, 0.01)
    };
    camera.position.copy(c).add(views[button.dataset.view]);
    controls.target.copy(c);
    controls.update();
    document.querySelectorAll('.viewbutton').forEach((el) => el.classList.toggle('active', el === button));
  });
});

document.getElementById('resetView').addEventListener('click', () => {
  if (!carRoot) return;
  camera.position.copy(initialCamera.position);
  controls.target.copy(initialCamera.target);
  controls.update();
  document.querySelectorAll('.viewbutton').forEach((el) => el.classList.remove('active'));
});

document.getElementById('saveSetup').addEventListener('click', () => {
  const active = document.querySelector('.swatch.active');
  const setup = {
    vehicle: 'Toyota Prius 30 (XW30)',
    color: active?.dataset.color || '#aeb7c2',
    colorName: active?.dataset.name || 'Серебристый',
    wheels: 'Исходные из 3D-модели',
    bumpers: 'Исходные из 3D-модели',
    savedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(setup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prius30-config.json';
  a.click();
  URL.revokeObjectURL(url);
  saveMessage.textContent = 'Настройки сохранены в файл prius30-config.json';
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
