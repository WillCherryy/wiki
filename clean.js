// Turns a parsed Wikipedia article into the playable version: strips clutter and
// rewrites internal links to <a data-t="Title">. Shared by the browser and tools/
// so that par (shortest route) is computed on exactly the links players can click.
(function (root) {
  const DROP = 'style,script,table,.navbox,.infobox,.sidebar,.reference,.mw-editsection,.noprint,.metadata,.hatnote,.thumb,figure,.gallery,.reflist,.refbegin,.mw-empty-elt,.toc,#toc,.sistersitebox,.authority-control,.portal,.ambox,.mw-references-wrap,.printfooter,.shortdescription,.navbar,.mw-cite-backlink,.dablink';
  const END = new Set(['references', 'external_links', 'notes', 'further_reading', 'bibliography', 'sources', 'footnotes', 'citations', 'see_also']);
  const norm = t => String(t).replace(/_/g, ' ').trim().toLowerCase();

  function linkTitle(href, cls) {
    if (!href.startsWith('/wiki/') || /\bnew\b/.test(cls || '')) return null;
    let t = null;
    try { t = decodeURIComponent(href.slice(6).split('#')[0]).replace(/_/g, ' '); } catch { return null; }
    if (!t || /^[A-Za-z ]{2,20}:/.test(t)) return null;
    return t;
  }

  function clean(rootEl) {
    rootEl.querySelectorAll(DROP).forEach(n => n.remove());
    for (const h of Array.from(rootEl.querySelectorAll('h2'))) {
      if (END.has(norm(h.id || h.textContent).replace(/ /g, '_'))) {
        const start = h.closest('.mw-heading') || h;
        if (start.parentNode !== rootEl) { start.remove(); continue; }
        while (start.nextSibling) start.nextSibling.remove();
        start.remove(); break;
      }
    }
    rootEl.querySelectorAll('a').forEach(a => {
      const t = linkTitle(a.getAttribute('href') || '', a.getAttribute('class'));
      if (t) { Array.from(a.attributes).forEach(x => a.removeAttribute(x.name)); a.setAttribute('data-t', t); a.setAttribute('href', '#'); }
      else { while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a); a.remove(); }
    });
    rootEl.querySelectorAll('p').forEach(p => { if (!p.textContent.trim()) p.remove(); });
    return rootEl;
  }

  const api = { clean, linkTitle, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WikiClean = api;
})(typeof window !== 'undefined' ? window : globalThis);
