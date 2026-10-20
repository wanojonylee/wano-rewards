import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  campaignApi,
  machineApi,
  miscApi,
  notificationApi,
  paymentApi,
  rewardsApi,
  sessionApi,
  userApi,
  walletApi,
} from './api';
import type { ImpactData, Leaderboard, Machine, Profile } from '../types';

export const qk = {
  home: ['home'] as const,
  profile: ['profile'] as const,
  wallet: ['wallet'] as const,
  ledger: (type?: string) => ['ledger', type ?? 'all'] as const,
  rewards: (category: string, search: string) => ['rewards', category, search] as const,
  reward: (id: string) => ['reward', id] as const,
  redemptions: (status?: string) => ['redemptions', status ?? 'all'] as const,
  campaigns: ['campaigns'] as const,
  campaign: (id: string) => ['campaign', id] as const,
  leaderboard: (scope: string) => ['leaderboard', scope] as const,
  machines: ['machines'] as const,
  notifications: ['notifications'] as const,
  referral: ['referral'] as const,
  packs: ['packs'] as const,
  impact: ['impact'] as const,
};

export function useHome() {
  return useQuery({ queryKey: qk.home, queryFn: userApi.home, staleTime: 15_000 });
}

export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: userApi.me, staleTime: 30_000 });
}

export function useWallet() {
  return useQuery({ queryKey: qk.wallet, queryFn: walletApi.get });
}

export function useLedger(type?: string) {
  return useQuery({ queryKey: qk.ledger(type), queryFn: () => walletApi.entries({ type }) });
}

export function useRewards(category: string, search: string) {
  return useQuery({
    queryKey: qk.rewards(category, search),
    queryFn: () => rewardsApi.list({ category: category === 'all' ? undefined : category, search }),
    staleTime: 20_000,
  });
}

export function useReward(id: string) {
  return useQuery({ queryKey: qk.reward(id), queryFn: () => rewardsApi.get(id) });
}

export function useRedemptions(status?: string) {
  return useQuery({ queryKey: qk.redemptions(status), queryFn: () => rewardsApi.redemptions(status) });
}

export function useCampaigns() {
  return useQuery({ queryKey: qk.campaigns, queryFn: () => campaignApi.list() });
}

export function useCampaign(id: string) {
  return useQuery({ queryKey: qk.campaign(id), queryFn: () => campaignApi.get(id) });
}

export function useLeaderboard(scope: 'condo' | 'building' | 'city') {
  return useQuery({ queryKey: qk.leaderboard(scope), queryFn: () => campaignApi.leaderboard(scope) });
}

export function useMachines() {
  return useQuery({ queryKey: qk.machines, queryFn: () => machineApi.list() });
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications, queryFn: notificationApi.list });
}

export function useReferral() {
  return useQuery({ queryKey: qk.referral, queryFn: miscApi.referral });
}

export function usePacks() {
  return useQuery({ queryKey: qk.packs, queryFn: paymentApi.packs });
}

export function useImpact() {
  return useQuery({ queryKey: qk.impact, queryFn: miscApi.impact });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key, delivery }: { id: string; key: string; delivery?: Record<string, string> }) =>
      rewardsApi.redeem(id, key, delivery),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['redemptions'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useStartSession() {
  return useMutation({ mutationFn: (machineCode: string) => sessionApi.start(machineCode) });
}

export function useSimulateDeposit() {
  return useMutation({ mutationFn: ({ id, material }: { id: string; material?: string }) => sessionApi.simulateDeposit(id, material) });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: ({ packId, successUrl, cancelUrl, key }: { packId: string; successUrl: string; cancelUrl: string; key: string }) =>
      paymentApi.checkout(packId, successUrl, cancelUrl, key),
  });
}

export function useMockComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amountCents, bonusPoints }: { id: string; amountCents: number; bonusPoints: number }) =>
      paymentApi.mockComplete(id, amountCents, bonusPoints),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function usePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amountCents, pixKey, pixKeyType, key }: { amountCents: number; pixKey: string; pixKeyType: string; key: string }) =>
      paymentApi.payout(amountCents, pixKey, pixKeyType, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useMarkRedemptionUsed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rewardsApi.markUsed(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['redemptions'] }),
  });
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.readAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.update,
    onSuccess: (profile) => {
      queryClient.setQueryData<Profile>(qk.profile, profile);
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function useConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lgpd, marketing }: { lgpd: boolean; marketing: boolean }) => userApi.consent(lgpd, marketing),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useApplyReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => miscApi.applyReferral(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => userApi.deleteAccount() });
}

export function useExportData() {
  return useMutation({ mutationFn: () => userApi.exportData() });
}

export type { ImpactData, Leaderboard, Machine };
