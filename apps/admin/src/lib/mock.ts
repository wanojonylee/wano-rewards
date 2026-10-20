import { getActiveLocale } from './i18n';
import type { Locale } from './i18n';
import type {
  Campaign,
  DepositRow,
  Machine,
  Metrics,
  Payout,
  PayoutsResponse,
  Reconciliation,
  Redemption,
  Reward,
} from './types';

type LocalizedText = Record<Locale, string>;

/**
 * Localised demo content keyed by entity id. Brand names, partners, addresses and
 * person names are intentionally left untouched — only titles/subtitles, machine
 * display names and failure reasons are translated.
 */
const contentMap: Record<string, Record<string, LocalizedText>> = {
  // campaigns
  cmp_outubro: {
    title: { 'zh-Hant': '十月循環', en: 'Circular October' },
    subtitle: { 'zh-Hant': '所有 PET 瓶雙倍點數', en: '2× points on all PET bottles' },
  },
  cmp_danone: {
    title: { 'zh-Hant': 'Danone 循環', en: 'Danone Circular' },
    subtitle: { 'zh-Hant': 'Danone 瓶多送 +50 點', en: 'Danone bottles earn +50 pts' },
  },
  cmp_aurora: {
    title: { 'zh-Hant': 'Aurora 挑戰', en: 'Aurora Challenge' },
    subtitle: { 'zh-Hant': '30 天內回收 1,200 kg', en: '1,200 kg in 30 days' },
  },
  cmp_alu: {
    title: { 'zh-Hant': '鋁罐加速', en: 'Aluminium Turbo' },
    subtitle: { 'zh-Hant': '鋁罐三倍點數', en: '3× points on cans' },
  },
  cmp_indique: {
    title: { 'zh-Hant': '推薦有禮', en: 'Refer and Earn' },
    subtitle: { 'zh-Hant': '邀請好友，獎勵加倍', en: 'Invite friends and double the bonus' },
  },
  cmp_glass: {
    title: { 'zh-Hant': '零浪費週', en: 'Zero Waste Week' },
    subtitle: { 'zh-Hant': '玻璃雙倍點數', en: '2× points on glass' },
  },
  // rewards
  rwd_coffee: {
    title: { 'zh-Hant': 'Padoca 精品咖啡', en: 'Specialty coffee at Padoca' },
    subtitle: { 'zh-Hant': '手沖咖啡 + 起司麵包', en: 'Brewed coffee + pão de queijo' },
    terms: { 'zh-Hant': '週一至週五有效。', en: 'Valid Monday to Friday.' },
  },
  rwd_market: {
    title: { 'zh-Hant': '超市 R$ 25 折抵', en: 'R$ 25 at the market' },
    subtitle: { 'zh-Hant': 'Mercado Bom Preço 折抵金', en: 'Credit at Mercado Bom Preço' },
    terms: { 'zh-Hant': '90 天內有效。', en: 'Valid for 90 days.' },
  },
  rwd_cinema: {
    title: { 'zh-Hant': '電影：2 張票', en: 'Cinema: 2 tickets' },
    subtitle: { 'zh-Hant': 'Cine Jardim 2D 場次', en: '2D screening at Cine Jardim' },
    terms: { 'zh-Hant': '視供應情況而定。', en: 'Subject to availability.' },
  },
  rwd_ecobag: {
    title: { 'zh-Hant': 'WANO 環保袋', en: 'WANO tote bag' },
    subtitle: { 'zh-Hant': '有機棉托特袋', en: 'Organic cotton tote' },
    terms: { 'zh-Hant': '10 個工作天內送達。', en: 'Delivery within 10 business days.' },
  },
  rwd_plant: {
    title: { 'zh-Hant': '原生樹苗', en: 'Native tree sapling' },
    subtitle: { 'zh-Hant': '可種植的黃花風鈴木', en: 'Yellow ipê to plant' },
    terms: { 'zh-Hant': '附種植說明配送。', en: 'Delivered with planting instructions.' },
  },
  rwd_ocean: {
    title: { 'zh-Hant': '捐贈 500 點給 ONG Oceano', en: 'Donate 500 pts to ONG Oceano' },
    subtitle: { 'zh-Hant': '支持海灘淨灘', en: 'Support beach clean-ups' },
    terms: { 'zh-Hant': '象徵性捐款。', en: 'Symbolic donation.' },
  },
  rwd_icecream: {
    title: { 'zh-Hant': '手工冰淇淋', en: 'Artisan ice cream' },
    subtitle: { 'zh-Hant': 'Gelateria Aurora 300ml 杯裝', en: '300ml cup at Gelateria Aurora' },
    terms: { 'zh-Hant': '週二至週日有效。', en: 'Valid Tuesday to Sunday.' },
  },
  rwd_bike: {
    title: { 'zh-Hant': '共享單車：10 次騎乘', en: 'Shared bike: 10 rides' },
    subtitle: { 'zh-Hant': 'Bike Sampa App 折抵', en: 'Credit in the Bike Sampa app' },
    terms: { 'zh-Hant': '每次騎乘最多 45 分鐘。', en: 'Rides of up to 45 minutes.' },
  },
  // redemptions (reward title snapshot per redemption id)
  rdm_701: { rewardTitle: { 'zh-Hant': 'Padoca 精品咖啡', en: 'Specialty coffee at Padoca' } },
  rdm_702: { rewardTitle: { 'zh-Hant': '電影：2 張票', en: 'Cinema: 2 tickets' } },
  rdm_703: { rewardTitle: { 'zh-Hant': '手工冰淇淋', en: 'Artisan ice cream' } },
  rdm_704: {
    rewardTitle: { 'zh-Hant': 'Bilhete Único 儲值 R$ 20', en: 'Bilhete Único top-up R$ 20' },
  },
  rdm_705: { rewardTitle: { 'zh-Hant': 'RecIO 環保袋', en: 'RecIO tote bag' } },
  rdm_706: { rewardTitle: { 'zh-Hant': '健身房一日通行', en: 'Gym day pass' } },
  // machines (display names; partner/building names stay)
  m1: {
    name: { 'zh-Hant': 'Aurora · Torre Ipê（大廳）', en: 'Aurora · Torre Ipê (lobby)' },
  },
  m2: {
    name: { 'zh-Hant': 'Aurora · 主入口', en: 'Aurora · Main entrance' },
  },
  m3: {
    name: { 'zh-Hant': 'Aurora · Torre Ipê（車庫）', en: 'Aurora · Torre Ipê (garage)' },
  },
  m4: { name: { 'zh-Hant': 'Aurora · Torre Jacarandá', en: 'Aurora · Torre Jacarandá' } },
  m5: { name: { 'zh-Hant': 'Mercado Bom Preço', en: 'Mercado Bom Preço' } },
  m6: { name: { 'zh-Hant': 'Padoca do Bairro', en: 'Padoca do Bairro' } },
  m7: { name: { 'zh-Hant': 'Academia Forma', en: 'Academia Forma' } },
  m8: { name: { 'zh-Hant': 'Praça das Corujas', en: 'Praça das Corujas' } },
  // payout failure reasons
  po_1036: {
    failureReason: { 'zh-Hant': 'PIX 金鑰無效', en: 'Invalid PIX key' },
  },
};

