"""
PRISM Platform — the canonical implementation of Reservoir Communications
Group's 16-segment psychographic analytics system.

Studies are *configured* against this package (studies/*.yaml); they are
never embedded in it. The package is the system of record for composite
scoring, activation modeling, data-quality flags, and two-stage weighting.
The dashboard layer (separate concern) consumes the weighted SAV this
package emits.

Locked build decisions (Jun 2026 review with the analyst):
  - Canonical variable naming going forward: XQPRE_1, XQPRE_2, ... —
    legacy suffixes (r1r1 etc.) resolve through per-study legacy_rename.
  - Activation logistic: form platform-locked (OPTIN_BINARY ~ ARS + BCS);
    all three coefficients fit per study from Wave 1 data; subsequent
    waves apply locked Wave 1 coefficients (activation.calibration_mode).
  - Weighting: joint-convergence two-stage rake (demographic margins AND
    segment margins both enforced to tolerance; supersedes the one-pass
    prototype).
  - Decipher columns in input SAVs: recomputed in Python AND audited
    (side-by-side CSV, mismatches flagged). Decipher code emission from
    YAML is deferred to v2.
  - The weight column is WEIGHT. There is exactly one weight variable
    end to end; the dashboard's legacy WGT convention is retired.
  - Reference tests: composites + DQ flags byte-reproduce the prototype
    references; weights are validated structurally (sum-to-N, on-target
    margins), not bit-reproduced (the algorithm improved).
  - Sample drops: the package always emits the full weighted dataset
    with DQ flags. Drops are downstream policy declared in study YAML
    (exclusions:). Historical HIV N=2,578 is grandfathered as manual.
  - Segment shares: this package owns the canonical values
    (benchmarks.segments_v1); the dashboard imports them at refresh
    time (display projection = largest-remainder rounding to percent).
"""

__version__ = "0.1.0"
