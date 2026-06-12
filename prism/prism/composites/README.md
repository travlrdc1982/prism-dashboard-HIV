# PRISM Composite Scoring — Canonical Reference

This document is the source of truth for every PRISM composite score and recode.
All algorithms apply to HIV Wave 1. Items marked **PLATFORM LOCKED** apply
to every future PRISM study; items marked **ISSUE-CALIBRATED** are tunable
per study.

The companion Python module `prism_composites.py` implements every algorithm
below and is the canonical implementation. Decipher XML reflects the same
logic but with two known bugs (see notes on XSM2 and XQPRE_1r1).

---

## Table of Contents

1. [Demographic recodes](#1-demographic-recodes)
2. [PRE/POST item recodes](#2-prepost-item-recodes)
3. [Alignment composites](#3-alignment-composites)
4. [Coalition categorization](#4-coalition-categorization-platform-locked)
5. [Validity & penalty](#5-validity--penalty-flag-bug-fix)
6. [ARS — Action Readiness Score](#6-ars--action-readiness-score)
7. [ROI components & categorization](#7-roi-components--categorization-issue-calibrated)

---

## 1. Demographic recodes

### `XRACE_ETH` — 4-category race/ethnicity

**Description:** Census Vintage 2024 framework. Collapses Asian into Other-NH for parity with Census tabulations used in weighting.

**Source:** `QRACE_ETHNIC` (5-cat: White NH, Black NH, Asian NH, Other NH, Hispanic)

**Algorithm:**
```
1 (White NH)   -> 1 (White, non-Hispanic)
2 (Black NH)   -> 2 (Black, non-Hispanic)
3 (Asian NH)   -> 4 (Other, non-Hispanic)
4 (Other NH)   -> 4 (Other, non-Hispanic)
5 (Hispanic)   -> 3 (Hispanic)
```

**Python:**
```python
mapping = {1: 1, 2: 2, 3: 4, 4: 4, 5: 3}
df['XRACE_ETH'] = df['QRACE_ETHNIC'].map(mapping)
```

---

## 2. PRE/POST item recodes

### `XQPRE_1r1`, `XPOST_1r1` — Priority score from rank

**Description:** HIV priority rank (1-7, 1 = most important) inverted to a priority score (1-7, 7 = most important). Used in alignment composite.

**Source:** `QPRE_1r1`, `QPOST_1r1` (rank values 1-7 from ranksort.8)

**Algorithm:** `priority = 8 - rank`

**Python:**
```python
df['XQPRE_1r1'] = 8 - df['QPRE_1r1']
df['XPOST_1r1'] = 8 - df['QPOST_1r1']
```

**⚠ Note on deployed XML:** The Decipher exec uses `7 - rank` because `ranksort.8.r1.ival` returns zero-indexed values in execs. The SAV stores the visible 1-7 rank, so Python uses `8 - rank`.

---

### `XQPRE_6R`, `XPOST_6R` — Reverse-coded items

**Description:** QPRE_6 and QPOST_6 are worded such that the low pole indicates the substantive direction we want to score positively. Reverse-coded to align scale direction across all alignment items.

**Source:** `QPRE_6`, `QPOST_6` (1-7 Likert)

**Algorithm:** `reversed = 8 - value`

**Python:**
```python
df['XQPRE_6R'] = 8 - df['QPRE_6']
df['XPOST_6R'] = 8 - df['QPOST_6']
```

---

### `XQPRE_POST_r1` through `XQPRE_POST_r7` — Per-item PRE -> POST deltas

**Description:** Item-level change scores for diagnostic analysis of which items moved most. Built after recodes so scales are aligned.

**Source:** Recoded PRE and POST items

**Algorithm:** `delta_i = POST_i - PRE_i`

**Python:**
```python
df['XQPRE_POST_r1'] = df['XPOST_1r1']  - df['XQPRE_1r1']
df['XQPRE_POST_r2'] = df['QPOST_2']    - df['QPRE_2']
df['XQPRE_POST_r3'] = df['QPOST_3']    - df['QPRE_3']
df['XQPRE_POST_r4'] = df['QPOST_4']    - df['QPRE_4']
df['XQPRE_POST_r5'] = df['QPOST_5']    - df['QPRE_5']
df['XQPRE_POST_r6'] = df['XPOST_6R']   - df['XQPRE_6R']
df['XQPRE_POST_r7'] = df['QPOST_7r1']  - df['QPRE_7r1']
```

---

## 3. Alignment composites

### `XALIGN_PRE`, `XALIGN_POST` — Pre/Post alignment composite scores

**Description:** Mean of 7 PRE/POST items, each scored 1-7. Items: priority rank (recoded), 5 attitude items, reverse-coded vaccine item. Higher = stronger alignment with HIV-prioritization stance.

**Source:** All recoded PRE/POST items

**Algorithm:** Simple unweighted mean across 7 items; pandas mean handles missing values per respondent.

**Python:**
```python
pre_items = ['XQPRE_1r1', 'QPRE_2', 'QPRE_3', 'QPRE_4', 'QPRE_5', 'XQPRE_6R', 'QPRE_7r1']
post_items = ['XPOST_1r1', 'QPOST_2', 'QPOST_3', 'QPOST_4', 'QPOST_5', 'XPOST_6R', 'QPOST_7r1']

df['XALIGN_PRE']  = df[pre_items].mean(axis=1)
df['XALIGN_POST'] = df[post_items].mean(axis=1)
```

---

### `XALIGN_MOVE` — Persuasion shift score

**Description:** Change in alignment between PRE and POST. Core dependent variable for message persuasion analysis. Positive = message moved the respondent toward HIV prioritization; negative = backfire.

**Source:** `XALIGN_PRE`, `XALIGN_POST`

**Algorithm:** `MOVE = POST - PRE`

**Python:**
```python
df['XALIGN_MOVE'] = df['XALIGN_POST'] - df['XALIGN_PRE']
```

---

### `XQALIGN_PRE_C` — 5-category PRE alignment

**Description:** Categorical version of PRE alignment for diagnostic display. Uses the legacy boundaries (4, 5, 5.6, 6.6) that pre-date the platform's even-width COALITION boundaries; retained for backward compatibility with prior reporting.

**Source:** `XALIGN_PRE`

**Algorithm:**
```
ALIGN_PRE < 4        -> 0
4   ≤ ALIGN_PRE < 5  -> 1
5   ≤ ALIGN_PRE < 5.6 -> 2
5.6 ≤ ALIGN_PRE < 6.6 -> 3
ALIGN_PRE ≥ 6.6      -> 4
```

**Python:**
```python
cuts = [-np.inf, 4, 5, 5.6, 6.6, np.inf]
df['XQALIGN_PRE_C'] = pd.cut(df['XALIGN_PRE'], bins=cuts, labels=[0,1,2,3,4], right=False).astype('Int64')
```

---

## 4. Coalition categorization — **PLATFORM LOCKED**

### `XCOALITION` — 5-category coalition position

**Description:** Five-tier categorization of respondents' POST-test position toward the HIV agenda. Locked across all PRISM studies — bin meanings and cutpoints do not change. Bin populations are findings.

**Source:** `XALIGN_POST`

**Algorithm (even-width bins on 1-7 scale):**
```
ALIGN_POST < 3   -> 1 (REJECTOR)
3 ≤ ALIGN_POST < 4 -> 2 (DOUBTER)
4 ≤ ALIGN_POST < 5 -> 3 (CONVERTER)
5 ≤ ALIGN_POST < 6 -> 4 (SUPPORTER)
ALIGN_POST ≥ 6   -> 5 (CHAMPION)
```

**Justification for cutpoints:** Anchored to Likert anchor language. SUPPORTER threshold of 5.0 = respondent on average expresses "agreement" across the seven composite items; CHAMPION (≥6) = "strong agreement."

**Python:**
```python
cuts = [-np.inf, 3, 4, 5, 6, np.inf]
df['XCOALITION'] = pd.cut(df['XALIGN_POST'], bins=cuts, labels=[1,2,3,4,5], right=False).astype('Int64')
```

---

### `XCOAL_NORM` — 0-1 normalized coalition score

**Description:** Continuous-valued normalization of XCOALITION for use as a multiplier in derived metrics. Maps category 1→0.00, 2→0.25, 3→0.50, 4→0.75, 5→1.00.

**Source:** `XCOALITION`

**Algorithm:** `(XCOALITION - 1) / 4`

**Python:**
```python
df['XCOAL_NORM'] = (df['XCOALITION'].astype(float) - 1) / 4
```

---

## 5. Validity & penalty flag — **BUG FIX**

### `XSM2` — Validity composite flag

**Description:** Composite respondent validity check. Fires if respondent has either an overclaim flag from XSMr1 (social-media self-report inconsistency) OR a failed trap question on QSM2r3.

**Source:** `XSMr1`, `QSM2r3`

**Algorithm:**
```
XSM2 = 1  if  XSMr1 == 1  OR  QSM2r3 != 3
XSM2 = 0  otherwise
```

**⚠ Deployed XML bug:** The current XSM2 exec checks for QSM2r3 != c1 (Strongly Disagree). The trap question instructs respondents to select c3 (Somewhat Disagree). Result: 100% of compliant respondents are flagged. The Python module corrects this; the XML needs the same correction.

**Python (corrected):**
```python
overclaim_failed = (df['XSMr1'] == 1)
trap_failed = (df['QSM2r3'].notna()) & (df['QSM2r3'] != 3)
df['XSM2'] = (overclaim_failed | trap_failed).astype(int)
```

---

### `XPenalty` — Activation downweight multiplier

**Description:** Multiplier applied to ARS when respondent fails validity. Downweights the activation contribution by 40% for flagged cases.

**Source:** `XSM2`

**Algorithm:**
```
XPenalty = 0.6 if XSM2 == 1
XPenalty = 1.0 if XSM2 == 0
```

**Python:**
```python
df['XPenalty'] = np.where(df['XSM2'] == 1, 0.6, 1.0)
```

---

## 6. ARS — Action Readiness Score

### `XQP1`, `XQP2`, `XQP3` — Normalized 0-1 components

**Description:** Each of three readiness items normalized to 0-1 scale. QP1 and QP3 use 5-point scales with "Don't Know" as option 3; the DK option is recoded to the midpoint position (after rescale, value 4) so it doesn't artificially deflate. QP2 has no DK option.

**Source:** `QP1`, `QP2`, `QP3` (each 1-5)

**Algorithm:**
```
QP1, QP3:  remap {1→1, 2→2, 3→4, 4→5, 5→3} then (recoded - 1) / 4
QP2:       (raw - 1) / 4
```

**Python:**
```python
QP_RECODE = {1: 1, 2: 2, 3: 4, 4: 5, 5: 3}
df['XQP1'] = (df['QP1'].map(QP_RECODE) - 1) / 4
df['XQP2'] = (df['QP2'] - 1) / 4
df['XQP3'] = (df['QP3'].map(QP_RECODE) - 1) / 4
```

---

### `XQARS` — Weighted Action Readiness Score

**Description:** Calibrated weighted average of the three normalized readiness components. QP3 (issue-specific intent) carries the most weight. **PLATFORM LOCKED** — weights are not tunable per study.

**Source:** `XQP1`, `XQP2`, `XQP3`

**Algorithm:** `XQARS = 0.40 × XQP3 + 0.30 × XQP1 + 0.30 × XQP2`

**Python:**
```python
df['XQARS'] = 0.40 * df['XQP3'] + 0.30 * df['XQP1'] + 0.30 * df['XQP2']
```

---

### `XQARSadj` — Penalty-adjusted ARS

**Description:** ARS adjusted by validity penalty. Used as activation input to ROI calculations.

**Source:** `XQARS`, `XPenalty`

**Algorithm:** `XQARSadj = XQARS × XPenalty`

**Python:**
```python
df['XQARSadj'] = df['XQARS'] * df['XPenalty']
```

---

## 7. ROI components & categorization — **ISSUE-CALIBRATED**

### `XROIr1` through `XROIr7` — ROI subcomponents

**Description:** Decomposed ROI components. r1 = post-test alignment, r3 = persuasion contribution, r4 = coalition contribution, r5 = activation probability, r6 = activation contribution, r7 = total ROI score.

**Sources:** `XALIGN_POST`, `XALIGN_MOVE`, `XQARS`, `XQARSadj`, `XSMr4` (BCS)

**Algorithm:**
```
r1 = XALIGN_POST / 7
r2 = XALIGN_MOVE × (1 + BCS)
r3 = clip(XALIGN_MOVE / 0.8, 0, 1) × 40
r4 = r1 × 30
r5 = 1 / (1 + exp(-(-0.759 + 1.547·XQARS + 0.769·BCS)))
r6 = r5 × XQARSadj × 30
r7 = r3 + r4 + r6
```

**Python:**
```python
df['XROIr1'] = df['XALIGN_POST'] / 7
df['XROIr2'] = df['XALIGN_MOVE'] * (1 + df['XSMr4'])
df['XROIr3'] = (df['XALIGN_MOVE'] / 0.8).clip(lower=0, upper=1) * 40
df['XROIr4'] = df['XROIr1'] * 30

z = -0.759 + 1.547 * df['XQARS'] + 0.769 * df['XSMr4']
df['XROIr5'] = 1 / (1 + np.exp(-z))

df['XROIr6'] = df['XROIr5'] * df['XQARSadj'] * 30
df['XROIr7'] = df['XROIr3'] + df['XROIr4'] + df['XROIr6']
```

---

### `XROI_cat` — 5-category ROI classification

**Description:** ROI category for strategic targeting. HIV-calibrated thresholds — values may differ across PRISM studies; bin meanings (BACKFIRE / NO PERSUASION / PERSUADABLE / STRONG / HIGHEST) are constant.

**Source:** `XALIGN_MOVE`, `XALIGN_POST`, `XROIr5` (ACT_PROB)

**Algorithm:**
```
MOVE < 0                                            -> 1 (BACKFIRE)
MOVE > 0 AND ACT_PROB ≥ 0.50 AND POST ≥ 5.0          -> 5 (HIGHEST ROI)
MOVE > 0 AND ACT_PROB ≥ 0.25 AND POST ≥ 4.5          -> 4 (STRONG ROI)
MOVE > 0 (any other positive movement)              -> 3 (PERSUADABLE)
otherwise                                           -> 2 (NO PERSUASION)
```

**Python:**
```python
move, post, actprob = df['XALIGN_MOVE'], df['XALIGN_POST'], df['XROIr5']

cat = pd.Series(2, index=df.index, dtype='Int64')  # default NO PERSUASION
cat[(move > 0)] = 3
cat[(move > 0) & (actprob >= 0.25) & (post >= 4.5)] = 4
cat[(move > 0) & (actprob >= 0.50) & (post >= 5.0)] = 5
cat[(move < 0)] = 1

bad = move.isna() | post.isna() | actprob.isna()
cat[bad] = pd.NA

df['XROI_cat'] = cat
```

---

## Pipeline order

When running the full pipeline, dependencies require this order:

1. Demographic recodes (independent)
2. Item-level recodes (independent)
3. Item deltas (depend on item recodes)
4. Alignment composites (depend on item recodes)
5. Coalition categorization (depends on alignment)
6. Validity flag + penalty (depend on QSM2 / XSMr1)
7. ARS components → ARS → ARS adjusted (depend on QP1-3 and penalty)
8. ROI components (depend on alignment, ARS, BCS)
9. ROI categorization (depends on ROI components)

The `compute_all_prism(df)` function in `prism_composites.py` runs this order.

---

## Variables NOT recomputed by this module

These variables are computed upstream in Decipher and arrive in the SAV
pre-built. Documenting for reference; not implemented in Python.

| Variable | Source | Description |
|---|---|---|
| `XSEG_ASSIGNED` | Typing tool output | 16-segment PRISM assignment |
| `XSMr1` | QSM responses | Social media overclaim flag |
| `XSMr2` | QSM responses | L0_raw influence count (0-18) |
| `XSMr3` | QSM responses | L0 normalized influence (0-1) |
| `XSMr4` | Multiple inputs | BCS (Behavioral Capital Score, 0-1) |
| `XDEM_CONFIDENCE` | Typing tool | Segment assignment confidence (Dem branch) |
| `XGOP_CONFIDENCE` | Typing tool | Segment assignment confidence (GOP branch) |
| `QAGECAT5` | QAGE | 5-category age |
| `XQREGION` | ZIP code | 4-category Census region |
| `XEDU_CAT` | QEDU | 5-category education |
| `QREL_CAT` | QREL + QRACE + QEVANGEL | 7-category PRRI religion |

---

## Status against deployed Decipher XML

| Composite | Decipher | Python | Status |
|---|---|---|---|
| XALIGN_PRE / POST / MOVE | ✓ | ✓ | Match (after rank fix) |
| XCOALITION | ✓ | ✓ | Match |
| XCOAL_NORM | ✓ | ✓ | Match |
| XQARS, XQARSadj | ✓ | ✓ | Match |
| XQP1, XQP2, XQP3 | ✓ | ✓ | Match |
| XROI r1-r7 | ✓ | ✓ | Match |
| XROI_cat | ✓ | ✓ | Match |
| **XSM2** | **BUG** | ✓ | Python is correct, XML needs fix |
| XPenalty | uses broken XSM2 | ✓ | Python is correct |
| XQPRE_1r1, XPOST_1r1 | ✓ (deployed) | ✓ | Match (different constants due to .ival offset) |
| XQPRE_POST | ✓ | ✓ | Match |
| XQALIGN_PRE_C | ✓ | ✓ | Match (legacy boundaries) |
| XRACE_ETH | not built | ✓ | Python only |

---

## Maintenance

This document and `prism_composites.py` together are the canonical reference.
When any composite algorithm changes:

1. Update the algorithm in `prism_composites.py`
2. Update the corresponding section above
3. Add an entry to `PRISM_CHANGELOG.md` (if maintained)
4. Update the methodology one-pager for the affected study
