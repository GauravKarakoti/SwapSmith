import type { Context } from 'telegraf';
import {
  createBotRateLimitMiddleware,
  FixedWindowLimiter,
} from '../utils/rate-limit-middleware';

describe('FixedWindowLimiter', () => {
  it('allows up to limit and then blocks in the same window', () => {
    const limiter = new FixedWindowLimiter();
    const rule = { windowMs: 1000, max: 2 };

    expect(limiter.check('u:1', rule, 1000).allowed).toBe(true);
    expect(limiter.check('u:1', rule, 1100).allowed).toBe(true);

    const blocked = limiter.check('u:1', rule, 1200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(800);
  });

  it('resets counters when the window expires', () => {
    const limiter = new FixedWindowLimiter();
    const rule = { windowMs: 1000, max: 1 };

    expect(limiter.check('u:1', rule, 1000).allowed).toBe(true);
    expect(limiter.check('u:1', rule, 1500).allowed).toBe(false);
    expect(limiter.check('u:1', rule, 2001).allowed).toBe(true);
  });
});

describe('createBotRateLimitMiddleware', () => {
  const buildContext = (overrides: Partial<Context> = {}): Context => {
    const ctx = {
      update: { message: { text: 'hello' } },
      from: { id: 101 } as Context['from'],
      chat: { id: 202 } as Context['chat'],
      reply: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Context;

    return ctx;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-07T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('blocks requests after per-user limit is hit', async () => {
    const middleware = createBotRateLimitMiddleware({
      global: { windowMs: 60_000, max: 100 },
      perUser: { windowMs: 60_000, max: 2 },
      perChat: { windowMs: 60_000, max: 100 },
      callbackPerUser: { windowMs: 60_000, max: 100 },
      notifyCooldownMs: 0,
    });

    const next = jest.fn().mockResolvedValue(undefined);
    const ctx = buildContext();

    await middleware(ctx, next);
    await middleware(ctx, next);
    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it('applies stricter callback query limit', async () => {
    const middleware = createBotRateLimitMiddleware({
      global: { windowMs: 60_000, max: 100 },
      perUser: { windowMs: 60_000, max: 100 },
      perChat: { windowMs: 60_000, max: 100 },
      callbackPerUser: { windowMs: 60_000, max: 1 },
      notifyCooldownMs: 0,
    });

    const next = jest.fn().mockResolvedValue(undefined);
    const ctx = buildContext({
      update: { callback_query: { id: 'q1' } } as Context['update'],
      callbackQuery: { id: 'q1' } as Context['callbackQuery'],
      chat: undefined,
    });

    await middleware(ctx, next);
    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
