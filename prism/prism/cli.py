"""
PRISM command-line interface.

    prism run studies/hiv_wave1.yaml data/INPUT.sav --output out/
    prism run ... --dry-run            # validate config + SAV columns only
    prism validate studies/hiv_wave1.yaml
    prism diagnose out/hiv_wave1_weighted.sav
"""

import argparse
import sys


def _required_columns(cfg):
    c, a, w, q = cfg.composites, cfg.activation, cfg.weighting, cfg.quality
    cols = {c.race_var, c.priority_rank_pre, c.priority_rank_post,
            c.trap_var, c.overclaim_var, c.bcs_var,
            *c.reverse_coded.keys(), *c.ars_items.values(),
            a.optin_var, *(f["var"] for f in a.behavioral_cost_fields),
            w.segment_var, *(m["var"] for m in w.variable_mapping.values()),
            q.qtime_var, q.maxdiff_timer_var,
            *q.straightline_pre_items, *q.straightline_post_items,
            *q.noise_pre_items, *q.noise_post_items}
    # post-recode names the composites create themselves are not inputs
    return sorted(cols - set(c.reverse_coded.values()))


def cmd_validate(args):
    from .studies import load_study_config
    cfg = load_study_config(args.config)
    print(f"OK: {args.config} validates "
          f"(study {cfg.study_id}, population "
          f"{cfg.survey_population.population_id})")
    return 0


def cmd_run(args):
    from .studies import load_study_config
    cfg = load_study_config(args.config)
    if args.dry_run:
        import pyreadstat
        meta = pyreadstat.read_sav(args.input_sav, metadataonly=True)[1]
        missing = [c for c in _required_columns(cfg)
                   if c not in set(meta.column_names)]
        if missing:
            print(f"DRY-RUN FAIL: {len(missing)} required columns missing "
                  f"from {args.input_sav}:")
            for c in missing:
                print(f"  - {c}")
            return 1
        print(f"DRY-RUN OK: config validates and all "
              f"{len(_required_columns(cfg))} required columns present "
              f"(N={meta.number_rows})")
        return 0
    from .pipeline import run_study
    result = run_study(args.config, args.input_sav, args.output)
    for k, v in result.items():
        if k.endswith(("_sav", "_csv", "_md")):
            print(f"  {k}: {v}")
    return 0


def cmd_diagnose(args):
    import pyreadstat
    from .weighting import weight_diagnostics
    df, _ = pyreadstat.read_sav(args.weighted_sav)
    if "WEIGHT" not in df.columns:
        print(f"ERROR: no WEIGHT column in {args.weighted_sav}")
        return 1
    d = weight_diagnostics(df)
    for k, v in d.items():
        print(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="prism",
                                description="PRISM analytics platform")
    sub = p.add_subparsers(dest="cmd", required=True)

    pr = sub.add_parser("run", help="run the full pipeline")
    pr.add_argument("config")
    pr.add_argument("input_sav")
    pr.add_argument("--output", default="output/")
    pr.add_argument("--dry-run", action="store_true")
    pr.set_defaults(fn=cmd_run)

    pv = sub.add_parser("validate", help="validate a study YAML")
    pv.add_argument("config")
    pv.set_defaults(fn=cmd_validate)

    pd_ = sub.add_parser("diagnose", help="weight diagnostics on a SAV")
    pd_.add_argument("weighted_sav")
    pd_.set_defaults(fn=cmd_diagnose)

    args = p.parse_args(argv)
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()
