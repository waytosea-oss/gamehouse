'use strict';
/* 方寸生态 tinyeco — 六角生态拼岛：三物种公开条件、河流接口、有限补片、每步可复盘 */
const SAVE_KEY = 'tinyeco_save_v1';
const W = 720, H = 980, HS = 47, BCX = 360, BCY = 448, SQ3 = Math.sqrt(3);
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
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q, r) => q + ',' + r;
const TYPES = {
  water: { name: '水面', src: 'assets/t_water.webp' },
  forest: { name: '林地', src: 'assets/t_forest.webp' },
  grass: { name: '草地', src: 'assets/t_grass.webp' },
  wetland: { name: '湿地', src: 'assets/t_wetland.webp' },
  sand: { name: '沙地', src: 'assets/t_sand.webp' }
};
const SPECIES = [
  { id: 'deer', name: '鹿', img: 'assets/a_deer.webp', cond: '林地连片 ≥ 4', metric: 'forest' },
  { id: 'rabbit', name: '兔', img: 'assets/a_rabbit.webp', cond: '草林相邻边 ≥ 2', metric: 'edges' },
  { id: 'heron', name: '苍鹭', img: 'assets/a_heron.webp', cond: '连续水岸 ≥ 3', metric: 'shore' }
];
const T = (type, river) => ({ type, river: river || null });
const CHAPTERS = [
  {
    name: '修复小岛', sub: '教学章', seeds: [[0, 0, 'forest'], [1, 0, 'sand'], [2, -1, 'water']],
    tiles: [T('wetland', 'bend'), T('forest'), T('grass'), T('water'), T('sand'), T('grass', 'straight'), T('forest'), T('wetland'), T('grass'), T('forest'), T('sand'), T('water'), T('wetland'), T('forest'), T('grass')],
    bonus: [T('wetland'), T('forest'), T('grass'), T('water')]
  },
  {
    name: '干旱修复', sub: '进阶章 · 沙地多、湿地少', seeds: [[0, 0, 'sand'], [1, 0, 'sand'], [2, -1, 'water']],
    tiles: [T('grass'), T('sand'), T('forest'), T('wetland', 'bend'), T('grass'), T('sand'), T('forest'), T('grass', 'straight'), T('water'), T('forest'), T('wetland'), T('grass'), T('sand'), T('forest'), T('grass')],
    bonus: [T('grass'), T('wetland'), T('forest'), T('water')]
  }
];
const save = PK.load(SAVE_KEY, { unlocked: 1, done: {}, snd: true });
const $ = id => document.getElementById(id);
const sndBtns = [$('mSnd'), $('pSnd')];
function syncSnd() { sndBtns.forEach(b => { if (b) { b.classList.toggle('off', !save.snd); if (b.id === 'pSnd') b.textContent = '音效：' + (save.snd ? '开' : '关'); } }); }
PK.init({ game: 'tinyeco', save, hubButtons: ['mHub', 'pHub'], hubFallback: '../' });
const AU = PK.audio({ vol: .8, music: .07 });
AU.set(save.snd !== false);
function tone(f, t, d, v, type, o) { AU.unlock(); AU.tone(f, AU.t() + (t || 0), d, v, type || 'sine', o); }
function noiseS(t, d, v, f, q) { AU.unlock(); AU.noise(AU.t() + (t || 0), d, v, f, q || 1); }
for (const b of sndBtns) if (b) b.addEventListener('click', () => { save.snd = !save.snd; AU.set(save.snd); PK.save(SAVE_KEY, save); syncSnd(); });

