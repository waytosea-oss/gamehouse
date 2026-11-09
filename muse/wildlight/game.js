'use strict';
/* 野光图鉴 wildlight — 林地观察摄影：读前兆、选观察位、长按对焦、快门判定入框/清晰/行为 */
const SAVE_KEY = 'wildlight_save_v1';
const W = 720, H = 980, WORLD_W = 2287;
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let DPR = 1, scaleK = 1, offX = 0, offY = 0;
function fitCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * DPR; cv.height = innerHeight * DPR;
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  scaleK = Math.min(innerWidth / W, innerHeight / H);
  offX = (innerWidth - W * scaleK) / 2; offY = (innerHeight - H * scaleK) / 2;
}
addEventListener('resize', fitCanvas); fitCanvas();
const toGame = (px, py) => [(px - offX) / scaleK, (py - offY) / scaleK];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const TAU = Math.PI * 2;

const BEHAVIORS = {
  preen: { name: '理羽', pose: 'preen', clues: [['枝上频繁挪步', 'prePreen'], ['尾巴翘起，头往后够', 'preen']] },
  display: { name: '展羽', pose: 'display', clues: [['站直身体，望向空地', 'preDisplay'], ['尾羽轻颤，要展开了', 'display']] },
  drink: { name: '饮水', pose: 'drink', clues: [['岸边出现湿脚印', 'idle3'], ['小虫飞向水边', 'flyOut'], ['走到浅滩，低头触水', 'drink']] }
};
const ORDER = ['preen', 'drink', 'display'];
const PHASES = [
  { id: 'idle1', dur: 7, zone: 'log' },
  { id: 'prePreen', dur: 3, zone: 'log', clue: 'preen' },
  { id: 'preen', dur: 6, zone: 'log', behavior: 'preen' },
  { id: 'idle2', dur: 4, zone: 'log' },
  { id: 'preDisplay', dur: 3, zone: 'log', clue: 'display' },
  { id: 'display', dur: 5.5, zone: 'log', behavior: 'display' },
  { id: 'idle3', dur: 4, zone: 'log', clue: 'drink' },
  { id: 'flyOut', dur: 2.6, fly: 'toPond' },
  { id: 'shoreAlert', dur: 3, zone: 'pond' },
  { id: 'drink', dur: 6.5, zone: 'pond', behavior: 'drink' },
  { id: 'flyBack', dur: 2.6, fly: 'toLog' }
];
const PHASE_IDX = Object.fromEntries(PHASES.map((p, i) => [p.id, i]));
const ZONES = { log: { x: 686, feet: 452, label: '枯木' }, pond: { x: 1510, feet: 716, label: '溪边浅滩' } };
const SPOTS = {
  shade: { name: '树荫', camX: 330, camY: 60, zoom: 1, posX: 240 },
  bush: { name: '灌木', camX: 1130, camY: 150, zoom: 1.08, posX: 1180 },
  shore: { name: '近岸', camX: 1245, camY: 285, zoom: 1.45, posX: 1350 }
};
const POSES = {
  stand: { src: 'assets/b_stand.webp', h: 245, ax: .42, ay: .90 },
  preen: { src: 'assets/b_preen.webp', h: 245, ax: .55, ay: .97 },
  drink: { src: 'assets/b_drink.webp', h: 235, ax: .66, ay: .88 },
  display: { src: 'assets/b_display.webp', h: 300, ax: .5, ay: 1.0 },
  flyup: { src: 'assets/b_flyup.webp', h: 185, ax: .5, ay: .5 },
  flydown: { src: 'assets/b_flydown.webp', h: 185, ax: .5, ay: .5 }
};
const save = PK.load(SAVE_KEY, { recorded: {}, album: [], snd: true, shots: 0 });
save.recorded = save.recorded || {}; save.album = save.album || [];
const $ = id => document.getElementById(id);
const sndBtns = [$('mSnd'), $('pSnd')];
function syncSnd() { sndBtns.forEach(b => { if (b) { b.classList.toggle('off', !save.snd); if (b.id === 'pSnd') b.textContent = '音效：' + (save.snd ? '开' : '关'); } }); }
PK.init({ game: 'wildlight', save, hubButtons: ['mHub', 'pHub'], hubFallback: '../' });
const AU = PK.audio({ vol: .8, music: .07 });
AU.set(save.snd !== false);
function tone(f, t, d, v, type, o) { AU.unlock(); AU.tone(f, AU.t() + (t || 0), d, v, type || 'sine', o); }
function noiseS(t, d, v, f, q) { AU.unlock(); AU.noise(AU.t() + (t || 0), d, v, f, q || 1); }
for (const b of sndBtns) if (b) b.addEventListener('click', () => { save.snd = !save.snd; AU.set(save.snd); PK.save(SAVE_KEY, save); syncSnd(); });
function chirp() { tone(2500 + Math.random() * 500, 0, .16, .045, 'sine', { to: 3300 }); setTimeout(() => tone(2800, 0, .12, .03, 'sine', { to: 3500 }), 170); }

