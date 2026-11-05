// Model prices, US dollars per million tokens, Anthropic first-party API, from the claude-api reference cached 2026-10-06. Prices change:
// check the live page before quoting a customer. Scorcher's own subscription prices are deliberately not here (not set).
export interface Price { name: string; inPerM: number; outPerM: number; longPromptTokens?: number; longInPerM?: number; longOutPerM?: number }
export const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { name: 'Claude Haiku 5.5', inPerM: 0.10, outPerM: 0.50, longPromptTokens: 100_000, longInPerM: 0.50, longOutPerM: 2.50 },
  'claude-sonnet-5-5': { name: 'Claude Sonnet 5.5', inPerM: 2.00, outPerM: 10.00 },
  'claude-opus-5-5': { name: 'Claude Opus 5.5', inPerM: 4.00, outPerM: 20.00 },
  'claude-fable-5-1': { name: 'Claude Fable 5.1', inPerM: 10.00, outPerM: 50.00 },
};
export function callCost(model: string, u: { input_tokens: number; output_tokens: number }): number {
  const p = PRICES[model]; if (!p) throw new Error('no price for model: ' + model);
  const long = p.longPromptTokens !== undefined && u.input_tokens > p.longPromptTokens;
  return (u.input_tokens * (long ? p.longInPerM! : p.inPerM) + u.output_tokens * (long ? p.longOutPerM! : p.outPerM)) / 1e6;
}
