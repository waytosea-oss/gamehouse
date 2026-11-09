'use strict';
/* 沙丘化石局 dunefossil — 分层探坑：松土 / 凿 / 细刷，损伤只由粗工具碰到已露出的化石造成（确定规则，无隐藏概率） */
const SAVE_KEY = 'dunefossil_save_v1';
const W = 720, H = 980;
const GX = 60, GY = 235, CELL = 20, COLS = 30, ROWS = 28;
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

const FOSSILS = {
  ammonite: { name: '菊石', src: 'assets/f_ammonite.webp', desc: '螺旋壳室保存完好' },
  trilobite: { name: '三叶虫', src: 'assets/f_trilobite.webp', desc: '头甲与尾甲俱全' },
  fish: { name: '古鱼', src: 'assets/f_fish.webp', desc: '脊骨与肋骨成串' },
  fern: { name: '蕨叶', src: 'assets/f_fern.webp', desc: '叶脉印痕清晰' }
};
const PITS = [
  { name: '三层探坑', sub: '第 1 章', hardHp: 1, halo: 2, budget: 4, layer: '第 3 层 · 保护层下', fossils: [{ key: 'ammonite', cx: 360, cy: 520, w: 300 }] },
  { name: '河岸剖面', sub: '第 2 章', hardHp: 2, halo: 2, budget: 4, layer: '第 3 层 · 保护层下', fossils: [{ key: 'trilobite', cx: 250, cy: 430, w: 190 }, { key: 'fish', cx: 455, cy: 640, w: 250 }] },
  { name: '风蚀崖壁', sub: '第 3 章', hardHp: 2, halo: 3, budget: 3, layer: '第 3 层 · 保护层下', fossils: [{ key: 'fern', cx: 355, cy: 445, w: 290 }, { key: 'ammonite', cx: 360, cy: 700, w: 165 }] }
];
const save = PK.load(SAVE_KEY, { unlocked: 1, pits: {}, cabinet: {}, snd: true });
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
const $ = id => document.getElementById(id);
const sndBtns = [$('mSnd'), $('pSnd')];
function syncSnd() { sndBtns.forEach(b => { if (b) { b.classList.toggle('off', !save.snd); if (b.id === 'pSnd') b.textContent = '音效：' + (save.snd ? '开' : '关'); } }); }
PK.init({ game: 'dunefossil', save, hubButtons: ['mHub', 'pHub'], hubFallback: '../' });
const AU = PK.audio({ vol: .8, music: .08 });
AU.set(save.snd !== false);
const A = {
  tone: (f, d, type, v) => { AU.unlock(); AU.tone(f, AU.t(), d, v, type || 'sine'); },
  noise: (d, f, v) => { AU.unlock(); AU.noise(AU.t(), d, v, f, 1); },
  pluck: (f, d, v) => { AU.unlock(); AU.tone(f, AU.t(), 1.4, v, 'triangle', { bus: AU.music, verb: true }); },
  unlock: () => AU.unlock()
};
for (const b of sndBtns) if (b) b.addEventListener('click', () => { save.snd = !save.snd; AU.set(save.snd); PK.save(SAVE_KEY, save); syncSnd(); });