let state = 'menu'; // menu play pause photo done
let imgs = {}, sceneImg = null;
let camX = SPOTS.shade.camX, camY = SPOTS.shade.camY, zoom = 1, spot = 'shade';
let phaseI = 0, phaseT = 0, speed = 1, startled = false, film = 6, focus = 0;
let holding = false, dragging = false, dragMoved = 0, lastPtr = null;
let focusBox = null, motes = [], menuPan = 0, justCompleted = false;

function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
(async () => {
  sceneImg = await loadImg('assets/scene.webp');
  for (const k in POSES) imgs[k] = await loadImg(POSES[k].src);
  renderMenuBits();
})();
function phase() { return PHASES[phaseI]; }
function birdPose(t) {
  const p = phase();
  if (p.fly) return (t * 3.8 | 0) % 2 ? 'flyup' : 'flydown';
  if (p.behavior === 'preen') return (t % 1.6) < 1.05 ? 'preen' : 'stand';
  if (p.behavior === 'drink') return (t % 1.5) < .85 ? 'drink' : 'stand';
  if (p.behavior === 'display') return 'display';
  return 'stand';
}
function birdPos(t) {
  const p = phase();
  if (p.fly) {
    const a = ZONES[p.fly === 'toPond' ? 'log' : 'pond'], b = ZONES[p.fly === 'toPond' ? 'pond' : 'log'];
    const k = clamp(phaseT / p.dur, 0, 1);
    const x = a.x + (b.x - a.x) * k;
    const y = a.feet + (b.feet - a.feet) * k - Math.sin(k * Math.PI) * 210;
    return { x, y, zone: k < .5 ? (p.fly === 'toPond' ? 'log' : 'pond') : (p.fly === 'toPond' ? 'pond' : 'log'), flying: true, dir: p.fly === 'toPond' ? 1 : -1 };
  }
  const z = ZONES[p.zone];
  return { x: z.x, y: z.feet, zone: p.zone, flying: false, dir: 1 };
}
function birdWorldRect(t) {
  const bp = birdPos(t), pose = POSES[birdPose(t)];
  const img = imgs[birdPose(t)];
  const h = pose.h, w = img ? h * img.naturalWidth / img.naturalHeight : h;
  return { x: bp.x - w * pose.ax, y: bp.y - h * pose.ay, w, h, bp, pose: birdPose(t) };
}
function viewRect() { return { x: camX, y: camY, w: W / zoom, h: H / zoom }; }
function distTo(zoneKey) { return Math.abs(SPOTS[spot].posX - ZONES[zoneKey].x) / 55; }
function nextTarget() { return ORDER.find(b => !save.recorded[b]) || null; }

