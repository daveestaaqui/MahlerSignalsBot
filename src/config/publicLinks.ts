export interface PublicLinks {
  twitterUrl?: string;
  discordUrl?: string;
  telegramUrl?: string;
  statusPageUrl?: string;
  stripeCheckoutUrl?: string;
}

export const publicLinks: PublicLinks = {
  twitterUrl: process.env.AURORA_TWITTER_URL,
  discordUrl: process.env.AURORA_DISCORD_URL,
  telegramUrl: process.env.AURORA_TELEGRAM_URL,
  statusPageUrl: process.env.AURORA_STATUS_URL,
  stripeCheckoutUrl: process.env.AURORA_STRIPE_CHECKOUT_URL,
};