/* ---------- 纯逻辑（可独立求解） ---------- */
function riverEdges(tile, rot) {
  if (tile.type === 'water') return [0, 1, 2, 3, 4, 5];
  if (!tile.river) return [];
  const local = tile.river === 'straight' ? [0, 3] : [0, 2];
  return local.map(e => (e + (rot || 0)) % 6);
}
function metrics(board) {
  const tiles = [...board.entries()].map(([k, v]) => ({ k, q: v.q, r: v.r, type: v.type, edges: v.edges }));
  const byKey = new Map(tiles.map(t => [t.k, t]));
  const groupMax = pred => {
    const seen = new Set(); let best = 0, anchor = null;
    for (const t of tiles) {
      if (!pred(t) || seen.has(t.k)) continue;
      let n = 0; const stack = [t]; seen.add(t.k);
      while (stack.length) { const c = stack.pop(); n++; for (const [dq, dr] of DIRS) { const nk = key(c.q + dq, c.r + dr); const nb = byKey.get(nk); if (nb && pred(nb) && !seen.has(nk)) { seen.add(nk); stack.push(nb); } } }
      if (n > best) { best = n; anchor = t.k; }
    }
    return { n: best, anchor };
  };
  const forest = groupMax(t => t.type === 'forest');
  let edges = 0, rabbitAnchor = null;
  for (const t of tiles) if (t.type === 'grass') {
    let has = false;
    for (const [dq, dr] of DIRS) { const nb = byKey.get(key(t.q + dq, t.r + dr)); if (nb && nb.type === 'forest') { edges++; has = true; } }
    if (has && !rabbitAnchor) rabbitAnchor = t.k;
  }
  const isShore = t => t.type !== 'water' && DIRS.some(([dq, dr]) => { const nb = byKey.get(key(t.q + dq, t.r + dr)); return nb && nb.type === 'water'; });
  const shore = groupMax(isShore);
  let breaks = 0; const breakEdges = [];
  for (const t of tiles) { if (t.type === 'water') continue; for (const e of t.edges) {
    const [dq, dr] = DIRS[e];
    const nb = byKey.get(key(t.q + dq, t.r + dr));
    if (nb && !nb.edges.includes((e + 3) % 6)) { breaks++; breakEdges.push(t.k + ':' + e); }
  } }
  const m = {
    forest: forest.n, edges, shore: shore.n, breaks,
    quality: Math.max(10, 100 - breaks * 18),
    anchors: { deer: forest.anchor, rabbit: rabbitAnchor, heron: shore.anchor },
    types: new Set(tiles.map(t => t.type)).size
  };
  m.met = { deer: m.forest >= 4, rabbit: m.edges >= 2, heron: m.shore >= 3 };
  m.metCount = (m.met.deer ? 1 : 0) + (m.met.rabbit ? 1 : 0) + (m.met.heron ? 1 : 0);
  return m;
}
function frontier(board) {
  const out = new Set();
  for (const v of board.values()) for (const [dq, dr] of DIRS) {
    const q = v.q + dq, r = v.r + dr, k = key(q, r);
    if (!board.has(k) && Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 4) out.add(k);
  }
  return [...out];
}
function createState(chIdx) {
  const ch = CHAPTERS[chIdx];
  const board = new Map();
  for (const [q, r, type] of ch.seeds) board.set(key(q, r), { q, r, type, edges: riverEdges({ type }, 0), seed: true });
  const queue = ch.tiles.map(t => ({ ...t, rot: 0 }));
  const hand = queue.splice(0, 3);
  return { chIdx, board, hand, queue, bonus: [...ch.bonus], bonusUsed: 0, log: [], placed: 0, metBefore: { deer: false, rabbit: false, heron: false } };
}
function applyPlace(G, handIdx, k, rot) {
  const tile = G.hand[handIdx];
  if (!tile) return null;
  const [q, r] = k.split(',').map(Number);
  const before = metrics(G.board);
  const placedTile = { q, r, type: tile.type, edges: riverEdges(tile, rot != null ? rot : tile.rot || 0) };
  G.board.set(k, placedTile);
  const after = metrics(G.board);
  G.hand.splice(handIdx, 1);
  if (G.queue.length) G.hand.push(G.queue.shift());
  G.placed++;
  const newSpecies = SPECIES.filter(s => after.met[s.id] && !before.met[s.id]);
  for (const s of newSpecies) {
    if (G.bonusUsed < 3) {
      const add = G.bonus.splice(0, 2);
      G.queue.push(...add); G.bonusUsed++;
    }
  }
  G.log.push({ n: G.placed, type: tile.type, k, before, after, newSpecies: newSpecies.map(s => s.id) });
  return { before, after, newSpecies, placedTile };
}
function tilesLeft(G) { return G.hand.filter(Boolean).length + G.queue.length; }

