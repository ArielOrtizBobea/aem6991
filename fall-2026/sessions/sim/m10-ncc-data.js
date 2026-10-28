// Meeting 10: the 2021 paper rebuilt as an outline. Data for m10-outline.js.
//
// Text: the main text of Ortiz-Bobea, Ault, Carrillo, Chambers and Lobell,
// arXiv:2007.10415, the version first submitted to Nature Climate Change
// (published as Nat. Clim. Change 11, 306-312, 2021). Verbatim from the
// preprint PDF, with line breaks joined and the equations set in HTML.
// Sections, planned topic sentences and evidence notes were written for the
// slide. point = the sentence(s) carrying the paragraph's point; w = words.
window.M10_NCC = {
 "sections": [
  {
   "title": "Introduction",
   "paras": [
    {
     "point": [
      5
     ],
     "plan": "Human-caused warming already changes the weather farms depend on, and its past effect on farm productivity has not been measured.",
     "ev": "Refs. 1–19",
     "where": "Point in sentence 5: the opening funnel",
     "w": 125,
     "s": [
      "Enhancing agricultural productivity is vital to lifting global living standards and advancing sustainable food production in the face of escalating challenges to agriculture and the environment (1-7).",
      "Investments in agricultural research have boosted agricultural productivity, but this growth in productivity has been distributed unequally across the world (8-10), and there are signs that it is slowing down (11-14).",
      "At the same time, human activities during the last century and a half caused global temperatures to rise by more than 1°C above their pre-industrial values (15).",
      "This increase affects the global weather patterns that are essential to agriculture (16-17).",
      "However, the impacts of this anthropogenic climate change (ACC) on the agricultural sector has not yet been quantified, as most research has focused on future impacts (18-19)."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "Studies of past impacts measure cereal yields or total GDP, and neither tracks the productivity of agriculture as a whole.",
     "ev": "Cereals are about 20% of value (Fig. S1); refs. 20–31",
     "where": null,
     "w": 135,
     "s": [
      "Research to date on the historical impact of ACC focuses overwhelmingly on yields of major cereal crops (20-21) or on total Gross Domestic Product (GDP) (22).",
      "However, recent studies in this area are of limited value for assessing overall agricultural productivity for the following reasons: (i) cereal crops represent only about 20% of agriculture’s global net production value (Fig. S1), (ii) variations in measures such as yield, could deviate from changes in overall productivity if farmers also adjust inputs in response to weather (23-25), and (iii) growth and levels of total and agricultural GDP diverge considerably in most countries (26-28), and thus climate change impacts on total GDP could deviate considerably from agricultural impacts (29-30).",
      "There is much needed research on agricultural climate impacts beyond the effects on yields of the major staple crops (31)."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "We measure the impact since 1961 on agricultural total factor productivity (TFP), which accounts for changes in inputs.",
     "ev": "Official TFP statistics (ref. 12)",
     "where": null,
     "w": 97,
     "s": [
      "We quantify the impact of ACC on global agricultural productivity since 1961.",
      "Instead of focusing on crop yield or agricultural output, we rely on a measure of agricultural Total Factor Productivity (TFP).",
      "TFP measures aggregate output per unit of measured aggregate input (32-35).",
      "TFP thus captures interactions between output and input adjustments that eluded earlier research.",
      "Here we rely on official TFP statistics for which agricultural output includes crops and livestock, while inputs encompass labor, land, physical capital and materials (12).",
      "However, these TFP statistics do not incorporate the effect of weather, as is generally the case."
     ]
    }
   ]
  },
  {
   "title": "Framework and model",
   "paras": [
    {
     "point": [
      4
     ],
     "plan": "Measured TFP growth mixes technical change, weather and unobserved inputs.",
     "ev": "Production function; TFP growth equation",
     "where": "Point in sentence 4, after the set-up",
     "w": 112,
     "s": [
      "Consider the production function <i>Y<sub>it</sub></i> = <i>e</i><sup><i>f</i>(<i>Z<sub>it</sub></i>)</sup><i>A<sub>it</sub></i><i>X<sub>it</sub></i><i>U<sub>it</sub></i>, where <i>Y<sub>it</sub></i> is aggregate agricultural output, <i>e</i><sup><i>f</i>(<i>Z<sub>it</sub></i>)</sup> is the effect of weather <i>Z<sub>it</sub></i>, <i>A<sub>it</sub></i> measures technological knowledge and <i>X<sub>it</sub></i> and <i>U<sub>it</sub></i> are the observed and unobserved aggregate inputs, respectively.",
      "The subscripts refer to individual countries (<i>i</i>) and year (<i>t</i>).",
      "The percentage change in TFP is approximated as <span class=\"ro-eq\">Δ ln <i>TFP<sub>it</sub></i> ≡ Δ ln(<i>Y<sub>it</sub></i>) − Δ ln(<i>X<sub>it</sub></i>) = Δ ln <i>A<sub>it</sub></i> + Δ<i>f</i>(<i>Z<sub>it</sub></i>) + Δ ln <i>U<sub>it</sub></i></span> where Δ denotes change.",
      "TFP growth reflects technological improvements embodied in Δ ln <i>A<sub>it</sub></i>, but also the unmeasured effects of random year-to-year weather changes Δ<i>f</i>(<i>Z<sub>it</sub></i>) and unobserved input adjustments Δ ln <i>U<sub>it</sub></i>.",
      "While this aggregate representation may conceal fine-scale production processes that are important to practitioners in the field, it helps provide a much needed macro-economic picture about the global agricultural economy."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "We regress country TFP growth on green-season temperature and precipitation, with country and year fixed effects.",
     "ev": "Regression equation; block bootstrap, 500 draws",
     "where": null,
     "w": 210,
     "s": [
      "We ground this conceptual framework empirically by estimating an econometric model linking country-level TFP growth with weather change.",
      "Our model characterizes <i>f</i> as a quadratic function of average temperature (T) and total precipitation (P) over the 5-month period centered around the greenest month of the year of each country or “green season” (See Methods): <span class=\"ro-eq\">Δ ln <i>TFP<sub>it</sub></i> = <i>α<sub>i</sub></i> + <i>θ<sub>t</sub></i> + <i>β</i><sub>1</sub>Δ<i>T<sub>it</sub></i> + <i>β</i><sub>2</sub>Δ<i>T</i><sup>2</sup><sub><i>it</i></sub> + <i>β</i><sub>3</sub>Δ<i>P<sub>it</sub></i> + <i>β</i><sub>4</sub>Δ<i>P</i><sup>2</sup><sub><i>it</i></sub> + <i>ϵ<sub>it</sub></i></span>",
      "Country-fixed effect <i>α<sub>i</sub></i> controls for average country TFP growth rates, and year-fixed effect <i>θ<sub>t</sub></i> for global shocks common to all nations.",
      "Conceptually, these parameters seek to control for technological change embodied in Δ ln <i>A<sub>it</sub></i>.",
      "Thus the <i>β</i> coefficients are estimated via the within-country and within-year variation of TFP growth and year-to-year weather changes.",
      "The inclusion of squared terms Δ<i>T</i><sup>2</sup><sub><i>it</i></sub> and Δ<i>P</i><sup>2</sup><sub><i>it</i></sub> allows the effect of changes in weather to vary with baseline levels of <i>T</i> or <i>P</i>.",
      "Unobserved changes in inputs that are not absorbed by <i>α<sub>i</sub></i> or <i>θ<sub>t</sub></i> and measurement errors in the TFP data are captured in the error term <i>ϵ<sub>it</sub></i>.",
      "We account for the uncertainty in the estimated parameters with a block bootstrap where we sample observations with replacement 500 times by year and region.",
      "We later consider more than 200 systematic variations of this model.",
      "For instance, we explore whether estimating separate response functions for various sub-regions of the world affects our results."
     ]
    }
   ]
  },
  {
   "title": "Data",
   "paras": [
    {
     "point": [
      1
     ],
     "plan": "TFP has more than doubled since 1961, unevenly across countries, and observed temperatures follow the runs with climate change.",
     "ev": "Fig. 1A–E",
     "where": null,
     "w": 113,
     "s": [
      "We summarize the key source data in Figure 1.",
      "The first panel, Fig. 1A, shows that average agricultural TFP has more than doubled since 1961 but that there is wide cross-country variation.",
      "Fig. 1B shows that there is a substantial range of variation in Δ ln <i>TFP<sub>it</sub></i> across countries for any given year.",
      "We also observe that TFP has grown much more slowly in certain countries, particularly in Sub-Saharan Africa (Fig. 1C).",
      "In Fig. 1D we show how observed annual country-level average temperature (in circles) fall closer within the range of counterfactual weather trajectories with ACC (gold band) than without ACC (grey band).",
      "Fig. 1E shows analogous information for precipitation without any discernible pattern."
     ]
    }
   ]
  },
  {
   "title": "How TFP responds to weather",
   "paras": [
    {
     "point": [
      1
     ],
     "plan": "Hotter green seasons lower TFP growth, and two placebo checks rule out chance.",
     "ev": "Fig. 2A–F; Tab. S1; Figs. S2–S3",
     "where": null,
     "w": 204,
     "s": [
      "We find a robust relationship between agricultural TFP growth and weather changes (Fig. 2, Tab. S1).",
      "The temperature response function is roughly linear and downward sloping (Fig 2A) indicating that warmer temperatures over the green season are detrimental to TFP growth.",
      "We conduct two placebo checks that suggest this relationship is unlikely to arise by chance.",
      "These checks are based on the idea that incorrectly matching TFP growth and weather changes, and re-estimating, should yield results suggesting no or insignificant effects of weather on TFP.",
      "We first estimate models based on 10,000 “reshuffled” datasets that mismatch the year variable of the TFP growth and weather change data.",
      "The sample estimate (in Fig. 2A) falls outside the resulting distribution of spurious “reshuffled estimates” (Fig. 2B).",
      "In a second check we mismatch the country variable of the TFP growth and weather change data with similar results (Fig. 2C).",
      "The precipitation response function is non-linear and peaks at around 500 mm over the green season (Fig 2d).",
      "We demonstrate that this relationship is not likely spurious with the same placebo checks shown in Figs. 2E,F.",
      "We also find that the shape of the response functions is not driven by either hot or cold countries (Figs. S2, S3)."
     ]
    },
    {
     "point": [
      4
     ],
     "plan": "Heat became more damaging in the second half of the sample.",
     "ev": "Figs. S4–S9; test with P = 0.035",
     "where": "Point in sentence 4, after a question",
     "w": 142,
     "s": [
      "A critical question for climate change adaptation is whether agriculture is becoming more or less sensitive to climatic extremes.",
      "This would be reflected empirically as changes over time in the response functions shown in Fig. 2.",
      "We estimate a model based on the first (1962-1988) and second (1989-2015) halves of the sample and find that the temperature response function is noticeably steeper for the latter half (Figs. S4, S5).",
      "This indicates that higher temperatures have become more damaging.",
      "We formally confirm this by testing whether the temperature coefficient has changed between these two periods in a model with a linear specification for temperature (P = 0.035).",
      "We also find that the change in the temperature response function over time is not driven by isolated changes in outlying countries in the temperature distribution (Figs. S6-S9).",
      "This mirrors recent findings in US agriculture (36, 37)."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "Weather has no detectable lasting effect on TFP growth.",
     "ev": "Lags up to 10 years (Tab. S2)",
     "where": null,
     "w": 102,
     "s": [
      "We find no evidence that weather has a persistent effect on TFP growth.",
      "Our baseline specification only considers contemporaneous weather effects.",
      "But a weather shock could conceivably affect TFP growth in future years, for example if growth is faster following a year with bad weather.",
      "This would result in cumulative weather events affecting TFP growth.",
      "By introducing lags for weather in prior years, we cannot reject the hypothesis that the cumulative effect of changes in weather conditions up to 10 years in the past have no effect on TFP growth (Tab. S2).",
      "But rejecting this hypothesis may be challenging with aggregate data."
     ]
    }
   ]
  },
  {
   "title": "Impact of climate change since 1961",
   "paras": [
    {
     "point": [
      1
     ],
     "plan": "Climate-model runs with and without human influence turn the estimates into each country's cumulative impact.",
     "ev": "CMIP6 runs",
     "where": null,
     "w": 79,
     "s": [
      "We subsequently link our econometric estimates with counterfactual weather trajectories from climate experiments with and without ACC to derive the cumulative impact of ACC for each country since 1961.",
      "We obtain the counterfactual weather trajectories from the Coupled Model Intercomparison Project Phase 6 (CMIP6).",
      "This approach combines both the statistical uncertainty from the econometric model regarding the climate-agriculture relationship and the climate uncertainty from the CMIP6 ensemble regarding the effect of human emissions on the climate system (see Methods)."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "Climate change has cut global TFP by about 21% since 1961, the equivalent of nine years of growth.",
     "ev": "Fig. 3A–B",
     "where": null,
     "w": 130,
     "s": [
      "The cumulative impact of ACC on global agricultural TFP growth over the 1961-2020 period is about −20.8% with a 90 percent confidence interval between −36.2 and −11.0% (Fig. 3A).",
      "In Fig. 3B, we represent this finding in levels by combining the counterfactual cumulative impacts of ACC on global TFP growth with the observed (1961-2015) and projected (2016-2020) global TFP level trajectory.",
      "This illustrates how much higher global TFP would have been without ACC.",
      "Specifically, we find that the global TFP level projected to be reached in 2020 in our world with ACC, would have been reached in 2011 in a world without ACC, with a 90 percent confidence interval between 2007 and 2015.",
      "That is, the impact of ACC represents a loss of the past 9 years of productivity growth."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "Warm regions lost the most, about 33% in Africa against 19% in North America.",
     "ev": "Fig. 4; Tab. S3",
     "where": null,
     "w": 106,
     "s": [
      "This global result conceals sizeable regional and cross-country disparities.",
      "Figure 4 shows that the cumulative impact of ACC since 1961 is greater for warm regions like Africa (−32.9%) and Latin American and the Caribbean (−30.0%) than for cooler regions like North America (−18.6%) and Europe and Central Asia (−16.0%) (see Tab. S3).",
      "The large negative impacts for Africa seem particularly worrisome given the large portion of the population employed in agriculture.",
      "Overall, these findings are consistent with documented slowdowns in agricultural productivity (11-14), particularly in Sub-Saharan Africa (38,39) but also with studies analyzing economy-wide ACC impacts that exacerbate inequality between poor and rich countries (22, 40)."
     ]
    }
   ]
  },
  {
   "title": "Checks",
   "paras": [
    {
     "point": [
      1
     ],
     "plan": "The global estimate changes little across 200 versions of the model.",
     "ev": "Fig. 5",
     "where": null,
     "w": 236,
     "s": [
      "Our baseline global finding of the impact of ACC on global agricultural productivity is robust to 200 variations of the econometric model.",
      "Fig. 5 summarizes global estimates for the baseline and alternative models.",
      "The baseline model is shown in blue and corresponds to the estimate shown in Fig. 3A.",
      "Notice that using minimum (Tmin) and maximum (Tmax) temperature as alternative temperature variables or excluding precipitation does not substantially change our baseline estimate.",
      "In addition, using a cubic functional form to relax the symmetry of our baseline quadratic specification does not alter our baseline result.",
      "We also consider regressions with observations weighted by revenue and find those results to be systematically more pessimistic than our baseline model using equal weights.",
      "But aggregating weather data to the country level based on areas covered only by cropland or both cropland and pasture has little effect on our findings.",
      "We also consider models with weather variables aggregated over the entire calendar year.",
      "We find that those models fit less well and point to noticeably smaller damages.",
      "Finally, our baseline model imposes a single response function for the whole world.",
      "But allowing separate response functions for three equally-sized latitudinal groups of countries does not alter our findings.",
      "Overall, the 192 models that do not exclude observations point to an average mean impact of −17.6% with a standard deviation of 5.3% (indicated with a horizontal red line and band in Fig. 5)."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "Dropping large or extreme countries changes little, and the 1989–2015 sample gives larger damage.",
     "ev": "Fig. 5",
     "where": null,
     "w": 120,
     "s": [
      "The exclusion of certain countries does not substantially affect our baseline estimate, but restricting the analysis to certain temporal subsamples does.",
      "A potential concern is that certain countries may overinfluence our estimates and thus drive our findings.",
      "But excluding certain large countries like China, the United States, India or Brazil, or the 10 percent coldest or hottest countries does not substantially alter our baseline finding (Fig. 5).",
      "However, basing our analysis on the latter part of the sample (1989-2015) points to even larger damages than our baseline estimate, on the order of −30% (Fig. 5).",
      "This reflects our finding that the response function is changing over time and suggests that global agriculture is growing increasingly sensitive to ongoing climate change."
     ]
    },
    {
     "point": [
      1
     ],
     "plan": "Estimates based on output overstate the impact, because farmers cut inputs in bad years.",
     "ev": "Figs. S10–S11",
     "where": null,
     "w": 81,
     "s": [
      "Finally, we find that ignoring input responses by analyzing output rather than TFP, overstates the impact of ACC.",
      "The temperature response function is steeper for output than for TFP (Fig. S10), suggesting that farmers reduce aggregate input quantity in response to detrimental weather conditions.",
      "Ignoring confounding input adjustments, Fig. S11 indicates that ACC would have reduced output by about 32.3% with a 90 percent confidence interval between −61.3 and −16.8%.",
      "This is noticeably higher than the 20.8% reduction based on TFP."
     ]
    }
   ]
  },
  {
   "title": "Caveats and conclusion",
   "paras": [
    {
     "point": [
      1,
      5,
      10
     ],
     "plan": "What the counterfactual removes, why error in measured TFP adds noise, and whether research investment can keep pace.",
     "ev": "Refs. 11–14",
     "where": "Three points in one paragraph",
     "w": 272,
     "s": [
      "Our estimates should not be interpreted as the effect of a world without fossil fuels on global agricultural production.",
      "Agriculture has benefitted tremendously from agricultural research and carbon-intensive inputs that would not have been as available without fossil fuels.",
      "The counterfactual in our study only removes the effect that fossil fuels and other anthropogenic influences have on the climate system.",
      "For instance, our estimates do not remove the direct effect that rising CO2 concentrations has on agricultural production or the presence of agricultural research or carbon-intensive inputs.",
      "In addition, the reader may be rightfully concerned about measurement error of our TFP metric.",
      "TFP estimates are notoriously difficult to construct, and require considerable background work sometimes using imperfect data sources.",
      "However, as long as the measurement error remains uncorrelated with year-to-year changes in TFP growth, which seems plausible, such errors do not bias our econometric estimates but simply render them more imprecise.",
      "Moreover, the TFP metric we rely upon likely mismeasures certain inputs, such as irrigation water use.",
      "Our own analysis shows that ignoring all measured inputs overstates ACC impacts, so the present analysis is a first step while more detailed international TFP statistics are produced.",
      "In conclusion, our study suggests that ACC is increasingly reducing agricultural output as we drift away from a climate system without human influences, cumulating into a detectable and sizeable impact as of 2020.",
      "Given recent productivity slowdowns (11-14), the long lags in agricultural research, and the rapid pace of ACC, our findings raise the question whether current levels of investments in agricultural research are sufficient to sustain 20th century rates of productivity growth in the 21st century."
     ]
    }
   ]
  }
 ]
};