/* ---------- 探坑状态 ---------- */
let state = 'menu'; // menu play pause extract done
let pitIdx = 0, pit = null;
let sand, hardHp, prot, fId, fClean, fCrack; // 每格
let fossils = []; // {key,name,img,rect,total,exposed,cleaned,cracks,cells[]}
let damage = 0, actions = 0, startT = 0, probeUntil = 0, tool = 'shovel', brushSize = 2, strokeDamaged = new Set();
let pointer = null, lastApply = 0, lastPt = null, parts = [], shake = 0, extractAnim = 0;
const coverCv = document.createElement('canvas'); coverCv.width = COLS * CELL; coverCv.height = ROWS * CELL;
const coverCtx = coverCv.getContext('2d');
const gridCv = document.createElement('canvas'); gridCv.width = COLS * CELL; gridCv.height = ROWS * CELL;
(function drawGrid() {
  const g = gridCv.getContext('2d');
  g.strokeStyle = 'rgba(255,252,240,.28)'; g.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) { g.beginPath(); g.moveTo(c * CELL + .5, 0); g.lineTo(c * CELL + .5, ROWS * CELL); g.stroke(); }
  for (let r = 0; r <= ROWS; r++) { g.beginPath(); g.moveTo(0, r * CELL + .5); g.lineTo(COLS * CELL, r * CELL + .5); g.stroke(); }
  g.fillStyle = 'rgba(255,252,240,.5)'; g.font = '700 9px sans-serif';
  for (let c = 0; c < COLS; c += 5) g.fillText(String.fromCharCode(65 + c / 5), c * CELL + 3, 11);
  for (let r = 0; r < ROWS; r += 5) g.fillText(String(r / 5 + 1), 2, r * CELL + 11);
})();
const seedRand = (c, r, s) => { let x = (c * 73856093) ^ (r * 19349663) ^ (s * 83492791); x = (x ^ (x >> 13)) * 1274126177; return ((x ^ (x >> 16)) >>> 0) / 4294967295; };
const LAYER_COL = { sand: [219, 184, 126], hard: [147, 128, 100], prot: [142, 158, 172], floor: [119, 100, 77] };
function topLayer(i) {
  if (sand[i]) return 'sand';
  if (hardHp[i] > 0) return 'hard';
  if (prot[i]) return 'prot';
  if (fId[i] >= 0) return 'fossil';
  return 'floor';
}
function drawCell(i) {
  const c = i % COLS, r = (i / COLS) | 0, x = c * CELL, y = r * CELL;
  const g = coverCtx, top = topLayer(i);
  g.clearRect(x, y, CELL, CELL);
  if (top === 'fossil' && fClean[i]) return; // 干净露出：透出下面的化石
  let base = LAYER_COL[top === 'fossil' ? 'prot' : top];
  if (top === 'fossil') base = [196, 172, 128]; // 浮土盖住的化石
  const v = (seedRand(c, r, 7) - .5) * 16;
  g.fillStyle = `rgb(${base[0] + v | 0},${base[1] + v | 0},${base[2] + v | 0})`;
  g.fillRect(x, y, CELL, CELL);
  // 斑点质地
  g.fillStyle = top === 'sand' ? 'rgba(160,118,60,.35)' : top === 'hard' ? 'rgba(70,58,40,.4)' : 'rgba(90,110,125,.3)';
  for (let k = 0; k < 3; k++) {
    const dx = seedRand(c, r, 20 + k) * (CELL - 4) + 2, dy = seedRand(c, r, 40 + k) * (CELL - 4) + 2;
    g.fillRect(x + dx, y + dy, 2.2, 2.2);
  }
  if (top === 'fossil' && fCrack[i]) {
    g.strokeStyle = 'rgba(80,40,20,.8)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + 10, y + 10); g.lineTo(x + 8, y + 16); g.moveTo(x + 10, y + 10); g.lineTo(x + 16, y + 13); g.stroke();
  }
}
function redrawAllCells() { for (let i = 0; i < COLS * ROWS; i++) drawCell(i); }

