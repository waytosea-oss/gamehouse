/* 弹岛球会：固定步长物理的迷你高尔夫。同输入必同落点，回放即重演。 */
(function () {
  'use strict';
  var $ = PK.$;
  var LW = 720, LH = 980, DT = 1 / 240, BALL_R = 11;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function blob(cx, cy, rx, ry, wob, seed) {
    var rnd = mulberry32(seed), pts = [], n = 18;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, w = 1 + (rnd() - .5) * 2 * wob;
      pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
    }
    return pts;
  }
  function inPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToEdge(x, y, poly) {
    var best = 1e9;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, distSeg(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d);
    return best;
  }
  function distSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    var t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
    var cx = ax + t * dx, cy = ay + t * dy;
    return { d: Math.hypot(px - cx, py - cy), cx: cx, cy: cy, nx: px - cx, ny: py - cy };
  }

  /* ---------- 球洞 ---------- */
  var HOLES = [
    { name: '第一座球岛', sub: '直线热身', par: 2, limit: 5, tee: [360, 800], cup: [360, 195],
      land: blob(360, 490, 235, 400, .05, 11),
      rails: [ { a: [185, 705], b: [185, 320], t: 'hard' }, { a: [535, 705], b: [535, 320], t: 'hard' }, { a: [268, 168], b: [452, 168], t: 'hard' } ],
      baffle: null, slope: null, tide: 0, mill: null,
      decor: [['palm', 235, 300, .9], ['succ', 500, 640, .8], ['flower', 480, 260, .7], ['coral', 240, 660, .8]] },
    { name: '直角墙', sub: '借墙过弯', par: 3, limit: 6, tee: [225, 790], cup: [455, 235],
      land: [[150, 880], [430, 880], [430, 470], [595, 470], [595, 150], [300, 150], [300, 560], [150, 560]],
      rails: [ { a: [300, 548], b: [406, 494], t: 'hard' }, { a: [168, 855], b: [168, 585], t: 'hard' }, { a: [572, 445], b: [572, 175], t: 'hard' }, { a: [325, 172], b: [560, 172], t: 'hard' } ],
      baffle: { pivot: [368, 628], len: 118, base: -1.15, presets: [-.6, 0, .6] },
      slope: null, tide: 0, mill: null,
      decor: [['palm', 490, 330, .85], ['succ', 215, 640, .75], ['coral', 520, 560, .8], ['flower', 350, 250, .65]] },
    { name: '软墙湾', sub: '软墙吃掉球速', par: 3, limit: 6, tee: [235, 790], cup: [505, 220],
      land: blob(360, 490, 250, 410, .06, 33),
      rails: [ { a: [175, 515], b: [320, 442], t: 'soft' }, { a: [400, 442], b: [545, 515], t: 'soft' },
               { a: [150, 780], b: [150, 560], t: 'hard' }, { a: [570, 780], b: [570, 560], t: 'hard' }, { a: [290, 158], b: [470, 158], t: 'hard' } ],
      baffle: null, slope: null, tide: 0, mill: null,
      decor: [['coral', 360, 560, .95], ['palm', 250, 250, .85], ['succ', 505, 700, .8], ['star', 300, 880, .8]] },
    { name: '坡心岛', sub: '坡面会推球', par: 3, limit: 6, tee: [360, 820], cup: [360, 185],
      land: blob(360, 490, 245, 405, .05, 47),
      rails: [ { a: [172, 720], b: [172, 300], t: 'hard' }, { a: [548, 720], b: [548, 300], t: 'hard' }, { a: [262, 155], b: [458, 155], t: 'hard' },
               { a: [238, 640], b: [482, 640], t: 'soft' } ],
      baffle: null, slope: { x: 350, y: 470, r: 155, ax: 205, ay: -30 }, tide: 0, mill: null,
      decor: [['palm', 480, 260, .85], ['flower', 235, 380, .7], ['succ', 250, 760, .8], ['coral', 500, 780, .75]] },
    { name: '潮汐岛', sub: '涨潮会淹没岛缘', par: 4, limit: 7, tee: [360, 825], cup: [360, 165],
      land: blob(360, 490, 208, 425, .07, 59),
      rails: [ { a: [215, 700], b: [215, 560], t: 'hard' }, { a: [505, 700], b: [505, 560], t: 'hard' },
               { a: [232, 380], b: [232, 260], t: 'hard' }, { a: [488, 380], b: [488, 260], t: 'hard' }, { a: [280, 140], b: [440, 140], t: 'hard' } ],
      baffle: null, slope: null, tide: 44, mill: null,
      decor: [['palm', 300, 300, .8], ['shell', 430, 640, .8], ['succ', 415, 300, .7], ['star', 290, 700, .75]] },
    { name: '风车岛', sub: '看准叶片的空当', par: 4, limit: 7, tee: [240, 795], cup: [500, 200],
      land: blob(360, 490, 252, 412, .06, 71),
      rails: [ { a: [150, 790], b: [150, 540], t: 'hard' }, { a: [570, 420], b: [570, 200], t: 'hard' }, { a: [455, 148], b: [300, 148], t: 'hard' },
               { a: [425, 268], b: [518, 268], t: 'soft' } ],
      baffle: { pivot: [248, 636], len: 112, base: -.5, presets: [-.6, 0, .6] },
      slope: { x: 495, y: 345, r: 88, ax: -150, ay: 66 }, tide: 0,
      mill: { pivot: [362, 498], len: 148, speed: .55 },
      decor: [['palm', 240, 240, .9], ['coral', 520, 560, .85], ['succ', 300, 800, .8], ['flower', 470, 700, .7]] }
  ];

  /* ---------- 物理（纯函数，可复现） ---------- */
  function tidePhaseAt(t) { /* 周期 9.5 秒：低潮 0-4.5，预警 4.5-6，涨潮 6-9.5 */
    var c = t % 9.5;
    return c < 4.5 ? 'low' : c < 6 ? 'warn' : 'high';
  }
  function segmentsOf(hole, baffleAngle, millAngle) {
    var segs = hole.rails.map(function (r) { return { ax: r.a[0], ay: r.a[1], bx: r.b[0], by: r.b[1], t: r.t }; });
    if (hole.baffle && baffleAngle != null) {
      var p = hole.baffle.pivot, a = baffleAngle;
      segs.push({ ax: p[0] - Math.cos(a) * hole.baffle.len / 2, ay: p[1] - Math.sin(a) * hole.baffle.len / 2,
                  bx: p[0] + Math.cos(a) * hole.baffle.len / 2, by: p[1] + Math.sin(a) * hole.baffle.len / 2, t: 'wood' });
    }
    if (hole.mill && millAngle != null) {
      var mp = hole.mill.pivot, ma = millAngle;
      segs.push({ ax: mp[0] - Math.cos(ma) * hole.mill.len, ay: mp[1] - Math.sin(ma) * hole.mill.len,
                  bx: mp[0] + Math.cos(ma) * hole.mill.len, by: mp[1] + Math.sin(ma) * hole.mill.len, t: 'wood' });
    }
    return segs;
  }
  var REST = { hard: .84, soft: .42, wood: .72 }, TANG = { hard: .965, soft: .76, wood: .9 }, TUBE = 9;
  function stepBall(hole, segs, b, tNow) {
    /* 返回事件：null | 'water' | 'holed' */
    if (hole.slope) {
      var s = hole.slope, dx = b.x - s.x, dy = b.y - s.y;
      if (dx * dx + dy * dy < s.r * s.r) { b.vx += s.ax * DT; b.vy += s.ay * DT; }
    }
    b.x += b.vx * DT; b.y += b.vy * DT;
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i], r = distSeg(b.x, b.y, sg.ax, sg.ay, sg.bx, sg.by), minD = BALL_R + TUBE;
      if (r.d < minD && r.d > .0001) {
        var nx = r.nx / r.d, ny = r.ny / r.d;
        b.x += nx * (minD - r.d); b.y += ny * (minD - r.d);
        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          var tx = b.vx - vn * nx, ty = b.vy - vn * ny;
          b.vx = tx * TANG[sg.t] - vn * REST[sg.t] * nx;
          b.vy = ty * TANG[sg.t] - vn * REST[sg.t] * ny;
          b.hit = Math.max(b.hit || 0, -vn); b.hitType = sg.t;
        }
      }
    }
    var cdx = b.x - hole.cup[0], cdy = b.y - hole.cup[1], cd = Math.hypot(cdx, cdy), sp = Math.hypot(b.vx, b.vy);
    if (cd < 15 && sp < 310) return 'holed';
    if (cd < BALL_R + 3 && sp >= 310) { /* 擦洞而过：轻微减速 */
      b.vx *= .985; b.vy *= .985;
    }
    if (!inPoly(b.x, b.y, hole.land) && distToEdge(b.x, b.y, hole.land) > 2) return 'water';
    if (hole.tide) {
      var ph = tidePhaseAt(tNow);
      if (ph === 'high' && distToEdge(b.x, b.y, hole.land) < hole.tide) return 'water';
    }
    var dec = 305 * DT;
    if (sp <= dec + 4) { b.vx = 0; b.vy = 0; }
    else { b.vx -= b.vx / sp * dec; b.vy -= b.vy / sp * dec; }
    return null;
  }
  /* 完整一杆模拟：env = {baffleAngle, millAngle0, t0}，mill 角度随时间推进 */
  function simulateShot(hole, start, angle, power, env) {
    var sp0 = 150 + Math.pow(power / 100, 1.12) * 900;
    var b = { x: start[0], y: start[1], vx: Math.cos(angle) * sp0, vy: Math.sin(angle) * sp0, hit: 0 };
    var t = env.t0 || 0, steps = 0, maxSteps = 240 * 14;
    var path = env.trace ? [[b.x, b.y]] : null;
    while (steps < maxSteps) {
      var millA = hole.mill ? (env.millAngle0 || 0) + hole.mill.speed * (t - (env.t0 || 0)) : null;
      var segs = segmentsOf(hole, env.baffleAngle, millA);
      var ev = stepBall(hole, segs, b, t);
      if (env.onHit && b.hit) { env.onHit(b.hit, b.hitType); b.hit = 0; }
      t += DT; steps++;
      if (path && steps % 12 === 0) path.push([b.x, b.y]);
      if (ev) return { outcome: ev, x: b.x, y: b.y, t: t, path: path };
      if (b.vx === 0 && b.vy === 0) return { outcome: 'rest', x: b.x, y: b.y, t: t, path: path };
    }
    return { outcome: 'rest', x: b.x, y: b.y, t: t, path: path };
  }
  function powerOf(dragPx) { return Math.max(0, Math.min(100, Math.pow(Math.min(dragPx, 250) / 250, 1.3) * 100)); }

  /* ---------- 存档与音频 ---------- */
  var DEF = { unlocked: 1, best: {}, daily: {}, snd: true };
  var save = PK.load('bounceisle_save_v1', DEF);
  function persist() { PK.save('bounceisle_save_v1', save); }
  var AU = PK.audio({ vol: .8, music: .1 });
  AU.set(save.snd !== false);
  function tone(f, t, d, v, type, o) { AU.unlock(); AU.tone(f, AU.t() + (t || 0), d, v, type, o); }
  function sfx(name, opt) {
    if (!AU.on) return;
    if (name === 'click') tone(620, 0, .06, .1, 'triangle');
    else if (name === 'shoot') AU.noise(AU.t(), .12, .22, 300, .8, 'lowpass');
    else if (name === 'hit') { var v = Math.min(.3, .05 + (opt || 0) / 900); AU.noise(AU.t(), .06, v, 1400, 1.1); }
    else if (name === 'soft') AU.noise(AU.t(), .09, .14, 500, .9, 'lowpass');
    else if (name === 'splash') { AU.noise(AU.t(), .4, .2, 900, 1, 'bandpass', 220); }
    else if (name === 'hole') { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * .08, .16, .12, 'triangle', { verb: true }); }); }
    else if (name === 'fail') { tone(280, 0, .2, .1, 'sawtooth'); tone(196, .13, .3, .09, 'sawtooth'); }
  }

  /* ---------- 贴图 ---------- */
  var IMGS = {};
  ['palm', 'succ', 'coral', 'star', 'shell', 'flower'].forEach(function (n) { var im = new Image(); im.src = 'assets/p_' + n + '.webp'; IMGS[n] = im; });

  /* ---------- 视图 ---------- */
  var cv = $('cv'), ctx = cv.getContext('2d'), VW = 0, VH = 0, view = { s: 1, ox: 0, oy: 0 };
  function resize() {
    VW = cv.width = innerWidth; VH = cv.height = innerHeight;
    view.s = Math.min(VW / LW, VH / LH);
    view.ox = (VW - LW * view.s) / 2; view.oy = (VH - LH * view.s) / 2;
  }
  addEventListener('resize', resize); resize();
  function toLogical(px, py) { return [(px - view.ox) / view.s, (py - view.oy) / view.s]; }

  /* ---------- 对局状态 ---------- */
  var G = null, particles = [], staticLayer = null;
  function todayKey() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function startHole(idx, isDaily) {
    var hole = HOLES[idx];
    G = { idx: idx, isDaily: !!isDaily, hole: hole, ball: { x: hole.tee[0], y: hole.tee[1], vx: 0, vy: 0 },
          safe: hole.tee.slice(), strokes: 0, phase: 'aim', baffleAngle: hole.baffle ? hole.baffle.base : null,
          baffleSet: !hole.baffle, shots: [], simT: 0, roller: null, aim: null, over: false, replay: null };
    buildStatic();
    $('hName').textContent = (isDaily ? '每日一洞 · ' : '') + hole.name;
    $('hSub').textContent = hole.sub;
    $('hud').classList.add('on'); $('botHud').classList.add('on');
    $('bBaffle').hidden = !hole.baffle;
    PK.call('lv', hole.name);
    PK.show('menu'); /* hides all .scr; play uses hud overlays instead */
    document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on'); });
    updateHud();
    if (hole.baffle) setTimeout(openBaffle, 350);
  }
  function updateHud() {
    if (!G) return;
    $('hStroke').textContent = '已打 ' + G.strokes + ' 杆';
    $('hPar').textContent = '标准 ' + G.hole.par + ' 杆';
    $('hLimit').textContent = '上限 ' + G.hole.limit + ' 杆';
    var tc = $('hTide');
    if (G.hole.tide) {
      tc.hidden = false;
      var ph = tidePhaseAt(G.simT);
      tc.textContent = ph === 'low' ? '低潮' : ph === 'warn' ? '涨潮预警' : '涨潮中';
      tc.className = 'chip tide' + (ph === 'warn' ? ' warn' : ph === 'high' ? ' high' : '');
    } else tc.hidden = true;
    $('bBaffle').hidden = !G.hole.baffle || G.baffleSet || G.strokes > 0;
    $('powVal').textContent = G.phase === 'aim' ? '拖动瞄准' : G.phase === 'roll' ? '小球滚动中' : '';
  }

  /* ---------- 静态层（岛面） ---------- */
  function polyPath(c, poly) { c.beginPath(); poly.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); }
  function buildStatic() {
    var hole = G.hole;
    staticLayer = document.createElement('canvas');
    staticLayer.width = LW * 2; staticLayer.height = LH * 2;
    var c = staticLayer.getContext('2d'); c.scale(2, 2);
    /* 岩石与沙滩边缘 */
    polyPath(c, hole.land);
    c.strokeStyle = 'rgba(120,52,40,.55)'; c.lineWidth = 64; c.lineJoin = 'round'; c.stroke();
    polyPath(c, hole.land);
    c.strokeStyle = '#c96a54'; c.lineWidth = 46; c.stroke();
    polyPath(c, hole.land);
    c.strokeStyle = '#eda183'; c.lineWidth = 30; c.stroke();
    polyPath(c, hole.land);
    c.strokeStyle = '#f4d894'; c.lineWidth = 17; c.stroke();
    /* 草地 */
    var gr = c.createLinearGradient(0, 60, 0, 920);
    gr.addColorStop(0, '#8ccb6d'); gr.addColorStop(.55, '#74bd58'); gr.addColorStop(1, '#5da84c');
    polyPath(c, hole.land); c.fillStyle = gr; c.fill();
    c.save(); polyPath(c, hole.land); c.clip();
    c.fillStyle = 'rgba(255,255,255,.06)';
    for (var x = -LH; x < LW + LH; x += 68) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 34, 0); c.lineTo(x + 34 + LH * .36, LH); c.lineTo(x + LH * .36, LH); c.fill(); }
    /* 坡面 */
    if (hole.slope) {
      var s = hole.slope;
      var sg = c.createRadialGradient(s.x, s.y, 8, s.x, s.y, s.r);
      sg.addColorStop(0, 'rgba(255,196,77,.5)'); sg.addColorStop(1, 'rgba(255,196,77,.05)');
      c.fillStyle = sg; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.29); c.fill();
      c.strokeStyle = 'rgba(190,120,20,.5)'; c.lineWidth = 3; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
    }
    c.restore();
    /* 装饰 */
    hole.decor.forEach(function (d) {
      var im = IMGS[d[0]]; if (!im) return;
      var w = 74 * d[3];
      c.drawImage(im, d[1] - w / 2, d[2] - w / 2, w, w * .95);
    });
    /* 海里点缀 */
    var rnd = mulberry32(G.idx * 977 + 13);
    for (var i = 0; i < 10; i++) {
      var px = rnd() * LW, py = rnd() * LH;
      if (inPoly(px, py, hole.land) || distToEdge(px, py, hole.land) < 46) continue;
      var nm = ['coral', 'star', 'shell'][i % 3], im2 = IMGS[nm], w2 = 30 + rnd() * 26;
      c.globalAlpha = .85; c.drawImage(im2, px - w2 / 2, py - w2 / 2, w2, w2 * .95); c.globalAlpha = 1;
    }
    /* 静态护栏 */
    hole.rails.forEach(function (r) { drawRail(c, r.a[0], r.a[1], r.b[0], r.b[1], r.t); });
    /* 发球点 */
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5; c.setLineDash([6, 6]);
    c.beginPath(); c.arc(hole.tee[0], hole.tee[1], 17, 0, 6.29); c.stroke(); c.setLineDash([]);
  }
  function drawRail(c, ax, ay, bx, by, t) {
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(30,60,40,.28)'; c.lineWidth = 21;
    c.beginPath(); c.moveTo(ax, ay + 5); c.lineTo(bx, by + 5); c.stroke();
    c.strokeStyle = t === 'soft' ? '#ff8a70' : t === 'wood' ? '#d9a066' : '#8a5fc0'; c.lineWidth = 17;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.strokeStyle = t === 'soft' ? '#ffc4b2' : t === 'wood' ? '#f2cd9a' : '#c4a6ec'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(ax, ay - 4); c.lineTo(bx, by - 4); c.stroke();
  }

  /* ---------- 主循环绘制 ---------- */
  var lastTs = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    var dtMs = Math.min(50, ts - lastTs || 16); lastTs = ts;
    drawSea(ts / 1000);
    if (!G) return;
    /* 推进回放或滚动 */
    if (G.roller) stepRoller(dtMs / 1000);
    else if (G.replay) stepReplay(dtMs / 1000);
    else G.simT += dtMs / 1000;
    ctx.save();
    ctx.translate(view.ox, view.oy); ctx.scale(view.s, view.s);
    drawIsland(ts / 1000);
    drawDynamic(ts / 1000);
    ctx.restore();
    if (G.hole.tide && (frame.n = (frame.n || 0) + 1) % 20 === 0) updateHud();
  }
  requestAnimationFrame(frame);
  function drawSea(t) {
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#79cfd6'); g.addColorStop(.5, '#3d9db8'); g.addColorStop(1, '#2a7a9c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    for (var i = 0; i < 7; i++) {
      var x = ((i * 317 + t * (9 + i * 2)) % (VW + 240)) - 120, y = (i * 173) % VH;
      ctx.beginPath(); ctx.ellipse(x, y, 90 + i * 12, 13, 0, 0, 6.29); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (var j = 0; j < 26; j++) {
      var sx = (j * 211 + Math.sin(t * .7 + j) * 8) % VW, sy = (j * 149 + t * 6) % VH;
      ctx.fillRect(sx, sy, 3, 2);
    }
  }
  function drawIsland(t) {
    if (staticLayer) {
      ctx.save();
      ctx.shadowColor = 'rgba(6,50,66,.5)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 16;
      ctx.drawImage(staticLayer, 0, 0, LW, LH);
      ctx.restore();
    }
    var hole = G.hole;
    /* 潮汐淹没岛缘 */
    if (hole.tide) {
      var ph = tidePhaseAt(G.simT);
      if (ph !== 'low') {
        ctx.save(); polyPath(ctx, hole.land); ctx.clip();
        ctx.strokeStyle = ph === 'high' ? 'rgba(46,130,165,.88)' : 'rgba(70,160,195,.45)';
        ctx.lineWidth = hole.tide * 2; polyPath(ctx, hole.land); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 3;
        ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 30;
        polyPath(ctx, hole.land); ctx.stroke(); ctx.restore();
      }
    }
  }
  function drawDynamic(t) {
    var hole = G.hole, b = G.ball;
    /* 挡板与风车 */
    if (hole.baffle) {
      var segs = segmentsOf(hole, G.baffleAngle, null).slice(-1)[0];
      drawRail(ctx, segs.ax, segs.ay, segs.bx, segs.by, 'wood');
      ctx.fillStyle = '#8a5a28'; ctx.beginPath(); ctx.arc(hole.baffle.pivot[0], hole.baffle.pivot[1], 8, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#f2cd9a'; ctx.beginPath(); ctx.arc(hole.baffle.pivot[0], hole.baffle.pivot[1], 3.4, 0, 6.29); ctx.fill();
    }
    if (hole.mill) {
      var ma = (G.millAngle0 || 0) + hole.mill.speed * (G.simT - (G.millT0 || 0));
      var ms = segmentsOf(hole, null, ma).slice(-1)[0];
      drawRail(ctx, ms.ax, ms.ay, ms.bx, ms.by, 'wood');
      ctx.fillStyle = '#8a5a28'; ctx.beginPath(); ctx.arc(hole.mill.pivot[0], hole.mill.pivot[1], 11, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffe1a0'; ctx.beginPath(); ctx.arc(hole.mill.pivot[0], hole.mill.pivot[1], 4.6, 0, 6.29); ctx.fill();
    }
    /* 洞口与旗 */
    var cx = hole.cup[0], cy = hole.cup[1];
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx, cy + 3, 16, 6, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#173d1e'; ctx.beginPath(); ctx.arc(cx, cy, 12.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#0a2410'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#f5f2ea'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 56); ctx.stroke();
    var wav = Math.sin(t * 5) * 5;
    ctx.fillStyle = '#8a5fc0';
    ctx.beginPath(); ctx.moveTo(cx, cy - 56); ctx.quadraticCurveTo(cx + 13, cy - 53 + wav * .4, cx + 27, cy - 49 + wav); ctx.lineTo(cx, cy - 41); ctx.fill();
    /* 瞄准线 */
    if (G.aim && G.phase === 'aim') drawAim();
    /* 球 */
    if (G.phase !== 'sink') {
      ctx.fillStyle = 'rgba(10,40,30,.3)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 8, 12, 5, 0, 0, 6.29); ctx.fill();
      var bg = ctx.createRadialGradient(b.x - 4, b.y - 5, 2, b.x, b.y, BALL_R + 1);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(.75, '#eef1ee'); bg.addColorStop(1, '#b9c4bb');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(120,130,120,.5)';
      var ra = (b.spin || 0);
      ctx.beginPath(); ctx.arc(b.x + Math.cos(ra) * 5.5, b.y + Math.sin(ra) * 5.5, 2.1, 0, 6.29); ctx.fill();
    }
    /* 粒子 */
    particles = particles.filter(function (p) { return p.life > 0; });
    particles.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.life -= .02;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function spawnSplash(x, y) {
    for (var i = 0; i < 22; i++) { var a = Math.random() * 6.28, sp = Math.random() * 2.6 + .6;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.2, g: .12, life: .7 + Math.random() * .4, c: i % 3 ? '#bdeef7' : '#ffffff', r: 2 + Math.random() * 2.4 }); }
  }
  function spawnConfetti(x, y) {
    for (var i = 0; i < 34; i++) { var a = Math.random() * 6.28, sp = Math.random() * 3.6 + 1;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.6, g: .1, life: .9 + Math.random() * .5, c: ['#ffd873', '#ff8a70', '#8a5fc0', '#7fd4a8'][i % 4], r: 2.4 + Math.random() * 2.4 }); }
  }
  function drawAim() {
    var b = G.ball, dir = G.aim.angle, maxD = 760, step = 6, d = 0, hit = null;
    var segs = segmentsOf(G.hole, G.baffleAngle, G.hole.mill ? (G.millAngle0 || 0) + G.hole.mill.speed * (G.simT - (G.millT0 || 0)) : null);
    while (d < maxD) {
      d += step;
      var x = b.x + Math.cos(dir) * d, y = b.y + Math.sin(dir) * d;
      var stop = false;
      for (var i = 0; i < segs.length; i++) if (distSeg(x, y, segs[i].ax, segs[i].ay, segs[i].bx, segs[i].by).d < BALL_R + TUBE - 2) { stop = true; break; }
      if (!stop && !inPoly(x, y, G.hole.land)) stop = true;
      if (!stop && Math.hypot(x - G.hole.cup[0], y - G.hole.cup[1]) < 14) stop = true;
      if (stop) { hit = [x, y]; break; }
    }
    var end = hit || [b.x + Math.cos(dir) * maxD, b.y + Math.sin(dir) * maxD];
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    var total = Math.hypot(end[0] - b.x, end[1] - b.y);
    for (var dd = 16; dd < total; dd += 21) {
      ctx.beginPath(); ctx.arc(b.x + Math.cos(dir) * dd, b.y + Math.sin(dir) * dd, 3.4, 0, 6.29); ctx.fill();
    }
    if (hit) {
      ctx.strokeStyle = '#f4734f'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(hit[0], hit[1], 9, 0, 6.29); ctx.stroke();
    }
    /* 拉杆线 */
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(dir) * (26 + G.aim.power * 1.1), b.y - Math.sin(dir) * (26 + G.aim.power * 1.1)); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ---------- 滚动推进（与 simulateShot 同一公式） ---------- */
  function launchRoller(ballStart, angle, power, env, onDone) {
    var sp0 = 150 + Math.pow(power / 100, 1.12) * 900;
    G.ball.x = ballStart[0]; G.ball.y = ballStart[1];
    G.ball.vx = Math.cos(angle) * sp0; G.ball.vy = Math.sin(angle) * sp0;
    G.roller = { env: env, elapsed: 0, acc: 0, onDone: onDone };
    G.phase = 'roll';
  }
  function stepRoller(dtReal) {
    var R = G.roller; if (!R) return;
    R.acc += dtReal;
    var guard = 0;
    while (R.acc >= DT && guard++ < 60) {
      R.acc -= DT; R.elapsed += DT;
      var t = R.env.t0 + R.elapsed;
      var millA = G.hole.mill ? R.env.millAngle0 + G.hole.mill.speed * R.elapsed : null;
      var segs = segmentsOf(G.hole, R.env.baffleAngle, millA);
      var ev = stepBall(G.hole, segs, G.ball, t);
      G.simT = t;
      var sp = Math.hypot(G.ball.vx, G.ball.vy);
      G.ball.spin = (G.ball.spin || 0) + sp * DT / BALL_R;
      if (G.ball.hit) {
        if (!G.replay) sfx(G.ball.hitType === 'soft' ? 'soft' : 'hit', G.ball.hit);
        G.ball.hit = 0;
      }
      if (ev || (G.ball.vx === 0 && G.ball.vy === 0)) {
        var done = R.onDone; G.roller = null;
        done(ev || 'rest');
        return;
      }
    }
  }
  function shoot(angle, power) {
    var shot = { x: G.ball.x, y: G.ball.y, angle: angle, power: power, t0: G.simT, millAngle0: G.hole.mill ? G.hole.mill.speed * G.simT : 0 };
    G.shots.push(shot);
    G.strokes++;
    sfx('shoot'); PK.vib(12);
    launchRoller([shot.x, shot.y], angle, power, { baffleAngle: G.baffleAngle, millAngle0: shot.millAngle0, t0: shot.t0 }, function (outcome) { handleOutcome(outcome, false); });
    updateHud();
  }
  function handleOutcome(outcome, isReplay) {
    if (isReplay) {
      var rp = G.replay; rp.idx++; rp.wait = .7;
      if (outcome === 'holed') { spawnConfetti(G.hole.cup[0], G.hole.cup[1]); sfx('hole'); }
      if (outcome === 'water') spawnSplash(G.ball.x, G.ball.y);
      G.phase = 'replay';
      return;
    }
    if (outcome === 'holed') {
      G.phase = 'sink';
      spawnConfetti(G.hole.cup[0], G.hole.cup[1]);
      sfx('hole'); PK.vib([16, 50, 16]);
      setTimeout(function () { finishHole(true); }, 620);
    } else if (outcome === 'water') {
      G.phase = 'reset';
      spawnSplash(G.ball.x, G.ball.y);
      sfx('splash'); PK.vib(30);
      G.strokes++;
      PK.toast('落水，回到上个安全点，加一杆');
      setTimeout(function () {
        if (G.over) return;
        G.ball.x = G.safe[0]; G.ball.y = G.safe[1]; G.ball.vx = G.ball.vy = 0;
        if (G.strokes >= G.hole.limit) finishHole(false);
        else { G.phase = 'aim'; updateHud(); }
      }, 700);
      updateHud();
    } else {
      G.safe = [G.ball.x, G.ball.y];
      if (G.strokes >= G.hole.limit) finishHole(false);
      else { G.phase = 'aim'; updateHud(); }
    }
  }
  function stepReplay(dt) {
    var rp = G.replay; if (!rp || G.roller) return;
    if (rp.wait > 0) { rp.wait -= dt; return; }
    if (rp.idx >= rp.shots.length) {
      G.replay = null; G.phase = 'aim';
      PK.toast('回放结束');
      openSheet('resP');
      return;
    }
    var s = rp.shots[rp.idx];
    G.simT = s.t0;
    launchRoller([s.x, s.y], s.angle, s.power, { baffleAngle: G.baffleAngle, millAngle0: s.millAngle0, t0: s.t0 }, function (outcome) { handleOutcome(outcome, true); });
  }

  /* ---------- 结算 ---------- */
  function openSheet(id) { document.querySelectorAll('.scr').forEach(function (s) { s.classList.toggle('on', s.id === id); }); }
  function closeSheets() { document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on'); }); }
  function finishHole(win) {
    G.over = true; G.phase = 'over';
    var hole = G.hole, key = 'h' + G.idx;
    if (win) {
      if (!G.isDaily) {
        if (!save.best[key] || G.strokes < save.best[key]) save.best[key] = G.strokes;
        if (G.idx + 1 < HOLES.length) save.unlocked = Math.max(save.unlocked, G.idx + 2);
      } else {
        var tk = String(todayKey());
        if (!save.daily[tk] || G.strokes < save.daily[tk]) save.daily[tk] = G.strokes;
      }
    }
    persist();
    $('resH').textContent = win ? '入洞' : '未在上限内入洞';
    $('resSub').textContent = hole.name + ' · ' + hole.sub + (G.isDaily ? ' · 每日一洞' : '');
    $('resUsed').textContent = G.strokes + ' 杆';
    $('resPar').textContent = hole.par + ' 杆';
    var diff = G.strokes - hole.par;
    $('resDiff').textContent = !win ? '—' : diff === 0 ? '0' : diff < 0 ? '－' + (-diff) : '＋' + diff;
    $('resDiff').parentElement.querySelector('small').textContent = !win ? '本洞未完成' : diff === 0 ? '平标准' : diff < 0 ? '低于标准' : '高于标准';
    $('resBest').textContent = win ? (G.isDaily ? '今日最佳 ' + (save.daily[String(todayKey())] || G.strokes) + ' 杆' : '本洞最佳 ' + (save.best[key] || G.strokes) + ' 杆 · 回放已保存') : '再试一次，低杆来自路线规划。';
    var un = $('resUnlock');
    if (win && !G.isDaily && G.idx + 1 < HOLES.length) {
      un.hidden = false;
      $('resUnlockT').innerHTML = '<b>' + HOLES[G.idx + 1].name + '</b> · ' + HOLES[G.idx + 1].sub;
    } else un.hidden = true;
    var next = $('resNext');
    if (win && !G.isDaily && G.idx + 1 < HOLES.length) {
      next.style.display = ''; next.textContent = '下一洞 · ' + HOLES[G.idx + 1].name;
      next.onclick = function () { closeSheets(); startHole(G.idx + 1, false); };
    } else next.style.display = 'none';
    $('resRetry').onclick = function () { closeSheets(); startHole(G.idx, G.isDaily); };
    $('resMenu').onclick = exitToMenu;
    $('resReplay').onclick = function () {
      if (!G.shots.length) { PK.toast('本洞还没有击球记录'); return; }
      closeSheets();
      G.over = false; G.phase = 'replay';
      G.replay = { shots: G.shots.slice(), idx: 0, wait: .3 };
      G.ball.x = G.hole.tee[0]; G.ball.y = G.hole.tee[1]; G.ball.vx = G.ball.vy = 0;
    };
    openSheet('resP');
    if (win) PK.call('win', G.strokes); else { sfx('fail'); PK.call('fail', G.strokes); }
    renderMenu();
  }
  function exitToMenu() {
    G = null;
    $('hud').classList.remove('on'); $('botHud').classList.remove('on');
    renderMenu(); openSheet('menu');
  }

  /* ---------- 挡板 ---------- */
  var bfSel = 1;
  function openBaffle() {
    if (!G || !G.hole.baffle || G.baffleSet) return;
    bfSel = G.hole.baffle.presets[1] === 0 ? 1 : 0;
    drawBaffleSheet();
    openSheet('baffleP');
  }
  function drawBaffleSheet() {
    var hole = G.hole, bf = hole.baffle;
    $('bfCount').textContent = (G.baffleSet ? 1 : 0) + ' / 1';
    var opts = $('bfOpts'); opts.innerHTML = '';
    bf.presets.forEach(function (off, i) {
      var ang = bf.base + off, deg = Math.round(ang * 180 / Math.PI);
      var b = document.createElement('button');
      b.className = i === bfSel ? 'sel' : '';
      b.textContent = deg + '°';
      b.addEventListener('click', function () { bfSel = i; sfx('click'); drawBaffleSheet(); });
      opts.appendChild(b);
    });
    var ang2 = bf.base + bf.presets[bfSel];
    $('bfOk').textContent = '锁定 ' + Math.round(ang2 * 180 / Math.PI) + '°，回到第 1 杆';
    /* 示意图 */
    var c = $('bfCv').getContext('2d'), W2 = 640, H2 = 400;
    var sc = Math.min((W2 - 30) / LW, (H2 - 24) / LH), ox = (W2 - LW * sc) / 2, oy = (H2 - LH * sc) / 2;
    c.clearRect(0, 0, W2, H2);
    c.save(); c.translate(ox, oy); c.scale(sc, sc);
    polyPath(c, hole.land); c.fillStyle = '#74bd58'; c.fill();
    c.strokeStyle = '#f4d894'; c.lineWidth = 15 / sc * .4 + 8; c.stroke();
    hole.rails.forEach(function (r) { drawRail(c, r.a[0], r.a[1], r.b[0], r.b[1], r.t); });
    var seg = segmentsOf(hole, ang2, null).slice(-1)[0];
    drawRail(c, seg.ax, seg.ay, seg.bx, seg.by, 'wood');
    /* 参考线：从发球点朝洞口方向的一杆 */
    var aimA = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    var tr = simulateShot(hole, hole.tee, aimA, 62, { baffleAngle: ang2, millAngle0: 0, t0: 0, trace: true });
    if (tr.path) {
      c.fillStyle = 'rgba(255,255,255,.95)';
      tr.path.forEach(function (p, i) { if (i % 2) return; c.beginPath(); c.arc(p[0], p[1], 7, 0, 6.29); c.fill(); });
    }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(hole.tee[0], hole.tee[1], 11, 0, 6.29); c.fill();
    c.fillStyle = '#173d1e'; c.beginPath(); c.arc(hole.cup[0], hole.cup[1], 12, 0, 6.29); c.fill();
    c.restore();
    var endD = tr ? Math.hypot(tr.x - hole.cup[0], tr.y - hole.cup[1]) : 999;
    $('bfNote').textContent = tr && tr.outcome === 'holed' ? '参考线直接入洞' : endD < 95 ? '参考线反弹后贴近洞口' : endD < 220 ? '参考线停在洞口一带' : '参考线离洞口较远，换个角度试试';
  }
  $('bfOk').addEventListener('click', function () {
    if (!G || !G.hole.baffle) return;
    G.baffleAngle = G.hole.baffle.base + G.hole.baffle.presets[bfSel];
    G.baffleSet = true; sfx('click');
    closeSheets(); updateHud();
  });
  $('bfClose').addEventListener('click', function () {
    if (G && G.hole.baffle && !G.baffleSet) { G.baffleAngle = G.hole.baffle.base; G.baffleSet = true; }
    closeSheets(); updateHud();
  });
  $('bBaffle').addEventListener('click', openBaffle);

  /* ---------- 输入 ---------- */
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    if (!G || G.over || G.replay || G.phase !== 'aim') return;
    if (document.querySelector('.scr.on')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || !G) return;
    var lp = toLogical(e.clientX, e.clientY);
    var dx = G.ball.x - lp[0], dy = G.ball.y - lp[1];
    var lenL = Math.hypot(dx, dy), lenPx = lenL * view.s;
    if (lenL < 4) { G.aim = null; setPower(0); return; }
    var power = powerOf(lenPx);
    G.aim = { angle: Math.atan2(dy, dx), power: power };
    setPower(power);
  });
  function endDrag(e) {
    if (!drag) return;
    drag = null;
    if (!G) return;
    if (G.aim && G.aim.power >= 4 && G.phase === 'aim') shoot(G.aim.angle, G.aim.power);
    G.aim = null; setPower(0);
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  function setPower(p) {
    $('powFill').style.width = p + '%';
    $('powVal').textContent = p <= 0 ? '拖动瞄准' : (p < 34 ? '弱' : p < 67 ? '中' : '强') + ' · ' + Math.round(p) + '%';
  }

  /* ---------- 菜单 ---------- */
  function renderMenu() {
    var wrap = $('holes'); wrap.innerHTML = '';
    HOLES.forEach(function (h, i) {
      var locked = i >= save.unlocked;
      var b = document.createElement('button');
      b.className = 'hole' + (locked ? ' locked' : '');
      b.innerHTML = '<span class="no">' + (locked ? '锁' : i + 1) + '</span><span class="tx"><b>' + h.name + '</b><small>' +
        h.sub + ' · 标准 ' + h.par + ' 杆 · 上限 ' + h.limit + ' 杆</small></span>' +
        '<span class="best">' + (locked ? '未解锁' : save.best['h' + i] ? '最佳 ' + save.best['h' + i] + ' 杆' : '未打通') + '</span>';
      b.addEventListener('click', function () {
        if (locked) { PK.toast('先打通上一座球岛'); return; }
        sfx('click'); closeSheets(); startHole(i, false);
      });
      wrap.appendChild(b);
    });
    var d = new Date(), doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), di = doy % HOLES.length;
    var db = save.daily[String(todayKey())];
    $('dailyCard').innerHTML = '<span class="tx"><b>每日一洞</b><small>今日球岛：' + HOLES[di].name + ' · 标准 ' + HOLES[di].par + ' 杆</small></span><span class="best">' + (db ? '今日 ' + db + ' 杆' : '今日未打') + '</span>';
    $('dailyCard').onclick = function () { sfx('click'); closeSheets(); startHole(di, true); };
    $('mSnd').classList.toggle('off', !AU.on);
  }
  function bindSnd(id) {
    $(id).addEventListener('click', function () {
      AU.unlock(); AU.set(!AU.on); save.snd = AU.on; persist();
      $('mSnd').classList.toggle('off', !AU.on);
      $('pSnd').textContent = '音效：' + (AU.on ? '开' : '关');
    });
  }
  bindSnd('mSnd'); bindSnd('pSnd');
  $('mHelp').addEventListener('click', function () { openSheet('helpP'); });
  $('helpClose').addEventListener('click', function () { openSheet(G ? 'resP' : 'menu'); if (!G) openSheet('menu'); else closeSheets(); });
  $('helpOk').addEventListener('click', function () { if (G) closeSheets(); else openSheet('menu'); });
  $('hBack').addEventListener('click', function () { PK.call('quit'); exitToMenu(); });
  $('hPause').addEventListener('click', function () {
    if (!G) return;
    $('pInfo').textContent = G.hole.name + ' · 已打 ' + G.strokes + ' 杆 · 标准 ' + G.hole.par + ' 杆';
    $('pSnd').textContent = '音效：' + (AU.on ? '开' : '关');
    openSheet('pauseP');
  });
  $('pResume').addEventListener('click', closeSheets);
  $('pRestart').addEventListener('click', function () { closeSheets(); startHole(G.idx, G.isDaily); });
  $('pMenu').addEventListener('click', exitToMenu);

  window.__BI = { HOLES: HOLES, simulateShot: simulateShot, segmentsOf: segmentsOf, tidePhaseAt: tidePhaseAt, get: function () { return G; }, save: save };

  /* 环境音乐：海岛五声音阶拨弦，偶尔一阵海浪噪声 */
  var MUS_BI = [392, 440, 523.3, 587.3, 523.3, 440, 349.2, 440];
  var musJ = 0;
  setInterval(function () {
    if (!AU.on || document.hidden) return;
    var f = MUS_BI[musJ++ % MUS_BI.length];
    tone(f, 0, .9, .045, 'triangle', { bus: AU.music, verb: true });
    if (musJ % 8 === 4) AU.noise(AU.t(), 1.6, .02, 500, .6, 'lowpass');
  }, 980);
  PK.init({ game: 'bounceisle', save: persist, hubButtons: ['mHub', 'pHub'] });
  renderMenu();
})();
