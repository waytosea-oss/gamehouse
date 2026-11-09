/* 星骰实验：锁骰、重掷与计分构筑。算式全公开，概率按全部结果精确枚举。 */
(function () {
  'use strict';
  var $ = PK.$;

  /* ---------- 随机 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 计分机器 ---------- */
  function cntOf(vals) { var c = [0, 0, 0, 0, 0, 0, 0]; vals.forEach(function (v) { c[v]++; }); return c; }
  function sum(vals) { return vals.reduce(function (a, b) { return a + b; }, 0); }
  function longestRun(vals) {
    var u = Array.from(new Set(vals)).sort(function (a, b) { return a - b; });
    var best = [u[0]], cur = [u[0]];
    for (var i = 1; i < u.length; i++) {
      if (u[i] === u[i - 1] + 1) { cur.push(u[i]); if (cur.length > best.length) best = cur.slice(); }
      else cur = [u[i]];
    }
    return best;
  }
  var MACHINES = {
    accum: { name: '累加器', icon: 'assets/m_accum.webp', rule: '五颗骰子点数直接相加。', score: function (v) {
      return { total: sum(v), lines: [{ label: '五骰总和', expr: v.join('＋'), val: sum(v) }] };
    } },
    even: { name: '偶波机', icon: 'assets/m_even.webp', rule: '偶数点数之和，再乘以二。', score: function (v) {
      var ev = v.filter(function (x) { return x % 2 === 0; }), s = sum(ev);
      return { total: s * 2, lines: [
        { label: '偶数点数', expr: ev.length ? ev.join('＋') : '无', val: s },
        { label: '偶波倍频', expr: s + '×2', val: s * 2 }] };
    } },
    odd: { name: '奇波机', icon: 'assets/m_odd.webp', rule: '奇数点数之和，再乘以二。', score: function (v) {
      var od = v.filter(function (x) { return x % 2 === 1; }), s = sum(od);
      return { total: s * 2, lines: [
        { label: '奇数点数', expr: od.length ? od.join('＋') : '无', val: s },
        { label: '奇波倍频', expr: s + '×2', val: s * 2 }] };
    } },
    spectrum: { name: '多样仪', icon: 'assets/m_spectrum.webp', rule: '每多一种不同点数，得九分。', score: function (v) {
      var k = new Set(v).size;
      return { total: k * 9, lines: [{ label: '不同点数', expr: k + '种×9', val: k * 9 }] };
    } },
    reson: { name: '共振腔', icon: 'assets/m_reson.webp', rule: '同点组合计分：五同 80、四同 48、葫芦 45、三同 26、两对 26、一对 12。', score: function (v) {
      var c = cntOf(v).slice(1).sort(function (a, b) { return b - a; });
      var name = '', val = 0;
      if (c[0] === 5) { name = '五同'; val = 80; }
      else if (c[0] === 4) { name = '四同'; val = 48; }
      else if (c[0] === 3 && c[1] === 2) { name = '葫芦'; val = 45; }
      else if (c[0] === 3) { name = '三同'; val = 26; }
      else if (c[0] === 2 && c[1] === 2) { name = '两对'; val = 26; }
      else if (c[0] === 2) { name = '一对'; val = 12; }
      else { var m = Math.max.apply(null, v); return { total: m, lines: [{ label: '无同点组合', expr: '取最大点数', val: m }] }; }
      return { total: val, lines: [{ label: name, expr: v.slice().sort().join('、'), val: val }] };
    } },
    orbit: { name: '星轨仪', icon: 'assets/m_orbit.webp', rule: '最长连号计分：三连 20、四连 38、五连 60；不足三连按连号点数之和。', score: function (v) {
      var run = longestRun(v), L = run.length;
      if (L >= 3) { var val = L === 3 ? 20 : L === 4 ? 38 : 60; return { total: val, lines: [{ label: L + '连号', expr: run.join('－'), val: val }] }; }
      var s = sum(run);
      return { total: s, lines: [{ label: '连号不足三连', expr: run.join('＋'), val: s }] };
    } }
  };

  /* ---------- 芯片 ---------- */
  var CHIPS = {
    pair: { name: '同点芯片', desc: '每凑出一对相同点数，额外加 3 分。三同算三对，四同算六对。', bonus: function (v) {
      var c = cntOf(v), pairs = 0;
      c.forEach(function (n) { pairs += n * (n - 1) / 2; });
      return { val: pairs * 3, expr: pairs + '对×3', ok: pairs > 0 };
    } },
    big: { name: '大点芯片', desc: '每有一颗 5 点或 6 点的骰子，额外加 2 分。', bonus: function (v) {
      var n = v.filter(function (x) { return x >= 5; }).length;
      return { val: n * 2, expr: n + '颗×2', ok: n > 0 };
    } },
    balance: { name: '衡平芯片', desc: '奇数与偶数骰子颗数相等时，额外加 12 分。', bonus: function (v) {
      var o = v.filter(function (x) { return x % 2 === 1; }).length, e = 5 - o;
      return { val: o === e ? 12 : 0, expr: '奇' + o + '颗 · 偶' + e + '颗', ok: o === e };
    } },
    stardust: { name: '星尘芯片', desc: '每一颗 1 点骰子，额外加 4 分。小点数也能发光。', bonus: function (v) {
      var n = v.filter(function (x) { return x === 1; }).length;
      return { val: n * 4, expr: n + '颗×4', ok: n > 0 };
    } },
    chain: { name: '连珠芯片', desc: '骰子里出现三个或更多连号时，额外加 10 分。', bonus: function (v) {
      var L = longestRun(v).length;
      return { val: L >= 3 ? 10 : 0, expr: '最长连号 ' + L, ok: L >= 3 };
    } }
  };

  /* ---------- 阶段 ---------- */
  var STAGES = [
    { name: '星骰入门', sub: '先读懂一个算式', rounds: 3, target: 60, seed: 20261109, machines: ['accum', 'even', 'odd'], reward: ['big', 'stardust'] },
    { name: '连锁工坊', sub: '多样与共振登场', rounds: 4, target: 150, seed: 20261217, machines: ['accum', 'even', 'spectrum', 'reson'], reward: ['balance', 'chain'] },
    { name: '星轨大实验', sub: '六台机器全部开放', rounds: 5, target: 210, seed: 20270105, machines: ['accum', 'even', 'odd', 'spectrum', 'reson', 'orbit'], reward: null }
  ];
  var DIE_COLORS = ['magenta', 'teal', 'gold', 'violet', 'blue'];

  function scoreWith(mId, vals, chipId) {
    var r = MACHINES[mId].score(vals), total = r.total, lines = r.lines.slice();
    if (chipId) {
      var b = CHIPS[chipId].bonus(vals);
      lines.push({ label: CHIPS[chipId].name, expr: b.expr, val: b.val, chip: true });
      total += b.val;
    }
    return { total: total, lines: lines };
  }
  function bestScore(vals, machineIds, chipId) {
    var best = -1, bestId = null;
    machineIds.forEach(function (m) { var t = scoreWith(m, vals, chipId).total; if (t > best) { best = t; bestId = m; } });
    return { total: best, id: bestId };
  }
  /* 精确枚举未锁骰子的全部结果，算重掷后超过 currentBest 的概率与期望最佳分 */
  function rerollOdds(vals, locked, machineIds, chipId, currentBest) {
    var open = []; locked.forEach(function (L, i) { if (!L) open.push(i); });
    if (!open.length) return null;
    var total = Math.pow(6, open.length), beat = 0, sumBest = 0, trial = vals.slice();
    (function rec(k) {
      if (k === open.length) {
        var b = bestScore(trial, machineIds, chipId).total;
        sumBest += b; if (b > currentBest) beat++;
        return;
      }
      for (var f = 1; f <= 6; f++) { trial[open[k]] = f; rec(k + 1); }
    })(0);
    return { p: beat / total, ev: sumBest / total };
  }

  /* ---------- 存档 ---------- */
  var DEF = { unlocked: 1, best: {}, stars: {}, chips: ['pair'], daily: {}, snd: true, played: 0 };
  var save = PK.load('stardice_save_v1', DEF);
  function persist() { PK.save('stardice_save_v1', save); }

  /* ---------- 音频 ---------- */
  var AU = PK.audio({ vol: .8, music: .1 });
  AU.set(save.snd !== false);
  function tone(f, t, d, v, type, o) { AU.unlock(); AU.tone(f, AU.t() + (t || 0), d, v, type, o); }
  function sfx(name) {
    if (!AU.on) return;
    if (name === 'click') tone(660, 0, .06, .12, 'triangle');
    else if (name === 'lock') { tone(420, 0, .05, .14, 'square'); tone(840, .04, .06, .1, 'square'); }
    else if (name === 'roll') { for (var i = 0; i < 6; i++) AU.noise(AU.t() + i * .07, .05, .1, 1800 + Math.random() * 800, 1.2); }
    else if (name === 'tick') tone(980, 0, .05, .1, 'sine');
    else if (name === 'coin') { tone(880, 0, .09, .14, 'triangle'); tone(1320, .07, .14, .12, 'triangle'); }
    else if (name === 'win') { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * .09, .18, .13, 'triangle', { verb: true }); }); }
    else if (name === 'fail') { tone(300, 0, .2, .12, 'sawtooth'); tone(210, .14, .3, .1, 'sawtooth'); }
  }

  /* ---------- 画布氛围 ---------- */
  var cv = $('cv'), ctx = cv.getContext('2d'), W = 0, H = 0, sparks = [], bursts = [];
  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  addEventListener('resize', resize); resize();
  for (var i = 0; i < 42; i++) sparks.push({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + .6, v: Math.random() * .014 + .004, ph: Math.random() * 6.28 });
  function burst(x, y, n) { for (var i = 0; i < (n || 26); i++) { var a = Math.random() * 6.28, sp = Math.random() * 3.4 + 1; bursts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, life: 1, c: ['#ffd873', '#ff9ad5', '#9fe8c1', '#ffe9ad'][i % 4] }); } }
  (function loop(ts) {
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    sparks.forEach(function (p) {
      p.y -= p.v / 100; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
      var tw = .35 + .3 * Math.sin(ts / 700 + p.ph);
      ctx.globalAlpha = tw; ctx.fillStyle = '#ffd873';
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s, 0, 6.29); ctx.fill();
    });
    ctx.globalAlpha = 1;
    bursts = bursts.filter(function (p) { return p.life > 0; });
    bursts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += .09; p.life -= .016;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, 6.29); ctx.fill();
    });
    ctx.globalAlpha = 1;
  })(0);

  /* ---------- 对局 ---------- */
  var G = null;
  var LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="9" rx="2" fill="currentColor"/><path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  var OPEN_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 10V7a3 3 0 0 1 5.8-1.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function todayKey() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function dailyDef() {
    var base = STAGES[2];
    return { name: '每日实验', sub: '今日固定序列 · ' + todayKey(), rounds: base.rounds, target: base.target, seed: todayKey(), machines: base.machines.slice(), reward: null, daily: true };
  }
  function startRun(stageIdx, isDaily) {
    var def = isDaily ? dailyDef() : STAGES[stageIdx];
    G = { stageIdx: stageIdx, isDaily: !!isDaily, def: def, rng: mulberry32(def.seed), round: 0, score: 0,
          dice: [], rerolls: 2, used: {}, chip: null, log: [], rolling: false, phase: 'roll' };
    PK.call('lv', def.name);
    $('hName').textContent = def.name;
    PK.show('play');
    startRound();
  }
  function startRound() {
    G.round++; G.rerolls = 2; G.chip = null;
    G.dice = DIE_COLORS.map(function (c) { return { v: 1, color: c, locked: false }; });
    G.phase = 'roll'; render();
    rollDice([0, 1, 2, 3, 4], function () { G.phase = 'decide'; render(); });
  }
  function rollDice(idxs, done) {
    if (!idxs.length) { done && done(); return; }
    G.rolling = true; sfx('roll'); render();
    var box = $('tray').children, ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      idxs.forEach(function (i) {
        var face = box[i] && box[i].querySelector('.face');
        if (face) setFace(face, 1 + Math.floor(Math.random() * 6));
      });
      if (ticks >= 8) {
        clearInterval(iv);
        idxs.forEach(function (i) { G.dice[i].v = 1 + Math.floor(G.rng() * 6); });
        G.rolling = false; PK.vib(18);
        render(); done && done();
      }
    }, 70);
    idxs.forEach(function (i) { var d = box[i]; if (d) d.classList.add('rolling'); });
  }
  function setFace(el, v) { el.style.backgroundPosition = ((v - 1) * 20) + '% 0'; }
  function vals() { return G.dice.map(function (d) { return d.v; }); }
  function availMachines() { return G.def.machines.filter(function (m) { return !G.used[m]; }); }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!G) return;
    $('hSub').textContent = '第 ' + G.round + ' 轮 · 共 ' + G.def.rounds + ' 轮';
    $('hScore').textContent = G.score;
    $('hTarget').textContent = G.def.target;
    $('hBar').style.width = Math.min(100, G.score / G.def.target * 100) + '%';
    $('hReroll').textContent = G.rerolls;
    /* 骰盘 */
    var tray = $('tray'); tray.innerHTML = '';
    G.dice.forEach(function (d, i) {
      var box = document.createElement('div'); box.className = 'dieBox';
      var die = document.createElement('button');
      die.className = 'die' + (d.locked ? ' locked' : '') + (G.rolling ? '' : '');
      die.setAttribute('aria-label', '骰子 ' + d.v + ' 点');
      var face = document.createElement('div'); face.className = 'face';
      face.style.backgroundImage = "url('assets/dice_" + d.color + ".webp')";
      face.style.backgroundSize = '600% 100%';
      setFace(face, d.v);
      die.appendChild(face);
      die.addEventListener('click', function () { toggleLock(i); });
      var lk = document.createElement('button');
      lk.className = 'lockBtn' + (d.locked ? ' on' : '');
      lk.innerHTML = (d.locked ? LOCK_SVG : OPEN_SVG) + '<span>' + (d.locked ? '已锁' : '未锁') + '</span>';
      lk.addEventListener('click', function () { toggleLock(i); });
      box.appendChild(die); box.appendChild(lk);
      tray.appendChild(box);
    });
    /* 概率行 */
    var prob = $('probLine');
    if (G.phase === 'decide' && G.rerolls > 0) {
      var cur = bestScore(vals(), availMachines(), G.chip);
      var odds = rerollOdds(vals(), G.dice.map(function (d) { return d.locked; }), availMachines(), G.chip, cur.total);
      if (odds) prob.innerHTML = '当前最佳 <b>' + cur.total + ' 分</b> · 再掷未锁骰，约 <b>' + Math.round(odds.p * 100) + '%</b> 概率超过它，期望最佳约 <b>' + odds.ev.toFixed(1) + ' 分</b>';
      else prob.textContent = '骰子全锁住了，挑一台机器计分，或解锁后再掷。';
    } else if (G.phase === 'decide') prob.textContent = '重掷次数用完，挑一台机器计分。';
    else prob.textContent = '';
    /* 机器 */
    var best = bestScore(vals(), availMachines(), G.chip);
    var wrap = $('machines'); wrap.innerHTML = '';
    G.def.machines.forEach(function (mId) {
      var m = MACHINES[mId], used = !!G.used[mId];
      var t = scoreWith(mId, vals(), G.chip).total;
      var b = document.createElement('button');
      b.className = 'mach' + (used ? ' used' : '') + (!used && t === best.total && G.phase === 'decide' ? ' best' : '');
      b.innerHTML = '<img src="' + m.icon + '" alt=""><b>' + m.name + '</b><small>' + m.rule + '</small>' +
        '<span class="prev">' + (used ? '已用' : t + ' 分') + (G.chip && !used ? ' <em>含芯片</em>' : '') + '</span>';
      b.addEventListener('click', function () { if (G.phase === 'decide' && !G.rolling) openScore(mId); });
      wrap.appendChild(b);
    });
    /* 底部 */
    var cb = $('bChip');
    cb.classList.toggle('set', !!G.chip);
    $('chipName').textContent = G.chip ? '芯片：' + CHIPS[G.chip].name : '芯片：未装入';
    var rb = $('bReroll');
    rb.disabled = G.phase !== 'decide' || G.rolling || G.rerolls <= 0;
    rb.textContent = G.rerolls > 0 ? '重掷未锁骰（剩 ' + G.rerolls + ' 次）' : '重掷已用完';
    var lockedV = G.dice.filter(function (d) { return d.locked; }).map(function (d) { return d.v; });
    var openV = G.dice.filter(function (d) { return !d.locked; }).map(function (d) { return d.v; });
    $('statusLine').textContent = G.phase === 'decide'
      ? (lockedV.length ? lockedV.join('、') + ' 已锁' : '还没有锁定骰子') + (openV.length ? ' · ' + openV.join('、') + ' 待重掷' : '')
      : '星骰滚动中……';
  }
  function toggleLock(i) {
    if (!G || G.phase !== 'decide' || G.rolling) return;
    G.dice[i].locked = !G.dice[i].locked;
    sfx(G.dice[i].locked ? 'lock' : 'click'); PK.vib(8);
    render();
  }

  /* ---------- 计分 ---------- */
  var scoreCtx = null;
  function openScore(mId) {
    scoreCtx = { mId: mId };
    var m = MACHINES[mId];
    $('sTitle').textContent = m.name;
    $('sRule').textContent = m.rule;
    fillFormula();
    PK.show('scoreP');
  }
  function fillFormula() {
    var r = scoreWith(scoreCtx.mId, vals(), G.chip);
    var box = $('sFormula'); box.innerHTML = '';
    r.lines.forEach(function (ln, i) {
      var div = document.createElement('div');
      div.className = 'fl' + (ln.chip ? ' chipLine' : '');
      div.innerHTML = '<span>' + ln.label + '</span><b>' + ln.expr + ' ＝ ' + ln.val + '</b>';
      box.appendChild(div);
      setTimeout(function () { div.classList.add('on'); if (i) sfx('tick'); }, 130 * (i + 1));
    });
    $('sTotal').textContent = r.total;
    var row = $('sChipRow'); row.innerHTML = '';
    var opt = document.createElement('button'); opt.className = 'opt';
    if (G.chip) {
      var b = CHIPS[G.chip].bonus(vals());
      opt.innerHTML = '<img src="assets/chip.webp" alt=""><span class="tx"><b>' + CHIPS[G.chip].name + '已装入</b><small>' + CHIPS[G.chip].desc + '</small></span><span class="gain">+' + b.val + '</span>';
      opt.addEventListener('click', function () { openChips(true); });
    } else {
      var bestGain = 0, bestChip = null;
      save.chips.forEach(function (cid) { var g = CHIPS[cid].bonus(vals()).val; if (g > bestGain) { bestGain = g; bestChip = cid; } });
      opt.innerHTML = '<img src="assets/chip.webp" alt=""><span class="tx"><b>未装芯片</b><small>' + (bestChip ? '装入' + CHIPS[bestChip].name + '可多得 ' + bestGain + ' 分' : '现有芯片对这组骰子暂无加成') + '</small></span><span class="gain">换芯片</span>';
      opt.addEventListener('click', function () { openChips(true); });
    }
    row.appendChild(opt);
    $('sConfirm').onclick = confirmScore;
  }
  function confirmScore() {
    var r = scoreWith(scoreCtx.mId, vals(), G.chip);
    var mId = scoreCtx.mId;
    G.used[mId] = true; G.score += r.total;
    G.log.push({ round: G.round, machine: MACHINES[mId].name, chip: G.chip ? CHIPS[G.chip].name : '', total: r.total });
    sfx('coin'); PK.vib([14, 40, 14]);
    PK.show('play'); render();
    burst(innerWidth / 2, innerHeight * .55, 30);
    PK.toast(MACHINES[mId].name + ' +' + r.total + ' 分');
    setTimeout(function () {
      if (G.round >= G.def.rounds) stageEnd();
      else startRound();
    }, 650);
  }

  /* ---------- 芯片 ---------- */
  var chipFromScore = false;
  function openChips(fromScore) {
    chipFromScore = !!fromScore;
    var list = $('chipList'); list.innerHTML = '';
    save.chips.forEach(function (cid) {
      var c = CHIPS[cid], b = c.bonus(vals());
      var btn = document.createElement('button');
      btn.className = 'chipItem' + (G.chip === cid ? ' sel' : '');
      btn.innerHTML = '<img src="assets/chip.webp" alt=""><span class="tx"><b>' + c.name + '</b><small>' + c.desc + '</small></span><span class="now">' + (b.ok ? '+' + b.val : '未触发') + '</span>';
      btn.addEventListener('click', function () {
        G.chip = cid; sfx('lock'); closeChips(); render();
        PK.toast('已装入' + c.name);
      });
      list.appendChild(btn);
    });
    PK.show('chipP');
  }
  function closeChips() {
    if (chipFromScore && scoreCtx) { fillFormula(); PK.show('scoreP'); }
    else PK.show('play');
    chipFromScore = false;
  }

  /* ---------- 结算 ---------- */
  function stageEnd() {
    var def = G.def, ok = G.score >= def.target;
    var bestKey = G.isDaily ? 'daily' : 's' + G.stageIdx;
    if (G.isDaily) {
      var tk = String(todayKey()), prev = save.daily[tk] || 0;
      if (G.score > prev) save.daily[tk] = G.score;
    } else {
      if (G.score > (save.best[bestKey] || 0)) save.best[bestKey] = G.score;
      var stars = G.score >= def.target * 1.6 ? 3 : G.score >= def.target * 1.25 ? 2 : ok ? 1 : 0;
      if (stars > (save.stars[bestKey] || 0)) save.stars[bestKey] = stars;
      if (ok && G.stageIdx + 1 < STAGES.length) save.unlocked = Math.max(save.unlocked, G.stageIdx + 2);
    }
    save.played++; persist();
    $('resH').textContent = ok ? '阶段目标达成' : '还差一点';
    $('resSub').textContent = def.name + ' · ' + (ok ? '得分逐项回放，无下注无兑换' : '同一副随机序列可以再试一次');
    $('resScore').textContent = G.score;
    $('resGoal').textContent = '目标 ' + def.target + ' 分' + (ok ? '，已达成' : '，还差 ' + (def.target - G.score) + ' 分');
    var st = $('resStars').children;
    var starN = G.score >= def.target * 1.6 ? 3 : G.score >= def.target * 1.25 ? 2 : ok ? 1 : 0;
    for (var i = 0; i < 3; i++) st[i].className = i < starN ? 'on' : '';
    $('resLog').innerHTML = G.log.map(function (e) {
      return '<li><span>第 ' + e.round + ' 轮 · ' + e.machine + (e.chip ? ' · ' + e.chip : '') + '</span><b>' + e.total + ' 分</b></li>';
    }).join('');
    /* 奖励：通关选一块芯片 */
    var rw = $('resReward'), rb = $('resRewardBody');
    var rewardKey = 'reward' + G.stageIdx;
    if (ok && def.reward && !save[rewardKey]) {
      rw.hidden = false; rb.innerHTML = '<div style="font-size:13px;color:#bda9e8">从两块新芯片里挑一块加入实验箱：</div>';
      var pick = document.createElement('div'); pick.className = 'rewardPick';
      def.reward.forEach(function (cid) {
        var owned = save.chips.indexOf(cid) >= 0;
        var b = document.createElement('button'); b.className = 'sec';
        b.innerHTML = '<b>' + CHIPS[cid].name + '</b><br><small style="color:#bda9e8">' + (owned ? '已经拥有，改领 30 分' : CHIPS[cid].desc) + '</small>';
        b.addEventListener('click', function () {
          save[rewardKey] = true;
          if (owned) { G.score += 30; $('resScore').textContent = G.score; }
          else save.chips.push(cid);
          persist(); sfx('win');
          rb.innerHTML = '<div style="font-size:14px;color:#9fe8c1">已领取：' + CHIPS[cid].name + (owned ? '（重复，折算 30 分）' : '') + '</div>';
          renderMenu();
        });
        pick.appendChild(b);
      });
      rb.appendChild(pick);
    } else if (ok && def.reward && save[rewardKey]) {
      rw.hidden = false; rb.innerHTML = '<div style="font-size:13.5px;color:#bda9e8">本阶段芯片奖励已领取过。</div>';
    } else rw.hidden = true;
    var next = $('resNext');
    if (!G.isDaily && ok && G.stageIdx + 1 < STAGES.length) {
      next.textContent = '进入下一阶段'; next.style.display = '';
      next.onclick = function () { startRun(G.stageIdx + 1, false); };
    } else if (!G.isDaily && !ok) {
      next.textContent = '再试一次';
      next.onclick = function () { startRun(G.stageIdx, false); };
    } else { next.style.display = 'none'; }
    $('resRetry').onclick = function () { startRun(G.stageIdx, G.isDaily); };
    $('resMenu').onclick = function () { renderMenu(); PK.show('menu'); };
    PK.show('resP');
    if (ok) { sfx('win'); burst(innerWidth / 2, innerHeight * .3, 44); PK.call('win', G.score); }
    else { sfx('fail'); PK.call('fail', G.score); }
    renderMenu();
  }

  /* ---------- 菜单 ---------- */
  function starStr(n) { return n ? ' ★'.repeat(n).replace(/ /g, '') : ''; }
  function renderMenu() {
    var wrap = $('stages'); wrap.innerHTML = '';
    STAGES.forEach(function (st, i) {
      var locked = i >= save.unlocked;
      var b = document.createElement('button');
      b.className = 'stage' + (locked ? ' locked' : '');
      var best = save.best['s' + i];
      b.innerHTML = '<span class="no">' + (locked ? '锁' : i + 1) + '</span><span class="tx"><b>' + st.name + '</b><small>' +
        st.rounds + ' 轮 · 目标 ' + st.target + ' 分 · ' + st.machines.length + ' 台机器 · ' + st.sub + '</small></span>' +
        '<span class="best">' + (locked ? '未解锁' : best ? '最佳 ' + best + starStr(save.stars['s' + i] || 0) : '未挑战') + '</span>';
      b.addEventListener('click', function () {
        if (locked) { PK.toast('先达成上一阶段目标'); return; }
        sfx('click'); startRun(i, false);
      });
      wrap.appendChild(b);
    });
    var tk = String(todayKey()), db = save.daily[tk] || 0, dd = dailyDef();
    $('dailyCard').innerHTML = '<span class="tx"><b>每日实验</b><small>' + dd.rounds + ' 轮 · 目标 ' + dd.target + ' 分 · 今天所有人是同一副骰子序列</small></span><span class="best">' + (db ? '今日最佳 ' + db : '今日未玩') + '</span>';
    $('dailyCard').onclick = function () { sfx('click'); startRun(2, true); };
    $('mSnd').classList.toggle('off', !AU.on);
  }

  /* ---------- 模拟（平衡测试用，界面不显示） ---------- */
  function simulate(seed, stageIdx, chipIds) {
    var def = STAGES[stageIdx], rng = mulberry32(seed), used = {}, total = 0;
    for (var round = 0; round < def.rounds; round++) {
      var dice = [0, 0, 0, 0, 0].map(function () { return 1 + Math.floor(rng() * 6); });
      var locked = [false, false, false, false, false];
      for (var step = 0; step < 2; step++) {
        var avail = def.machines.filter(function (m) { return !used[m]; });
        var bestEV = -1, bestMask = 0;
        for (var mask = 0; mask < 32; mask++) {
          var lk = [0, 1, 2, 3, 4].map(function (i) { return !!(mask & (1 << i)); });
          var cur = bestScore(dice, avail, null).total;
          var o = rerollOdds(dice, lk, avail, null, -1);
          var ev = o ? o.ev : cur;
          if (ev > bestEV) { bestEV = ev; bestMask = mask; }
        }
        locked = [0, 1, 2, 3, 4].map(function (i) { return !!(bestMask & (1 << i)); });
        dice = dice.map(function (v, i) { return locked[i] ? v : 1 + Math.floor(rng() * 6); });
      }
      var avail2 = def.machines.filter(function (m) { return !used[m]; });
      var bestT = -1, bestM = null, bestC = null;
      avail2.forEach(function (m) {
        [null].concat(chipIds).forEach(function (cid) {
          var t = scoreWith(m, dice, cid).total;
          if (t > bestT) { bestT = t; bestM = m; bestC = cid; }
        });
      });
      used[bestM] = true; total += bestT;
    }
    return total;
  }
  window.__SD = { simulate: simulate, STAGES: STAGES, MACHINES: MACHINES, CHIPS: CHIPS, get: function () { return G; }, save: save };

  /* ---------- 事件 ---------- */
  function bindSnd(id) {
    $(id).addEventListener('click', function () {
      AU.unlock(); AU.set(!AU.on); save.snd = AU.on; persist();
      $('mSnd').classList.toggle('off', !AU.on);
      $('pSnd').textContent = '音效：' + (AU.on ? '开' : '关');
    });
  }
  bindSnd('mSnd'); bindSnd('pSnd');
  $('mHelp').addEventListener('click', function () { PK.show('helpP'); });
  $('helpClose').addEventListener('click', function () { PK.show(G ? 'play' : 'menu'); });
  $('helpOk').addEventListener('click', function () { PK.show(G ? 'play' : 'menu'); });
  $('hBack').addEventListener('click', function () { PK.call('quit'); renderMenu(); PK.show('menu'); });
  $('hPause').addEventListener('click', function () {
    $('pInfo').textContent = G ? G.def.name + ' · 第 ' + G.round + ' 轮 · 当前 ' + G.score + ' 分' : '';
    $('pSnd').textContent = '音效：' + (AU.on ? '开' : '关');
    PK.show('pauseP');
  });
  $('pResume').addEventListener('click', function () { PK.show('play'); });
  $('pRestart').addEventListener('click', function () { startRun(G.stageIdx, G.isDaily); });
  $('pMenu').addEventListener('click', function () { renderMenu(); PK.show('menu'); });
  $('bReroll').addEventListener('click', function () {
    if (!G || G.phase !== 'decide' || G.rolling || G.rerolls <= 0) return;
    var open = []; G.dice.forEach(function (d, i) { if (!d.locked) open.push(i); });
    if (!open.length) { PK.toast('先解锁至少一颗骰子'); return; }
    G.rerolls--; G.phase = 'roll'; render();
    rollDice(open, function () { G.phase = 'decide'; render(); });
  });
  $('bChip').addEventListener('click', function () { if (G && G.phase === 'decide' && !G.rolling) openChips(false); });
  $('cClose').addEventListener('click', closeChips);
  $('cNone').addEventListener('click', function () { G.chip = null; closeChips(); render(); });
  $('sClose').addEventListener('click', function () { PK.show('play'); });
  $('sCancel').addEventListener('click', function () { PK.show('play'); });


  /* 环境音乐：缓慢的琶音循环，音量压得很低 */
  var MUS_SD = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9];
  var musI = 0;
  setInterval(function () {
    if (!AU.on || document.hidden) return;
    var f = MUS_SD[musI++ % MUS_SD.length];
    tone(f, 0, 1.6, .05, 'triangle', { bus: AU.music, verb: true });
    if (musI % 2 === 0) tone(f / 2, 0, 2.2, .04, 'sine', { bus: AU.music, verb: true });
  }, 1150);
  PK.init({ game: 'stardice', save: persist, hubButtons: ['mHub', 'pHub'] });
  renderMenu();
})();
