# PRISM Platform

The canonical Python implementation of Reservoir Communications Group's
16-segment PRISM analytics system: composite scoring, activation
modeling, data-quality flags, and two-stage weighting.

**This package is the platform. Studies are configured against it, never
embedded in it.** It is the system of record for all PRISM analytics;
Decipher continues to field surveys, but composites and weighting live
here. The dashboard layer (the rest of this repo) consumes the weighted
SAV this package emits.

> Lift-out note: this package is self-contained (own pyproject, own
> tests) and is designed to move to its own repository unchanged. It
> lives here temporarily for build convenience.

## Quickstart

```bash
pip install -e .[dev]
pytest                       # benchmark + chain tests
```

```python
from prism.benchmarks import PRISM_SEGMENTS_V1
from prism.benchmarks.populations import get_population

PRISM_SEGMENTS_V1.pop_share("GHI")     # 0.1027 — full precision
get_population("voters_v1")            # Stage-1 rake target (DEM/GOP)
```

## Status

| Module | State |
| --- | --- |
| `benchmarks/segments_v1` | ✅ locked values, tested |
| `benchmarks/populations` | ✅ voters_v1 real; us_adults / seniors_ma / pregnant_parents are guarded placeholders |
| `quality/` (DQ flags) | ✅ byte-reproduces the reference flags |
| `composites/` | ✅ byte-equivalent to the frozen prototype; Decipher audit encoded |
| `activation/` | ✅ outcomes prototype-equivalent; per-study fit runs on HIV Wave 1 |
| `weighting/` (joint-convergence rake) | ✅ vectorized IPF; both margin sets enforced; trim-limited residuals reported |
| `studies/` + YAML schema | ⏳ |
| `pipeline.py` + CLI | ⏳ |

The locked build decisions from the analyst review are recorded in
`prism/__init__.py`'s docstring.
