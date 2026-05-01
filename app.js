import * as THREE from "three";

const musicFolderAudioFiles = import.meta.glob("./Music/*.mp3", {
  eager: true,
  import: "default",
  query: "?url"
});
const rootAudioFiles = import.meta.glob("./*.mp3", {
  eager: true,
  import: "default",
  query: "?url"
});

function audioUrl(path) {
  return musicFolderAudioFiles[`./${path}`] ?? rootAudioFiles[`./${path.replace("Music/", "")}`] ?? path;
}

const tracks = [
  { id: "coastal-reveal", title: "Horizon Run", file: audioUrl("Music/Horizon Run.mp3"), state: "Coastal Reveal", color: "#58c7bc", bpm: 124, reason: "Coastline is close and the route opens toward water." },
  { id: "tidal-surge", title: "Tidal Surge", file: audioUrl("Music/Tidal Surge.mp3"), state: "Near Water", color: "#18a2bd", bpm: 132, reason: "Water is moving into range, so the soundtrack widens." },
  { id: "forest-climb", title: "Switchback Pulse", file: audioUrl("Music/Switchback Pulse.mp3"), state: "Forest Climb", color: "#ff5a3d", bpm: 142, reason: "The route is climbing through cover and needs more push." },
  { id: "dense-forest", title: "Black Pine Circuit", file: audioUrl("Music/Black Pine Circuit.mp3"), state: "Deep Forest", color: "#64a646", bpm: 148, reason: "Canopy is dense, movement is steady, focus gets tighter." },
  { id: "forest-sprint", title: "Mossline Sprint", file: audioUrl("Music/Mossline Sprint.mp3"), state: "Technical Sprint", color: "#c9ff2e", bpm: 156, reason: "Fast pace in dense trail asks for sharper electronic motion." },
  { id: "downhill", title: "Downhill Breeze Run", file: audioUrl("Music/Downhill Breeze Run.mp3"), state: "Downhill Release", color: "#d9f6ff", bpm: 145, reason: "The grade drops and the body gets a gravity assist." },
  { id: "summit", title: "Summit Over Glacier", file: audioUrl("Music/Summit Over Glacier.mp3"), state: "Summit View", color: "#f0f7ff", bpm: 120, reason: "Climb energy opens into a bigger landscape cue." },
  { id: "summit-pulse", title: "Summit Pulse", file: audioUrl("Music/Summit Pulse.mp3"), state: "High Effort", color: "#d6ff29", bpm: 136, reason: "Sustained grade is high, so the music lifts the effort." },
  { id: "gravel", title: "Gravel Heart Run", file: audioUrl("Music/Gravel Heart Run.mp3"), state: "Gravel Flow", color: "#f2a14f", bpm: 118, reason: "Stable pace and mild terrain hold a grounded rhythm." },
  { id: "urban", title: "Neon Pace Run", file: audioUrl("Music/Neon Pace Run.mp3"), state: "Urban Pace", color: "#a86dff", bpm: 128, reason: "Fast, flatter movement calls for a clean electronic lane." },
  { id: "flow", title: "Orbit Run", file: audioUrl("Music/Orbit Run.mp3"), state: "Flow State", color: "#6f83ff", bpm: 124, reason: "Inputs are balanced, so Runflow holds the main groove." },
  { id: "trail", title: "Cedar Trail Run", file: audioUrl("Music/Cedar Trail Run.mp3"), state: "Trail Cruise", color: "#9fca78", bpm: 122, reason: "Moderate canopy and relaxed grade suggest trail cruising." },
  { id: "finish", title: "Finish Line Riot", file: audioUrl("Music/Finish Line Riot.mp3"), state: "Final Push", color: "#ff4c39", bpm: 160, reason: "The route is near its final push, so the soundtrack kicks." }
];

