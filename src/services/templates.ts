import { SHORT_DISCLAIMER } from "../domain/legal";

type PromoSource =
  | { messages?: Array<{ symbols?: string[]; compact?: string; plain?: string }> }
  | Array<{ symbols?: string[]; compact?: string; plain?: string }>
  | string;

export function composePromo(batchOrMsgs: PromoSource): string {
  if (typeof batchOrMsgs === 'string') {
    return finalize(batchOrMsgs);
  }

  const messages = Array.isArray(batchOrMsgs)
    ? batchOrMsgs
    : Array.isArray(batchOrMsgs?.messages)
    ? batchOrMsgs.messages
    : [];

  const tickers = Array.from(
    new Set(
      messages
        .flatMap((msg) => msg.symbols ?? [])
        .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.length > 0),
    ),
  ).slice(0, 2);

  const snippet =
    messages
      .map((msg) => msg.compact || msg.plain)
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\s+/g, ' ').trim())
      .find((value) => value.length > 0) || '';

  const lead = tickers.length ? `${tickers.join(' & ')} setup` : 'Fresh signals';
  const base = snippet ? `${lead}: ${snippet}` : `${lead} from Aurora Signals`;
  const withCta = `${base}. More in PRO/ELITE.`;

  return finalize(withCta);
}

function finalize(text: string): string {
  const base = text && text.trim() ? text.replace(/\s+/g, ' ').trim() : 'Fresh flow alerts. More in PRO/ELITE.';
  const body = base.length <= 250 ? base : `${base.slice(0, 247)}...`;
  if (body.includes(SHORT_DISCLAIMER)) {
    return body;
  }
  return `${body}\n\n${SHORT_DISCLAIMER}`;
}