/** Free-text demo content (row-level strings) keyed by their seeded Portuguese value. */
const contentStrings: Record<string, LocalizedText> = {
  'Formato não reconhecido': { 'zh-Hant': '無法辨識的容器格式', en: 'Unrecognised container format' },
  'Água Crystal 500ml': { 'zh-Hant': 'Crystal 礦泉水 500ml', en: 'Crystal water 500ml' },
  'Coca-Cola 2L': { 'zh-Hant': 'Coca-Cola 2L', en: 'Coca-Cola 2L' },
  'Lata Heineken 350ml': { 'zh-Hant': 'Heineken 罐裝 350ml', en: 'Heineken can 350ml' },
  'Garrafa Stella 330ml': { 'zh-Hant': 'Stella 瓶裝 330ml', en: 'Stella bottle 330ml' },
};

const MANUAL_FAILURE: LocalizedText = {
  'zh-Hant': '操作員手動標記失敗',
  en: 'Manually failed by operator',
};

function localized(id: string, field: string, fallback: string): string {
  const entry = contentMap[id]?.[field];
  return entry ? entry[getActiveLocale()] : fallback;
}

function localizeContentString(value: string): string {
  const entry = contentStrings[value];
  return entry ? entry[getActiveLocale()] : value;
}

function localizeManualFailure(value: string): string {
  if (value !== MANUAL_FAILURE['zh-Hant'] && value !== MANUAL_FAILURE.en) return value;
  return MANUAL_FAILURE[getActiveLocale()];
}

