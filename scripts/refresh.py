#!/usr/bin/env python3
"""
PRISM HIV Dashboard — one-command refresh.

For the analyst: this is the only Python command you ever need to run.
Given a fresh .sav from SPSS and an updated HIV_Study_Template.xlsx,
this script rebuilds every data file the dashboard reads:

    .sav  ──►  compute.py        ──►  dashboard.json
                                            │
                                            ├──►  src/data/topline/dashboard.json
                                            │
                                            ├──►  derive_hiv_seg_data.py
                                            │       └──►  src/data/hiv/*.json
                                            │
    .xlsx ──►  extract_hiv.py    ──►  src/data/study.js
                                       src/data/studyData.js HIV block

Usage:
    python scripts/refresh.py
    python scripts/refresh.py --sav /path/to/file.sav
    python scripts/refresh.py --skip-pipeline    # only re-run the JS-data
                                                 # derivations (no .sav needed)
    python scripts/refresh.py --commit           # also git add + commit + push

Defaults:
    --sav        ./data/260433.sav  (or $PRISM_SAV)
    --workbook   ./HIV_Study_Template.xlsx
    --weight     WGT
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SAV = os.environ.get('PRISM_SAV', str(REPO / 'data' / '260433.sav'))
DEFAULT_WORKBOOK = str(REPO / 'HIV_Study_Template.xlsx')
DEFAULT_WEIGHT = os.environ.get('PRISM_WEIGHT', 'WGT')

PIPELINE_DIR = REPO / 'src' / 'components' / 'Topline' / 'ToplineDashboard'
TOPLINE_DASHBOARD_OUT = PIPELINE_DIR / 'dashboard.json'
TOPLINE_DASHBOARD_DEST = REPO / 'src' / 'data' / 'topline' / 'dashboard.json'


def step(label):
    print()
    print(f"━━━ {label} ━━━")


def run(cmd, cwd=None, env=None):
    """Run a subprocess, stream output, exit on failure."""
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd, env=env)
    if result.returncode != 0:
        sys.exit(f"  ✗ Command failed (exit {result.returncode}). Stopping.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sav', default=DEFAULT_SAV, help=f'.sav file (default: {DEFAULT_SAV})')
    ap.add_argument('--workbook', default=DEFAULT_WORKBOOK, help=f'workbook (default: {DEFAULT_WORKBOOK})')
    ap.add_argument('--weight', default=DEFAULT_WEIGHT, help=f'weight variable (default: {DEFAULT_WEIGHT})')
    ap.add_argument('--skip-pipeline', action='store_true',
                    help='Skip the .sav→dashboard.json pipeline (re-run derivations only)')
    ap.add_argument('--commit', action='store_true',
                    help='git add + commit + push after refresh')
    args = ap.parse_args()

    sav = Path(args.sav)
    workbook = Path(args.workbook)

    # ── 1. Topline pipeline (.sav → dashboard.json) ────────────────
    if not args.skip_pipeline:
        step("1/4  Topline pipeline (compute_core)")
        if not sav.exists():
            sys.exit(f"  ✗ .sav not found: {sav}\n"
                     f"     Drop your SPSS export there, pass --sav PATH, or set PRISM_SAV.")
        env = os.environ.copy()
        env['PRISM_SAV'] = str(sav)
        env['PRISM_WEIGHT'] = args.weight
        # compute.py is in the pipeline dir; run it from there so imports resolve.
        run([sys.executable, str(PIPELINE_DIR / 'compute.py'),
             '--sav', str(sav), '--out-dir', str(PIPELINE_DIR), '--weight', args.weight],
            cwd=PIPELINE_DIR, env=env)

        # ── 2. Copy fresh dashboard.json into src/data/topline ──────
        step("2/4  Copy dashboard.json → src/data/topline/")
        if not TOPLINE_DASHBOARD_OUT.exists():
            sys.exit(f"  ✗ Pipeline did not produce {TOPLINE_DASHBOARD_OUT}.")
        TOPLINE_DASHBOARD_DEST.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TOPLINE_DASHBOARD_OUT, TOPLINE_DASHBOARD_DEST)
        print(f"  ✓ {TOPLINE_DASHBOARD_DEST}")
    else:
        step("1/4  Topline pipeline — SKIPPED (--skip-pipeline)")
        step("2/4  Copy dashboard.json — SKIPPED")
        if not TOPLINE_DASHBOARD_DEST.exists():
            sys.exit(f"  ✗ {TOPLINE_DASHBOARD_DEST} not present; cannot derive.")

    # ── 3. HIV-tab data derivation ────────────────────────────────
    step("3/4  HIV-tab data (derive_hiv_seg_data)")
    run([sys.executable, 'scripts/derive_hiv_seg_data.py'], cwd=REPO)

    # ── 4. Workbook → study.js + studyData.js HIV block ───────────
    step("4/4  Workbook → study.js / studyData.js (extract_hiv)")
    if not workbook.exists():
        sys.exit(f"  ✗ Workbook not found: {workbook}")
    # extract_hiv.py reads HIV_Study_Template.xlsx from cwd
    run([sys.executable, 'extract_hiv.py'], cwd=REPO)

    print()
    print("═══ Refresh complete ═══")
    print("  src/data/topline/dashboard.json   ← pipeline output")
    print("  src/data/hiv/*.json               ← derived from dashboard.json")
    print("  src/data/study.js                 ← from workbook")
    print("  src/data/studyData.js (HIV block) ← from workbook")

    if args.commit:
        step("git commit + push")
        run(['git', 'add',
             'src/data/topline/dashboard.json',
             'src/data/hiv/',
             'src/data/study.js',
             'src/data/studyData.js'], cwd=REPO)
        # Only commit if there are staged changes
        diff = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=REPO).returncode
        if diff == 0:
            print("  (no changes to commit)")
        else:
            run(['git', 'commit', '-m', 'data: refresh from latest .sav + workbook'], cwd=REPO)
            run(['git', 'push'], cwd=REPO)
            print("  ✓ pushed — Vercel will redeploy")
    else:
        print()
        print("Next step: review the diff and `git push` when ready, or rerun")
        print("           with --commit to do it automatically.")


if __name__ == '__main__':
    main()
