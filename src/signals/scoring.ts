export type SubScores = { tech:number; sentiment:number; whale:number; options:number; fundamental:number };
export type ScoreInput = {
  assetType:'stock'|'crypto';
  tech?:number; sentiment?:number; whale?:number; options?:number; fundamental?:number;
};
export type ScoreOutput = { total:number; subs:SubScores; label:'Low'|'Medium'|'High'|'Elite' };
export function score(input: ScoreInput, weights?: Partial<SubScores>): ScoreOutput {
  const w = Object.assign({ tech:0.35, sentiment:0.15, whale:0.2, options:0.1, fundamental:0.2 }, weights||{});
  const clamp=(x?:number)=> Math.max(0, Math.min(1, x ?? 0));
  const subs = {
    tech: clamp(input.tech),
    sentiment: clamp(input.sentiment),
    whale: clamp(input.whale),
    options: clamp(input.options),
    fundamental: clamp(input.fundamental),
  };
  const total = +(subs.tech*w.tech + subs.sentiment*w.sentiment + subs.whale*w.whale + subs.options*w.options + subs.fundamental*w.fundamental).toFixed(2);
  const label = total>=0.85 ? 'Elite' : total>=0.65 ? 'High' : total>=0.45 ? 'Medium' : 'Low';
  return { total, subs, label };
}