async function loadPit(idx) {
  pitIdx = idx; pit = PITS[idx];
  const N = COLS * ROWS;
  sand = new Uint8Array(N).fill(1); hardHp = new Uint8Array(N).fill(pit.hardHp); prot = new Uint8Array(N);
  fId = new Int16Array(N).fill(-1); fClean = new Uint8Array(N); fCrack = new Uint8Array(N);
  fossils = [];
  for (let fi = 0; fi < pit.fossils.length; fi++) {
    const def = pit.fossils[fi], meta = FOSSILS[def.key];
    const img = await loadImg(meta.src);
    const h = def.w * img.naturalHeight / img.naturalWidth;
    const rect = { x: def.cx - def.w / 2, y: def.cy - h / 2, w: def.w, h };
    // 采样 alpha 定化石格
    const off = document.createElement('canvas'); off.width = Math.max(2, def.w | 0); off.height = Math.max(2, h | 0);
    const og = off.getContext('2d', { willReadFrequently: true }); og.drawImage(img, 0, 0, off.width, off.height);
    const data = og.getImageData(0, 0, off.width, off.height).data;
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const px = GX + c * CELL + CELL / 2, py = GY + r * CELL + CELL / 2;
      if (px < rect.x || px > rect.x + rect.w || py < rect.y || py > rect.y + rect.h) continue;
      const sx = clamp(((px - rect.x) / rect.w * off.width) | 0, 0, off.width - 1), sy = clamp(((py - rect.y) / rect.h * off.height) | 0, 0, off.height - 1);
      if (data[(sy * off.width + sx) * 4 + 3] > 90) { fId[r * COLS + c] = fi; cells.push(r * COLS + c); }
    }
    fossils.push({ key: def.key, name: meta.name, desc: meta.desc, img, rect, total: cells.length, cells, cracks: 0 });
  }
  // 保护层：化石格 + 光环
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (fId[i] >= 0) { prot[i] = 1; continue; }
    let near = false;
    for (let dr = -pit.halo; dr <= pit.halo && !near; dr++) for (let dc = -pit.halo; dc <= pit.halo; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && fId[rr * COLS + cc] >= 0) { near = true; break; }
    }
    if (near) prot[i] = 1;
  }
  damage = 0; actions = 0; strokeDamaged = new Set(); parts = []; extractAnim = 0;
  redrawAllCells(); updateHUD();
}
function fossilStats(f) {
  let exposed = 0, cleaned = 0, protOn = 0;
  for (const i of f.cells) {
    if (prot[i]) { protOn++; continue; }
    if (!sand[i] && hardHp[i] === 0) { exposed++; if (fClean[i]) cleaned++; }
  }
  let glued = 0;
  const cellSet = new Set(f.cells);
  for (const i of f.cells) {
    const c = i % COLS, r = (i / COLS) | 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
      const j = rr * COLS + cc;
      if (!cellSet.has(j) && prot[j] && !sand[j] && hardHp[j] === 0) glued++;
    }
  }
  return { exposed, cleaned, protOn, glued, dusty: exposed - cleaned };
}