const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

const NAMES = [
  ['Marina Costa', '+55 11 99999-0000'],
  ['Lucas Almeida', '+55 11 98888-1234'],
  ['Beatriz Nogueira', '+55 11 97777-3344'],
  ['Rafael Souza', '+55 11 96666-7788'],
  ['Camila Ribeiro', '+55 11 95555-2211'],
  ['Thiago Martins', '+55 11 94444-9090'],
  ['Fernanda Rocha', '+55 11 93333-4567'],
];

let payouts: Payout[] = [
  { id: 'po_1041', userName: NAMES[0][0], userPhone: NAMES[0][1], amountCents: 2000, feeCents: 150, netCents: 1850, pixKeyMasked: 'ma***@example.com', status: 'pending', provider: 'mock', providerPayoutId: 'mock_pix_9f21', failureReason: null, createdAt: iso(2), paidAt: null },
  { id: 'po_1040', userName: NAMES[1][0], userPhone: NAMES[1][1], amountCents: 5000, feeCents: 150, netCents: 4850, pixKeyMasked: 'lu***@gmail.com', status: 'pending', provider: 'mock', providerPayoutId: 'mock_pix_8a12', failureReason: null, createdAt: iso(5), paidAt: null },
  { id: 'po_1039', userName: NAMES[2][0], userPhone: NAMES[2][1], amountCents: 3200, feeCents: 150, netCents: 3050, pixKeyMasked: 'be***@outlook.com', status: 'pending', provider: 'mock', providerPayoutId: 'mock_pix_77ab', failureReason: null, createdAt: iso(9), paidAt: null },
  { id: 'po_1038', userName: NAMES[3][0], userPhone: NAMES[3][1], amountCents: 2500, feeCents: 150, netCents: 2350, pixKeyMasked: 'ra***@example.com', status: 'paid', provider: 'mock', providerPayoutId: 'mock_pix_66cc', failureReason: null, createdAt: iso(26), paidAt: iso(25) },
  { id: 'po_1037', userName: NAMES[4][0], userPhone: NAMES[4][1], amountCents: 8000, feeCents: 150, netCents: 7850, pixKeyMasked: 'ca***@gmail.com', status: 'paid', provider: 'mock', providerPayoutId: 'mock_pix_55dd', failureReason: null, createdAt: iso(30), paidAt: iso(29) },
  { id: 'po_1036', userName: NAMES[5][0], userPhone: NAMES[5][1], amountCents: 2000, feeCents: 150, netCents: 1850, pixKeyMasked: 'th***@example.com', status: 'failed', provider: 'mock', providerPayoutId: 'mock_pix_44ee', failureReason: 'Chave PIX inválida', createdAt: iso(48), paidAt: null },
  { id: 'po_1035', userName: NAMES[6][0], userPhone: NAMES[6][1], amountCents: 15000, feeCents: 150, netCents: 14850, pixKeyMasked: 'fe***@gmail.com', status: 'paid', provider: 'mock', providerPayoutId: 'mock_pix_33ff', failureReason: null, createdAt: iso(72), paidAt: iso(70) },
];

