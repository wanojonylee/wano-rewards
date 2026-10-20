import type {
  AppNotification,
  Campaign,
  Config,
  Deposit,
  HomeData,
  Leaderboard,
  LeaderboardRow,
  LedgerEntry,
  Machine,
  Material,
  Pack,
  Paginated,
  Payment,
  Payout,
  Profile,
  Redemption,
  Referral,
  Reward,
  Session,
  Tier,
  User,
  Wallet,
} from '../types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const iso = (daysAgo = 0, hoursAgo = 0, minutesAgo = 0) =>
  new Date(Date.now() - daysAgo * DAY - hoursAgo * HOUR - minutesAgo * 60_000).toISOString();

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TIERS: Tier[] = [
  { code: 'seed', name: 'Seed', minPoints: 0, nextTier: 'Sprout', pointsToNext: 500, multiplier: 1, perks: ['Acesso ao catálogo de recompensas', 'Cashback em todas as embalagens'] },
  { code: 'sprout', name: 'Sprout', minPoints: 500, nextTier: 'Forest', pointsToNext: 140, multiplier: 1.05, perks: ['Multiplicador de 1,05× nos pontos', 'Sorteios mensais exclusivos'] },
  { code: 'forest', name: 'Forest', minPoints: 2000, nextTier: 'Guardian', pointsToNext: 3140, multiplier: 1.1, perks: ['Multiplicador de 1,1× nos pontos', 'Saque PIX sem taxa', 'Pré-venda de campanhas'] },
  { code: 'guardian', name: 'Guardian', minPoints: 5000, nextTier: null, pointsToNext: 0, multiplier: 1.2, perks: ['Multiplicador de 1,2× nos pontos', 'Recompensas exclusivas', 'Convite para o Conselho Verde'] },
];

const user: User = {
  id: 'usr_marina',
  name: 'Marina Costa',
  email: 'marina@example.com',
  phone: '+5511999990000',
  locale: 'zh-Hant',
  avatarColor: '#8C6F4E',
  memberSince: '2026-01-18T10:00:00.000Z',
  consent: { lgpdAt: '2026-01-18T10:02:00.000Z', marketingOptIn: true },
};

const machines: Machine[] = [
  { id: 'm1', code: 'RVM-SP-001', name: 'Aurora · Hall A', address: 'Rua dos Pinheiros, 120', distanceMeters: 40, status: 'online', materials: ['PET', 'ALUMINUM', 'GLASS', 'HDPE', 'PP', 'PS_HIPS'], fillPercent: 46, hours: '24h' },
  { id: 'm2', code: 'RVM-SP-002', name: 'Aurora · Torre B', address: 'Rua dos Pinheiros, 120', distanceMeters: 120, status: 'online', materials: ['PET', 'ALUMINUM', 'GLASS'], fillPercent: 71, hours: '24h' },
  { id: 'm3', code: 'RVM-SP-003', name: 'Padoca do Bairro', address: 'Rua Fradique Coutinho, 88', distanceMeters: 260, status: 'online', materials: ['PET', 'ALUMINUM'], fillPercent: 88, hours: '06–22h' },
  { id: 'm4', code: 'RVM-SP-004', name: 'Mercado Vila', address: 'Rua dos Pinheiros, 540', distanceMeters: 480, status: 'full', materials: ['PET', 'ALUMINUM', 'GLASS', 'HDPE'], fillPercent: 100, hours: '07–23h' },
  { id: 'm5', code: 'RVM-SP-005', name: 'Academia Forma', address: 'Rua Harmonia, 210', distanceMeters: 620, status: 'maintenance', materials: ['PET', 'ALUMINUM'], fillPercent: 32, hours: '06–23h' },
  { id: 'm6', code: 'RVM-SP-006', name: 'Praça das Corujas', address: 'Praça Amadeu Decome, 1', distanceMeters: 900, status: 'online', materials: ['PET', 'ALUMINUM', 'GLASS'], fillPercent: 18, hours: '24h' },
];

