#!/usr/bin/env python3
"""
PRISM HIV Dashboard — one-command refresh.

For the analyst: this is the only Python command you ever need to run.
Given a fresh .sav from SPSS and an updated HIV_Study_Template.xlsx,
this script rebuilds every data file the dashboard reads:

    .sav  ──►  compute.py                ──►  dashboard.json
                                                  │
                                                  ├──►  src/data/topline/dashboard.json
                                                  │
                                                  ├──►  messagemap pipeline       (merged in)
                                                  │       (msg_map_cells, msg_topline, sop_simple,
                                                  │        variants, messages, baskets, lift_variants)
                                                  │
                                                  ├──►  derive_hiv_seg_data.py
                                                  │       └──►  src/data/hiv/*.json
                                                  │
    .xlsx ──►  extract_hiv.py            ──►  src/data/study.js
                                              src/data/studyData.js HIV block

Usage:
    python scripts/refresh.py
    python scripts/refresh.py --sav /path/to/file.sav
    python scripts/refresh.py --skip-pipeline    # only re-run the JS-data
                                                 # derivations (no .sav needed)
    python scripts/refresh.py --skip-messagemap  # skip the messagemap step
                                                 # (debugging only; module 05 will
                                                 # show placeholder if data absent)
    python scripts/refresh.py --commit           # also git add + commit + push

Defaults:
    --sav        ./data/260433.sav  (or $PRISM_SAV)
    --workbook   ./HIV_Study_Template.xlsx
    --weight     WGT
"""
import argparse
import json
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

MESSAGEMAP_DIR = REPO / 'messagemap'
MESSAGEMAP_VARIANTS_PARSER = MESSAGEMAP_DIR / 'src' / 'prism_variants_parser.py'
MESSAGEMAP_BUILDER         = MESSAGEMAP_DIR / 'src' / 'prism_build_dashboard.py'
MESSAGEMAP_VARIANTS_JSON   = MESSAGEMAP_DIR / 'outputs' / 'prism_variants.json'
MESSAGEMAP_VARIANTS_XLSX   = MESSAGEMAP_DIR / 'workbooks' / 'Gilead_Persona-Tuned_Message_Variants_json.xlsx'
MESSAGEMAP_DASHBOARD_OUT   = MESSAGEMAP_DIR / 'outputs' / 'dashboard.json'

# Sections of dashboard.json that the messagemap pipeline owns and that
# get folded into the topline dashboard.json after the messagemap step.
# Everything else in src/data/topline/dashboard.json stays compute_core-owned.
MESSAGEMAP_OWNED_TOPLEVEL = (
    'messages',
    'baskets',
    'lift_variants',
    'message_map_cells',
    'message_topline',
    'sop_simple',
    'variants',
)
# Sub-keys under 'study' that messagemap contributes (compute_core doesn't
# compute a persuasion index or residualization; messagemap does).
MESSAGEMAP_STUDY_SUBKEYS = ('index', 'residualization')


def step(label):
    print()
    print(f"━━━ {label} ━━━")


def run(cmd, cwd=None, env=None):
    """Run a subprocess, stream output, exit on failure."""
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd, env=env)
    if result.returncode != 0:
        sys.exit(f"  ✗ Command failed (exit {result.returncode}). Stopping.")


