"""
PRISM Topline — standalone CLI entry point.

Reads a .sav file via pyreadstat and calls build_topline().
For the SPSS-active-dataset entry point, see build_from_spss.sps.

Usage:  python compute.py
"""
import pyreadstat
from pathlib import Path
from compute_core import build_topline

# ─────────────────────────────────────────────────────────
# Edit per study
# ─────────────────────────────────────────────────────────
SAV = '/home/claude/data/260433.sav'
OUT_DIR = Path(__file__).parent

# Optional: name of weight variable in the .sav.
# Production rake weights live in WGT.
WEIGHT_VAR = 'WGT'

if __name__ == '__main__':
    print(f"Reading {SAV} …")
    df, _meta = pyreadstat.read_sav(SAV)
    print(f"Loaded {len(df):,} rows × {len(df.columns)} columns")
    build_topline(df, out_dir=OUT_DIR, weight_var=WEIGHT_VAR)