const campaigns: Campaign[] = [
  {
    id: 'cmp_oct',
    title: 'Outubro Circular',
    brand: 'RecIO',
    subtitle: '2× pontos em todas as garrafas PET',
    material: 'PET',
    multiplier: 2,
    bonusPoints: 0,
    startsAt: iso(12),
    endsAt: iso(-10),
    imageKey: 'bottle',
    accent: '#3E8E7E',
    progress: { current: 380, target: 1000, unit: 'kg' },
    joined: true,
  },
  {
    id: 'cmp_danone',
    title: 'Danone Circular',
    brand: 'Danone',
    subtitle: 'Garrafas Danone valem +50 pts no mês',
    material: 'MIXED',
    multiplier: 1,
    bonusPoints: 50,
    startsAt: iso(20),
    endsAt: iso(-6),
    imageKey: 'plant',
    accent: '#5B7F52',
    progress: { current: 12, target: 20, unit: 'garrafas' },
    joined: true,
  },
  {
    id: 'cmp_aurora',
    title: 'Desafio Aurora',
    brand: 'Edifício Aurora',
    subtitle: '900 kg em 30 dias para liberar o brinde coletivo',
    material: 'MIXED',
    multiplier: 1.5,
    bonusPoints: 0,
    startsAt: iso(9),
    endsAt: iso(-21),
    imageKey: 'bike',
    accent: '#A97C2F',
    progress: { current: 620, target: 900, unit: 'kg' },
    joined: true,
  },
  {
    id: 'cmp_alu',
    title: 'Alumínio Turbo',
    brand: 'RecIO',
    subtitle: '3× pontos em latas até domingo',
    material: 'ALUMINUM',
    multiplier: 3,
    bonusPoints: 0,
    startsAt: iso(2),
    endsAt: iso(-3),
    imageKey: 'streaming',
    accent: '#8C8F98',
    progress: null,
    joined: false,
  },
  {
    id: 'cmp_referral',
    title: 'Indique e Ganhe',
    brand: 'RecIO',
    subtitle: 'Amigo indicado = +100 pts para os dois',
    material: 'MIXED',
    multiplier: 1,
    bonusPoints: 100,
    startsAt: iso(30),
    endsAt: iso(-20),
    imageKey: 'market',
    accent: '#C05A32',
    progress: null,
    joined: true,
  },
  {
    id: 'cmp_glass',
    title: 'Semana Sem Desperdício',
    brand: 'Coca-Cola',
    subtitle: '2× pontos em vidro',
    material: 'GLASS',
    multiplier: 2,
    bonusPoints: 0,
    startsAt: iso(4),
    endsAt: iso(-2),
    imageKey: 'coffee',
    accent: '#4E7FA8',
    progress: null,
    joined: false,
  },
];

const rewards: Reward[] = [
  { id: 'rw_coffee', title: 'Café especial na Padoca', subtitle: 'Café coado + pão de queijo', category: 'voucher', partner: 'Padoca do Bairro', pointsCost: 350, valueCents: 1200, imageKey: 'coffee', stock: 48, stockLabel: null, isNew: false, highlight: true, terms: 'Válido por 30 dias em qualquer unidade da Padoca do Bairro. Não acumulativo com outras promoções.', expiresAt: iso(-25) },
  { id: 'rw_market', title: 'R$ 25 no Mercado Vila', subtitle: 'Crédito em compras acima de R$ 80', category: 'voucher', partner: 'Mercado Vila', pointsCost: 900, valueCents: 2500, imageKey: 'market', stock: 120, stockLabel: null, isNew: false, highlight: true, terms: 'Um voucher por CPF por mês. Válido em compras acima de R$ 80 no Mercado Vila.', expiresAt: iso(-40) },
  { id: 'rw_cinema', title: 'Cinema: 2 ingressos', subtitle: 'Sessões de segunda a quinta', category: 'experience', partner: 'Cine Arte', pointsCost: 1200, valueCents: 5000, imageKey: 'cinema', stock: 30, stockLabel: null, isNew: false, highlight: false, terms: 'Sujeito à disponibilidade. Válido de segunda a quinta, exceto feriados.', expiresAt: iso(-45) },
  { id: 'rw_transit', title: 'Recarga Bilhete Único', subtitle: 'R$ 20 no transporte público', category: 'voucher', partner: 'SPTrans', pointsCost: 700, valueCents: 2000, imageKey: 'transit', stock: 200, stockLabel: null, isNew: false, highlight: false, terms: 'Crédito enviado em até 48h para o Bilhete Único informado.', expiresAt: iso(-60) },
  { id: 'rw_gym', title: 'Day pass na Forma', subtitle: 'Um dia de academia liberado', category: 'experience', partner: 'Academia Forma', pointsCost: 1500, valueCents: 6000, imageKey: 'gym', stock: 20, stockLabel: null, isNew: false, highlight: false, terms: 'Apresente o código na recepção. Válido por 30 dias.', expiresAt: iso(-30) },
  { id: 'rw_donate', title: 'Doar para ONG Oceano', subtitle: '500 pontos viram R$ 5 para limpeza de praias', category: 'donation', partner: 'ONG Oceano Limpo', pointsCost: 500, valueCents: 500, imageKey: 'donation', stock: 999, stockLabel: null, isNew: false, highlight: true, terms: 'A doação é convertida em R$ 5,00 e repassada mensalmente à ONG.', expiresAt: null },
  { id: 'rw_bag', title: 'Ecobag RecIO', subtitle: 'Algodão orgânico, edição limitada', category: 'product', partner: 'RecIO', pointsCost: 650, valueCents: 3900, imageKey: 'bag', stock: 75, stockLabel: null, isNew: true, highlight: false, terms: 'Entrega em até 7 dias úteis no condomínio. Retire na portaria.', expiresAt: null },
  { id: 'rw_plant', title: 'Muda de árvore nativa', subtitle: 'Ipê-amarelo de viveiro certificado', category: 'product', partner: 'Viveiro Aurora', pointsCost: 300, valueCents: 1500, imageKey: 'plant', stock: 150, stockLabel: null, isNew: false, highlight: true, terms: 'Retirada no viveiro parceiro em Pinheiros. Acompanha guia de plantio.', expiresAt: null },
  { id: 'rw_museum', title: 'Museu da Língua Portuguesa', subtitle: 'Ingresso avulso', category: 'experience', partner: 'Museu da Língua', pointsCost: 800, valueCents: 2000, imageKey: 'ticket', stock: 40, stockLabel: null, isNew: false, highlight: false, terms: 'Válido por 60 dias, exceto terças-feiras de manutenção.', expiresAt: iso(-55) },
  { id: 'rw_icecream', title: 'Sorvete artesanal', subtitle: 'Dois sabores, 300 ml', category: 'voucher', partner: 'Sorveteria Nativa', pointsCost: 400, valueCents: 1400, imageKey: 'icecream', stock: 60, stockLabel: 'Só 6 restantes', isNew: true, highlight: false, terms: 'Uma porção por resgate. Válido na unidade de Pinheiros.', expiresAt: iso(-15) },
  { id: 'rw_book', title: 'R$ 15 na Livraria', subtitle: 'Livros, papelaria e café', category: 'voucher', partner: 'Livraria da Vila', pointsCost: 600, valueCents: 1500, imageKey: 'bookstore', stock: 80, stockLabel: null, isNew: false, highlight: false, terms: 'Não cumulativo com o cartão fidelidade da livraria.', expiresAt: iso(-35) },
  { id: 'rw_stream', title: '3 meses de streaming', subtitle: 'Plano padrão, sem anúncios', category: 'experience', partner: 'RecPlay', pointsCost: 2400, valueCents: 8970, imageKey: 'streaming', stock: 12, stockLabel: null, isNew: false, highlight: false, terms: 'Código de ativação enviado por e-mail. Requer cartão para cadastro.', expiresAt: iso(-70) },
  { id: 'rw_bike', title: 'Revisão de bike', subtitle: 'Ajuste completo + limpeza', category: 'experience', partner: 'Bike Coletivo', pointsCost: 1800, valueCents: 9000, imageKey: 'bike', stock: 8, stockLabel: 'Só 3 restantes', isNew: true, highlight: false, terms: 'Agendamento pelo parceiro. Não inclui peças de reposição.', expiresAt: iso(-50) },
  { id: 'rw_food', title: 'Doar 1 kg de ração', subtitle: 'Para abrigos parceiros da região', category: 'donation', partner: 'Instituto Pata Amiga', pointsCost: 700, valueCents: 700, imageKey: 'donation', stock: 500, stockLabel: null, isNew: false, highlight: false, terms: 'A ração é comprada e doada mensalmente aos abrigos cadastrados.', expiresAt: null },
];

