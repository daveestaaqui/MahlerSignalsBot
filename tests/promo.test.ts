import { strict as assert } from 'node:assert';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';

import {
  promoteAll,
  setPromoHttpClient,
  resetPromoHttpClient,
} from '../src/services/promo.js';

const baseEnv = {
  PROMO_ENABLED: 'true',
  PROMO_X_ENABLED: 'true',
  PROMO_DISCORD_ENABLED: 'true',
  X_BEARER_TOKEN: 'token',
  DISCORD_WEBHOOK_URL: 'https://discord.test/webhook',
} as const;

function makeStubClient(onCall: (url: string) => { statusCode: number; payload: unknown }): Parameters<
  typeof setPromoHttpClient
>[0] {
  return (async (urlLike: string | URL | import('url').UrlObject) => {
    const url =
      typeof urlLike === 'string'
        ? urlLike
        : urlLike instanceof URL
        ? urlLike.toString()
        : (urlLike as { href?: string }).href ?? '';
    const { statusCode, payload } = onCall(url);
    return {
      statusCode,
      headers: {},
      trailers: {},
      opaque: null,
      context: {},
      body: {
        json: async () => payload,
        text: async () => '',
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => {
          throw new Error('not implemented');
        },
        formData: async () => {
          throw new Error('not implemented');
        },
        bodyUsed: false,
        tee: () => {
          throw new Error('not implemented');
        },
        cancel: async () => undefined,
        getReader: () => {
          throw new Error('not implemented');
        },
        [Symbol.asyncIterator]: async function* () {
          yield new Uint8Array();
        },
      },
    } as any;
  }) as Parameters<typeof setPromoHttpClient>[0];
}

test('promoteAll respects DRY_RUN and skips network calls', async () => {
  const calls: string[] = [];
  setPromoHttpClient(
    makeStubClient(() => {
      calls.push('call');
      return { statusCode: 200, payload: {} };
    }),
  );

  try {
    const result = await promoteAll('Dry run promo', {
      ...baseEnv,
      DRY_RUN: 'true',
    });
    assert.deepEqual(result, {});
    assert.equal(calls.length, 0);
  } finally {
    resetPromoHttpClient();
  }
});

test('promoteAll dispatches once per provider and is idempotent for 15 minutes', async () => {
  const calls: string[] = [];
  setPromoHttpClient(
    makeStubClient((url) => {
      calls.push(url);
      const isX = url.includes('api.x.com');
      return {
        statusCode: isX ? 200 : 204,
        payload: isX ? { data: { id: 'tweet-1' } } : {},
      };
    }),
  );

  try {
    const env = { ...baseEnv, DRY_RUN: 'false' };
    const text = 'Fresh signals ready now';

    const first = await promoteAll(text, env);
    assert.equal(calls.length, 2);
    assert.equal(first.x, 'tweet-1');
    assert.equal(first.discord, true);

    const second = await promoteAll(text, env);
    assert.equal(calls.length, 2);
    assert.deepEqual(second, {});
  } finally {
    resetPromoHttpClient();
  }
});