/* ---------- 工具施工 ---------- */
const TOOL_R = () => tool === 'shovel' ? 46 : tool === 'chisel' ? 27 : [14, 24, 38][brushSize - 1];
function cellsIn(x, y, rad) {
  const out = [];
  const c0 = clamp(((x - rad - GX) / CELL) | 0, 0, COLS - 1), c1 = clamp(((x + rad - GX) / CELL) | 0, 0, COLS - 1);
  const r0 = clamp(((y - rad - GY) / CELL) | 0, 0, ROWS - 1), r1 = clamp(((y + rad - GY) / CELL) | 0, 0, ROWS - 1);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const cx = GX + c * CELL + CELL / 2, cy = GY + r * CELL + CELL / 2;
    if ((cx - x) ** 2 + (cy - y) ** 2 <= rad * rad) out.push(r * COLS + c);
  }
  return out;
}
function previewState(x, y) {
  const cells = cellsIn(x, y, TOOL_R());
  if (tool !== 'brush') {
    let orange = false;
    for (const i of cells) {
      const t = topLayer(i);
      if (t === 'fossil') return 'danger';
      if (t === 'prot') orange = true;
    }
    if (orange) return 'warn';
  }
  return 'safe';
}
function burst(x, y, col, n) {
  for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - .5) * 22, y: y + (Math.random() - .5) * 22, vx: (Math.random() - .5) * 130, vy: -Math.random() * 130 - 30, g: 340, life: .55, max: .55, r: 2 + Math.random() * 3.4, col });
}
function applyTool(x, y, isStroke) {
  const cells = cellsIn(x, y, TOOL_R());
  let worked = false, sndKind = null;
  for (const i of cells) {
    const t = topLayer(i);
    if (tool === 'shovel') {
      if (t === 'sand') { sand[i] = 0; drawCell(i); worked = true; sndKind = 'sand'; }
      else if (t === 'fossil' && isStroke) doDamage(i);
    } else if (tool === 'chisel') {
      if (t === 'sand') { sand[i] = 0; drawCell(i); worked = true; sndKind = 'sand'; }
      else if (t === 'hard') { hardHp[i]--; drawCell(i); worked = true; sndKind = 'knock'; }
      else if (t === 'fossil' && isStroke) doDamage(i);
    } else {
      if (t === 'prot') { prot[i] = 0; drawCell(i); worked = true; sndKind = 'brush'; }
      else if (t === 'fossil' && !fClean[i]) { fClean[i] = 1; drawCell(i); worked = true; sndKind = 'brush'; }
    }
  }
  if (worked) {
    actions++;
    burst(x, y, tool === 'brush' ? '232,213,170' : tool === 'chisel' ? '150,132,104' : '219,184,126', tool === 'brush' ? 3 : 6);
    if (sndKind === 'sand') A.noise(.09, 500, .12); else if (sndKind === 'knock') { A.tone(170, .05, 'square', .1); A.noise(.04, 1800, .06); } else if (sndKind === 'brush') A.noise(.12, 2600, .05);
    updateHUD();
  }
  refreshStatus(x, y);
}
function doDamage(i) {
  const fi = fId[i];
  if (fi < 0 || strokeDamaged.has(fi)) return;
  strokeDamaged.add(fi);
  damage++; fossils[fi].cracks++;
  for (const j of fossils[fi].cells) { /* 只标记碰到的格 */ }
  fCrack[i] = 1; drawCell(i);
  shake = 7; A.tone(90, .18, 'sawtooth', .22); A.noise(.15, 900, .2);
  PK.vib(60);
  setStatus(`${tool === 'shovel' ? '松土' : '凿'}碰到了露出的${fossils[fi].name}，损伤 +1。这一下记在损伤来源里。`, 'danger');
  updateHUD();
}
function setStatus(t, cls) { const el = $('statusLine'); el.textContent = t; el.className = 'statusLine' + (cls ? ' ' + cls : ''); }
function refreshStatus(x, y) {
  if (state !== 'play') return;
  const ps = previewState(x, y);
  if (tool !== 'brush' && ps === 'danger') { setStatus('预览已变红：粗工具正对着露出的化石，换细刷。', 'danger'); return; }
  if (tool !== 'brush' && ps === 'warn') { setStatus('预览已变橙：粗工具接近保护层，慢一点，换细刷沿边清。', 'warn'); return; }
  phaseHint();
}
function phaseHint() {
  let anySand = false, anyHard = false, anyProt = false;
  for (let i = 0; i < COLS * ROWS; i++) {
    const t = topLayer(i);
    if (t === 'sand') anySand = true; else if (t === 'hard') anyHard = true; else if (t === 'prot') anyProt = true;
  }
  if (tool === 'shovel') setStatus(anySand ? '松土清表层粉砂，大胆扫开安全区。' : '表层已经清完，松土帮不上忙了。');
  else if (tool === 'chisel') setStatus(anyHard ? '凿开硬层，盯紧预览圈的颜色。' : anyProt ? '硬层已开，保护层交给细刷。' : '地层清完，刷净化石就能提取。');
  else setStatus(anyProt ? '细刷清保护层与化石浮土，不会伤到标本。' : '化石表面刷净后，点提取标本。');
  // 层位
  const lv = anySand ? '第 1 层 · 表层粉砂' : anyHard ? '第 2 层 · 硬层' : '第 3 层 · 保护层';
  $('hSub').textContent = lv;
}
function updateHUD() {
  if (!pit) return;
  let exp = 0, tot = 0;
  for (const f of fossils) { const s = fossilStats(f); exp += s.exposed; tot += f.total; }
  $('hProg').textContent = `露出 ${tot ? Math.round(exp / tot * 100) : 0}%`;
  $('hAct').textContent = `动作 ${actions}`;
  $('hDmg').innerHTML = '损伤额度 ' + Array.from({ length: pit.budget }, (_, k) => `<i class="${k < damage ? 'used' : ''}"></i>`).join('') + ` ${damage}/${pit.budget}`;
  phaseHint();
}