const campaignById = (id: string) => campaigns.find((c) => c.id === id) ?? campaigns[0];
const rewardById = (id: string) => rewards.find((r) => r.id === id) ?? rewards[0];

const packs: Pack[] = [
  { id: 'pack-20', creditCents: 2000, bonusPoints: 50, priceCents: 2000, currency: 'BRL', label: 'R$ 20', badge: null },
  { id: 'pack-50', creditCents: 5000, bonusPoints: 150, priceCents: 5000, currency: 'BRL', label: 'R$ 50', badge: 'Mais popular' },
  { id: 'pack-100', creditCents: 10000, bonusPoints: 400, priceCents: 10000, currency: 'BRL', label: 'R$ 100', badge: 'Melhor valor' },
];

const basePoints: Record<Material, number> = { PET: 10, ALUMINUM: 15, GLASS: 6, HDPE: 12, PP: 8, PS_HIPS: 6 };
const baseCashback: Record<Material, number> = { PET: 5, ALUMINUM: 8, GLASS: 3, HDPE: 6, PP: 4, PS_HIPS: 3 };
const materialNames: Record<Material, string> = { PET: 'Garrafa PET', ALUMINUM: 'Lata de alumínio', GLASS: 'Vidro', HDPE: 'Embalagem HDPE', PP: 'Pote PP', PS_HIPS: 'Bandeja PS' };
const materialWeights: Record<Material, number> = { PET: 28, ALUMINUM: 15, GLASS: 190, HDPE: 32, PP: 24, PS_HIPS: 18 };

let wallet: Wallet = { points: 1860, creditCents: 4270, withdrawableCents: 3170, expiring: { points: 260, at: iso(-52) } };

