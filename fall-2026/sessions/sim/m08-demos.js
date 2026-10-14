/* m08-demos.js — the animations and figures for meeting 8, research designs I.
 *
 * Built on m06-core.js (the M06 namespace: rng, scales, axes, controls),
 * so a slide holds <div class="m06" data-demo="NAME"></div> as in meetings
 * 6 and 7.
 *
 *   dag         One renderer for the causal graph of every design. The
 *               slide picks the design with data-design and an optional
 *               data-step. "Next" adds the design to the sceptic's graph
 *               one element at a time: the new arrow, the arrow it cuts,
 *               the arrow it needs to be missing.
 *   geo         eBay's regional experiment as a grid: 210 market areas,
 *               68 chosen at random (static).
 *   randomize   The meeting 7 retention email, now as a sampling
 *               experiment: 2,000 customers per sample, 30% emailed, either
 *               the top scores or a random 30%. Estimates across samples.
 *   arms        1,000 simulated checkout tests: the estimated lifts, the
 *               significant ones, power and the minimum detectable effect,
 *               as 10,000 visitors are split across more pages.
 *   balance     One randomization of 1,000 customers, 20 baseline
 *               covariates with no true differences: stars by chance, and
 *               the joint test.
 *   iv          Weekly prices and quantities from shifting supply and
 *               demand (meeting 7), plus an input cost that shifts supply.
 *               OLS and IV across samples, with a slider for the
 *               instrument's strength and a toggle that breaks the
 *               exclusion restriction.
 *   rd          The email sent to every customer above a score cutoff: the
 *               binned renewal rates, local linear fits, a bandwidth
 *               slider, the density of the score, and a toggle that lets
 *               reps push favourites over the line.
 *
 * The simulations live in M06.sims.m08 and touch no DOM, so they run under
 * Node for checking the numbers quoted in the speaker notes:
 *   node -e "global.window=global; require('./m06-core.js');
 *            require('./m08-demos.js'); console.log(M06.sims.m08.iv.run(8, 0, 1000))"
 * Everything is seeded: Reset replays the same draws.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06 || !M06.rng) throw new Error('Load m06-core.js before m08-demos.js');
  M06.sims = M06.sims || {};
  var S = (M06.sims.m08 = {});
  var col = M06.col, fmt = M06.fmt;

  // ---- small helpers ------------------------------------------------------------
  var SEP = '<span class="sep">·</span>', DASH = '—', MINUS = '−';
  function bold(s) { return '<b>' + s + '</b>'; }
  function num(x, d) { return fmt.num(x, d); }
  function num0(x) { return fmt.num(x, 0); }
  function pct(x, d) { return fmt.pct(x, d == null ? 0 : d); }
  function signed(x, d) { return (x > 0 ? '+' : '') + fmt.num(x, d); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ticks(a, b, step) {
    var out = [];
    for (var v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function intOpt(v, dflt) { var n = parseInt(v, 10); return n > 0 ? n : dflt; }
  function numOpt(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }
  function attrs(el, o) { for (var k in o) el.setAttribute(k, o[k]); return el; }
  function show(el, on) { el.setAttribute('visibility', on ? 'visible' : 'hidden'); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function tallest(bins) { return Math.max.apply(null, bins); }
  var uidN = 0;
  function uid(p) { uidN += 1; return 'm08-' + p + '-' + uidN; }
  function binOf(v, lo, hi, nb) {
    if (!(v >= lo && v <= hi)) return -1;
    return Math.min(nb - 1, Math.floor((v - lo) / ((hi - lo) / nb)));
  }
  function logistic(x) { return 1 / (1 + Math.exp(-x)); }
  function range(n) { var o = []; for (var i = 0; i < n; i++) o.push(i); return o; }

  // One animation at a time, as in meeting 7.
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
  function stepHist(parent, sx, y0, h, lo, hi, nb, color) {
    var bins = new Array(nb).fill(0), bw = (hi - lo) / nb;
    var fill = M06.el('path', { fill: color, 'fill-opacity': 0.14, stroke: 'none' }, parent);
    var edge = M06.el('path', { fill: 'none', stroke: color, 'stroke-width': 2.5 }, parent);
    var api = {
      bins: bins,
      add: function (v) { var k = binOf(v, lo, hi, nb); if (k >= 0) bins[k]++; },
      clear: function () { bins.fill(0); },
      color: function (c) { fill.setAttribute('fill', c); edge.setAttribute('stroke', c); },
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
    return api;
  }

  // Simple regression of y on x: slope, intercept, the default standard
  // errors of both, and the residual sum of squares.
  function fit1(x, y) {
    var n = x.length, mx = M06.mean(x), my = M06.mean(y), sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    var b = sxy / sxx, a = my - b * mx, sse = 0;
    for (i = 0; i < n; i++) { var e = y[i] - a - b * x[i]; sse += e * e; }
    var s2 = sse / (n - 2);
    return { slope: b, intercept: a, se: Math.sqrt(s2 / sxx), seA: Math.sqrt(s2 * (1 / n + mx * mx / sxx)), n: n, sxx: sxx };
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

  // ---- distributions ---------------------------------------------------------------
  // The regularized incomplete beta function, for t and F tail probabilities.
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
  // Two-sided p-value of a t statistic; upper tail of an F statistic.
  S.pT = function (t, df) { return ibeta(df / 2, 0.5, df / (df + t * t)); };
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

  // =================================================================================
  // 1 · dag
  // =================================================================================
  // Every design starts from the sceptic's graph: an unobserved U drives
  // both the treatment X and the outcome Y. Each step adds one element.
  // Edge kinds: plain (grey), causal (red, the effect we want), new (blue,
  // what the design adds), cut (red, struck through: the arrow the design
  // removes), missing (grey dashed, struck through: the arrow the design
  // assumes away). An edge may bow (a quadratic curve) to avoid a node.
  var NODE = { RX: 66, RY: 28 };
  var POS = { U: { x: 330, y: 48 }, Z: { x: 78, y: 96 }, X: { x: 196, y: 212 }, Y: { x: 476, y: 212 } };
  S.dagDesigns = {
    experiment: {
      alt: 'A causal graph: an unobserved confounder drives who gets the email and renewal; a coin takes over the assignment',
      nodes: {
        U: { name: 'Unobserved', role: 'U · confounder' }, Z: { name: 'Coin', role: 'random assignment' },
        X: { name: 'Email', role: 'X · treatment' }, Y: { name: 'Renewal', role: 'Y · outcome' }
      },
      steps: [
        { show: ['U', 'X', 'Y'], edges: [['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Something unobserved drives both who gets the email and who renews.', next: 'Randomize the email' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new'], ['U', 'X', 'cut'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'The coin alone decides. No arrow from U reaches the treatment.', next: 'What U still drives' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new'], ['U', 'X', 'cut'], ['U', 'Y', 'plain', 'may still affect renewal'], ['X', 'Y', 'causal']],
          caption: 'U may still drive renewal. It no longer drives who was emailed, so the comparison is clean.' }
      ]
    },
    draft: {
      alt: 'A causal graph: health, schooling and family background drive both military service and earnings; a lottery number moves service and must not reach earnings any other way',
      nodes: {
        U: { name: 'Background', role: 'U · confounder' }, Z: { name: 'Lottery number', role: 'Z · instrument' },
        X: { name: 'Military service', role: 'X · treatment' }, Y: { name: 'Earnings', role: 'Y · outcome' }
      },
      steps: [
        { show: ['U', 'X', 'Y'], edges: [['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Health, schooling and family decided who served, and they also drive earnings.', next: 'Add the lottery' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new', 'relevance'], ['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Relevance: men with low numbers served more often. The first stage measures it.', next: 'Name the assumptions' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new', 'relevance'], ['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal'],
            ['Z', 'Y', 'missing', 'exclusion', -95], ['U', 'Z', 'missing', 'independence']],
          caption: 'Exclusion: the number reaches earnings only through service. Independence: it was drawn at random.' }
      ]
    },
    iv: {
      alt: 'A causal graph: demand shocks drive both price and quantity; an input cost moves price and must not reach quantity any other way',
      nodes: {
        U: { name: 'Demand shocks', role: 'U · confounder' }, Z: { name: 'Input cost', role: 'Z · instrument' },
        X: { name: 'Price', role: 'X · treatment' }, Y: { name: 'Quantity', role: 'Y · outcome' }
      },
      steps: [
        { show: ['U', 'X', 'Y'], edges: [['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Demand shocks move both the price and the quantity sold.', next: 'Add the instrument' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new', 'relevance'], ['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Relevance: the input cost moves the price. Testable, from the first stage.', next: 'Name the assumption' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new', 'relevance'], ['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal'],
            ['Z', 'Y', 'missing', 'exclusion', -95], ['U', 'Z', 'missing', 'independence']],
          caption: 'Exclusion: no path from the cost to quantity except through the price. Not testable.' }
      ]
    },
    rd: {
      alt: 'A causal graph: a renewal score decides who gets the email at a cutoff; the unobserved confounder still drives the score and renewal',
      nodes: {
        U: { name: 'Unobserved', role: 'U · confounder' }, Z: { name: 'Renewal score', role: 'R · running variable' },
        X: { name: 'Email', role: 'X · treatment' }, Y: { name: 'Renewal', role: 'Y · outcome' }
      },
      steps: [
        { show: ['U', 'X', 'Y'], edges: [['U', 'X', 'plain'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Something unobserved drives both who gets the email and who renews.', next: 'Email everyone above a cutoff' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new', 'score ≥ cutoff'], ['U', 'Z', 'plain'], ['Z', 'Y', 'plain', null, -95], ['U', 'X', 'cut'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'The score alone decides. U still drives the score and renewal, so the score predicts renewal.', next: 'Name the assumption' },
        { show: ['U', 'Z', 'X', 'Y'], edges: [['Z', 'X', 'new', 'score ≥ cutoff'], ['U', 'Z', 'plain'], ['Z', 'Y', 'plain', 'smooth at the cutoff', -95], ['U', 'X', 'cut'], ['U', 'Y', 'plain'], ['X', 'Y', 'causal']],
          caption: 'Continuity: everything except the email changes smoothly at the cutoff. Check that neither the number of customers nor their covariates jump there.' }
      ]
    }
  };

  M06.demos.dag = function (root, opts) {
    var D = S.dagDesigns[opts.design];
    if (!D) { root.textContent = 'Unknown design: ' + opts.design; return; }
    var W = 560, H = 275, RX = NODE.RX, RY = NODE.RY;
    var svg = M06.svg(root, W, H, D.alt);
    var defs = M06.el('defs', null, svg);
    var mk = { plain: marker(defs, col.axis), causal: marker(defs, col.red), 'new': marker(defs, col.blue), cut: marker(defs, col.red), missing: marker(defs, col.mid) };
    var edgesG = M06.g(svg), nodesG = M06.g(svg), noteG = M06.g(svg);
    var caption = M06.text(svg, W / 2, H - 8, '', { size: 15.5, fill: col.red, weight: 600, anchor: 'middle' });

    // The boundary point of the ellipse at node B, on the segment from P to B.
    function boundary(B, P) {
      var dx = B.x - P.x, dy = B.y - P.y, k = 1 / Math.sqrt(dx * dx / (RX * RX) + dy * dy / (RY * RY));
      return { x: B.x - dx * k, y: B.y - dy * k };
    }
    function drawEdge(e) {
      var A = POS[e[0]], B = POS[e[1]], kind = e[2], label = e[3], bow = e[4] || 0;
      var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.sqrt(dx * dx + dy * dy);
      var nx = -dy / L, ny = dx / L;                       // unit normal
      var C = { x: mx + nx * bow, y: my + ny * bow };       // control point
      var p0 = boundary(A, bow ? C : B), p1 = boundary(B, bow ? C : A);
      var ex = p1.x - (bow ? C.x : A.x), ey = p1.y - (bow ? C.y : A.y), eL = Math.sqrt(ex * ex + ey * ey);
      p1 = { x: p1.x - ex / eL * 3, y: p1.y - ey / eL * 3 };
      var d = bow ? 'M' + r1(p0.x) + ',' + r1(p0.y) + 'Q' + r1(C.x) + ',' + r1(C.y) + ' ' + r1(p1.x) + ',' + r1(p1.y)
        : 'M' + r1(p0.x) + ',' + r1(p0.y) + 'L' + r1(p1.x) + ',' + r1(p1.y);
      var style = {
        plain: { stroke: col.axis, width: 2.4, dash: null, op: 1 },
        causal: { stroke: col.red, width: 3.4, dash: null, op: 1 },
        'new': { stroke: col.blue, width: 3.4, dash: null, op: 1 },
        cut: { stroke: col.red, width: 2.4, dash: null, op: 0.45 },
        missing: { stroke: col.mid, width: 2.4, dash: '7 5', op: 0.9 }
      }[kind];
      M06.el('path', { d: d, fill: 'none', stroke: style.stroke, 'stroke-width': style.width, 'stroke-dasharray': style.dash,
        'stroke-opacity': style.op, 'marker-end': mk[kind] }, edgesG);
      // The midpoint of the drawn curve, for the cross and the label.
      var qx = bow ? 0.25 * p0.x + 0.5 * C.x + 0.25 * p1.x : mx, qy = bow ? 0.25 * p0.y + 0.5 * C.y + 0.25 * p1.y : my;
      if (kind === 'cut' || kind === 'missing') {
        var c = kind === 'cut' ? col.red : col.grey, s = 9;
        M06.el('line', { x1: qx - s, y1: qy - s, x2: qx + s, y2: qy + s, stroke: c, 'stroke-width': 3.5 }, noteG);
        M06.el('line', { x1: qx - s, y1: qy + s, x2: qx + s, y2: qy - s, stroke: c, 'stroke-width': 3.5 }, noteG);
      }
      if (label) {
        var off = 16, lx = qx + nx * off * (bow < 0 ? -1 : 1), ly = qy + ny * off * (bow < 0 ? -1 : 1);
        if (!bow) { lx = qx + nx * off; ly = qy + ny * off; }
        var lc = kind === 'new' ? col.blue : kind === 'missing' ? col.grey : kind === 'cut' ? col.red : col.axis;
        M06.text(noteG, lx, ly + 5, label, { size: 13.5, fill: lc, anchor: 'middle', weight: 600, style: kind === 'plain' ? 'italic' : null });
      }
    }
    function drawNode(k) {
      var n = D.nodes[k], p = POS[k];
      M06.el('ellipse', { cx: p.x, cy: p.y, rx: RX, ry: RY, fill: '#fff', stroke: col.axis, 'stroke-width': 2 }, nodesG);
      M06.text(nodesG, p.x, p.y - 2, n.name, { size: 17, weight: 600, anchor: 'middle' });
      M06.text(nodesG, p.x, p.y + 16, n.role, { size: 12.5, fill: col.grey, anchor: 'middle' });
    }
    var bar = M06.controls(root), k = 0, nextBtn;
    function render() {
      clear(edgesG); clear(nodesG); clear(noteG);
      var st = D.steps[k];
      st.edges.forEach(drawEdge);
      st.show.forEach(drawNode);
      caption.textContent = st.caption;
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

  // =================================================================================
  // 2 · geo (static)
  // =================================================================================
  // 210 designated market areas in a grid, 68 chosen at random to go 60
  // days without non-brand search ads (Blake, Nosko and Tadelis 2015).
  M06.demos.geo = function (root) {
    var N = 210, T = 68, cols = 30, rows = 7, sz = 22, gap = 5, x0 = 60, y0 = 46;
    var svg = M06.svg(root, 960, 270, 'A grid of 210 squares, one per designated market area, with 68 of them red: the areas where eBay stopped non-brand search ads for 60 days');
    var r = M06.rng(8101), idx = range(N);
    r.shuffle(idx);
    var treated = {};
    for (var i = 0; i < T; i++) treated[idx[i]] = true;
    heading(svg, x0, 24, '210 US market areas', null);
    for (i = 0; i < N; i++) {
      var cx = x0 + (i % cols) * (sz + gap), cy = y0 + Math.floor(i / cols) * (sz + gap);
      M06.el('rect', { x: cx, y: cy, width: sz, height: sz, rx: 3, fill: treated[i] ? col.red : col.light, 'fill-opacity': treated[i] ? 0.9 : 1 }, svg);
    }
    var ly = y0 + rows * (sz + gap) + 26;
    M06.el('rect', { x: x0, y: ly - 13, width: 15, height: 15, rx: 3, fill: col.red, 'fill-opacity': 0.9 }, svg);
    M06.text(svg, x0 + 24, ly, '68 areas: Google ads switched off for 60 days', { size: 16, fill: col.red, weight: 600 });
    M06.el('rect', { x: x0 + 460, y: ly - 13, width: 15, height: 15, rx: 3, fill: col.light }, svg);
    M06.text(svg, x0 + 484, ly, '142 areas: ads continue', { size: 16, fill: col.axis, weight: 600 });
    M06.text(svg, 900, 24, 'Randomized draw, balanced on past sales', { size: 15, fill: col.grey, anchor: 'end' });
  };

  // =================================================================================
  // 3 · randomize
  // =================================================================================
  // The meeting 7 population: 10,000 customers with a latent renewal
  // propensity z ~ N(0, 1) and renewal probability p0 = logistic(0.3 + 1.4 z)
  // without the email. The email adds 2 points. Each sample draws 2,000
  // customers at random and emails 30% of them: the 600 with the highest
  // score (the score is z itself, as at full targeting in meeting 7), or 600
  // chosen at random. Outcomes are Bernoulli draws. The estimate is the
  // difference in renewal rates, in percentage points.
  var RND = { n: 10000, m: 2000, share: 0.3, effect: 0.02, seed: 8201 };
  S.randomize = (function () {
    var r = M06.rng(RND.seed), z = new Array(RND.n), p0 = new Array(RND.n), i;
    for (i = 0; i < RND.n; i++) { z[i] = r.normal(); p0[i] = logistic(0.3 + 1.4 * z[i]); }
    var k = Math.round(RND.share * RND.m);
    return {
      z: z, p0: p0, k: k,
      sim: function (mode, seed) {
        var rr = M06.rng(seed == null ? RND.seed + 1 : seed);
        return {
          next: function () {
            var idx = new Array(RND.m), j;
            for (j = 0; j < RND.m; j++) idx[j] = rr.int(RND.n);
            if (mode === 'targeted') idx.sort(function (a, b) { return z[b] - z[a]; }); else rr.shuffle(idx);
            var sT = 0, sC = 0;
            for (j = 0; j < RND.m; j++) {
              var p = p0[idx[j]] + (j < k ? RND.effect : 0);
              if (rr() < p) { if (j < k) sT++; else sC++; }
            }
            var yT = sT / k, yC = sC / (RND.m - k);
            return { b: 100 * (yT - yC), yT: yT, yC: yC, se: 100 * Math.sqrt(yT * (1 - yT) / k + yC * (1 - yC) / (RND.m - k)) };
          }
        };
      },
      run: function (mode, K, seed) {
        var s = S.randomize.sim(mode, seed), b = [], se = [];
        for (var j = 0; j < K; j++) { var e = s.next(); b.push(e.b); se.push(e.se); }
        return { mean: M06.mean(b), sd: M06.sd(b), meanSE: M06.mean(se) };
      }
    };
  })();

  M06.demos.randomize = function (root, opts) {
    var seed = intOpt(opts.seed, RND.seed + 1), K = 1000;
    var svg = M06.svg(root, 960, 380, 'Renewal rates of emailed and not-emailed customers in one sample, and the estimated effect ' +
      'of the email across repeated samples, with the email sent to the top scores or at random');
    // Left: the last sample's two bars.
    var B = 300, T = 50, sy = M06.scale(0, 1, B, T), X0 = 90;
    heading(svg, X0, 22, 'One sample of 2,000 customers', null);
    M06.axisY(svg, sy, X0, [0, 0.25, 0.5, 0.75, 1], function (v) { return pct(v); }, { title: 'Renewal rate' });
    M06.el('line', { x1: X0, x2: 440, y1: B, y2: B, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    var bx = [{ x: 150, label: 'Emailed (600)' }, { x: 300, label: 'Not emailed (1,400)' }], W = 100;
    bx.forEach(function (b) { M06.text(svg, b.x + W / 2, B + 26, b.label, { size: 15, anchor: 'middle' }); });
    var barT = M06.el('rect', { x: bx[0].x, width: W, fill: col.red, 'fill-opacity': 0.85, visibility: 'hidden' }, svg);
    var barC = M06.el('rect', { x: bx[1].x, width: W, fill: col.mid, 'fill-opacity': 0.8, visibility: 'hidden' }, svg);
    var vT = M06.text(svg, bx[0].x + W / 2, 0, '', { size: 17, anchor: 'middle', weight: 700, fill: col.red });
    var vC = M06.text(svg, bx[1].x + W / 2, 0, '', { size: 17, anchor: 'middle', weight: 700 });
    var vD = M06.text(svg, 265, 362, '', { size: 16, anchor: 'middle', fill: col.ink, weight: 600 });

    // Right: estimates across samples.
    var P0 = 540, P1 = 930, lo = -10, hi = 55, NB = 65, PB = 300, HT = 200, sxB = M06.scale(lo, hi, P0, P1);
    heading(svg, P0, 22, 'Estimates across repeated samples', null);
    var hB = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.axis);
    M06.axisX(svg, sxB, PB, [-10, 0, 10, 20, 30, 40, 50], function (v) { return v < 0 ? MINUS + num0(-v) : num0(v); },
      { title: 'Estimated effect of the email (percentage points)' });
    M06.vline(svg, r1(sxB(100 * RND.effect)), 62, PB, { color: col.red, label: 'true effect 2.0', anchor: 'start', dy: 0 });
    var mLab = M06.text(svg, P1, 62, '', { size: 15, fill: col.ink, anchor: 'end', weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), mode = 'random', sim, est, maxC;
    M06.toggle(bar, ['Randomized', 'Targeted'], ['random', 'targeted'], mode, function (m) { if (m === mode) return; mode = m; reset(); });
    function showSample(e) {
      show(barT, true); show(barC, true);
      attrs(barT, { y: r1(sy(e.yT)), height: r1(B - sy(e.yT)) });
      attrs(barC, { y: r1(sy(e.yC)), height: r1(B - sy(e.yC)) });
      attrs(vT, { y: r1(sy(e.yT) - 8) }); vT.textContent = pct(e.yT, 1);
      attrs(vC, { y: r1(sy(e.yC) - 8) }); vC.textContent = pct(e.yC, 1);
      vD.textContent = 'This sample: ' + signed(e.b, 1) + ' points (SE ' + num(e.se, 1) + ')';
    }
    function render() {
      maxC = Math.max(maxC, tallest(hB.bins));
      hB.render(maxC);
      mLab.textContent = est.length >= 2 ? 'mean ' + num(M06.mean(est), 1) + ' · SD ' + num(M06.sd(est), 1) : '';
    }
    function update() {
      out.innerHTML = 'Samples: ' + num(est.length) + SEP + (mode === 'random' ? '600 emailed at random' : 'The 600 highest scores emailed') +
        SEP + 'True effect: ' + bold('+2.0 points') + (est.length >= 2 ? SEP + 'Mean estimate: ' + bold(signed(M06.mean(est), 1)) : '');
    }
    function one() {
      run.finish();
      var e = sim.next();
      showSample(e); est.push(e.b); hB.add(e.b); render(); update();
    }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = hB.bins.slice();
      batch.forEach(function (e) { var k = binOf(e.b, lo, hi, NB); if (k >= 0) fb[k]++; });
      maxC = Math.max(maxC, tallest(fb));
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) { var e = batch[done++]; est.push(e.b); hB.add(e.b); }
        render(); update();
      }, function () {
        while (done < K) { var e = batch[done++]; est.push(e.b); hB.add(e.b); }
        showSample(batch[K - 1]); render(); update();
      });
    }
    function reset() {
      run.cancel();
      sim = S.randomize.sim(mode, seed); est = []; maxC = 8;
      hB.clear(); show(barT, false); show(barC, false); vT.textContent = ''; vC.textContent = ''; vD.textContent = '';
      render(); update();
    }
    M06.button(bar, 'Draw one sample', one);
    M06.button(bar, 'Draw 1,000 samples', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // =================================================================================
  // 4 · arms
  // =================================================================================
  // A store splits 10,000 visitors equally across k checkout pages, one of
  // them the old page (the control). The old page sells to 5% of visitors
  // and one new page truly sells to 6%: a lift of 1 percentage point. Each
  // simulated test compares that new page with the old page. The estimated
  // lift is 1 + SE·z with one fixed standard-normal z per test, so moving
  // the slider rescales the same 1,000 tests, as in meeting 7's power demo.
  // SE = 100·√((0.05·0.95 + 0.06·0.94)/n), n visitors per arm. A test is
  // significant when |estimate| > 1.96·SE. Power is the share significant.
  // The minimum detectable effect is 2.8·SE: the true lift a test finds 80%
  // of the time at the 5% level.
  var ARM = { N: 10000, p0: 0.05, p1: 0.06, kMin: 2, kMax: 10, start: 2, K: 1000, seed: 8301 };
  S.arms = (function () {
    var r = M06.rng(ARM.seed), z = [];
    for (var i = 0; i < ARM.K; i++) z.push(r.normal());
    var theta = 100 * (ARM.p1 - ARM.p0);
    function se(n) { return 100 * Math.sqrt((ARM.p0 * (1 - ARM.p0) + ARM.p1 * (1 - ARM.p1)) / n); }
    return {
      z: z, theta: theta,
      at: function (k, N) {
        N = N || ARM.N;
        var n = N / k, s = se(n), est = z.map(function (v) { return theta + s * v; }), sig = 0;
        est.forEach(function (e) { if (Math.abs(e) > 1.96 * s) sig++; });
        return { k: k, n: n, se: s, crit: 1.96 * s, mde: 2.8 * s, est: est, sig: sig, power: sig / ARM.K };
      }
    };
  })();

  M06.demos.arms = function (root) {
    var svg = M06.svg(root, 960, 330, 'Estimated lifts from 1,000 simulated checkout tests with a true lift of 1 point, ' +
      'with the significant ones highlighted, as the 10,000 visitors are split across more pages');
    var X0 = 60, X1 = 620, lo = -3, hi = 5, NB = 64, BW = (hi - lo) / NB, B = 270, HT = 200, sx = M06.scale(lo, hi, X0, X1);
    heading(svg, X0, 20, '1,000 simulated tests of the new page against the old page', null);
    var barsG = M06.g(svg);
    M06.axisX(svg, sx, B, ticks(lo, hi, 1), function (v) { return v < 0 ? MINUS + num0(-v) : (v > 0 ? '+' : '') + num0(v); },
      { title: 'Estimated lift in the purchase rate (percentage points)' });
    var thrL = M06.el('line', { y1: 108, y2: B, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, svg);
    var thrR = M06.el('line', { y1: 108, y2: B, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, svg);
    var thrLab = M06.text(svg, X0, 44, '', { size: 14, fill: col.ink });
    M06.vline(svg, r1(sx(1)), 72, B, { color: col.red, label: 'true lift 1 point', anchor: 'end', dy: 0, size: 15 });
    var mdeL = M06.el('line', { y1: 100, y2: B, stroke: col.blue, 'stroke-width': 2, 'stroke-dasharray': '2 3' }, svg);
    var mdeLab = M06.text(svg, 0, 96, '', { size: 14, fill: col.blue, weight: 700 });
    // Legend.
    M06.el('rect', { x: 670, y: 286, width: 13, height: 13, fill: col.blue, 'fill-opacity': 0.85 }, svg);
    M06.text(svg, 689, 297, 'significant at 5%', { size: 14, fill: col.ink });
    M06.el('rect', { x: 670, y: 308, width: 13, height: 13, fill: col.mid, 'fill-opacity': 0.75 }, svg);
    M06.text(svg, 689, 319, 'not significant', { size: 14, fill: col.ink });

    var R0 = 670, rows = [
      ['Pages tested, including the old one', col.ink], ['Visitors per page', col.ink], ['Standard error of the lift', col.ink],
      ['Power: tests that find the 1-point lift', col.blue], ['Minimum detectable effect', col.blue]
    ];
    var vals = rows.map(function (rw, i) {
      M06.text(svg, R0, 30 + i * 52, rw[0], { size: 14.5, fill: col.grey });
      return M06.text(svg, R0, 53 + i * 52, '', { size: 20, fill: rw[1], weight: 700 });
    });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), k = ARM.start, shown = 0;
    var sl = M06.slider(bar, 'Pages tested', ARM.kMin, ARM.kMax, 1, k, function (v) { run.cancel(); k = v; draw(shown ? ARM.K : 0); });
    function draw(m) {
      var d = S.arms.at(k), cS = new Array(NB).fill(0), cN = new Array(NB).fill(0), sigSoFar = 0, j;
      for (j = 0; j < m; j++) {
        var e = d.est[j], b = binOf(e, lo, hi, NB), sig = Math.abs(e) > d.crit;
        if (sig) sigSoFar++;
        if (b < 0) continue;
        if (sig) cS[b]++; else cN[b]++;
      }
      var full = S.arms.at(ARM.kMin), mx = 0, fb = new Array(NB).fill(0);
      full.est.forEach(function (e) { var b = binOf(e, lo, hi, NB); if (b >= 0) fb[b]++; });
      mx = Math.max.apply(null, fb);
      clear(barsG);
      for (j = 0; j < NB; j++) {
        var x0 = sx(lo + j * BW) + 0.5, w = Math.max(0.5, sx(lo + (j + 1) * BW) - sx(lo + j * BW) - 1);
        var hN = cN[j] / mx * HT, hS = cS[j] / mx * HT;
        if (hN > 0) M06.el('rect', { x: r1(x0), width: r1(w), y: r1(B - hN), height: r1(hN), fill: col.mid, 'fill-opacity': 0.75 }, barsG);
        if (hS > 0) M06.el('rect', { x: r1(x0), width: r1(w), y: r1(B - hN - hS), height: r1(hS), fill: col.blue, 'fill-opacity': 0.85 }, barsG);
      }
      attrs(thrL, { x1: r1(sx(Math.max(lo, -d.crit))), x2: r1(sx(Math.max(lo, -d.crit))) });
      attrs(thrR, { x1: r1(sx(Math.min(hi, d.crit))), x2: r1(sx(Math.min(hi, d.crit))) });
      thrLab.textContent = 'Dashed lines: significant beyond ±' + num(d.crit, 2) + ' points';
      var mx2 = sx(Math.min(hi, d.mde));
      attrs(mdeL, { x1: r1(mx2), x2: r1(mx2) });
      attrs(mdeLab, { x: r1(mx2 + 6) });
      mdeLab.textContent = 'MDE ' + num(d.mde, 1);
      vals[0].textContent = num0(k);
      vals[1].textContent = num0(d.n);
      vals[2].textContent = num(d.se, 2) + ' points';
      vals[3].textContent = m ? pct(sigSoFar / m) + (m < ARM.K ? ' so far' : '') : DASH;
      vals[4].textContent = num(d.mde, 1) + ' points';
      out.innerHTML = 'Old page 5%' + SEP + 'New page truly 6%' + SEP + 'Tests run: ' + num(m) +
        (m ? SEP + 'Significant: ' + bold(num(sigSoFar)) + ' of ' + num(m) : '');
    }
    M06.button(bar, 'Run 1,000 tests', function () {
      run.cancel();
      run.run(2200, function (p) { shown = Math.floor(ARM.K * p); draw(shown); }, function () { shown = ARM.K; draw(ARM.K); });
    });
    M06.button(bar, 'Reset', function () { run.cancel(); shown = 0; sl.value = ARM.start; k = ARM.start; draw(0); });
    draw(0);
  };

  // =================================================================================
  // 5 · balance
  // =================================================================================
  // 1,000 customers, 20 baseline covariates drawn once as independent
  // standard normals, so no covariate truly differs between the arms. Each
  // randomization assigns 500 to the email at random. For each covariate:
  // the difference in means, its standard error, the t statistic and the
  // two-sided p-value. The joint test regresses assignment on all 20 and
  // reports the F statistic with 20 and 979 degrees of freedom.
  var BAL = {
    n: 1000, k: 20, seed: 8401,
    names: ['Age', 'Income', 'Months as customer', 'Spend last year', 'Orders last year', 'Female', 'Urban', 'Uses the app',
      'Opens emails', 'Returns last year', 'Household size', 'Credit score', 'Distance to store', 'Loyalty tier',
      'Coupons redeemed', 'Complaints filed', 'Buys online', 'Came from an ad', 'Days since last order', 'Renewal score']
  };
  S.balance = function (seed) {
    var r = M06.rng(seed == null ? BAL.seed : seed), n = BAL.n, k = BAL.k, X = [], i, j, l;
    for (j = 0; j < k; j++) { var v = new Array(n); for (i = 0; i < n; i++) v[i] = r.normal(); X.push(v); }
    // (X'X)^-1 with a constant, computed once.
    var A = [];
    for (j = 0; j <= k; j++) A.push(new Array(k + 1).fill(0));
    for (i = 0; i < n; i++) {
      for (j = 0; j <= k; j++) {
        var xj = j === 0 ? 1 : X[j - 1][i];
        for (l = j; l <= k; l++) A[j][l] += xj * (l === 0 ? 1 : X[l - 1][i]);
      }
    }
    for (j = 0; j <= k; j++) for (l = 0; l < j; l++) A[j][l] = A[l][j];
    var Ainv = inverse(A), half = n / 2;
    return {
      X: X,
      next: function () {
        var ord = range(n), T = new Array(n).fill(0);
        r.shuffle(ord);
        for (i = 0; i < half; i++) T[ord[i]] = 1;
        var rows = [], nSig = 0, v = new Array(k + 1).fill(0);
        v[0] = half;
        for (j = 0; j < k; j++) {
          var s1 = 0, s0 = 0, q1 = 0, q0 = 0;
          for (i = 0; i < n; i++) {
            var x = X[j][i];
            if (T[i]) { s1 += x; q1 += x * x; v[j + 1] += x; } else { s0 += x; q0 += x * x; }
          }
          var m1 = s1 / half, m0 = s0 / half, var1 = (q1 - half * m1 * m1) / (half - 1), var0 = (q0 - half * m0 * m0) / (half - 1);
          var diff = m1 - m0, se = Math.sqrt(var1 / half + var0 / half), t = diff / se, p = S.pT(t, n - 2);
          if (p < 0.05) nSig++;
          rows.push({ diff: diff, se: se, t: t, p: p });
        }
        // Joint test: R² of T on the 20 covariates.
        var b = new Array(k + 1).fill(0), ess = 0;
        for (j = 0; j <= k; j++) for (l = 0; l <= k; l++) b[j] += Ainv[j][l] * v[l];
        for (j = 0; j <= k; j++) ess += b[j] * v[j];
        ess -= n * 0.25;
        var tss = half - n * 0.25, r2 = ess / tss, F = (r2 / k) / ((1 - r2) / (n - k - 1)), pJ = S.pF(F, k, n - k - 1);
        return { rows: rows, nSig: nSig, F: F, pJ: pJ };
      }
    };
  };
  S.balance.run = function (K, seed) {
    var s = S.balance(seed), any = 0, joint = 0, sum = 0;
    for (var i = 0; i < K; i++) { var e = s.next(); if (e.nSig > 0) any++; if (e.pJ < 0.05) joint++; sum += e.nSig; }
    return { anyStar: any / K, jointReject: joint / K, meanStars: sum / K };
  };

  M06.demos.balance = function (root, opts) {
    var seed = intOpt(opts.seed, BAL.seed), K = 1000, k = BAL.k;
    var svg = M06.svg(root, 960, 400, 'A balance table of 20 baseline covariates for one randomization, with t statistics and stars, ' +
      'and the number of covariates significant at 5% across repeated randomizations');
    var top = 44, pitch = 15, L = 215, R = 470, sxT = M06.scale(-4, 4, L, R);
    heading(svg, 20, 22, 'One randomization: 500 emailed, 500 not', null);
    M06.text(svg, (L + R) / 2, top - 6, 't statistic of the difference in means', { size: 14.5, fill: col.grey, anchor: 'middle' });
    M06.text(svg, R + 10, top - 6, '* p < 0.05  ** p < 0.01', { size: 13, fill: col.red });
    M06.el('line', { x1: r1(sxT(0)), x2: r1(sxT(0)), y1: top, y2: top + k * pitch, stroke: col.light, 'stroke-width': 1.5 }, svg);
    [-1.96, 1.96].forEach(function (v) {
      M06.el('line', { x1: r1(sxT(v)), x2: r1(sxT(v)), y1: top, y2: top + k * pitch, stroke: col.red, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'stroke-opacity': 0.7 }, svg);
    });
    M06.axisX(svg, sxT, top + k * pitch + 2, [-4, -2, 0, 2, 4], function (v) { return v < 0 ? MINUS + num0(-v) : num0(v); }, { size: 14 });
    var rows = BAL.names.map(function (name, i) {
      var y = top + i * pitch + pitch / 2;
      var lab = M06.text(svg, L - 12, y + 5, name, { size: 14.5, fill: col.ink, anchor: 'end' });
      var g = M06.g(svg, { visibility: 'hidden' });
      var line = M06.el('line', { y1: y, y2: y, 'stroke-width': 3 }, g);
      var star = M06.text(svg, R + 10, y + 4.5, '', { size: 13, fill: col.red, weight: 700 });
      return { y: y, lab: lab, g: g, line: line, star: star };
    });
    var jointLab = M06.text(svg, 20, top + k * pitch + 46, '', { size: 15, fill: col.ink, weight: 600 });

    // Right: how many stars a randomization produces.
    var P0 = 580, P1 = 930, PB = 290, HT = 180, NB = 9, sxN = M06.scale(-0.5, 8.5, P0, P1);
    heading(svg, P0, 22, 'Across repeated randomizations', null);
    var cnt = new Array(NB).fill(0), rects = [];
    for (var j = 0; j < NB; j++) {
      rects.push(M06.el('rect', { x: r1(sxN(j - 0.4)), width: r1(sxN(j + 0.4) - sxN(j - 0.4)), y: PB, height: 0, fill: col.axis, 'fill-opacity': 0.85 }, svg));
      M06.text(svg, sxN(j), PB + 22, num0(j), { size: 15, fill: col.grey, anchor: 'middle' });
    }
    M06.el('line', { x1: P0, x2: P1, y1: PB, y2: PB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    M06.text(svg, (P0 + P1) / 2, PB + 46, 'Covariates significant at 5% in one randomization', { size: 15, fill: col.grey, anchor: 'middle' });
    var anyLab = M06.text(svg, P0, 364, '', { size: 16, fill: col.red, weight: 600 });
    var jLab = M06.text(svg, P0, 388, '', { size: 16, fill: col.blue, weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), sim, draws, any, joint, cur;
    function showOne(e) {
      cur = e;
      rows.forEach(function (rw, i) {
        var o = e.rows[i], sig = o.p < 0.05;
        attrs(rw.line, { x1: r1(sxT(0)), x2: r1(sxT(clamp(o.t, -4, 4))), stroke: sig ? col.red : col.mid });
        show(rw.g, true);
        rw.star.textContent = o.p < 0.01 ? '**' : sig ? '*' : '';
        rw.lab.setAttribute('fill', sig ? col.red : col.ink);
        rw.lab.setAttribute('font-weight', sig ? 700 : 400);
      });
      jointLab.textContent = 'Joint F test of all 20: F = ' + num(e.F, 2) + ', p = ' + num(e.pJ, 2) + (e.pJ < 0.05 ? ' (rejects)' : ' (does not reject)');
    }
    function render() {
      var m = Math.max(5, tallest(cnt));
      rects.forEach(function (rc, j) { var h = cnt[j] / m * HT; attrs(rc, { y: r1(PB - h), height: r1(h) }); });
      var n = draws;
      anyLab.textContent = n ? 'At least one covariate significant at 5%: ' + pct(any / n) + ' of randomizations' : '';
      jLab.textContent = n ? 'Joint F test rejects at 5%: ' + pct(joint / n) : '';
    }
    function add(e) { draws++; if (e.nSig > 0) any++; if (e.pJ < 0.05) joint++; cnt[Math.min(NB - 1, e.nSig)]++; }
    function update() {
      out.innerHTML = 'Randomizations: ' + num(draws) + SEP + '20 covariates, none truly different' +
        (cur ? SEP + 'Significant at 5% in this one: ' + bold(num0(cur.nSig)) : '');
    }
    function one() { run.finish(); var e = sim.next(); showOne(e); add(e); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      run.run(2000, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < K) add(batch[done++]); showOne(batch[K - 1]); render(); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.balance(seed); draws = 0; any = 0; joint = 0; cur = null; cnt.fill(0);
      rows.forEach(function (rw) { show(rw.g, false); rw.star.textContent = ''; rw.lab.setAttribute('fill', col.ink); rw.lab.setAttribute('font-weight', 400); });
      jointLab.textContent = '';
      render(); update();
    }
    M06.button(bar, 'Randomize once', one);
    M06.button(bar, 'Randomize 1,000 times', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // =================================================================================
  // 6 · iv
  // =================================================================================
  // A bike-rental company's weekly market. Each week the fuel price
  // W ~ N(0, 1), standardized, raises the cost of the vans that move bikes
  // between stations, and so shifts supply in:
  // supply Q = 10 + P − γW + u_s, demand Q = 100 − 2P + δW + u_d, shocks with
  // SD 8. Equilibrium: P = (90 + (γ + δ)W + u_d − u_s)/3 and
  // Q = 10 + P − γW + u_s. γ is the instrument's strength. δ = 0 keeps the
  // exclusion restriction (fuel moves supply only); δ = 4 breaks it: dear
  // fuel also sends commuters to rented bikes and raises demand. The first stage
  // then gets stronger while the IV estimate converges to
  // (δ − 2γ)/(γ + δ) = −1 at γ = 8. High-fuel weeks (W > 0) are drawn red.
  // A sample is 100 weeks. OLS: Q on P. IV: the reduced form (Q on W)
  // divided by the first stage (P on W). The first-stage F is the squared t
  // of the first-stage slope.
  var IV = { ad: 100, bd: 2, as: 10, bs: 1, sd: 8, n: 100, gamma: 8, delta: 4, seed: 8501 };
  S.iv = function (gamma, delta, seed) {
    var r = M06.rng(seed == null ? IV.seed : seed);
    return {
      next: function () {
        var P = [], Q = [], W = [], i;
        for (i = 0; i < IV.n; i++) {
          var w = r.normal(), ud = IV.sd * r.normal(), us = IV.sd * r.normal();
          var p = (IV.ad - IV.as + (gamma + delta) * w + ud - us) / (IV.bd + IV.bs);
          W.push(w); P.push(p); Q.push(IV.as + IV.bs * p - gamma * w + us);
        }
        var o = fit1(P, Q), fs = fit1(W, P), rf = fit1(W, Q);
        var iv = rf.slope / fs.slope, F = (fs.slope / fs.se) * (fs.slope / fs.se);
        return { P: P, Q: Q, W: W, ols: o.slope, olsA: o.intercept, iv: iv, ivA: M06.mean(Q) - iv * M06.mean(P), F: F, fs: fs.slope };
      }
    };
  };
  S.iv.run = function (gamma, delta, K, seed) {
    var s = S.iv(gamma, delta, seed), ols = [], iv = [], F = [];
    for (var i = 0; i < K; i++) { var e = s.next(); ols.push(e.ols); iv.push(e.iv); F.push(e.F); }
    return { olsMean: M06.mean(ols), olsSD: M06.sd(ols), ivMedian: M06.median(iv), ivQ25: M06.quantile(iv, 0.25), ivQ75: M06.quantile(iv, 0.75),
      ivMean: M06.mean(iv), ivSD: M06.sd(iv), Fmean: M06.mean(F), Fmedian: M06.median(F), weakShare: F.filter(function (f) { return f < 10; }).length / K };
  };

  M06.demos.iv = function (root, opts) {
    var seed = intOpt(opts.seed, IV.seed), K = 1000;
    var svg = M06.svg(root, 960, 400, 'Weekly prices and quantities in one sample, with the true demand curve, the OLS line and the IV line, ' +
      'and the OLS and IV estimates of the demand slope across repeated samples');
    var defs = M06.el('defs', null, svg);
    var X0 = 80, X1 = 500, YT = 44, YB = 300, sxQ = M06.scale(10, 70, X0, X1), syP = M06.scale(10, 50, YB, YT);
    heading(svg, X0, 22, 'One sample of 100 weeks', null);
    M06.axisY(svg, syP, X0, ticks(10, 50, 10), function (v) { return '$' + num0(v); }, { title: 'Price per rental' });
    M06.axisX(svg, sxQ, YB, ticks(10, 70, 10), num0, { title: 'Bike rentals per week' });
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    function curve(el, a, b) { attrs(el, { x1: r1(sxQ(a + b * 10)), y1: r1(syP(10)), x2: r1(sxQ(a + b * 50)), y2: r1(syP(50)) }); }
    var dTrue = M06.el('line', { stroke: col.red, 'stroke-width': 3 }, plot);
    curve(dTrue, IV.ad, -IV.bd);
    var ptsG = M06.g(plot);
    var olsL = M06.el('line', { stroke: col.ink, 'stroke-width': 3, 'stroke-dasharray': '9 6', visibility: 'hidden' }, plot);
    var ivL = M06.el('line', { stroke: col.blue, 'stroke-width': 3, 'stroke-dasharray': '9 6', visibility: 'hidden' }, plot);
    M06.text(svg, sxQ(IV.ad - IV.bd * 14) + 6, syP(14) + 5, 'true demand', { size: 15, fill: col.red, weight: 700 });
    var legY = YT - 6;
    M06.el('circle', { cx: X1 - 262, cy: legY - 4, r: 4, fill: col.red, 'fill-opacity': 0.6 }, svg);
    M06.text(svg, X1 - 254, legY, 'expensive-fuel weeks', { size: 13.5, fill: col.grey });
    M06.el('circle', { cx: X1 - 106, cy: legY - 4, r: 4, fill: col.blue, 'fill-opacity': 0.6 }, svg);
    M06.text(svg, X1 - 98, legY, 'cheap-fuel weeks', { size: 13.5, fill: col.grey });
    var sampleLab = M06.text(svg, X0, 372, '', { size: 15, fill: col.ink });

    // Right: two rows of estimates.
    var P0 = 580, P1 = 930, lo = -6, hi = 2, NB = 64, sx = M06.scale(lo, hi, P0, P1), rowH = 120, base0 = 160, HT = 80;
    heading(svg, P0, 22, 'Estimates across repeated samples', null);
    var specs = [{ label: 'OLS: regression of quantity on price', color: col.ink }, { label: 'IV: fuel price as the instrument', color: col.blue }];
    var rows = specs.map(function (sp, j) {
      var y0 = base0 + j * rowH;
      M06.text(svg, P0, y0 - HT - 8, sp.label, { size: 15.5, weight: 700, fill: sp.color });
      M06.el('line', { x1: P0, x2: P1, y1: y0, y2: y0, stroke: col.light, 'stroke-width': 1.5 }, svg);
      var h = stepHist(svg, sx, y0, HT, lo, hi, NB, sp.color);
      var stat = M06.text(svg, P1, y0 - HT - 8, '', { size: 13.5, fill: sp.color, anchor: 'end', weight: 600 });
      var stat2 = M06.text(svg, P1, y0 - HT + 9, '', { size: 13.5, fill: sp.color, anchor: 'end', weight: 600 });
      return { h: h, stat: stat, stat2: stat2, est: [] };
    });
    var AX = base0 + rowH + 4;
    M06.axisX(svg, sx, AX, ticks(-6, 2, 2), function (v) { return v < 0 ? MINUS + num0(-v) : num0(v); }, { title: 'Estimated slope of the demand curve' });
    M06.vline(svg, r1(sx(-IV.bd)), 48, AX, { color: col.red, label: 'true slope −2', anchor: 'middle', dy: 2 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), gamma = IV.gamma, delta = 0, sim, Fs, maxC;
    M06.toggle(bar, ['Supply only', 'Also raises demand'], [0, IV.delta], 0, function (v) { if (v === delta) return; delta = v; reset(); });
    var sl = M06.slider(bar, 'Fuel effect', 0.5, 10, 0.5, gamma, function (v) { gamma = v; reset(); });
    function showSample(e) {
      clear(ptsG);
      for (var i = 0; i < e.P.length; i++) {
        M06.el('circle', { cx: r1(sxQ(e.Q[i])), cy: r1(syP(e.P[i])), r: 4, fill: e.W[i] > 0 ? col.red : col.blue, 'fill-opacity': 0.55, stroke: '#fff', 'stroke-width': 0.6 }, ptsG);
      }
      show(olsL, true); show(ivL, true);
      curve(olsL, e.olsA, e.ols); curve(ivL, e.ivA, e.iv);
      sampleLab.textContent = 'This sample: OLS ' + num(e.ols, 2) + ' · IV ' + num(e.iv, 2) + ' · first-stage F ' + num(e.F, 1);
    }
    function render() {
      rows.forEach(function (rw) { maxC = Math.max(maxC, tallest(rw.h.bins)); });
      rows.forEach(function (rw, j) {
        rw.h.render(maxC);
        if (rw.est.length < 2) { rw.stat.textContent = ''; rw.stat2.textContent = ''; return; }
        if (j === 0) { rw.stat.textContent = 'mean ' + num(M06.mean(rw.est), 2); rw.stat2.textContent = 'SD ' + num(M06.sd(rw.est), 2); }
        else {
          rw.stat.textContent = 'median ' + num(M06.median(rw.est), 2);
          rw.stat2.textContent = 'middle half ' + num(M06.quantile(rw.est, 0.25), 2) + ' to ' + num(M06.quantile(rw.est, 0.75), 2);
        }
      });
    }
    function add(e) { rows[0].est.push(e.ols); rows[1].est.push(e.iv); rows[0].h.add(e.ols); rows[1].h.add(e.iv); Fs.push(e.F); }
    function update() {
      var n = Fs.length;
      out.innerHTML = 'Samples: ' + num(n) + SEP + 'Fuel shifts supply by ' + bold(num(gamma, 1)) + ' rentals' +
        (delta ? SEP + 'Fuel also raises demand by ' + bold(num(delta, 0)) + ' rentals' : '') +
        (n ? SEP + 'Mean first-stage F: ' + bold(num(M06.mean(Fs), 1)) : '');
    }
    function one() { run.finish(); var e = sim.next(); showSample(e); add(e); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = rows.map(function (rw) { return rw.h.bins.slice(); });
      batch.forEach(function (e) {
        var k0 = binOf(e.ols, lo, hi, NB), k1 = binOf(e.iv, lo, hi, NB);
        if (k0 >= 0) fb[0][k0]++; if (k1 >= 0) fb[1][k1]++;
      });
      fb.forEach(function (f) { maxC = Math.max(maxC, tallest(f)); });
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < K) add(batch[done++]); showSample(batch[K - 1]); render(); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.iv(gamma, delta, seed); Fs = []; maxC = 6;
      rows.forEach(function (rw) { rw.est = []; rw.h.clear(); });
      clear(ptsG); show(olsL, false); show(ivL, false); sampleLab.textContent = '';
      render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 1,000', many);
    M06.button(bar, 'Reset', function () { sl.value = IV.gamma; gamma = IV.gamma; reset(); });
    reset();
  };

  // =================================================================================
  // 6b · weakiv
  // =================================================================================
  // The weak-instrument demo. The same bike-rental market as iv, except
  // that demand shocks (SD 12) are larger than supply shocks (SD 4), so the
  // price is strongly correlated with the demand shock and OLS lands near
  // the supply slope (+0.7). Strength γ sets how far fuel shifts supply.
  // Each sample is 100 weeks. For each: the first stage (price on fuel),
  // its F, the IV slope (reduced form over first stage), the usual 2SLS
  // standard error with homoskedastic errors, and whether the usual 95%
  // interval misses the true slope −2. Four strengths: 8, 4, 2, 1.
  var WIV = { n: 100, sdD: 12, sdS: 4, seed: 8801, lo: -8, hi: 4,
    levels: [{ label: 'Strong', g: 8 }, { label: 'Moderate', g: 4 }, { label: 'Weak', g: 2 }, { label: 'Very weak', g: 1 }] };
  S.weakiv = function (g, seed) {
    var r = M06.rng(seed == null ? WIV.seed : seed);
    return {
      next: function () {
        var n = WIV.n, W = [], P = [], Q = [], i;
        for (i = 0; i < n; i++) {
          var w = r.normal(), ud = WIV.sdD * r.normal(), us = WIV.sdS * r.normal();
          var p = (IV.ad - IV.as + g * w + ud - us) / (IV.bd + IV.bs);
          W.push(w); P.push(p); Q.push(IV.as + IV.bs * p - g * w + us);
        }
        var mw = M06.mean(W), mp = M06.mean(P), mq = M06.mean(Q), swp = 0, sww = 0, swq = 0, spp = 0, spq = 0;
        for (i = 0; i < n; i++) {
          swp += (W[i] - mw) * (P[i] - mp); sww += (W[i] - mw) * (W[i] - mw); swq += (W[i] - mw) * (Q[i] - mq);
          spp += (P[i] - mp) * (P[i] - mp); spq += (P[i] - mp) * (Q[i] - mq);
        }
        var fs = swp / sww, fsA = mp - fs * mw, ssv = 0, b = swq / swp, a = mq - b * mp, ssu = 0;
        for (i = 0; i < n; i++) {
          var v = P[i] - fsA - fs * W[i]; ssv += v * v;
          var u = Q[i] - a - b * P[i]; ssu += u * u;
        }
        var F = fs * fs * sww / (ssv / (n - 2)), se = Math.sqrt(ssu / (n - 2) * sww) / Math.abs(swp);
        return { W: W, P: P, fs: fs, fsA: fsA, F: F, iv: b, se: se, ols: spq / spp, miss: Math.abs((b + 2) / se) > 1.96 };
      }
    };
  };
  S.weakiv.run = function (g, K, seed) {
    var s = S.weakiv(g, seed), ivs = [], Fs = [], ols = [], miss = 0;
    for (var k = 0; k < K; k++) { var e = s.next(); ivs.push(e.iv); Fs.push(e.F); ols.push(e.ols); if (e.miss) miss++; }
    return { F: M06.mean(Fs), median: M06.median(ivs), q25: M06.quantile(ivs, 0.25), q75: M06.quantile(ivs, 0.75),
      ols: M06.mean(ols), miss: miss / K, below: ivs.filter(function (x) { return x < WIV.lo; }).length,
      above: ivs.filter(function (x) { return x > WIV.hi; }).length };
  };

  M06.demos.weakiv = function (root, opts) {
    var seed = intOpt(opts.seed, WIV.seed), K = 1000;
    var svg = M06.svg(root, 960, 330, 'The first stage, fuel price against rental price, in one sample, and the instrumental-variables ' +
      'estimates across repeated samples, as the instrument is made weaker');
    var defs = M06.el('defs', null, svg);
    // Left: the first stage.
    var X0 = 75, X1 = 360, YT = 44, YB = 262, sx = M06.scale(-3, 3, X0, X1), sy = M06.scale(10, 50, YB, YT);
    heading(svg, X0, 20, 'First stage: one sample of 100 weeks', null);
    M06.axisY(svg, sy, X0, ticks(10, 50, 10), function (v) { return '$' + num0(v); }, { title: 'Price per rental', size: 14 });
    M06.axisX(svg, sx, YB, [-3, -2, -1, 0, 1, 2, 3], function (v) { return v < 0 ? MINUS + num0(-v) : (v > 0 ? '+' : '') + num0(v); },
      { title: 'Fuel price (SDs from average)', size: 14 });
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' }), ptsG = M06.g(plot);
    var fsL = M06.el('line', { stroke: col.blue, 'stroke-width': 3, visibility: 'hidden' }, plot);
    var fLab = M06.text(svg, X1, YT + 4, '', { size: 15, fill: col.blue, weight: 700, anchor: 'end' });

    // Right: IV estimates across samples.
    var P0 = 450, P1 = 930, NB = 60, PB = 262, HT = 138, sxB = M06.scale(WIV.lo, WIV.hi, P0, P1);
    heading(svg, P0, 20, 'IV estimates across repeated samples', null);
    var hB = stepHist(svg, sxB, PB, HT, WIV.lo, WIV.hi, NB, col.blue);
    M06.axisX(svg, sxB, PB, [-8, -6, -4, -2, 0, 2, 4], function (v) { return v < 0 ? MINUS + num0(-v) : (v > 0 ? '+' : '') + num0(v); },
      { title: 'Estimated slope of the demand curve', size: 14 });
    M06.vline(svg, r1(sxB(-2)), 118, PB, { color: col.red, label: 'true slope −2', anchor: 'end', dy: 0, size: 14 });
    var olsL = M06.el('line', { y1: 118, y2: PB, stroke: col.ink, 'stroke-width': 2, 'stroke-dasharray': '6 4', visibility: 'hidden' }, svg);
    var olsLab = M06.text(svg, 0, 112, '', { size: 14, fill: col.ink, weight: 600 });
    var medL = M06.el('line', { y1: 124, y2: PB, stroke: col.blue, 'stroke-width': 2.5, visibility: 'hidden' }, svg);
    var tailLab = M06.text(svg, P1, 48, '', { size: 13, fill: col.grey, anchor: 'end' });
    var st = [
      M06.text(svg, P0, 48, '', { size: 15, fill: col.ink, weight: 600 }),
      M06.text(svg, P0, 68, '', { size: 15, fill: col.blue, weight: 600 }),
      M06.text(svg, P0, 88, '', { size: 15, fill: col.red, weight: 600 })
    ];

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), lev = 0, sim, ivs, Fs, ols, miss, below, above, maxC;
    M06.toggle(bar, WIV.levels.map(function (l) { return l.label; }), [0, 1, 2, 3], 0, function (v) { if (v === lev) return; lev = v; reset(); });
    function showSample(e) {
      clear(ptsG);
      for (var i = 0; i < e.W.length; i++) {
        M06.el('circle', { cx: r1(sx(clamp(e.W[i], -3, 3))), cy: r1(sy(clamp(e.P[i], 10, 50))), r: 3.6, fill: col.mid, 'fill-opacity': 0.6, stroke: col.axis, 'stroke-width': 0.6 }, ptsG);
      }
      show(fsL, true);
      attrs(fsL, { x1: sx(-3), x2: sx(3), y1: r1(sy(e.fsA - 3 * e.fs)), y2: r1(sy(e.fsA + 3 * e.fs)) });
      fLab.textContent = 'first-stage F ' + num(e.F, 1);
    }
    function render() {
      maxC = Math.max(maxC, tallest(hB.bins)); hB.render(maxC);
      var n = ivs.length;
      if (n < 2) { show(olsL, false); show(medL, false); olsLab.textContent = ''; st.forEach(function (t) { t.textContent = ''; }); tailLab.textContent = ''; return; }
      var med = M06.median(ivs), om = M06.mean(ols);
      show(medL, true); attrs(medL, { x1: r1(sxB(clamp(med, WIV.lo, WIV.hi))), x2: r1(sxB(clamp(med, WIV.lo, WIV.hi))) });
      show(olsL, true); attrs(olsL, { x1: r1(sxB(om)), x2: r1(sxB(om)) });
      attrs(olsLab, { x: r1(sxB(om) + 6) }); olsLab.textContent = 'OLS ' + signed(om, 1);
      st[0].textContent = 'Mean first-stage F: ' + num(M06.mean(Fs), 1);
      st[1].textContent = 'Median IV estimate: ' + num(med, 2);
      st[2].textContent = 'Usual 95% interval misses −2: ' + pct(miss / n, 1);
      tailLab.textContent = (below || above) ? 'Off the axis: ' + num(below) + ' below −8, ' + num(above) + ' above +4' : '';
    }
    function add(e) { ivs.push(e.iv); Fs.push(e.F); ols.push(e.ols); if (e.miss) miss++; if (e.iv < WIV.lo) below++; if (e.iv > WIV.hi) above++; hB.add(e.iv); }
    function update() {
      out.innerHTML = 'Instrument: ' + bold(WIV.levels[lev].label.toLowerCase()) + ' (fuel shifts supply by ' + num0(WIV.levels[lev].g) + (WIV.levels[lev].g === 1 ? ' rental)' : ' rentals)') +
        SEP + 'Samples: ' + num(ivs.length);
    }
    function one() { run.finish(); var e = sim.next(); showSample(e); add(e); render(); update(); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = hB.bins.slice();
      batch.forEach(function (e) { var k = binOf(e.iv, WIV.lo, WIV.hi, NB); if (k >= 0) fb[k]++; });
      maxC = Math.max(maxC, tallest(fb));
      run.run(2000, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < K) add(batch[done++]); showSample(batch[K - 1]); render(); update(); });
    }
    function reset() {
      run.cancel();
      sim = S.weakiv(WIV.levels[lev].g, seed); ivs = []; Fs = []; ols = []; miss = 0; below = 0; above = 0; maxC = 6;
      hB.clear(); clear(ptsG); show(fsL, false); fLab.textContent = '';
      render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 1,000', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // =================================================================================
  // 7 · rd
  // =================================================================================
  // The email goes to every customer whose renewal score is at or above the
  // cutoff c, the 70th percentile of a standard normal (0.524). Each sample
  // is n customers with score z ~ N(0, 1), an unobserved v ~ N(0, 1), and
  // renewal probability logistic(0.3 + 1.4 z + 0.5 v) + 0.02 if emailed.
  // The estimate is the jump at c between two local linear fits within a
  // bandwidth h: renewal on (score − c) for c − h ≤ score < c and for
  // c ≤ score ≤ c + h. Under manipulation, reps push customers in the band
  // of width 0.45 just below the cutoff whose v is positive (the half they
  // expect to renew) up by 0.45, so the reported score lands just above
  // the cutoff: the density drops to about a third just below the cutoff
  // and triples just above it.
  var RD = { n: 20000, c: 0.5244, effect: 0.02, h: 0.5, seed: 8601, band: 0.45, vcut: 0, vcoef: 0.5, lo: -2.5, hi: 3.5, bw: 0.15 };
  S.rd = function (manip, seed) {
    var r = M06.rng(seed == null ? RD.seed : seed);
    return {
      next: function () {
        var n = RD.n, s = new Float64Array(n), y = new Uint8Array(n), i;
        for (i = 0; i < n; i++) {
          var z = r.normal(), v = r.normal(), p0 = logistic(0.3 + 1.4 * z + RD.vcoef * v), sc = z;
          if (manip && z >= RD.c - RD.band && z < RD.c && v > RD.vcut) sc = z + RD.band;
          var T = sc >= RD.c, p = p0 + (T ? RD.effect : 0);
          s[i] = sc; y[i] = r() < p ? 1 : 0;
        }
        return { s: s, y: y };
      }
    };
  };
  // Local linear fits on each side of the cutoff within bandwidth h.
  S.rd.fit = function (sample, h) {
    var s = sample.s, y = sample.y, c = RD.c, n = s.length, i;
    var xl = [], yl = [], xr = [], yr = [];
    for (i = 0; i < n; i++) {
      var d = s[i] - c;
      if (d >= -h && d < 0) { xl.push(d); yl.push(y[i]); } else if (d >= 0 && d <= h) { xr.push(d); yr.push(y[i]); }
    }
    var fl = fit1(xl, yl), fr = fit1(xr, yr);
    return { est: 100 * (fr.intercept - fl.intercept), se: 100 * Math.sqrt(fl.seA * fl.seA + fr.seA * fr.seA),
      left: fl, right: fr, nL: xl.length, nR: xr.length };
  };
  // Bins aligned on the cutoff: mean renewal and count per bin.
  S.rd.bins = function (sample) {
    var s = sample.s, y = sample.y, c = RD.c, bw = RD.bw, k0 = Math.ceil((RD.lo - c) / bw), k1 = Math.floor((RD.hi - c) / bw), nb = k1 - k0;
    var sum = new Array(nb).fill(0), cnt = new Array(nb).fill(0), i;
    for (i = 0; i < s.length; i++) {
      var k = Math.floor((s[i] - c) / bw) - k0;
      if (k < 0 || k >= nb) continue;
      sum[k] += y[i]; cnt[k]++;
    }
    var out = [];
    for (var j = 0; j < nb; j++) out.push({ x: c + (k0 + j + 0.5) * bw, lo: c + (k0 + j) * bw, mean: cnt[j] ? sum[j] / cnt[j] : null, n: cnt[j] });
    return out;
  };
  // The expected renewal rate without manipulation at score z, averaging
  // over v by Gauss-Hermite quadrature (20 nodes).
  S.rd.truth = (function () {
    var GH = [[-5.3874808900112, 2.2293936455342e-13], [-4.6036824495507, 4.3993409922732e-10], [-3.9447640401156, 1.0860693707693e-7],
      [-3.3478545673832, 7.8025564785321e-6], [-2.7888060584281, 2.2833863601635e-4], [-2.2549740020893, 3.2437733422379e-3],
      [-1.7385377121166, 2.4810520887464e-2], [-1.2340762153953, 1.0901720602002e-1], [-0.73747372854539, 2.8667550536283e-1],
      [-0.24534070830090, 4.6224366960061e-1]];
    var nodes = [];
    GH.forEach(function (p) { nodes.push([p[0], p[1]]); nodes.push([-p[0], p[1]]); });
    return function (z) {
      var s = 0;
      nodes.forEach(function (p) { s += p[1] * logistic(0.3 + 1.4 * z + RD.vcoef * Math.SQRT2 * p[0]); });
      return s / Math.sqrt(Math.PI) + (z >= RD.c ? RD.effect : 0);
    };
  })();
  S.rd.params = RD;
  S.rd.run = function (manip, h, K, seed) {
    var s = S.rd(manip, seed), est = [], se = [], nL = 0, nR = 0;
    for (var i = 0; i < K; i++) { var f = S.rd.fit(s.next(), h); est.push(f.est); se.push(f.se); nL += f.nL; nR += f.nR; }
    return { mean: M06.mean(est), sd: M06.sd(est), meanSE: M06.mean(se), nL: nL / K, nR: nR / K };
  };

  M06.demos.rd = function (root, opts) {
    var seed = intOpt(opts.seed, RD.seed), K = 500, c = RD.c;
    var svg = M06.svg(root, 960, 410, 'Renewal rates by renewal-score bin with the cutoff, local linear fits on each side and the true curve; ' +
      'the density of the score; and the estimated jump across repeated samples');
    var defs = M06.el('defs', null, svg);
    var X0 = 80, X1 = 540, YT = 44, YB = 230, sx = M06.scale(RD.lo, RD.hi, X0, X1), sy = M06.scale(0, 1, YB, YT);
    heading(svg, X0, 22, 'One sample of ' + num0(RD.n) + ' customers', null);
    M06.axisY(svg, sy, X0, [0, 0.25, 0.5, 0.75, 1], function (v) { return pct(v); }, { title: 'Renewal rate', size: 14 });
    M06.el('line', { x1: X0, x2: X1, y1: YB, y2: YB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT - 10, width: X1 - X0, height: YB - YT + 10 }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    // The true curve, in two pieces.
    function truthPath(a, b) {
      var pts = [];
      for (var k = 0; k <= 60; k++) { var z = a + (b - a) * k / 60; pts.push(r1(sx(z)) + ',' + r1(sy(S.rd.truth(z)))); }
      return pts.join(' ');
    }
    M06.el('polyline', { points: truthPath(RD.lo, c - 1e-6), fill: 'none', stroke: col.red, 'stroke-width': 2.5, 'stroke-opacity': 0.9 }, plot);
    M06.el('polyline', { points: truthPath(c, RD.hi), fill: 'none', stroke: col.red, 'stroke-width': 2.5, 'stroke-opacity': 0.9 }, plot);
    M06.text(svg, sx(RD.hi) - 4, sy(S.rd.truth(RD.hi)) - 10, 'true renewal rate', { size: 13.5, fill: col.red, weight: 700, anchor: 'end' });
    var bandRect = M06.el('rect', { y: YT - 10, height: YB - YT + 10, fill: col.paleblue, 'fill-opacity': 0.5 }, plot);
    var bandLab = M06.text(svg, 0, YB - 8, 'bandwidth', { size: 13, fill: col.blue, anchor: 'middle', weight: 600 });
    var dotsG = M06.g(plot);
    var fitL = M06.el('line', { stroke: col.blue, 'stroke-width': 3, visibility: 'hidden' }, plot);
    var fitR = M06.el('line', { stroke: col.blue, 'stroke-width': 3, visibility: 'hidden' }, plot);
    M06.el('line', { x1: r1(sx(c)), x2: r1(sx(c)), y1: YT - 10, y2: YB, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, svg);
    M06.text(svg, sx(c) + 6, YT + 2, 'cutoff: emailed at or above', { size: 13.5, fill: col.ink });
    var jumpLab = M06.text(svg, X0, 252, '', { size: 15, fill: col.ink });

    // The density of the score.
    var DT = 272, DB = 330, syD = M06.scale(0, 1, DB, DT);
    var densG = M06.g(svg);
    M06.el('line', { x1: X0, x2: X1, y1: DB, y2: DB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    M06.el('line', { x1: r1(sx(c)), x2: r1(sx(c)), y1: DT - 4, y2: DB, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, svg);
    M06.text(svg, X0 - 10, DT + 10, 'Customers', { size: 13, fill: col.grey, anchor: 'end' });
    M06.text(svg, X0 - 10, DT + 26, 'per bin', { size: 13, fill: col.grey, anchor: 'end' });
    M06.axisX(svg, sx, DB, [-2, -1, 0, 1, 2, 3], function (v) { return v < 0 ? MINUS + num0(-v) : num0(v); }, { title: 'Renewal score', size: 14 });

    // Right: estimates across samples.
    var P0 = 620, P1 = 930, lo = -10, hi = 20, NB = 60, PB = 300, HT = 190, sxB = M06.scale(lo, hi, P0, P1);
    heading(svg, P0, 22, 'Estimated jump across samples', null);
    var hB = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.blue);
    M06.axisX(svg, sxB, PB, [-10, 0, 10, 20], function (v) { return v < 0 ? MINUS + num0(-v) : num0(v); }, { title: 'Estimated effect of the email (points)' });
    M06.vline(svg, r1(sxB(100 * RD.effect)), 62, PB, { color: col.red, label: 'true effect 2.0', anchor: 'start', dy: 0 });
    var mLab = M06.text(svg, P1, 44, '', { size: 14, fill: col.ink, anchor: 'end', weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), manip = false, h = RD.h, sim, est, maxC, cur;
    M06.toggle(bar, ['Recorded scores', 'Reps raise favourites'], [false, true], false, function (v) { if (v === manip) return; manip = v; reset(); });
    var sl = M06.slider(bar, 'Bandwidth', 0.1, 1.5, 0.05, h, function (v) { h = v; bandwidthChanged(); });
    var busyUntil = 0;
    function fresh(ev) { return !ev || !(ev.timeStamp < busyUntil); }
    function showSample(sample) {
      cur = sample;
      var bins = S.rd.bins(sample), f = S.rd.fit(sample, h), maxN = 0;
      bins.forEach(function (b) { maxN = Math.max(maxN, b.n); });
      clear(dotsG); clear(densG);
      bins.forEach(function (b) {
        if (b.n >= 30 && b.mean != null) {
          M06.el('circle', { cx: r1(sx(b.x)), cy: r1(sy(b.mean)), r: 4.2, fill: b.lo >= c ? col.red : col.axis, 'fill-opacity': 0.75 }, dotsG);
        }
        var hh = b.n / maxN * (DB - DT);
        M06.el('rect', { x: r1(sx(b.lo)) + 0.5, width: r1(sx(b.lo + RD.bw) - sx(b.lo) - 1), y: r1(DB - hh), height: r1(hh), fill: b.lo >= c ? col.red : col.axis, 'fill-opacity': 0.6 }, densG);
      });
      attrs(bandRect, { x: r1(sx(c - h)), width: r1(sx(c + h) - sx(c - h)) });
      attrs(bandLab, { x: r1(sx(c - h / 2)) });
      show(fitL, true); show(fitR, true);
      attrs(fitL, { x1: r1(sx(c - h)), y1: r1(sy(f.left.intercept - f.left.slope * h)), x2: r1(sx(c)), y2: r1(sy(f.left.intercept)) });
      attrs(fitR, { x1: r1(sx(c)), y1: r1(sy(f.right.intercept)), x2: r1(sx(c + h)), y2: r1(sy(f.right.intercept + f.right.slope * h)) });
      jumpLab.textContent = 'This sample: jump ' + signed(f.est, 1) + ' points (SE ' + num(f.se, 1) + ') · ' + num0(f.nL + f.nR) + ' customers within the bandwidth';
      return f;
    }
    function render() {
      maxC = Math.max(maxC, tallest(hB.bins));
      hB.render(maxC);
      mLab.textContent = est.length >= 2 ? 'mean ' + num(M06.mean(est), 1) + ' · SD ' + num(M06.sd(est), 1) : '';
    }
    function update() {
      out.innerHTML = 'Samples: ' + num(est.length) + SEP + 'Bandwidth ' + bold(num(h, 2)) + ' on each side' +
        (manip ? SEP + bold('Scores manipulated') : SEP + 'Scores as recorded') +
        (est.length >= 2 ? SEP + 'Mean estimate ' + bold(signed(M06.mean(est), 1)) : '');
    }
    function one(ev) {
      if (!fresh(ev)) return;
      run.finish();
      var sample = sim.next(), f = showSample(sample);
      est.push(f.est); hB.add(f.est); render(); update();
    }
    function many(ev) {
      if (!fresh(ev)) return;
      run.finish();
      var batch = [], last = null, done = 0, i;
      for (i = 0; i < K; i++) { last = sim.next(); batch.push(S.rd.fit(last, h).est); }
      var fb = hB.bins.slice();
      batch.forEach(function (b) { var k = binOf(b, lo, hi, NB); if (k >= 0) fb[k]++; });
      maxC = Math.max(maxC, tallest(fb));
      if (G.performance) busyUntil = G.performance.now();
      run.run(2000, function (p) {
        var t = Math.floor(K * p);
        while (done < t) { est.push(batch[done]); hB.add(batch[done]); done++; }
        render(); update();
      }, function () {
        while (done < K) { est.push(batch[done]); hB.add(batch[done]); done++; }
        showSample(last); render(); update();
      });
    }
    function bandwidthChanged() {
      run.cancel();
      est = []; maxC = 6; hB.clear();
      if (cur) showSample(cur);
      render(); update();
    }
    function reset(ev) {
      if (!fresh(ev)) return;
      run.cancel();
      sim = S.rd(manip, seed); est = []; maxC = 6; cur = null;
      hB.clear(); clear(dotsG); clear(densG); show(fitL, false); show(fitR, false); jumpLab.textContent = '';
      attrs(bandRect, { x: r1(sx(c - h)), width: r1(sx(c + h) - sx(c - h)) });
      attrs(bandLab, { x: r1(sx(c - h / 2)) });
      render(); update();
    }
    M06.button(bar, 'Draw one', one);
    M06.button(bar, 'Draw 500', many);
    M06.button(bar, 'Reset', function (ev) { sl.value = RD.h; h = RD.h; reset(ev); });
    reset();
  };
})();