function onEnterPhase() {
  const p = phase();
  if (p.id === 'shoreAlert' && distTo('pond') < 4) {
    startled = true;
    if (state === 'play') {
      PK.toast('你离得太近，它避开了');
      setHint('近岸太近，它落下前就避开了。退到灌木丛，这一轮它还会回来。');
    }
    tone(1800, 0, .12, .06, 'sine', { to: 900 });
  }
  if (p.behavior) chirp();
  updateClues();
}
function advancePhase() {
  phaseI = (phaseI + 1) % PHASES.length; phaseT = 0;
  onEnterPhase();
}
function effDur(p) { return p.id === 'shoreAlert' && startled ? 1.2 : p.dur; }

/* ---------- 渲染 ---------- */
function drawScene(t) {
  const vr = viewRect();
  const sx = vr.x / WORLD_W * sceneImg.naturalWidth, sw = vr.w / WORLD_W * sceneImg.naturalWidth;
  const sy = vr.y / H * sceneImg.naturalHeight, sh = vr.h / H * sceneImg.naturalHeight;
  // 对焦未稳时的轻微虚化用两层偏移模拟
  ctx.drawImage(sceneImg, sx, sy, sw, sh, 0, 0, W, H);
  // 浮尘光斑
  ctx.fillStyle = 'rgba(255,240,180,.5)';
  for (const m of motes) {
    const mx = (m.x - vr.x) * zoom, my = (m.y - vr.y) * zoom;
    if (mx < -10 || my < -10 || mx > W + 10 || my > H + 10) continue;
    ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * .001 + m.p));
    ctx.beginPath(); ctx.arc(mx, my, m.r * zoom, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawBird(t) {
  const r = birdWorldRect(t), vr = viewRect();
  const pose = POSES[r.pose];
  const dx = (r.x - vr.x) * zoom, dy = (r.y - vr.y) * zoom, dw = r.w * zoom, dh = r.h * zoom;
  if (dx + dw < -80 || dy + dh < -80 || dx > W + 80 || dy > H + 80) return null;
  ctx.save();
  // 影子
  if (!r.bp.flying) {
    ctx.fillStyle = 'rgba(30,40,16,.3)';
    ctx.beginPath(); ctx.ellipse(dx + dw * pose.ax, (r.bp.y - vr.y) * zoom + 6, dw * .26, 9 * zoom, 0, 0, TAU); ctx.fill();
  }
  if (r.bp.dir < 0) {
    ctx.translate(dx + dw, dy); ctx.scale(-1, 1);
    ctx.drawImage(imgs[r.pose], 0, 0, dw, dh);
  } else if (r.pose === 'display') {
    ctx.translate(dx + dw / 2, dy + dh); ctx.rotate(Math.sin(t * 1.7) * .02); ctx.translate(-dw / 2, -dh);
    ctx.drawImage(imgs[r.pose], 0, 0, dw, dh);
  } else ctx.drawImage(imgs[r.pose], dx, dy, dw, dh);
  ctx.restore();
  return { x: dx, y: dy, w: dw, h: dh };
}
function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, H * .78);
  g.addColorStop(0, 'rgba(10,20,6,0)'); g.addColorStop(1, 'rgba(10,20,6,.42)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 前景叶影
  ctx.fillStyle = 'rgba(16,30,10,.35)';
  for (const [lx, ly, s] of [[-30, -20, 130], [W - 40, -30, 160], [-40, H - 60, 170]]) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; ctx.ellipse(lx + Math.cos(a) * s * .4, ly + Math.sin(a) * s * .3, s * .34, s * .13, a, 0, TAU); }
    ctx.fill();
  }
}
function drawFocusBox(sr, t) {
  if (!sr || state !== 'play') return;
  if (!focusBox) focusBox = { ...sr };
  for (const k of ['x', 'y', 'w', 'h']) focusBox[k] += (sr[k] - focusBox[k]) * .35;
  const ok = focus >= 65;
  ctx.strokeStyle = ok ? 'rgba(140,230,110,.95)' : 'rgba(255,205,80,.95)';
  ctx.lineWidth = 2.4;
  const b = focusBox, c = 18;
  for (const [cx, cy, dx, dy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + c * dx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + c * dy); ctx.stroke();
  }
  ctx.font = '700 14px sans-serif';
  const label = `对焦 ${Math.round(focus)}%${holding && !dragging ? ' · 长按中' : ''}${ok ? ' · 清晰' : ''}`;
  const tw = ctx.measureText(label).width + 16;
  ctx.fillStyle = 'rgba(24,38,16,.8)';
  ctx.beginPath(); ctx.roundRect(b.x, b.y - 30, tw, 22, 7); ctx.fill();
  ctx.fillStyle = ok ? '#b7e39a' : '#ffd94d';
  ctx.fillText(label, b.x + 8, b.y - 14);
}
let lastFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now;
  const t = now / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.translate(offX, offY); ctx.scale(scaleK, scaleK);
  if (!sceneImg) { ctx.fillStyle = '#22331a'; ctx.fillRect(0, 0, W, H); return; }
  if (state === 'menu') { menuPan += dt * 6; camX = 330 + Math.sin(menuPan * .05) * 240; camY = 90; zoom = 1; }
  // 行为时间推进（菜单与观察中都走）
  if (state === 'menu' || state === 'play') {
    phaseT += dt * (state === 'play' ? speed : 1);
    if (phaseT >= effDur(phase())) {
      if (startled && phase().id === 'shoreAlert') { // 惊走：直接飞回
        phaseI = PHASE_IDX['flyBack']; phaseT = 0; startled = false; updateClues();
      } else advancePhase();
    }
  }
  // 对焦
  if (state === 'play') {
    const bp = birdPos(t), vr = viewRect();
    const inView = bp.x > vr.x - 60 && bp.x < vr.x + vr.w + 60 && bp.y > vr.y - 60 && bp.y < vr.y + vr.h + 60;
    if (holding && !dragging && inView) focus = clamp(focus + dt * 92, 0, 100);
    else if (dragging) focus = clamp(focus - dt * 48, 0, 100);
    else focus = clamp(focus - dt * (inView ? 10 : 55), 0, 100);
    $('focusLab').textContent = focus >= 65 ? '对焦清晰' : holding && !dragging ? '对焦中…' : '按住画面对焦';
  }
  drawScene(now);
  const sr = drawBird(t);
  drawVignette();
  drawFocusBox(sr, t);
}
for (let i = 0; i < 26; i++) motes.push({ x: Math.random() * WORLD_W, y: Math.random() * H, r: 1 + Math.random() * 2.2, a: .25 + Math.random() * .5, p: Math.random() * 9 });
requestAnimationFrame(frame);