const ledgerSeed: Array<Omit<LedgerEntry, 'id' | 'balanceAfterPoints' | 'balanceAfterCreditCents'>> = [
  { type: 'earn', pointsDelta: 120, creditDeltaCents: 64, description: 'Reciclagem · 12 embalagens', refType: 'session', refId: 'ses_1042', createdAt: iso(0, 2) },
  { type: 'bonus', pointsDelta: 50, creditDeltaCents: 0, description: 'Bônus campanha Danone Circular', refType: 'campaign', refId: 'cmp_danone', createdAt: iso(1, 3) },
  { type: 'redeem', pointsDelta: -350, creditDeltaCents: 0, description: 'Café especial na Padoca', refType: 'reward', refId: 'rw_coffee', createdAt: iso(3, 1) },
  { type: 'earn', pointsDelta: 86, creditDeltaCents: 41, description: 'Reciclagem · 9 embalagens', refType: 'session', refId: 'ses_1038', createdAt: iso(4, 4) },
  { type: 'topup', pointsDelta: 50, creditDeltaCents: 2500, description: 'Crédito adicionado · pack R$ 25', refType: 'payment', refId: 'pay_778', createdAt: iso(5, 2) },
  { type: 'payout', pointsDelta: 0, creditDeltaCents: -3000, description: 'Saque PIX · R$ 30,00', refType: 'payout', refId: 'po_311', createdAt: iso(6, 5) },
  { type: 'earn', pointsDelta: 134, creditDeltaCents: 71, description: 'Reciclagem · 14 embalagens', refType: 'session', refId: 'ses_1031', createdAt: iso(7, 1) },
  { type: 'referral', pointsDelta: 100, creditDeltaCents: 0, description: 'Amigo indicado: Bruno Salles', refType: 'referral', refId: 'ref_877', createdAt: iso(9, 6) },
  { type: 'mini_market', pointsDelta: 0, creditDeltaCents: -1290, description: 'Mini-mercado Aurora', refType: 'payment', refId: 'mm_204', createdAt: iso(11, 3) },
  { type: 'earn', pointsDelta: 72, creditDeltaCents: 38, description: 'Reciclagem · 7 embalagens', refType: 'session', refId: 'ses_1024', createdAt: iso(12, 2) },
  { type: 'expire', pointsDelta: -20, creditDeltaCents: 0, description: 'Pontos expirados', refType: null, refId: null, createdAt: iso(20) },
  { type: 'earn', pointsDelta: 210, creditDeltaCents: 112, description: 'Reciclagem · 22 embalagens', refType: 'session', refId: 'ses_1018', createdAt: iso(25) },
];

let ledger: LedgerEntry[] = [];
{
  let points = wallet.points;
  let credit = wallet.creditCents;
  ledger = ledgerSeed.map((e) => {
    const row: LedgerEntry = {
      ...e,
      id: 'le_' + (ledger.length + 1),
      balanceAfterPoints: points,
      balanceAfterCreditCents: credit,
    };
    points -= e.pointsDelta;
    credit -= e.creditDeltaCents;
    return row;
  });
}

const redemptionsSeed: Redemption[] = [
  {
    id: 'rd_701',
    code: 'K7QM-2XPA',
    qrPayload: 'recio://redeem/K7QM-2XPA',
    status: 'active',
    expiresAt: iso(-20),
    reward: rewardById('rw_coffee'),
    pointsSpent: 350,
    createdAt: iso(3, 1),
  },
  {
    id: 'rd_688',
    code: 'B4ND-9TRE',
    qrPayload: 'recio://redeem/B4ND-9TRE',
    status: 'active',
    expiresAt: iso(-12),
    reward: rewardById('rw_icecream'),
    pointsSpent: 400,
    createdAt: iso(8),
  },
  {
    id: 'rd_610',
    code: 'L2WK-7HSP',
    qrPayload: 'recio://redeem/L2WK-7HSP',
    status: 'used',
    expiresAt: iso(10),
    reward: rewardById('rw_market'),
    pointsSpent: 900,
    createdAt: iso(20),
  },
];
let redemptions = [...redemptionsSeed];

const notifications: AppNotification[] = [
  { id: 'ntf_1', title: 'Você subiu para o nível Sprout', body: 'Agora seus pontos rendem 1,05× e você entra nos sorteios mensais.', kind: 'reward', read: false, createdAt: iso(0, 2), deepLink: '/profile' },
  { id: 'ntf_2', title: 'Outubro Circular: 2× pontos em PET', body: 'Faltam 10 dias. Deposite garrafas PET e dobre seus pontos.', kind: 'campaign', read: false, createdAt: iso(0, 5), deepLink: '/campaign/cmp_oct' },
  { id: 'ntf_3', title: 'Máquina Aurora · Hall A está 88% cheia', body: 'A coleta está agendada para amanhã às 9h.', kind: 'machine', read: true, createdAt: iso(1, 4), deepLink: '/machines' },
  { id: 'ntf_4', title: 'Resgate confirmado: Café na Padoca', body: 'Seu código K7QM-2XPA está ativo por 30 dias.', kind: 'reward', read: true, createdAt: iso(3, 1), deepLink: '/orders' },
  { id: 'ntf_5', title: 'Saque PIX de R$ 30,00 enviado', body: 'O comprovante está disponível no seu extrato.', kind: 'payout', read: true, createdAt: iso(6, 5), deepLink: '/wallet' },
  { id: 'ntf_6', title: 'Novo desafio no Aurora: 900 kg', body: 'Participe do Desafio Aurora e concorra ao brinde coletivo.', kind: 'campaign', read: true, createdAt: iso(9), deepLink: '/campaign/cmp_aurora' },
];
let notificationState = [...notifications];

