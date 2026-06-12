# Defining a new study

A study is ONE YAML file. The platform is never edited; platform-locked
parameters (coalition cuts, ARS weights, DK recode, penalty, OPTIN
grading, segment shares, the rake structure) live in code.

## The four parameter classes you fill in

1. **Study metadata** — `study:` block (id, title, client, fielded).
2. **Instrument bindings** — variable names your survey actually used:
   `composites:` (item lists, trap, ARS/BCS vars), `activation:`
   (OPTIN + cost fields), `weighting.variable_mapping`, `quality:`
   item lists. If the survey was fielded with canonical names, these
   are copy-paste from the template.
3. **Issue calibration** — `roi:` thresholds and `quality:` thresholds.
   Start from the HIV values; change only with a written rationale.
4. **Weighting universe** — `survey_population:` (voters_v1 default;
   non-voter studies reference a population module under
   `benchmarks/populations/` — load REAL benchmark values and flip
   `placeholder=False` before any client run).

## Workflow

```bash
cp prism/studies/hiv_wave1.yaml prism/studies/<new_study>.yaml   # or the
#   _template_us_adults.yaml for non-voter universes
$EDITOR prism/studies/<new_study>.yaml
prism validate prism/studies/<new_study>.yaml
prism run prism/studies/<new_study>.yaml data/<input>.sav --dry-run
prism run prism/studies/<new_study>.yaml data/<input>.sav --output out/
```

`validate` catches unknown benchmark references, dimension mismatches,
category-label mismatches (including the en-dash trap), and implausible
thresholds. `--dry-run` additionally checks every required variable
exists in the SAV before any computation.

## Common patterns

- **No priority rank**: set `priority_rank_pre/post: null` and use a
  7-item list without the rank item.
- **Wave 2+ of an existing study**: flip `activation.calibration_mode`
  to `apply` and paste the locked Wave 1 `fitted_coefficients` (they're
  in the Wave 1 diagnostics markdown). Set
  `weighting.sex_other_handling: random_split` with a fixed seed.
- **Custom exclusions**: `quality.exclusion_policy` — `none` (default,
  keep everyone), `recommend_remove`, or `f_total_ge_1`. The package
  always computes flags on the full sample either way.