/* ---------- 提取 ---------- */
function extractCheck() {
  const report = [];
  for (const f of fossils) {
    const s = fossilStats(f);
    report.push({ f, ...s, ok: s.protOn === 0 && s.dusty === 0 && s.glued === 0 && s.exposed === f.total });
  }
  return report;
}
function tryExtract() {
  if (state !== 'play') return;
  const rep = extractCheck();
  const bad = rep.find(r => !r.ok);
  if (bad) {
    const bits = [];
    if (bad.f.total - bad.exposed - bad.protOn > 0 || bad.protOn > 0) bits.push(`保护层还剩 ${bad.protOn + Math.max(0, bad.f.total - bad.exposed - bad.protOn)} 处`);
    if (bad.dusty > 0) bits.push(`表面浮土 ${bad.dusty} 处`);
    if (bad.glued > 0) bits.push(`边缘黏连 ${bad.glued} 处`);
    PK.toast(`${bad.f.name}还不能提取`);
    setStatus(`${bad.f.name}还黏着：${bits.join('、')}。用细刷沿边缘清干净再提取。`, 'warn');
    A.tone(220, .1, 'sine', .1);
    return;
  }
  state = 'extract'; extractAnim = 0.001;
  A.tone(523, .16, 'sine', .14); setTimeout(() => A.tone(784, .22, 'sine', .12), 130);
  PK.call('extract', { pit: pit.name, damage });
}
function finishExtract() {
  state = 'done';
  const over = damage > pit.budget;
  const rating = damage === 0 ? '完整提取' : over ? '超额提取' : '带伤提取';
  // 存档：展柜取最少损伤记录
  for (const f of fossils) {
    const old = save.cabinet[f.key];
    if (!old || damage < old.dmg) save.cabinet[f.key] = { pit: pitIdx, dmg: damage };
  }
  const prev = save.pits[pitIdx];
  if (!prev || damage < prev.best) save.pits[pitIdx] = { best: damage };
  let unlockedNew = null;
  if (pitIdx + 1 < PITS.length && save.unlocked < pitIdx + 2) { save.unlocked = pitIdx + 2; unlockedNew = PITS[pitIdx + 1]; }
  PK.save(SAVE_KEY, save);
  $('resH').textContent = rating;
  $('resSub').textContent = `${pit.name} · ${fossils.length} 件标本入库`;
  $('resImg').src = fossils[0].img.src;
  $('resCap').textContent = `展柜 · ${fossils.map(f => f.name).join('、')}`;
  const secs = Math.max(1, Math.round((performance.now() - startT) / 1000));
  $('resRows').innerHTML =
    `<div class="kv"><span>发现层位</span><b>${pit.layer}</b></div>` +
    `<div class="kv"><span>损伤</span><b>${damage} / ${pit.budget}${damage === 0 ? ' · 未增加' : ' · 来自粗工具碰到露出化石'}</b></div>` +
    `<div class="kv"><span>提取前</span><b>黏连已全部松开</b></div>` +
    `<div class="kv"><span>动作 / 用时</span><b>${actions} 次 · ${Math.floor(secs / 60)}分${secs % 60}秒</b></div>`;
  $('resUnlock').hidden = !unlockedNew;
  if (unlockedNew) $('resUnlockT').innerHTML = `<b>${unlockedNew.name}</b>（${unlockedNew.sub}）已开放。`;
  $('resNext').textContent = pitIdx + 1 < PITS.length ? '下一坑' : '回探坑列表';
  PK.show('resP'); PK.call('clear', { pit: pit.name, damage, actions });
}

