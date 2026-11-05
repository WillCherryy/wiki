"""Small, dependency-light statistics: Wilson intervals, exact McNemar, paired difference."""
from __future__ import annotations
import math
from scipy.stats import binomtest


def wilson(k: int, n: int, z: float = 1.959964):
    if n == 0:
        return {"p": None, "lo": None, "hi": None, "k": k, "n": n}
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return {"p": p, "lo": max(0.0, c - h), "hi": min(1.0, c + h), "k": k, "n": n}


def paired(a, b):
    """a, b: 0/1 lists over the same tasks. Difference b - a, exact McNemar p, discordant counts."""
    n = len(a)
    only_b = sum(1 for x, y in zip(a, b) if not x and y)
    only_a = sum(1 for x, y in zip(a, b) if x and not y)
    diff = (only_b - only_a) / n if n else 0.0
    d = only_a + only_b
    p = binomtest(only_b, d, 0.5).pvalue if d else 1.0
    se = math.sqrt(max(only_a + only_b - (only_b - only_a) ** 2 / n, 0.0)) / n if n else 0.0   # Wald, paired
    return {"n": n, "diff": diff, "lo": diff - 1.959964 * se, "hi": diff + 1.959964 * se, "only_b": only_b, "only_a": only_a, "mcnemar_p": p}