/* ---------- 相机操作 ---------- */
function setSpot(key) {
  spot = key; const s = SPOTS[key];
  camX = s.camX; camY = s.camY; zoom = s.zoom; focusBox = null;
  document.querySelectorAll('[data-spot]').forEach(b => b.classList.toggle('on', b.dataset.spot === key));
  updateDistChip();
}
document.querySelectorAll('[data-spot]').forEach(b => b.addEventListener('click', () => { setSpot(b.dataset.spot); tone(660, 0, .05, .05); }));
function updateDistChip() {
  const bp = birdPos(performance.now() / 1000);
  const d = distTo(bp.zone);
  const el = $('hDist');
  el.textContent = `距离 ${d < 4 ? '约 3' : Math.round(d)} 米 · ${d < 4 ? '太近' : '安全'}`;
  el.classList.toggle('bad', d < 4);
}
function setHint(s) { $('hintLine').textContent = s; }
function evtPos(e) { const r = cv.getBoundingClientRect(); return toGame(e.clientX - r.left, e.clientY - r.top); }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  AU.unlock();
  const [x, y] = evtPos(e); lastPtr = [x, y]; holding = true; dragging = false; dragMoved = 0;
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (state !== 'play' || !holding || !lastPtr) return;
  const [x, y] = evtPos(e);
  const dx = x - lastPtr[0], dy = y - lastPtr[1];
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved > 12) dragging = true;
  if (dragging) {
    camX = clamp(camX - dx / zoom, 0, WORLD_W - W / zoom);
    camY = clamp(camY - dy / zoom, 0, H - H / zoom);
    focusBox = null;
  }
  lastPtr = [x, y];
});
const endPtr = () => { holding = false; dragging = false; lastPtr = null; };
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
addEventListener('keydown', e => { if (e.code === 'Space' && state === 'play') { e.preventDefault(); shoot(); } });

