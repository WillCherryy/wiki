// Fills operator/contact placeholders from config.js and warns while they are unset.
(function () {
  const c = window.WIKIIO || {};
  try { const t = (JSON.parse(localStorage.getItem('wikiio:v1')) || {}).theme || 'system'; document.documentElement.dataset.theme = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; } catch {}
  const set = (k, v) => document.querySelectorAll('[data-fill="' + k + '"]').forEach(el => {
    if (k === 'contact' && v) { el.innerHTML = '<a href="mailto:' + v + '">' + v + '</a>'; } else el.textContent = v;
  });
  set('operator', c.operator || '[operator name not set]');
  set('contact', c.contact || '[contact email not set]');
  set('jurisdiction', c.jurisdiction || 'England and Wales');
  set('updated', c.updated || '');
  document.querySelectorAll('[data-brand]').forEach(el => { el.innerHTML = (c.brandA || 'Warm') + '<b>' + (c.brandB || 'er') + '</b>'; });
  document.querySelectorAll('[data-pay]').forEach(el => { el.hidden = (el.dataset.pay === 'stripe') !== ((c.paymentProvider || 'stripe') === 'stripe'); });
  document.querySelectorAll('[data-ads]').forEach(el => { el.hidden = (el.dataset.ads === 'on') !== !!c.adsenseClient; });
  if (!c.operator || !c.contact) { const d = document.getElementById('draft'); if (d) d.style.display = 'block'; }
})();
