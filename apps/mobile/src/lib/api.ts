import type {
  AppNotification,
  AuthResult,
  Campaign,
  Config,
  HomeData,
  ImpactData,
  Leaderboard,
  LedgerEntry,
  Machine,
  OtpRequestResult,
  Pack,
  Paginated,
  Payment,
  Payout,
  Profile,
  Redemption,
  Referral,
  Reward,
  Session,
  User,
  Wallet,
} from '../types';
import { mockRequest } from './mock';
import { localizeDeep } from './content';
import { getI18nLocale } from './i18n';
import {
  normalizeCampaign,
  normalizeHome,
  normalizeImpact,
  normalizeLeaderboard,
  normalizeLedger,
  normalizeProfile,
  normalizeRedemption,
  normalizeReward,
} from './normalize';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const IS_DEMO = API_URL.length === 0;
/** Show the fixed OTP hint (dev/demo). Set EXPO_PUBLIC_SHOW_DEMO_HINT=0 in production. */
export const SHOW_DEMO_HINT = process.env.EXPO_PUBLIC_SHOW_DEMO_HINT !== '0';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = 'UNKNOWN', status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function getAuthToken() {
  return authToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  // Single choke point: both demo (mock) and live payloads pass through the
  // content localization layer so seeded Portuguese copy follows the UI locale.
  const locale = getI18nLocale();
  if (IS_DEMO) {
    return localizeDeep(await mockRequest<T>(method, path, body), locale);
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const code = payload?.error?.code ?? `HTTP_${res.status}`;
    const message = payload?.error?.message ?? res.statusText;
    throw new ApiError(message, code, res.status);
  }
  return localizeDeep(payload as T, locale);
}

const q = (params: Record<string, string | number | undefined | null>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
};

/* ------------------------------------------------------------------ auth */
export const authApi = {
  requestOtp: (identifier: string, channel: 'sms' | 'email' = 'sms') =>
    request<OtpRequestResult>('POST', '/auth/request-otp', { identifier, channel }),
  verify: (identifier: string, code: string, locale: string) => {
    // The backend contract only knows pt-BR/en; zh-Hant is a client-side locale.
    const apiLocale = locale === 'en' ? 'en' : 'pt-BR';
    return request<AuthResult>('POST', '/auth/verify', { identifier, code, locale: apiLocale });
  },
  refresh: (refreshToken: string) => request<{ accessToken: string; refreshToken: string }>('POST', '/auth/refresh', { refreshToken }),
  logout: () => request<void>('POST', '/auth/logout'),
};

/* ------------------------------------------------------------- profile */
export const userApi = {
  me: async () => normalizeProfile(await request<any>('GET', '/me')),
  home: async () => normalizeHome(await request<any>('GET', '/home')),
  update: async (patch: Partial<Pick<User, 'name' | 'email' | 'locale'>> & { marketingOptIn?: boolean }) => {
    await request<any>('PATCH', '/me', patch);
    return normalizeProfile(await request<any>('GET', '/me'));
  },
  consent: (lgpd: boolean, marketing: boolean) => request<{ consent: User['consent'] }>('POST', '/me/consent', { lgpd, marketing }),
  exportData: () => request<{ jobId: string }>('GET', '/me/export'),
  deleteAccount: () => request<{ scheduledFor: string }>('DELETE', '/me'),
};

/* -------------------------------------------------------------- wallet */
export const walletApi = {
  get: () => request<Wallet>('GET', '/wallet'),
  entries: async (params: { type?: string; cursor?: string; limit?: number } = {}) => {
    const raw = await request<Paginated<any>>('GET', `/wallet/entries${q(params)}`);
    return { items: (raw.items ?? []).map((entry) => normalizeLedger(entry)), nextCursor: raw.nextCursor ?? null };
  },
};

/* ------------------------------------------------------------- rewards */
export const rewardsApi = {
  list: async (params: { category?: string; search?: string; cursor?: string; limit?: number } = {}) => {
    const raw = await request<Paginated<any>>('GET', `/rewards${q(params)}`);
    return { items: (raw.items ?? []).map(normalizeReward), nextCursor: raw.nextCursor ?? null };
  },
  get: async (id: string) => {
    const raw = await request<{ reward: any; related: any[] }>('GET', `/rewards/${id}`);
    return { reward: normalizeReward(raw.reward), related: (raw.related ?? []).map(normalizeReward) };
  },
  redeem: async (id: string, idempotencyKey: string, delivery?: Record<string, string>) => {
    const raw = await request<{ redemption: any; wallet: Wallet }>('POST', `/rewards/${id}/redeem`, { quantity: 1, delivery }, { 'Idempotency-Key': idempotencyKey });
    return { redemption: normalizeRedemption(raw.redemption), wallet: raw.wallet };
  },
  redemptions: async (status?: string) => {
    const raw = await request<Paginated<any>>('GET', `/redemptions${q({ status })}`);
    return { items: (raw.items ?? []).map(normalizeRedemption), nextCursor: raw.nextCursor ?? null };
  },
  markUsed: async (id: string) => {
    const raw = await request<{ redemption: any }>('POST', `/redemptions/${id}/mark-used`);
    return { redemption: normalizeRedemption(raw.redemption) };
  },
};

