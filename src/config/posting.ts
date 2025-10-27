const dailyCap = Number(process.env.DAILY_POST_CAP ?? '2');
const minScorePro = Number(process.env.MIN_SCORE_PRO ?? '0.70');
const minScoreElite = Number(process.env.MIN_SCORE_ELITE ?? '0.80');
const cooldownDays = Number(process.env.COOLDOWN_DAYS ?? '3');

export const POSTING_RULES = {
  DAILY_POST_CAP: Number.isFinite(dailyCap) && dailyCap > 0 ? dailyCap : 2,
  MIN_SCORE_PRO: Number.isFinite(minScorePro) ? minScorePro : 0.7,
  MIN_SCORE_ELITE: Number.isFinite(minScoreElite) ? minScoreElite : 0.8,
  COOLDOWN_SECONDS: (Number.isFinite(cooldownDays) ? cooldownDays : 3) * 24 * 3600,
};
