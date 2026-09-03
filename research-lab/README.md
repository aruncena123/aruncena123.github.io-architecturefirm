# Public Space Research Laboratory

A virtual experimental research instrument for architecture, urban design, environmental psychology, landscape architecture, and public-space research. Runs entirely in the browser — no server, no build step, no dependencies.

**This is a research prototyping and data-collection instrument.** Its indicators are computational, model-based estimates, not validated measurements of real human behavior. Read [Model Limitations](#model-limitations) before using results in any serious way.

---

## 1. How to run it

1. Keep `index.html`, `style.css`, and `script.js` in the same folder (they reference each other by relative path).
2. Double-click `index.html`, or drag it into a browser tab. That's it — no install, no internet connection required after the page loads.
3. The app auto-loads a **demo study** the first time it runs (seating configuration vs. social interaction potential), so you can explore a fully populated example immediately. Everything you do is saved automatically to your browser's local storage, so closing and reopening the tab picks up where you left off — you'll land back on the **Overview** screen each time, which shows your current progress.
4. To start your own study from a clean slate: click **+ Start My Own Study** on the Overview screen (or **Dataset → Project Management → Reset Project** for a full wipe). Both ask for confirmation first.

The app works fully offline and stores data only in your browser (`localStorage`). Nothing is sent anywhere. To move a study between computers or share it with a collaborator, use **Export All Project Data** / **Import Project Data** (see §6).

**New to the terminology?** Click **? Guide** in the top-right corner (or **? How does this work?** on the Overview screen) at any time — it includes a plain-language glossary (Baseline/Treatment, Trial vs. Replication vs. Population, Condition, Effect Size, Correlation vs. causation, etc.) alongside the step-by-step walkthrough.

---

## 2. Finding your way around: Overview + 4 stages

The sidebar has just five buttons, because the app is organized into four research **stages**, plus a home screen:

- **Overview** — a status dashboard: which stages you've completed, your current study at a glance, and one-click access to any stage. This is where the app opens every time.
- **1 · Define** — write your research question, hypothesis, and variables.
- **2 · Build** — two sub-tabs: **Space Builder** (construct the plaza) and **Indicators & Scores** (the model-based indicator formulas, computed live from what you built).
- **3 · Experiment** — two sub-tabs: **Run Experiment** (baseline/treatment, parametric, sensitivity, multi-condition, replication) and **Observations & Responses** (field notes and Likert surveys).
- **4 · Results** — three sub-tabs: **Analysis** (charts/correlation), **Dataset** (the reproducible data table and exports), and **Research Report** (summary/paper/reproducibility drafts).

When a stage has more than one sub-tab, a small pill row appears above the content to switch between them. Two things make it hard to get lost:

- **The workflow bar** at the very top (10 numbered steps) is clickable — click any step (e.g. "Run Experiment") and it jumps you straight to the right stage and sub-tab, no need to know where it lives.
- **A "Next: ... →" button** sits at the bottom of every panel. If you just keep clicking it, it walks you through the whole process in order — Research Question → Space Builder → Indicators → Experiment → Observations → Analysis → Dataset → Report → back to Overview — without you needing to think about the stage structure at all.

The full linear order those two features follow:

1. **Research Question** — define your study
2. **Variables** — review the model-based indicators and their formulas
3. **Baseline** — build a reference space configuration
4. **Treatment** — duplicate the baseline and change only your independent variable
5. **Lock Controls** — mark which variables must stay identical between conditions
6. **Run Experiment** — compute and compare baseline vs. treatment
7. **Observations** — log field observations and/or participant survey responses
8. **Analyze** — charts, correlation, comparison matrix, effect sizes
9. **Export Dataset** — CSV/JSON suitable for Excel, SPSS, R, Python, JASP, Jamovi
10. **Research Draft** — generate a structured summary and paper outline

Some fine-print/advanced sections are collapsed by default to keep each screen readable — e.g. Space Builder's **Abstract Parameters** and **Random Population Generator** — click their heading to expand.

---

## 3. Running your first experiment

1. **Research Question tab** — fill in your title, research question, hypothesis, independent/dependent variable, and control variables. (Or click **Load Demo Study** to see a filled-in example.)
2. **Space Builder tab** — either pick a preset (e.g. *Open Plaza*) or build a space from scratch using the toolbar (**Add: Entrance / Pathway / Seating / Tree / Shade / Light / Water / Active Edge / Activity Node / Obstacle**). Click any object to edit its properties in the side panel; drag objects to reposition them; use **Undo/Redo** freely.
3. Once you're happy with the space, go to **Experiment → Controlled** and click **Set Current Space as BASELINE**.
4. Click **Duplicate Baseline → Treatment**. This copies the baseline exactly.
5. Click **Edit Treatment in Space Builder** — you're now editing the treatment copy. Change **only** your independent variable (e.g. switch seating from dispersed to clustered). Leave everything else untouched.
6. Back in **Experiment → Controlled**, enter your control variables (comma-separated) and click **🔒 Lock Control Variables** — the indicator turns green when locked.
7. Click **Run Baseline vs Treatment**. This runs your configured number of trials (set in the **Design** tab: trials, replication, random seed, and optionally stochastic variation) and reports mean difference, % change, and a standardized mean difference (effect size).
8. Optionally explore **Parametric Study** (sweep one variable across levels), **Sensitivity Analysis** (±10%/±20% around baseline), **Multi-Condition** (up to 10 named conditions compared side by side), and **Replication** (repeat trials, with or without synthetic random variation).

Every run automatically appends rows to the **Dataset** and entries to the **Experiment Log** (Dataset tab).

---

## 4. Generating a random population of layouts

Below the main canvas in **Space Builder** is a **Random Population Generator** card. This is a different thing from the **🎲 Randomize This Layout** button (which reshuffles only the one space you're currently editing) and from the 10-condition **Multi-Condition** experiment tab (which is for hand-picked comparisons):

- Set a **population size** (n = 3–50) and a **random seed**, then click **Generate Random Population**.
- The app produces `n` independently randomized layouts (same geometry as your current space, but independently varied object counts, positions, and types), reproducible from the seed.
- Every layout is automatically added to the **Dataset** as a `simulation` row (condition `Population #1`, `Population #2`, …), so it counts toward your overall dataset/population of data and is included in CSV/JSON export.
- All population members become additional sample units in **Analysis → Correlation Explorer** and **Scenario Comparison** — this is what lets you compute a *meaningful* Pearson correlation (e.g. "tree count vs. comfort indicator") instead of one based on just 2–3 hand-built conditions.
- Click **Preview** on any member to load it into the Space Builder canvas for inspection. Regenerating (same or different seed/count) **replaces** the previous population and its dataset rows, so re-running with different settings doesn't silently pile up duplicate rows; **Clear Population** removes it entirely.

**Why this matters for research use:** a single Baseline/Treatment pair is a controlled comparison (n=1 per condition, or n=trials with stochastic simulation), which is good for testing one specific hypothesis but not for exploring broader patterns across many configurations. The random population gives you a genuine sample (n≥3, ideally 10+) to run correlational/exploratory analysis on, and — per the request that motivated this feature — those layouts are written into the shared dataset and referenced in the generated **Research Summary** and **Paper Draft** (see §8) under a "Population Sample" section, with the most recent correlation you ran included as a discussion point.

---

## 5. Adding observations and participant data

- **Observations tab → Observation Sheet**: log researcher-entered field counts (pedestrians, seated/standing/walking, groups, interactions, comfort/safety ratings, etc.) — tagged as *researcher-entered observation*.
- **Observations tab → Participant Responses**: run a 1–5 Likert questionnaire (default 6 questions, customizable) with anonymous participant IDs (P001, P002, …) — no personal data is collected. Each response is tagged as *participant-reported response*, kept distinct from simulated indicators and field observations.

---

## 6. Exporting the dataset

Go to the **Dataset** tab:

- **Export CSV** — clean columns (`study_id, experiment_id, trial, condition, independent_variable, independent_value, dependent_variable, dependent_value, timestamp, observation_type, participant_id, notes`) ready to open in Excel, SPSS, R, Python (pandas), JASP, or Jamovi.
- **Export JSON** — same rows as structured JSON, useful for custom scripts.
- **Export Experiment Log** — a full audit trail of every parameter change, trial, and action taken.
- **Export All Project Data** (bottom of the tab) — the entire project state (study, space, weights, experiments, dataset, log, etc.) as one JSON file. Use **Import Project Data** to reload it later, on this or another computer.

The `observation_type` column is what lets you separate **simulation** rows (model-based), **observation** rows (researcher-entered), and **participant** rows (survey responses) during analysis in R/SPSS/Python.

---

## 7. Interpreting the model-based indicators

Every indicator on the **Variables** tab (Accessibility, Walkability, Visibility, Safety Potential, Social Interaction Potential, Comfort, Privacy, Sociability, Thermal Comfort Potential, Activity Diversity, and the composite Public Space Quality Score) is a **transparent weighted formula** — click **View Calculation** on any indicator card to see its exact formula, component weights, raw values, normalized values, and contribution to the score.

Rules of interpretation:

- These are **model-based / simulation indicators** — computational estimates derived from the spatial configuration you built, not measurements of real people's behavior.
- A higher score means "stronger modeled potential under the specified assumptions," not "proven better performance."
- Weights are researcher-adjustable (**Enable Custom Weights** on the Variables tab) — always report which weighting scheme (default or custom) you used.
- Effect sizes (mean difference, % change, standardized mean difference) describe changes in the *model output*, not directly in the real-world construct named by the indicator.
- Correlations shown in the **Analysis → Correlation Explorer** describe patterns in this simulated/model-generated dataset only — they do not establish real-world causation.

---

## 8. Writing a research paper with this instrument

The **Research Report** tab turns your study into drafts you build on — it does **not** produce a publishable paper by itself.

1. **Research Summary** (`Generate Research Summary`) — a plain-language summary: question, hypothesis, design, results, descriptive statistics, a **Population Sample** section (when you've generated one — size, seed, and summary statistics of the Quality Score across it, plus your most recent correlation result), limitations, interpretation, suggested discussion points, and a reproducibility footer. Good for a lab notebook entry or a project status report.
2. **Research Paper Builder** (`Generate Paper Draft`) — a structured 12-section draft (Introduction, Research Question, Hypothesis, Methodology, Experimental Setup, Variables, Results, Statistical Analysis, a Population Sample subsection, Discussion — which explicitly discusses the population's score range and last correlation when present, Limitations, Conclusion, Reproducibility) populated from your actual study data. Use **Copy** or **Download** to move it into Word/Google Docs/LaTeX.
3. **Reproducibility tab** — study ID, experiment ID, model version, trials, replication count, random seed, stochastic settings, population sample size/seed, dataset size, and a configuration hash. Use **Export Experiment Configuration** to save a JSON file another researcher (or you, later) can use to reproduce the exact same virtual experiment.
4. **Final Dashboard tab** — a one-screen status view: indicator scores, experiment result, data quality, and research-design completeness.

### Turning the draft into an actual paper

The generated text is deliberately written with cautious language (e.g. *"the simulation indicates that X was associated with a higher model-based indicator,"* never *"X causes Y"*). Before submitting or publishing anything built from it:

- **Verify every claim** against your actual dataset — don't trust the auto-generated prose blindly.
- **Add empirical validation.** Model-based indicators support hypothesis generation and preliminary exploration; a credible paper needs corroborating field observation, participant studies, or sensor data before making substantive claims.
- **Add real citations.** The draft has no literature review or references — you'll need to situate it in existing public-space, environmental psychology, and urban design literature yourself.
- **State your assumptions and weights explicitly** in the Methods section (the Reproducibility panel gives you the exact numbers).
- **Keep the limitations section.** Don't remove the cautionary language — it's there because composite indicators, simulated behavior, and correlation-based findings genuinely require it.
- Attach the exported CSV/JSON dataset and the exported experiment configuration as supplementary/reproducibility material.

---

## Model Limitations

Always visible in the app (Research Report tab), and worth repeating here:

- This laboratory is a computational research prototype.
- Model-based indicators are not substitutes for field measurements.
- Simulated behavior is not equivalent to observed human behavior.
- Results depend on model assumptions and weighting.
- Empirical validation is required before treating indicators as validated measurements.
- Correlation does not establish causation.
- Composite scores should be interpreted in relation to their component variables.

---

## File structure

```
research-lab/
├── index.html   — markup for all 8 modules (Research Question, Space Builder,
│                  Variables, Experiment, Observations, Analysis, Dataset, Report)
├── style.css    — professional light-canvas / dark-sidebar research-lab interface
└── script.js    — all logic: space model, indicator formulas, experiment engine,
                   statistics, SVG charts, dataset/report generation, UI wiring
```

No React, Vue, Angular, TypeScript, Node.js, backend, database, or build process — just HTML5, CSS3, and vanilla JavaScript, using only browser-native APIs (SVG, `localStorage`, `Blob`).