const leaderboardPeers: Array<{ name: string; value: number; color: string }> = [
  { name: 'Bruno Salles', value: 42.1, color: '#6E7F5C' },
  { name: 'Helena Prado', value: 38.6, color: '#8C6F4E' },
  { name: 'Rafael Lima', value: 28.9, color: '#5C6E7F' },
  { name: 'Camila Duarte', value: 24.3, color: '#7F5C6E' },
  { name: 'Diego Nunes', value: 21.7, color: '#6E5C7F' },
  { name: 'Ana Beatriz', value: 19.2, color: '#7F7A5C' },
  { name: 'Lucas Meyer', value: 16.4, color: '#5C7F73' },
  { name: 'Sofia Rocha', value: 12.8, color: '#7F645C' },
];

function buildLeaderboard(scope: 'condo' | 'building' | 'city', campaignId?: string): Leaderboard {
  const meValue = campaignId ? 9.4 : scope === 'building' ? 31.4 : 31.4;
  const rows: LeaderboardRow[] = [
    { ...leaderboardPeers[0], position: 1, displayName: leaderboardPeers[0].name, avatarColor: leaderboardPeers[0].color, unit: 'kg', isMe: false, value: leaderboardPeers[0].value },
    { ...leaderboardPeers[1], position: 2, displayName: leaderboardPeers[1].name, avatarColor: leaderboardPeers[1].color, unit: 'kg', isMe: false, value: leaderboardPeers[1].value },
    { position: 3, displayName: 'Marina Costa', avatarColor: '#8C6F4E', value: meValue, unit: 'kg', isMe: true },
    ...leaderboardPeers.slice(2).map((peer, index) => ({
      position: index + 4,
      displayName: peer.name,
      avatarColor: peer.color,
      value: peer.value,
      unit: 'kg',
      isMe: false,
    })),
  ];
  return { scope, period: '2026-10', rows, me: rows.find((r) => r.isMe) ?? null };
}

const homeLeaderboard = buildLeaderboard('condo');

const impact = {
  months: [
    { label: 'Mai', kg: 14 },
    { label: 'Jun', kg: 19 },
    { label: 'Jul', kg: 16 },
    { label: 'Ago', kg: 24 },
    { label: 'Set', kg: 28 },
    { label: 'Out', kg: 31 },
  ],
  materials: [
    { material: 'PET' as Material, kg: 58.2 },
    { material: 'ALUMINUM' as Material, kg: 31.4 },
    { material: 'GLASS' as Material, kg: 18.6 },
    { material: 'HDPE' as Material, kg: 12.3 },
    { material: 'PP' as Material, kg: 5.1 },
    { material: 'PS_HIPS' as Material, kg: 2.8 },
  ],
};

const impactData = {
  months: impact.months,
  materials: impact.materials,
  totals: { kg: 128.4, co2Kg: 63.2, items: 512, sessions: 43 },
  badges: [
    { id: 'first', title: 'Primeira embalagem', description: 'Seu primeiro depósito aprovado.', unlocked: true, progress: null },
    { id: 'streak4', title: '4 semanas seguidas', description: 'Recicle pelo menos uma vez por semana.', unlocked: true, progress: null },
    { id: 'kg50', title: '50 kg de impacto', description: 'Meia tonelada de CO₂ evitada em grupo.', unlocked: true, progress: null },
    { id: 'referral3', title: 'Embaixador verde', description: 'Convide 3 amigos que reciclem.', unlocked: true, progress: null },
    { id: 'month30', title: 'Mês de 30 kg', description: 'Recicle 30 kg em um único mês.', unlocked: true, progress: null },
    { id: 'guardian', title: 'Guardião', description: 'Alcance o nível Guardian com 5.000 pontos.', unlocked: false, progress: { current: 1860, target: 5000 } },
  ],
};


let session: Session | null = null;

const depositSkus: Array<{ material: Material; sku: string }> = [
  { material: 'PET', sku: 'Água Crystal 500 ml' },
  { material: 'PET', sku: 'Coca-Cola 2 L' },
  { material: 'PET', sku: 'Guaraná Antarctica 1 L' },
  { material: 'ALUMINUM', sku: 'Lata Coke Zero 350 ml' },
  { material: 'ALUMINUM', sku: 'Lata Heineken 350 ml' },
  { material: 'GLASS', sku: 'Garrafa Stella 330 ml' },
  { material: 'HDPE', sku: 'Detergente Ypê 500 ml' },
  { material: 'PP', sku: 'Pote de margarina 500 g' },
  { material: 'PS_HIPS', sku: 'Bandeja de bandeja Danone' },
];

const config: Config = {
  currency: 'BRL',
  locale: 'zh-Hant',
  locales: ['zh-Hant', 'en'],
  pointsPerKg: { PET: 357, ALUMINUM: 1000, GLASS: 32, HDPE: 375, PP: 333, PS_HIPS: 333 },
  materials: ['PET', 'ALUMINUM', 'GLASS', 'HDPE', 'PP', 'PS_HIPS'],
  legal: { privacyUrl: 'https://recio.app/privacy', termsUrl: 'https://recio.app/terms', supportEmail: 'ajuda@recio.app' },
  supportEmail: 'ajuda@recio.app',
  version: '1.0.0',
};

