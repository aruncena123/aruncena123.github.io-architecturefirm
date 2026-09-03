# Example Research Paper Draft

> This is exactly what the app's **Research Report → Research Paper Builder → Generate Paper Draft** button produces, using the built-in demo study/experiment (seating configuration vs. social interaction potential). It is here as a worked example of what "writing a research paper with this instrument" looks like in practice — see `README.md` §7 for how to turn a draft like this into an actual submittable paper.
>
> As the app itself states: *"Generates a structured research draft requiring researcher verification, empirical validation, and appropriate citation. This is not an automatically publishable paper."*

---

**1. INTRODUCTION**
Urban public plaza, temperate climate, weekday afternoon scenario (simulated). To explore, using a virtual experimental research instrument, whether seating configuration is associated with changes in a model-based indicator of social interaction potential in an otherwise equivalent public plaza.

**2. RESEARCH QUESTION**
How does seating configuration influence model-based social interaction potential?

**3. HYPOTHESIS**
Clustered seating will produce greater model-based social interaction potential than dispersed seating under otherwise equivalent spatial conditions.

**4. METHODOLOGY**
This study used the Public Space Research Laboratory, a browser-based virtual experimental research instrument, to construct a parametrized public-space configuration and compute transparent, model-based indicators of accessibility, walkability, visibility, safety potential, social interaction potential, environmental comfort, privacy, sociability, thermal comfort potential, and activity diversity. Research type: Experimental.

**5. EXPERIMENTAL SETUP**
- Baseline condition: Baseline (dispersed, individual seating)
- Treatment condition: Treatment (clustered seating — the only variable changed)
- Locked control variables: Space geometry, Entrances, Vegetation, Lighting, Pathways
- Trials: 5 | Replication: 3 | Randomization seed: 12345

**6. VARIABLES**
- Independent variable: Seating configuration
- Dependent variable: Social interaction potential
- Control variables: Space geometry, entrances, vegetation, lighting, pathways

**7. RESULTS**
Measured model-based indicator: Social Interaction Potential
- Baseline mean = 28.6 (SD = 0, n = 5)
- Treatment mean = 47.8 (SD = 0, n = 5)
- Mean difference = 19.2
- Percentage change = 67%
- Standardized mean difference = n/a *(pooled SD is 0 because stochastic variation was left disabled — with the deterministic model, repeated trials return identical output; enable stochastic simulation in Experiment → Replication to get a non-degenerate effect size)*

**8. STATISTICAL ANALYSIS**
Across all simulation dataset rows: n=10, mean=38.2, median=38.2, SD=10.1, range=19.2.

Effect sizes reported (mean difference, percentage difference, standardized mean difference) are calculated from the collected/model data and should not be interpreted as externally validated evidence without empirical validation.

**9. DISCUSSION**
Within the assumptions of this computational model, the observed pattern is consistent with the stated hypothesis to the extent described above. This association should not be read as a causal or generalizable claim about real-world human behavior without independent empirical validation (field observation, participant studies, or sensor data).

**10. LIMITATIONS**
- This laboratory is a computational research prototype.
- Model-based indicators are not substitutes for field measurements.
- Simulated behavior is not equivalent to observed human behavior.
- Results depend on model assumptions and weighting.
- Empirical validation is required before treating indicators as validated measurements.
- Correlation does not establish causation.
- Composite scores should be interpreted in relation to their component variables.

**11. CONCLUSION**
This computational experiment provides a preliminary, model-based exploration of the stated research question. Empirical validation is required before drawing substantive conclusions about real-world public-space performance.

**12. REPRODUCIBILITY**
- Study ID: STUDY_cfmebmwdc00
- Experiment ID: EXP-001
- Model version: PSRL-Model v1.0
- Configuration hash: a25dc8ba
- Dataset size: 31 rows

---

### What's missing before this could be submitted anywhere

This draft is a skeleton, not a paper. To turn it into something publishable you would still need to add, at minimum:

- A literature review situating the question in existing environmental psychology / public-space research, with real citations.
- Empirical data (field observation counts, participant surveys, or sensor data) to validate — or challenge — the model-based finding above.
- A non-degenerate effect size: re-run the experiment with **stochastic simulation enabled** (Experiment → Replication tab) so trial-to-trial variance is non-zero and a standardized mean difference can be computed.
- Proper methods detail on the weighting scheme used (Variables tab → "View Calculation" on Social Interaction Potential shows the exact formula and weights).
- A conclusion scoped to what was actually tested — this example, being demo data, should not be cited as a real finding about seating and sociability.