/* ---------- 快门与判定 ---------- */
function visibleFrac() {
  const t = performance.now() / 1000, r = birdWorldRect(t), vr = viewRect();
  const ix = Math.max(0, Math.min(r.x + r.w, vr.x + vr.w) - Math.max(r.x, vr.x));
  const iy = Math.max(0, Math.min(r.y + r.h, vr.y + vr.h) - Math.max(r.y, vr.y));
  const frac = (ix * iy) / (r.w * r.h);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const centered = cx > vr.x + vr.w * .12 && cx < vr.x + vr.w * .88 && cy > vr.y + vr.h * .1 && cy < vr.y + vr.h * .92;
  const leftCut = (vr.x - r.x) / r.w, rightCut = (r.x + r.w - vr.x - vr.w) / r.w;
  return { frac, centered, leftCut, rightCut };
}
function capturePhoto() {
  const c = document.createElement('canvas');
  const tw = 420; c.width = tw; c.height = Math.round(tw * cv.height / cv.width);
  c.getContext('2d').drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .72);
}
function shoot() {
  if (state !== 'play') return null;
  if (film <= 0) { PK.toast('胶片用完了，回营地补'); setHint('胶片用完了。点左上角回营地，补满胶片再进来。'); return null; }
  film--; save.shots++;
  $('hFilm').textContent = `胶片 ${film}`;
  noiseS(0, .05, .22, 2600, 2); tone(190, 0, .05, .16, 'square');
  const fl = $('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 60);
  const { frac, centered, leftCut, rightCut } = visibleFrac();
  const inFrame = frac >= .55 && centered;
  const sharp = focus >= 65;
  const beh = phase().behavior || null;
  const behName = beh ? BEHAVIORS[beh].name : '停栖';
  const isNew = beh && !save.recorded[beh];
  const success = inFrame && sharp && !!beh;
  const img = capturePhoto();
  let note;
  if (frac < .15) note = '画面里基本没有鸟。先拖动画面找到它，再按住对焦。';
  else if (!inFrame && leftCut > rightCut) note = '只拍到尾部。把鸟完整放进取景框再拍。';
  else if (!inFrame) note = '主体不完整。让鸟整个进入画面再按快门。';
  else if (!sharp) note = `对焦只有 ${Math.round(focus)}%，画面发糊。按住画面等对焦框变绿再拍。`;
  else if (!beh) note = '拍得很清楚，可惜它这会儿只是在停栖。等前兆点亮、行为开始时再拍。';
  else if (isNew) note = `图鉴补上了「${behName}」。${nextTarget() === null ? '' : ''}`;
  else note = `「${behName}」已经记录过了，这张留作相册收藏。`;
  const photo = { img, beh: beh || 'idle', ok: success, t: Date.now() };
  save.album.unshift(photo); save.album = save.album.slice(0, 12);
  if (success && isNew) {
    save.recorded[beh] = true; justCompleted = ORDER.every(b => save.recorded[b]);
    tone(660, 0, .12, .1); tone(880, .1, .16, .1); tone(1320, .2, .2, .08);
    PK.call('behavior', { behavior: beh });
  }
  PK.save(SAVE_KEY, save);
  // 结算面板
  state = 'photo';
  $('phH').textContent = success ? (isNew ? '图鉴补全了一页' : '拍到了') : '这一张没成';
  $('phSub').textContent = `金穗尾鸟 · ${behName} · ${ZONES[birdPos(performance.now() / 1000).zone].label}`;
  $('phImg').src = img;
  $('phCap').textContent = `溪边 · 第 ${save.shots} 张`;
  $('phChecks').innerHTML =
    `<span class="${sharp ? 'ok' : 'no'}">${sharp ? '对焦清晰 ✓' : '对焦模糊 ×'}</span>` +
    `<span class="${inFrame ? 'ok' : 'no'}">${inFrame ? (frac >= .92 ? '主体完整 ✓' : '主体入框 ✓') : '主体不完整 ×'}</span>` +
    `<span class="${beh ? 'ok' : 'no'}">${beh ? behName + '行为 ✓' : '无目标行为 ×'}</span>`;
  $('phNote').textContent = note + (film === 0 ? ' 胶片刚好用完，回营地可以补满。' : ` 胶片还剩 ${film} 张。`);
  PK.show('photoP');
  updateHUDbits(); renderMenuBits();
  return { success, isNew, beh, frac, sharp, inFrame };
}
$('bShutter').addEventListener('click', shoot);
$('phOk').addEventListener('click', () => {
  PK.show(null); state = 'play';
  if (justCompleted) { justCompleted = false; setTimeout(showDone, 350); }
});
$('phAlbum').addEventListener('click', () => { renderDex(); PK.show('dexP'); });

/* ---------- 线索与 HUD ---------- */
function updateClues() {
  const p = phase();
  // 找下一个将出现的行为
  let target = null;
  for (let k = 0; k < PHASES.length; k++) {
    const ph = PHASES[(phaseI + k) % PHASES.length];
    if (ph.behavior) { target = ph.behavior; break; }
    if (ph.clue) { target = ph.clue; break; }
  }
  if (p.behavior) target = p.behavior;
  if (!target) target = 'preen';
  const B = BEHAVIORS[target];
  $('clueTitle').textContent = p.behavior ? `正在发生 · ${B.name}` : `前兆 · ${B.name}`;
  $('clueLines').innerHTML = B.clues.map(([txt, phId]) => {
    const on = PHASE_IDX[phase().id] >= PHASE_IDX[phId] || (phase().behavior === target && PHASE_IDX[phId] <= PHASE_IDX[phase().id]);
    return `<div class="${on ? 'ok' : 'wait'}">${on ? '✓' : '○'} ${txt}</div>`;
  }).join('');
  $('hPhase').textContent = p.behavior ? `${B.name}中 · 别惊动它` : p.fly ? '它飞走了，跟上' : '溪边 · 清晨';
}
function updateHUDbits() {
  const tgt = nextTarget();
  $('hTarget').textContent = tgt ? `目标：${BEHAVIORS[tgt].name}` : '图鉴已补全';
  $('hFilm').textContent = `胶片 ${film}`;
  updateDistChip();
}
$('hFF').addEventListener('click', () => { speed = speed === 1 ? 4 : 1; $('hFF').textContent = `快进 ×${speed}`; tone(760, 0, .05, .05); });

/* ---------- 菜单与图鉴 ---------- */
function renderMenuBits() {
  const n = ORDER.filter(b => save.recorded[b]).length;
  $('recCount').textContent = `${n} / 3`;
  const tgt = nextTarget();
  $('behTiles').innerHTML = ORDER.map(b => {
    const done = !!save.recorded[b], isT = tgt === b;
    return `<div class="beh ${done ? 'done' : isT ? 'target' : ''}"><b>${BEHAVIORS[b].name}</b><small>${done ? '已记录' : isT ? '本章目标' : '未发现'}</small></div>`;
  }).join('');
  $('goalLine').textContent = tgt ? `目标：清楚拍到「${BEHAVIORS[tgt].name}」，行为有前兆，不靠抽。` : '三种行为已补全，进林地可以自由拍相册。';
}
function renderDex() {
  $('dexList').innerHTML = ORDER.map(b => {
    const B = BEHAVIORS[b], done = !!save.recorded[b];
    return `<div class="dexItem ${done ? 'done' : ''}"><b>${B.name}</b><span class="st">${done ? '已记录' : '未发现'}</span><p>前兆：${B.clues.map(c => c[0]).join('；')}。</p></div>`;
  }).join('');
  $('albGrid').innerHTML = save.album.length ? save.album.map(p => `<figure><img src="${p.img}" alt=""><figcaption>${p.beh === 'idle' ? '停栖' : BEHAVIORS[p.beh].name}${p.ok ? ' · 入册' : ''}</figcaption></figure>`).join('') : '<div class="albEmpty">还没有照片。进林地拍第一张吧。</div>';
}
$('mAlbum').addEventListener('click', () => { renderDex(); PK.show('dexP'); });
$('dexClose').addEventListener('click', () => PK.show(state === 'photo' ? 'photoP' : null));
$('dexOk').addEventListener('click', () => PK.show(state === 'photo' ? 'photoP' : null));
$('doneAlbum').addEventListener('click', () => { renderDex(); PK.show('dexP'); });
$('mHelp').addEventListener('click', () => PK.show('helpP'));
$('helpClose').addEventListener('click', () => PK.show(null));
$('helpOk').addEventListener('click', () => PK.show(null));
function toMenu() { state = 'menu'; PK.show('menu'); $('hud').classList.remove('on'); $('botHud').classList.remove('on'); renderMenuBits(); }
$('hBack').addEventListener('click', toMenu);
$('doneMenu').addEventListener('click', toMenu);
$('mStart').addEventListener('click', () => {
  AU.unlock(); film = 6; focus = 0; focusBox = null;
  state = 'play'; PK.show(null); $('menu').classList.remove('on');
  $('hud').classList.add('on'); $('botHud').classList.add('on');
  setSpot('shade'); updateClues(); updateHUDbits();
  setHint('拖动画面找鸟，按住画面对焦，行为开始时按快门。');
  PK.call('start', {});
});
$('hPause').addEventListener('click', () => {
  state = 'pause';
  $('pInfo').textContent = `已记录 ${ORDER.filter(b => save.recorded[b]).length} / 3 种行为 · 胶片剩 ${film} 张 · 共拍 ${save.shots} 张`;
  PK.show('pauseP');
});
$('pResume').addEventListener('click', () => { state = 'play'; PK.show(null); });
$('pMenu').addEventListener('click', toMenu);
function showDone() {
  state = 'done';
  const last = save.album.find(p => p.beh === 'display') || save.album[0];
  if (last) $('doneImg').src = last.img;
  $('doneRows').innerHTML =
    `<div class="kv"><span>记录行为</span><b>理羽 · 饮水 · 展羽</b></div>` +
    `<div class="kv"><span>总拍摄</span><b>${save.shots} 张</b></div>` +
    `<div class="kv"><span>解锁依据</span><b>发现行为，不是稀有度</b></div>`;
  PK.show('doneP');
}
setInterval(() => { if (state === 'play') updateDistChip(); }, 900);
setInterval(() => { if ((state === 'play' || state === 'menu') && Math.random() < .4) chirp(); }, 7000);
(function music() {
  const seq = [329.6, 392, 493.9, 587.3, 493.9, 392, 329.6, 293.7];
  let i = 0;
  setInterval(() => { if (!AU.on || state !== 'play') return; tone(seq[i++ % seq.length], 0, 1.5, .026, 'triangle', { bus: AU.music, verb: true }); }, 1700);
})();
renderMenuBits(); syncSnd(); updateClues();
window.__WL = { PHASES, get phase() { return phase(); }, setPhase: id => { phaseI = PHASE_IDX[id]; phaseT = 0; onEnterPhase(); }, get focus() { return focus; }, set focus(v) { focus = v; }, shoot, setSpot, get recorded() { return save.recorded; }, visibleFrac, distTo, get film() { return film; }, birdPos: () => birdPos(performance.now() / 1000) };
