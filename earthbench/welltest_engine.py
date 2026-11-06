"""Pressure transient engine for a vertical well: infinite-acting radial flow with wellbore storage and skin, an optional straight
sealing fault, and buildup by superposition. SI units throughout.

Drawdown, dimensionless (Agarwal, Al-Hussainy and Ramey 1970), in Laplace space:
    p_wD(s) = [K0(sqrt s) + S sqrt(s) K1(sqrt s)] / ( s [ sqrt(s) K1(sqrt s) + C_D s (K0(sqrt s) + S sqrt(s) K1(sqrt s)) ] )
inverted numerically with the Gaver-Stehfest algorithm (N = 12). Definitions:
    t_D = k t / (phi mu c_t r_w^2),  C_D = C / (2 pi phi c_t h r_w^2),  dp = q mu p_D / (2 pi k h)
A sealing fault at distance L is an image well at 2L; its line-source pressure, (q mu / 4 pi k h) E1(phi mu c_t (2L)^2 / (4 k t)), is added
in the time domain (wellbore storage has ended long before the image is felt). Buildup after producing for t_p:
    p_ws(dt) = p_i - [dp(t_p + dt) - dp(dt)]
which holds because the system is linear. The Bourdet derivative is taken against the superposition (Horner) time.
"""
from __future__ import annotations
import math
import numpy as np
from scipy.special import k0e, k1e, exp1

MD = 9.869233e-16              # m2 per millidarcy
_N = 12


def _stehfest(n=_N):
    v = np.zeros(n)
    h = n // 2
    for i in range(1, n + 1):
        s = 0.0
        for k in range((i + 1) // 2, min(i, h) + 1):
            s += k ** h * math.factorial(2 * k) / (math.factorial(h - k) * math.factorial(k) * math.factorial(k - 1) * math.factorial(i - k) * math.factorial(2 * k - i))
        v[i - 1] = (-1) ** (i + h) * s
    return v


_V = _stehfest()


def pwd_laplace(s, CD, S):
    r = np.sqrt(s)
    a, b = k0e(r), r * k1e(r)              # both scaled by exp(r): the ratio is unchanged
    num = a + S * b
    return num / (s * (b + CD * s * num))


def pwd(tD, CD, S):
    """Dimensionless wellbore pressure drop at each tD (Stehfest).

    Negative skin (a stimulated well) is modelled as an effective wellbore radius r_wa = r_w e^-S with zero skin (Earlougher 1977, ch. 2):
    t_D and C_D are rescaled by e^{2S}. The infinitesimal-skin form with S < 0 is unphysical at early time and, inverted numerically,
    returned negative pressures (found in the audit of 6 November 2026; tested in test_welltest)."""
    if S < 0:
        f = math.exp(2 * S)
        return pwd(np.asarray(tD, float) * f, CD * f, 0.0)
    tD = np.atleast_1d(np.asarray(tD, float))
    ln2 = math.log(2.0)
    out = np.zeros_like(tD)
    for i, v in enumerate(_V, start=1):
        out += v * pwd_laplace(i * ln2 / tD, CD, S)
    return out * ln2 / tD


class Well:
    def __init__(self, k_md, h, phi, mu, ct, rw, q, skin, C, fault_m=None):
        self.k = k_md * MD; self.h, self.phi, self.mu, self.ct, self.rw, self.q, self.S, self.C, self.L = h, phi, mu, ct, rw, q, skin, C, fault_m
        self.diff = self.k / (phi * mu * ct)                                   # hydraulic diffusivity, m2/s
        self.CD = C / (2 * math.pi * phi * ct * h * rw ** 2)
        self.scale = q * mu / (2 * math.pi * self.k * h)                       # Pa per unit pD

    def dp(self, t_s):
        """Drawdown pressure drop (Pa) after producing for t_s seconds."""
        t = np.atleast_1d(np.asarray(t_s, float))
        out = self.scale * pwd(self.diff * t / self.rw ** 2, self.CD, self.S)
        if self.L:
            out = out + 0.5 * self.scale * exp1((2 * self.L) ** 2 / (4 * self.diff * t))
        return out

    def buildup(self, pi, tp_h, dt_h):
        dt = np.asarray(dt_h, float) * 3600.0; tp = tp_h * 3600.0
        pwf = pi - float(self.dp(tp)[0])
        return pwf, pi - (self.dp(tp + dt) - self.dp(dt))

    def radial_start_h(self, tol=0.02):
        """Start of radial flow: from then on the infinite-acting drawdown derivative stays within tol of its plateau, q mu / (4 pi k h).
        Read from the solution itself. Ramey's rule of thumb, t_D = (60 + 3.5 S) C_D, starts it too early when skin is high."""
        tD = np.logspace(-1, 12, 1300)
        p = pwd(tD, self.CD, self.S)
        d = np.gradient(p, np.log(tD)) / 0.5
        bad = np.nonzero(np.abs(d - 1) > tol)[0]
        i = bad[-1] + 1 if bad.size else 0
        return float(tD[min(i, tD.size - 1)] * self.rw ** 2 / self.diff / 3600.0)

    def fault_felt_h(self, x=5.0):
        """When the image well's argument falls to x: before it, the fault adds less than 0.7 % to the derivative (x = 5)."""
        return None if not self.L else (2 * self.L) ** 2 / (4 * self.diff * x) / 3600.0

    def slope_per_cycle(self):
        return 2.303 * self.q * self.mu / (4 * math.pi * self.k * self.h)


def bourdet(dt_h, pws, pwf, tp_h, L=0.2):
    """Bourdet derivative of dp = pws - pwf against ln of the Horner superposition time, smoothed over L log units."""
    dt_h, dp = np.asarray(dt_h, float), np.asarray(pws, float) - pwf
    x = np.log(tp_h * dt_h / (tp_h + dt_h))          # ln of the Agarwal equivalent time, t_p dt / (t_p + dt)
    n = len(x); d = np.full(n, np.nan)
    for i in range(1, n - 1):
        j = i - 1
        while j > 0 and x[i] - x[j] < L:
            j -= 1
        k = i + 1
        while k < n - 1 and x[k] - x[i] < L:
            k += 1
        dl, dr = x[i] - x[j], x[k] - x[i]
        if dl <= 0 or dr <= 0:
            continue
        sl, sr = (dp[i] - dp[j]) / dl, (dp[k] - dp[i]) / dr
        d[i] = (sl * dr + sr * dl) / (dl + dr)
    return dp, d
