const chapters = [...document.querySelectorAll('.chapter')];
const chapterLinks = [...document.querySelectorAll('.chapter-nav a')];
const dayLabels = chapters.map(({ dataset }) => dataset.days.split(';').map((entry) => {
  const [threshold, text = threshold] = entry.split(',');
  const [name, date] = text.split('|');
  return { threshold: Number(threshold) || 0, name, date };
}));
const stage = document.querySelector('#stage-render');
const poster = document.querySelector('#stage-poster');
const stageLabel = document.querySelector('#stage-label');
const stageDate = document.querySelector('#stage-date');
const stageFocus = document.querySelector('#stage-focus');
const stillToggle = document.querySelector('.still-toggle');
const progressBar = document.querySelector('.stage-progress span');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 780px)');
const stills = ['arrival', 'floor', 'trim', 'shelves', 'panels', 'closet-build', 'desk', 'closet-finish', 'finish'];
const stillLabels = ['Arrival', 'First panel test-fit', 'Crown molding', 'Floating shelves', 'Panels and cabinet boxes',
  'Closet counter and shelves', 'Workstation pedestals', 'Lit closet cabinetry', 'Window blinds'];
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smooth = (n) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
let renderRoom;
let stops = [];
let progress = 0;
let activeChapter = -1;
let currentPoster = 'arrival';
let scheduledFrame = 0;
let stillMode = false;

function syncPoster(chapter, fraction) {
  const index = chapter === 0 && fraction < .49 ? 0 : chapter + 1;
  const id = stills[index];
  if (id !== currentPoster) {
    currentPoster = id;
    poster.src = `assets/blender-${id}.webp`;
  }
  stageFocus.textContent = stillLabels[index];
}

function update() {
  scheduledFrame = 0;
  const top = scrollY;
  let chapter = stops.findIndex(({ end }) => top < end);
  if (chapter < 0) chapter = chapters.length - 1;
  const { start, end } = stops[chapter];
  const fraction = clamp((top - start) / (end - start));
  progress = chapter + fraction;
  progressBar.style.transform = `scaleX(${progress / chapters.length})`;
  if (activeChapter !== chapter) {
    chapterLinks[activeChapter]?.removeAttribute('aria-current');
    chapterLinks[chapter].setAttribute('aria-current', 'step');
    activeChapter = chapter;
  }
  const day = dayLabels[chapter].findLast(({ threshold }) => fraction >= threshold);
  if (day.name !== stageLabel.textContent) stageLabel.textContent = day.name;
  if (day.date !== stageDate.textContent) stageDate.textContent = day.date;
  const live = Boolean(renderRoom && !reduced.matches && !stillMode);
  stage.classList.toggle('ready', live);
  stillToggle.hidden = !renderRoom || reduced.matches;
  if (live) renderRoom(progress);
  else syncPoster(chapter, fraction);
}

function scheduleUpdate() {
  if (!scheduledFrame) scheduledFrame = requestAnimationFrame(update);
}

function measure() {
  const offset = narrow.matches ? document.querySelector('.stage-wrap').getBoundingClientRect().height : innerHeight * .14;
  stops = chapters.map((chapter) => {
    const { top, height } = chapter.getBoundingClientRect();
    const start = top + scrollY - offset;
    return { start, end: start + height };
  });
  scheduleUpdate();
}

addEventListener('scroll', scheduleUpdate, { passive: true });
addEventListener('resize', measure, { passive: true });
new ResizeObserver(measure).observe(document.querySelector('.chapters'));
document.fonts.ready.then(measure);
measure();

stillToggle.addEventListener('click', () => {
  stillMode = !stillMode;
  stillToggle.setAttribute('aria-pressed', String(stillMode));
  stillToggle.textContent = stillMode ? 'Live 3D view' : 'Blender still';
  scheduleUpdate();
});

