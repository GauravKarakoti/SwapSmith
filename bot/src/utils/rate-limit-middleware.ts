import type { Context, MiddlewareFn } from 'telegraf';

export interface SlidingWindowRule {
  windowMs: number;
  max: number;
}

export interface BotRateLimitConfig {
  global: SlidingWindowRule;
  perUser: SlidingWindowRule;
  perChat: SlidingWindowRule;
  callbackPerUser: SlidingWindowRule;
  notifyCooldownMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface CounterEntry {
  count: number;
  resetAt: number;
}

export class FixedWindowLimiter {
  private readonly counters = new Map<string, CounterEntry>();
  private checkedSinceCleanup = 0;

  constructor(private readonly cleanupThreshold = 500) {}

  public check(key: string, rule: SlidingWindowRule, nowMs = Date.now()): RateLimitResult {
    this.checkedSinceCleanup += 1;
    if (this.checkedSinceCleanup >= this.cleanupThreshold) {
      this.cleanup(nowMs);
      this.checkedSinceCleanup = 0;
    }

    const current = this.counters.get(key);
    if (!current || current.resetAt <= nowMs) {
      this.counters.set(key, { count: 1, resetAt: nowMs + rule.windowMs });
      return { allowed: true, remaining: Math.max(rule.max - 1, 0), retryAfterMs: 0 };
    }

    if (current.count >= rule.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(current.resetAt - nowMs, 0),
      };
    }

    current.count += 1;
    this.counters.set(key, current);
    return {
      allowed: true,
      remaining: Math.max(rule.max - current.count, 0),
      retryAfterMs: 0,
    };
  }

  public get size(): number {
    return this.counters.size;
  }

  private cleanup(nowMs: number): void {
    for (const [key, entry] of this.counters) {
      if (entry.resetAt <= nowMs) {
        this.counters.delete(key);
      }
    }
  }
}

type RuleCheck = {
  key: string;
  rule: SlidingWindowRule;
};

const DEFAULT_CONFIG: BotRateLimitConfig = {
  global: { windowMs: 10_000, max: 100 },
  perUser: { windowMs: 60_000, max: 20 },
  perChat: { windowMs: 60_000, max: 60 },
  callbackPerUser: { windowMs: 30_000, max: 10 },
  notifyCooldownMs: 10_000,
};

export const getRateLimitConfigFromEnv = (): BotRateLimitConfig => {
  const readInt = (name: string, fallback: number): number => {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    global: {
      windowMs: readInt('BOT_RATE_LIMIT_GLOBAL_WINDOW_MS', DEFAULT_CONFIG.global.windowMs),
      max: readInt('BOT_RATE_LIMIT_GLOBAL_MAX', DEFAULT_CONFIG.global.max),
    },
    perUser: {
      windowMs: readInt('BOT_RATE_LIMIT_PER_USER_WINDOW_MS', DEFAULT_CONFIG.perUser.windowMs),
      max: readInt('BOT_RATE_LIMIT_PER_USER_MAX', DEFAULT_CONFIG.perUser.max),
    },
    perChat: {
      windowMs: readInt('BOT_RATE_LIMIT_PER_CHAT_WINDOW_MS', DEFAULT_CONFIG.perChat.windowMs),
      max: readInt('BOT_RATE_LIMIT_PER_CHAT_MAX', DEFAULT_CONFIG.perChat.max),
    },
    callbackPerUser: {
      windowMs: readInt(
        'BOT_RATE_LIMIT_CALLBACK_PER_USER_WINDOW_MS',
        DEFAULT_CONFIG.callbackPerUser.windowMs
      ),
      max: readInt('BOT_RATE_LIMIT_CALLBACK_PER_USER_MAX', DEFAULT_CONFIG.callbackPerUser.max),
    },
    notifyCooldownMs: readInt('BOT_RATE_LIMIT_NOTIFY_COOLDOWN_MS', DEFAULT_CONFIG.notifyCooldownMs),
  };
};

export const createBotRateLimitMiddleware = (
  config: Partial<BotRateLimitConfig> = {}
): MiddlewareFn<Context> => {
  const mergedConfig: BotRateLimitConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    global: { ...DEFAULT_CONFIG.global, ...(config.global || {}) },
    perUser: { ...DEFAULT_CONFIG.perUser, ...(config.perUser || {}) },
    perChat: { ...DEFAULT_CONFIG.perChat, ...(config.perChat || {}) },
    callbackPerUser: { ...DEFAULT_CONFIG.callbackPerUser, ...(config.callbackPerUser || {}) },
  };

  const limiter = new FixedWindowLimiter();
  const lastNotifiedAt = new Map<string, number>();

  return async (ctx, next) => {
    const nowMs = Date.now();
    const ruleChecks: RuleCheck[] = [
      { key: 'global:all', rule: mergedConfig.global },
    ];

    const userId = ctx.from?.id;
    if (userId) {
      ruleChecks.push({ key: `user:${userId}`, rule: mergedConfig.perUser });
      if ('callback_query' in ctx.update) {
        ruleChecks.push({ key: `callback:${userId}`, rule: mergedConfig.callbackPerUser });
      }
    }

    const chatId = ctx.chat?.id;
    if (chatId) {
      ruleChecks.push({ key: `chat:${chatId}`, rule: mergedConfig.perChat });
    }

    let blocked: { key: string; result: RateLimitResult } | null = null;
    for (const check of ruleChecks) {
      const result = limiter.check(check.key, check.rule, nowMs);
      if (!result.allowed) {
        blocked = { key: check.key, result };
        break;
      }
    }

    if (!blocked) {
      return next();
    }

    const shouldNotify =
      nowMs - (lastNotifiedAt.get(blocked.key) || 0) >= mergedConfig.notifyCooldownMs;
    if (shouldNotify) {
      lastNotifiedAt.set(blocked.key, nowMs);
      const retrySeconds = Math.max(Math.ceil(blocked.result.retryAfterMs / 1000), 1);

      try {
        if ('callback_query' in ctx.update && ctx.callbackQuery) {
          await ctx.answerCbQuery(`Too many requests. Try again in ${retrySeconds}s.`, {
            show_alert: false,
          });
        } else if (ctx.chat) {
          await ctx.reply(`⚠️ Too many requests. Try again in ${retrySeconds}s.`);
        }
      } catch {
        // Ignore notification errors so rate limiting still blocks execution.
      }
    }

    return;
  };
};