/* ---------- 渲染 ---------- */
function drawBackdrop(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f4e2b2'); g.addColorStop(.55, '#ecd3a0'); g.addColorStop(1, '#e2c28a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 远山沙丘
  ctx.fillStyle = 'rgba(206,164,102,.55)';
  ctx.beginPath(); ctx.moveTo(0, 190);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 190 - Math.sin(x * .008 + 1) * 42 - Math.sin(x * .02) * 12);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = 'rgba(190,148,88,.5)';
  ctx.beginPath(); ctx.moveTo(0, 235);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 235 - Math.sin(x * .01 + 4) * 26);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  // 太阳
  ctx.fillStyle = 'rgba(255,244,200,.85)';
  ctx.beginPath(); ctx.arc(610, 105, 34, 0, TAU); ctx.fill();
}
function drawPit(t) {
  // 地层剖面环（探坑壁）
  const bands = ['#c9a068', '#b28a58', '#9a7a52', '#86704f', '#77644d'];
  for (let k = bands.length - 1; k >= 0; k--) {
    const p = 8 + k * 9;
    ctx.fillStyle = bands[k];
    ctx.beginPath(); ctx.roundRect(GX - p, GY - p, COLS * CELL + p * 2, ROWS * CELL + p * 2, 16 + k * 3); ctx.fill();
  }
  // 坑底
  ctx.fillStyle = '#77644d'; ctx.fillRect(GX, GY, COLS * CELL, ROWS * CELL);
  // 化石层
  const lift = state === 'extract' || state === 'done' ? Math.sin(Math.min(1, extractAnim) * Math.PI * .5) * 46 : 0;
  const fade = state === 'done' ? 0 : 1;
  ctx.save(); ctx.globalAlpha = fade;
  for (const f of fossils) {
    ctx.save();
    if (lift) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; }
    ctx.drawImage(f.img, f.rect.x, f.rect.y - lift, f.rect.w, f.rect.h);
    ctx.restore();
  }
  ctx.restore();
  // 覆盖层
  ctx.drawImage(coverCv, GX, GY);
  ctx.drawImage(gridCv, GX, GY);
  // 探测回波轮廓
  if (performance.now() < probeUntil && (state === 'play')) {
    const pu = .55 + Math.sin(t * .012) * .3;
    ctx.fillStyle = `rgba(110,224,130,${pu})`;
    for (const f of fossils) for (const i of f.cells) {
      const c = i % COLS, r = (i / COLS) | 0;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || fId[rr * COLS + cc] !== fossils.indexOf(f); });
      if (edge) { ctx.beginPath(); ctx.arc(GX + c * CELL + CELL / 2, GY + r * CELL + CELL / 2, 3, 0, TAU); ctx.fill(); }
    }
  }
  // 裂纹标记（露出化石上的损伤）
  // 工具预览
  if (pointer && state === 'play') {
    const ps = previewState(pointer[0], pointer[1]);
    const col = tool === 'brush' ? '110,190,110' : ps === 'danger' ? '216,60,40' : ps === 'warn' ? '232,140,40' : '255,252,240';
    ctx.fillStyle = `rgba(${col},.16)`;
    ctx.strokeStyle = `rgba(${col},.95)`; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(pointer[0], pointer[1], TOOL_R(), 0, TAU); ctx.fill(); ctx.stroke();
  }
}
let lastFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.translate(offX, offY); ctx.scale(scaleK, scaleK);
  if (shake > 0) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake = Math.max(0, shake - dt * 26); }
  drawBackdrop(now);
  if (pit && state !== 'menu') drawPit(now);
  // 粒子
  parts = parts.filter(p => (p.life -= dt) > 0);
  for (const p of parts) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    ctx.fillStyle = `rgba(${p.col},${(p.life / p.max * .9).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
  }
  if (state === 'extract') {
    extractAnim += dt / 1.5;
    if (extractAnim >= 1) finishExtract();
  }
}
requestAnimationFrame(frame);

/* ---------- 输入 ---------- */
function evtPos(e) { const r = cv.getBoundingClientRect(); return toGame(e.clientX - r.left, e.clientY - r.top); }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  A.unlock();
  strokeDamaged = new Set();
  const [x, y] = evtPos(e); pointer = [x, y]; lastPt = [x, y];
  applyTool(x, y, true); lastApply = performance.now();
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (state !== 'play') return;
  const [x, y] = evtPos(e); pointer = [x, y];
  if (e.buttons && lastPt) {
    const dist = Math.hypot(x - lastPt[0], y - lastPt[1]);
    const steps = Math.max(1, Math.min(6, dist / 16 | 0));
    for (let s = 1; s <= steps; s++) applyTool(lastPt[0] + (x - lastPt[0]) * s / steps, lastPt[1] + (y - lastPt[1]) * s / steps, true);
    lastPt = [x, y];
  } else refreshStatus(x, y);
});
const endPointer = () => { pointer = null; lastPt = null; };
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', () => { if (!lastPt) pointer = null; });

/* ---------- 界面 ---------- */
function renderPits() {
  $('pits').innerHTML = PITS.map((p, i) => {
    const locked = i + 1 > save.unlocked;
    const done = save.pits[i];
    return `<button class="pit ${locked ? 'locked' : ''}" data-pit="${i}" ${locked ? 'disabled' : ''}>
      <span class="no">${i + 1}</span>
      <span class="tx"><b>${p.name}</b><small>${p.sub} · ${p.fossils.map(f => FOSSILS[f.key].name).join('、')} · 损伤额度 ${p.budget}</small></span>
      <span class="best">${locked ? '未解锁' : done ? (done.best === 0 ? '完整提取' : `最佳损伤 ${done.best}`) : '未开挖'}</span></button>`;
  }).join('');
  const n = Object.keys(save.cabinet).length;
  $('cabCount').textContent = `展柜 ${n} 件标本`;
  document.querySelectorAll('[data-pit]').forEach(b => b.addEventListener('click', async () => {
    startT = performance.now();
    await loadPit(+b.dataset.pit);
    state = 'play';
    PK.show(null); $('menu').classList.remove('on');
    $('hud').classList.add('on'); $('botHud').classList.add('on');
    $('hName').textContent = pit.name;
    probeUntil = performance.now() + 2800;
    setTool('shovel');
    PK.toast('探测回波标出了化石的大致轮廓');
    PK.call('start', { pit: pit.name });
  }));
}
function setTool(t) {
  tool = t;
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  phaseHint();
}
document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => { setTool(b.dataset.tool); A.tone(660, .05, 'sine', .06); }));
$('brushSize').addEventListener('input', e => { brushSize = +e.target.value; $('brushLab').textContent = ['小', '中', '大'][brushSize - 1]; });
$('bProbe').addEventListener('click', () => { if (state === 'play') { probeUntil = performance.now() + 2600; A.tone(980, .07, 'sine', .07); setTimeout(() => A.tone(1240, .07, 'sine', .05), 90); } });
$('bExtract').addEventListener('click', tryExtract);
$('bSection').addEventListener('click', () => { drawSection(); PK.show('sectionP'); });
$('secClose').addEventListener('click', () => PK.show(null));
$('secOk').addEventListener('click', () => PK.show(null));
$('mHelp').addEventListener('click', () => PK.show('helpP'));
$('helpClose').addEventListener('click', () => PK.show(null));
$('helpOk').addEventListener('click', () => PK.show(null));
function renderCabinet() {
  const keys = Object.keys(FOSSILS);
  $('cabGrid').innerHTML = keys.map(k => {
    const rec = save.cabinet[k];
    if (!rec) return `<div class="cabItem" style="opacity:.45"><img src="${FOSSILS[k].src}" alt=""><b>${FOSSILS[k].name}</b><small>尚未发现</small></div>`;
    return `<div class="cabItem"><img src="${FOSSILS[k].src}" alt=""><b>${FOSSILS[k].name}</b><small>${PITS[rec.pit].name}发现<br>${rec.dmg === 0 ? '完整无伤' : `损伤 ${rec.dmg} · 教学展柜`}<br>${FOSSILS[k].desc}</small></div>`;
  }).join('');
}
$('mCab').addEventListener('click', () => { renderCabinet(); PK.show('cabP'); });
$('cabClose').addEventListener('click', () => PK.show(null));
$('cabOk').addEventListener('click', () => PK.show(null));
$('resCab').addEventListener('click', () => { renderCabinet(); PK.show('cabP'); });
function toMenu() {
  state = 'menu'; PK.show('menu');
  $('hud').classList.remove('on'); $('botHud').classList.remove('on');
  renderPits();
}
$('hBack').addEventListener('click', toMenu);
$('resMenu').addEventListener('click', toMenu);
$('hPause').addEventListener('click', () => {
  state = 'pause';
  $('pInfo').textContent = `${pit.name} · 损伤 ${damage}/${pit.budget} · 动作 ${actions}`;
  PK.show('pauseP');
});
$('pResume').addEventListener('click', () => { state = 'play'; PK.show(null); });
$('pRestart').addEventListener('click', async () => { await loadPit(pitIdx); state = 'play'; startT = performance.now(); probeUntil = performance.now() + 2800; PK.show(null); });
$('pMenu').addEventListener('click', toMenu);
$('resRetry').addEventListener('click', async () => { await loadPit(pitIdx); state = 'play'; startT = performance.now(); PK.show(null); $('hud').classList.add('on'); $('botHud').classList.add('on'); });
$('resNext').addEventListener('click', async () => {
  if (pitIdx + 1 < PITS.length) { await loadPit(pitIdx + 1); state = 'play'; startT = performance.now(); PK.show(null); $('hud').classList.add('on'); $('botHud').classList.add('on'); $('hName').textContent = pit.name; probeUntil = performance.now() + 2800; }
  else toMenu();
});
function drawSection() {
  const c = $('secCv'), g = c.getContext('2d');
  g.clearRect(0, 0, 640, 360);
  g.fillStyle = '#efe0bd'; g.fillRect(0, 0, 640, 360);
  const bx = 40, bw = 560, top = 46, unit = 86;
  // 每列统计剩余层厚
  for (let col = 0; col < COLS; col++) {
    let sN = 0, hN = 0, pN = 0, fos = false;
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + col;
      if (sand[i]) sN++; if (hardHp[i] > 0) hN++; if (prot[i]) pN++;
      if (fId[i] >= 0) fos = true;
    }
    const x = bx + col * (bw / COLS);
    let y = top;
    const hs = sN / ROWS * unit, hh = hN / ROWS * unit * 1.4, hp = pN / ROWS * unit * .8;
    g.fillStyle = '#d9ae72'; g.fillRect(x, y, bw / COLS - 1, hs); y += hs;
    g.fillStyle = '#8d7c66'; g.fillRect(x, y, bw / COLS - 1, hh); y += hh;
    g.fillStyle = '#7d94a6'; g.fillRect(x, y, bw / COLS - 1, hp); y += hp;
    if (fos) { g.fillStyle = '#efe3c2'; g.strokeStyle = '#b8a878'; g.fillRect(x, 268, bw / COLS - 1, 34); g.strokeRect(x, 268, bw / COLS - 1, 34); }
    g.fillStyle = '#77644d'; g.fillRect(x, 302, bw / COLS - 1, 22);
  }
  g.fillStyle = '#7a4d16'; g.font = '700 13px sans-serif';
  g.fillText('地表', bx, top - 10);
  g.fillText('化石层位', bx, 262);
  g.fillText('基岩', bx, 340);
}
renderPits(); syncSnd();
/* 生成式环境音乐：稀疏拨弦（沙漠） */
(function music() {
  const seq = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9];
  let i = 0;
  setInterval(() => {
    if (!AU.on || state !== 'play') return;
    A.pluck(seq[i++ % seq.length], .5, .028);
  }, 1500);
})();
window.__DF = { PITS, FOSSILS, get state() { return state; }, loadPit, applyTool, setTool: t => { tool = t; }, extractCheck, tryExtract, cells: () => ({ sand, hardHp, prot, fId, fClean }), fossils: () => fossils, get damage() { return damage; }, stats: f => fossilStats(f) };
