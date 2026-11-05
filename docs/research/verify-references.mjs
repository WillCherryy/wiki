// Looks up every supplied reference in Crossref (journal and conference papers) and DataCite (arXiv preprints), scores the title match, and
// records only what the registries return: authors, year, venue, DOI and, where deposited, the abstract. Nothing is filled in from memory.
// Run:  node docs/research/verify-references.mjs  (writes references.json). Network access to api.crossref.org and api.datacite.org is required.
import { writeFileSync } from 'node:fs';
const UA = { 'User-Agent': 'ScorcherResearch/1.0 (mailto:will@cherrys.me.uk)' };
const REFS = [
  ['A1', 'A systematic review of transformers and large language models in the energy sector: towards agentic digital twins', 'Applied Energy', 2025],
  ['A2', 'From systematic evidence to agentic architectures: A systematic review and framework for large language model-driven smart grids', 'Energy and AI', 2026],
  ['A3', 'A trustworthy intent-driven LLM-agent workflow with state verification for power system simulation', 'Applied Energy', 2026],
  ['A4', 'Large Language Models Meet Energy Systems: Opportunities, Challenges, and Future Perspectives', 'Applied Energy', 2026],
  ['A5', 'Large language models in renewable energy systems: A comprehensive review of forecasting, control, policy, and fault diagnosis', 'Next Energy', 2026],
  ['B6', 'GeoAnalystBench: A GeoAI Benchmark for Assessing Large Language Models for Spatial Analysis Workflow and Code Generation', 'Transactions in GIS', 2025],
  ['B7', 'An autonomous GIS agent framework for geospatial data retrieval', 'International Journal of Digital Earth', 2025],
  ['B8', 'GeoAgentBench: A dynamic execution benchmark for tool-augmented agents in spatial analysis', '(2026)', 2026],
  ['B9', 'GeoNatureAgent Benchmark: Benchmarking LLM Agents for Environmental Geospatial Analysis Across Frontier and Open-Weight Foundation Models', 'arXiv', 2026],
  ['C10', 'Large Language Model Agents in Dynamic Mine Planning: Challenges, Opportunities, and Future Directions', 'IEEE Access', 2026],
  ['C11', 'MINDS: A Modular Multi-Agent Decision-Support Framework for Dynamic Strategic Mine Planning', '(2026)', 2026],
  ['D12', 'From Data to Decision-Making: A Review of Large Language Model Applications Across the Full Lifecycle of Geothermal Resource Development', 'Energies', 2026],
  ['E13', 'Large language models empowered agent-based modeling and simulation: a survey and perspectives', 'Humanities and Social Sciences Communications', 2024],
  ['F1', 'ReAct: Synergizing Reasoning and Acting in Language Models', 'ICLR', 2023, '10.48550/arxiv.2210.03629'],
  ['F2', 'AgentBench: Evaluating LLMs as Agents', 'ICLR', 2024, '10.48550/arxiv.2308.03688'],
  ['F3', 'SWE-bench: Can Language Models Resolve Real-World GitHub Issues?', 'ICLR', 2024, '10.48550/arxiv.2310.06770'],
  ['F4', 'MLAgentBench: Evaluating Language Agents on Machine Learning Experimentation', 'ICML', 2024, '10.48550/arxiv.2310.03302'],
  ['F5', 'Short-term hydropower regulation through coupled hydrological and energy models: A systematic review', '(2026)', 2026],
  ['F6', 'Random environment simulation-based multi-stage reinforcement learning for short-term scheduling of cascade hydropower stations', '(2026)', 2026],
  // added by the research team for the design sections (not in the supplied list); verified the same way
  ['X1', 'pvlib python: a python package for modeling solar energy systems', 'JOSS', 2018],
  ['X2', 'pandapower: an open source python tool for convenient modeling, analysis and optimization of electric power systems', 'IEEE Trans. Power Systems', 2018],
  ['X3', 'Not what you have signed up for: Compromising real-world LLM-integrated applications with indirect prompt injection', 'AISec', 2023, '10.48550/arxiv.2302.12173'],
  ['X4', 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)', 'NIST', 2023, '10.6028/NIST.AI.100-1'],
  ['X5', 'Guide to Operational Technology (OT) Security', 'NIST SP 800-82 Rev. 3', 2023, '10.6028/NIST.SP.800-82r3'],
  ['X6', 'Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile', 'NIST', 2024, '10.6028/NIST.AI.600-1'],
];
const norm = s => s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2);
const sim = (a, b) => { const A = new Set(norm(a)), B = new Set(norm(b)); let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.max(1, A.size + B.size - i); };
const clean = h => h ? h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/^\s*Abstract\s*/i, '').trim() : null;
const get = async (url) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch {} await new Promise(r => setTimeout(r, 800)); } return null; };
const invert = ix => { if (!ix) return null; const w = []; for (const [word, pos] of Object.entries(ix)) for (const p of pos) w[p] = word; return w.join(' '); };
const openalex = async (q) => { const j = await get('https://api.openalex.org/works?' + q + '&per-page=3&select=id,doi,title,publication_year,primary_location,authorships,abstract_inverted_index,type'); return j?.results ?? []; };
const out = [];
for (const [key, title, venue, year, doiHint] of REFS) {
  const rec = { key, supplied: { title, venue, year }, found: null, note: null };
  if (doiHint) { const d = await get('https://api.datacite.org/dois/' + doiHint.toLowerCase()) ?? await get('https://api.crossref.org/works/' + doiHint).then(x => x?.message ?? null);
    if (d?.data) { const a = d.data.attributes; rec.found = { source: 'DataCite', doi: a.doi, title: a.titles?.[0]?.title, authors: (a.creators ?? []).map(c => c.name), year: a.publicationYear, container: a.publisher?.name ?? a.publisher, type: a.types?.resourceTypeGeneral, abstract: clean(a.descriptions?.find(x => x.descriptionType === 'Abstract')?.description), similarity: +sim(title, a.titles?.[0]?.title ?? '').toFixed(2) }; }
    else if (d?.DOI) rec.found = { source: 'Crossref', doi: d.DOI, title: d.title?.[0], authors: (d.author ?? []).map(c => `${c.given ?? ''} ${c.family ?? c.name ?? ''}`.trim()), year: d.issued?.['date-parts']?.[0]?.[0], container: d['container-title']?.[0] ?? d.publisher, type: d.type, abstract: clean(d.abstract), similarity: +sim(title, d.title?.[0] ?? '').toFixed(2) }; }
  if (!rec.found) {
    const j = await get(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=5&select=DOI,title,author,issued,container-title,type,publisher,abstract,created`);
    const best = (j?.message?.items ?? []).map(x => ({ x, s: sim(title, x.title?.[0] ?? '') })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= 0.6) { const x = best.x; rec.found = { source: 'Crossref', doi: x.DOI, title: x.title?.[0], authors: (x.author ?? []).map(c => `${c.given ?? ''} ${c.family ?? c.name ?? ''}`.trim()), year: x.issued?.['date-parts']?.[0]?.[0] ?? null, container: x['container-title']?.[0] ?? x.publisher, type: x.type, abstract: clean(x.abstract), similarity: +best.s.toFixed(2) }; }
    else rec.note = best ? `closest Crossref title scored ${best.s.toFixed(2)} (${best.x.title?.[0]?.slice(0, 80)}): not accepted as a match` : 'no Crossref result';
  }
  // abstracts the publisher did not deposit with Crossref: OpenAlex holds many of them
  if (rec.found && !rec.found.abstract && rec.found.doi) { const w = (await openalex('filter=doi:' + encodeURIComponent('https://doi.org/' + rec.found.doi)))[0]; const a = invert(w?.abstract_inverted_index); if (a) { rec.found.abstract = a; rec.found.abstractSource = 'OpenAlex'; } }
  if (!rec.found) { const w = (await openalex('search=' + encodeURIComponent(title))).map(x => ({ x, s: sim(title, x.title ?? '') })).sort((a, b) => b.s - a.s)[0];
    if (w && w.s >= 0.6) { const x = w.x; rec.found = { source: 'OpenAlex', doi: x.doi?.replace('https://doi.org/', '') ?? null, openalex: x.id, title: x.title, authors: (x.authorships ?? []).map(a => a.author?.display_name), year: x.publication_year, container: x.primary_location?.source?.display_name ?? null, type: x.type, abstract: invert(x.abstract_inverted_index), similarity: +w.s.toFixed(2) }; rec.note = null; } }
  out.push(rec); console.log(key.padEnd(4), rec.found ? `${rec.found.similarity} ${rec.found.doi} | ${rec.found.container ?? ''} ${rec.found.year ?? ''} | abstract: ${rec.found.abstract ? rec.found.abstract.length + ' chars' + (rec.found.abstractSource ? ' (' + rec.found.abstractSource + ')' : '') : 'not available'}` : 'NOT FOUND: ' + rec.note);
  await new Promise(r => setTimeout(r, 250));
}
writeFileSync(new URL('./references.json', import.meta.url), JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), method: 'Crossref bibliographic query (best title match, accepted at similarity >= 0.6) and DataCite lookup by arXiv DOI', refs: out }, null, 1));
