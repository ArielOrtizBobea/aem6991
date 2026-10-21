/* m06-sampling.js — the sampling animations for meeting 6.
 *
 * Five demos, all drawing from the customer population in m06-core.js:
 *
 *   sampling    Draw samples and build the distribution of their means.
 *               data-n (50); data-mode "basic" (default) or "se", which adds
 *               s/√n from the last sample beside the SD across samples.
 *   samplesize  The same at several sample sizes, one row each, one scale.
 *               data-ns ("25,100,400").
 *   intervals   95% intervals from repeated samples, and how many miss.
 *               data-n (50).
 *   running     A running mean settling on the truth, and, beside it, a
 *               heavy-tailed variable whose running mean never settles.
 *               data-mode "customers" (default) or "both".
 *   biased      A random sample beside respondents only, where the chance
 *               of responding rises with spend.
 *               data-ns ("25,100,400,1600"); the first is the starting n.
 *
 * Every demo also takes data-seed, to replace its default seed (sampling
 * 101, samplesize 202, intervals 303, running 404, biased 505); running
 * takes data-heavy-seed for the Cauchy stream (531).
 *
 * On-screen wording follows the instructor's terms: mean, standard
 * deviation (SD), estimated standard error, respondents.
 *
 * The draws live in M06.sims and touch no DOM, so the numbers can be checked
 * in Node:
 *   node -e "global.window = global; require('./m06-core.js');
 *            require('./m06-sampling.js'); ..."
 * Each demo takes its draws from those functions in the same order, so a
 * fresh Reset followed by the same clicks shows the same numbers.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06 || !M06.rng) throw new Error('Load m06-core.js before m06-sampling.js');
  M06.sims = M06.sims || {};
  var col = M06.col, fmt = M06.fmt;

  // ---- small helpers ------------------------------------------------------------
  var SEP = '<span class="sep">·</span>', DASH = '—';
  function money(x, d) { return fmt.money(x, d == null ? 2 : d); }
  function money0(x) { return fmt.money(x, 0); }
  function num(x, d) { return fmt.num(x, d); }
  function bold(s) { return '<b>' + s + '</b>'; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ticks(a, b, step) { var out = []; for (var v = a; v <= b + 1e-9; v += step) out.push(v); return out; }
  function intOpt(v, dflt) { var n = parseInt(v, 10); return n > 0 ? n : dflt; }
  function intList(v, dflt) {
    var out = String(v == null ? '' : v).split(',')
      .map(function (s) { return parseInt(s, 10); })
      .filter(function (n) { return n > 1; });
    return out.length ? out : dflt.slice();
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function show(node, on) { node.setAttribute('visibility', on ? 'visible' : 'hidden'); }
  function tallest(bins) { return Math.max.apply(null, bins); }
  var uidN = 0;
  function uid(p) { uidN += 1; return 'm06s-' + p + '-' + uidN; }

  // Estimates off the axis are left out of the bars (the core histogram would
  // pile them into the edge bins) but still count in every readout.
  function binOf(v, lo, hi, nb) {
    if (!(v >= lo && v <= hi)) return -1;
    return Math.min(nb - 1, Math.floor((v - lo) / ((hi - lo) / nb)));
  }
  function addIn(h, v, lo, hi) { if (v >= lo && v <= hi) h.add(v); }

  // ---- one action at a time --------------------------------------------------------
  // An action is a list of steps { begin(), ms, step(p), end() }, each part
  // optional, run in order; a step with ms > 0 is animated. finish() jumps to
  // the end state: it ends the current step, then begins and ends the rest
  // with no animation. cancel() just stops.
  function job(steps, onOver) {
    var i = 0, anim = null, over = false, begun = false;
    function begin(s) { begun = true; if (s.begin) s.begin(); }
    function end(s) { begun = false; if (s.end) s.end(); }
    function stop() { over = true; if (onOver) onOver(); }
    function play(s) {
      anim = M06.animate(s.ms, function (p) { if (s.step) s.step(p); }, function () {
        anim = null; i++; end(s); next();
      });
    }
    function next() {
      while (!over && i < steps.length) {
        var s = steps[i];
        begin(s);
        if (s.ms > 0) { play(s); return; }
        i++; end(s);
      }
      if (!over) stop();
    }
    return {
      start: next,
      finish: function () {
        if (over) return;
        if (anim) { anim.cancel(); anim = null; }
        while (i < steps.length) {
          var s = steps[i++];
          if (!begun) begin(s);
          end(s);
        }
        stop();
      },
      cancel: function () { if (anim) { anim.cancel(); anim = null; } over = true; }
    };
  }
  // Holds the demo's running action. run() first finishes whatever is running,
  // so a new click never double counts or leaves a half-drawn state. onIdle
  // fires when nothing is running any more.
  function runner(onIdle) {
    var cur = null;
    var R = {
      run: function (steps) {
        R.finish();
        var j = job(steps, function () { if (cur === j) { cur = null; if (onIdle) onIdle(); } });
        cur = j;
        j.start();
      },
      finish: function () { if (cur) cur.finish(); },
      cancel: function () { var c = cur; cur = null; if (c) c.cancel(); if (onIdle) onIdle(); },
      busy: function () { return cur !== null; }
    };
    return R;
  }

  // ---- simulations (no DOM) ------------------------------------------------------------
  // How many estimates, their mean and their standard deviation (n - 1).
  // The mean and the SD are null until they are defined.
  M06.sims.summary = function (v) {
    return { count: v.length, mean: v.length ? M06.mean(v) : null, sd: v.length >= 2 ? M06.sd(v) : null };
  };

  // 1. sampling: a stream of samples of n customers, drawn independently.
  M06.sims.sampling = function (n, seed) {
    var pop = M06.customers().values, r = M06.rng(seed == null ? 101 : seed), k = 0;
    return {
      next: function () {
        var s = M06.draw(pop, n, r), sd = M06.sd(s);
        return { index: k++, values: s, mean: M06.mean(s), sd: sd, se: sd / Math.sqrt(n) };
      }
    };
  };

  // 2. samplesize: each next() draws one sample at every n, in the order
  // given, and returns their means.
  M06.sims.samplesize = function (ns, seed) {
    var pop = M06.customers().values, r = M06.rng(seed == null ? 202 : seed);
    return {
      next: function () { return ns.map(function (n) { return M06.mean(M06.draw(pop, n, r)); }); }
    };
  };

  // 3. intervals: each next() is one sample's 95% interval, mean ± 1.96 s/√n.
  M06.sims.intervals = function (n, seed) {
    var c = M06.customers(), r = M06.rng(seed == null ? 303 : seed);
    return {
      next: function () {
        var s = M06.draw(c.values, n, r), m = M06.mean(s), se = M06.sd(s) / Math.sqrt(n);
        var lo = m - 1.96 * se, hi = m + 1.96 * se;
        return { mean: m, se: se, lo: lo, hi: hi, covers: lo <= c.mean && c.mean <= hi };
      }
    };
  };

  // 4. running: the running mean along a stream of draws, either of
  // customers' spend or of standard Cauchy draws (heavy tails, centered on 0).
  // path(len) continues the stream and returns the mean after each draw.
  // The Cauchy seed is the first from 405 up whose first path stays near 0
  // for over a thousand draws and then jumps: at draw 1,466 a single draw of
  // about −3,600 moves the running mean from −0.20 to −2.68.
  var RUN_SEEDS = { customers: 404, cauchy: 531 };
  M06.sims.running = function (kind, seed) {
    var pop = M06.customers().values, cauchy = kind === 'cauchy';
    var r = M06.rng(seed != null ? seed : cauchy ? RUN_SEEDS.cauchy : RUN_SEEDS.customers);
    return {
      path: function (len) {
        var out = new Array(len), s = 0;
        for (var k = 0; k < len; k++) {
          s += cauchy ? r.cauchy() : pop[r.int(pop.length)];
          out[k] = s / (k + 1);
        }
        return out;
      }
    };
  };
  M06.sims.running.seeds = RUN_SEEDS;

  // 5. biased: a random sample beside a sample of respondents only, where
  // each customer responds with probability proportional to √spend.
  var respTable = null;
  function respondents() {
    if (respTable) return respTable;
    var v = M06.customers().values, cum = new Float64Array(v.length), s = 0;
    for (var i = 0; i < v.length; i++) { s += Math.sqrt(v[i]); cum[i] = s; }
    respTable = { cum: cum, total: s };
    return respTable;
  }
  // One respondent: a weighted draw, by binary search on the cumulative
  // weights.
  function drawRespondent(pop, T, r) {
    var u = r() * T.total, lo = 0, hi = pop.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (T.cum[mid] > u) hi = mid; else lo = mid + 1;
    }
    return pop[lo];
  }
  M06.sims.biased = function (n, seed) {
    var pop = M06.customers().values, T = respondents(), r = M06.rng(seed == null ? 505 : seed);
    return {
      // One random sample, then one sample of respondents; both means.
      next: function () {
        var a = 0, b = 0, i;
        for (i = 0; i < n; i++) a += pop[r.int(pop.length)];
        for (i = 0; i < n; i++) b += drawRespondent(pop, T, r);
        return [a / n, b / n];
      }
    };
  };
  // Where the respondents' sample means center: the √spend-weighted mean of
  // spend.
  M06.sims.biased.expected = function () {
    var v = M06.customers().values, sw = 0, swx = 0;
    for (var i = 0; i < v.length; i++) { var w = Math.sqrt(v[i]); sw += w; swx += w * v[i]; }
    return swx / sw;
  };

  // ---- 1. sampling -------------------------------------------------------------------------
  // Top: the population, which never changes, with the current sample over
  // it. Bottom: the mean of each sample. Both panels share one axis, so the
  // true mean (solid line) and the sample mean (dashed line) run straight
  // through both, and each sample mean drops vertically into its bar.
  M06.demos.sampling = function (root, opts) {
    var n = Math.max(2, intOpt(opts.n, 50)), seMode = opts.mode === 'se', seed = intOpt(opts.seed, 101);
    var pop = M06.customers(), truth = pop.mean;
    var L = 40, R = 920, yT = 185, yB = 390, lo = 0, hi = 300;
    var sx = M06.scale(lo, hi, L, R), xTrue = sx(truth);
    var svg = M06.svg(root, 960, 430, 'The population of 10,000 customers, one sample of ' + num(n) +
      ' drawn from it, and a histogram of the mean spend in each sample, on one axis');

    // Legend: what is fixed and what is drawn.
    M06.el('rect', { x: L, y: 7, width: 14, height: 14, fill: col.light }, svg);
    M06.text(svg, L + 20, 19, 'Population: monthly spend of all 10,000 customers (fixed)', { size: 16, fill: col.grey });
    M06.el('circle', { cx: 598, cy: 14, r: 5, fill: col.red, 'fill-opacity': 0.8 }, svg);
    M06.text(svg, 608, 19, 'one random sample of ' + num(n) + ' customers', { size: 16, fill: col.red });

    // Top panel: the population and the current sample.
    M06.Hist(svg, sx, yT, 110, 0, 300, 60, { fill: col.light, opacity: 1 }).addMany(pop.values).render();
    M06.axisX(svg, sx, yT, ticks(0, 300, 50), money0);
    var dotsG = M06.g(svg);

    // Bottom panel: one mean per sample, on the same axis.
    M06.text(svg, R, 247, 'Sampling distribution: mean spend in each sample of ' + num(n) + ' customers', { size: 16, fill: col.grey, anchor: 'end' });
    var hist = M06.Hist(svg, sx, yB, 105, lo, hi, 200, { fill: col.axis, maxCount: 10 });
    M06.axisX(svg, sx, yB, ticks(0, 300, 50), money0);

    // The true mean: a solid line through both panels. The sample mean: a
    // dashed line through both panels. Same colour, different line.
    M06.el('line', { x1: r1(xTrue), x2: r1(xTrue), y1: 50, y2: yB, stroke: col.red, 'stroke-width': 2.5 }, svg);
    var trueLab = M06.text(svg, xTrue + 6, 44, 'true mean ' + money(truth, 2), { size: 16, fill: col.red, weight: 700 });
    var markG = M06.g(svg);
    var smLine = M06.el('line', { y1: 70, y2: yB, stroke: col.red, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, markG);
    var markLab = M06.text(markG, L, 64, '', { size: 16, fill: col.red, weight: 700 });
    var dot = M06.el('circle', { r: 5.5, fill: col.red }, svg);

    // se mode: a bracket over the sampling distribution spanning ±1 SD of the
    // estimates, labelled as the standard error. It updates with every draw.
    var yS = yB - 105 - 16, xLab = 430;
    var sdG = M06.g(svg, { visibility: 'hidden' });
    var sdBar = M06.el('line', { y1: yS, y2: yS, stroke: col.red, 'stroke-width': 2.5 }, sdG);
    var sdL = M06.el('line', { y1: yS - 7, y2: yS + 7, stroke: col.red, 'stroke-width': 2.5 }, sdG);
    var sdR = M06.el('line', { y1: yS - 7, y2: yS + 7, stroke: col.red, 'stroke-width': 2.5 }, sdG);
    var sdLead = M06.el('line', { y1: yS, y2: yS, x2: xLab - 8, stroke: col.red, 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }, sdG);
    var sdLab = M06.text(sdG, xLab, yS + 5, '', { size: 16, fill: col.red, weight: 700 });
    function showSD(on, m, sd) {
      if (!seMode || !on) { sdG.setAttribute('visibility', 'hidden'); return; }
      var x1 = r1(sx(m - sd)), x2 = r1(sx(m + sd));
      sdBar.setAttribute('x1', x1); sdBar.setAttribute('x2', x2);
      sdL.setAttribute('x1', x1); sdL.setAttribute('x2', x1);
      sdR.setAttribute('x1', x2); sdR.setAttribute('x2', x2);
      sdLead.setAttribute('x1', x2 + 4);
      sdLab.textContent = '±1 SD of the estimates (' + money(sd, 2) + '): the standard error';
      sdG.setAttribute('visibility', 'visible');
    }

    // Labels sit on opposite sides of their lines so they never collide.
    function placeTrue(side) {
      trueLab.setAttribute('text-anchor', side === 'left' ? 'end' : 'start');
      trueLab.setAttribute('x', r1(xTrue + (side === 'left' ? -6 : 6)));
    }

    var bar = M06.controls(root), out = M06.readout(root);
    var run = runner(), sim, means, ses, last;

    function hideSample() { clear(dotsG); show(markG, false); show(dot, false); placeTrue('right'); }
    function showDots(s) {
      clear(dotsG);
      var jr = M06.rng(9000 + s.index);           // vertical jitter only, off the sampling stream
      for (var i = 0; i < s.values.length; i++) {
        M06.el('circle', {
          cx: r1(sx(clamp(s.values[i], 0, 300))), cy: r1(90 + 86 * jr()), r: 4,
          fill: col.red, 'fill-opacity': 0.8
        }, dotsG);
      }
    }
    function showMark(s) {
      var x = sx(clamp(s.mean, 0, 300)), left = s.mean < truth;
      smLine.setAttribute('x1', r1(x)); smLine.setAttribute('x2', r1(x));
      markLab.textContent = 'sample mean ' + money(s.mean, 2);
      markLab.setAttribute('text-anchor', left ? 'end' : 'start');
      markLab.setAttribute('x', r1(x + (left ? -6 : 6)));
      placeTrue(left ? 'right' : 'left');
      show(markG, true);
    }
    function moveDot(s, p) {
      var x = sx(clamp(s.mean, 0, 300)), e = M06.ease(p);
      dot.setAttribute('cx', r1(x));
      dot.setAttribute('cy', r1(yT + (yB - yT) * e));
      show(dot, true);
    }
    function add(s) { means.push(s.mean); ses.push(s.se); last = s; addIn(hist, s.mean, lo, hi); }
    function update() {
      var c = means.length;
      var h;
      if (seMode) {
        h = 'Samples: ' + num(c) +
          SEP + 'SD of the estimates: ' + (c >= 2 ? bold(money(M06.sd(means), 2)) : DASH) +
          SEP + 'True standard error σ/√n: ' + money(pop.sd / Math.sqrt(n), 2) +
          '<br>Estimated standard error s/√n: last sample ' + (last ? bold(money(last.se, 2)) : DASH) +
          SEP + 'mean over all samples ' + (ses.length ? bold(money(M06.mean(ses), 2)) : DASH);
      } else {
        h = 'Samples: ' + num(c) +
          SEP + 'Mean of the estimates: ' + (c ? bold(money(M06.mean(means), 2)) : DASH) +
          SEP + 'Standard deviation of the estimates: ' + (c >= 2 ? bold(money(M06.sd(means), 2)) : DASH);
      }
      out.innerHTML = h;
      showSD(c >= 2, c ? M06.mean(means) : 0, c >= 2 ? M06.sd(means) : 0);
    }
    // One sample, animated: the dots fade in, their mean is marked, and a
    // dot carries it down to the histogram. Fast is about 150 ms a sample.
    function sampleSteps(s, fast) {
      return [
        {
          begin: function () { show(dot, false); show(markG, false); showDots(s); dotsG.setAttribute('opacity', 0); },
          ms: fast ? 25 : 400,
          step: function (p) { dotsG.setAttribute('opacity', p.toFixed(3)); },
          end: function () { dotsG.setAttribute('opacity', 1); }
        },
        {
          begin: function () { showMark(s); markG.setAttribute('opacity', 0); },
          ms: fast ? 0 : 200,
          step: function (p) { markG.setAttribute('opacity', p.toFixed(3)); },
          end: function () { markG.setAttribute('opacity', 1); }
        },
        {
          begin: function () { moveDot(s, 0); },
          ms: fast ? 100 : 500,
          step: function (p) { moveDot(s, p); },
          end: function () { moveDot(s, 1); add(s); hist.render(); update(); }
        }
      ];
    }
    function drawOne() {
      run.finish();
      run.run(sampleSteps(sim.next(), false));
    }
    function drawTen() {
      run.finish();
      var steps = [];
      for (var i = 0; i < 10; i++) steps = steps.concat(sampleSteps(sim.next(), true));
      run.run(steps);
    }
    // Many samples: no dots on the way, the histogram fills in batches, and
    // the last sample is shown at the end.
    function drawMany(k) {
      run.finish();
      var batch = [], done = 0;
      for (var i = 0; i < k; i++) batch.push(sim.next());
      function upTo(t) { while (done < t) add(batch[done++]); hist.render(); update(); }
      run.run([{
        begin: hideSample,
        ms: 2000,
        step: function (p) { upTo(Math.floor(k * p)); },
        end: function () {
          upTo(k);
          var s = batch[k - 1];
          showDots(s); dotsG.setAttribute('opacity', 1);
          showMark(s); markG.setAttribute('opacity', 1);
          moveDot(s, 1);
        }
      }]);
    }
    function reset() {
      run.cancel();
      sim = M06.sims.sampling(n, seed);
      means = []; ses = []; last = null;
      hist.clear();
      hideSample();
      update();
    }
    M06.button(bar, 'Draw one sample', drawOne);
    M06.button(bar, 'Draw 10', drawTen);
    M06.button(bar, 'Draw 1,000', function () { drawMany(1000); });
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 2. samplesize ------------------------------------------------------------------------
  // One row per sample size on one vertical scale, so the large-n row stands
  // tall and narrow and the small-n row lies flat and wide.
  M06.demos.samplesize = function (root, opts) {
    var ns = intList(opts.ns, [25, 100, 400]), K = 1000, seed = intOpt(opts.seed, 202);
    var truth = M06.customers().mean;
    var L = 130, R = 810, lo = 40, hi = 100, nb = 60, top = 34, axisY = 350, gap = 12;
    var sx = M06.scale(lo, hi, L, R), rowH = (axisY - top - (ns.length - 1) * gap) / ns.length;
    var svg = M06.svg(root, 960, 420, 'Histograms of the mean spend in samples of ' +
      ns.map(function (n) { return num(n); }).join(', ') + ' customers, on one scale');

    var rows = ns.map(function (n, i) {
      var base = top + (i + 1) * rowH + i * gap, mid = base - rowH / 2;
      if (i < ns.length - 1) M06.el('line', { x1: L, x2: R, y1: r1(base), y2: r1(base), stroke: col.light, 'stroke-width': 1.5 }, svg);
      M06.text(svg, L - 18, r1(mid + 7), 'n = ' + num(n), { size: 20, anchor: 'end', weight: 600 });
      var o = { fill: col.axis, maxCount: 10 };
      return {
        n: n, o: o, means: [],
        h: M06.Hist(svg, sx, base, rowH - 3, lo, hi, nb, o),
        lab: M06.text(svg, R + 18, r1(mid + 6), '', { size: 18, fill: col.axis })
      };
    });
    M06.axisX(svg, sx, axisY, ticks(lo, hi, 10), money0, { title: 'Mean spend in each sample' });
    M06.vline(svg, sx(truth), 30, axisY, { label: 'true mean ' + money(truth, 2) });

    var bar = M06.controls(root), out = M06.readout(root);
    var run = runner(), sim;

    function update() {
      var parts = rows.map(function (r) {
        var sd = r.means.length >= 2 ? money(M06.sd(r.means), 2) : null;
        r.lab.textContent = 'SD ' + (sd || DASH);
        return 'n = ' + num(r.n) + ' ' + (sd ? bold(sd) : DASH);
      });
      out.innerHTML = 'Standard deviation of the estimates: ' + parts.join(SEP);
    }
    function draw() {
      run.finish();
      var batch = [], done = 0, m = 10, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      // The tallest bar anywhere once this draw is in sets the scale for
      // every row, so the bars grow into place.
      rows.forEach(function (r, j) {
        var b = r.h.bins.slice();
        for (var q = 0; q < K; q++) { var k = binOf(batch[q][j], lo, hi, nb); if (k >= 0) b[k]++; }
        m = Math.max(m, tallest(b));
      });
      rows.forEach(function (r) { r.o.maxCount = m; });
      function upTo(t) {
        while (done < t) {
          var s = batch[done++];
          rows.forEach(function (r, j) { r.means.push(s[j]); addIn(r.h, s[j], lo, hi); });
        }
        rows.forEach(function (r) { r.h.render(); });
        update();
      }
      run.run([{ ms: 2000, step: function (p) { upTo(Math.floor(K * p)); }, end: function () { upTo(K); } }]);
    }
    function reset() {
      run.cancel();
      sim = M06.sims.samplesize(ns, seed);
      rows.forEach(function (r) { r.means = []; r.o.maxCount = 10; r.h.clear(); });
      update();
    }
    M06.button(bar, 'Draw 1,000 samples of each', draw);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 3. intervals ---------------------------------------------------------------------------
  // Each sample gives a 95% interval, stacked from the bottom up with the
  // newest on top. Intervals that miss the true mean turn carnelian.
  M06.demos.intervals = function (root, opts) {
    var n = Math.max(2, intOpt(opts.n, 50)), seed = intOpt(opts.seed, 303);
    var truth = M06.customers().mean;
    var L = 40, R = 920, lo = 40, hi = 100, axisY = 362, row0 = 352, gap = 6.5, ROWS = 50;
    var sx = M06.scale(lo, hi, L, R);
    var svg = M06.svg(root, 960, 420, '95% intervals from repeated samples of ' + num(n) +
      ' customers, and whether each one covers the true mean');

    var pool = [], rowsG = M06.g(svg);
    for (var i = 0; i < ROWS; i++) {
      var g = M06.g(rowsG, { visibility: 'hidden' });
      pool.push({ g: g, line: M06.el('line', { 'stroke-width': 3 }, g), dot: M06.el('circle', { r: 3 }, g) });
    }
    M06.axisX(svg, sx, axisY, ticks(lo, hi, 10), money0, { title: 'Mean spend' });
    M06.vline(svg, sx(truth), 28, axisY, { color: col.ink, label: 'true mean ' + money(truth, 2) });

    var bar = M06.controls(root), out = M06.readout(root);
    var run = runner(), sim, recent, growing, grow, count, misses;

    // frac grows the line out from its mean; the color shows once it is whole.
    function paint(P, it, y, frac, done) {
      var xm = sx(clamp(it.mean, lo, hi)), xa = sx(clamp(it.lo, lo, hi)), xb = sx(clamp(it.hi, lo, hi));
      var miss = done && !it.covers;
      P.line.setAttribute('x1', r1(xm + (xa - xm) * frac));
      P.line.setAttribute('x2', r1(xm + (xb - xm) * frac));
      P.line.setAttribute('y1', y);
      P.line.setAttribute('y2', y);
      P.line.setAttribute('stroke', miss ? col.red : col.mid);
      P.line.setAttribute('stroke-width', miss ? 3.5 : 3);
      P.dot.setAttribute('cx', r1(xm));
      P.dot.setAttribute('cy', y);
      P.dot.setAttribute('fill', miss ? col.red : col.axis);
      show(P.g, true);
    }
    function render() {
      for (var i = 0; i < ROWS; i++) {
        var it = recent[i];
        if (!it) { show(pool[i].g, false); continue; }
        paint(pool[i], it, r1(row0 - i * gap), it === growing ? grow : 1, it !== growing);
      }
    }
    function push(it) { recent.push(it); if (recent.length > ROWS) recent.shift(); }
    function commit(it) { count++; if (!it.covers) misses++; }
    function update() {
      out.innerHTML = 'Intervals: ' + num(count) + SEP + 'Intervals that miss the true mean: ' +
        (count ? bold(num(misses)) + ' (' + fmt.pct(misses / count, 0) + ')' : DASH);
    }
    function drawOne() {
      run.finish();
      var it = sim.next();
      run.run([{
        begin: function () { push(it); growing = it; grow = 0; render(); },
        ms: 450,
        step: function (p) { grow = M06.ease(p); render(); },
        end: function () { growing = null; grow = 1; commit(it); render(); update(); }
      }]);
    }
    function drawK(k, ms) {
      run.finish();
      var batch = [], done = 0;
      for (var i = 0; i < k; i++) batch.push(sim.next());
      function upTo(t) {
        while (done < t) { var it = batch[done++]; push(it); commit(it); }
        render(); update();
      }
      run.run([{ ms: ms, step: function (p) { upTo(Math.floor(k * p)); }, end: function () { upTo(k); } }]);
    }
    function reset() {
      run.cancel();
      sim = M06.sims.intervals(n, seed);
      recent = []; growing = null; grow = 1; count = 0; misses = 0;
      render(); update();
    }
    M06.button(bar, 'Draw one', drawOne);
    M06.button(bar, 'Draw 20', function () { drawK(20, 1200); });
    M06.button(bar, 'Draw 100', function () { drawK(100, 2000); });
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 4. running --------------------------------------------------------------------------------
  // The running mean after each of 2,000 draws, drawn left to right.
  // "both" adds a heavy-tailed variable whose running mean keeps jumping.
  M06.demos.running = function (root, opts) {
    var both = opts.mode === 'both', LEN = 2000;
    var truth = M06.customers().mean;
    var spend = {
      kind: 'customers', seed: intOpt(opts.seed, RUN_SEEDS.customers),
      lo: 0, hi: 150, ticks: ticks(0, 150, 25), fmt: money0,
      ytitle: 'Running mean of spend', xtitle: 'Customers observed', truth: truth,
      tlabel: 'true mean ' + money(truth, 2)
    };
    var heavy = {
      kind: 'cauchy', seed: intOpt(opts.heavySeed, RUN_SEEDS.cauchy),
      lo: -4, hi: 4, ticks: ticks(-4, 4, 2), fmt: function (t) { return num(t); },
      ytitle: 'Running mean', xtitle: 'Draws observed', truth: 0, tlabel: 'true center 0',
      title: 'A heavy-tailed variable (Cauchy)', x0: 548, x1: 938, y0: 44, y1: 310
    };
    var cfgs;
    if (both) {
      spend.title = 'Customer spend';
      spend.x0 = 80; spend.x1 = 470; spend.y0 = 44; spend.y1 = 310;
      cfgs = [spend, heavy];
    } else {
      spend.x0 = 90; spend.x1 = 920; spend.y0 = 30; spend.y1 = 310;
      cfgs = [spend];
    }
    var svg = M06.svg(root, 960, 380, both
      ? 'Running means over 2,000 draws of customer spend and of a heavy-tailed Cauchy variable, against their true centers'
      : 'The running mean of customer spend over 2,000 customers, against the true mean');
    var defs = M06.el('defs', null, svg);

    var panels = cfgs.map(function (c) {
      var sx = M06.scale(0, LEN, c.x0, c.x1), sy = M06.scale(c.lo, c.hi, c.y1, c.y0);
      if (c.title) M06.text(svg, c.x0, 24, c.title, { size: 17, fill: col.grey });
      M06.axisY(svg, sy, c.x0, c.ticks, c.fmt, { title: c.ytitle });
      M06.axisX(svg, sx, c.y1, ticks(0, LEN, 500), function (t) { return num(t); }, { title: c.xtitle });
      // Paths are clipped to the panel: values off the scale run off the edge.
      var id = uid('clip'), cp = M06.el('clipPath', { id: id }, defs);
      M06.el('rect', { x: c.x0, y: c.y0, width: c.x1 - c.x0, height: c.y1 - c.y0 }, cp);
      var paths = M06.g(svg, { 'clip-path': 'url(#' + id + ')' });
      var ty = r1(sy(c.truth));
      M06.el('line', { x1: c.x0, x2: c.x1, y1: ty, y2: ty, stroke: col.red, 'stroke-width': 2.5 }, svg);
      M06.text(svg, c.x1 - 4, ty - 9, c.tlabel, { size: 17, fill: col.red, anchor: 'end', weight: 600 });
      return { c: c, sx: sx, sy: sy, paths: paths, cur: null, pts: null, vals: null };
    });

    var bar = M06.controls(root), out = M06.readout(root);
    var run = runner(), sims, shown = 0;

    function update() {
      var k = shown, P0 = panels[0];
      var h = 'After ' + num(k) + (k === 1 ? ' customer' : ' customers') + ': running mean ' +
        (k ? bold(money(P0.vals[k - 1], 2)) : DASH) + ' (true mean ' + money(truth, 2) + ')';
      if (both) {
        h += '<br>Heavy-tailed variable after ' + num(k) + (k === 1 ? ' draw' : ' draws') + ': running mean ' +
          (k ? bold(num(panels[1].vals[k - 1], 2)) : DASH) + ' (true center 0)';
      }
      out.innerHTML = h;
    }
    function upTo(k) {
      shown = k;
      panels.forEach(function (P) { P.cur.setAttribute('d', P.pts.slice(0, Math.max(1, k)).join('')); });
      update();
    }
    // A new path in every panel, from each continuing stream. Earlier paths
    // stay, faded.
    function observe() {
      run.finish();
      panels.forEach(function (P, j) {
        for (var e = P.paths.firstChild; e; e = e.nextSibling) {
          e.setAttribute('stroke', col.light); e.setAttribute('stroke-width', 2);
        }
        var c = P.c, top = c.y0 - 400, bot = c.y1 + 400;
        P.vals = sims[j].path(LEN);
        P.pts = P.vals.map(function (v, k) {
          return (k ? 'L' : 'M') + r1(P.sx(k + 1)) + ',' + r1(clamp(P.sy(v), top, bot));
        });
        P.cur = M06.el('path', { fill: 'none', stroke: col.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, P.paths);
      });
      run.run([{
        begin: function () { upTo(1); },
        ms: 3000,
        step: function (p) { upTo(Math.max(1, Math.round(LEN * p))); },
        end: function () { upTo(LEN); }
      }]);
    }
    function reset() {
      run.cancel();
      sims = panels.map(function (P) { return M06.sims.running(P.c.kind, P.c.seed); });
      panels.forEach(function (P) { clear(P.paths); P.cur = P.pts = P.vals = null; });
      shown = 0;
      update();
    }
    M06.button(bar, both ? 'Observe 2,000 draws' : 'Observe 2,000 customers', observe);
    M06.button(bar, 'Again', observe);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 5. biased -----------------------------------------------------------------------------------
  // A random sample against respondents only, at a chosen n. Both narrow as
  // n grows; the respondents narrow onto the wrong value.
  M06.demos.biased = function (root, opts) {
    var ns = intList(opts.ns, [25, 100, 400, 1600]), n = ns[0], K = 1000, seed = intOpt(opts.seed, 505);
    var pop = M06.customers(), truth = pop.mean;
    var L = 215, R = 925, lo = 40, hi = 110, nb = 70, top = 36, axisY = 335, gap = 20;
    var sx = M06.scale(lo, hi, L, R), rowH = (axisY - top - gap) / 2;
    var svg = M06.svg(root, 960, 400, 'Histograms of sample means from a random sample ' +
      'and from respondents only, whose response probability rises with spend, against the true mean');

    // Row labels sit in the left margin, one [text, size, weight] per line.
    var rows = [
      { lines: [['Random sample', 18, 600]], fill: col.axis },
      { lines: [['Respondents only', 18, 600], ['(response probability', 16, null], ['rises with spend)', 16, null]], fill: col.blue }
    ].map(function (s, i) {
      var base = top + (i + 1) * rowH + i * gap, mid = base - rowH / 2;
      if (i === 0) M06.el('line', { x1: L, x2: R, y1: r1(base), y2: r1(base), stroke: col.light, 'stroke-width': 1.5 }, svg);
      s.lines.forEach(function (t, j) {
        M06.text(svg, L - 16, r1(mid + 6 + (j - (s.lines.length - 1) / 2) * 21), t[0],
          { size: t[1], fill: s.fill, anchor: 'end', weight: t[2] });
      });
      var o = { fill: s.fill, maxCount: 10 };
      return { o: o, h: M06.Hist(svg, sx, base, rowH - 4, lo, hi, nb, o), means: [] };
    });
    M06.axisX(svg, sx, axisY, ticks(lo, hi, 10), money0, { title: 'Mean spend in each sample' });
    M06.vline(svg, sx(truth), 30, axisY, { label: 'true mean ' + money(truth, 2) });

    var bar = M06.controls(root), out = M06.readout(root);
    var drawBtn, run = runner(function () { if (drawBtn) drawBtn.disabled = false; }), sim;

    function update() {
      function part(name, v) {
        return name + ': mean ' + (v.length ? bold(money(M06.mean(v), 1)) : DASH) +
          ', SD ' + (v.length >= 2 ? bold(money(M06.sd(v), 1)) : DASH);
      }
      out.innerHTML = part('Random', rows[0].means) + SEP + part('Respondents', rows[1].means);
    }
    // Samples are drawn a few per frame (n = 1,600 is 3.2 million draws), so
    // Draw is disabled until the batch is in. The scale is set ahead from
    // where the random row's peak should land, and grows if a bar passes it.
    function draw() {
      if (run.busy()) return;
      var done = 0, target = rows[0].means.length + K;
      var peak = 1.1 * target * ((hi - lo) / nb) / (pop.sd / Math.sqrt(n) * Math.sqrt(2 * Math.PI));
      drawBtn.disabled = true;
      function upTo(t) {
        while (done < t) {
          var s = sim.next();
          done++;
          rows.forEach(function (r, j) { r.means.push(s[j]); addIn(r.h, s[j], lo, hi); });
        }
        var m = Math.max(10, peak, tallest(rows[0].h.bins), tallest(rows[1].h.bins));
        rows.forEach(function (r) { r.o.maxCount = m; r.h.render(); });
        update();
      }
      run.run([{ ms: 2000, step: function (p) { upTo(Math.floor(K * p)); }, end: function () { upTo(K); } }]);
    }
    // Reset and a change of n both start the stream again from the seed, so
    // each n shows the same numbers whatever was clicked before.
    function reset() {
      run.cancel();
      sim = M06.sims.biased(n, seed);
      rows.forEach(function (r) { r.means = []; r.o.maxCount = 10; r.h.clear(); });
      update();
    }
    drawBtn = M06.button(bar, 'Draw 1,000 samples', draw);
    M06.toggle(bar, ns.map(function (v) { return 'n = ' + num(v); }), ns, n, function (v) { n = v; reset(); });
    M06.button(bar, 'Reset', reset);
    reset();
  };
})();