let redemptions: Redemption[] = [
  { id: 'rdm_701', code: '7K2M9QXP', status: 'active', userName: NAMES[0][0], userPhone: NAMES[0][1], rewardTitle: 'Café especial na Padoca', rewardPartner: 'Padoca do Bairro', pointsSpent: 350, createdAt: daysAgo(1), expiresAt: daysAgo(-29) },
  { id: 'rdm_702', code: '3F8H5JWN', status: 'active', userName: NAMES[2][0], userPhone: NAMES[2][1], rewardTitle: 'Cinema: 2 ingressos', rewardPartner: 'Cine Jardim', pointsSpent: 1200, createdAt: daysAgo(2), expiresAt: daysAgo(-28) },
  { id: 'rdm_703', code: 'CL7J6X6X', status: 'active', userName: NAMES[1][0], userPhone: NAMES[1][1], rewardTitle: 'Sorvete artesanal', rewardPartner: 'Gelateria Aurora', pointsSpent: 250, createdAt: daysAgo(1), expiresAt: daysAgo(-29) },
  { id: 'rdm_704', code: '9B4C6DRT', status: 'used', userName: NAMES[3][0], userPhone: NAMES[3][1], rewardTitle: 'Bilhete Único recarga R$ 20', rewardPartner: 'SPTrans', pointsSpent: 700, createdAt: daysAgo(9), expiresAt: daysAgo(-20) },
  { id: 'rdm_705', code: 'K7QM2XPA', status: 'fulfilled', userName: NAMES[4][0], userPhone: NAMES[4][1], rewardTitle: 'Ecobag RecIO', rewardPartner: 'RecIO Store', pointsSpent: 650, createdAt: daysAgo(12), expiresAt: daysAgo(-18) },
  { id: 'rdm_706', code: 'B4ND9TRE', status: 'expired', userName: NAMES[5][0], userPhone: NAMES[5][1], rewardTitle: 'Day pass academia', rewardPartner: 'Smart Fit', pointsSpent: 800, createdAt: daysAgo(60), expiresAt: daysAgo(30) },
];

const campaigns: Campaign[] = [
  { id: 'cmp_outubro', title: 'Outubro Circular', brand: 'WANO', subtitle: '2x pontos em todas as garrafas PET', material: 'PET', multiplier: 2, bonusPoints: 0, startsAt: daysAgo(20), endsAt: daysAgo(-12), imageKey: 'bottle', accent: '#3E8E7E', active: true },
  { id: 'cmp_danone', title: 'Danone Circular', brand: 'Danone', subtitle: 'Garrafas Danone valem +50 pts', material: null, multiplier: 1, bonusPoints: 50, startsAt: daysAgo(25), endsAt: daysAgo(-6), imageKey: 'plant', accent: '#5B7F52', active: true },
  { id: 'cmp_aurora', title: 'Desafio Aurora', brand: 'Edifício Aurora', subtitle: '1.200 kg em 30 dias', material: null, multiplier: 1.5, bonusPoints: 0, startsAt: daysAgo(26), endsAt: daysAgo(-4), imageKey: 'bike', accent: '#F59E0B', active: true },
  { id: 'cmp_alu', title: 'Alumínio Turbo', brand: 'WANO', subtitle: '3x pontos em latas', material: 'ALUMINUM', multiplier: 3, bonusPoints: 0, startsAt: daysAgo(3), endsAt: daysAgo(-5), imageKey: 'streaming', accent: '#8C8F98', active: true },
  { id: 'cmp_indique', title: 'Indique e Ganhe', brand: 'WANO', subtitle: 'Convide amigos e dobre o bônus', material: null, multiplier: 1, bonusPoints: 300, startsAt: daysAgo(30), endsAt: daysAgo(-30), imageKey: 'ticket', accent: '#8B5CF6', active: true },
  { id: 'cmp_glass', title: 'Semana Sem Desperdício', brand: 'Coca-Cola', subtitle: '2x pontos em vidro', material: 'GLASS', multiplier: 2, bonusPoints: 0, startsAt: daysAgo(10), endsAt: daysAgo(-2), imageKey: 'coffee', accent: '#4E7FA8', active: false },
];