const routeModel = [
  { at: 0, paceSeconds: 324, grade: 0, seaDistance: 980, forest: 35, finishPush: false },
  { at: 18, paceSeconds: 312, grade: 1, seaDistance: 900, forest: 58, finishPush: false },
  { at: 36, paceSeconds: 338, grade: 6, seaDistance: 860, forest: 82, finishPush: false },
  { at: 58, paceSeconds: 252, grade: 2, seaDistance: 920, forest: 86, finishPush: false },
  { at: 78, paceSeconds: 276, grade: -6, seaDistance: 1100, forest: 42, finishPush: false },
  { at: 98, paceSeconds: 304, grade: 0, seaDistance: 520, forest: 26, finishPush: false },
  { at: 118, paceSeconds: 318, grade: 3, seaDistance: 190, forest: 10, finishPush: false },
  { at: 140, paceSeconds: 248, grade: 0, seaDistance: 760, forest: 18, finishPush: false },
  { at: 160, paceSeconds: 236, grade: 1, seaDistance: 880, forest: 20, finishPush: true },
  { at: 184, paceSeconds: 324, grade: 0, seaDistance: 980, forest: 35, finishPush: false }
];

const state = {
  activeTrack: tracks.find((track) => track.id === "flow"),
  activeDeck: "A",
  isPlaying: false,
  liveGps: false,
  elapsedSeconds: 0,
  distanceKm: 0,
  context: {
    paceSeconds: 324,
    grade: 0,
    seaDistance: 980,
    forest: 35,
    speed: 3.09,
    altitude: null,
    finishPush: false
  }
};

const deckA = document.querySelector("#deckA");
const deckB = document.querySelector("#deckB");
const playButton = document.querySelector("#playButton");
const gpsButton = document.querySelector("#gpsButton");
const trackTitle = document.querySelector("#trackTitle");
const stateLabel = document.querySelector("#stateLabel");
const stateReason = document.querySelector("#stateReason");
const blobCanvas = document.querySelector("#blobCanvas");

const readouts = {
  pace: document.querySelector("#paceReadout"),
  bpm: document.querySelector("#bpmReadout"),
  time: document.querySelector("#timeReadout"),
  grade: document.querySelector("#gradeReadout"),
  distance: document.querySelector("#distanceReadout"),
  detectorStatus: document.querySelector("#detectorStatus"),
  upcomingTrack: document.querySelector("#upcomingTrack"),
  effort: document.querySelector("#effortReadout"),
  terrain: document.querySelector("#terrainReadout"),
  coast: document.querySelector("#coastReadout"),
  forest: document.querySelector("#forestReadout")
};

let gpsWatchId = null;
let lastGpsPoint = null;
let runTimer = null;
let audioContext = null;
let analyser = null;
let frequencyData = null;
let deckASource = null;
let deckBSource = null;

const renderer = new THREE.WebGLRenderer({
  canvas: blobCanvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x050506, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, 6.2);

const blobGeometry = new THREE.IcosahedronGeometry(1.72, 56);
const basePositions = blobGeometry.attributes.position.array.slice();
const blobMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(state.activeTrack.color),
  roughness: 0.36,
  metalness: 0.12,
  clearcoat: 0.82,
  clearcoatRoughness: 0.22,
  emissive: new THREE.Color(state.activeTrack.color),
  emissiveIntensity: 0.42
});
const blob = new THREE.Mesh(blobGeometry, blobMaterial);
scene.add(blob);

const wire = new THREE.Mesh(
  blobGeometry,
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.08,
    wireframe: true
  })
);
scene.add(wire);

scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const keyLight = new THREE.PointLight(0xffffff, 9, 16);
keyLight.position.set(2.8, 2.2, 4.5);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0xc9ff2e, 6, 14);
rimLight.position.set(-3.2, -1.4, 3);
scene.add(rimLight);
const fillLight = new THREE.PointLight(0xd7ff2f, 4, 18);
fillLight.position.set(0, -3.4, 4);
scene.add(fillLight);

function formatPace(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}'${secs}"`;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(mins).padStart(2, "0")}:${secs}`
    : `${mins}:${secs}`;
}

