'use strict';
// Model prices for cost accounting: US dollars per million tokens, Anthropic first-party API, as published in the claude-api reference
// cached 2026-10-06. Prices change: before quoting a cost to a customer, check the live pricing page. Scorcher's own subscription prices
// are deliberately NOT here: they are not set (docs/SUITE.md: prices are agreed with the first pilots).
// Cache reads and writes are not priced here because the runner does not use prompt caching (each call is billed at the plain rates).
const PRICES = {
  'claude-haiku-5-5': { name: 'Claude Haiku 5.5', inPerM: 0.10, outPerM: 0.50, longPromptTokens: 100000, longInPerM: 0.50, longOutPerM: 2.50, note: 'Higher rates apply to prompts over 100K tokens' },
  'claude-sonnet-5-5': { name: 'Claude Sonnet 5.5', inPerM: 2.00, outPerM: 10.00 },
  'claude-opus-5-5': { name: 'Claude Opus 5.5', inPerM: 4.00, outPerM: 20.00 },
  'claude-fable-5-1': { name: 'Claude Fable 5.1', inPerM: 10.00, outPerM: 50.00 },
};
const SOURCE = 'claude-api reference, cached 2026-10-06';

// Cost of one API call from its usage block ({ input_tokens, output_tokens }).
function callCost(model, usage) {
  const p = PRICES[model]; if (!p) throw new Error('no price for model: ' + model);
  const long = p.longPromptTokens && usage.input_tokens > p.longPromptTokens;
  const inRate = long ? p.longInPerM : p.inPerM, outRate = long ? p.longOutPerM : p.outPerM;
  const input = usage.input_tokens * inRate / 1e6, output = usage.output_tokens * outRate / 1e6;
  return { input, output, total: input + output };
}

// Cost of a whole trial from its calls: input, output, total in dollars and the token counts.
function trialCost(model, calls) {
  const t = { model, calls: calls.length, inputTokens: 0, outputTokens: 0, input: 0, output: 0, total: 0 };
  for (const u of calls) { const c = callCost(model, u); t.inputTokens += u.input_tokens; t.outputTokens += u.output_tokens; t.input += c.input; t.output += c.output; t.total += c.total; }
  return t;
}
module.exports = { PRICES, SOURCE, callCost, trialCost };
