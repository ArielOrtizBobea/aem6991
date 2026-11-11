// Meeting 10: a reverse outline of a whole introduction.
//
// The left panel sets the introduction of Elmallah, Hoen, Fujita, Robson and
// Brunner (2023, Energy Policy, CC BY 4.0) as a scrolling page. Hovering a
// sentence shows what it does. The right panel is the reverse outline: one
// sentence per paragraph, and where in the paragraph its point sits. Hovering
// an outline row highlights that paragraph and scrolls to it; hovering a role
// in the legend highlights every sentence that plays it.
//
// The text is verbatim from the Berkeley Lab copy of the article, with the
// PDF's line-break hyphens removed. Roles and summaries are ours.
(function () {
  const ROLES = {
    context: ["Context", "#5b7fa6"],
    gap: ["Gap", "#b31b1b"],
    motivation: ["Motivation", "#c77a1c"],
    question: ["Question", "#7e1313"],
    data: ["Data", "#3f7d3a"],
    design: ["Design", "#2f8c8c"],
    contribution: ["Contribution", "#6a4c93"],
    literature: ["Literature", "#8a6a3a"],
    hypothesis: ["Hypothesis", "#a0527a"],
    roadmap: ["Roadmap", "#6b6b6b"],
  };

  const PARAS = [
    {
      point: 3,
      summary: "Large solar farms are spreading fast, but their effect on nearby home values, which shapes local support, is poorly understood.",
      where: "Point in sentence 3: the opening funnel",
      s: [
        ["context", "Defines the technology and says it is spreading.",
          "Large-scale photovoltaic projects (LSPVP), defined here as ground-mounted photovoltaic generation facilities with at least 1 MW of DC generation capacity, are an increasingly prevalent source of renewable energy."],
        ["context", "Gives its share of new solar capacity and its expected growth.",
          "LSPVPs accounted for over 60% of all new solar capacity in the United States in 2021, and, as the largest resource by capacity in interconnection queues, are projected to continue growing (Bolinger et al., 2021)."],
        ["gap", "Names what is unknown, and why it matters for local support.",
          "However, the local economic impacts of LSPVPs are poorly understood (Mai et al., 2014), despite surveys showing that local public support for large-scale solar is strongly related to perceived economic impacts, including the impact on property values (Carlisle et al., 2014)."],
        ["motivation", "Shows that industry, advocates and neighbours already argue about it.",
          "Concerns surrounding the property value impacts of solar power are reflected in solar industry and environmental advocacy communication that challenge the conception that solar power reduces property values (Center for Energy Education, n.d.; Solar Energy Industries Association, 2019), and in attempts by neighbors of solar plants to claim solar panels as a private nuisance (Westgate, 2017)."],
      ],
    },
    {
      point: 1,
      summary: "The paper estimates how large solar farms affect nearby home prices, from 1.8 million sales in six states, near against far and before against after.",
      where: "Point in sentence 1",
      s: [
        ["question", "States what the paper provides.",
          "The purpose of this paper is to provide some of the first comprehensive evidence on the impact of LSPVPs on residential home values."],
        ["question", "States the two research questions.",
          "Specifically, we seek to answer two related research questions: (1) what effect, if any, do LSPVPs have on residential home prices and (2) does the effect of LSPVPs on home prices differ based on the prior land use on which a LSPVP is located, the size of the LSPVP, or the urbanicity of a home’s location?"],
        ["data", "The sales data: where, when and how many.",
          "To address these questions we use data from CoreLogic on over 1.8 million residential property transactions that occurred within six years before and after a LSPVP was constructed in the five U.S. states with the highest concentration of LSPVPs as measured by number of installations: California (CA), Massachusetts (MA), Minnesota (MN), North Carolina (NC), and New Jersey (NJ), as well as in Connecticut (CT), chosen for its relatively high population density (i.e., urbanicity) near LSPVPs."],
        ["data", "The other datasets merged in, including new project footprints.",
          "We then combine the transaction data with other geospatial datasets including an original dataset of LSPVP footprints developed by the project team for this research, a suite of environmental amenities and dis-amenities, urban, rural, and suburban classifications, and historic land cover data."],
        ["design", "The design: near against far, before against after.",
          "We identify the arguably causal impact of LSPVPs on residential property values using a difference-in-differences identification strategy that compares the sale price of residential homes located in close proximity to a LSPVP (e.g. 0–0.5 miles away) both before and after a LSPVP is constructed to the sale price of homes located farther away from a LSPVP (e.g. 2–4 miles away)."],
      ],
    },
    {
      point: 2,
      summary: "The first contribution is coverage: states with most of the US capacity, which earlier studies, with mixed results, had not reached.",
      where: "Point in sentence 2, after a signpost",
      s: [
        ["roadmap", "Announces the contributions, which take two paragraphs.",
          "Our paper makes several important contributions."],
        ["contribution", "Contribution 1: states not studied before.",
          "First, we examine the impacts of LSPVPs in a large set of U.S. states that account for the majority of U.S. LSPVP capacity, most of which, to our knowledge, have not previously been studied with respect to the impact of LSPVPs on property values."],
        ["literature", "Earlier evidence is mixed and comes from few places.",
          "Existing research on the property value impacts of LSPVPs provides mixed results from a limited set of geographies."],
        ["literature", "Where damage was found, the reasons proposed.",
          "Where researchers do find an adverse impact of LSPVPs on property values, as in studies from the Netherlands and from the U.S. states of RI, MA, and NC, they theorize a change in property values due to visual intrusion from panels (Abashidze, 2019; Dröes and Koster, 2021; Gaur and Lang, 2020) and land use change (Gaur and Lang, 2020)."],
        ["literature", "A study that found no effect.",
          "Conversely, one study based in the U.K. finds no statistically significant effect of LSPVPs on property values (Jarvis, 2021)."],
        ["contribution", "Why wider coverage matters.",
          "Expanding the geographic scope of the literature, then, facilitates both generalization (Brinkley and Leach, 2019) and more location-specific policy insights."],
      ],
    },
    {
      point: 1,
      summary: "The second contribution tests whether the effect depends on project size, prior land use and urbanicity, using new data on project footprints.",
      where: "Point in sentence 1",
      s: [
        ["contribution", "Contribution 2: does the effect differ by size, land use and urbanicity?",
          "Second, we investigate whether the effect of LSPVPs on home prices is heterogenous with respect to LSPVP area, prior LSPVP land use, and home urbanicity."],
        ["motivation", "Why land use matters.",
          "One of the major concerns surrounding LSPVPs, as well as one of the major opportunities to explore the co-benefits of LSPVP development, are its land use requirements (Hernandez et al., 2014a; Hernandez et al., 2014b; Katkar et al., 2021)."],
        ["hypothesis", "Where larger effects are expected, and why.",
          "In particular, more adverse home price impacts might be found where LSPVPs displace green space (consistent with results that show higher property values near green space (Crompton, 2001)) or where LSPVPs are larger in area, and thus more visually intrusive."],
        ["contribution", "What the new data add over earlier work.",
          "While some previous studies (Gaur and Lang, 2020) find that greenfield solar development is primarily responsible for their observed decrease in home prices when compared to brownfield development, our constructed dataset of LSPVP footprints allows us to more precisely identify the prior land use of a LSPVP (for instance, breaking up the “greenfield” category into agricultural and non-agricultural land uses)."],
        ["contribution", "The same data measure each project's area.",
          "Our dataset of LSPVP footprints additionally allows us to accurately characterize the area of each LSPVP."],
      ],
    },
    {
      point: 0,
      summary: "The rest of the paper: policy and literature, data and methods, results, discussion, limitations, conclusions.",
      where: "A list of sections, with no single point",
      s: [
        ["roadmap", "Section 2.", "In section 2, we introduce the policy context for LSPVP development in the study area and review the existing literature on property value impacts of LSPVPs."],
        ["roadmap", "Section 3.", "In section 3, we detail the data used in this study, the geospatial methods used to combine datasets, and the difference-in-differences approach to assessing property value impacts of LSPVPs."],
        ["roadmap", "Section 4.", "In section 4, we present our base model, event study, and heterogeneity analysis results."],
        ["roadmap", "Section 5.", "In section 5, we summarize and discuss our findings."],
        ["roadmap", "Section 6.", "In section 6, we note the limitations of our study and describe avenues for future work."],
        ["roadmap", "Section 7.", "Finally, in section 7, we review the key conclusions and policy implications of our study."],
      ],
    },
  ];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function build(root) {
    const page = root.querySelector(".ro-page");
    const outline = root.querySelector(".ro-outline");
    const info = root.querySelector(".ro-info");
    const legend = root.querySelector(".ro-legend");

    const head = el("div", "ro-head");
    head.appendChild(el("div", "ro-paper", "Shedding light on large-scale solar impacts: An analysis of property values and proximity to photovoltaics across six U.S. states"));
    head.appendChild(el("div", "ro-authors", "Elmallah, Hoen, Fujita, Robson and Brunner · Energy Policy 175 (2023) 113425"));
    head.appendChild(el("div", "ro-sec", "1. Introduction"));
    page.appendChild(head);

    const paraEls = [];
    PARAS.forEach((p, i) => {
      const pe = el("p", "ro-p");
      pe.dataset.p = i;
      p.s.forEach(([role, does, text], j) => {
        const se = el("span", "ro-s", text);
        se.dataset.role = role;
        if (j === 0) se.classList.add("ro-first");
        if (p.point === j + 1) se.classList.add("ro-point");
        se.addEventListener("mouseenter", () => {
          se.classList.add("ro-on");
          const [name, col] = ROLES[role];
          info.innerHTML = "";
          const tag = el("span", "ro-chip", name);
          tag.style.background = col;
          info.appendChild(tag);
          info.appendChild(el("span", "ro-where", `Paragraph ${i + 1}, sentence ${j + 1}`));
          info.appendChild(el("div", "ro-does", does));
        });
        se.addEventListener("mouseleave", () => se.classList.remove("ro-on"));
        pe.appendChild(se);
        pe.appendChild(document.createTextNode(" "));
      });
      page.appendChild(pe);
      paraEls.push(pe);

      const row = el("li", "ro-row");
      row.appendChild(el("span", "ro-num", String(i + 1)));
      const body = el("span", "ro-body");
      body.appendChild(el("span", "ro-sum", p.summary));
      const w = el("span", "ro-at", p.where);
      if (p.point === 1) w.classList.add("ro-first-ok");
      body.appendChild(w);
      row.appendChild(body);
      row.addEventListener("mouseenter", () => {
        paraEls.forEach(x => x.classList.toggle("ro-dim", x !== pe));
        pe.classList.add("ro-focus");
        page.scrollTo({ top: Math.max(0, pe.offsetTop - 12), behavior: "smooth" });
      });
      row.addEventListener("mouseleave", () => {
        paraEls.forEach(x => x.classList.remove("ro-dim"));
        pe.classList.remove("ro-focus");
      });
      outline.appendChild(row);
    });

    const miss = el("li", "ro-row ro-missing");
    miss.appendChild(el("span", "ro-num", "–"));
    const mb = el("span", "ro-body");
    mb.appendChild(el("span", "ro-sum", "Missing: the finding. The introduction never says what the paper found; only the abstract does."));
    miss.appendChild(mb);
    outline.appendChild(miss);

    Object.entries(ROLES).forEach(([key, [name, col]]) => {
      const chip = el("span", "ro-chip", name);
      chip.style.background = col;
      chip.addEventListener("mouseenter", () => {
        root.querySelectorAll(".ro-s").forEach(s => {
          if (s.dataset.role === key) { s.classList.add("ro-role"); s.style.setProperty("--ro-col", col); }
        });
      });
      chip.addEventListener("mouseleave", () => {
        root.querySelectorAll(".ro-s.ro-role").forEach(s => s.classList.remove("ro-role"));
      });
      legend.appendChild(chip);
    });
  }

  function init() {
    document.querySelectorAll(".m10-ro").forEach(root => {
      if (!root.dataset.built) { build(root); root.dataset.built = "1"; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