function metersLabel(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

function interpolate(a, b, progress) {
  return a + (b - a) * progress;
}

function getRouteFrame(seconds) {
  const t = seconds % routeModel.at(-1).at;
  const nextIndex = routeModel.findIndex((point) => point.at > t);
  const next = routeModel[nextIndex] ?? routeModel[routeModel.length - 1];
  const previous = routeModel[Math.max(0, nextIndex - 1)];
  const span = Math.max(1, next.at - previous.at);
  const progress = Math.min(1, Math.max(0, (t - previous.at) / span));

  return {
    paceSeconds: Math.round(interpolate(previous.paceSeconds, next.paceSeconds, progress)),
    grade: Math.round(interpolate(previous.grade, next.grade, progress)),
    seaDistance: Math.round(interpolate(previous.seaDistance, next.seaDistance, progress)),
    forest: Math.round(interpolate(previous.forest, next.forest, progress)),
    finishPush: previous.finishPush || next.finishPush && progress > 0.35
  };
}

function pickTrack(context) {
  if (context.finishPush) return tracks.find((track) => track.id === "finish");
  if (context.seaDistance <= 180 && context.grade >= 3) return tracks.find((track) => track.id === "summit");
  if (context.seaDistance <= 260) return tracks.find((track) => track.id === "coastal-reveal");
  if (context.seaDistance <= 520) return tracks.find((track) => track.id === "tidal-surge");
  if (context.grade >= 8) return tracks.find((track) => track.id === "summit-pulse");
  if (context.grade >= 4) return tracks.find((track) => track.id === "forest-climb");
  if (context.grade <= -4) return tracks.find((track) => track.id === "downhill");
  if (context.paceSeconds <= 255 && context.forest >= 55) return tracks.find((track) => track.id === "forest-sprint");
  if (context.forest >= 72) return tracks.find((track) => track.id === "dense-forest");
  if (context.forest >= 52) return tracks.find((track) => track.id === "trail");
  if (context.paceSeconds <= 270) return tracks.find((track) => track.id === "urban");
  if (context.paceSeconds >= 390) return tracks.find((track) => track.id === "gravel");
  return tracks.find((track) => track.id === "flow");
}

function effortLabel(context) {
  if (context.finishPush) return "Final push";
  if (context.grade >= 7) return "Climbing";
  if (context.grade <= -4) return "Release";
  if (context.paceSeconds <= 260) return "Fast";
  return "Steady";
}

function terrainLabel(context) {
  if (context.seaDistance <= 260) return "Open water";
  if (context.forest >= 72 && context.grade >= 4) return "Switchback";
  if (context.forest >= 72) return "Deep trail";
  if (context.grade <= -4) return "Downhill";
  if (context.grade >= 4) return "Uphill";
  return "Flow";
}

function updateMetrics() {
  readouts.pace.textContent = formatPace(state.context.paceSeconds);
  readouts.bpm.textContent = state.activeTrack.bpm;
  readouts.time.textContent = formatTime(state.elapsedSeconds);
  readouts.grade.textContent = `${state.context.grade}%`;
  readouts.distance.textContent = state.distanceKm.toFixed(2);
  readouts.detectorStatus.textContent = state.liveGps ? "Live GPS + auto terrain" : "Auto route intelligence";
  readouts.upcomingTrack.textContent = state.activeTrack.title;
  readouts.effort.textContent = effortLabel(state.context);
  readouts.terrain.textContent = terrainLabel(state.context);
  readouts.coast.textContent = metersLabel(state.context.seaDistance);
  readouts.forest.textContent = `${state.context.forest}%`;
}

function getDecks() {
  return state.activeDeck === "A"
    ? { current: deckA, next: deckB, nextName: "B" }
    : { current: deckB, next: deckA, nextName: "A" };
}

function ensureAudioGraph() {
  if (audioContext) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.78;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);

  deckASource = audioContext.createMediaElementSource(deckA);
  deckBSource = audioContext.createMediaElementSource(deckB);
  deckASource.connect(analyser);
  deckBSource.connect(analyser);
  analyser.connect(audioContext.destination);
}