/* ------------------------------------------------------------ campaigns */
export const campaignApi = {
  list: async () => {
    const raw = await request<{ items: any[] }>('GET', '/campaigns');
    return { items: (raw.items ?? []).map(normalizeCampaign) };
  },
  get: async (id: string) => {
    const raw = await request<{ campaign: any; leaderboard: Leaderboard['rows']; userPosition: number }>('GET', `/campaigns/${id}`);
    return { campaign: normalizeCampaign(raw.campaign), leaderboard: raw.leaderboard ?? [], userPosition: raw.userPosition ?? 0 };
  },
  leaderboard: async (scope: 'condo' | 'building' | 'city', campaignId?: string) =>
    normalizeLeaderboard(await request<any>('GET', `/leaderboard${q({ scope, campaignId })}`)),
};

/* ------------------------------------------------------------- machines */
export const machineApi = {
  list: (coords?: { lat: number; lng: number }) => request<{ items: Machine[] }>('GET', `/machines${q(coords ?? {})}`),
};

/* ------------------------------------------------------------- sessions */
export const sessionApi = {
  start: (machineCode: string) => request<{ session: Session; pollAfterMs: number }>('POST', '/sessions/start', { machineCode, source: 'qr' }),
  get: (id: string) => request<{ session: Session | null }>('GET', `/sessions/${id}`),
  simulateDeposit: (id: string, material?: string) =>
    request<{ deposit: unknown; session: Session }>('POST', `/sessions/${id}/simulate-deposit`, { material }),
  complete: (id: string) => request<{ session: Session }>('POST', `/sessions/${id}/complete`),
};

/* ------------------------------------------------------------- payments */
export const paymentApi = {
  packs: () => request<{ items: Pack[] }>('GET', '/payments/packs'),
  checkout: (packId: string, successUrl: string, cancelUrl: string, idempotencyKey: string) =>
    request<{ payment: Payment; wallet: Wallet }>(
      'POST',
      '/payments/checkout',
      { packId, successUrl, cancelUrl },
      { 'Idempotency-Key': idempotencyKey },
    ),
  get: (id: string) => request<{ payment: Payment }>('GET', `/payments/${id}`),
  mockComplete: (id: string, amountCents: number, bonusPoints: number) =>
    request<{ payment: Payment; wallet: Wallet }>('POST', `/payments/${id}/mock-complete`, { amountCents, bonusPoints }),
  payout: (amountCents: number, pixKey: string, pixKeyType: string, idempotencyKey: string) =>
    request<{ payout: Payout }>('POST', '/payouts', { amountCents, pixKey, pixKeyType }, { 'Idempotency-Key': idempotencyKey }),
  payMiniMarket: (machineCode: string, amountCents: number) =>
    request<{ payment: { id: string; status: string; code: string }; wallet: Wallet }>('POST', '/payments/mini-market', { machineCode, amountCents }),
};

/* --------------------------------------------------------- notifications */
export const notificationApi = {
  list: async () => {
    const raw = await request<{ items: any[]; unread: number }>('GET', '/notifications');
    return {
      unread: Number(raw.unread ?? 0),
      items: (raw.items ?? []).map((item) => ({
        id: String(item.id ?? ''),
        title: String(item.title ?? ''),
        body: String(item.body ?? ''),
        kind: notificationKind(item.kind ?? item.type),
        read: Boolean(item.read),
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        deepLink: notificationLink(item.deepLink),
      })),
    };
  },
  readAll: () => request<{ ok: boolean }>('POST', '/notifications/read-all'),
  read: (id: string) => request<{ ok: boolean }>('POST', `/notifications/${id}/read`),
};

function notificationKind(raw: string | undefined): 'reward' | 'campaign' | 'machine' | 'payout' | 'system' {
  const type = (raw ?? '').toLowerCase();
  if (type.includes('campaign')) return 'campaign';
  if (type.includes('redemption')) return 'reward';
  if (type.includes('referral')) return 'reward';
  if (type.includes('session') || type.includes('machine')) return 'machine';
  if (type.includes('payout')) return 'payout';
  if (type.includes('reward')) return 'reward';
  return 'system';
}

function notificationLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.replace(/^recio:\/\//, '/').replace(/^\/+/, '/');
  if (path.startsWith('/campaigns/')) return path.replace('/campaigns/', '/campaign/');
  if (path.startsWith('/redemptions')) return '/orders';
  if (path.startsWith('/wallet')) return '/wallet';
  if (path.startsWith('/referral')) return '/referral';
  if (path.startsWith('/notifications')) return '/notifications';
  return null;
}

/* -------------------------------------------------------------- misc */
export const miscApi = {
  config: () => request<Config>('GET', '/config'),
  impact: async () => normalizeImpact(await request<any>('GET', '/impact')),
  referral: () => request<Referral>('GET', '/referral'),
  applyReferral: (code: string) => request<{ applied: boolean; bonusPoints: number }>('POST', '/referral/apply', { code }),
};

export const demoEngine = { request };

