/* m06-core.js — shared helpers for the meeting 6 animations and figures.
 *
 * A slide holds <div class="m06" data-demo="NAME" data-...></div>.
 * Each demo file registers M06.demos.NAME = function (root, opts) { ... },
 * where opts is root.dataset. The include file loads the core, then the demo
 * files, then calls M06.init(), which renders every div once.
 *
 * Everything is seeded, so Reset replays the same draws and the numbers on
 * screen match the speaker notes. Layout uses fixed viewBox coordinates only:
 * slides that are not showing may be display:none, so never measure text.
 *
 * The pure parts (rng, population, stats, fmt) run under Node for checking:
 *   node -e "global.window=global; require('./m06-core.js'); ..."
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = (G.M06 = G.M06 || {});
  M06.demos = M06.demos || {};

  // Palette: the deck's carnelian accent, ink and greys, plus one blue for a
  // second series.
  M06.col = {
    ink: '#1b1b1b', axis: '#55554f', grey: '#6b6b6b', mid: '#9a9a94',
    light: '#d9d9d4', faint: '#efefeb', red: '#b31b1b', pale: '#f3dede',
    blue: '#2e6e8e', paleblue: '#d7e6ee'
  };

  // ---- random numbers -------------------------------------------------------
  // mulberry32, with normal (polar method), integer, Cauchy and shuffle draws.
  M06.rng = function (seed) {
    var a = seed >>> 0;
    function u() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var spare = null;
    u.normal = function () {
      if (spare !== null) { var s = spare; spare = null; return s; }
      var x, y, r;
      do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r === 0 || r >= 1);
      var f = Math.sqrt(-2 * Math.log(r) / r);
      spare = y * f;
      return x * f;
    };
    u.int = function (n) { return Math.floor(u() * n); };           // 0 .. n-1
    u.cauchy = function () { return Math.tan(Math.PI * (u() - 0.5)); };
    u.shuffle = function (arr) {                                     // in place
      for (var i = arr.length - 1; i > 0; i--) {
        var j = u.int(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    return u;
  };

  // ---- statistics -------------------------------------------------------------
  M06.mean = function (v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s / v.length; };
  // Sample standard deviation (n - 1) unless population is true.
  M06.sd = function (v, population) {
    var m = M06.mean(v), s = 0;
    for (var i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
    return Math.sqrt(s / (v.length - (population ? 0 : 1)));
  };
  M06.quantile = function (v, q) {
    var s = v.slice().sort(function (a, b) { return a - b; });
    var h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  };
  M06.median = function (v) { return M06.quantile(v, 0.5); };
  M06.max = function (v) { var m = -Infinity; for (var i = 0; i < v.length; i++) if (v[i] > m) m = v[i]; return m; };

  // n independent draws from an array (with replacement).
  M06.draw = function (values, n, r) {
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = values[r.int(values.length)];
    return out;
  };

  // ---- the customer population ------------------------------------------------
  // 10,000 customers' monthly spend in dollars, right-skewed (lognormal with a
  // median near $55). Built once from seed 6991. Used by every customer demo,
  // so the true mean is the same number on every slide.
  var customers = null;
  M06.customers = function () {
    if (customers) return customers;
    var r = M06.rng(6991), v = new Array(10000);
    for (var i = 0; i < v.length; i++) {
      v[i] = Math.round(Math.exp(Math.log(55) + 0.65 * r.normal()) * 100) / 100;
    }
    customers = { values: v, mean: M06.mean(v), sd: M06.sd(v, true), median: M06.median(v) };
    return customers;
  };

  // ---- formatting ------------------------------------------------------------
  var MINUS = '−';
  M06.fmt = {
    num: function (x, d) {
      d = d == null ? 0 : d;
      var s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
      return (x < 0 && Number(s.replace(/,/g, '')) !== 0 ? MINUS : '') + s;
    },
    money: function (x, d) { return (x < 0 ? MINUS : '') + '$' + M06.fmt.num(Math.abs(x), d == null ? 1 : d); },
    pct: function (x, d) { return M06.fmt.num(100 * x, d == null ? 1 : d) + '%'; },
    signed: function (x, d) { return (x > 0 ? '+' : '') + M06.fmt.num(x, d); }
  };

  // ---- SVG helpers ----------------------------------------------------------------
  var NS = 'http://www.w3.org/2000/svg';
  M06.el = function (tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  // Text at (x, y). attrs may set anchor ('start' | 'middle' | 'end'), size,
  // fill, weight, style; anything else passes through as an attribute.
  M06.text = function (parent, x, y, str, attrs) {
    attrs = attrs || {};
    var a = {
      x: x, y: y, 'font-size': attrs.size || 18, fill: attrs.fill || M06.col.ink,
      'text-anchor': attrs.anchor || 'start', 'font-weight': attrs.weight || null,
      'font-style': attrs.style || null
    };
    for (var k in attrs) if (['size', 'fill', 'anchor', 'weight', 'style'].indexOf(k) < 0) a[k] = attrs[k];
    var t = M06.el('text', a, parent);
    t.textContent = str;
    return t;
  };
  // A new <svg> filling the container's width, drawn in a w x h coordinate box.
  M06.svg = function (root, w, h, label) {
    var s = M06.el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'm06-svg', role: 'img', 'aria-label': label || null });
    root.appendChild(s);
    return s;
  };
  M06.g = function (parent, attrs) { return M06.el('g', attrs || {}, parent); };

  // Linear scale from data [d0, d1] to pixels [r0, r1], with an inverse.
  M06.scale = function (d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) * (r1 - r0) / (d1 - d0); };
    f.inv = function (p) { return d0 + (p - r0) * (d1 - d0) / (r1 - r0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  };

  // Horizontal axis at pixel height y. ticks: data values. fmt: value -> label.
  // opts.title: axis title under the labels. opts.line: false to omit the line.
  M06.axisX = function (parent, sx, y, ticks, fmt, opts) {
    opts = opts || {};
    var g = M06.g(parent, { class: 'm06-axis' });
    if (opts.line !== false) {
      M06.el('line', { x1: sx.range[0], x2: sx.range[1], y1: y, y2: y, stroke: M06.col.axis, 'stroke-width': 1.5 }, g);
    }
    ticks.forEach(function (t) {
      var x = sx(t);
      M06.el('line', { x1: x, x2: x, y1: y, y2: y + 6, stroke: M06.col.axis, 'stroke-width': 1.5 }, g);
      M06.text(g, x, y + 24, fmt ? fmt(t) : String(t), { size: opts.size || 16, fill: M06.col.grey, anchor: 'middle' });
    });
    if (opts.title) {
      M06.text(g, (sx.range[0] + sx.range[1]) / 2, y + 48, opts.title, { size: 17, fill: M06.col.grey, anchor: 'middle' });
    }
    return g;
  };
  // Vertical axis at pixel x.
  M06.axisY = function (parent, sy, x, ticks, fmt, opts) {
    opts = opts || {};
    var g = M06.g(parent, { class: 'm06-axis' });
    if (opts.line !== false) {
      M06.el('line', { x1: x, x2: x, y1: sy.range[0], y2: sy.range[1], stroke: M06.col.axis, 'stroke-width': 1.5 }, g);
    }
    ticks.forEach(function (t) {
      var y = sy(t);
      M06.el('line', { x1: x - 6, x2: x, y1: y, y2: y, stroke: M06.col.axis, 'stroke-width': 1.5 }, g);
      M06.text(g, x - 10, y + 5, fmt ? fmt(t) : String(t), { size: opts.size || 16, fill: M06.col.grey, anchor: 'end' });
    });
    if (opts.title) {
      var ty = (sy.range[0] + sy.range[1]) / 2;
      M06.text(g, x - 58, ty, opts.title, { size: 17, fill: M06.col.grey, anchor: 'middle', transform: 'rotate(-90 ' + (x - 58) + ' ' + ty + ')' });
    }
    return g;
  };
  // A vertical reference line from y0 to y1, with a label above it. Solid by
  // default, for a true value; pass dash (e.g. '7 5') for an estimate.
  // opts: color, dash, width, label, anchor, size.
  M06.vline = function (parent, x, y0, y1, opts) {
    opts = opts || {};
    var g = M06.g(parent);
    M06.el('line', {
      x1: x, x2: x, y1: y0, y2: y1, stroke: opts.color || M06.col.red,
      'stroke-width': opts.width || 2.5, 'stroke-dasharray': opts.dash || null
    }, g);
    if (opts.label) {
      M06.text(g, x + (opts.anchor === 'end' ? -6 : opts.anchor === 'middle' ? 0 : 6), y0 - 6 + (opts.dy || 0), opts.label,
        { size: opts.size || 17, fill: opts.color || M06.col.red, anchor: opts.anchor || 'start', weight: 600 });
    }
    return g;
  };

  // An incremental histogram drawn as bars on [lo, hi] with nbins bins, its
  // baseline at pixel y0 and at most h pixels tall. Values outside [lo, hi]
  // go in the edge bins. opts: fill, opacity, stroke, maxCount (a floor for
  // the vertical scale, so the first few draws do not fill the panel).
  M06.Hist = function (parent, sx, y0, h, lo, hi, nbins, opts) {
    opts = opts || {};
    var g = M06.g(parent), bins = new Array(nbins).fill(0), rects = [], w = (hi - lo) / nbins, n = 0;
    for (var i = 0; i < nbins; i++) {
      var x0 = sx(lo + i * w), x1 = sx(lo + (i + 1) * w);
      rects.push(M06.el('rect', {
        x: x0 + 0.5, width: Math.max(0.5, x1 - x0 - 1), y: y0, height: 0,
        fill: opts.fill || M06.col.axis, 'fill-opacity': opts.opacity == null ? 0.85 : opts.opacity,
        stroke: opts.stroke || null
      }, g));
    }
    var self = {
      g: g, bins: bins, values: [],
      add: function (v) {
        var k = Math.floor((v - lo) / w);
        if (k < 0) k = 0; if (k >= nbins) k = nbins - 1;
        bins[k]++; n++; self.values.push(v);
        return self;
      },
      addMany: function (arr) { for (var j = 0; j < arr.length; j++) self.add(arr[j]); return self; },
      clear: function () { bins.fill(0); n = 0; self.values = []; self.render(); return self; },
      count: function () { return n; },
      render: function () {
        var m = Math.max(opts.maxCount || 1, Math.max.apply(null, bins));
        for (var j = 0; j < nbins; j++) {
          var hh = bins[j] / m * h;
          rects[j].setAttribute('y', y0 - hh);
          rects[j].setAttribute('height', hh);
        }
        return self;
      }
    };
    return self;
  };

  // ---- HTML controls ----------------------------------------------------------------
  M06.controls = function (root) {
    var bar = document.createElement('div');
    bar.className = 'm06-controls';
    root.appendChild(bar);
    return bar;
  };
  // A button. Blurs after a click so the arrow keys go back to the slides.
  M06.button = function (bar, label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'm06-btn';
    b.textContent = label;
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(e); b.blur(); });
    bar.appendChild(b);
    return b;
  };
  // A segmented choice: labels[i] selects values[i]. Returns { set(value) }.
  M06.toggle = function (bar, labels, values, initial, onChange) {
    var wrap = document.createElement('span'), btns = [];
    wrap.className = 'm06-toggle';
    labels.forEach(function (lab, i) {
      var b = M06.button(wrap, lab, function () { api.set(values[i]); onChange(values[i]); });
      btns.push(b);
    });
    var api = {
      set: function (v) { btns.forEach(function (b, i) { b.classList.toggle('on', values[i] === v); }); }
    };
    api.set(initial);
    bar.appendChild(wrap);
    return api;
  };
  // A range slider with a leading label. onInput(value) fires as it moves.
  M06.slider = function (bar, label, min, max, step, value, onInput) {
    var lab = document.createElement('label'), s = document.createElement('input');
    lab.className = 'm06-slabel';
    lab.textContent = label;
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
    s.className = 'm06-slider';
    s.addEventListener('input', function () { onInput(Number(s.value)); });
    s.addEventListener('change', function () { s.blur(); });
    bar.appendChild(lab);
    bar.appendChild(s);
    return s;
  };
  M06.readout = function (root) {
    var d = document.createElement('div');
    d.className = 'm06-readout';
    root.appendChild(d);
    return d;
  };

  // ---- animation ------------------------------------------------------------------
  // Calls step(p) with p going 0 -> 1 over ms milliseconds, then done().
  // Returns { cancel() }.
  M06.animate = function (ms, step, done) {
    var t0 = null, id = null, dead = false;
    function f(ts) {
      if (dead) return;
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / ms);
      step(p);
      if (p < 1) id = requestAnimationFrame(f); else if (done) done();
    }
    id = requestAnimationFrame(f);
    return { cancel: function () { dead = true; if (id) cancelAnimationFrame(id); } };
  };
  // Runs tick() once per frame until it returns false. Returns { cancel() }.
  M06.frames = function (tick, done) {
    var id = null, dead = false;
    function f() {
      if (dead) return;
      if (tick() === false) { if (done) done(); return; }
      id = requestAnimationFrame(f);
    }
    id = requestAnimationFrame(f);
    return { cancel: function () { dead = true; if (id) cancelAnimationFrame(id); } };
  };
  M06.ease = function (p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };

  // ---- start-up ---------------------------------------------------------------------
  M06.init = function () {
    function run() {
      var nodes = document.querySelectorAll('.m06[data-demo]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.dataset.ready) continue;
        var f = M06.demos[el.dataset.demo];
        el.dataset.ready = '1';
        if (!f) { el.textContent = 'Missing demo: ' + el.dataset.demo; continue; }
        try { f(el, el.dataset); } catch (e) {
          if (G.console) console.error(e);
          el.textContent = 'Demo error in ' + el.dataset.demo + ': ' + e.message;
        }
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  };

  // ---- styles -------------------------------------------------------------------------
  if (typeof document !== 'undefined' && !document.getElementById('m06-style')) {
    var css = [
      '.m06 { margin: 0.25em auto 0; }',
      '.m06-svg { display: block; width: 100%; height: auto; overflow: visible; }',
      '.m06-controls { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; margin: 8px 0 0; font-size: 18px; line-height: 1.2; }',
      '.m06-toggle { display: inline-flex; gap: 4px; margin-left: 6px; }',
      '.m06-btn { font: inherit; font-size: 18px; line-height: 1.2; padding: 4px 12px; border: 2px solid #b31b1b;',
      '  background: #fff; color: #b31b1b; border-radius: 6px; cursor: pointer; }',
      '.m06-btn:hover { background: #f3dede; }',
      '.m06-btn.on, .m06-btn.on:hover { background: #b31b1b; color: #fff; }',
      '.m06-btn:disabled { opacity: 0.4; cursor: default; }',
      '.m06-slabel { font-size: 18px; color: #6b6b6b; margin-left: 6px; }',
      '.m06-slider { width: 280px; accent-color: #b31b1b; vertical-align: middle; }',
      '.m06-readout { font-size: 20px; color: #1b1b1b; margin-top: 6px; min-height: 1.3em; line-height: 1.35; }',
      '.m06-readout b { color: #b31b1b; font-weight: 700; }',
      '.m06-readout .sep { color: #9a9a94; margin: 0 8px; }'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'm06-style';
    st.textContent = css;
    document.head.appendChild(st);
  }
})();
