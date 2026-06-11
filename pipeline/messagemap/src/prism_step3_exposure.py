"""
PRISM step 3: build respondent × message exposure matrix.

For each respondent and each MaxDiff task, reconstruct:
- which 4 items they saw (from design file + QHIV_Version + task)
- which framing arm they were in (HIV_RANDOM)
- for each item, which proof variant they were assigned (HIV_R{n})
- which item they picked best, which worst

Aggregates to respondent × item level: exposure count, best count, worst count,
and the Best-Worst score per message per respondent.

Reproducibility: study config block at top declares item-to-proof mapping;
engine handles the rest.
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict


# ═════════════════════════════════════════════════════════════════════
# STUDY CONFIG (PRISM_HIV_2026)
# ─────────────────────────────────────────────────────────────────────
# Verified from the survey XML:
#   - 17 message items (QHIV_Item1...QHIV_Item17)
#   - 12 proof-bearing items mapped to HIV_R1..HIV_R12 (irregular pairing)
#   - 5 special items (7,8,9,14,17) with no proof variants
#   - Within each item's row table:
#       r1               = CORE base (no proof)
#       r2..r17          = 16 segment-tuned, no proof  (seg = row_idx - 1)
#       r18              = CORE + proof A
#       r19..r34         = 16 segment-tuned + proof A   (seg = row_idx - 18)
#       r35              = CORE + proof B
#       r36..r51         = 16 segment-tuned + proof B   (seg = row_idx - 35)
# ═════════════════════════════════════════════════════════════════════

# Config-driven (study/study.yaml): maxdiff_messages declares the
# per-message token-value counts; sav_conventions + legacy_rename
# resolve the raw .sav variable names (HIV_R*, QHIV_*best, HIV_RANDOM).
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[2]))
from study_config import (load_config as _load_config,
                          message_config as _message_config,
                          n_messages as _n_messages,
                          task_vars as _task_vars,
                          sav_vars as _sav_vars)

_cfg = _load_config()
MESSAGE_CONFIG = _message_config(_cfg)
N_TASKS = _cfg['maxdiff']['n_tasks']
ITEMS_PER_TASK = _cfg['maxdiff']['items_per_task']
N_ITEMS = _n_messages(_cfg)
TASK_VARS = _task_vars(_cfg)               # {task: (best_var, worst_var)}
_SV = _sav_vars(_cfg)
ARM_VAR = _SV['arm']                       # HIV_RANDOM   (1=PERSONA, 2=CORE)
SEG_VAR = _SV['segment']                   # XSEG_ASSIGNED
VERSION_VAR = _SV['design_version']        # QHIV_Version
RECORD_VAR = _SV['record_id']              # record


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def load_design(design_path: str) -> Dict[Tuple[int, int], list]:
    """
    Load the design file. Returns dict: (version, set) -> [item1, item2, item3, item4].
    """
    d = pd.read_csv(design_path, sep='\t')
    return {
        (int(row['Version']), int(row['Set'])): [
            int(row['Item1']), int(row['Item2']), int(row['Item3']), int(row['Item4'])
        ]
        for _, row in d.iterrows()
    }


def decode_proof_variant(hiv_r_val) -> int:
    """
    HIV_R{n} values: 1.0='A', 2.0='B', 3.0='C'.
    Returns 1, 2, or 3 (or 0 if missing/no-proof message).
    """
    if pd.isna(hiv_r_val):
        return 0
    return int(hiv_r_val)


# ─────────────────────────────────────────────────────────────────────
# Step 3: build exposure matrix
# ─────────────────────────────────────────────────────────────────────

def build_exposure_matrix(
    df: pd.DataFrame,
    design_path: str,
    message_config: list = MESSAGE_CONFIG,
    n_tasks: int = N_TASKS,
    n_items: int = N_ITEMS,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict]:
    """
    Reconstruct full exposure history per respondent.

    Returns:
        exposure_long: long-format respondent × item dataframe with columns:
            record_id, item, framing_arm, proof_variant, segment,
            n_shown, n_best, n_worst, bw_score
        task_long: long-format respondent × task dataframe with columns:
            record_id, task, item_shown_1..4, best_item, worst_item,
            framing_arm, segment
        diag: diagnostics dict
    """
    design = load_design(design_path)
    msg_by_item = {m['item']: m for m in message_config}

    # Required columns
    required = [VERSION_VAR, ARM_VAR, SEG_VAR]
    required += [TASK_VARS[t][0] for t in range(1, n_tasks + 1)]
    required += [TASK_VARS[t][1] for t in range(1, n_tasks + 1)]
    required += [m['proof_var'] for m in message_config if m['proof_var']]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Required columns missing: {missing}")

    # Use record_id if present, otherwise row index
    rec_col = RECORD_VAR if RECORD_VAR in df.columns else None
    
    task_rows = []
    exposure_acc = {}  # (record_id, item) -> {n_shown, n_best, n_worst, framing, proof, segment}

    for idx, row in df.iterrows():
        rec_id = row[rec_col] if rec_col else idx
        version = int(row[VERSION_VAR]) if not pd.isna(row[VERSION_VAR]) else None
        if version is None:
            continue
        arm = int(row[ARM_VAR])  # 1=PERSONA, 2=CORE
        seg = int(row[SEG_VAR]) if not pd.isna(row[SEG_VAR]) else None

        for t in range(1, n_tasks + 1):
            key = (version, t)
            if key not in design:
                continue
            items_shown = design[key]
            best_val = row[TASK_VARS[t][0]]
            worst_val = row[TASK_VARS[t][1]]
            # best/worst values are indices into the SHOWN items (1-4),
            # we need to decode which actual item number that was.
            # In Decipher MaxDiff outputs, the best/worst columns store
            # the row label index of the chosen item (1-17 for items).
            # Verify which encoding by checking the value range.
            best_item = int(best_val) if not pd.isna(best_val) else None
            worst_item = int(worst_val) if not pd.isna(worst_val) else None

            task_rows.append({
                'record_id': rec_id,
                'task': t,
                'version': version,
                'item_1': items_shown[0],
                'item_2': items_shown[1],
                'item_3': items_shown[2],
                'item_4': items_shown[3],
                'best_item': best_item,
                'worst_item': worst_item,
                'framing_arm': arm,
                'segment': seg,
            })

            # Accumulate exposure per item
            for item in items_shown:
                ek = (rec_id, item)
                if ek not in exposure_acc:
                    proof_var = msg_by_item[item]['proof_var']
                    proof = decode_proof_variant(row[proof_var]) if proof_var else 0
                    exposure_acc[ek] = {
                        'record_id': rec_id, 'item': item,
                        'framing_arm': arm, 'proof_variant': proof,
                        'segment': seg,
                        'n_shown': 0, 'n_best': 0, 'n_worst': 0,
                    }
                exposure_acc[ek]['n_shown'] += 1
                if item == best_item:
                    exposure_acc[ek]['n_best'] += 1
                if item == worst_item:
                    exposure_acc[ek]['n_worst'] += 1

    task_long = pd.DataFrame(task_rows)
    exposure_long = pd.DataFrame(exposure_acc.values())
    exposure_long['bw_score'] = exposure_long['n_best'] - exposure_long['n_worst']

    # Diagnostics
    diag = {
        'n_respondents': df[rec_col].nunique() if rec_col else len(df),
        'n_tasks_per_respondent': n_tasks,
        'n_items': n_items,
        'total_task_rows': len(task_long),
        'total_exposure_rows': len(exposure_long),
        'arm_distribution': df[ARM_VAR].value_counts().to_dict(),
        'mean_exposures_per_item': exposure_long.groupby('item')['n_shown'].sum().mean(),
        'best_pick_rate': float(task_long['best_item'].notna().mean()),
        'worst_pick_rate': float(task_long['worst_item'].notna().mean()),
        'bw_score_range': [int(exposure_long['bw_score'].min()),
                           int(exposure_long['bw_score'].max())],
        'bw_score_mean_by_item': exposure_long.groupby('item')['bw_score'].mean().to_dict(),
    }

    return exposure_long, task_long, diag


# ═════════════════════════════════════════════════════════════════════
# Test on the real HIV .sav
# ═════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import pyreadstat
    print("Loading data...")
    df, meta = pyreadstat.read_sav('/mnt/user-data/uploads/260433.sav')
    print(f"  n={len(df)} respondents")

    print("\n" + "=" * 72)
    print("STEP 3: build exposure matrix")
    print("=" * 72)
    exposure, tasks, diag = build_exposure_matrix(
        df,
        design_path='/mnt/user-data/uploads/Gilead_Design_File.dat'
    )

    print(f"\nProcessed:")
    print(f"  {diag['n_respondents']} respondents × {diag['n_tasks_per_respondent']} tasks = {diag['total_task_rows']:,} task observations")
    print(f"  {diag['total_exposure_rows']:,} respondent × item exposure records")
    print(f"  Mean total exposures per item: {diag['mean_exposures_per_item']:.0f}")
    print(f"  Best pick rate: {diag['best_pick_rate']:.1%}, Worst pick rate: {diag['worst_pick_rate']:.1%}")
    print(f"  B-W score range: {diag['bw_score_range']}")

    print("\nB-W score by message (sample mean = preference signal):")
    print(f"  {'Item':>4s}  {'Mean B-W':>9s}")
    for item in sorted(diag['bw_score_mean_by_item'].keys()):
        bw = diag['bw_score_mean_by_item'][item]
        marker = '★' if bw > 0.1 else ('!' if bw < -0.1 else ' ')
        print(f"  {item:4d}  {bw:+9.3f}  {marker}")

    print("\nFraming arm × proof variant distribution (across all exposures):")
    cross = exposure.groupby(['framing_arm', 'proof_variant'])['n_shown'].sum().unstack(fill_value=0)
    cross.columns = [f'proof={c}' for c in cross.columns]
    cross.index = [f'arm={i} ({"PERSONA" if i==1 else "CORE"})' for i in cross.index]
    print(cross.to_string())

    # Save for downstream use
    exposure.to_csv('/home/claude/prism_exposure_long.csv', index=False)
    tasks.to_csv('/home/claude/prism_tasks_long.csv', index=False)
    print(f"\nWrote /home/claude/prism_exposure_long.csv ({len(exposure):,} rows)")
    print(f"Wrote /home/claude/prism_tasks_long.csv ({len(tasks):,} rows)")