let started = false;
async function startRoom() {
  if (started || reduced.matches) return;
  started = true;
  let renderer;
  try {
    const [THREE, { GLTFLoader }, response] = await Promise.all([
      import('./vendor/three.module.js'),
      import('./vendor/GLTFLoader.js'),
      fetch('assets/room-states.json'),
    ]);
    if (!response.ok) throw new Error('Room timeline unavailable');
    const { objects, cameras } = await response.json();
    const canvas = document.querySelector('#model');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(56, 1, .025, 43);
    const inches = ([x, y, z]) => new THREE.Vector3(x * .0254, z * .0254, -y * .0254);
    const closetLights = [28, 69, 106].map((x) => {
      const lamp = new THREE.PointLight(0xffcb89, 0, 1.7, 2);
      lamp.position.copy(inches([x, -47, 68]));
      scene.add(lamp);
      return lamp;
    });
    scene.add(new THREE.HemisphereLight(0xfff8ee, 0xa99f8d, 2.10));
    for (const [color, intensity, position] of [
      [0xffe6cb, 2.30, [-4, 9, 5]],
      [0xffffff, 1.10, [7, 8, 1]],
      [0xd5e5fb, 1.15, [1, 7, -8]],
    ]) {
      const lamp = new THREE.DirectionalLight(color, intensity);
      lamp.position.set(...position);
      scene.add(lamp);
    }
    const { scene: room } = await new GLTFLoader().loadAsync('assets/office.glb');
    scene.add(room);
    const pieces = [];
    room.traverse((node) => {
      const key = node.userData.webId;
      if (!key || !objects[key]) return;
      const { section, visible, events } = objects[key];
      pieces.push({ node, key, section, initiallyVisible: visible, events, origin: node.position.clone() });
    });
    if (!pieces.some(({ key }) => key === 'clo_counter')) throw new Error('Office model geometry unavailable');

    // Slerp the view orientation between poses so opposite walls never swing the view through zero length.
    const poses = cameras.map(([time, eye, target, fov, cut, label]) => {
      const view = new THREE.PerspectiveCamera();
      view.position.copy(inches(eye));
      view.lookAt(inches(target));
      return { time, xyz: view.position, rotation: view.quaternion, fov, cut, label };
    });

    function resizeRoom() {
      const { clientWidth: width, clientHeight: height } = stage;
      if (!width || !height) return;
      camera.aspect = width / height;
      renderer.setSize(width, height, false);
      scheduleUpdate();
    }

    renderRoom = (value) => {
      const bounds = stage.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= innerHeight) return;
      const index = poses.findLastIndex(({ time }) => time <= value);
      const a = poses[Math.max(0, index)];
      const b = poses[Math.min(poses.length - 1, index + 1)];
      const blend = b === a ? 0 : smooth((value - a.time) / (b.time - a.time));
      const shot = blend < .5 ? a : b;
      if (stageFocus.textContent !== shot.label) stageFocus.textContent = shot.label;
      const horizontal = a.fov + (b.fov - a.fov) * blend;
      const vertical = 2 * Math.atan(Math.tan(horizontal * Math.PI / 360) / camera.aspect) * 180 / Math.PI;
      camera.fov = clamp(vertical, 31, 100);
      camera.updateProjectionMatrix();
      camera.position.lerpVectors(a.xyz, b.xyz, blend);
      camera.quaternion.slerpQuaternions(a.rotation, b.rotation, blend);

      let lightsOn = false;
      for (const { node, key, section, initiallyVisible, events, origin } of pieces) {
        let visible = initiallyVisible;
        let changed = -1;
        for (const [time, action] of events) {
          if (value < time) break;
          if (action === 'show') {
            visible = true;
            changed = time;
          } else if (action === 'hide') {
            visible = false;
          }
        }
        const openingCut = value < .16;
        const cut = openingCut && (section === 'Wall S' || section === 'Ceiling' ||
          ['Closet Ceiling', 'Closet Walls', 'Door Leaf', 'Door Hardware'].includes(key));
        node.visible = visible && !cut;
        if (!node.visible) continue;
        node.position.copy(origin);
        if (changed >= 0) {
          const travel = 1 - smooth((value - changed) / .13);
          if (/^(ramboard|desk_drawers|clo_doors)/.test(key)) node.position.z += travel * .26;
          else if (!/^(clo_leds|blinds_new|fan)$/.test(key)) node.position.y += travel * .26;
        }
        if (key === 'clo_leds') lightsOn = true;
      }
      for (const light of closetLights) light.intensity = lightsOn ? 6.5 : 0;
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resizeRoom);
    observer.observe(stage);
    resizeRoom();
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      renderRoom = undefined;
      scheduleUpdate();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      observer.disconnect();
      renderer.dispose();
      started = false;
      startRoom();
    }, { once: true });
    scheduleUpdate();
  } catch {
    renderer?.dispose();
    scheduleUpdate();
  }
}

const roomObserver = new IntersectionObserver((entries) => {
  if (!entries.some(({ isIntersecting }) => isIntersecting)) return;
  startRoom();
  roomObserver.disconnect();
}, { rootMargin: '450px' });
roomObserver.observe(document.querySelector('#build'));
reduced.addEventListener('change', () => {
  if (!reduced.matches) startRoom();
  scheduleUpdate();
});

const ledger = document.querySelector('#materials');
const ledgerToggle = document.querySelector('#ledger-toggle');
function openLedger() {
  if (ledger.open) return;
  ledgerToggle.setAttribute('aria-expanded', 'true');
  ledger.showModal();
}
ledgerToggle.addEventListener('click', openLedger);
if (location.hash === '#materials') openLedger();
ledger.addEventListener('click', (event) => {
  if (event.target !== ledger) return;
  const bounds = ledger.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right) ledger.close();
});
ledger.addEventListener('close', () => {
  ledgerToggle.setAttribute('aria-expanded', 'false');
  ledgerToggle.focus({ preventScroll: true });
});