const referral: Referral = {
  code: 'MARINA10',
  link: 'https://recio.app/i/MARINA10',
  invited: 4,
  earnedPoints: 400,
  rewardPerFriend: 100,
  rules: ['Compartilhe seu código ou link.', 'Seu amigo cria a conta e faz a primeira reciclagem.', 'Os pontos entram na hora para os dois.'],
};

const monthlyGoal = { current: 13, target: 20 };

const tierFor = (points: number): Tier => {
  let current = TIERS[0];
  for (const tier of TIERS) if (points >= tier.minPoints) current = tier;
  return current;
};

const profile = (): Profile => {
  const tier = tierFor(wallet.points);
  const index = TIERS.findIndex((x) => x.code === tier.code);
  const next = TIERS[index + 1];
  return {
    user,
    wallet,
    tier: {
      ...tier,
      nextTier: next?.name ?? null,
      pointsToNext: next ? Math.max(0, next.minPoints - wallet.points) : 0,
    },
    stats: { kgTotal: 128.4, itemsTotal: 512, co2SavedKg: 63.2, sessionsTotal: 43, currentStreakWeeks: 6 },
    rank: { condo: { position: 3, total: 42, percentile: 7 }, building: { position: 2, total: 12 } },
  };
};

const home = (): HomeData => {
  const p = profile();
  return {
    wallet,
    tier: p.tier,
    stats: p.stats,
    rank: p.rank,
    campaigns: campaigns.filter((c) => c.joined || c.imageKey === 'streaming').slice(0, 3),
    recent: ledger.slice(0, 4),
    nearbyMachine: machines[0],
    weeklyGoal: monthlyGoal,
    greetingName: user.name.split(' ')[0],
  };
};

function pushLedger(entry: Omit<LedgerEntry, 'id' | 'balanceAfterPoints' | 'balanceAfterCreditCents'>) {
  wallet = { ...wallet, points: wallet.points + entry.pointsDelta, creditCents: wallet.creditCents + entry.creditDeltaCents };
  const row: LedgerEntry = {
    ...entry,
    id: 'le_' + (ledger.length + 1),
    balanceAfterPoints: wallet.points,
    balanceAfterCreditCents: wallet.creditCents,
  };
  ledger = [row, ...ledger];
  return row;
}

function simulateDeposit(sessionId: string, material?: Material): { deposit: Deposit; session: Session } {
  if (!session || session.id !== sessionId) throw new Error('SESSION_NOT_ACTIVE');
  if (session.deposits.length >= 40) throw new Error('SESSION_LIMIT');
  const pick = material
    ? depositSkus.find((d) => d.material === material) ?? depositSkus[0]
    : depositSkus[Math.floor(Math.random() * depositSkus.length)];
  const campaign = campaigns.find((c) => c.joined && (c.material === pick.material || c.material === 'MIXED'));
  const multiplier = (campaign?.multiplier ?? 1) * 1.05;
  const points = Math.round(basePoints[pick.material] * multiplier) + (campaign?.bonusPoints ?? 0) / 4;
  const deposit: Deposit = {
    id: uuid(),
    material: pick.material,
    skuName: pick.sku,
    weightGrams: materialWeights[pick.material],
    points: Math.round(points),
    cashbackCents: baseCashback[pick.material],
    accepted: true,
    rejectReason: null,
    createdAt: new Date().toISOString(),
  };
  const deposits = [deposit, ...session.deposits];
  const totals = {
    items: deposits.length,
    weightGrams: deposits.reduce((sum, d) => sum + d.weightGrams, 0),
    points: deposits.reduce((sum, d) => sum + d.points, 0),
    cashbackCents: deposits.reduce((sum, d) => sum + d.cashbackCents, 0),
    co2Grams: Math.round(deposits.reduce((sum, d) => sum + d.weightGrams * 1.6, 0)),
  };
  session = { ...session, deposits, totals };
  return { deposit, session };
}

function completeSession(sessionId: string): Session {
  if (!session || session.id !== sessionId) throw new Error('SESSION_NOT_ACTIVE');
  const completed: Session = {
    ...session,
    status: 'completed',
    receipt: {
      items: session.totals.items,
      points: session.totals.points,
      cashbackCents: session.totals.cashbackCents,
      co2Grams: session.totals.co2Grams,
      completedAt: new Date().toISOString(),
    },
  };
  if (session.totals.items > 0) {
    pushLedger({
      type: 'earn',
      pointsDelta: session.totals.points,
      creditDeltaCents: session.totals.cashbackCents,
      description: `Reciclagem · ${session.totals.items} embalagens`,
      refType: 'session',
      refId: session.id,
      createdAt: new Date().toISOString(),
    });
    monthlyGoal.current = Math.min(monthlyGoal.target, monthlyGoal.current + session.totals.items);
  }
  session = completed;
  return completed;
}

