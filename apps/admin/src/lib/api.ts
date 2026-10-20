import { mockState } from './mock';
import { localizeDeep } from './content';
import { getActiveLocale } from './i18n';
import { translateCurrent } from './i18n';
import type {
  Campaign,
  DepositRow,
  Machine,
  Metrics,
  PayoutsResponse,
  Reconciliation,
  Redemption,
  Reward,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const USE_MOCK = BASE.length === 0;
const TOKEN_KEY = 'wano.admin.token';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 0, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function decodeRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    if (res.status === 401) setToken(null);
    throw new ApiError(payload?.error?.message ?? res.statusText, res.status, payload?.error?.code ?? `HTTP_${res.status}`);
  }
  return localizeDeep(payload, getActiveLocale()) as T;
}

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  async login(identifier: string, code: string): Promise<{ token: string; name: string }> {
    if (USE_MOCK) {
      await wait(320);
      if (code !== '123456') throw new ApiError(translateCurrent('error.invalidCode'), 401, 'INVALID_CODE');
      return { token: 'mock-admin-token', name: 'Operador WANO' };
    }
    const verified = await request<{ accessToken: string; user: { name?: string } }>('POST', '/auth/verify', {
      identifier,
      code,
      locale: 'pt-BR',
    });
    const role = decodeRole(verified.accessToken);
    if (role !== 'admin') throw new ApiError(translateCurrent('error.forbidden'), 403, 'FORBIDDEN');
    return { token: verified.accessToken, name: verified.user?.name ?? 'Operador WANO' };
  },

  async requestOtp(identifier: string): Promise<{ devCode?: string }> {
    if (USE_MOCK) {
      await wait(260);
      return { devCode: '123456' };
    }
    return request('POST', '/auth/request-otp', { identifier, channel: identifier.includes('@') ? 'email' : 'sms' });
  },

  async metrics(): Promise<Metrics> {
    if (USE_MOCK) {
      await wait();
      return mockState.metrics();
    }
    const raw = await request<Partial<Metrics> & { machines?: Metrics['machines'] }>('GET', '/admin/metrics');
    return {
      users: raw.users ?? 0,
      depositsTotal: raw.depositsTotal ?? 0,
      pointsIssued: raw.pointsIssued ?? 0,
      redemptionRate: raw.redemptionRate ?? 0,
      payoutPendingCents: raw.payoutPendingCents ?? 0,
      kgTotal: raw.kgTotal ?? 0,
      co2SavedKg: raw.co2SavedKg ?? 0,
      machines: raw.machines ?? { online: 0, maintenance: 0, full: 0 },
      activeCampaigns: raw.activeCampaigns ?? (raw as any).campaignsActive ?? 0,
      activeRewards: raw.activeRewards ?? (raw as any).redemptionsActive ?? 0,
      depositsByDay: raw.depositsByDay ?? [],
    };
  },

  async payouts(status = 'all'): Promise<PayoutsResponse> {
    if (USE_MOCK) {
      await wait();
      return mockState.payouts(status);
    }
    const raw = await request<{ items?: any[]; totals?: any }>('GET', `/admin/payouts?status=${encodeURIComponent(status)}`);
    const items = (raw.items ?? []).map((item) => ({
      id: item.id,
      userName: item.userName ?? item.user?.name ?? '—',
      userPhone: item.userPhone ?? item.user?.phone ?? '—',
      amountCents: item.amountCents ?? 0,
      feeCents: item.feeCents ?? 0,
      netCents: item.netCents ?? 0,
      pixKeyMasked: item.pixKeyMasked ?? '—',
      status: item.status ?? 'pending',
      provider: item.provider ?? '—',
      providerPayoutId: item.providerPayoutId ?? null,
      failureReason: item.failureReason ?? null,
      createdAt: item.createdAt ?? new Date().toISOString(),
      paidAt: item.paidAt ?? null,
    }));
    const sum = (state: string) => items.filter((item) => item.status === state).reduce((total, item) => total + item.amountCents, 0);
    return {
      items,
      totals: {
        pendingCents: raw.totals?.pendingCents ?? sum('pending'),
        paidCents: raw.totals?.paidCents ?? sum('paid'),
        failedCents: raw.totals?.failedCents ?? sum('failed'),
        count: raw.totals?.count ?? items.length,
      },
    };
  },

  async markPayoutPaid(id: string): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.markPaid(id);
      return;
    }
    await request('POST', `/admin/payouts/${id}/paid`);
  },

  async retryPayout(id: string): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.retry(id);
      return;
    }
    await request('POST', `/admin/payouts/${id}/retry`);
  },

  async failPayout(id: string): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.fail(id);
      return;
    }
    await request('POST', `/admin/payouts/${id}/fail`);
  },

  async reconciliation(): Promise<Reconciliation> {
    if (USE_MOCK) {
      await wait();
      return mockState.reconciliation();
    }
    const raw = await request<any>('GET', '/admin/reconciliation');
    const counts = raw.counts ?? {};
    return {
      generatedAt: raw.generatedAt ?? new Date().toISOString(),
      range: raw.range ?? { from: new Date(Date.now() - 30 * 86_400_000).toISOString(), to: new Date().toISOString() },
      counts: {
        requested: counts.requested ?? counts.total ?? 0,
        paid: counts.paid ?? 0,
        pending: counts.pending ?? 0,
        failed: counts.failed ?? 0,
      },
      requestedCents: raw.requestedCents ?? 0,
      paidCents: raw.paidCents ?? 0,
      pendingCents: raw.pendingCents ?? 0,
      failedCents: raw.failedCents ?? 0,
      refundedCents: raw.refundedCents ?? 0,
      feeCents: raw.feeCents ?? 0,
      ledgerPayoutCents: raw.ledgerPayoutCents ?? 0,
      varianceCents: raw.varianceCents ?? 0,
      balanced: raw.balanced ?? true,
      liabilities: raw.liabilities ?? {
        pointsOutstanding: raw.pointsOutstanding ?? 0,
        creditOutstandingCents: raw.creditOutstandingCents ?? 0,
        withdrawableOutstandingCents: raw.withdrawableOutstandingCents ?? 0,
        balanced: raw.balanced ?? true,
      },
      providers: (raw.providers ?? []).map((provider: any) => ({
        provider: provider.provider ?? '—',
        count: provider.count ?? provider.counts?.total ?? 0,
        amountCents: provider.amountCents ?? provider.requestedCents ?? 0,
      })),
    };
  },

  async redemptions(status = 'all'): Promise<Redemption[]> {
    if (USE_MOCK) {
      await wait();
      return mockState.redemptions(status);
    }
    const raw = await request<{ items?: any[] }>('GET', `/admin/redemptions?status=${encodeURIComponent(status)}`);
    return (raw.items ?? []).map((item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      userName: item.userName ?? item.user?.name ?? '—',
      userPhone: item.userPhone ?? item.user?.phone ?? '—',
      rewardTitle: item.rewardTitle ?? item.reward?.title ?? '—',
      rewardPartner: item.rewardPartner ?? item.reward?.partner ?? '—',
      pointsSpent: item.pointsSpent ?? 0,
      createdAt: item.createdAt ?? item.created_at,
      expiresAt: item.expiresAt ?? item.expires_at,
    }));
  },

  async fulfillRedemption(id: string): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.fulfill(id);
      return;
    }
    await request('POST', `/admin/redemptions/${id}/fulfill`);
  },

  async campaigns(): Promise<Campaign[]> {
    if (USE_MOCK) {
      await wait();
      return mockState.campaigns();
    }
    const raw = await request<{ items?: any[] }>('GET', '/campaigns');
    return (raw.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      brand: item.brand,
      subtitle: item.subtitle,
      material: item.material,
      multiplier: item.multiplier,
      bonusPoints: item.bonusPoints,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      imageKey: item.imageKey,
      accent: item.accent,
      active: item.active ?? true,
    }));
  },

  async saveCampaign(campaign: Campaign): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.saveCampaign(campaign);
      return;
    }
    const payload = {
      title: campaign.title,
      brand: campaign.brand,
      subtitle: campaign.subtitle,
      material: campaign.material,
      multiplier: campaign.multiplier,
      bonusPoints: campaign.bonusPoints,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      imageKey: campaign.imageKey,
      accent: campaign.accent,
      active: campaign.active ?? true,
    };
    if (campaign.id.startsWith('cmp_') && !campaign.id.includes('new')) await request('PATCH', `/admin/campaigns/${campaign.id}`, payload);
    else await request('POST', '/admin/campaigns', payload);
  },

  async rewards(): Promise<Reward[]> {
    if (USE_MOCK) {
      await wait();
      return mockState.rewards();
    }
    const raw = await request<{ items?: any[] }>('GET', '/rewards?limit=50');
    return (raw.items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      category: item.category,
      partner: item.partner,
      pointsCost: item.pointsCost,
      valueCents: item.valueCents,
      imageKey: item.imageKey,
      stock: item.stock,
      active: item.active ?? true,
      terms: item.terms ?? '',
    }));
  },

  async saveReward(reward: Reward): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.saveReward(reward);
      return;
    }
    const payload = {
      title: reward.title,
      subtitle: reward.subtitle,
      category: reward.category,
      partner: reward.partner,
      pointsCost: reward.pointsCost,
      valueCents: reward.valueCents,
      stock: reward.stock,
      imageKey: reward.imageKey,
      terms: reward.terms,
      active: reward.active ?? true,
    };
    if (reward.id.startsWith('rwd_')) await request('PATCH', `/admin/rewards/${reward.id}`, payload);
    else await request('POST', '/admin/rewards', payload);
  },

  async machines(): Promise<Machine[]> {
    if (USE_MOCK) {
      await wait();
      return mockState.machines();
    }
    const raw = await request<{ items: Machine[] }>('GET', '/machines');
    return raw.items;
  },

  async setBoxLevel(code: string, fillPercent: number): Promise<void> {
    if (USE_MOCK) {
      await wait();
      mockState.setBoxLevel(code, fillPercent);
      return;
    }
    await request('POST', `/admin/machines/${code}/box-level`, { fillPercent });
  },

  async deposits(from?: string, to?: string): Promise<DepositRow[]> {
    if (USE_MOCK) {
      await wait();
      return mockState.deposits();
    }
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const csv = await fetch(`${BASE}/admin/deposits.csv?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    }).then((res) => {
      if (!res.ok) throw new ApiError(translateCurrent('error.depositsLoad'), res.status);
      return res.text();
    });
    return localizeDeep(parseCsv(csv), getActiveLocale());
  },

  async downloadDepositsCsv(from?: string, to?: string): Promise<Blob> {
    if (USE_MOCK) {
      await wait();
      const rows = mockState.deposits();
      const header = 'id,created_at,user_name,machine_code,material,sku_name,weight_grams,accepted,reject_reason,points,cashback_cents';
      const body = rows
        .map((r) => [r.id, r.createdAt, r.userName, r.machineCode, r.material, r.skuName, r.weightGrams, r.accepted ? 1 : 0, r.rejectReason ?? '', r.points, r.cashbackCents].join(','))
        .join('\n');
      return new Blob([`${header}\n${body}`], { type: 'text/csv' });
    }
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const res = await fetch(`${BASE}/admin/deposits.csv?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) throw new ApiError(translateCurrent('error.exportCsv'), res.status);
    return res.blob();
  },
};

function safeNumber(value: string): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Minimal RFC-4180 parser: handles quoted fields with commas and escaped quotes. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(csv: string): DepositRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const index = (name: string) => header.indexOf(name);
  return lines
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells = parseCsvLine(line);
      const value = (name: string) => cells[index(name)] ?? '';
      return {
        id: value('id'),
        createdAt: value('created_at'),
        userName: value('user_name'),
        machineCode: value('machine_code'),
        material: value('material'),
        skuName: value('sku_name'),
        weightGrams: safeNumber(value('weight_grams')),
        accepted: value('accepted') === '1',
        rejectReason: value('reject_reason') || null,
        points: safeNumber(value('points')),
        cashbackCents: safeNumber(value('cashback_cents')),
      };
    });
}