const rewards: Reward[] = [
  { id: 'rwd_coffee', title: 'Café especial na Padoca', subtitle: 'Café coado + pão de queijo', category: 'voucher', partner: 'Padoca do Bairro', pointsCost: 350, valueCents: 1200, imageKey: 'coffee', stock: 40, active: true, terms: 'Válido de segunda a sexta.' },
  { id: 'rwd_market', title: 'R$ 25 no mercado', subtitle: 'Crédito no Mercado Bom Preço', category: 'voucher', partner: 'Mercado Bom Preço', pointsCost: 900, valueCents: 2500, imageKey: 'market', stock: 25, active: true, terms: 'Válido por 90 dias.' },
  { id: 'rwd_cinema', title: 'Cinema: 2 ingressos', subtitle: 'Sessão 2D no Cine Jardim', category: 'voucher', partner: 'Cine Jardim', pointsCost: 1200, valueCents: 4000, imageKey: 'cinema', stock: 12, active: true, terms: 'Sujeito à disponibilidade.' },
  { id: 'rwd_ecobag', title: 'Ecobag WANO', subtitle: 'Sacola de algodão orgânico', category: 'product', partner: 'WANO Store', pointsCost: 650, valueCents: 2500, imageKey: 'bag', stock: 30, active: true, terms: 'Entrega em até 10 dias úteis.' },
  { id: 'rwd_plant', title: 'Muda de árvore nativa', subtitle: 'Ipê-amarelo para plantar', category: 'product', partner: 'Verde Urbano', pointsCost: 300, valueCents: 900, imageKey: 'plant', stock: 50, active: true, terms: 'Entrega com instruções de plantio.' },
  { id: 'rwd_ocean', title: 'Doar 500 pts para ONG Oceano', subtitle: 'Apoie a limpeza de praias', category: 'donation', partner: 'ONG Oceano', pointsCost: 500, valueCents: 0, imageKey: 'donation', stock: 999, active: true, terms: 'Doação simbólica.' },
  { id: 'rwd_icecream', title: 'Sorvete artesanal', subtitle: 'Copo 300ml na Gelateria Aurora', category: 'voucher', partner: 'Gelateria Aurora', pointsCost: 250, valueCents: 800, imageKey: 'icecream', stock: 35, active: true, terms: 'Válido de terça a domingo.' },
  { id: 'rwd_bike', title: 'Bike compartilhada: 10 viagens', subtitle: 'Crédito no app Bike Sampa', category: 'experience', partner: 'Bike Sampa', pointsCost: 1300, valueCents: 3500, imageKey: 'bike', stock: 10, active: false, terms: 'Viagens de até 45 minutos.' },
];

const machines: Machine[] = [
  { id: 'm1', code: 'RVM-SP-001', name: 'Aurora · Torre Ipê (lobby)', address: 'Rua dos Pinheiros, 1420', distanceMeters: 45, status: 'online', materials: ['PET', 'ALUMINUM', 'GLASS', 'HDPE', 'PP', 'PS_HIPS'], fillPercent: 42, hours: '24h' },
  { id: 'm2', code: 'RVM-SP-007', name: 'Aurora · Portaria principal', address: 'Rua dos Pinheiros, 1420', distanceMeters: 60, status: 'online', materials: ['PET', 'ALUMINUM', 'GLASS'], fillPercent: 31, hours: '24h' },
  { id: 'm3', code: 'RVM-SP-002', name: 'Aurora · Torre Ipê (garagem)', address: 'Rua dos Pinheiros, 1420', distanceMeters: 80, status: 'online', materials: ['PET', 'ALUMINUM', 'HDPE'], fillPercent: 67, hours: '24h' },
  { id: 'm4', code: 'RVM-SP-003', name: 'Aurora · Torre Jacarandá', address: 'Rua dos Pinheiros, 1420', distanceMeters: 120, status: 'online', materials: ['PET', 'ALUMINUM'], fillPercent: 23, hours: '24h' },
  { id: 'm5', code: 'RVM-SP-004', name: 'Mercado Bom Preço', address: 'Rua dos Pinheiros, 540', distanceMeters: 480, status: 'full', materials: ['PET', 'ALUMINUM', 'GLASS'], fillPercent: 100, hours: '07–23h' },
  { id: 'm6', code: 'RVM-SP-005', name: 'Padoca do Bairro', address: 'Rua Fradique Coutinho, 88', distanceMeters: 260, status: 'online', materials: ['PET', 'ALUMINUM'], fillPercent: 88, hours: '06–22h' },
  { id: 'm7', code: 'RVM-SP-006', name: 'Academia Forma', address: 'Rua Harmonia, 210', distanceMeters: 620, status: 'maintenance', materials: ['PET', 'ALUMINUM'], fillPercent: 32, hours: '06–23h' },
  { id: 'm8', code: 'RVM-SP-008', name: 'Praça das Corujas', address: 'Praça Amadeu Decome, 1', distanceMeters: 900, status: 'online', materials: ['PET', 'ALUMINUM', 'GLASS'], fillPercent: 18, hours: '24h' },
];

