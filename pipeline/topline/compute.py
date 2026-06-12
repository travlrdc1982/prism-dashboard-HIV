"""
PRISM Topline — standalone CLI entry point.

Reads a .sav file via pyreadstat and calls build_topline().
For the SPSS-active-dataset entry point, see build_from_spss.sps.

Usage:
    python compute.py [--sav PATH] [--out-dir DIR] [--weight VAR]
    python compute.py                # uses defaults / env vars
    PRISM_SAV=/path/to/file.sav python compute.py

Environment variables (used as defaults when CLI flags omitted):
    PRISM_SAV     — path to the .sav file
    PRISM_OUT     — output directory for dashboard.json
    PRISM_WEIGHT  — weight variable name (default: WEIGHT)
"""
import argparse
import os
import sys
from pathlib import Path
import pyreadstat
from compute_core import build_topline

DEFAULT_SAV = os.environ.get('PRISM_SAV', '/home/claude/data/260433.sav')
DEFAULT_OUT = os.environ.get('PRISM_OUT', str(Path(__file__).parent))
DEFAULT_WEIGHT = os.environ.get('PRISM_WEIGHT', 'WEIGHT')


def main():
    ap = argparse.ArgumentParser(description='Build PRISM topline dashboard.json from a .sav file.')
    ap.add_argument('--sav', default=DEFAULT_SAV, help=f'Path to .sav file (default: {DEFAULT_SAV})')
    ap.add_argument('--out-dir', default=DEFAULT_OUT, help=f'Output directory (default: {DEFAULT_OUT})')
    ap.add_argument('--weight', default=DEFAULT_WEIGHT, help=f'Weight variable name (default: {DEFAULT_WEIGHT})')
    args = ap.parse_args()

    sav_path = Path(args.sav)
    if not sav_path.exists():
        sys.exit(f"ERROR: .sav file not found at {sav_path}\n"
                 f"Pass --sav PATH or set PRISM_SAV env var.")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Reading {sav_path} ...")
    df, _meta = pyreadstat.read_sav(str(sav_path))
    print(f"Loaded {len(df):,} rows × {len(df.columns)} columns")
    build_topline(df, out_dir=out_dir, weight_var=args.weight)
    print(f"Wrote dashboard.json to {out_dir / 'dashboard.json'}")


if __name__ == '__main__':
    main()