function fadeDecks(fromDeck, toDeck, duration = 2400) {
  const start = performance.now();
  toDeck.volume = 0;
  toDeck.play().catch(() => {
    state.isPlaying = false;
    playButton.textContent = "Start";
  });

  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    toDeck.volume = Math.max(0, Math.min(1, progress));
    fromDeck.volume = Math.max(0, Math.min(1, 1 - progress));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      fromDeck.pause();
      fromDeck.currentTime = 0;
      fromDeck.volume = 1;
      toDeck.volume = 1;
    }
  }

  requestAnimationFrame(step);
}

function setTrack(track, force = false) {
  if (!track || (!force && state.activeTrack.id === track.id)) return;

  const { current, next, nextName } = getDecks();
  state.activeTrack = track;
  state.activeDeck = nextName;
  next.src = track.file;
  next.loop = true;

  if (state.isPlaying) {
    fadeDecks(current, next);
  }

  renderNowPlaying();
}

function renderNowPlaying() {
  trackTitle.textContent = state.activeTrack.title;
  stateLabel.textContent = state.activeTrack.state;
  stateReason.textContent = state.activeTrack.reason;
  document.documentElement.style.setProperty("--accent-2", state.activeTrack.color);
  blobMaterial.color.set(state.activeTrack.color);
  blobMaterial.emissive.set(state.activeTrack.color);
  rimLight.color.set(state.activeTrack.color);
  readouts.bpm.textContent = state.activeTrack.bpm;
}

function applyAutoContext() {
  const modeled = getRouteFrame(state.elapsedSeconds);
  const paceSeconds = state.liveGps ? state.context.paceSeconds : modeled.paceSeconds;
  const grade = state.liveGps ? state.context.grade : modeled.grade;
  state.context = {
    ...state.context,
    ...modeled,
    paceSeconds,
    grade,
    speed: 1000 / paceSeconds
  };
  setTrack(pickTrack(state.context));
  updateMetrics();
}

async function startAudio() {
  ensureAudioGraph();
  if (audioContext.state === "suspended") await audioContext.resume();

  const deck = state.activeDeck === "A" ? deckA : deckB;
  if (!deck.src) {
    deck.src = state.activeTrack.file;
    deck.loop = true;
  }

  deck.play().then(() => {
    state.isPlaying = true;
    playButton.textContent = "Pause";
    startRunTimer();
  }).catch(() => {
    playButton.textContent = "Tap again";
  });
}

function pauseAudio() {
  deckA.pause();
  deckB.pause();
  state.isPlaying = false;
  playButton.textContent = "Start";
  stopRunTimer();
}

function startRunTimer() {
  if (runTimer) return;
  runTimer = window.setInterval(() => {
    state.elapsedSeconds += 1;
    state.distanceKm += 1000 / state.context.paceSeconds / 3600;
    applyAutoContext();
  }, 1000);
}

function stopRunTimer() {
  if (!runTimer) return;
  window.clearInterval(runTimer);
  runTimer = null;
}

function haversine(a, b) {
  const radius = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);
  const x = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function startGps() {
  if (!navigator.geolocation) {
    gpsButton.title = "GPS is not available in this browser";
    return;
  }

  gpsWatchId = navigator.geolocation.watchPosition((position) => {
    const point = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      timestamp: position.timestamp
    };

    if (position.coords.speed && position.coords.speed > 0) {
      state.context.speed = position.coords.speed;
      state.context.paceSeconds = Math.round(1000 / position.coords.speed);
    } else if (lastGpsPoint) {
      const distance = haversine(lastGpsPoint, point);
      const seconds = (point.timestamp - lastGpsPoint.timestamp) / 1000;
      if (seconds > 0 && distance > 1) {
        state.context.speed = distance / seconds;
        state.context.paceSeconds = Math.round(1000 / state.context.speed);
      }
    }

    if (point.altitude !== null && lastGpsPoint?.altitude !== null) {
      const distance = Math.max(1, haversine(lastGpsPoint, point));
      const climb = point.altitude - lastGpsPoint.altitude;
      state.context.grade = Math.max(-12, Math.min(14, Math.round((climb / distance) * 100)));
      state.context.altitude = point.altitude;
    }

    lastGpsPoint = point;
    applyAutoContext();
  }, () => {
    stopGps();
  }, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
  });

  state.liveGps = true;
  gpsButton.classList.add("is-active");
  gpsButton.title = "Live GPS is active";
  updateMetrics();
}

