/* 小游戏通用件（自包含，每款游戏各带一份）：存档、屏幕切换、提示条、震动、Web Audio 合成、可选统计与返回大厅。
   大厅接入只靠 index.html 里的两个 meta：
   <meta name="hub-url" content="../">      有则显示「返回游戏屋」按钮，没有则隐藏（单独打包给 App 时删掉即可）
   <meta name="hub-track" content="../track.js">  有则加载统计脚本，没有则统计调用全部为空操作 */
(function (W) {
  'use strict';
  var D = document, $ = function (id) { return D.getElementById(id); };
  var meta = function (n) { var m = D.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : null; };
  var PK = { $: $, hub: meta('hub-url'), game: '' };
  var NO = { title: function () { }, lv: function () { }, win: function () { }, fail: function () { }, quit: function () { }, pause: function () { }, hub: function () { }, sound: function () { }, ev: function () { } };
  PK.gt = function () { return (W.GT && W.GT._v) ? W.GT : NO; };
  PK.call = function (fn) { try { var g = PK.gt(); var a = [].slice.call(arguments, 1); g[fn].apply(g, a); } catch (e) { } };
  (function () { var t = meta('hub-track'); if (!t) return; var s = D.createElement('script'); s.src = t; s.defer = true; s.onerror = function () { }; D.head.appendChild(s); })();
  PK.load = function (key, def, migrate) {
    try { var s = localStorage.getItem(key); if (s) { var o = JSON.parse(s); if (migrate) o = migrate(o) || o; for (var k in def) if (!(k in o)) o[k] = JSON.parse(JSON.stringify(def[k])); return o; } } catch (e) { }
    return JSON.parse(JSON.stringify(def));
  };
  PK.save = function (key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; } };
  PK.recent = function (id) { if (!PK.hub) return; try { var a = JSON.parse(localStorage.getItem('th_recent') || '[]').filter(function (x) { return x && x.g !== id; }); a.unshift({ g: id, t: Date.now() }); localStorage.setItem('th_recent', JSON.stringify(a.slice(0, 12))); } catch (e) { } };
  PK.init = function (o) {
    PK.game = o.game; PK.saveFn = o.save || function () { };
    PK.recent(o.game);
    (o.hubButtons || []).forEach(function (id) { var b = $(id); if (!b) return; if (!PK.hub) { b.style.display = 'none'; return; } b.addEventListener('click', PK.goHub); });
    var bye = function () { try { PK.saveFn(); } catch (e) { } };
    W.addEventListener('pagehide', bye);
    D.addEventListener('visibilitychange', function () { if (D.hidden) { bye(); if (o.onHide) o.onHide(); } else if (o.onShow) o.onShow(); });
  };
  PK.goHub = function (e) { if (e && e.stopPropagation) e.stopPropagation(); try { PK.saveFn(); } catch (_) { } PK.call('hub', e && e.currentTarget && e.currentTarget.id); setTimeout(function () { location.href = PK.hub || './'; }, 60); };
  PK.show = function (id) { [].forEach.call(D.querySelectorAll('.scr'), function (s) { s.classList.toggle('on', s.id === id); }); };
  var tt = 0; PK.toast = function (msg, ms) { var t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, ms || 1600); };
  PK.vib = function (p) { try { if (PK.vibOn !== false && navigator.vibrate) navigator.vibrate(p); } catch (e) { } };
  PK.audio = function (opt) {
    opt = opt || {}; var A = { on: true }, ac = null, nb;
    A.init = function () {
      if (ac) return ac; var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return null;
      try { ac = new AC(); } catch (e) { return null; }
      var comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ac.destination);
      A.out = ac.createGain(); A.out.gain.value = A.on ? (opt.vol || .8) : 0; A.out.connect(comp);
      A.music = ac.createGain(); A.music.gain.value = opt.music || .22; A.music.connect(A.out);
      nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); var d = nb.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.verb = ac.createGain(); A.verb.gain.value = .25;
      var dl = ac.createDelay(1); dl.delayTime.value = .19; var fb = ac.createGain(); fb.gain.value = .28; var lp = ac.createBiquadFilter(); lp.frequency.value = 2400;
      A.verb.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(A.out);
      return ac;
    };
    A.unlock = function () { A.init(); if (ac && ac.state === 'suspended') try { ac.resume(); } catch (e) { } };
    A.t = function () { return ac ? ac.currentTime : 0; };
    A.tone = function (f, t, dur, vol, type, o) {
      if (!ac || !A.on) return; o = o || {}; t = t || ac.currentTime;
      var n = ac.createOscillator(), g = ac.createGain(); n.type = type || 'sine'; n.frequency.setValueAtTime(f, t);
      if (o.to) n.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || .006)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      n.connect(g); g.connect(o.bus || A.out); if (o.verb) g.connect(A.verb); n.start(t); n.stop(t + dur + .05);
    };
    A.noise = function (t, dur, vol, f, q, type, to) {
      if (!ac || !A.on) return; t = t || ac.currentTime;
      var s = ac.createBufferSource(); s.buffer = nb; var fl = ac.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 2000, t); fl.Q.value = q || 1;
      if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
      var g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(A.out); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
    };
    A.set = function (on) { A.on = on; if (A.out) A.out.gain.setTargetAtTime(on ? (opt.vol || .8) : 0, ac.currentTime, .03); PK.call('sound', 'sfx', on); };
    return A;
  };
  PK.fmt = function (s) { s = Math.max(0, Math.ceil(s)); return ('0' + (s / 60 | 0)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); };
  W.PK = PK;
})(window);
