"""
PRISM Segments — Canonical Population Benchmark v1.0
=====================================================

The 16 PRISM segments and their U.S. adult population shares.

PROVENANCE
----------
Population shares estimated during PRISM model development, validated
against subsequent normative reference samples, locked as platform
canonical benchmark in May 2026 from the PRISM_WEIGHTING reference file.

Values stored at full source precision (not rounded). Dashboard displays
typically round to integer percentage; analysis uses full precision.
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class PrismSegmentBenchmark:
    """Immutable population-benchmark container for the 16-segment PRISM model."""

    benchmark_id: str
    version: str
    last_updated: str
    calibration_source: str
    segments: Dict[str, Dict] = field(default_factory=dict)

    def pop_share(self, code: str) -> float:
        return self.segments[code]['pop_share']

    def pop_share_pct(self, code: str) -> str:
        return f"Pop {int(round(self.segments[code]['pop_share'] * 100))}%"

    def name(self, code: str) -> str:
        return self.segments[code]['name']

    def cluster(self, code: str) -> str:
        return self.segments[code]['cluster']

    def codes(self):
        return list(self.segments.keys())

    def gop_segments(self):
        return {k: v for k, v in self.segments.items() if v['cluster'] == 'GOP'}

    def dem_segments(self):
        return {k: v for k, v in self.segments.items() if v['cluster'] == 'DEM'}

    def codes_in_cluster(self, cluster: str):
        return [k for k, v in self.segments.items() if v['cluster'] == cluster]

    def as_dict(self):
        return {k: v['pop_share'] for k, v in self.segments.items()}

    def total(self):
        return sum(v['pop_share'] for v in self.segments.values())

    def validate(self):
        total = self.total()
        assert abs(total - 1.0) <= 0.005, f"Population shares sum to {total}, not 1.0 (±0.005)"
        assert len(self.segments) == 16, f"Expected 16 segments, got {len(self.segments)}"
        for code, info in self.segments.items():
            assert info['cluster'] in ('GOP', 'DEM'), f"{code} has invalid cluster"
            assert 0 < info['pop_share'] < 1, f"{code} pop_share out of range"
        return True


PRISM_SEGMENTS_V1 = PrismSegmentBenchmark(
    benchmark_id="prism_segments_v1",
    version="1.0",
    last_updated="2026-05-15",
    calibration_source=(
        "PRISM model development calibration, validated against normative "
        "reference samples. Locked from PRISM_WEIGHTING.xlsx, May 2026."
    ),
    segments={
        # ---- GOP cluster (1-10) ----
        'TSP':  {'rank':  1, 'name': 'Trust the Science Pragmatists',     'cluster': 'GOP', 'pop_share': 0.0240},
        'CEC':  {'rank':  2, 'name': 'Consumer Empowerment Champions',    'cluster': 'GOP', 'pop_share': 0.0649},
        'TC':   {'rank':  3, 'name': 'Traditional Conservatives',         'cluster': 'GOP', 'pop_share': 0.0567},
        'HF':   {'rank':  4, 'name': 'Health Futurists',                  'cluster': 'GOP', 'pop_share': 0.0227},
        'PP':   {'rank':  5, 'name': 'Price Populists',                   'cluster': 'GOP', 'pop_share': 0.0245},
        'WE':   {'rank':  6, 'name': 'Wellness Evangelists',              'cluster': 'GOP', 'pop_share': 0.0912},
        'PFF':  {'rank':  7, 'name': 'Paleo Freedom Fighters',            'cluster': 'GOP', 'pop_share': 0.0426},
        'HHN':  {'rank':  8, 'name': 'Holistic Health Naturalists',       'cluster': 'GOP', 'pop_share': 0.0268},
        'MFL':  {'rank':  9, 'name': 'Medical Freedom Libertarians',      'cluster': 'GOP', 'pop_share': 0.0504},
        'VS':   {'rank': 10, 'name': 'Vaccine Skeptics',                  'cluster': 'GOP', 'pop_share': 0.0499},

        # ---- Democratic cluster (11-16) ----
        'UCP':  {'rank': 11, 'name': 'Universal Care Progressives',       'cluster': 'DEM', 'pop_share': 0.1093},
        'FJP':  {'rank': 12, 'name': 'Faith & Justice Progressives',      'cluster': 'DEM', 'pop_share': 0.1022},
        'HCP':  {'rank': 13, 'name': 'Health Care Protectionists',        'cluster': 'DEM', 'pop_share': 0.0781},
        'HAD':  {'rank': 14, 'name': 'Health Abundance Democrats',        'cluster': 'DEM', 'pop_share': 0.0836},
        'HCI':  {'rank': 15, 'name': 'Health Care Incrementalists',       'cluster': 'DEM', 'pop_share': 0.0705},
        'GHI':  {'rank': 16, 'name': 'Global Health Institutionalists',   'cluster': 'DEM', 'pop_share': 0.1027},
    },
)


if __name__ == "__main__":
    PRISM_SEGMENTS_V1.validate()
    print(f"PRISM Segments {PRISM_SEGMENTS_V1.version}")
    print(f"  Total: {PRISM_SEGMENTS_V1.total():.4f}")
    print(f"  GOP cluster: {sum(v['pop_share'] for v in PRISM_SEGMENTS_V1.gop_segments().values()):.4f}")
    print(f"  DEM cluster: {sum(v['pop_share'] for v in PRISM_SEGMENTS_V1.dem_segments().values()):.4f}")