function route(method: string, path: string, body: any): any {
  const [pathname, queryString = ''] = path.split('?');
  const query = new URLSearchParams(queryString);
  const segments = pathname.split('/').filter(Boolean);

  if (method === 'GET' && pathname === '/config') return config;
  if (method === 'GET' && pathname === '/impact') return impactData;
  if (method === 'GET' && pathname === '/home') return home();
  if (method === 'GET' && pathname === '/me') return profile();
  if (method === 'PATCH' && pathname === '/me') {
    Object.assign(user, body);
    return profile();
  }
  if (method === 'POST' && pathname === '/me/consent') {
    user.consent = {
      lgpdAt: body.lgpd ? new Date().toISOString() : user.consent.lgpdAt,
      marketingOptIn: !!body.marketing,
    };
    return { consent: user.consent };
  }
  if (method === 'GET' && pathname === '/me/export') return { jobId: uuid() };
  if (method === 'DELETE' && pathname === '/me') return { scheduledFor: iso(-30) };

  if (method === 'GET' && pathname === '/wallet') return wallet;
  if (method === 'GET' && pathname === '/wallet/entries') {
    const type = query.get('type');
    const filtered = type ? ledger.filter((e) => e.type === type) : ledger;
    return { items: filtered, nextCursor: null } satisfies Paginated<LedgerEntry>;
  }
  if (method === 'GET' && pathname === '/payments/packs') return { items: packs };

  if (method === 'POST' && pathname === '/auth/request-otp') return { sent: true, devCode: '123456', expiresIn: 300 };
  if (method === 'POST' && pathname === '/auth/verify') {
    if (body.code !== '123456') throw new Error('INVALID_CODE');
    return { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token', isNewUser: false, user };
  }
  if (method === 'POST' && pathname === '/auth/logout') return {};
  if (method === 'POST' && pathname === '/auth/refresh') return { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' };

  if (method === 'GET' && pathname === '/rewards') {
    const category = query.get('category');
    const search = (query.get('search') ?? '').toLowerCase();
    let items = rewards;
    if (category && category !== 'all') items = items.filter((r) => r.category === category);
    if (search) items = items.filter((r) => (r.title + r.partner).toLowerCase().includes(search));
    return { items, nextCursor: null } satisfies Paginated<Reward>;
  }
  if (method === 'GET' && segments[0] === 'rewards' && segments[1]) {
    const reward = rewardById(segments[1]);
    const related = rewards.filter((r) => r.category === reward.category && r.id !== reward.id).slice(0, 3);
    return { reward, related };
  }
  if (method === 'POST' && segments[0] === 'rewards' && segments[2] === 'redeem') {
    const reward = rewardById(segments[1]);
    if (wallet.points < reward.pointsCost) throw new Error('INSUFFICIENT_POINTS');
    if (reward.stock <= 0) throw new Error('OUT_OF_STOCK');
    const code = `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const redemption: Redemption = {
      id: uuid(),
      code,
      qrPayload: `recio://redeem/${code}`,
      status: 'active',
      expiresAt: iso(-30),
      reward,
      pointsSpent: reward.pointsCost,
      createdAt: new Date().toISOString(),
    };
    reward.stock -= 1;
    redemptions = [redemption, ...redemptions];
    pushLedger({
      type: 'redeem',
      pointsDelta: -reward.pointsCost,
      creditDeltaCents: 0,
      description: reward.title,
      refType: 'reward',
      refId: reward.id,
      createdAt: new Date().toISOString(),
    });
    notificationState = [
      {
        id: uuid(),
        title: 'Resgate confirmado',
        body: `${reward.title} · código ${code}`,
        kind: 'reward',
        read: false,
        createdAt: new Date().toISOString(),
        deepLink: '/orders',
      },
      ...notificationState,
    ];
    return { redemption, wallet };
  }

  if (method === 'GET' && pathname === '/redemptions') {
    const status = query.get('status');
    const items = status ? redemptions.filter((r) => r.status === status) : redemptions;
    return { items, nextCursor: null } satisfies Paginated<Redemption>;
  }
  if (method === 'POST' && segments[0] === 'redemptions' && segments[2] === 'mark-used') {
    redemptions = redemptions.map((r) => (r.id === segments[1] ? { ...r, status: 'used' as const } : r));
    return { redemption: redemptions.find((r) => r.id === segments[1]) };
  }

  if (method === 'GET' && pathname === '/campaigns') return { items: campaigns };
  if (method === 'GET' && segments[0] === 'campaigns' && segments[1]) {
    const campaign = campaignById(segments[1]);
    return { campaign, leaderboard: buildLeaderboard('condo', campaign.id).rows, userPosition: 3 };
  }
  if (method === 'GET' && pathname === '/leaderboard') {
    const scope = (query.get('scope') ?? 'condo') as 'condo' | 'building' | 'city';
    const campaignId = query.get('campaignId') ?? undefined;
    return buildLeaderboard(scope, campaignId);
  }

  if (method === 'GET' && pathname === '/notifications') {
    return { items: notificationState, unread: notificationState.filter((n) => !n.read).length };
  }
  if (method === 'POST' && pathname === '/notifications/read-all') {
    notificationState = notificationState.map((n) => ({ ...n, read: true }));
    return { ok: true };
  }
  if (method === 'POST' && segments[0] === 'notifications' && segments[2] === 'read') {
    notificationState = notificationState.map((n) => (n.id === segments[1] ? { ...n, read: true } : n));
    return { ok: true };
  }

  if (method === 'GET' && pathname === '/machines') return { items: machines };
  if (method === 'GET' && pathname === '/referral') return referral;
  if (method === 'POST' && pathname === '/referral/apply') {
    if (body.code) pushLedger({ type: 'referral', pointsDelta: 100, creditDeltaCents: 0, description: 'Código de indicação aplicado', refType: 'referral', refId: uuid(), createdAt: new Date().toISOString() });
    return { applied: true, bonusPoints: 100 };
  }

  if (method === 'POST' && pathname === '/sessions/start') {
    if (session?.status === 'active') throw new Error('SESSION_ALREADY_ACTIVE');
    const machine = machines.find((m) => m.code === body.machineCode) ?? machines[0];
    session = {
      id: uuid(),
      status: 'active',
      machine,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      deposits: [],
      totals: { items: 0, weightGrams: 0, points: 0, cashbackCents: 0, co2Grams: 0 },
      receipt: null,
    };
    return { session, pollAfterMs: 1500 };
  }
  if (segments[0] === 'sessions' && segments[1]) {
    if (method === 'GET') return { session };
    if (method === 'POST' && segments[2] === 'simulate-deposit') return simulateDeposit(segments[1], body?.material);
    if (method === 'POST' && segments[2] === 'complete') return { session: completeSession(segments[1]) };
  }

  if (method === 'POST' && pathname === '/payments/checkout') {
    const pack = packs.find((p) => p.id === body.packId) ?? packs[0];
    const payment: Payment = {
      id: uuid(),
      status: 'requires_payment',
      provider: 'mock',
      checkoutUrl: `mock://checkout/${pack.id}`,
      amountCents: pack.priceCents,
      creditCents: pack.creditCents,
      bonusPoints: pack.bonusPoints,
      createdAt: new Date().toISOString(),
    };
    return { payment, wallet };
  }
  if (method === 'POST' && segments[0] === 'payments' && segments[2] === 'mock-complete') {
    const amountCents = Number(body?.amountCents ?? 2000);
    const bonusPoints = Number(body?.bonusPoints ?? 50);
    pushLedger({
      type: 'topup',
      pointsDelta: bonusPoints,
      creditDeltaCents: amountCents,
      description: `Crédito adicionado · R$ ${(amountCents / 100).toFixed(0)}`,
      refType: 'payment',
      refId: segments[1],
      createdAt: new Date().toISOString(),
    });
    return { payment: { id: segments[1], status: 'paid', provider: 'mock', checkoutUrl: null, amountCents, creditCents: amountCents, bonusPoints, createdAt: new Date().toISOString() }, wallet };
  }
  if (method === 'POST' && pathname === '/payouts') {
    const amount = Number(body?.amountCents ?? 0);
    if (amount < 2000) throw new Error('BELOW_MINIMUM');
    if (amount > wallet.withdrawableCents) throw new Error('INSUFFICIENT_WITHDRAWABLE');
    wallet = { ...wallet, creditCents: wallet.creditCents - amount, withdrawableCents: wallet.withdrawableCents - amount };
    const payout: Payout = {
      id: uuid(),
      status: 'pending',
      amountCents: amount,
      feeCents: 0,
      netCents: amount,
      pixKeyMasked: body?.pixKey ? String(body.pixKey).replace(/(.{2}).+(@.*)?/, '$1***$2') : 'ma***@example.com',
      estimatedAt: iso(-1),
      createdAt: new Date().toISOString(),
    };
    pushLedger({ type: 'payout', pointsDelta: 0, creditDeltaCents: -amount, description: `Saque PIX · R$ ${(amount / 100).toFixed(2).replace('.', ',')}`, refType: 'payout', refId: payout.id, createdAt: new Date().toISOString() });
    return { payout };
  }
  if (method === 'GET' && pathname === '/payouts') return { items: [] };
  if (method === 'POST' && pathname === '/payments/mini-market') {
    const amount = Number(body?.amountCents ?? 0);
    if (amount > wallet.creditCents) throw new Error('INSUFFICIENT_CREDIT');
    wallet = { ...wallet, creditCents: wallet.creditCents - amount };
    pushLedger({ type: 'mini_market', pointsDelta: 0, creditDeltaCents: -amount, description: 'Mini-mercado Aurora', refType: 'payment', refId: uuid(), createdAt: new Date().toISOString() });
    return { payment: { id: uuid(), status: 'paid', code: String(Math.floor(100000 + Math.random() * 900000)) }, wallet };
  }

  throw new Error('MOCK_NOT_FOUND: ' + method + ' ' + pathname);
}

export async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  await sleep(180 + Math.random() * 220);
  try {
    return route(method, path, body) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MOCK_ERROR';
    throw Object.assign(new Error(message), { code: message });
  }
}

export const mockImpact = impact;
export const mockMachines = machines;
export const mockCampaigns = campaigns;
export const mockMaterials = materialNames;
