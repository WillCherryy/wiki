"""Independent check of earthbench/welltest_engine.pwd: implicit finite differences on the dimensionless radial diffusivity equation
   d2p/dr2 + (1/r) dp/dr = dp/dt,  r in [1, R], with wellbore storage and a skin film:
   C_D dp_w/dt - (dp/dr)|_{r=1} = 1,   p_w = p(1) - S (dp/dr)|_{r=1},   p(R) = 0 (R large).  Log-spaced grid in r, implicit Euler, log time steps.
   Shares no code and no method with the Laplace-space/Stehfest engine."""
import numpy as np, sys
sys.path.insert(0, '/home/user/wiki')
from earthbench.welltest_engine import pwd
from scipy.sparse import diags
from scipy.sparse.linalg import spsolve

def fd(CD, S, t_out, n=400, R=1e6):
    x = np.linspace(0, np.log(R), n); r = np.exp(x); h = x[1] - x[0]
    # unknowns: p_w, p_1..p_{n-1} (p at r_0=1 is p_1? use p[0] at r=1, p_w separate)
    p = np.zeros(n); pw = 0.0; t = 0.0; out = []; dt = 1e-4
    for T in sorted(t_out):
        while t < T - 1e-12:
            step = min(dt, T - t)
            # in x = ln r: (1/r^2) d2p/dx2 = dp/dt
            A = np.zeros((n + 1, n + 1)); b = np.zeros(n + 1)
            # interior nodes i=1..n-2
            for i in range(1, n - 1):
                c = 1.0 / (r[i] ** 2 * h ** 2)
                A[i, i - 1] = -c * step; A[i, i] = 1 + 2 * c * step; A[i, i + 1] = -c * step; b[i] = p[i]
            A[n - 1, n - 1] = 1.0; b[n - 1] = 0.0                    # outer boundary
            # well node: dp/dr at r=1 ~ (p1 - p0)/h  (dx = dr/r, r=1); unknown index n is p_w
            # skin: p_w = p0 - S (p1 - p0)/h  -> p_w - p0(1 + S/h) + p1 (S/h) = 0   (row 0)
            A[0, n] = 1.0; A[0, 0] = -(1 + S / h); A[0, 1] = S / h; b[0] = 0.0
            # storage: CD (p_w_new - p_w)/step - (p1 - p0)/h = 1     (row n). Sign: pressure DROP p is positive, rate leaving the formation
            A[n, n] = CD / step; A[n, 0] = 1 / h; A[n, 1] = -1 / h; b[n] = 1 + CD * pw / step
            sol = np.linalg.solve(A, b) if n < 300 else spsolve(diags([0]) if False else __import__('scipy.sparse', fromlist=['csr_matrix']).csr_matrix(A), b)
            p, pw = sol[:n], sol[n]; t += step; dt = min(dt * 1.05, max(T * 0.02, 1e-4))
        out.append(pw)
    return np.array(out)

for CD, S in [(0.0, 0.0), (1000.0, 5.0), (300.0, -2.0)]:
    ts = np.array([1e1, 1e2, 1e3, 1e4, 1e5, 1e6]) if CD else np.array([1e1, 1e2, 1e3, 1e4])
    f = fd(CD, S, ts, n=260, R=3e4 if CD == 0 else 1e5)
    e = pwd(ts, CD, S)
    print(f"CD={CD:g} S={S:g}"); [print(f"  tD={t:8.0e}  FD {a:9.5f}  Stehfest {b:9.5f}  rel diff {abs(a/b-1):.2e}") for t, a, b in zip(ts, f, e)]
