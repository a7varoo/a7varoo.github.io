// El homelab como grafo 3D: dos sitios unidos por WireGuard, el PC y el móvil, y los servicios orbitando cada nodo.
// Exporta montar(canvas) → { destruir() } o null sin WebGL. Sin hostnames ni direcciones: solo lo que cuenta el propio portfolio.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

const NUCLEOS = [
  { id: "proxmox", etiqueta: "Proxmox · sitio A", pos: [-3.2, 0.4, 0], r: 0.62, color: 0x5fded0,
    servicios: ["Grafana", "Prometheus", "Loki", "Alertmanager", "AdGuard", "Proxy inverso", "Home Assistant"] },
  { id: "orange", etiqueta: "Orange Pi 5 · sitio B", pos: [3.2, -0.2, 0], r: 0.5, color: 0x5fded0,
    servicios: ["Open WebUI", "Qdrant", "Prometheus", "Exporters"] },
  { id: "pc", etiqueta: "PC · GPU", pos: [-0.2, 2.6, -0.6], r: 0.42, color: 0xf2c14e,
    servicios: ["Ollama", "ComfyUI", "Exporters"] },
  { id: "rpi", etiqueta: "Raspberry Pi · VPN de emergencia", pos: [0.6, -2.5, 0.8], r: 0.3, color: 0x9fb0c0, servicios: [] },
  { id: "movil", etiqueta: "Móvil · esté donde esté", pos: [3.0, 2.3, 1.0], r: 0.26, color: 0x9fb0c0, servicios: [] },
];
const ENLACES = [["proxmox", "orange", "WireGuard"], ["proxmox", "pc", "LAN"], ["proxmox", "rpi", "WireGuard"], ["movil", "proxmox", "WireGuard"], ["movil", "orange", "WireGuard"], ["pc", "orange", "WireGuard"]];

function etiqueta(texto, tam, color) {
  const c = document.createElement("canvas"), ctx = c.getContext("2d"), dpr = 2;
  ctx.font = `600 ${tam}px Inter, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(texto).width) + 20, h = tam + 16;
  c.width = w * dpr; c.height = h * dpr; ctx.scale(dpr, dpr);
  ctx.font = `600 ${tam}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(texto, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  const k = 0.011; sp.scale.set(w * k, h * k, 1);
  return sp;
}

export function montar(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" }); } catch (_) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.2, 14.5);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const luz = new THREE.PointLight(0x5fded0, 30, 60); luz.position.set(4, 6, 6); scene.add(luz);
  const luz2 = new THREE.PointLight(0xf2c14e, 12, 60); luz2.position.set(-6, -4, 4); scene.add(luz2);

  const porId = new Map();
  const satelites = [];
  const geoSat = new THREE.SphereGeometry(0.11, 12, 12);
  for (const n of NUCLEOS) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(n.r, 28, 28), new THREE.MeshStandardMaterial({ color: 0x11293a, emissive: n.color, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.3 }));
    m.position.set(...n.pos);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(n.r * 1.35, 24, 24), new THREE.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.08 }));
    m.add(halo);
    const lab = etiqueta(n.etiqueta, 22, "#eaf6f4"); lab.position.set(0, n.r + 0.42, 0); m.add(lab);
    scene.add(m); porId.set(n.id, m);
    n.servicios.forEach((s, i) => {
      const sat = new THREE.Mesh(geoSat, new THREE.MeshBasicMaterial({ color: n.color }));
      const lab2 = etiqueta(s, 15, "#9fb0c0"); lab2.position.set(0, 0.22, 0); sat.add(lab2);
      const orbita = n.r + 0.95 + (i % 2) * 0.35;
      sat.userData = { centro: m.position, orbita, fase: (i / n.servicios.length) * Math.PI * 2, inclin: 0.35 + (i % 3) * 0.25, vel: 0.25 + (i % 2) * 0.08 };
      scene.add(sat); satelites.push(sat);
    });
  }
  const particulas = [];
  const geoP = new THREE.SphereGeometry(0.05, 8, 8);
  for (const [a, b, tipo] of ENLACES) {
    const pa = porId.get(a).position, pb = porId.get(b).position;
    const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5); mid.z += 0.9;
    const curva = new THREE.QuadraticBezierCurve3(pa.clone(), mid, pb.clone());
    const vpn = tipo === "WireGuard";
    const linea = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curva.getPoints(36)), new THREE.LineBasicMaterial({ color: vpn ? 0x5fded0 : 0xf2c14e, transparent: true, opacity: vpn ? 0.35 : 0.5 }));
    scene.add(linea);
    if (!reducido) for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({ color: vpn ? 0x5fded0 : 0xf2c14e }));
      p.userData = { curva, t: i / 2 + Math.random() * 0.4, dir: i % 2 ? -1 : 1 };
      scene.add(p); particulas.push(p);
    }
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enableZoom = false; controls.enablePan = false;
  controls.autoRotate = !reducido; controls.autoRotateSpeed = 0.7;
  let reanudar = 0;
  controls.addEventListener("start", () => { controls.autoRotate = false; reanudar = 0; });
  controls.addEventListener("end", () => { reanudar = performance.now() + 5000; });
  canvas.style.cursor = "grab";

  function redimensionar() {
    const w = canvas.clientWidth || 400, h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(redimensionar); ro.observe(canvas); redimensionar();

  let visible = true, raf = 0, previo = performance.now();
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) { previo = performance.now(); raf = requestAnimationFrame(cuadro); } });
  io.observe(canvas);
  function cuadro(t) {
    raf = 0; if (!visible) return;
    const dt = Math.min((t - previo) / 1000, 0.05); previo = t;
    if (!controls.autoRotate && !reducido && reanudar && t > reanudar) { controls.autoRotate = true; reanudar = 0; }
    controls.update();
    const s = t * 0.001;
    for (const sat of satelites) {
      const u = sat.userData, a = u.fase + (reducido ? 0 : s * u.vel);
      sat.position.set(u.centro.x + Math.cos(a) * u.orbita, u.centro.y + Math.sin(a) * u.orbita * Math.sin(u.inclin), u.centro.z + Math.sin(a) * u.orbita * Math.cos(u.inclin));
    }
    for (const p of particulas) { const u = p.userData; u.t = (u.t + dt * 0.18 * u.dir + 1) % 1; p.position.copy(u.curva.getPoint(u.t)); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(cuadro);
  }
  raf = requestAnimationFrame(cuadro);
  return { destruir() { visible = false; if (raf) cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); renderer.dispose(); } };
}
