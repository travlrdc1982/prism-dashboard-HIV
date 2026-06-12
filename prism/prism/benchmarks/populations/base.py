"""
Survey population base class.

A SurveyPopulation defines the Stage 1 (demographic) rake target for a
PRISM study: who the survey is meant to represent. The default for most
PRISM work is voters_v1 (cluster-aware, DEM/GOP raked separately against
their own benchmarks). Narrow populations (Medicare Advantage seniors,
pregnant parents, ...) are not cluster-aware and rake the full sample
against a single benchmark keyed 'ALL'.

Adding a new population is mechanical: copy a template module, fill in
benchmark values, cite sources per dimension, version it, and register
it in populations/__init__.py. See README.md in this directory.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class SurveyPopulation:
    """Immutable Stage-1 rake-target definition for one survey population."""

    population_id: str          # e.g. "voters_v1", "seniors_ma_v1"
    version: str
    population_description: str
    last_updated: str

    # Cluster-aware populations (e.g. voters) rake each cluster separately
    # against its own benchmark; cluster_definitions maps cluster name to
    # the PRISM segment codes that compose it. Non-cluster-aware
    # populations have one benchmark set keyed 'ALL'.
    cluster_aware: bool = False
    cluster_definitions: Optional[Dict[str, List[str]]] = None

    # cluster -> dimension -> category -> proportion
    targets: Dict[str, Dict[str, Dict[str, float]]] = field(default_factory=dict)

    # dimension -> source citation
    sources: Dict[str, str] = field(default_factory=dict)

    # Placeholder populations establish the library pattern but carry
    # made-up benchmark values. The weighting orchestrator refuses to run
    # against a placeholder unless explicitly overridden.
    placeholder: bool = False

    # ── Introspection ──────────────────────────────────────────────────

    def clusters(self) -> List[str]:
        return list(self.targets.keys())

    def dimensions(self) -> List[str]:
        first = next(iter(self.targets.values()))
        return list(first.keys())

    def categories(self, dimension: str, cluster: Optional[str] = None) -> List[str]:
        key = cluster or next(iter(self.targets.keys()))
        return list(self.targets[key][dimension].keys())

    # ── Validation ─────────────────────────────────────────────────────

    def validate(self) -> bool:
        if self.cluster_aware:
            assert self.cluster_definitions, (
                f"{self.population_id}: cluster_aware=True requires "
                f"cluster_definitions")
            assert set(self.targets.keys()) == set(self.cluster_definitions.keys()), (
                f"{self.population_id}: targets keyed {sorted(self.targets)} but "
                f"cluster_definitions keyed {sorted(self.cluster_definitions)}")
        else:
            assert set(self.targets.keys()) == {"ALL"}, (
                f"{self.population_id}: non-cluster-aware populations must key "
                f"targets by 'ALL', got {sorted(self.targets)}")

        # Every cluster must carry the same dimension set, and every
        # dimension's categories must sum to 1 (±0.01).
        dim_sets = {c: set(dims.keys()) for c, dims in self.targets.items()}
        first = next(iter(dim_sets.values()))
        for c, dims in dim_sets.items():
            assert dims == first, (
                f"{self.population_id}: cluster {c} dimensions {sorted(dims)} "
                f"differ from {sorted(first)}")
        for cluster, dims in self.targets.items():
            for dim, cats in dims.items():
                total = sum(cats.values())
                assert abs(total - 1.0) <= 0.01, (
                    f"{self.population_id}: {cluster}/{dim} sums to {total:.4f}, "
                    f"not 1.0 (±0.01)")
        return True