const deposits: DepositRow[] = Array.from({ length: 14 }).map((_, index) => {
  const person = NAMES[index % NAMES.length];
  const accepted = index % 7 !== 3;
  return {
    id: `dep_${1200 - index}`,
    createdAt: iso(index * 3 + 1),
    userName: person[0],
    machineCode: machines[index % machines.length].code,
    material: ['PET', 'ALUMINUM', 'GLASS', 'HDPE'][index % 4],
    skuName: ['Água Crystal 500ml', 'Coca-Cola 2L', 'Lata Heineken 350ml', 'Garrafa Stella 330ml'][index % 4],
    weightGrams: [28, 47, 15, 305][index % 4],
    accepted,
    rejectReason: accepted ? null : 'Formato não reconhecido',
    points: accepted ? [11, 22, 33, 10][index % 4] : 0,
    cashbackCents: accepted ? [5, 10, 8, 3][index % 4] : 0,
  };
});

const depositsByDay = Array.from({ length: 14 }).map((_, index) => {
  const day = new Date(now - (13 - index) * 86_400_000);
  const count = [212, 248, 231, 289, 304, 276, 198, 254, 312, 328, 296, 341, 318, 362][index];
  return { date: day.toISOString(), count, kg: Math.round(count * 0.045 * 10) / 10 };
});

// Seed snapshots: demo content is only translated while it still matches the seeded
// value, so operator edits are never overwritten by the content map.
const campaignSeed = new Map(campaigns.map((campaign) => [campaign.id, { title: campaign.title, subtitle: campaign.subtitle }]));
const rewardSeed = new Map(
  rewards.map((reward) => [reward.id, { title: reward.title, subtitle: reward.subtitle, terms: reward.terms }]),
);
const redemptionSeed = new Map(redemptions.map((redemption) => [redemption.id, { rewardTitle: redemption.rewardTitle }]));
const machineSeed = new Map(machines.map((machine) => [machine.id, { name: machine.name }]));
const payoutFailureSeed = new Map(payouts.filter((payout) => payout.failureReason).map((payout) => [payout.id, payout.failureReason as string]));

function localizeCampaign(campaign: Campaign): Campaign {
  const seed = campaignSeed.get(campaign.id);
  if (!seed) return campaign;
  return {
    ...campaign,
    title: campaign.title === seed.title ? localized(campaign.id, 'title', campaign.title) : campaign.title,
    subtitle: campaign.subtitle === seed.subtitle ? localized(campaign.id, 'subtitle', campaign.subtitle) : campaign.subtitle,
  };
}

function localizeReward(reward: Reward): Reward {
  const seed = rewardSeed.get(reward.id);
  if (!seed) return reward;
  return {
    ...reward,
    title: reward.title === seed.title ? localized(reward.id, 'title', reward.title) : reward.title,
    subtitle: reward.subtitle === seed.subtitle ? localized(reward.id, 'subtitle', reward.subtitle) : reward.subtitle,
    terms: reward.terms === seed.terms ? localized(reward.id, 'terms', reward.terms) : reward.terms,
  };
}

function localizeRedemption(redemption: Redemption): Redemption {
  const seed = redemptionSeed.get(redemption.id);
  if (!seed) return redemption;
  return {
    ...redemption,
    rewardTitle:
      redemption.rewardTitle === seed.rewardTitle
        ? localized(redemption.id, 'rewardTitle', redemption.rewardTitle)
        : redemption.rewardTitle,
  };
}

function localizeMachine(machine: Machine): Machine {
  const seed = machineSeed.get(machine.id);
  if (!seed) return machine;
  return {
    ...machine,
    name: machine.name === seed.name ? localized(machine.id, 'name', machine.name) : machine.name,
  };
}

function localizePayout(payout: Payout): Payout {
  if (!payout.failureReason) return payout;
  const seed = payoutFailureSeed.get(payout.id);
  const failureReason =
    seed && payout.failureReason === seed
      ? localized(payout.id, 'failureReason', payout.failureReason)
      : localizeManualFailure(payout.failureReason);
  return failureReason === payout.failureReason ? payout : { ...payout, failureReason };
}

function localizeDeposit(deposit: DepositRow): DepositRow {
  return {
    ...deposit,
    skuName: localizeContentString(deposit.skuName),
    rejectReason: deposit.rejectReason ? localizeContentString(deposit.rejectReason) : null,
  };
}

