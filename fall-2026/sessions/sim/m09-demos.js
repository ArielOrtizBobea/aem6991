/* m09-demos.js — the animations for meeting 9, research designs II.
 *
 * Built on m06-core.js (the M06 namespace: rng, scales, axes, controls),
 * so a slide holds <div class="m06" data-demo="NAME"></div> as in meetings
 * 6 to 8. One running example throughout: a coffee chain rolls out a
 * mobile-ordering app, and the outcome is weekly sales per store in
 * thousands of dollars.
 *
 *   pdag        The causal graph of a panel design, five nodes, one step at
 *               a time. data-design="did" or "fe", optional data-step.
 *   did         40 stores in the region that got the app and 40 elsewhere,
 *               12 months, launch in month 7. Group means, the
 *               counterfactual, and the difference-in-differences estimate
 *               across samples. Toggle: parallel trends, or a faster trend
 *               in the app region.
 *   fe          100 stores x 24 months, staggered adoption by store size.
 *               Pooled OLS, store fixed effects, two-way fixed effects
 *               across 500 samples. Toggles: size the only confounder,
 *               local demand that also changes, adoption misrecorded.
 *   car         A finance event study of the chain's stock: market model,
 *               cumulative abnormal return, one announcement or the
 *               average of 100. Toggle: earnings released the same day.
 *   event       The difference-in-differences event study, leads and lags
 *               with store-clustered 95% intervals; the pre-test of the
 *               leads and what conditioning on it does (Roth 2022).
 *   staggered   Three adoption cohorts (months 4, 8, 12 of 16): two-way
 *               fixed effects against a not-yet-treated comparison
 *               (Callaway and Sant'Anna), with the Goodman-Bacon weights.
 *   synth       One city gets the app; 20 donor cities. Donor average,
 *               synthetic control, and the placebo-in-space test.
 *
 * The simulations live in M06.sims.m09 and touch no DOM, so they run under
 * Node for checking the numbers quoted in the speaker notes:
 *   node -e "global.window=global; require('./m06-core.js');
 *            require('./m09-demos.js'); console.log(M06.sims.m09.did.run(false, 1000))"
 * Everything is seeded: Reset replays the same draws.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06 || !M06.rng) throw new Error('Load m06-core.js before m09-demos.js');
  M06.sims = M06.sims || {};
  var S = (M06.sims.m09 = {});
  var col = M06.col, fmt = M06.fmt;

  // ---- small helpers ------------------------------------------------------------
  var SEP = '<span class="sep">·</span>', DASH = '—', MINUS = '−';
  function bold(s) { return '<b>' + s + '</b>'; }
  function num(x, d) { return fmt.num(x, d); }
  function num0(x) { return fmt.num(x, 0); }
  function pct(x, d) { return fmt.pct(x, d == null ? 0 : d); }
  function signed(x, d) { var s = fmt.num(x, d); return (s.charAt(0) !== MINUS && Number(s.replace(/,/g, '')) !== 0 ? '+' : '') + s; }
  function axisNum(v) { return v < 0 ? MINUS + num0(-v) : num0(v); }
  function axisSigned(v) { return v < 0 ? MINUS + num0(-v) : (v > 0 ? '+' : '') + num0(v); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ticks(a, b, step) {
    var out = [];
    for (var v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function intOpt(v, dflt) { var n = parseInt(v, 10); return n > 0 ? n : dflt; }
  function attrs(el, o) { for (var k in o) el.setAttribute(k, o[k]); return el; }
  function show(el, on) { el.setAttribute('visibility', on ? 'visible' : 'hidden'); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function tallest(bins) { return Math.max.apply(null, bins); }
  function zeros(n) { return new Array(n).fill(0); }
  var uidN = 0;
  function uid(p) { uidN += 1; return 'm09-' + p + '-' + uidN; }
  function binOf(v, lo, hi, nb) {
    if (!(v >= lo && v <= hi)) return -1;
    return Math.min(nb - 1, Math.floor((v - lo) / ((hi - lo) / nb)));
  }
  function sum(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s; }
  function variance(v) { var m = M06.mean(v), s = 0; for (var i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m); return s / (v.length - 1); }
  function polyline(pts) { return pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' '); }

  // One animation at a time, as in meetings 7 and 8.
  function runner() {
    var cur = null;
    function stop(finish) {
      var c = cur;
      cur = null;
      if (!c) return;
      c.anim.cancel();
      if (finish) { c.step(1); if (c.end) c.end(); }
    }
    return {
      run: function (ms, step, end) {
        stop(true);
        var c = { step: step, end: end };
        cur = c;
        c.anim = M06.animate(ms, step, function () {
          if (cur !== c) return;
          cur = null;
          if (end) end();
        });
      },
      finish: function () { stop(true); },
      cancel: function () { stop(false); }
    };
  }

  // An outline histogram drawn across the occupied bins only.
  function stepHist(parent, sx, y0, h, lo, hi, nb, color, opacity) {
    var bins = new Array(nb).fill(0), bw = (hi - lo) / nb;
    var fill = M06.el('path', { fill: color, 'fill-opacity': opacity == null ? 0.14 : opacity, stroke: 'none' }, parent);
    var edge = M06.el('path', { fill: 'none', stroke: color, 'stroke-width': 2.5 }, parent);
    return {
      bins: bins,
      add: function (v) { var k = binOf(v, lo, hi, nb); if (k >= 0) bins[k]++; },
      clear: function () { bins.fill(0); },
      render: function (m) {
        var first = -1, last = -1, j;
        for (j = 0; j < nb; j++) if (bins[j] > 0) { if (first < 0) first = j; last = j; }
        if (first < 0) { fill.setAttribute('d', ''); edge.setAttribute('d', ''); return; }
        var p = 'M' + r1(sx(lo + first * bw)) + ',' + y0;
        for (j = first; j <= last; j++) p += 'V' + r1(y0 - bins[j] / m * h) + 'H' + r1(sx(lo + (j + 1) * bw));
        p += 'V' + y0;
        edge.setAttribute('d', p);
        fill.setAttribute('d', p + 'Z');
      }
    };
  }

  // Simple regression of y on x with an intercept.
  function fit1(x, y) {
    var n = x.length, mx = M06.mean(x), my = M06.mean(y), sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    var b = sxy / sxx, a = my - b * mx, sse = 0;
    for (i = 0; i < n; i++) { var e = y[i] - a - b * x[i]; sse += e * e; }
    return { slope: b, intercept: a, sigma: Math.sqrt(sse / (n - 2)), n: n };
  }

  // Two-line panel heading.
  function heading(svg, x, y, title, sub, anchor) {
    M06.text(svg, x, y, title, { size: 18, weight: 700, anchor: anchor || 'start' });
    if (sub) M06.text(svg, x, y + 21, sub, { size: 15, fill: col.grey, anchor: anchor || 'start' });
  }

  // An arrowhead marker in a color, defined once per svg.
  function marker(defs, color) {
    var id = uid('arr'), m = M06.el('marker', {
      id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
    }, defs);
    M06.el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }, m);
    return 'url(#' + id + ')';
  }

  // Labels at the right end of lines, pushed apart so they never overlap.
  // items: [{ y, el }]; sets each el's y.
  function spreadLabels(items, gap, lo, hi) {
    items.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < items.length; i++) if (items[i].y < items[i - 1].y + gap) items[i].y = items[i - 1].y + gap;
    var over = items.length ? items[items.length - 1].y - hi : 0;
    if (over > 0) for (i = 0; i < items.length; i++) items[i].y -= over;
    for (i = items.length - 2; i >= 0; i--) if (items[i].y > items[i + 1].y - gap) items[i].y = items[i + 1].y - gap;
    if (items.length && items[0].y < lo) { var d = lo - items[0].y; for (i = 0; i < items.length; i++) items[i].y += d; }
    items.forEach(function (it) { it.el.setAttribute('y', r1(it.y + 5)); });
  }

  // A clip rectangle for a plot area.
  function clipped(svg, defs, x, y, w, h) {
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: x, y: y, width: w, height: h }, cp);
    return M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
  }

  // ---- distributions ---------------------------------------------------------------
  // The regularized incomplete beta function, for F tail probabilities.
  function lgamma(x) {
    var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function betacf(a, b, x) {
    var FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= 300; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  // Upper tail of an F statistic.
  S.pF = function (f, d1, d2) { return ibeta(d2 / 2, d1 / 2, d2 / (d2 + d1 * f)); };

  // Gauss-Jordan inverse of a small square matrix (arrays of arrays).
  function inverse(A) {
    var n = A.length, M = A.map(function (row, i) {
      var r = row.slice();
      for (var j = 0; j < n; j++) r.push(i === j ? 1 : 0);
      return r;
    }), i, j, k;
    for (i = 0; i < n; i++) {
      var p = i;
      for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      var t = M[i]; M[i] = M[p]; M[p] = t;
      var d = M[i][i];
      for (j = 0; j < 2 * n; j++) M[i][j] /= d;
      for (k = 0; k < n; k++) {
        if (k === i) continue;
        var f = M[k][i];
        if (f === 0) continue;
        for (j = 0; j < 2 * n; j++) M[k][j] -= f * M[i][j];
      }
    }
    return M.map(function (row) { return row.slice(n); });
  }

  // Demeaning of a balanced N x T panel stored row by store: by store
  // (two false) or by store and month (two true).
  function within(N, T, x, two) {
    var o = new Float64Array(N * T), mi = new Float64Array(N), mt = new Float64Array(T), m = 0, i, t;
    for (i = 0; i < N; i++) for (t = 0; t < T; t++) { var v = x[i * T + t]; mi[i] += v / T; mt[t] += v / N; m += v / (N * T); }
    for (i = 0; i < N; i++) for (t = 0; t < T; t++) o[i * T + t] = x[i * T + t] - mi[i] - (two ? mt[t] - m : 0);
    return o;
  }
  // The slope of y on x, both already demeaned (centred is false), or with
  // an intercept (centred is true).
  function slopeOf(x, y, centre) {
    var n = x.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    if (centre) { for (i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n; }
    for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    return { b: sxy / sxx, vx: sxx / n };
  }

  // =================================================================================
  // SIMULATIONS (pure, no DOM)
  // =================================================================================

  // ---- 2 · did ----------------------------------------------------------------------
  // 40 stores in the region that got the app (treated) and 40 elsewhere
  // (control), 12 months, the app launched in month 7. A store's level is
  // N(52, 5²) in the app region and N(40, 5²) elsewhere. Every store shares
  // the path s(t) = 0.5(t − 6.5) + dev(t), where dev averages zero in each
  // half, so it adds exactly +3.0 from the before period (months 1–6) to the
  // after period (months 7–12). Store-month noise N(0, 4²). The app adds
  // +4.0 from month 7. "Treated stores were already growing faster" adds
  // 0.5(t − 6.5) to the app region, +3.0 between the periods.
  // The estimate is the change in the treated group's mean minus the change
  // in the control group's mean; its standard error is computed from the
  // stores' own before-after changes, which clusters by store.
  var DID = { nT: 40, nC: 40, T: 12, launch: 7, aT: 52, aC: 40, sdA: 5, sd: 4, tau: 4, g: 0.5, seed: 9201,
    dev: [-0.6, -0.2, 0.6, 1.0, 0.0, -0.8, -0.8, 0.2, 1.0, 0.6, -0.2, -0.8] };
  DID.season = function (t) { return 0.5 * (t - 6.5) + DID.dev[t - 1]; };
  S.did = function (trend, seed) {
    var r = M06.rng(seed == null ? DID.seed : seed);
    return {
      next: function () {
        var T = DID.T, L = DID.launch, sT = zeros(T), sC = zeros(T), dT = [], dC = [], g, i, t;
        for (g = 0; g < 2; g++) {
          var n = g ? DID.nC : DID.nT;
          for (i = 0; i < n; i++) {
            var a = (g ? DID.aC : DID.aT) + DID.sdA * r.normal(), pre = 0, post = 0;
            for (t = 1; t <= T; t++) {
              var y = a + DID.season(t) + DID.sd * r.normal();
              if (!g) { if (t >= L) y += DID.tau; if (trend) y += DID.g * (t - 6.5); }
              (g ? sC : sT)[t - 1] += y;
              if (t < L) pre += y / (L - 1); else post += y / (T - L + 1);
            }
            (g ? dC : dT).push(post - pre);
          }
        }
        var mT = sT.map(function (v) { return v / DID.nT; }), mC = sC.map(function (v) { return v / DID.nC; });
        var preT = M06.mean(mT.slice(0, L - 1)), postT = M06.mean(mT.slice(L - 1)), preC = M06.mean(mC.slice(0, L - 1)), postC = M06.mean(mC.slice(L - 1));
        var cf = mC.map(function (v, k) { return k >= L - 1 ? preT + (v - preC) : null; });
        return {
          mT: mT, mC: mC, cf: cf, changeT: postT - preT, changeC: postC - preC,
          est: (postT - preT) - (postC - preC), se: Math.sqrt(variance(dT) / DID.nT + variance(dC) / DID.nC),
          after: postT - postC, before: preT - preC
        };
      }
    };
  };
  S.did.params = DID;
  S.did.run = function (trend, K, seed) {
    var s = S.did(trend, seed), est = [], se = [], after = [], ch = [], chC = [];
    for (var k = 0; k < K; k++) { var e = s.next(); est.push(e.est); se.push(e.se); after.push(e.after); ch.push(e.changeT); chC.push(e.changeC); }
    return { mean: r3(M06.mean(est)), sd: r3(M06.sd(est)), meanSE: r3(M06.mean(se)), after: r3(M06.mean(after)),
      changeT: r3(M06.mean(ch)), changeC: r3(M06.mean(chC)), first: S.did(trend, seed).next() };
  };

  // ---- 3 · fe ---------------------------------------------------------------------------
  // 100 stores x 24 months. Store size z ~ N(0, 1) is fixed. The adoption
  // month is round(14 − 12a) with a = (z + u)/√2, u ~ N(0, 1): larger
  // stores adopt earlier. A month of 1 or earlier means the store already
  // had the app when the panel starts; later than 24, it never adopts.
  // Sales = 40 + 6z + 0.25·month + a common month shock N(0, 0.5²)
  // + 4·app + noise N(0, 3²).
  //   size    store size is the only confounder.
  //   demand  local demand rises by 3 two months before a store adopts (the
  //           store adopts because demand rose), and stays up.
  //   error   the recorded app dummy is wrong in 10% of store-months, at
  //           random; sales respond to the true dummy.
  // Estimators on the recorded dummy: pooled OLS (sales on the dummy),
  // store fixed effects (within stores), two-way fixed effects (within
  // stores and months, the double-demeaned balanced panel).
  var FE = { N: 100, T: 24, A0: 14, A1: 12, base: 40, size: 6, trend: 0.25, sdM: 0.5, sd: 3, tau: 4, lead: 2, demand: 3, p: 0.1, seed: 9301 };
  S.fe = function (setting, seed) {
    var r = M06.rng(seed == null ? FE.seed : seed), N = FE.N, T = FE.T;
    return {
      next: function () {
        var y = new Float64Array(N * T), D = new Float64Array(N * T), Dr = new Float64Array(N * T), A = [], m = [], i, t, sw = 0, never = 0, always = 0;
        for (t = 0; t < T; t++) m.push(FE.sdM * r.normal());
        for (i = 0; i < N; i++) {
          var z = r.normal(), a = (z + r.normal()) / Math.SQRT2, Ai = Math.round(FE.A0 - FE.A1 * a);
          if (Ai <= 1) { Ai = 1; always++; } else if (Ai > T) { Ai = 99; never++; } else sw++;
          A.push(Ai);
          for (t = 0; t < T; t++) {
            var mon = t + 1, d = mon >= Ai ? 1 : 0, w = 0;
            if (setting === 'demand' && Ai <= T && mon >= Ai - FE.lead) w = FE.demand;
            y[i * T + t] = FE.base + FE.size * z + FE.trend * mon + m[t] + FE.tau * d + w + FE.sd * r.normal();
            D[i * T + t] = d;
            Dr[i * T + t] = setting === 'error' && r() < FE.p ? 1 - d : d;
          }
        }
        var ys = within(N, T, y, false), yw = within(N, T, y, true);
        var p = slopeOf(Dr, y, true), s = slopeOf(within(N, T, Dr, false), ys), w2 = slopeOf(within(N, T, Dr, true), yw);
        var o = { pooled: p.b, sfe: s.b, twfe: w2.b, switchers: sw, never: never, always: always, A: A, D: Dr, varP: p.vx, varS: s.vx, varW: w2.vx };
        if (setting === 'error') {
          o.pooled0 = slopeOf(D, y, true).b; o.sfe0 = slopeOf(within(N, T, D, false), ys).b; o.twfe0 = slopeOf(within(N, T, D, true), yw).b;
        }
        return o;
      }
    };
  };
  S.fe.params = FE;
  S.fe.run = function (setting, K, seed) {
    var s = S.fe(setting, seed), keys = ['pooled', 'sfe', 'twfe', 'switchers', 'never', 'always', 'pooled0', 'sfe0', 'twfe0', 'varP', 'varS', 'varW'], acc = {}, sds = {};
    keys.forEach(function (k) { acc[k] = []; });
    for (var j = 0; j < K; j++) { var e = s.next(); keys.forEach(function (k) { if (e[k] != null) acc[k].push(e[k]); }); }
    var out = {};
    keys.forEach(function (k) { if (acc[k].length) { out[k] = r3(M06.mean(acc[k])); sds[k] = r3(M06.sd(acc[k])); } });
    out.sd = { pooled: sds.pooled, sfe: sds.sfe, twfe: sds.twfe };
    if (setting === 'error') out.kept = { pooled: r3(out.pooled / out.pooled0), sfe: r3(out.sfe / out.sfe0), twfe: r3(out.twfe / out.twfe0) };
    var f = S.fe(setting, seed).next();
    out.first = { pooled: r3(f.pooled), sfe: r3(f.sfe), twfe: r3(f.twfe), switchers: f.switchers, never: f.never, always: f.always };
    return out;
  };

  // ---- 4 · car ---------------------------------------------------------------------------
  // Daily returns in percent. The market's return is N(0.05, 1.0²). The
  // chain's return is α + β·market + N(0, 1.5²) with α = 0.02, β = 1.1.
  // Estimation window: days −250 to −11 (240 days); event window: days −10
  // to +10. The app announcement adds +3.0 on day 0, and news leaks for
  // +0.5 on day −1, so the true cumulative abnormal return over days −1 to
  // +1 is +3.5. With "Earnings released the same day", day 0 also carries
  // earnings news worth N(+2.0, 2.0²). The market model is fitted by OLS in
  // the estimation window; the abnormal return is the actual return minus
  // α̂ + β̂·market; the cumulative abnormal return (CAR) adds them up from
  // day −10. One announcement: the standard error of CAR(−1,+1) is
  // σ̂√3 and the band on the path is ±1.96 σ̂ √(days so far). The average
  // of 100 announcements by 100 firms on different dates: the standard
  // error is the cross-sectional standard deviation over √100.
  var CAR = { nEst: 240, d0: -10, d1: 10, alpha: 0.02, beta: 1.1, sd: 1.5, mMean: 0.05, mSd: 1.0, ar0: 3.0, leak: 0.5,
    earn: 2.0, earnSd: 2.0, firms: 100, seed: 9420 };
  CAR.truePath = function (d) { return d < -1 ? 0 : d === -1 ? CAR.leak : CAR.leak + CAR.ar0; };
  S.car = function (earnings, seed) {
    var r = M06.rng(seed == null ? CAR.seed : seed);
    function firm() {
      var xm = [], y = [], i;
      for (i = 0; i < CAR.nEst; i++) { var m = CAR.mMean + CAR.mSd * r.normal(); xm.push(m); y.push(CAR.alpha + CAR.beta * m + CAR.sd * r.normal()); }
      var f = fit1(xm, y), car = [], c = 0, c11 = 0;
      for (var d = CAR.d0; d <= CAR.d1; d++) {
        var mk = CAR.mMean + CAR.mSd * r.normal();
        var ret = CAR.alpha + CAR.beta * mk + CAR.sd * r.normal() + (d === 0 ? CAR.ar0 : 0) + (d === -1 ? CAR.leak : 0);
        if (earnings && d === 0) ret += CAR.earn + CAR.earnSd * r.normal();
        var ab = ret - f.intercept - f.slope * mk;
        c += ab; car.push(c);
        if (d >= -1 && d <= 1) c11 += ab;
      }
      return { xm: xm, y: y, alpha: f.intercept, beta: f.slope, sigma: f.sigma, car: car, car11: c11, se11: f.sigma * Math.sqrt(3),
        band: car.map(function (v, k) { return 1.96 * f.sigma * Math.sqrt(k + 1); }) };
    }
    return {
      one: firm,
      many: function (n) {
        n = n || CAR.firms;
        var fs = [], k, L = CAR.d1 - CAR.d0 + 1;
        for (k = 0; k < n; k++) fs.push(firm());
        var car = [], band = [];
        for (var j = 0; j < L; j++) {
          var v = fs.map(function (f) { return f.car[j]; });
          car.push(M06.mean(v)); band.push(1.96 * M06.sd(v) / Math.sqrt(n));
        }
        var c11 = fs.map(function (f) { return f.car11; });
        return { first: fs[0], car: car, band: band, car11: M06.mean(c11), se11: M06.sd(c11) / Math.sqrt(n), paths: fs.map(function (f) { return f.car; }),
          alpha: M06.mean(fs.map(function (f) { return f.alpha; })), beta: M06.mean(fs.map(function (f) { return f.beta; })), n: n };
      }
    };
  };
  S.car.params = CAR;
  // What the demo shows after Reset: the first single announcement (one),
  // the first average of 100 (avg100), and the average of 100 that follows
  // one single announcement (avg100AfterOne). Plus, over K single
  // announcements from another stream, the mean CAR(−1,+1) and the share
  // significant at 5%.
  S.car.run = function (earnings, K, seed) {
    var s = S.car(earnings, seed), one = s.one(), avg = S.car(earnings, seed).many(CAR.firms), after = s.many(CAR.firms);
    var s2 = S.car(earnings, (seed == null ? CAR.seed : seed) + 1000), c = [], sig = 0;
    for (var k = 0; k < (K || 1000); k++) { var f = s2.one(); c.push(f.car11); if (Math.abs(f.car11 / f.se11) > 1.96) sig++; }
    return {
      one: { alpha: r3(one.alpha), beta: r3(one.beta), car11: r3(one.car11), se11: r3(one.se11) },
      avg100: { alpha: r3(avg.alpha), beta: r3(avg.beta), car11: r3(avg.car11), se11: r3(avg.se11) },
      avg100AfterOne: { alpha: r3(after.alpha), beta: r3(after.beta), car11: r3(after.car11), se11: r3(after.se11) },
      single: { meanCar11: r3(M06.mean(c)), sdCar11: r3(M06.sd(c)), shareSignificant: r3(sig / (K || 1000)) },
      truth: CAR.leak + CAR.ar0
    };
  };

  // ---- 5 · event ----------------------------------------------------------------------------
  // 40 stores in the app region and 40 elsewhere over months −6 to +6, the
  // app launched in month 0. Levels N(52, 5²) and N(40, 5²), a common path,
  // store-month noise N(0, 4²). Settings:
  //   const   the app adds +4.0 from month 0.
  //   grow    the app adds k + 1 in month k ≥ 0 (1 to 7), on average +4.0.
  //   trend   the app adds +4.0, and the app region was already trending up
  //           by 0.5 a month: +0.5(k + 1) in every month.
  // Coefficient k = (treated mean − control mean in month k) minus the same
  // in the reference month −1: the event-study regression with store and
  // month fixed effects, solved in closed form for one launch date. The
  // standard errors cluster by store (each store's change from month −1).
  // The joint test of the five leads (months −6 to −2) is a Wald test with
  // the store-clustered covariance, F = W/5 against F(5, 79).
  var EV = { nT: 40, nC: 40, k0: -6, k1: 6, aT: 52, aC: 40, sdA: 5, sd: 4, tau: 4, g: 0.5, seed: 9519 };
  EV.ks = ticks(EV.k0, EV.k1, 1);
  EV.effect = function (setting, k) { return k < 0 ? 0 : setting === 'grow' ? k + 1 : EV.tau; };
  S.event = function (setting, seed) {
    var r = M06.rng(seed == null ? EV.seed : seed), K = EV.ks.length, ref = -1 - EV.k0;
    return {
      next: function () {
        var dT = [], dC = [], g, i, j;
        for (g = 0; g < 2; g++) {
          var n = g ? EV.nC : EV.nT;
          for (i = 0; i < n; i++) {
            var a = (g ? EV.aC : EV.aT) + EV.sdA * r.normal(), y = [];
            for (j = 0; j < K; j++) {
              var k = EV.ks[j], v = a + 0.3 * k + 0.8 * Math.sin(k) + EV.sd * r.normal();
              if (!g) { v += EV.effect(setting, k); if (setting === 'trend') v += EV.g * (k + 1); }
              y.push(v);
            }
            (g ? dC : dT).push(y.map(function (v) { return v - y[ref]; }));
          }
        }
        var b = [], se = [];
        for (j = 0; j < K; j++) {
          var vT = dT.map(function (d) { return d[j]; }), vC = dC.map(function (d) { return d[j]; });
          b.push(M06.mean(vT) - M06.mean(vC));
          se.push(j === ref ? 0 : Math.sqrt(variance(vT) / EV.nT + variance(vC) / EV.nC));
        }
        // Joint test of the leads.
        var leads = [];
        for (j = 0; j < ref; j++) if (EV.ks[j] <= -2) leads.push(j);
        var V = leads.map(function (ja) {
          return leads.map(function (jb) {
            var c = 0;
            [dT, dC].forEach(function (grp) {
              var ma = M06.mean(grp.map(function (d) { return d[ja]; })), mb = M06.mean(grp.map(function (d) { return d[jb]; })), s = 0;
              grp.forEach(function (d) { s += (d[ja] - ma) * (d[jb] - mb); });
              c += s / (grp.length - 1) / grp.length;
            });
            return c;
          });
        });
        var Vi = inverse(V), W = 0, q = leads.length;
        for (i = 0; i < q; i++) for (j = 0; j < q; j++) W += b[leads[i]] * Vi[i][j] * b[leads[j]];
        var F = W / q, p = S.pF(F, q, EV.nT + EV.nC - 1);
        return { b: b, se: se, F: F, p: p, pass: p >= 0.05, post: M06.mean(b.slice(ref + 1 + 0)) };
      }
    };
  };
  S.event.params = EV;
  S.event.run = function (setting, K, seed) {
    var s = S.event(setting, seed), all = [], pass = [], rej = 0, nk = EV.ks.length, mb = zeros(nk);
    for (var k = 0; k < K; k++) {
      var e = s.next();
      all.push(e.post); if (e.pass) pass.push(e.post); else rej++;
      for (var j = 0; j < nk; j++) mb[j] += e.b[j] / K;
    }
    var f = S.event(setting, seed).next();
    return { reject: r3(rej / K), meanAll: r3(M06.mean(all)), sdAll: r3(M06.sd(all)), meanPass: pass.length ? r3(M06.mean(pass)) : null,
      nPass: pass.length, truth: EV.tau, meanCoef: mb.map(r3),
      first: { F: r3(f.F), p: r3(f.p), post: r3(f.post), b: f.b.map(r3), se: f.se.map(r3) } };
  };

  // ---- 6 · staggered --------------------------------------------------------------------------
  // Three cohorts of 30 stores adopt the app in months 4, 8 and 12 of a
  // 16-month panel; with "Some stores never adopt", 30 more stores never do.
  // Cohort levels 50, 44 and 38, never-adopters 32, store levels ±N(0, 3²),
  // a common upward path of 0.3 a month plus month shocks N(0, 0.5²),
  // store-month noise N(0, 3²). The effect in a store's e-th month with the
  // app (e = 0 in the adoption month) is 4 ("Effect constant") or e
  // ("Effect grows with time": nothing in the adoption month, then +1 a
  // month).
  // Two-way fixed effects: sales on the app dummy with store and month
  // fixed effects, full panel. The robust estimate follows Callaway and
  // Sant'Anna: for each cohort g and month t ≥ g, the cohort's change since
  // month g − 1 minus the change in stores not yet treated by t (and the
  // never-treated), averaged over every (g, t) cell that has such a
  // comparison, weighted by cohort size. When every store adopts, no
  // comparison exists from month 12 on, so the robust estimate and its
  // truth cover months before 12. The truth is the average effect over the
  // same store-months.
  var ST = { cohorts: [4, 8, 12], n: 30, nNever: 30, T: 16, levels: [50, 44, 38], neverLevel: 32, sdA: 3, sd: 3, trend: 0.3, sdM: 0.5, tau: 4, seed: 9601 };
  ST.effect = function (grow, e) { return e < 0 ? 0 : grow ? e : ST.tau; };
  // The groups: each cohort and, optionally, the never-treated (start 99).
  ST.groups = function (never) {
    var gs = ST.cohorts.map(function (c, i) { return { start: c, n: ST.n, level: ST.levels[i] }; });
    if (never) gs.push({ start: 99, n: ST.nNever, level: ST.neverLevel });
    return gs;
  };
  // The (g, t) cells with a clean comparison, and the true average effect
  // over them, weighted by cohort size.
  ST.cells = function (grow, never) {
    var gs = ST.groups(never), cells = [], num_ = 0, den = 0;
    gs.forEach(function (g) {
      if (g.start > ST.T) return;
      for (var t = g.start; t <= ST.T; t++) {
        var ok = never || gs.some(function (h) { return h.start > t; });
        if (!ok) continue;
        cells.push({ g: g.start, t: t, n: g.n });
        num_ += g.n * ST.effect(grow, t - g.start); den += g.n;
      }
    });
    return { cells: cells, truth: num_ / den };
  };
  // True average effect over every treated store-month in the panel.
  ST.attAll = function (grow) {
    var s = 0, n = 0;
    ST.cohorts.forEach(function (c) { for (var t = c; t <= ST.T; t++) { s += ST.effect(grow, t - c); n++; } });
    return s / n;
  };
  S.staggered = function (grow, never, seed) {
    var r = M06.rng(seed == null ? ST.seed : seed), gs = ST.groups(never), T = ST.T, info = ST.cells(grow, never);
    return {
      truth: info.truth,
      next: function () {
        var N = 0; gs.forEach(function (g) { N += g.n; });
        var y = new Float64Array(N * T), D = new Float64Array(N * T), grp = [], m = [], i = 0, t;
        for (t = 0; t < T; t++) m.push(ST.trend * (t + 1) + ST.sdM * r.normal());
        var means = gs.map(function () { return zeros(T); });
        gs.forEach(function (g, gi) {
          for (var k = 0; k < g.n; k++, i++) {
            var a = g.level + ST.sdA * r.normal();
            grp.push(gi);
            for (t = 0; t < T; t++) {
              var mon = t + 1, d = mon >= g.start ? 1 : 0, v = a + m[t] + (d ? ST.effect(grow, mon - g.start) : 0) + ST.sd * r.normal();
              y[i * T + t] = v; D[i * T + t] = d; means[gi][t] += v / g.n;
            }
          }
        });
        var twfe = slopeOf(within(N, T, D, true), within(N, T, y, true)).b;
        // Callaway and Sant'Anna, from the group means.
        var est = 0, den = 0;
        info.cells.forEach(function (c) {
          var gi = -1; gs.forEach(function (g, j) { if (g.start === c.g) gi = j; });
          var base = c.g - 2, tt = c.t - 1, ctl = 0, nc = 0;
          gs.forEach(function (h, j) { if (h.start > c.t) { ctl += h.n * (means[j][tt] - means[j][base]); nc += h.n; } });
          est += c.n * ((means[gi][tt] - means[gi][base]) - ctl / nc); den += c.n;
        });
        return { means: means, twfe: twfe, cs: est / den, truth: info.truth };
      }
    };
  };
  S.staggered.params = ST;
  // The Goodman-Bacon (2021) decomposition of the two-way fixed effects
  // estimate into 2x2 comparisons, from the cohort means of a sample (pass
  // means from next(), or none for the noise-free expectation). Weights
  // depend only on the timing and the group sizes.
  S.staggered.bacon = function (grow, never, means) {
    var gs = ST.groups(never), T = ST.T, Ntot = 0;
    gs.forEach(function (g) { Ntot += g.n; });
    if (!means) {
      means = gs.map(function (g) {
        var v = [];
        for (var t = 1; t <= T; t++) v.push(t >= g.start ? ST.effect(grow, t - g.start) : 0);
        return v;
      });
    }
    function avg(v, a, b) { var s = 0; for (var t = a; t <= b; t++) s += v[t - 1]; return s / (b - a + 1); }
    // Variance of the double-demeaned dummy.
    var Dbar = gs.map(function (g) { return g.start > T ? 0 : (T - g.start + 1) / T; }), dt = zeros(T), dall = 0, i, t;
    gs.forEach(function (g, j) { for (t = 1; t <= T; t++) dt[t - 1] += g.n / Ntot * (t >= g.start ? 1 : 0); dall += g.n / Ntot * Dbar[j]; });
    var VD = 0;
    gs.forEach(function (g, j) { for (t = 1; t <= T; t++) { var x = (t >= g.start ? 1 : 0) - Dbar[j] - dt[t - 1] + dall; VD += g.n / Ntot * x * x / T; } });
    var comps = [], U = -1;
    gs.forEach(function (g, j) { if (g.start > T) U = j; });
    var timed = []; gs.forEach(function (g, j) { if (g.start <= T) timed.push(j); });
    timed.forEach(function (k) {
      if (U < 0) return;
      var nk = gs[k].n / Ntot, nu = gs[U].n / Ntot, nkU = nk / (nk + nu), Dk = Dbar[k];
      var s = (nk + nu) * (nk + nu) * nkU * (1 - nkU) * Dk * (1 - Dk) / VD;
      var b = (avg(means[k], gs[k].start, T) - avg(means[k], 1, gs[k].start - 1)) - (avg(means[U], gs[k].start, T) - avg(means[U], 1, gs[k].start - 1));
      comps.push({ type: 'never', treated: gs[k].start, control: 'never', w: s, b: b });
    });
    for (i = 0; i < timed.length; i++) for (var j2 = i + 1; j2 < timed.length; j2++) {
      var k = timed[i], l = timed[j2];
      if (gs[k].start > gs[l].start) { var tmp = k; k = l; l = tmp; }
      var nk = gs[k].n / Ntot, nl = gs[l].n / Ntot, nkl = nk / (nk + nl), Dk = Dbar[k], Dl = Dbar[l], tk = gs[k].start, tl = gs[l].start;
      var sk = Math.pow((nk + nl) * (1 - Dl), 2) * nkl * (1 - nkl) * ((Dk - Dl) / (1 - Dl)) * ((1 - Dk) / (1 - Dl)) / VD;
      var sl = Math.pow((nk + nl) * Dk, 2) * nkl * (1 - nkl) * (Dl / Dk) * ((Dk - Dl) / Dk) / VD;
      var bk = (avg(means[k], tk, tl - 1) - avg(means[k], 1, tk - 1)) - (avg(means[l], tk, tl - 1) - avg(means[l], 1, tk - 1));
      var bl = (avg(means[l], tl, T) - avg(means[l], tk, tl - 1)) - (avg(means[k], tl, T) - avg(means[k], tk, tl - 1));
      comps.push({ type: 'not yet treated', treated: tk, control: tl, w: sk, b: bk });
      comps.push({ type: 'already treated', treated: tl, control: tk, w: sl, b: bl });
    }
    var tot = 0, wsum = 0, already = 0;
    comps.forEach(function (c) { tot += c.w * c.b; wsum += c.w; if (c.type === 'already treated') already += c.w; });
    return { comps: comps, estimate: tot, weightSum: wsum, alreadyShare: already / wsum };
  };
  S.staggered.run = function (grow, never, K, seed) {
    var s = S.staggered(grow, never, seed), tw = [], cs = [];
    for (var k = 0; k < K; k++) { var e = s.next(); tw.push(e.twfe); cs.push(e.cs); }
    var b = S.staggered.bacon(grow, never);
    var f = S.staggered(grow, never, seed).next();
    return { twfe: r3(M06.mean(tw)), twfeSD: r3(M06.sd(tw)), cs: r3(M06.mean(cs)), csSD: r3(M06.sd(cs)), truth: r3(s.truth),
      attAllTreated: r3(ST.attAll(grow)), alreadyTreatedWeight: r3(b.alreadyShare), baconEstimate: r3(b.estimate),
      comparisons: b.comps.map(function (c) { return { type: c.type, treated: c.treated, control: c.control, weight: r3(c.w), estimate: r3(c.b) }; }),
      first: { twfe: r3(f.twfe), cs: r3(f.cs) } };
  };

  // ---- 7 · synth ----------------------------------------------------------------------------------
  // 21 cities over 36 months, the app launched in the treated city in month
  // 25 (24 months before, 12 after). Sales follow a factor model:
  // level μ + λ1·(month/12) + λ2·sin(2π month/12) + λ3·cos(3π month/36)
  // + a shock common to all cities N(0, 1) + noise N(0, 0.6²). Donors draw
  // μ ~ U(34, 56), λ1 ~ U(0, 4.5), λ2 ~ U(0, 3), λ3 ~ U(0, 2.5); the treated
  // city has μ = 50, λ1 = 3.6, λ2 = 1.8, λ3 = 1.0, inside the donors' range,
  // and the app adds +4.0 from month 25. Weights are non-negative, sum to
  // one and minimize the squared pre-launch gap (accelerated projected
  // gradient onto the simplex). Placebo in space: each donor in turn is
  // treated as if it had launched, with the other 19 donors as its pool.
  // Units are ranked by the ratio of post- to pre-launch root mean squared
  // prediction error (RMSPE); the permutation p-value is rank / 21.
  var SY = { J: 20, T: 36, T0: 24, tau: 4, sd: 0.6, sdCommon: 1, seed: 9707,
    treated: { mu: 50, l1: 3.6, l2: 1.8, l3: 1.0 }, names: 'ABCDEFGHIJKLMNOPQRST'.split('') };
  function projSimplex(v) {
    var u = v.slice().sort(function (a, b) { return b - a; }), css = 0, th = 0;
    for (var i = 0; i < u.length; i++) { css += u[i]; var t = (css - 1) / (i + 1); if (u[i] - t > 0) th = t; }
    return v.map(function (x) { return Math.max(0, x - th); });
  }
  // Non-negative weights summing to one that minimize Σ_t<T0 (y1 − Σ w Y0)².
  S.simplexLS = function (y1, Y0, T0, iters) {
    var J = Y0.length, A = [], b = [], i, j, t, it;
    for (i = 0; i < J; i++) {
      A.push(zeros(J)); b.push(0);
      for (t = 0; t < T0; t++) b[i] += Y0[i][t] * y1[t];
      for (j = 0; j < J; j++) for (t = 0; t < T0; t++) A[i][j] += Y0[i][t] * Y0[j][t];
    }
    var v = new Array(J).fill(1), L = 1;
    for (it = 0; it < 200; it++) {
      var w = zeros(J);
      for (i = 0; i < J; i++) for (j = 0; j < J; j++) w[i] += A[i][j] * v[j];
      L = Math.sqrt(sum(w.map(function (x) { return x * x; })));
      v = w.map(function (x) { return x / L; });
    }
    var x = new Array(J).fill(1 / J), z = x.slice(), tk = 1;
    for (it = 0; it < (iters || 6000); it++) {
      var g = zeros(J);
      for (i = 0; i < J; i++) { for (j = 0; j < J; j++) g[i] += A[i][j] * z[j]; g[i] -= b[i]; }
      var xn = projSimplex(z.map(function (zz, k) { return zz - g[k] / L; })), tn = (1 + Math.sqrt(1 + 4 * tk * tk)) / 2;
      z = xn.map(function (xx, k) { return xx + (tk - 1) / tn * (xx - x[k]); });
      x = xn; tk = tn;
    }
    return x;
  };
  function rmspe(g, a, b) { var s = 0; for (var t = a; t < b; t++) s += g[t] * g[t]; return Math.sqrt(s / (b - a)); }
  S.synth = function (seed) {
    var r = M06.rng(seed == null ? SY.seed : seed), J = SY.J, T = SY.T, T0 = SY.T0, Y = [], i, t;
    var f1 = [], f2 = [], f3 = [], m = [];
    for (t = 1; t <= T; t++) { f1.push(t / 12); f2.push(Math.sin(2 * Math.PI * t / 12)); f3.push(Math.cos(3 * Math.PI * t / 36)); m.push(SY.sdCommon * r.normal()); }
    var load = [SY.treated];
    for (i = 0; i < J; i++) load.push({ mu: 34 + 22 * r(), l1: 4.5 * r(), l2: 3 * r(), l3: 2.5 * r() });
    for (i = 0; i <= J; i++) {
      var y = [];
      for (t = 0; t < T; t++) y.push(load[i].mu + load[i].l1 * f1[t] + load[i].l2 * f2[t] + load[i].l3 * f3[t] + m[t] + SY.sd * r.normal() + (i === 0 && t >= T0 ? SY.tau : 0));
      Y.push(y);
    }
    function fitUnit(u) {
      var pool = [];
      for (var j = 1; j <= J; j++) if (j !== u) pool.push(j);
      var w = S.simplexLS(Y[u], pool.map(function (j) { return Y[j]; }), T0), syn = [], gap = [];
      for (t = 0; t < T; t++) { var s = 0; pool.forEach(function (j, k) { s += w[k] * Y[j][t]; }); syn.push(s); gap.push(Y[u][t] - s); }
      var pre = rmspe(gap, 0, T0), post = rmspe(gap, T0, T);
      return { unit: u, pool: pool, w: w, synth: syn, gap: gap, pre: pre, post: post, ratio: post / pre, postGap: M06.mean(gap.slice(T0)) };
    }
    var fits = [];
    for (i = 0; i <= J; i++) fits.push(fitUnit(i));
    var avg = [];
    for (t = 0; t < T; t++) { var s = 0; for (i = 1; i <= J; i++) s += Y[i][t] / J; avg.push(s); }
    var avgGap = Y[0].map(function (v, k) { return v - avg[k]; });
    var order = fits.slice().sort(function (a, b) { return b.ratio - a.ratio; }), rank = 0;
    order.forEach(function (f, k) { if (f.unit === 0) rank = k + 1; });
    var tw = fits[0].pool.map(function (j, k) { return { name: SY.names[j - 1], w: fits[0].w[k] }; }).filter(function (o) { return o.w > 0.005; })
      .sort(function (a, b) { return b.w - a.w; });
    return { Y: Y, avg: avg, avgGap: avgGap, fits: fits, treated: fits[0], weights: tw, rank: rank, p: rank / (J + 1),
      avgPre: rmspe(avgGap, 0, T0), avgPost: M06.mean(avgGap.slice(T0)) };
  };
  S.synth.params = SY;
  S.synth.run = function (seed) {
    var o = S.synth(seed), f = o.treated;
    return { weights: o.weights.map(function (w) { return w.name + ' ' + num(w.w, 2); }).join(', '), preRMSPE: r3(f.pre), postRMSPE: r3(f.post),
      ratio: r3(f.ratio), postGap: r3(f.postGap), truth: SY.tau, rank: o.rank, p: r3(o.p),
      donorAveragePreRMSPE: r3(o.avgPre), donorAveragePostGap: r3(o.avgPost),
      placeboRatios: o.fits.slice(1).map(function (x) { return r3(x.ratio); }) };
  };

  // =================================================================================
  // DEMOS (DOM)
  // =================================================================================

  // ---- 1 · pdag -----------------------------------------------------------------------
  // The causal graph of a panel design, with five nodes in fixed places:
  // the fixed confounder U above the treatment X, the time-varying V above
  // the outcome Y, and the month T below. Edge kinds as in meeting 8:
  // plain (grey), causal (red, the effect we want), cut (red, faded and
  // crossed: removed by the design), missing (grey dashed and crossed:
  // assumed away), and feedback (grey dashed, not crossed: an arrow that
  // exists and the design does not remove). An edge is
  // [from, to, kind, label, bow, at, side]: bow curves it, at places the
  // cross and the label along it (0 to 1), side flips the label.
  var PD = { W: 640, H: 330, RX: 76, RY: 29,
    pos: { U: { x: 120, y: 36 }, V: { x: 520, y: 36 }, X: { x: 120, y: 155 }, Y: { x: 520, y: 155 }, T: { x: 320, y: 254 } } };
  S.pdagDesigns = {
    did: {
      alt: 'A causal graph for difference-in-differences: store type and the month both drive whether a store has the app and its sales; ' +
        'each step removes one of them, and the last names parallel trends as the arrow assumed missing',
      nodes: {
        U: { name: 'Store type', role: 'U · fixed confounder', rx: 80 }, T: { name: 'Month', role: 'T · shock to all stores', rx: 86 },
        X: { name: 'App', role: 'X · treatment' }, Y: { name: 'Sales', role: 'Y · outcome' },
        V: { name: 'Group trend', role: 'V · differs by group', rx: 82 }
      },
      steps: [
        { show: ['U', 'T', 'X', 'Y'],
          edges: [['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['T', 'X', 'plain', 'launch in month 7', 0, 0.5, -1], ['T', 'Y', 'plain', 'season'], ['X', 'Y', 'causal']],
          caption: ['The chain launched the app in its larger, busier region.', 'Sales also move with the season.'], next: 'Compare each store with its own past' },
        { show: ['U', 'T', 'X', 'Y'],
          edges: [['U', 'X', 'cut'], ['U', 'Y', 'cut'], ['T', 'X', 'plain', 'launch in month 7', 0, 0.5, -1], ['T', 'Y', 'plain', 'season'], ['X', 'Y', 'causal']],
          caption: ['A store’s own before-period removes everything', 'about the store that does not change.'], next: 'Subtract the control group’s change' },
        { show: ['U', 'T', 'X', 'Y'],
          edges: [['U', 'X', 'cut'], ['U', 'Y', 'cut'], ['T', 'X', 'cut'], ['T', 'Y', 'cut'], ['X', 'Y', 'causal']],
          caption: ['The change in stores without the app removes', 'shocks that hit every store alike.'], next: 'Name the assumption' },
        { show: ['U', 'T', 'X', 'Y', 'V'],
          edges: [['U', 'X', 'cut'], ['U', 'Y', 'cut'], ['T', 'X', 'cut'], ['T', 'Y', 'cut'], ['X', 'Y', 'causal'], ['V', 'Y', 'missing', 'parallel trends']],
          caption: ['Parallel trends: without the app, both groups’ sales', 'would have changed by the same amount.'] }
      ]
    },
    fe: {
      alt: 'A causal graph for panel data with fixed effects: store size and the month are absorbed by store and month fixed effects; ' +
        'local demand, which changes within a store over time, still drives both the app and sales',
      nodes: {
        U: { name: 'Store size', role: 'U · fixed confounder', rx: 80 }, T: { name: 'Month', role: 'T · common to all stores', rx: 92 },
        X: { name: 'App', role: 'X · treatment' }, Y: { name: 'Sales', role: 'Y · outcome' },
        V: { name: 'Local demand', role: 'V · changes over time', rx: 86 }
      },
      steps: [
        { show: ['U', 'X', 'Y'], edges: [['U', 'X', 'plain'], ['U', 'Y', 'plain', null, 0, 0.3], ['X', 'Y', 'causal']],
          caption: ['Larger stores adopted the app earlier,', 'and larger stores sell more.'], next: 'Add store fixed effects' },
        { show: ['U', 'X', 'Y'], edges: [['U', 'X', 'cut'], ['U', 'Y', 'cut', null, 0, 0.3], ['X', 'Y', 'causal']],
          caption: ['Store fixed effects absorb every trait of a store', 'that does not change.'], next: 'Add month fixed effects' },
        { show: ['U', 'T', 'X', 'Y'], edges: [['U', 'X', 'cut'], ['U', 'Y', 'cut', null, 0, 0.3], ['T', 'X', 'cut'], ['T', 'Y', 'cut'], ['X', 'Y', 'causal']],
          caption: ['Month fixed effects absorb every shock', 'that hits all stores in the same month.'], next: 'What survives' },
        { show: ['U', 'T', 'X', 'Y', 'V'],
          edges: [['U', 'X', 'cut'], ['U', 'Y', 'cut', null, 0, 0.3], ['T', 'X', 'cut'], ['T', 'Y', 'cut'], ['X', 'Y', 'causal'],
            ['V', 'X', 'plain'], ['V', 'Y', 'plain'], ['Y', 'X', 'feedback', 'feedback', -60]],
          caption: ['A confounder that changes within a store over time', 'survives both sets of fixed effects.'] }
      ]
    }
  };

  M06.demos.pdag = function (root, opts) {
    var D = S.pdagDesigns[opts.design];
    if (!D) { root.textContent = 'Unknown design: ' + opts.design; return; }
    var W = PD.W, H = PD.H, POS = PD.pos;
    var svg = M06.svg(root, W, H, D.alt);
    var defs = M06.el('defs', null, svg);
    var mk = { plain: marker(defs, col.axis), causal: marker(defs, col.red), cut: marker(defs, col.red), missing: marker(defs, col.mid), feedback: marker(defs, col.axis) };
    var edgesG = M06.g(svg), nodesG = M06.g(svg), noteG = M06.g(svg);
    var cap = [M06.text(svg, W / 2, H - 31, '', { size: 18, fill: col.red, weight: 600, anchor: 'middle' }),
      M06.text(svg, W / 2, H - 9, '', { size: 18, fill: col.red, weight: 600, anchor: 'middle' })];
    function rxOf(k) { return D.nodes[k].rx || PD.RX; }
    // The boundary point of node k's ellipse, on the segment from P to it.
    function boundary(k, P) {
      var B = POS[k], RX = rxOf(k), RY = PD.RY, dx = B.x - P.x, dy = B.y - P.y, s = 1 / Math.sqrt(dx * dx / (RX * RX) + dy * dy / (RY * RY));
      return { x: B.x - dx * s, y: B.y - dy * s };
    }
    function drawEdge(e) {
      var A = POS[e[0]], B = POS[e[1]], kind = e[2], label = e[3], bow = e[4] || 0, at = e[5] == null ? 0.5 : e[5], side = e[6] || 1;
      var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.sqrt(dx * dx + dy * dy);
      var nx = -dy / L, ny = dx / L, C = { x: mx + nx * bow, y: my + ny * bow };
      var p0 = boundary(e[0], bow ? C : B), p1 = boundary(e[1], bow ? C : A);
      var ex = p1.x - (bow ? C.x : p0.x), ey = p1.y - (bow ? C.y : p0.y), eL = Math.sqrt(ex * ex + ey * ey);
      p1 = { x: p1.x - ex / eL * 3, y: p1.y - ey / eL * 3 };
      var d = bow ? 'M' + r1(p0.x) + ',' + r1(p0.y) + 'Q' + r1(C.x) + ',' + r1(C.y) + ' ' + r1(p1.x) + ',' + r1(p1.y)
        : 'M' + r1(p0.x) + ',' + r1(p0.y) + 'L' + r1(p1.x) + ',' + r1(p1.y);
      var st = {
        plain: { stroke: col.axis, width: 2.4, dash: null, op: 1 },
        causal: { stroke: col.red, width: 3.4, dash: null, op: 1 },
        cut: { stroke: col.red, width: 2.4, dash: null, op: 0.4 },
        missing: { stroke: col.mid, width: 2.4, dash: '7 5', op: 0.9 },
        feedback: { stroke: col.axis, width: 2.2, dash: '6 4', op: 1 }
      }[kind];
      M06.el('path', { d: d, fill: 'none', stroke: st.stroke, 'stroke-width': st.width, 'stroke-dasharray': st.dash,
        'stroke-opacity': st.op, 'marker-end': mk[kind] }, edgesG);
      // The point at fraction `at` along the drawn edge.
      var u = at, qx, qy;
      if (bow) { qx = (1 - u) * (1 - u) * p0.x + 2 * u * (1 - u) * C.x + u * u * p1.x; qy = (1 - u) * (1 - u) * p0.y + 2 * u * (1 - u) * C.y + u * u * p1.y; }
      else { qx = p0.x + u * (p1.x - p0.x); qy = p0.y + u * (p1.y - p0.y); }
      if (kind === 'cut' || kind === 'missing') {
        var c = kind === 'cut' ? col.red : col.grey, s = 8.5;
        M06.el('line', { x1: qx - s, y1: qy - s, x2: qx + s, y2: qy + s, stroke: c, 'stroke-width': 3.5 }, noteG);
        M06.el('line', { x1: qx - s, y1: qy + s, x2: qx + s, y2: qy - s, stroke: c, 'stroke-width': 3.5 }, noteG);
      }
      if (label) {
        var sg = bow ? (bow < 0 ? -1 : 1) : side, off = kind === 'cut' || kind === 'missing' ? 18 : 14;
        var lx = qx + nx * off * sg, ly = qy + ny * off * sg, anchor = 'middle';
        if (nx * sg < -0.3) anchor = 'end'; else if (nx * sg > 0.3) anchor = 'start';
        if (Math.abs(nx) <= 0.6 && ny * sg > 0) ly += 9;
        var lc = kind === 'missing' ? col.grey : kind === 'cut' ? col.red : col.axis;
        M06.text(noteG, lx, ly + 5, label, { size: 15, fill: lc, anchor: anchor, weight: 600, style: kind === 'plain' || kind === 'feedback' ? 'italic' : null });
      }
    }
    function drawNode(k) {
      var n = D.nodes[k], p = POS[k];
      M06.el('ellipse', { cx: p.x, cy: p.y, rx: rxOf(k), ry: PD.RY, fill: '#fff', stroke: col.axis, 'stroke-width': 2 }, nodesG);
      M06.text(nodesG, p.x, p.y - 2, n.name, { size: 19, weight: 600, anchor: 'middle' });
      M06.text(nodesG, p.x, p.y + 17, n.role, { size: 14, fill: col.grey, anchor: 'middle' });
    }
    var bar = M06.controls(root), k = 0, nextBtn;
    function render() {
      clear(edgesG); clear(nodesG); clear(noteG);
      var st = D.steps[k];
      st.edges.forEach(drawEdge);
      st.show.forEach(drawNode);
      var lines = [].concat(st.caption);
      cap[0].textContent = lines.length > 1 ? lines[0] : '';
      cap[1].textContent = lines[lines.length - 1];
      var last = k >= D.steps.length - 1;
      nextBtn.textContent = last ? st.next || 'Done' : st.next;
      nextBtn.disabled = last;
    }
    nextBtn = M06.button(bar, '', function () { if (k < D.steps.length - 1) { k++; render(); } });
    M06.button(bar, 'Reset', function () { k = 0; render(); });
    var start = parseInt(opts.step, 10);
    if (start >= 0 && start < D.steps.length) k = start;
    render();
  };

  // ---- 2 · did ------------------------------------------------------------------------
  M06.demos.did = function (root, opts) {
    var seed = intOpt(opts.seed, DID.seed), K = 1000, W = 960, H = 262;
    var svg = M06.svg(root, W, H, 'Mean weekly sales by month in the app region and elsewhere for one sample, with the counterfactual ' +
      'implied by parallel trends, and the difference-in-differences estimate across repeated samples');
    var defs = M06.el('defs', null, svg);
    // Left: group means by month.
    var X0 = 80, X1 = 440, YT = 40, YB = 196, sx = M06.scale(0.5, 12.5, X0, X1), sy = M06.scale(30, 66, YB, YT);
    heading(svg, X0, 20, 'One sample: mean sales by month', null);
    M06.axisY(svg, sy, X0, [30, 40, 50, 60], num0, { title: '$000 per week' });
    M06.axisX(svg, sx, YB, ticks(1, 12, 1), num0, { title: 'Month' });
    var xl = r1(sx(DID.launch - 0.5));
    M06.el('line', { x1: xl, x2: xl, y1: YT - 4, y2: YB, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, svg);
    M06.text(svg, xl + 6, YT + 6, 'app launches', { size: 14, fill: col.ink });
    var plot = clipped(svg, defs, X0, YT - 10, X1 - X0 + 2, YB - YT + 10);
    var lineC = M06.el('polyline', { fill: 'none', stroke: col.mid, 'stroke-width': 2.5 }, plot);
    var lineT = M06.el('polyline', { fill: 'none', stroke: col.red, 'stroke-width': 2.5 }, plot);
    var lineF = M06.el('polyline', { fill: 'none', stroke: col.red, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, plot);
    var dotsG = M06.g(plot);
    var labT = M06.text(svg, X1 + 6, 0, '', { size: 15, fill: col.red, weight: 600 });
    var labC = M06.text(svg, X1 + 6, 0, '', { size: 15, fill: col.grey, weight: 600 });
    var labF = M06.text(svg, X1 + 6, 0, '', { size: 15, fill: col.red });

    // Right: the estimates across samples.
    var P0 = 610, P1 = 930, lo = 0, hi = 12, NB = 48, PB = 196, HT = 125, sxB = M06.scale(lo, hi, P0, P1);
    heading(svg, P0, 20, 'Estimates across repeated samples', null);
    var hB = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.axis);
    M06.axisX(svg, sxB, PB, ticks(0, 12, 2), num0, { title: 'Difference-in-differences estimate' });
    M06.vline(svg, r1(sxB(DID.tau)), 46, PB, { color: col.red, label: 'true effect +4.0', anchor: 'end', size: 16 });
    var meanL = M06.el('line', { y1: 58, y2: PB, stroke: col.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4', visibility: 'hidden' }, svg);
    var mLab = M06.text(svg, P1, 44, '', { size: 15, fill: col.ink, anchor: 'end', weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), trend = false, sim, est, maxC, cur;
    M06.toggle(bar, ['Parallel trends', 'Treated stores were already growing faster'], [false, true], false,
      function (v) { if (v === trend) return; trend = v; reset(); });
    function showSample(e) {
      cur = e;
      var pT = [], pC = [], pF = [];
      clear(dotsG);
      for (var t = 1; t <= DID.T; t++) {
        pT.push([sx(t), sy(e.mT[t - 1])]); pC.push([sx(t), sy(e.mC[t - 1])]);
        if (e.cf[t - 1] != null) pF.push([sx(t), sy(e.cf[t - 1])]);
        M06.el('circle', { cx: r1(sx(t)), cy: r1(sy(e.mC[t - 1])), r: 3.5, fill: col.mid }, dotsG);
        M06.el('circle', { cx: r1(sx(t)), cy: r1(sy(e.mT[t - 1])), r: 3.5, fill: col.red }, dotsG);
      }
      attrs(lineT, { points: polyline(pT) }); attrs(lineC, { points: polyline(pC) }); attrs(lineF, { points: polyline(pF) });
      labT.textContent = 'app region'; labC.textContent = 'elsewhere'; labF.textContent = 'counterfactual';
      spreadLabels([{ y: sy(e.mT[11]), el: labT }, { y: sy(e.mC[11]), el: labC }, { y: sy(e.cf[11]), el: labF }], 17, YT, YB);
    }
    function render() {
      maxC = Math.max(maxC, tallest(hB.bins));
      hB.render(maxC);
      var n = est.length;
      if (n >= 2) {
        var m = M06.mean(est);
        show(meanL, true); attrs(meanL, { x1: r1(sxB(clamp(m, lo, hi))), x2: r1(sxB(clamp(m, lo, hi))) });
        mLab.textContent = 'mean ' + num(m, 1) + ' · SD ' + num(M06.sd(est), 1);
      } else { show(meanL, false); mLab.textContent = ''; }
    }
    function update() {
      if (!cur) { out.innerHTML = 'Samples: 0' + SEP + '40 stores in the app region, 40 elsewhere, 12 months' + SEP + 'True effect: ' + bold('+4.0'); return; }
      out.innerHTML = 'Change after − before: app region ' + bold(signed(cur.changeT, 1)) + ', elsewhere ' + bold(signed(cur.changeC, 1)) +
        SEP + 'Difference-in-differences ' + bold(signed(cur.est, 1)) + ' (SE ' + num(cur.se, 1) + ')' +
        '<br>App region − elsewhere after the launch: ' + signed(cur.after, 1) + SEP + 'Samples: ' + num(est.length) + SEP + 'True effect: ' + bold('+4.0');
    }
    function one() { run.finish(); var e = sim.next(); showSample(e); est.push(e.est); hB.add(e.est); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = hB.bins.slice();
      batch.forEach(function (e) { var k = binOf(e.est, lo, hi, NB); if (k >= 0) fb[k]++; });
      maxC = Math.max(maxC, tallest(fb));
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) { var e = batch[done++]; est.push(e.est); hB.add(e.est); }
        render(); update();
      }, function () {
        while (done < K) { var e = batch[done++]; est.push(e.est); hB.add(e.est); }
        showSample(batch[K - 1]); render(); update();
      });
    }
    function reset() {
      run.cancel();
      sim = S.did(trend, seed); est = []; maxC = 8; cur = null;
      hB.clear(); clear(dotsG); [lineT, lineC, lineF].forEach(function (l) { l.setAttribute('points', ''); });
      labT.textContent = ''; labC.textContent = ''; labF.textContent = '';
      render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 1,000', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 3 · fe ---------------------------------------------------------------------------
  M06.demos.fe = function (root, opts) {
    var seed = intOpt(opts.seed, FE.seed), K = 500, W = 960, H = 262, N = FE.N, T = FE.T;
    var svg = M06.svg(root, W, H, 'For one sample of 100 stores over 24 months, which store-months have the app; and the estimates of pooled OLS, ' +
      'store fixed effects and two-way fixed effects across repeated samples');
    // Left: the adoption grid, stores sorted by adoption month.
    var X0 = 76, X1 = 316, YT = 44, YB = 196, cw = (X1 - X0) / T, rh = (YB - YT) / N;
    heading(svg, X0 - 46, 20, 'One sample of 100 stores', null);
    var gridG = M06.g(svg);
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT, fill: 'none', stroke: col.axis, 'stroke-width': 1.2 }, svg);
    var sxM = M06.scale(0.5, T + 0.5, X0, X1);
    M06.axisX(svg, sxM, YB, [1, 6, 12, 18, 24], num0, { title: 'Month', line: false });
    var ty = (YT + YB) / 2;
    M06.text(svg, X0 - 12, ty, 'Stores', { size: 16, fill: col.grey, anchor: 'middle', transform: 'rotate(-90 ' + (X0 - 12) + ' ' + ty + ')' });
    M06.el('rect', { x: X1 + 10, y: YT, width: 13, height: 13, fill: col.red, 'fill-opacity': 0.85 }, svg);
    M06.text(svg, X1 + 28, YT + 12, 'app on', { size: 14, fill: col.ink });
    M06.el('rect', { x: X1 + 10, y: YT + 22, width: 13, height: 13, fill: col.light }, svg);
    M06.text(svg, X1 + 28, YT + 34, 'app off', { size: 14, fill: col.ink });
    var recLab = [0, 1, 2].map(function (j) { return M06.text(svg, X1 + 10, YT + 62 + 18 * j, '', { size: 14, fill: col.grey }); });

    // Right: three rows of estimates.
    var P0 = 610, P1 = 930, lo = 0, hi = 16, NB = 64, sx = M06.scale(lo, hi, P0, P1), HT = 34, base = [94, 145, 196];
    heading(svg, P0 - 182, 20, 'Estimates across repeated samples', null);
    var specs = [{ label: 'Pooled OLS', color: col.ink, key: 'pooled' }, { label: 'Store fixed effects', color: col.grey, key: 'sfe' },
      { label: 'Two-way fixed effects', color: col.blue, key: 'twfe' }];
    var rows = specs.map(function (sp, j) {
      var y0 = base[j];
      M06.el('line', { x1: P0, x2: P1, y1: y0, y2: y0, stroke: col.light, 'stroke-width': 1.5 }, svg);
      M06.text(svg, P0 - 12, y0 - HT / 2 - 1, sp.label, { size: 16, weight: 700, fill: sp.color, anchor: 'end' });
      var stat = M06.text(svg, P0 - 12, y0 - HT / 2 + 17, '', { size: 14.5, fill: sp.color, anchor: 'end' });
      var h = stepHist(svg, sx, y0, HT, lo, hi, NB, sp.color);
      var mL = M06.el('line', { y1: y0 - HT - 4, y2: y0, stroke: sp.color, 'stroke-width': 2, 'stroke-dasharray': '4 3', visibility: 'hidden' }, svg);
      var m0 = M06.el('path', { fill: 'none', stroke: col.grey, 'stroke-width': 2, visibility: 'hidden' }, svg);
      return { sp: sp, y0: y0, h: h, stat: stat, mL: mL, m0: m0, est: [], est0: [] };
    });
    M06.axisX(svg, sx, 196, ticks(0, 16, 4), num0, { title: 'Estimated effect of the app ($000 per week)' });
    M06.vline(svg, r1(sx(FE.tau)), 46, 196, { color: col.red, label: 'true effect +4.0', anchor: 'start', size: 16 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), setting = 'size', sim, maxC, nS, swSum, cur;
    M06.toggle(bar, ['Only store size confounds', 'Local demand changes', 'Adoption misrecorded'], ['size', 'demand', 'error'], setting,
      function (v) { if (v === setting) return; setting = v; reset(); });
    function showSample(e) {
      cur = e;
      clear(gridG);
      var ord = [];
      for (var i = 0; i < N; i++) ord.push(i);
      ord.sort(function (a, b) { return e.A[a] - e.A[b] || a - b; });
      M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT, fill: col.light }, gridG);
      ord.forEach(function (i, row) {
        var y = YT + row * rh, t = 0;
        while (t < T) {
          if (!e.D[i * T + t]) { t++; continue; }
          var s = t;
          while (t < T && e.D[i * T + t]) t++;
          M06.el('rect', { x: r1(X0 + s * cw), y: Math.round(y * 100) / 100, width: r1((t - s) * cw), height: Math.round(rh * 100 + 30) / 100, fill: col.red, 'fill-opacity': 0.85 }, gridG);
        }
      });
      recLab[0].textContent = num0(e.switchers) + ' switch';
      recLab[1].textContent = num0(e.always) + ' from month 1';
      recLab[2].textContent = num0(e.never) + ' never';
    }
    function render() {
      rows.forEach(function (rw) { maxC = Math.max(maxC, tallest(rw.h.bins)); });
      rows.forEach(function (rw) {
        rw.h.render(maxC);
        if (rw.est.length < 2) { rw.stat.textContent = ''; show(rw.mL, false); show(rw.m0, false); return; }
        var m = M06.mean(rw.est), x = r1(sx(clamp(m, lo, hi)));
        show(rw.mL, true); attrs(rw.mL, { x1: x, x2: x });
        if (setting === 'error') {
          var m0 = M06.mean(rw.est0), x0 = r1(sx(clamp(m0, lo, hi)));
          rw.stat.textContent = 'mean ' + num(m, 1) + ', ' + pct(m / m0) + ' of ' + num(m0, 1);
          show(rw.m0, true);
          attrs(rw.m0, { d: 'M' + x0 + ',' + (rw.y0 - HT - 4) + 'V' + rw.y0 + 'M' + (x0 - 5) + ',' + (rw.y0 - HT - 4) + 'H' + (x0 + 5) });
        } else { rw.stat.textContent = 'mean ' + num(m, 1); show(rw.m0, false); }
      });
    }
    function add(e) { rows.forEach(function (rw) { var v = e[rw.sp.key]; rw.est.push(v); rw.h.add(v); if (setting === 'error') rw.est0.push(e[rw.sp.key + '0']); }); nS++; swSum += e.switchers; }
    function update() {
      var lab = { size: 'Store size is the only confounder', demand: 'Local demand rises two months before a store adopts', error: '10% of store-months recorded wrong' }[setting];
      if (!nS) { out.innerHTML = lab + SEP + 'True effect: ' + bold('+4.0'); return; }
      out.innerHTML = 'Means across ' + num(nS) + (nS === 1 ? ' sample' : ' samples') + ': pooled OLS ' + bold(signed(M06.mean(rows[0].est), 1)) +
        SEP + 'store fixed effects ' + bold(signed(M06.mean(rows[1].est), 1)) + SEP + 'two-way fixed effects ' + bold(signed(M06.mean(rows[2].est), 1)) +
        '<br>' + lab + (setting === 'error' ? SEP + 'grey ticks: means with the true record' : '') + SEP + 'Stores that switch: ' + num(swSum / nS, 0) + ' of 100' +
        (setting === 'error' ? '' : SEP + 'True effect: ' + bold('+4.0'));
    }
    function one() { run.finish(); var e = sim.next(); showSample(e); add(e); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = rows.map(function (rw) { return rw.h.bins.slice(); });
      batch.forEach(function (e) { rows.forEach(function (rw, j) { var k = binOf(e[rw.sp.key], lo, hi, NB); if (k >= 0) fb[j][k]++; }); });
      fb.forEach(function (f) { maxC = Math.max(maxC, tallest(f)); });
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < K) add(batch[done++]); showSample(batch[K - 1]); render(); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.fe(setting, seed); maxC = 6; nS = 0; swSum = 0; cur = null;
      rows.forEach(function (rw) { rw.est = []; rw.est0 = []; rw.h.clear(); });
      clear(gridG); recLab.forEach(function (t) { t.textContent = ''; });
      render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 500', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 4 · car ---------------------------------------------------------------------------
  M06.demos.car = function (root, opts) {
    var seed = intOpt(opts.seed, CAR.seed), W = 960, H = 262;
    var svg = M06.svg(root, W, H, 'The market model fitted in the estimation window, the chain’s daily return against the market’s, ' +
      'and the cumulative abnormal return around the app announcement with its 95% band and the true cumulative effect');
    var defs = M06.el('defs', null, svg);
    // Left: the market model.
    var X0 = 80, X1 = 400, YT = 40, YB = 196, sx = M06.scale(-3, 3, X0, X1), sy = M06.scale(-6, 6, YB, YT);
    heading(svg, X0, 20, 'Estimation window: days −250 to −11', null);
    M06.axisY(svg, sy, X0, [-6, -3, 0, 3, 6], axisSigned, { title: 'Chain return (%)' });
    M06.axisX(svg, sx, YB, [-3, -2, -1, 0, 1, 2, 3], axisSigned, { title: 'Market return (%)' });
    var plotL = clipped(svg, defs, X0, YT, X1 - X0, YB - YT);
    var ptsG = M06.g(plotL);
    M06.el('line', { x1: sx(-3), x2: sx(3), y1: r1(sy(CAR.alpha - 3 * CAR.beta)), y2: r1(sy(CAR.alpha + 3 * CAR.beta)), stroke: col.red, 'stroke-width': 2.5 }, plotL);
    var fitL = M06.el('line', { stroke: col.ink, 'stroke-width': 2.5, 'stroke-dasharray': '7 5', visibility: 'hidden' }, plotL);
    var fitLab = M06.text(svg, X0 + 8, YT + 14, '', { size: 15, fill: col.ink, weight: 600 });
    M06.text(svg, X1 - 6, YB - 10, 'true line', { size: 14, fill: col.red, weight: 600, anchor: 'end' });
    var firmLab = M06.text(svg, X1 - 6, YT + 14, '', { size: 14, fill: col.grey, anchor: 'end' });

    // Right: the cumulative abnormal return.
    var P0 = 530, P1 = 930, sxD = M06.scale(-10.5, 10.5, P0, P1), syC = M06.scale(-8, 12, YB, YT);
    heading(svg, P0, 20, 'Cumulative abnormal return (CAR)', null);
    M06.axisY(svg, syC, P0, [-8, -4, 0, 4, 8, 12], axisSigned, { title: 'CAR (%)' });
    M06.axisX(svg, sxD, YB, [-10, -5, 0, 5, 10], axisSigned, { title: 'Days from the announcement', line: false });
    M06.el('line', { x1: P0, x2: P1, y1: YB, y2: YB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    var plotR = clipped(svg, defs, P0, YT, P1 - P0, YB - YT);
    M06.el('line', { x1: P0, x2: P1, y1: r1(syC(0)), y2: r1(syC(0)), stroke: col.light, 'stroke-width': 1.5 }, plotR);
    var x0d = r1(sxD(-0.5));
    var pathsG = M06.g(plotR);
    var band = M06.el('polygon', { fill: col.light, 'fill-opacity': 0.8, stroke: 'none' }, plotR);
    M06.el('line', { x1: x0d, x2: x0d, y1: YT, y2: YB, stroke: col.mid, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, plotR);
    var tp = [];
    for (var d = CAR.d0; d <= CAR.d1; d++) tp.push([sxD(d), syC(CAR.truePath(d))]);
    M06.el('polyline', { points: polyline(tp), fill: 'none', stroke: col.red, 'stroke-width': 3 }, plotR);
    var carL = M06.el('polyline', { fill: 'none', stroke: col.ink, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, plotR);
    var carDots = M06.g(plotR);
    M06.text(svg, P1 - 4, syC(CAR.leak + CAR.ar0) + 20, 'true +3.5', { size: 14, fill: col.red, weight: 700, anchor: 'end' });
    var bandLab = M06.text(svg, P0 + 8, YT + 14, '', { size: 14, fill: col.grey });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), earn = false, sim, mode = null, cur = null;
    M06.toggle(bar, ['Nothing else happened', 'Earnings released the same day'], [false, true], false, function (v) { if (v === earn) return; earn = v; reset(); });
    function scatter(f) {
      clear(ptsG);
      for (var i = 0; i < f.xm.length; i++) {
        M06.el('circle', { cx: r1(sx(clamp(f.xm[i], -3.2, 3.2))), cy: r1(sy(clamp(f.y[i], -6.5, 6.5))), r: 2.8, fill: col.mid, 'fill-opacity': 0.55 }, ptsG);
      }
      show(fitL, true);
      attrs(fitL, { x1: sx(-3), x2: sx(3), y1: r1(sy(f.alpha - 3 * f.beta)), y2: r1(sy(f.alpha + 3 * f.beta)) });
      fitLab.textContent = 'fitted: α̂ ' + num(f.alpha, 2) + '%, β̂ ' + num(f.beta, 2);
    }
    function path(car, bnd) {
      var up = [], dn = [], pts = [];
      clear(carDots);
      car.forEach(function (v, k) {
        var x = sxD(CAR.d0 + k);
        up.push([x, syC(v + bnd[k])]); dn.unshift([x, syC(v - bnd[k])]); pts.push([x, syC(v)]);
        M06.el('circle', { cx: r1(x), cy: r1(syC(clamp(v, -9, 13))), r: 3.2, fill: col.ink }, carDots);
      });
      attrs(band, { points: polyline(up.concat(dn)) });
      attrs(carL, { points: polyline(pts) });
      bandLab.textContent = 'grey band: 95% interval';
    }
    function update() {
      var truth = SEP + 'True ' + bold('+3.5%'), note = earn ? '<br>Earnings news adds about +2.0% on day 0, on top of the app\u2019s +3.5%' : '';
      if (!cur) { out.innerHTML = 'The chain announces the app on day 0' + truth + note; return; }
      out.innerHTML = (mode === 'one' ? 'One announcement: ' : 'Average of 100: ') +
        (mode === 'one' ? '' : 'mean ') + 'α̂ ' + num(cur.alpha, 2) + '%' + SEP + (mode === 'one' ? '' : 'mean ') + 'β̂ ' + num(cur.beta, 2) +
        SEP + 'CAR(−1,+1) ' + bold(signed(cur.car11, 1) + '%') + ' (SE ' + num(cur.se11, mode === 'one' ? 1 : 2) + ')' + truth + note;
    }
    function one() {
      run.finish();
      var f = sim.one();
      mode = 'one'; cur = f; clear(pathsG);
      scatter(f); path(f.car, f.band); firmLab.textContent = '';
      update();
    }
    function many() {
      run.finish();
      var res = sim.many(CAR.firms), done = 0;
      mode = 'many'; cur = null; clear(pathsG); clear(carDots);
      attrs(band, { points: '' }); attrs(carL, { points: '' }); bandLab.textContent = '';
      scatter(res.first); firmLab.textContent = 'firm 1 of 100';
      update();
      // The 100 firms' paths, faintly, then their average and its band.
      run.run(1600, function (p) {
        var t = Math.floor(res.n * p);
        while (done < t) {
          var c = res.paths[done++], q = [];
          c.forEach(function (v, k) { q.push([sxD(CAR.d0 + k), syC(v)]); });
          M06.el('polyline', { points: polyline(q), fill: 'none', stroke: col.mid, 'stroke-width': 1, 'stroke-opacity': 0.3 }, pathsG);
        }
      }, function () { cur = res; path(res.car, res.band); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.car(earn, seed); mode = null; cur = null;
      clear(ptsG); clear(pathsG); clear(carDots); show(fitL, false); fitLab.textContent = ''; firmLab.textContent = '';
      attrs(band, { points: '' }); attrs(carL, { points: '' }); bandLab.textContent = '';
      update();
    }
    M06.button(bar, 'One announcement', one);
    M06.button(bar, 'Average of 100', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 5 · event ---------------------------------------------------------------------------
  M06.demos.event = function (root, opts) {
    var seed = intOpt(opts.seed, EV.seed), K = 1000, W = 960, H = 262, nk = EV.ks.length, ref = -1 - EV.k0;
    var svg = M06.svg(root, W, H, 'Event-study coefficients by month since the app launch with 95% intervals and the true path, ' +
      'and the average post-launch coefficient across repeated samples, all samples and those that pass the pre-test of the leads');
    var defs = M06.el('defs', null, svg);
    var X0 = 80, X1 = 520, YT = 40, YB = 196, sx = M06.scale(-6.6, 6.6, X0, X1), sy = M06.scale(-8, 12, YB, YT);
    heading(svg, X0, 20, 'One sample: event-study coefficients', null);
    M06.axisY(svg, sy, X0, [-8, -4, 0, 4, 8, 12], axisSigned, { title: 'Coefficient ($000)' });
    M06.axisX(svg, sx, YB, EV.ks, axisSigned, { title: 'Months since the launch', line: false });
    M06.el('line', { x1: X0, x2: X1, y1: YB, y2: YB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    var plot = clipped(svg, defs, X0, YT - 6, X1 - X0, YB - YT + 6);
    M06.el('line', { x1: X0, x2: X1, y1: r1(sy(0)), y2: r1(sy(0)), stroke: col.light, 'stroke-width': 1.5 }, plot);
    var xl = r1(sx(-0.5));
    M06.el('line', { x1: xl, x2: xl, y1: YT - 6, y2: YB, stroke: col.mid, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, plot);
    var truthG = M06.g(plot), ptsG = M06.g(plot);
    // The reference month, labelled at the top with a leader down to its point.
    M06.text(svg, sx(-1), YT + 6, 'reference', { size: 14, fill: col.grey, anchor: 'middle' });
    M06.el('line', { x1: r1(sx(-1)), x2: r1(sx(-1)), y1: YT + 12, y2: r1(sy(0) - 8), stroke: col.mid, 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }, svg);

    var P0 = 630, P1 = 930, lo = 0, hi = 10, NB = 50, PB = 196, HT = 118, sxB = M06.scale(lo, hi, P0, P1);
    heading(svg, P0, 20, 'Average post-launch coefficient', null);
    var hAll = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.axis), hPass = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.blue, 0.22);
    M06.axisX(svg, sxB, PB, ticks(0, 10, 2), num0, { title: 'Across repeated samples ($000)' });
    M06.vline(svg, r1(sxB(EV.tau)), 50, PB, { color: col.red, label: 'true +4.0', anchor: 'end', size: 16 });
    var mAll = M06.el('line', { y1: 70, y2: PB, stroke: col.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4', visibility: 'hidden' }, svg);
    var mPass = M06.el('line', { y1: 70, y2: PB, stroke: col.blue, 'stroke-width': 2, 'stroke-dasharray': '6 4', visibility: 'hidden' }, svg);
    var legA = M06.text(svg, P1, 44, '', { size: 14.5, fill: col.ink, anchor: 'end', weight: 600 });
    var legP = M06.text(svg, P1, 62, '', { size: 14.5, fill: col.blue, anchor: 'end', weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), setting = 'const', sim, all, pass, rej, maxC, cur;
    M06.toggle(bar, ['Effect constant', 'Effect grows', 'Treated stores already trending up'], ['const', 'grow', 'trend'], setting,
      function (v) { if (v === setting) return; setting = v; reset(); });
    function drawTruth() {
      clear(truthG);
      var pre = [], post = [];
      EV.ks.forEach(function (k) { (k < 0 ? pre : post).push([sx(k), sy(EV.effect(setting, k))]); });
      M06.el('polyline', { points: polyline(pre), fill: 'none', stroke: col.red, 'stroke-width': 3 }, truthG);
      M06.el('polyline', { points: polyline(post), fill: 'none', stroke: col.red, 'stroke-width': 3 }, truthG);
    }
    function showSample(e) {
      cur = e;
      clear(ptsG);
      for (var j = 0; j < nk; j++) {
        var x = r1(sx(EV.ks[j])), y = sy(e.b[j]);
        if (j === ref) { M06.el('circle', { cx: x, cy: r1(y), r: 5, fill: '#fff', stroke: col.ink, 'stroke-width': 2 }, ptsG); continue; }
        M06.el('line', { x1: x, x2: x, y1: r1(sy(e.b[j] - 1.96 * e.se[j])), y2: r1(sy(e.b[j] + 1.96 * e.se[j])), stroke: col.ink, 'stroke-width': 2 }, ptsG);
        M06.el('circle', { cx: x, cy: r1(y), r: 4.6, fill: col.ink }, ptsG);
      }
    }
    function render() {
      maxC = Math.max(maxC, tallest(hAll.bins));
      hAll.render(maxC); hPass.render(maxC);
      var n = all.length;
      if (n >= 2) {
        var ma = M06.mean(all);
        show(mAll, true); attrs(mAll, { x1: r1(sxB(clamp(ma, lo, hi))), x2: r1(sxB(clamp(ma, lo, hi))) });
        legA.textContent = 'all samples: mean ' + num(ma, 1);
      } else { show(mAll, false); legA.textContent = ''; }
      if (pass.length >= 2) {
        var mp = M06.mean(pass);
        show(mPass, true); attrs(mPass, { x1: r1(sxB(clamp(mp, lo, hi))), x2: r1(sxB(clamp(mp, lo, hi))) });
        legP.textContent = 'pass the pre-test: mean ' + num(mp, 1);
      } else { show(mPass, false); legP.textContent = ''; }
    }
    function add(e) { all.push(e.post); hAll.add(e.post); if (e.pass) { pass.push(e.post); hPass.add(e.post); } else rej++; }
    function update() {
      var n = all.length, truth = SEP + 'True average after the launch: ' + bold('+4.0');
      if (!cur) { out.innerHTML = '40 stores in the app region, 40 elsewhere, months −6 to +6' + truth; return; }
      out.innerHTML = 'This sample: joint test of the leads p = ' + num(cur.p, 2) + (cur.pass ? ' (passes)' : ' (rejects at 5%)') + SEP + 'average post-launch coefficient ' + bold(signed(cur.post, 1)) +
        '<br>Samples: ' + num(n) + (n >= 2 ? SEP + 'Leads rejected at 5% in ' + bold(pct(rej / n)) + ' of samples' : '') + truth;
    }
    function one() { run.finish(); var e = sim.next(); showSample(e); add(e); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = hAll.bins.slice();
      batch.forEach(function (e) { var k = binOf(e.post, lo, hi, NB); if (k >= 0) fb[k]++; });
      maxC = Math.max(maxC, tallest(fb));
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < K) add(batch[done++]); showSample(batch[K - 1]); render(); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.event(setting, seed); all = []; pass = []; rej = 0; maxC = 8; cur = null;
      hAll.clear(); hPass.clear(); clear(ptsG);
      drawTruth(); render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 1,000', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 6 · staggered --------------------------------------------------------------------------
  M06.demos.staggered = function (root, opts) {
    var seed = intOpt(opts.seed, ST.seed), K = 500, W = 960, H = 262, T = ST.T;
    var svg = M06.svg(root, W, H, 'Mean sales by month for three cohorts of stores that adopt the app in months 4, 8 and 12, and the two-way ' +
      'fixed effects estimate and a Callaway–Sant’Anna estimate across repeated samples against the true average effect on the treated');
    var defs = M06.el('defs', null, svg);
    var X0 = 80, X1 = 420, YT = 40, YB = 196, sx = M06.scale(0.5, T + 0.5, X0, X1), sy = M06.scale(28, 72, YB, YT);
    heading(svg, X0, 20, 'One sample: cohort mean sales', null);
    M06.axisY(svg, sy, X0, [30, 40, 50, 60, 70], num0, { title: '$000 per week' });
    M06.axisX(svg, sx, YB, [1, 4, 8, 12, 16], num0, { title: 'Month' });
    ST.cohorts.forEach(function (c) {
      M06.el('line', { x1: r1(sx(c - 0.5)), x2: r1(sx(c - 0.5)), y1: YT, y2: YB, stroke: col.light, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, svg);
    });
    var plot = clipped(svg, defs, X0, YT - 6, X1 - X0 + 2, YB - YT + 6), linesG = M06.g(plot), labG = M06.g(svg);

    var P0 = 640, P1 = 930, lo = -4, hi = 8, NB = 48, PB = 196, HT = 112, sxB = M06.scale(lo, hi, P0, P1);
    heading(svg, P0, 20, 'Estimates across repeated samples', null);
    var hTw = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.axis), hCs = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.blue);
    M06.axisX(svg, sxB, PB, ticks(-4, 8, 2), axisSigned, { title: 'Estimated average effect ($000)' });
    var truthL = M06.el('line', { y1: 50, y2: PB, stroke: col.red, 'stroke-width': 2.5 }, svg);
    var truthLab = M06.text(svg, 0, 44, '', { size: 16, fill: col.red, weight: 600 });
    var mTw = M06.el('line', { y1: 66, y2: PB, stroke: col.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4', visibility: 'hidden' }, svg);
    var mCs = M06.el('line', { y1: 66, y2: PB, stroke: col.blue, 'stroke-width': 2, 'stroke-dasharray': '6 4', visibility: 'hidden' }, svg);
    M06.text(svg, P0 + 4, 44, 'two-way fixed effects', { size: 14.5, fill: col.ink, weight: 600 });
    M06.text(svg, P0 + 4, 62, 'Callaway–Sant’Anna', { size: 14.5, fill: col.blue, weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), grow = false, never = false, sim, tw, cs, maxC, bacon;
    M06.toggle(bar, ['Effect constant', 'Effect grows with time'], [false, true], false, function (v) { if (v === grow) return; grow = v; reset(); });
    M06.toggle(bar, ['All adopt', 'Some never adopt'], [false, true], false, function (v) { if (v === never) return; never = v; reset(); });
    function showSample(e) {
      clear(linesG); clear(labG);
      var gs = ST.groups(never), items = [];
      gs.forEach(function (g, gi) {
        var pre = [], post = [];
        for (var t = 1; t <= T; t++) {
          var p = [sx(t), sy(e.means[gi][t - 1])];
          if (t < g.start) pre.push(p);
          if (t >= g.start - 1 && g.start <= T) post.push(p);
        }
        if (pre.length) M06.el('polyline', { points: polyline(pre), fill: 'none', stroke: col.mid, 'stroke-width': 2.5 }, linesG);
        if (post.length > 1) M06.el('polyline', { points: polyline(post), fill: 'none', stroke: col.red, 'stroke-width': 2.5 }, linesG);
        if (g.start <= T) M06.el('circle', { cx: r1(sx(g.start)), cy: r1(sy(e.means[gi][g.start - 1])), r: 4.5, fill: col.red }, linesG);
        var lab = M06.text(labG, X1 + 6, 0, g.start <= T ? 'adopt in month ' + g.start : 'never adopt', { size: 14.5, fill: g.start <= T ? col.red : col.grey, weight: 600 });
        items.push({ y: sy(e.means[gi][T - 1]), el: lab });
      });
      spreadLabels(items, 17, YT, YB);
    }
    function render() {
      maxC = Math.max(maxC, tallest(hTw.bins), tallest(hCs.bins));
      hTw.render(maxC); hCs.render(maxC);
      [[tw, mTw], [cs, mCs]].forEach(function (pr) {
        if (pr[0].length < 2) { show(pr[1], false); return; }
        var m = M06.mean(pr[0]), x = r1(sxB(clamp(m, lo, hi)));
        show(pr[1], true); attrs(pr[1], { x1: x, x2: x });
      });
    }
    function update() {
      var cover = !never && grow ? 'Truth averages the store-months before month 12' : never ? 'Truth averages every treated store-month' : 'The effect is the same in every treated store-month';
      var w = SEP + 'Weight on already-treated controls: ' + bold(pct(bacon.alreadyShare));
      if (!tw.length) { out.innerHTML = 'True average effect on the treated: ' + bold(signed(sim.truth, 1)) + '<br>' + cover + w; return; }
      out.innerHTML = 'Means across ' + num(tw.length) + (tw.length === 1 ? ' sample' : ' samples') + ': two-way fixed effects ' + bold(signed(M06.mean(tw), 1)) +
        SEP + 'Callaway–Sant’Anna ' + bold(signed(M06.mean(cs), 1)) + SEP + 'true ' + bold(signed(sim.truth, 1)) + '<br>' + cover + w;
    }
    function add(e) { tw.push(e.twfe); cs.push(e.cs); hTw.add(e.twfe); hCs.add(e.cs); }
    function one() { run.finish(); var e = sim.next(); showSample(e); add(e); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var f1 = hTw.bins.slice(), f2 = hCs.bins.slice();
      batch.forEach(function (e) { var a = binOf(e.twfe, lo, hi, NB), b = binOf(e.cs, lo, hi, NB); if (a >= 0) f1[a]++; if (b >= 0) f2[b]++; });
      maxC = Math.max(maxC, tallest(f1), tallest(f2));
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < K) add(batch[done++]); showSample(batch[K - 1]); render(); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.staggered(grow, never, seed); tw = []; cs = []; maxC = 8;
      bacon = S.staggered.bacon(grow, never);
      hTw.clear(); hCs.clear(); clear(linesG); clear(labG);
      var xt = r1(sxB(sim.truth));
      attrs(truthL, { x1: xt, x2: xt }); attrs(truthLab, { x: xt + 6 }); truthLab.textContent = 'true ' + signed(sim.truth, 1);
      render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 500', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // ---- 7 · synth ---------------------------------------------------------------------------------
  M06.demos.synth = function (root, opts) {
    var seed = intOpt(opts.seed, SY.seed), W = 960, H = 262, T = SY.T, T0 = SY.T0, R = S.synth(seed);
    var svg = M06.svg(root, W, H, 'Monthly sales in the city that got the app against the average of 20 donor cities or its synthetic control, ' +
      'and the gap between them, with the placebo gaps of every donor city');
    var defs = M06.el('defs', null, svg);
    var X0 = 80, X1 = 420, YT = 40, YB = 196, sx = M06.scale(0.5, T + 0.5, X0, X1), sy = M06.scale(30, 74, YB, YT);
    heading(svg, X0, 20, 'Mean weekly sales per store', null);
    M06.axisY(svg, sy, X0, [30, 40, 50, 60, 70], num0, { title: '$000 per week' });
    M06.axisX(svg, sx, YB, [1, 6, 12, 18, 24, 30, 36], num0, { title: 'Month' });
    var xl = r1(sx(T0 + 0.5));
    M06.el('line', { x1: xl, x2: xl, y1: YT - 4, y2: YB, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, svg);
    M06.text(svg, xl - 6, YT + 6, 'app launches', { size: 14, fill: col.ink, anchor: 'end' });
    var plotL = clipped(svg, defs, X0, YT - 6, X1 - X0 + 2, YB - YT + 6);
    var compL = M06.el('polyline', { fill: 'none', stroke: col.mid, 'stroke-width': 2.5 }, plotL);
    var treatL = M06.el('polyline', { fill: 'none', stroke: col.red, 'stroke-width': 2.5 }, plotL);
    var labT = M06.text(svg, X1 + 6, 0, 'launch city', { size: 15, fill: col.red, weight: 600 });
    var labC = M06.text(svg, X1 + 6, 0, '', { size: 15, fill: col.grey, weight: 600 });
    function pts(v, f) { var o = []; for (var t = 1; t <= T; t++) o.push([f(t), v[t - 1]]); return o; }
    attrs(treatL, { points: polyline(pts(R.Y[0], sx).map(function (p) { return [p[0], sy(p[1])]; })) });

    var P0 = 646, P1 = 930, sx2 = M06.scale(0.5, T + 0.5, P0, P1), sy2 = M06.scale(-6, 14, YB, YT);
    heading(svg, P0 - 56, 20, 'Gap: launch city minus comparison', null);
    M06.axisY(svg, sy2, P0, [-4, 0, 4, 8, 12], axisSigned, { title: 'Gap ($000)' });
    M06.axisX(svg, sx2, YB, [1, 12, 24, 36], num0, { title: 'Month', line: false });
    M06.el('line', { x1: P0, x2: P1, y1: YB, y2: YB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    var plotR = clipped(svg, defs, P0, YT - 6, P1 - P0 + 2, YB - YT + 6);
    M06.el('line', { x1: P0, x2: P1, y1: r1(sy2(0)), y2: r1(sy2(0)), stroke: col.light, 'stroke-width': 1.5 }, plotR);
    var x2l = r1(sx2(T0 + 0.5));
    M06.el('line', { x1: x2l, x2: x2l, y1: YT - 4, y2: YB, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, plotR);
    var placeboG = M06.g(plotR);
    M06.el('polyline', { points: polyline([[sx2(0.5), sy2(0)], [sx2(T0 + 0.5), sy2(0)], [sx2(T0 + 0.5), sy2(SY.tau)], [sx2(T + 0.5), sy2(SY.tau)]]),
      fill: 'none', stroke: col.red, 'stroke-width': 3 }, plotR);
    var gapL = M06.el('polyline', { fill: 'none', stroke: col.ink, 'stroke-width': 2.5, 'stroke-dasharray': '7 4' }, plotR);
    M06.text(svg, x2l - 6, sy2(SY.tau) + 5, 'true +4.0', { size: 14, fill: col.red, weight: 700, anchor: 'end' });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), mode = 'avg';
    M06.toggle(bar, ['Average of the donors', 'Synthetic control', 'Placebo in space'], ['avg', 'synth', 'placebo'], mode, function (v) { if (v === mode) return; mode = v; render(); });
    function render() {
      run.cancel();
      var comp = mode === 'avg' ? R.avg : R.treated.synth, gap = mode === 'avg' ? R.avgGap : R.treated.gap;
      attrs(compL, { points: polyline(pts(comp, sx).map(function (p) { return [p[0], sy(p[1])]; })),
        stroke: mode === 'avg' ? col.mid : col.ink, 'stroke-dasharray': mode === 'avg' ? null : '7 4' });
      if (mode === 'avg') compL.removeAttribute('stroke-dasharray');
      labC.textContent = mode === 'avg' ? 'donor average' : 'synthetic control';
      labC.setAttribute('fill', mode === 'avg' ? col.grey : col.ink);
      spreadLabels([{ y: sy(R.Y[0][T - 1]), el: labT }, { y: sy(comp[T - 1]), el: labC }], 17, YT, YB);
      attrs(gapL, { points: polyline(pts(gap, sx2).map(function (p) { return [p[0], sy2(p[1])]; })) });
      clear(placeboG);
      if (mode === 'placebo') {
        var k = 0;
        run.run(1500, function (p) {
          var t = Math.floor(SY.J * p);
          while (k < t) {
            k++;
            var f = R.fits[k];
            M06.el('polyline', { points: polyline(pts(f.gap, sx2).map(function (q) { return [q[0], sy2(q[1])]; })), fill: 'none', stroke: col.mid, 'stroke-width': 1.5, 'stroke-opacity': 0.7 }, placeboG);
          }
        });
      }
      var f0 = R.treated;
      if (mode === 'avg') {
        out.innerHTML = 'Donor average: mean gap before the launch ' + signed(M06.mean(R.avgGap.slice(0, T0)), 1) + ', after ' + bold(signed(R.avgPost, 1)) +
          SEP + 'pre-launch RMSPE ' + num(R.avgPre, 1) + SEP + 'True effect ' + bold('+4.0');
      } else if (mode === 'synth') {
        out.innerHTML = 'Weights: ' + R.weights.map(function (w) { return 'city ' + w.name + ' ' + num(w.w, 2); }).join(', ') +
          '<br>Pre-launch RMSPE ' + num(f0.pre, 2) + SEP + 'Mean gap after the launch ' + bold(signed(f0.postGap, 1)) + SEP + 'True effect ' + bold('+4.0');
      } else {
        var rs = R.fits.slice(1).map(function (f) { return f.ratio; });
        out.innerHTML = 'Post/pre RMSPE ratio: launch city ' + bold(num(f0.ratio, 1)) + SEP + 'donor cities ' + num(Math.min.apply(null, rs), 1) +
          ' to ' + num(Math.max.apply(null, rs), 1) +
          '<br>Launch city ranks ' + bold(num0(R.rank) + ' of 21') + SEP + 'Permutation p-value ' + num0(R.rank) + '/21 = ' + bold(num(R.p, 3));
      }
    }
    render();
  };
})();