function stopGps() {
  if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = null;
  state.liveGps = false;
  gpsButton.classList.remove("is-active");
  gpsButton.title = "Use live GPS";
  updateMetrics();
}

function resizeRenderer() {
  const width = blobCanvas.clientWidth || window.innerWidth;
  const height = blobCanvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function readAudioBands() {
  if (!analyser || !frequencyData || !state.isPlaying) {
    const idle = 0.28 + Math.sin(performance.now() * 0.002) * 0.08;
    return { bass: idle, mid: idle * 0.6, high: idle * 0.42, energy: idle };
  }

  analyser.getByteFrequencyData(frequencyData);
  const sample = (from, to) => {
    let total = 0;
    for (let i = from; i < to; i += 1) total += frequencyData[i];
    return total / Math.max(1, to - from) / 255;
  };

  const bass = sample(2, 10);
  const mid = sample(10, 42);
  const high = sample(42, 96);
  return {
    bass,
    mid,
    high,
    energy: Math.min(1, bass * 0.48 + mid * 0.34 + high * 0.24)
  };
}

function animateBlob(now = 0) {
  resizeRenderer();
  const time = now * 0.001;
  const bands = readAudioBands();
  const positions = blobGeometry.attributes.position.array;
  const gradePush = Math.max(0, state.context.grade) / 14;
  const pacePush = Math.max(0, 340 - state.context.paceSeconds) / 130;

  for (let i = 0; i < positions.length; i += 3) {
    const x = basePositions[i];
    const y = basePositions[i + 1];
    const z = basePositions[i + 2];
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    const ripple =
      Math.sin(nx * 5.4 + time * (1.6 + bands.high * 2.2)) * 0.08 +
      Math.cos(ny * 6.7 + time * (1.1 + bands.mid * 1.4)) * 0.1 +
      Math.sin((nx + ny + nz) * 4.2 + time * (2.2 + bands.bass * 2.6)) * 0.12;

    const audioDisplacement = bands.bass * 0.34 + bands.mid * 0.22 + bands.high * 0.16;
    const runDisplacement = gradePush * 0.12 + pacePush * 0.08;
    const radius = 1 + ripple + audioDisplacement + runDisplacement;
    positions[i] = nx * length * radius;
    positions[i + 1] = ny * length * radius;
    positions[i + 2] = nz * length * radius;
  }

  blobGeometry.attributes.position.needsUpdate = true;
  blobGeometry.computeVertexNormals();
  blob.rotation.y += 0.0038 + bands.energy * 0.01;
  blob.rotation.x = Math.sin(time * 0.55) * 0.12;
  wire.rotation.copy(blob.rotation);
  blob.scale.setScalar(1.08 + bands.energy * 0.1);
  wire.scale.copy(blob.scale);
  blobMaterial.emissiveIntensity = 0.38 + bands.energy * 0.72;
  keyLight.intensity = 7 + bands.bass * 12;
  rimLight.intensity = 4 + bands.high * 10;
  fillLight.intensity = 3 + bands.mid * 8;

  renderer.render(scene, camera);
  requestAnimationFrame(animateBlob);
}

playButton.addEventListener("click", () => {
  if (state.isPlaying) pauseAudio();
  else startAudio();
});

gpsButton.addEventListener("click", () => {
  if (state.liveGps) stopGps();
  else startGps();
});

window.addEventListener("resize", resizeRenderer);
deckA.addEventListener("ended", () => deckA.play());
deckB.addEventListener("ended", () => deckB.play());

applyAutoContext();
renderNowPlaying();
resizeRenderer();
animateBlob();