export const mockState = {
  metrics(): Metrics {
    return {
      users: 1284,
      depositsTotal: 18432,
      pointsIssued: 186400,
      redemptionRate: 23.6,
      payoutPendingCents: payouts.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amountCents, 0),
      kgTotal: 4821.4,
      co2SavedKg: 6120.8,
      machines: { online: 6, maintenance: 1, full: 1 },
      activeCampaigns: campaigns.filter((c) => c.active !== false).length,
      activeRewards: rewards.filter((r) => r.active !== false).length,
      depositsByDay,
    };
  },
  payouts(status = 'all'): PayoutsResponse {
    const items = status === 'all' ? payouts : payouts.filter((p) => p.status === status);
    return {
      items: items.map(localizePayout),
      totals: {
        pendingCents: payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountCents, 0),
        paidCents: payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountCents, 0),
        failedCents: payouts.filter((p) => p.status === 'failed').reduce((s, p) => s + p.amountCents, 0),
        count: items.length,
      },
    };
  },
  markPaid(id: string) {
    payouts = payouts.map((p) => (p.id === id ? { ...p, status: 'paid', paidAt: new Date().toISOString(), failureReason: null } : p));
  },
  retry(id: string) {
    payouts = payouts.map((p) => (p.id === id ? { ...p, status: 'pending', failureReason: null } : p));
  },
  fail(id: string) {
    payouts = payouts.map((p) =>
      p.id === id ? { ...p, status: 'failed', failureReason: MANUAL_FAILURE[getActiveLocale()] } : p,
    );
  },
  redemptions(status?: string): Redemption[] {
    const items = status && status !== 'all' ? redemptions.filter((r) => r.status === status) : redemptions;
    return items.map(localizeRedemption);
  },
  fulfill(id: string) {
    redemptions = redemptions.map((r) => (r.id === id ? { ...r, status: 'fulfilled' } : r));
  },
  campaigns: () => campaigns.map(localizeCampaign),
  saveCampaign(campaign: Campaign) {
    const index = campaigns.findIndex((c) => c.id === campaign.id);
    if (index >= 0) campaigns[index] = campaign;
    else campaigns.unshift(campaign);
  },
  rewards: () => rewards.map(localizeReward),
  saveReward(reward: Reward) {
    const index = rewards.findIndex((r) => r.id === reward.id);
    if (index >= 0) rewards[index] = reward;
    else rewards.unshift(reward);
  },
  machines: () => machines.map(localizeMachine),
  setBoxLevel(code: string, fillPercent: number) {
    const machine = machines.find((m) => m.code === code);
    if (machine) {
      machine.fillPercent = fillPercent;
      machine.status = fillPercent >= 100 ? 'full' : machine.status === 'maintenance' ? 'maintenance' : 'online';
    }
  },
  deposits: () => deposits.map(localizeDeposit),
  reconciliation(): Reconciliation {
    const pending = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountCents, 0);
    const paid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountCents, 0);
    const failed = payouts.filter((p) => p.status === 'failed').reduce((s, p) => s + p.amountCents, 0);
    const fee = payouts.reduce((s, p) => s + p.feeCents, 0);
    return {
      generatedAt: new Date().toISOString(),
      range: { from: daysAgo(30), to: new Date().toISOString() },
      counts: {
        requested: payouts.length,
        paid: payouts.filter((p) => p.status === 'paid').length,
        pending: payouts.filter((p) => p.status === 'pending').length,
        failed: payouts.filter((p) => p.status === 'failed').length,
      },
      requestedCents: pending + paid + failed,
      paidCents: paid,
      pendingCents: pending,
      failedCents: failed,
      refundedCents: failed,
      feeCents: fee,
      ledgerPayoutCents: paid + pending,
      varianceCents: Math.abs(paid + pending - (paid + pending)),
      balanced: true,
      liabilities: {
        pointsOutstanding: 214_800,
        creditOutstandingCents: 128_450,
        withdrawableOutstandingCents: 96_320,
        balanced: true,
      },
      providers: [{ provider: 'mock', count: payouts.length, amountCents: paid + pending + failed }],
    };
  },
};