def merge_messagemap_into_topline(messagemap_path, topline_path):
    """Fold the messagemap-owned sections of `messagemap_path` into
    `topline_path` (in place). Compute_core-owned content is preserved."""
    with open(messagemap_path, encoding='utf-8') as f:
        mm = json.load(f)
    with open(topline_path, encoding='utf-8') as f:
        topline = json.load(f)

    # Add the messagemap-owned top-level sections wholesale.
    for key in MESSAGEMAP_OWNED_TOPLEVEL:
        if key in mm:
            topline[key] = mm[key]

    # Merge messagemap's study sub-keys (index, residualization) without
    # clobbering compute_core's study metadata (title, methodology, etc.).
    if 'study' in mm and 'study' in topline:
        for key in MESSAGEMAP_STUDY_SUBKEYS:
            if key in mm['study']:
                topline['study'][key] = mm['study'][key]

    with open(topline_path, 'w', encoding='utf-8') as f:
        json.dump(topline, f, indent=2, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sav', default=DEFAULT_SAV, help=f'.sav file (default: {DEFAULT_SAV})')
    ap.add_argument('--workbook', default=DEFAULT_WORKBOOK, help=f'workbook (default: {DEFAULT_WORKBOOK})')
    ap.add_argument('--weight', default=DEFAULT_WEIGHT, help=f'weight variable (default: {DEFAULT_WEIGHT})')
    ap.add_argument('--skip-pipeline', action='store_true',
                    help='Skip the .sav→dashboard.json pipeline (re-run derivations only)')
    ap.add_argument('--skip-messagemap', action='store_true',
                    help='Skip the messagemap step (module 05 will show placeholder)')
    ap.add_argument('--commit', action='store_true',
                    help='git add + commit + push after refresh')
    args = ap.parse_args()

    sav = Path(args.sav)
    workbook = Path(args.workbook)

    # ── 1. Topline pipeline (.sav → dashboard.json) ────────────────
    if not args.skip_pipeline:
        step("1/5  Topline pipeline (compute_core)")
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
        step("2/5  Copy dashboard.json → src/data/topline/")
        if not TOPLINE_DASHBOARD_OUT.exists():
            sys.exit(f"  ✗ Pipeline did not produce {TOPLINE_DASHBOARD_OUT}.")
        TOPLINE_DASHBOARD_DEST.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TOPLINE_DASHBOARD_OUT, TOPLINE_DASHBOARD_DEST)
        print(f"  ✓ {TOPLINE_DASHBOARD_DEST}")
    else:
        step("1/5  Topline pipeline — SKIPPED (--skip-pipeline)")
        step("2/5  Copy dashboard.json — SKIPPED")
        if not TOPLINE_DASHBOARD_DEST.exists():
            sys.exit(f"  ✗ {TOPLINE_DASHBOARD_DEST} not present; cannot derive.")

    # ── 3. Messagemap pipeline (merged into src/data/topline/dashboard.json) ──
    # Independent of compute_core: messagemap reads the same .sav directly
    # and produces its own dashboard.json with the message-test sections.
    # Runs whenever the .sav is available, even if --skip-pipeline was used
    # (so the analyst can rebuild messagemap-only when the topline hasn't
    # changed).
    if args.skip_messagemap or not sav.exists():
        reason = "--skip-messagemap" if args.skip_messagemap else f".sav not found ({sav})"
        step(f"3/5  Messagemap — SKIPPED ({reason})")
    else:
        step("3/5  Messagemap pipeline (cells + topline + variants → merged)")
        if not MESSAGEMAP_VARIANTS_XLSX.exists():
            sys.exit(f"  ✗ Variants workbook not found: {MESSAGEMAP_VARIANTS_XLSX}")
        # 3a. Re-parse variants workbook if it's newer than the cached JSON
        if (not MESSAGEMAP_VARIANTS_JSON.exists()
                or MESSAGEMAP_VARIANTS_XLSX.stat().st_mtime > MESSAGEMAP_VARIANTS_JSON.stat().st_mtime):
            print("  Variants workbook is newer than cached JSON; reparsing.")
            run([sys.executable, str(MESSAGEMAP_VARIANTS_PARSER)], cwd=REPO)
        # 3b. Run the messagemap pipeline (consumes the same .sav)
        env = os.environ.copy()
        env['PRISM_SAV'] = str(sav)
        run([sys.executable, str(MESSAGEMAP_BUILDER)], cwd=REPO, env=env)
        # 3c. Merge messagemap-owned sections into src/data/topline/dashboard.json
        if not MESSAGEMAP_DASHBOARD_OUT.exists():
            sys.exit(f"  ✗ Messagemap did not produce {MESSAGEMAP_DASHBOARD_OUT}.")
        merge_messagemap_into_topline(MESSAGEMAP_DASHBOARD_OUT, TOPLINE_DASHBOARD_DEST)
        print(f"  ✓ Merged into {TOPLINE_DASHBOARD_DEST}")

    # ── 4. HIV-tab data derivation ────────────────────────────────
    step("4/5  HIV-tab data (derive_hiv_seg_data)")
    run([sys.executable, 'scripts/derive_hiv_seg_data.py'], cwd=REPO)

    # ── 5. Workbook → study.js + studyData.js HIV block ───────────
    step("5/5  Workbook → study.js / studyData.js (extract_hiv)")
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