/* ---------- 界面状态 ---------- */
let state = 'menu';
let G = null, chIdx = 0, selChap = 0, sel = 0, preview = null, satisfiedAt = {}, lastPlaced = null, parts = [];
let imgs = {};
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
(async () => {
  for (const k in TYPES) imgs[k] = await loadImg(TYPES[k].src);
  for (const s of SPECIES) imgs[s.id] = await loadImg(s.img);
  renderChaps();
})();
const hexXY = (q, r) => [BCX + HS * 1.5 * q, BCY + HS * SQ3 * (r + q / 2)];
function hexPath(x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; const px = x + s * Math.cos(a), py = y + s * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}
function edgeMid(q, r, e) {
  const [x, y] = hexXY(q, r), [dq, dr] = DIRS[e], [nx, ny] = hexXY(q + dq, r + dr);
  return [(x + nx) / 2, (y + ny) / 2];
}
function drawStream(q, r, edges, alpha) {
  if (!edges.length) return;
  const [x, y] = hexXY(q, r);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#7fb8d8'; ctx.lineCap = 'round';
  if (edges.length >= 6) { // 水面：涟漪
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.55)';
    const ph = (performance.now() / 900 + (q * 7 + r * 13) % 5) % 1;
    ctx.beginPath(); ctx.arc(x, y, 6 + ph * 16, 0, TAU); ctx.globalAlpha = alpha * (1 - ph) * .8; ctx.stroke();
  } else if (edges.length === 2) {
    const [ax, ay] = edgeMid(q, r, edges[0]), [bx, by] = edgeMid(q, r, edges[1]);
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(x, y, bx, by); ctx.stroke();
    ctx.strokeStyle = '#d6eefb'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(x, y, bx, by); ctx.stroke();
  } else if (edges.length === 1) {
    const [ax, ay] = edgeMid(q, r, edges[0]);
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke();
  }
  ctx.restore();
}
function drawTile(q, r, tile, edges, scale, alpha) {
  const [x, y] = hexXY(q, r);
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y);
  ctx.globalAlpha = alpha;
  hexPath(x, y, HS - 1.5);
  ctx.save(); ctx.clip();
  const img = imgs[tile.type];
  if (img) ctx.drawImage(img, x - HS, y - HS * SQ3 / 2 - 4, HS * 2, HS * SQ3 + 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(88,104,54,.4)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
  drawStream(q, r, edges, alpha);
}
let lastFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.translate(offX, offY); ctx.scale(scaleK, scaleK);
  // 底
  ctx.fillStyle = '#f2ead2'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(163,177,132,.16)';
  for (let i = 0; i < 40; i++) { const x = (i * 173) % W, y = (i * 289) % H; ctx.beginPath(); ctx.arc(x, y, 3 + (i % 4), 0, TAU); ctx.fill(); }
  if (G && state !== 'menu') {
    const m = metrics(G.board);
    // 岛影
    ctx.fillStyle = 'rgba(120,134,84,.18)';
    ctx.beginPath(); ctx.ellipse(BCX, BCY + 26, 320, 300, 0, 0, TAU); ctx.fill();
    // 空位虚线
    if (state === 'play' && !preview) {
      ctx.save(); ctx.setLineDash([6, 6]);
      for (const k of frontier(G.board)) {
        const [q, r] = k.split(',').map(Number), [x, y] = hexXY(q, r);
        hexPath(x, y, HS - 3);
        ctx.fillStyle = `rgba(255,255,255,${.14 + Math.sin(now / 480) * .05})`; ctx.fill();
        ctx.strokeStyle = 'rgba(100,150,50,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.restore();
    }
    // 已放地块
    const sorted = [...G.board.entries()].sort((a, b) => a[1].r - b[1].r || a[1].q - b[1].q);
    for (const [k, t] of sorted) {
      let sc = 1;
      if (lastPlaced && lastPlaced.k === k) { const p = clamp((now - lastPlaced.t) / 380, 0, 1); sc = .55 + .45 * (1 - Math.pow(1 - p, 3)); }
      drawTile(t.q, t.r, t, t.edges, sc, 1);
    }
    // 断流标记
    ctx.save(); ctx.strokeStyle = '#d84a35'; ctx.lineWidth = 3.4; ctx.setLineDash([5, 4]);
    for (const be of m.breakEdges || []) { }
    for (const [k, t] of G.board) { if (t.type === 'water') continue; for (const e of t.edges) {
      const [dq, dr] = DIRS[e], nb = G.board.get(key(t.q + dq, t.r + dr));
      if (nb && !nb.edges.includes((e + 3) % 6)) {
        const [mx, my] = edgeMid(t.q, t.r, e);
        ctx.beginPath(); ctx.arc(mx, my, 8, 0, TAU); ctx.stroke();
      }
    } }
    ctx.restore();
    // 预览幽灵
    if (preview && state === 'play') {
      const [q, r] = preview.k.split(',').map(Number);
      const tile = G.hand[sel];
      if (tile) drawTile(q, r, tile, riverEdges(tile, tile.rot || 0), 1, .62);
    }
    // 物种
    for (const s of SPECIES) {
      if (!m.met[s.id]) continue;
      const ak = m.anchors[s.metric === 'forest' ? 'deer' : s.metric === 'edges' ? 'rabbit' : 'heron'];
      if (!ak) continue;
      const t = G.board.get(ak); if (!t) continue;
      const [x, y] = hexXY(t.q, t.r);
      const born = satisfiedAt[s.id] || 0;
      const pop = clamp((now - born) / 420, 0, 1), sc = .4 + .6 * (1 - Math.pow(1 - pop, 3));
      const img = imgs[s.id], ih = 56 * sc, iw = img ? ih * img.naturalWidth / img.naturalHeight : ih;
      const bob = Math.sin(now / 420 + s.id.length) * 2.4;
      if (img) ctx.drawImage(img, x - iw / 2, y - ih + 16 + bob, iw, ih);
    }
    // 粒子
    parts = parts.filter(p => (p.life -= dt) > 0);
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
      ctx.fillStyle = `rgba(120,170,80,${(p.life / p.max).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
  }
}
requestAnimationFrame(frame);
function burst(x, y) { for (let i = 0; i < 10; i++) parts.push({ x, y, vx: (Math.random() - .5) * 150, vy: -Math.random() * 130 - 30, life: .6, max: .6, r: 2 + Math.random() * 3 }); }

/* ---------- 交互 ---------- */
function specProgress(m) {
  return { deer: m.forest, rabbit: m.edges, heron: m.shore };
}
function specGoal(id) { return id === 'deer' ? 4 : id === 'rabbit' ? 2 : 3; }
function renderTray() {
  $('tray').innerHTML = G.hand.map((t, i) => t ? `<button class="tileCard ${i === sel ? 'on' : ''}" data-hand="${i}"><img src="${TYPES[t.type].src}" alt=""><b>${TYPES[t.type].name}</b><small>${t.river ? '带河道 · 可旋转' : '普通地块'}</small></button>` : '').join('');
  document.querySelectorAll('[data-hand]').forEach(b => b.addEventListener('click', () => {
    sel = +b.dataset.hand; preview = null; PK.show(null);
    $('bRotate').hidden = !(G.hand[sel] && G.hand[sel].river);
    renderTray(); tone(600, 0, .05, .05);
  }));
  $('hLeft').textContent = `剩余地块 ${tilesLeft(G)}`;
  const m = metrics(G.board);
  $('hSpec').textContent = `物种 ${m.metCount} / 3`;
  $('hQual').style.width = m.quality + '%';
  // 反馈行
  const fb = [];
  if (m.met.deer) fb.push('森林充足'); else fb.push(`林地连片 ${m.forest}/4`);
  if (m.met.heron) fb.push('水岸成链'); else fb.push(`连续水岸 ${m.shore}/3`);
  if (!m.met.rabbit) fb.push(`草林边 ${m.edges}/2`);
  if (m.breaks) fb.push(`<span class="bad">断流 ${m.breaks} 处</span>`);
  $('feedback').innerHTML = fb.join(' · ');
  $('bRotate').hidden = !(G.hand[sel] && G.hand[sel].river);
}
function rotateSel() {
  const t = G.hand[sel];
  if (!t || !t.river) return;
  t.rot = ((t.rot || 0) + 1) % 6;
  tone(520, 0, .05, .05);
  if (preview) openPreview(preview.k, true);
}
$('bRotate').addEventListener('click', rotateSel);
function simAt(k) {
  const tile = G.hand[sel];
  const [q, r] = k.split(',').map(Number);
  const board2 = new Map(G.board);
  board2.set(k, { q, r, type: tile.type, edges: riverEdges(tile, tile.rot || 0) });
  return { before: metrics(G.board), after: metrics(board2) };
}
function openPreview(k, keepOpen) {
  const tile = G.hand[sel];
  if (!tile) return;
  preview = { k };
  const { before, after } = simAt(k);
  const pb = specProgress(before), pa = specProgress(after);
  $('prevTitle').textContent = `放下${TYPES[tile.type].name}`;
  $('prevSub').textContent = `预览：这片${TYPES[tile.type].name}落下后，指标这样变`;
  $('prevList').innerHTML = SPECIES.map(s => {
    const b = pb[s.id], a = pa[s.id], goal = specGoal(s.id);
    const doneNow = a >= goal, wasDone = b >= goal;
    return `<div class="prevItem"><img src="${s.img}" alt=""><span class="tx"><b>${s.name}</b><small>${s.cond}</small></span><span class="delta ${doneNow ? 'done' : a > b ? '' : 'flat'}">${b} → ${a}${doneNow ? ' ✓' : ''}</span></div>`;
  }).join('');
  const warns = [];
  if (after.breaks > before.breaks) warns.push(`这片的河口对着干地，会新增断流 ${after.breaks - before.breaks} 处，水质下降。`);
  if (tile.type === 'forest' && after.forest === before.forest) warns.push('这片林地没有连上现有林群，鹿的进度不会涨。先贴着林放。');
  if (tile.type === 'water' && after.shore === before.shore && !after.met.heron) warns.push('这片水面没有挨着陆地形成新水岸，苍鹭的进度不会涨。');
  $('prevWarn').hidden = !warns.length;
  $('prevWarn').textContent = warns.join(' ');
  $('prevQual').style.width = after.quality + '%';
  $('prevQualT').textContent = `${before.quality} → ${after.quality}`;
  $('prevRotate').style.display = tile.river ? '' : 'none';
  PK.show('prevP');
}
function closePreview() { preview = null; PK.show(null); }
$('prevClose').addEventListener('click', closePreview);
$('prevCancel').addEventListener('click', closePreview);
$('prevRotate').addEventListener('click', rotateSel);
$('prevPlace').addEventListener('click', () => {
  if (!preview) return;
  const k = preview.k, tile = G.hand[sel];
  const [qx, ry] = k.split(',').map(Number), [px, py] = hexXY(qx, ry);
  const res = applyPlace(G, sel, k, tile.rot || 0);
  preview = null; PK.show(null);
  lastPlaced = { k, t: performance.now() };
  burst(px, py);
  noiseS(0, .08, .14, 300, 1); tone(140, 0, .09, .12, 'triangle');
  sel = 0;
  for (const s of res.newSpecies) {
    satisfiedAt[s.id] = performance.now();
    PK.toast(`${s.name}来了，补片 +2`);
    tone(660, 0, .12, .09); tone(880, .09, .14, .09); tone(1174, .18, .2, .08);
    PK.call('species', { species: s.id });
  }
  renderTray();
  const m = res.after;
  if (m.metCount === 3) return finishGame(true, m);
  if (tilesLeft(G) === 0) return finishGame(false, m);
});
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || preview) return;
  AU.unlock();
  const [x, y] = toGame(e.clientX - cv.getBoundingClientRect().left, e.clientY - cv.getBoundingClientRect().top);
  // 命中空格
  let best = null, bd = 1e9;
  for (const k of frontier(G.board)) {
    const [q, r] = k.split(',').map(Number), [hx, hy] = hexXY(q, r);
    const d = Math.hypot(hx - x, hy - y);
    if (d < bd) { bd = d; best = k; }
  }
  if (best && bd < HS * 1.05 && G.hand[sel]) { openPreview(best); tone(700, 0, .04, .04); return; }
  // 命中已放地块：报信息
  for (const [k, t] of G.board) {
    const [hx, hy] = hexXY(t.q, t.r);
    if (Math.hypot(hx - x, hy - y) < HS * .95) {
      const role = t.type === 'water' ? '水系的一段' : t.edges.length ? '带着河道' : '已固定';
      PK.toast(`${TYPES[t.type].name} · ${role}`);
      return;
    }
  }
});
/* ---------- 需求面板 ---------- */
function renderNeeds() {
  const m = G ? metrics(G.board) : null;
  const p = m ? specProgress(m) : { deer: 0, rabbit: 0, heron: 0 };
  $('needList').innerHTML = SPECIES.map(s => `<div class="needItem"><img src="${s.img}" alt=""><span class="tx"><b>${s.name}</b><small>${s.cond} · 当前 ${p[s.id]} / ${specGoal(s.id)}${m && m.met[s.id] ? ' · 已出现' : ''}</small></span></div>`).join('');
}
$('bNeeds').addEventListener('click', () => { renderNeeds(); PK.show('needsP'); });
$('needsClose').addEventListener('click', () => PK.show(null));
$('needsOk').addEventListener('click', () => PK.show(null));
$('mHelp').addEventListener('click', () => PK.show('helpP'));
$('helpClose').addEventListener('click', () => PK.show(null));
$('helpOk').addEventListener('click', () => PK.show(null));
/* ---------- 章节与结算 ---------- */
function renderChaps() {
  $('chaps').innerHTML = CHAPTERS.map((c, i) => {
    const locked = i + 1 > save.unlocked, done = save.done[i];
    return `<button class="chap ${locked ? 'locked' : ''} ${i === selChap ? 'sel' : ''}" data-chap="${i}" ${locked ? 'disabled' : ''}>
      <span class="no">${i + 1}</span>
      <span class="tx"><b>${c.name}</b><small>${c.sub} · ${c.tiles.length} 片地块 · 三物种</small></span>
      <span class="best">${locked ? '未解锁' : done ? '已修复' : '未完成'}</span></button>`;
  }).join('');
  document.querySelectorAll('[data-chap]').forEach(b => b.addEventListener('click', () => { selChap = +b.dataset.chap; renderChaps(); $('mStart').textContent = `开始拼岛 · ${CHAPTERS[selChap].name}`; $('goalLine').textContent = `目标：${CHAPTERS[selChap].tiles.length} 片内，三物种出现且连通。`; }));
  $('mStart').textContent = `开始拼岛 · ${CHAPTERS[selChap].name}`;
}
function startChapter(i) {
  chIdx = i; G = createState(i); sel = 0; preview = null; satisfiedAt = {}; lastPlaced = null;
  // 已满足的物种（种子自带）标记
  const m0 = metrics(G.board);
  for (const s of SPECIES) if (m0.met[s.id]) satisfiedAt[s.id] = performance.now();
  state = 'play';
  PK.show(null); $('menu').classList.remove('on');
  $('hud').classList.add('on'); $('botHud').classList.add('on');
  $('hName').textContent = CHAPTERS[i].name;
  renderTray();
  PK.call('start', { chapter: CHAPTERS[i].name });
}
$('mStart').addEventListener('click', () => { AU.unlock(); startChapter(selChap); });
function finishGame(won, m) {
  state = 'done';
  const ch = CHAPTERS[chIdx];
  if (won) {
    save.done[chIdx] = { left: tilesLeft(G) };
    if (chIdx + 1 < CHAPTERS.length && save.unlocked < chIdx + 2) save.unlocked = chIdx + 2;
    PK.save(SAVE_KEY, save);
  }
  $('resH').textContent = won ? '三物种连通' : '还差一点';
  $('resSub').textContent = `${ch.name} · 生态反馈已记录`;
  $('resSpecs').innerHTML = SPECIES.map(s => `<div class="resSpec ${m.met[s.id] ? 'done' : ''}"><img src="${s.img}" alt=""><b>${s.name}</b><small>${m.met[s.id] ? '已出现 ✓' : '未出现'}</small></div>`).join('');
  const bonusTiles = G.bonusUsed * 2;
  $('resRows').innerHTML =
    `<div class="kv"><span>迁徙通道</span><b>${m.metCount} / 3 已连通</b></div>` +
    `<div class="kv"><span>剩余地块</span><b>${tilesLeft(G)} 片</b></div>` +
    `<div class="kv"><span>补片奖励</span><b>+${bonusTiles} 片（${G.bonusUsed} / 3 次）</b></div>` +
    `<div class="kv"><span>水质</span><b>${m.quality}${m.breaks ? ` · 断流 ${m.breaks} 处` : ' · 无断流'}</b></div>` +
    (won ? '' : `<div class="kv"><span>还差</span><b>${SPECIES.filter(s => !m.met[s.id]).map(s => `${s.name}（${s.cond}）`).join('；')}</b></div>`);
  const hasNext = chIdx + 1 < CHAPTERS.length;
  $('resUnlock').hidden = !(won && hasNext);
  if (won && hasNext) $('resUnlockT').innerHTML = `<b>${CHAPTERS[chIdx + 1].name}</b>（${CHAPTERS[chIdx + 1].sub}）已开放。`;
  $('resNext').textContent = won ? (hasNext ? '下一章' : '回章节列表') : '再试一次';
  PK.show('resP');
  if (won) { tone(523, 0, .14, .1); tone(659, .1, .14, .1); tone(784, .2, .22, .1); }
  PK.call('finish', { chapter: ch.name, won });
}
$('resNext').addEventListener('click', () => {
  if (state !== 'done') return;
  if (CHAPTERS[chIdx] && save.done[chIdx] && chIdx + 1 < CHAPTERS.length) startChapter(chIdx + 1);
  else if (!save.done[chIdx]) startChapter(chIdx);
  else toMenu();
});
$('resRetry').addEventListener('click', () => startChapter(chIdx));
$('resReplay').addEventListener('click', () => {
  $('replayList').innerHTML = G.log.map(s => {
    const pb = specProgress(s.before), pa = specProgress(s.after);
    const ch = SPECIES.filter(sp => pa[sp.id] !== pb[sp.id]).map(sp => `${sp.name} ${pb[sp.id]}→${pa[sp.id]}`).join('，');
    return `<div class="replayItem"><span class="n">${s.n}</span><b>${TYPES[s.type].name}</b><span>${ch || '指标无变化'}${s.newSpecies.length ? ` · ${s.newSpecies.join('、')} 出现，补片 +2` : ''}${s.after.breaks > s.before.breaks ? ' · 断流 +1' : ''}</span></div>`;
  }).join('') || '<div class="replayItem">还没有放置记录。</div>';
  PK.show('replayP');
});
$('replayClose').addEventListener('click', () => PK.show('resP'));
$('replayOk').addEventListener('click', () => PK.show('resP'));
function toMenu() { state = 'menu'; PK.show('menu'); $('hud').classList.remove('on'); $('botHud').classList.remove('on'); renderChaps(); }
$('hBack').addEventListener('click', toMenu);
$('resMenu').addEventListener('click', toMenu);
$('hPause').addEventListener('click', () => {
  const m = metrics(G.board);
  $('pInfo').textContent = `${CHAPTERS[chIdx].name} · 物种 ${m.metCount}/3 · 剩余地块 ${tilesLeft(G)} · 已放 ${G.placed} 片`;
  state = 'pause'; PK.show('pauseP');
});
$('pResume').addEventListener('click', () => { state = 'play'; PK.show(null); });
$('pRestart').addEventListener('click', () => startChapter(chIdx));
$('pMenu').addEventListener('click', toMenu);
(function music() {
  const seq = [261.6, 329.6, 392, 329.6, 293.7, 349.2, 440, 392];
  let i = 0;
  setInterval(() => { if (!AU.on || state !== 'play') return; tone(seq[i++ % seq.length], 0, 1.4, .024, 'triangle', { bus: AU.music, verb: true }); }, 1600);
})();
renderChaps(); syncSnd();
window.__TE = { CHAPTERS, createState, applyPlace, metrics, frontier, tilesLeft, get G() { return G; }, startChapter, get state() { return state; } };
