// Meeting 10: the 2021 paper rebuilt as an outline.
//
// The left panel sets the main text of the preprint as a scrolling page, one
// numbered paragraph after another. The right panel is the outline that
// could have come before it: the sections, then one bullet per paragraph with
// its planned topic sentence, the evidence it points to and its length.
// Hovering a bullet scrolls the page to its paragraph and marks the sentence
// that carries the point. Scrolling or hovering the page marks the bullet.
// The data are in m10-ncc-data.js.
(function () {
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function build(root, data) {
    const page = root.querySelector(".ro-page");
    const outline = root.querySelector(".ro-outline");
    const info = root.querySelector(".ro-info");

    const head = el("div", "ro-head");
    head.appendChild(el("div", "ro-paper", "The Historical Impact of Anthropogenic Climate Change on Global Agricultural Productivity"));
    head.appendChild(el("div", "ro-authors", "Ortiz-Bobea, Ault, Carrillo, Chambers and Lobell · arXiv:2007.10415 (2020), the version first submitted"));
    head.appendChild(el("div", "ro-sec", "Main text"));
    page.appendChild(head);

    const paraEls = [], rowEls = [];
    let n = 0, total = 0, overOutline = false;

    function mark(i) {
      rowEls.forEach((r, j) => r.classList.toggle("ro-cur", j === i));
    }

    data.sections.forEach(sec => {
      outline.appendChild(el("li", "ol-sec", sec.title));
      sec.paras.forEach(p => {
        const i = n++;
        total += p.w;
        const pe = el("p", "ro-p");
        pe.appendChild(el("span", "ol-pn", String(i + 1)));
        p.s.forEach((html, j) => {
          const se = el("span", "ro-s");
          se.innerHTML = html;
          if (j === 0) se.classList.add("ro-first");
          if (p.point.includes(j + 1)) se.classList.add("ro-point");
          pe.appendChild(se);
          pe.appendChild(document.createTextNode(" "));
        });
        pe.addEventListener("mouseenter", () => { pe.classList.add("ro-focus"); mark(i); });
        pe.addEventListener("mouseleave", () => pe.classList.remove("ro-focus"));
        page.appendChild(pe);
        paraEls.push(pe);

        const row = el("li", "ro-row");
        row.appendChild(el("span", "ro-num", String(i + 1)));
        const body = el("span", "ro-body");
        body.appendChild(el("span", "ro-sum", p.plan));
        body.appendChild(el("span", "ol-ev", `${p.ev} · ${p.w} words`));
        if (p.where) body.appendChild(el("span", "ro-at", p.where));
        row.appendChild(body);
        row.addEventListener("mouseenter", () => {
          paraEls.forEach(x => x.classList.toggle("ro-dim", x !== pe));
          pe.classList.add("ro-focus");
          mark(i);
          page.scrollTo({ top: Math.max(0, pe.offsetTop - 12), behavior: "smooth" });
        });
        row.addEventListener("mouseleave", () => {
          paraEls.forEach(x => x.classList.remove("ro-dim"));
          pe.classList.remove("ro-focus");
        });
        outline.appendChild(row);
        rowEls.push(row);
      });
    });

    info.textContent = `${n} paragraphs · ${total.toLocaleString("en-US")} words · about ${Math.round(total / n)} words a paragraph`;

    outline.addEventListener("mouseenter", () => { overOutline = true; });
    outline.addEventListener("mouseleave", () => { overOutline = false; });
    page.addEventListener("scroll", () => {
      if (overOutline) return;
      const top = page.scrollTop + 40;
      let i = 0;
      paraEls.forEach((pe, j) => { if (pe.offsetTop <= top) i = j; });
      mark(i);
      const r = rowEls[i];
      outline.scrollTo({ top: Math.max(0, r.offsetTop - outline.clientHeight / 3) });
    });
    mark(0);
  }

  function init() {
    if (!window.M10_NCC) return;
    document.querySelectorAll(".m10-ol").forEach(root => {
      if (!root.dataset.built) { build(root, window.M10_NCC); root.dataset.built = "1"; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
