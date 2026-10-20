import type { Locale } from '../types';

/**
 * Content localization layer.
 *
 * The API (and the demo mock) return Portuguese copy for seeded domain content:
 * campaigns, rewards, machines, notifications, impact badges, ledger descriptions,
 * tier names and month labels. Translating only UI chrome would produce a mixed
 * language screen, so every API payload is passed through `localizeDeep()` before
 * React Query caches it. The function clones the tree, so mock state is never
 * mutated and a locale switch can always re-translate from the Portuguese source.
 *
 * Proper nouns (people, brands such as WANO/Danone/Coca-Cola/Padoca do Bairro,
 * addresses, machine codes, PIX keys, redemption codes) are intentionally left
 * untouched.
 */

type Translation = { 'zh-Hant': string; en: string };

const EXACT: Record<string, Translation> = {
  /* ------------------------------------------------------------ months */
  Jan: { 'zh-Hant': '1月', en: 'Jan' },
  Fev: { 'zh-Hant': '2月', en: 'Feb' },
  Mar: { 'zh-Hant': '3月', en: 'Mar' },
  Abr: { 'zh-Hant': '4月', en: 'Apr' },
  Mai: { 'zh-Hant': '5月', en: 'May' },
  Jun: { 'zh-Hant': '6月', en: 'Jun' },
  Jul: { 'zh-Hant': '7月', en: 'Jul' },
  Ago: { 'zh-Hant': '8月', en: 'Aug' },
  Set: { 'zh-Hant': '9月', en: 'Sep' },
  Out: { 'zh-Hant': '10月', en: 'Oct' },
  Nov: { 'zh-Hant': '11月', en: 'Nov' },
  Dez: { 'zh-Hant': '12月', en: 'Dec' },

  /* ------------------------------------------------------- tier names */
  Semente: { 'zh-Hant': '種子', en: 'Seed' },
  Broto: { 'zh-Hant': '新芽', en: 'Sprout' },
  Floresta: { 'zh-Hant': '森林', en: 'Forest' },
  Guardião: { 'zh-Hant': '守護者', en: 'Guardian' },
  Seed: { 'zh-Hant': '種子', en: 'Seed' },
  Sprout: { 'zh-Hant': '新芽', en: 'Sprout' },
  Forest: { 'zh-Hant': '森林', en: 'Forest' },
  Guardian: { 'zh-Hant': '守護者', en: 'Guardian' },

  /* ---------------------------------------------------------- tier perks */
  'Cashback padrão': { 'zh-Hant': '標準回饋金', en: 'Standard cashback' },
  'Acesso a todas as máquinas': { 'zh-Hant': '可使用所有機器', en: 'Access to all machines' },
  '+5% de pontos em cada reciclagem': { 'zh-Hant': '每次回收點數 +5%', en: '+5% points on every recycle' },
  'Sorteios mensais': { 'zh-Hant': '每月抽獎', en: 'Monthly giveaways' },
  '+10% de pontos em cada reciclagem': { 'zh-Hant': '每次回收點數 +10%', en: '+10% points on every recycle' },
  'Recompensas exclusivas': { 'zh-Hant': '專屬獎勵', en: 'Exclusive rewards' },
  'Prioridade em campanhas': { 'zh-Hant': '活動優先參與', en: 'Priority in campaigns' },
  '+20% de pontos em cada reciclagem': { 'zh-Hant': '每次回收點數 +20%', en: '+20% points on every recycle' },
  'Convites para eventos RecIO': { 'zh-Hant': 'RecIO 活動邀請', en: 'Invitations to RecIO events' },
  'Suporte prioritário': { 'zh-Hant': '優先客服', en: 'Priority support' },
  'Acesso ao catálogo de recompensas': { 'zh-Hant': '可使用獎勵目錄', en: 'Access to the rewards catalogue' },
  'Cashback em todas as embalagens': { 'zh-Hant': '所有包裝皆有回饋金', en: 'Cashback on every package' },
  'Multiplicador de 1,05× nos pontos': { 'zh-Hant': '點數 1.05× 加成', en: '1.05× points multiplier' },
  'Sorteios mensais exclusivos': { 'zh-Hant': '每月專屬抽獎', en: 'Exclusive monthly giveaways' },
  'Multiplicador de 1,1× nos pontos': { 'zh-Hant': '點數 1.1× 加成', en: '1.1× points multiplier' },
  'Saque PIX sem taxa': { 'zh-Hant': 'PIX 提領免手續費', en: 'Free PIX withdrawal' },
  'Pré-venda de campanhas': { 'zh-Hant': '活動優先預購', en: 'Early access to campaigns' },
  'Multiplicador de 1,2× nos pontos': { 'zh-Hant': '點數 1.2× 加成', en: '1.2× points multiplier' },
  'Convite para o Conselho Verde': { 'zh-Hant': '綠色議會邀請', en: 'Invitation to the Green Council' },

  /* ------------------------------------------------------------ default names */
  Reciclador: { 'zh-Hant': '回收者', en: 'Recycler' },
  'Reciclador RecIO': { 'zh-Hant': 'RecIO 回收者', en: 'RecIO Recycler' },
  'Você': { 'zh-Hant': '你', en: 'You' },

  /* -------------------------------------------------------------- campaigns */
  'Outubro Circular': { 'zh-Hant': '十月循環', en: 'Circular October' },
  '2x pontos em todas as garrafas PET': { 'zh-Hant': '所有 PET 瓶點數 2 倍', en: '2× points on all PET bottles' },
  '2× pontos em todas as garrafas PET': { 'zh-Hant': '所有 PET 瓶點數 2 倍', en: '2× points on all PET bottles' },
  'Danone Circular': { 'zh-Hant': 'Danone 循環', en: 'Danone Circular' },
  '+50 pts em embalagens Danone': { 'zh-Hant': 'Danone 包裝 +50 點', en: '+50 pts on Danone packaging' },
  'Garrafas Danone valem +50 pts no mês': { 'zh-Hant': 'Danone 瓶本月多 +50 點', en: 'Danone bottles worth +50 pts this month' },
  'Desafio Aurora': { 'zh-Hant': 'Aurora 挑戰', en: 'Aurora Challenge' },
  'Seu condomínio rumo a 1.200 kg': { 'zh-Hant': '你的社區邁向 1,200 公斤', en: 'Your building on the way to 1,200 kg' },
  '900 kg em 30 dias para liberar o brinde coletivo': { 'zh-Hant': '30 天內回收 900 公斤，解鎖社區禮物', en: '900 kg in 30 days to unlock the group gift' },
  'Alumínio Turbo': { 'zh-Hant': '鋁罐加速', en: 'Aluminium Turbo' },
  '2x pontos em latas de alumínio': { 'zh-Hant': '鋁罐點數 2 倍', en: '2× points on aluminium cans' },
  '3× pontos em latas até domingo': { 'zh-Hant': '鋁罐點數 3 倍，直到週日', en: '3× points on cans until Sunday' },
  'Indique e Ganhe': { 'zh-Hant': '推薦有禮', en: 'Refer and Earn' },
  'Convide amigos e dobre o bônus': { 'zh-Hant': '邀請好友，獎勵加倍', en: 'Invite friends and double the bonus' },
  'Amigo indicado = +100 pts para os dois': { 'zh-Hant': '好友註冊 = 雙方各 +100 點', en: 'Referred friend = +100 pts for both' },
  'Semana Sem Desperdício': { 'zh-Hant': '零浪費週', en: 'Zero Waste Week' },
  '1,5x pontos em vidro': { 'zh-Hant': '玻璃點數 1.5 倍', en: '1.5× points on glass' },
  '2× pontos em vidro': { 'zh-Hant': '玻璃點數 2 倍', en: '2× points on glass' },

  /* -------------------------------------------------------- campaign units / period */
  items: { 'zh-Hant': '件', en: 'items' },
  referrals: { 'zh-Hant': '推薦', en: 'referrals' },
  garrafas: { 'zh-Hant': '瓶', en: 'bottles' },
  'Este mês': { 'zh-Hant': '本月', en: 'This month' },
  'Últimos 30 dias': { 'zh-Hant': '最近 30 天', en: 'Last 30 days' },

  /* ------------------------------------------- rewards (API seed: rwd_*) */
  'Café especial na Padoca': { 'zh-Hant': 'Padoca 精品咖啡', en: 'Specialty coffee at Padoca' },
  'Café coado + pão de queijo': { 'zh-Hant': '手沖咖啡 + 起司麵包', en: 'Drip coffee + cheese bread' },
  'Válido de segunda a sexta, das 7h às 17h. Um café por resgate.': {
    'zh-Hant': '週一至週五 7:00–17:00 適用，每次兌換一杯咖啡。',
    en: 'Valid Monday to Friday, 7am–5pm. One coffee per redemption.',
  },
  'R$ 25 no mercado': { 'zh-Hant': '超市 R$ 25', en: 'R$ 25 at the market' },
  'Crédito no Mercado Bom Preço': { 'zh-Hant': 'Mercado Bom Preço 購物金', en: 'Credit at Mercado Bom Preço' },
  'Válido por 90 dias na unidade Pinheiros. Não cumulativo.': {
    'zh-Hant': 'Pinheiros 門市 90 天內有效，不可與其他優惠合併。',
    en: 'Valid for 90 days at the Pinheiros store. Cannot be combined.',
  },
  'Cinema: 2 ingressos': { 'zh-Hant': '電影院：2 張票', en: 'Cinema: 2 tickets' },
  'Sessão 2D no Cine Jardim': { 'zh-Hant': 'Cine Jardim 2D 場次', en: '2D screening at Cine Jardim' },
  'Sujeito à disponibilidade. Não válido para estreias.': {
    'zh-Hant': '依現場供應情況，不適用於首映。',
    en: 'Subject to availability. Not valid for premieres.',
  },
  'Bilhete Único recarga R$ 20': { 'zh-Hant': 'Bilhete Único 儲值 R$ 20', en: 'Bilhete Único top-up R$ 20' },
  'Recarga no cartão Bilhete Único': { 'zh-Hant': 'Bilhete Único 卡片儲值', en: 'Top-up on the Bilhete Único card' },
  'Recarga processada em até 48h no cartão informado.': {
    'zh-Hant': '儲值將於 48 小時內處理至指定卡片。',
    en: 'Top-up processed within 48h on the informed card.',
  },
  'Day pass academia': { 'zh-Hant': '健身房一日通行', en: 'Gym day pass' },
  'Um dia de treino na Smart Fit': { 'zh-Hant': 'Smart Fit 一日訓練', en: 'One day of training at Smart Fit' },
  'Apresente o QR na recepção. Válido em qualquer unidade.': {
    'zh-Hant': '請於櫃檯出示 QR 碼，所有分店適用。',
    en: 'Show the QR at reception. Valid at any location.',
  },
  'Doar 500 pts para ONG Oceano': { 'zh-Hant': '捐贈 500 點給 Oceano 協會', en: 'Donate 500 pts to ONG Oceano' },
  'Apoie a limpeza de praias': { 'zh-Hant': '支持海灘淨灘', en: 'Support beach clean-ups' },
  'Doação simbólica convertida em ações de limpeza de praias.': {
    'zh-Hant': '捐款將轉化為海灘淨灘行動。',
    en: 'Symbolic donation converted into beach clean-up actions.',
  },
  'Ecobag WANO': { 'zh-Hant': 'WANO 環保袋', en: 'WANO Ecobag' },
  'Sacola de algodão orgânico': { 'zh-Hant': '有機棉提袋', en: 'Organic cotton tote' },
  'Entrega em até 10 dias úteis na Grande São Paulo.': {
    'zh-Hant': '大聖保羅地區 10 個工作天內送達。',
    en: 'Delivery within 10 business days in Greater São Paulo.',
  },
  'Muda de árvore nativa': { 'zh-Hant': '原生樹苗', en: 'Native tree seedling' },
  'Ipê-amarelo para plantar': { 'zh-Hant': '黃色風鈴木樹苗', en: 'Yellow ipê for planting' },
  'Ipê-amarelo de viveiro certificado': { 'zh-Hant': '認證苗圃的黃色風鈴木', en: 'Yellow ipê from a certified nursery' },
  'Entrega com instruções de plantio. Retire ou receba em casa.': {
    'zh-Hant': '附種植說明，可自取或宅配。',
    en: 'Delivery with planting instructions. Pick up or receive at home.',
  },
  'Retirada no viveiro parceiro em Pinheiros. Acompanha guia de plantio.': {
    'zh-Hant': '於 Pinheiros 合作苗圃自取，附種植指南。',
    en: 'Pick up at the partner nursery in Pinheiros. Includes a planting guide.',
  },
  'Ingresso show no Parque': { 'zh-Hant': '公園演唱會門票', en: 'Concert ticket at the Park' },
  'Festival Circular · Parque Ibirapuera': { 'zh-Hant': '循環音樂祭 · Ibirapuera 公園', en: 'Circular Festival · Ibirapuera Park' },
  'Ingresso individual para o festival. Data sujeita a confirmação.': {
    'zh-Hant': '一人入場券，日期以確認公告為準。',
    en: 'Individual festival ticket. Date subject to confirmation.',
  },
  '30 dias de streaming': { 'zh-Hant': '30 天串流服務', en: '30 days of streaming' },
  '3 meses de streaming': { 'zh-Hant': '3 個月串流服務', en: '3 months of streaming' },
  'Assinatura Stream+': { 'zh-Hant': 'Stream+ 訂閱', en: 'Stream+ subscription' },
  'Plano padrão, sem anúncios': { 'zh-Hant': '標準方案，無廣告', en: 'Standard plan, no ads' },
  'Código de ativação enviado por e-mail em até 24h.': {
    'zh-Hant': '啟用碼將於 24 小時內以電子郵件寄出。',
    en: 'Activation code sent by email within 24h.',
  },
  'Código de ativação enviado por e-mail. Requer cartão para cadastro.': {
    'zh-Hant': '啟用碼以電子郵件寄出，註冊需綁定信用卡。',
    en: 'Activation code sent by email. Requires a card to sign up.',
  },
  'Kit 3 garrafas reutilizáveis': { 'zh-Hant': '3 入環保水瓶組', en: '3 reusable bottle kit' },
  'Aço inox 500ml': { 'zh-Hant': '不鏽鋼 500ml', en: 'Stainless steel 500ml' },
  'Produto físico. Frete grátis para sócios do RecIO.': {
    'zh-Hant': '實體商品，RecIO 會員免運費。',
    en: 'Physical product. Free shipping for RecIO members.',
  },
  'Livro "Cidade Circular"': { 'zh-Hant': '《循環城市》書籍', en: 'Book "Circular City"' },
  'Ensaios sobre economia circular': { 'zh-Hant': '循環經濟文集', en: 'Essays on the circular economy' },
  'Exemplar impresso. Entrega em até 7 dias úteis.': {
    'zh-Hant': '紙本乙本，7 個工作天內送達。',
    en: 'Printed copy. Delivery within 7 business days.',
  },
  'Sorvete artesanal': { 'zh-Hant': '手作冰淇淋', en: 'Artisanal ice cream' },
  'Copo 300ml na Gelateria Aurora': { 'zh-Hant': 'Gelateria Aurora 300ml 杯裝', en: '300ml cup at Gelateria Aurora' },
  'Dois sabores, 300 ml': { 'zh-Hant': '雙球口味，300 ml', en: 'Two flavours, 300 ml' },
  'Válido de terça a domingo. Sabores sazonais.': {
    'zh-Hant': '週二至週日適用，季節限定口味。',
    en: 'Valid Tuesday to Sunday. Seasonal flavours.',
  },
  'Uma porção por resgate. Válido na unidade de Pinheiros.': {
    'zh-Hant': '每次兌換一份，Pinheiros 門市適用。',
    en: 'One portion per redemption. Valid at the Pinheiros location.',
  },
  'Bike compartilhada: 10 viagens': { 'zh-Hant': '共享單車：10 次騎乘', en: 'Bike share: 10 rides' },
  'Crédito no app Bike Sampa': { 'zh-Hant': 'Bike Sampa 應用程式額度', en: 'Credit in the Bike Sampa app' },
  'Viagens de até 45 minutos. Código válido por 60 dias.': {
    'zh-Hant': '每趟最多 45 分鐘，兌換碼 60 天內有效。',
    en: 'Rides up to 45 minutes. Code valid for 60 days.',
  },

  /* ------------------------------------------ rewards (mock: rw_*) — extra copy */
  'R$ 25 no Mercado Vila': { 'zh-Hant': 'Mercado Vila R$ 25', en: 'R$ 25 at Mercado Vila' },
  'Crédito em compras acima de R$ 80': { 'zh-Hant': '消費滿 R$ 80 可折抵', en: 'Credit on purchases over R$ 80' },
  'Um voucher por CPF por mês. Válido em compras acima de R$ 80 no Mercado Vila.': {
    'zh-Hant': '每人每月限用一張，Mercado Vila 消費滿 R$ 80 適用。',
    en: 'One voucher per CPF per month. Valid on purchases over R$ 80 at Mercado Vila.',
  },
  'Válido por 30 dias em qualquer unidade da Padoca do Bairro. Não acumulativo com outras promoções.': {
    'zh-Hant': 'Padoca do Bairro 各門市 30 天內有效，不可與其他優惠合併。',
    en: 'Valid for 30 days at any Padoca do Bairro location. Cannot be combined with other promotions.',
  },
  'Sessões de segunda a quinta': { 'zh-Hant': '週一至週四場次', en: 'Monday to Thursday screenings' },
  'Sujeito à disponibilidade. Válido de segunda a quinta, exceto feriados.': {
    'zh-Hant': '依現場供應情況，週一至週四適用，國定假日除外。',
    en: 'Subject to availability. Valid Monday to Thursday, except holidays.',
  },
  'Recarga Bilhete Único': { 'zh-Hant': 'Bilhete Único 儲值', en: 'Bilhete Único top-up' },
  'R$ 20 no transporte público': { 'zh-Hant': '大眾運輸 R$ 20', en: 'R$ 20 on public transport' },
  'Crédito enviado em até 48h para o Bilhete Único informado.': {
    'zh-Hant': '額度將於 48 小時內發送至指定 Bilhete Único。',
    en: 'Credit sent within 48h to the informed Bilhete Único.',
  },
  'Day pass na Forma': { 'zh-Hant': 'Forma 一日通行', en: 'Day pass at Forma' },
  'Um dia de academia liberado': { 'zh-Hant': '健身房一日使用', en: 'One gym day unlocked' },
  'Apresente o código na recepção. Válido por 30 dias.': {
    'zh-Hant': '請於櫃檯出示兌換碼，30 天內有效。',
    en: 'Show the code at reception. Valid for 30 days.',
  },
  'Doar para ONG Oceano': { 'zh-Hant': '捐贈給 Oceano 協會', en: 'Donate to ONG Oceano' },
  '500 pontos viram R$ 5 para limpeza de praias': {
    'zh-Hant': '500 點換 R$ 5 海灘淨灘',
    en: '500 points become R$ 5 for beach clean-ups',
  },
  'A doação é convertida em R$ 5,00 e repassada mensalmente à ONG.': {
    'zh-Hant': '捐款將轉換為 R$ 5.00，每月撥給該協會。',
    en: 'The donation is converted into R$ 5.00 and passed on monthly to the NGO.',
  },
  'Ecobag RecIO': { 'zh-Hant': 'RecIO 環保袋', en: 'RecIO Ecobag' },
  'Algodão orgânico, edição limitada': { 'zh-Hant': '有機棉，限量版', en: 'Organic cotton, limited edition' },
  'Entrega em até 7 dias úteis no condomínio. Retire na portaria.': {
    'zh-Hant': '7 個工作天內送達社區，請至大廳領取。',
    en: 'Delivery within 7 business days in the building. Pick up at reception.',
  },
  'Museu da Língua Portuguesa': { 'zh-Hant': '葡萄牙語博物館', en: 'Museum of the Portuguese Language' },
  'Ingresso avulso': { 'zh-Hant': '單人門票', en: 'Single ticket' },
  'Válido por 60 dias, exceto terças-feiras de manutenção.': {
    'zh-Hant': '60 天內有效，週二維護日除外。',
    en: 'Valid for 60 days, except Tuesday maintenance days.',
  },
  'R$ 15 na Livraria': { 'zh-Hant': '書店 R$ 15', en: 'R$ 15 at the bookshop' },
  'Livros, papelaria e café': { 'zh-Hant': '書籍、文具與咖啡', en: 'Books, stationery and coffee' },
  'Não cumulativo com o cartão fidelidade da livraria.': {
    'zh-Hant': '不可與書店會員卡合併使用。',
    en: 'Cannot be combined with the bookshop loyalty card.',
  },
  'Revisão de bike': { 'zh-Hant': '自行車保養', en: 'Bike service' },
  'Ajuste completo + limpeza': { 'zh-Hant': '完整調校 + 清潔', en: 'Full tune-up + cleaning' },
  'Agendamento pelo parceiro. Não inclui peças de reposição.': {
    'zh-Hant': '需向合作店家預約，不含替換零件。',
    en: 'Booking through the partner. Replacement parts not included.',
  },
  'Doar 1 kg de ração': { 'zh-Hant': '捐贈 1 公斤飼料', en: 'Donate 1 kg of pet food' },
  'Para abrigos parceiros da região': { 'zh-Hant': '贈予地區合作收容所', en: 'For partner shelters in the region' },
  'A ração é comprada e doada mensalmente aos abrigos cadastrados.': {
    'zh-Hant': '飼料將按月購買並捐贈給登記收容所。',
    en: 'The food is bought and donated monthly to registered shelters.',
  },
  'Só 6 restantes': { 'zh-Hant': '僅剩 6 件', en: 'Only 6 left' },
  'Só 3 restantes': { 'zh-Hant': '僅剩 3 件', en: 'Only 3 left' },
  Esgotado: { 'zh-Hant': '已售完', en: 'Sold out' },
  Disponível: { 'zh-Hant': '供應中', en: 'Available' },
  'Mais popular': { 'zh-Hant': '最受歡迎', en: 'Most popular' },
  'Melhor valor': { 'zh-Hant': '最超值', en: 'Best value' },

  /* --------------------------------------------------------------- machines */
  'RVM Aurora · Torre Ipê (lobby)': { 'zh-Hant': 'RVM Aurora · 伊佩樓（大廳）', en: 'RVM Aurora · Ipê Tower (lobby)' },
  'RVM Aurora · Torre Ipê (garagem)': { 'zh-Hant': 'RVM Aurora · 伊佩樓（停車場）', en: 'RVM Aurora · Ipê Tower (garage)' },
  'RVM Aurora · Torre Jacarandá (lobby)': {
    'zh-Hant': 'RVM Aurora · 藍花楹樓（大廳）',
    en: 'RVM Aurora · Jacarandá Tower (lobby)',
  },
  'RVM Aurora · Torre Jacarandá (lazer)': {
    'zh-Hant': 'RVM Aurora · 藍花楹樓（休閒區）',
    en: 'RVM Aurora · Jacarandá Tower (leisure area)',
  },
  'RVM Aurora · Torre Araucária (lobby)': {
    'zh-Hant': 'RVM Aurora · 南洋杉樓（大廳）',
    en: 'RVM Aurora · Araucária Tower (lobby)',
  },
  'RVM Aurora · Torre Araucária (garagem)': {
    'zh-Hant': 'RVM Aurora · 南洋杉樓（停車場）',
    en: 'RVM Aurora · Araucária Tower (garage)',
  },
  'RVM Aurora · Portaria principal': { 'zh-Hant': 'RVM Aurora · 正門', en: 'RVM Aurora · Main entrance' },
  'RVM Aurora · Praça central': { 'zh-Hant': 'RVM Aurora · 中央廣場', en: 'RVM Aurora · Central plaza' },
  'Aurora · Hall A': { 'zh-Hant': 'Aurora · A 廳', en: 'Aurora · Hall A' },
  'Aurora · Torre B': { 'zh-Hant': 'Aurora · B 棟', en: 'Aurora · Tower B' },

  /* ------------------------------------------------------- condo / material names */
  'Edifício Aurora': { 'zh-Hant': 'Aurora 大樓', en: 'Aurora Building' },
  'Garrafa PET': { 'zh-Hant': 'PET 瓶', en: 'PET bottle' },
  'Lata de alumínio': { 'zh-Hant': '鋁罐', en: 'Aluminium can' },
  Alumínio: { 'zh-Hant': '鋁', en: 'Aluminium' },
  Vidro: { 'zh-Hant': '玻璃', en: 'Glass' },
  'Plástico HDPE': { 'zh-Hant': 'HDPE 塑膠', en: 'HDPE plastic' },
  'Plástico PP': { 'zh-Hant': 'PP 塑膠', en: 'PP plastic' },
  'Poliestireno (PS/HIPS)': { 'zh-Hant': '聚苯乙烯（PS/HIPS）', en: 'Polystyrene (PS/HIPS)' },

  /* ------------------------------------------------ impact badges (API + mock) */
  'Primeira embalagem': { 'zh-Hant': '第一件包裝', en: 'First package' },
  'Seu primeiro depósito aprovado.': { 'zh-Hant': '你的第一筆入帳已通過。', en: 'Your first approved deposit.' },
  '4 semanas seguidas': { 'zh-Hant': '連續 4 週', en: '4 weeks in a row' },
  'Recicle pelo menos uma vez por semana.': { 'zh-Hant': '每週至少回收一次。', en: 'Recycle at least once a week.' },
  '50 kg de impacto': { 'zh-Hant': '50 公斤影響力', en: '50 kg of impact' },
  'Meia tonelada de CO₂ evitada em grupo.': { 'zh-Hant': '群體累積減少半公噸 CO₂。', en: 'Half a tonne of CO₂ avoided together.' },
  'Embaixador verde': { 'zh-Hant': '綠色大使', en: 'Green ambassador' },
  'Convide 3 amigos que reciclem.': { 'zh-Hant': '邀請 3 位會回收的朋友。', en: 'Invite 3 friends who recycle.' },
  'Mês de 30 kg': { 'zh-Hant': '30 公斤之月', en: '30 kg month' },
  'Recicle 30 kg em um único mês.': { 'zh-Hant': '在單一月份回收 30 公斤。', en: 'Recycle 30 kg in a single month.' },
  'Alcance o nível Guardian com 5.000 pontos.': {
    'zh-Hant': '達到 5,000 點的 Guardian 等級。',
    en: 'Reach the Guardian level with 5,000 points.',
  },

  /* ------------------------------------------ notifications (API seed, 6 items) */
  'Outubro Circular começou': { 'zh-Hant': '十月循環開跑', en: 'Circular October has started' },
  'Garrafas PET valem 2x pontos até o fim do mês.': {
    'zh-Hant': 'PET 瓶點數 2 倍，直到月底。',
    en: 'PET bottles are worth 2× points until the end of the month.',
  },
  'Resgate confirmado': { 'zh-Hant': '兌換成功', en: 'Redemption confirmed' },
  'Resgate utilizado': { 'zh-Hant': '兌換已使用', en: 'Redemption used' },
  'Compra no mini-market': { 'zh-Hant': '社區超市消費', en: 'Mini-market purchase' },
  'Reciclagem concluída': { 'zh-Hant': '回收完成', en: 'Recycling complete' },
  'Desafio Aurora: você está no top 3': { 'zh-Hant': 'Aurora 挑戰：你進入前 3 名', en: 'Aurora Challenge: you are in the top 3' },
  'Seu convite funcionou!': { 'zh-Hant': '你的邀請成功了！', en: 'Your invite worked!' },
  'Bônus de indicação': { 'zh-Hant': '推薦獎勵', en: 'Referral bonus' },
  'O comprovante está disponível no seu extrato.': {
    'zh-Hant': '收據已可在你的交易明細中查看。',
    en: 'The receipt is available in your statement.',
  },
  'Participe do Desafio Aurora e concorra ao brinde coletivo.': {
    'zh-Hant': '參加 Aurora 挑戰，即有機會獲得社區禮物。',
    en: 'Join the Aurora Challenge and compete for the group gift.',
  },

  /* ------------------------------------- notifications (demo mock, 6 items) */
  'Você subiu para o nível Sprout': { 'zh-Hant': '你已升級至新芽等級', en: 'You reached the Sprout level' },
  'Outubro Circular: 2× pontos em PET': { 'zh-Hant': '十月循環：PET 點數 2 倍', en: 'Circular October: 2× points on PET' },
  'Faltam 10 dias. Deposite garrafas PET e dobre seus pontos.': {
    'zh-Hant': '還剩 10 天。投入 PET 瓶，點數加倍。',
    en: '10 days left. Drop PET bottles and double your points.',
  },
  'Máquina Aurora · Hall A está 88% cheia': {
    'zh-Hant': 'Aurora · A 廳機器已裝滿 88%',
    en: 'Aurora · Hall A machine is 88% full',
  },
  'A coleta está agendada para amanhã às 9h.': {
    'zh-Hant': '清運已安排在明天 9 點。',
    en: 'Collection is scheduled for tomorrow at 9am.',
  },
  'Resgate confirmado: Café na Padoca': { 'zh-Hant': '兌換成功：Padoca 咖啡', en: 'Redemption confirmed: coffee at Padoca' },
  'Seu código K7QM-2XPA está ativo por 30 dias.': {
    'zh-Hant': '兌換碼 K7QM-2XPA 有效期 30 天。',
    en: 'Your code K7QM-2XPA is active for 30 days.',
  },
  'Saque PIX de R$ 30,00 enviado': { 'zh-Hant': 'PIX 提領 R$ 30.00 已送出', en: 'PIX withdrawal of R$ 30.00 sent' },
  'Novo desafio no Aurora: 900 kg': { 'zh-Hant': 'Aurora 新挑戰：900 公斤', en: 'New challenge at Aurora: 900 kg' },
  'Agora seus pontos rendem 1,05× e você entra nos sorteios mensais.': {
    'zh-Hant': '現在點數享有 1.05× 加成，還能參加每月抽獎。',
    en: 'Your points now earn 1.05× and you are entered in the monthly giveaways.',
  },

  /* ------------------------------------------------ static ledger descriptions */
  Pontos: { 'zh-Hant': '點數', en: 'Points' },
  'Crédito': { 'zh-Hant': '回饋金', en: 'Credit' },
  'Pontos expirados': { 'zh-Hant': '點數已過期', en: 'Points expired' },
  'Bônus de boas-vindas WANO': { 'zh-Hant': 'WANO 歡迎獎勵', en: 'WANO welcome bonus' },
  'Bônus primeira reciclagem': { 'zh-Hant': '首次回收獎勵', en: 'First recycling bonus' },
  'Bônus de aniversário WANO': { 'zh-Hant': 'WANO 生日獎勵', en: 'WANO birthday bonus' },
  'Top 3 do condomínio em agosto': { 'zh-Hant': '八月社區前 3 名', en: 'Top 3 in the building in August' },
  'Primeira reciclagem de setembro': { 'zh-Hant': '九月首次回收', en: 'First recycling in September' },
  'Meta semanal concluída': { 'zh-Hant': '達成每週目標', en: 'Weekly goal completed' },
  'Bônus de indicação — amiga reciclou': { 'zh-Hant': '推薦獎勵 — 好友完成回收', en: 'Referral bonus — your friend recycled' },
  'Desafio Aurora — bônus de participação': {
    'zh-Hant': 'Aurora 挑戰 — 參與獎勵',
    en: 'Aurora Challenge — participation bonus',
  },
  'Sequência de 4 semanas reciclando': { 'zh-Hant': '連續 4 週回收', en: '4-week recycling streak' },
  'Bônus de campanha Outubro Circular': {
    'zh-Hant': '十月循環活動獎勵',
    en: 'Circular October campaign bonus',
  },
  'Cashback bônus de lançamento WANO': { 'zh-Hant': 'WANO 上市回饋金', en: 'WANO launch cashback bonus' },
  'Código de indicação aplicado': { 'zh-Hant': '已套用推薦碼', en: 'Referral code applied' },
  'Indicação aceita': { 'zh-Hant': '推薦已接受', en: 'Referral accepted' },
  'Mini-mercado Aurora': { 'zh-Hant': '社區超市 Aurora', en: 'Aurora mini-market' },
  'Mini-market — Quiosque Aurora': { 'zh-Hant': '社區超市 — Quiosque Aurora', en: 'Mini-market — Quiosque Aurora' },
  'Recarga R$ 20 — pack-20': { 'zh-Hant': '儲值 R$ 20 — pack-20', en: 'Top-up R$ 20 — pack-20' },

  /* --------------------------------------------------- referral programme rules */
  'Compartilhe seu código com amigos que ainda não usam o RecIO.': {
    'zh-Hant': '分享你的邀請碼給還沒使用 RecIO 的朋友。',
    en: 'Share your code with friends who do not use RecIO yet.',
  },
  'Cada pessoa pode aplicar um código apenas uma vez.': {
    'zh-Hant': '每人只能使用一次邀請碼。',
    en: 'Each person can apply a code only once.',
  },
  'Compartilhe seu código ou link.': { 'zh-Hant': '分享你的邀請碼或連結。', en: 'Share your code or link.' },
  'Seu amigo cria a conta e faz a primeira reciclagem.': {
    'zh-Hant': '朋友註冊並完成第一次回收。',
    en: 'Your friend signs up and recycles once.',
  },
  'Os pontos entram na hora para os dois.': {
    'zh-Hant': '點數立即發放給雙方。',
    en: 'Points land instantly for both of you.',
  },
};

interface Rule {
  pattern: RegExp;
  zh: (m: RegExpMatchArray) => string;
  en: (m: RegExpMatchArray) => string;
}

const tr = (value: string | undefined, locale: Locale): string => {
  if (!value) return '';
  return EXACT[value]?.[locale] ?? value;
};

const RULES: Rule[] = [
  /* ---------------------------------------------------- dynamic ledger copy */
  {
    pattern: /^Reciclagem · (\d+) embalagens?$/,
    zh: (m) => `回收 · ${m[1]} 件包裝`,
    en: (m) => `Recycling · ${m[1]} packages`,
  },
  {
    pattern: /^Reciclagem — (.+)$/,
    zh: (m) => `回收 — ${tr(m[1], 'zh-Hant')}`,
    en: (m) => `Recycling — ${tr(m[1], 'en')}`,
  },
  {
    pattern: /^Bônus campanha (.+)$/,
    zh: (m) => `活動獎勵：${tr(m[1], 'zh-Hant')}`,
    en: (m) => `Campaign bonus: ${tr(m[1], 'en')}`,
  },
  {
    pattern: /^Crédito adicionado · (.+)$/,
    zh: (m) => `已儲值 · ${m[1]}`,
    en: (m) => `Credit added · ${m[1]}`,
  },
  {
    pattern: /^Saque PIX · (.+)$/,
    zh: (m) => `PIX 提領 · ${m[1]}`,
    en: (m) => `PIX withdrawal · ${m[1]}`,
  },
  {
    pattern: /^Recarga R\$ (.+) — (.+)$/,
    zh: (m) => `儲值 R$ ${m[1]} — ${m[2]}`,
    en: (m) => `Top-up R$ ${m[1]} — ${m[2]}`,
  },
  {
    pattern: /^Mini-mercado (.+)$/,
    zh: (m) => `社區超市 ${m[1]}`,
    en: (m) => `Mini-market ${m[1]}`,
  },
  {
    pattern: /^Amigo indicado: (.+)$/,
    zh: (m) => `好友推薦：${m[1]}`,
    en: (m) => `Friend referred: ${m[1]}`,
  },
  {
    pattern: /^Indicação aceita — (.+)$/,
    zh: (m) => `推薦已接受 — ${m[1]}`,
    en: (m) => `Referral accepted — ${m[1]}`,
  },
  {
    pattern: /^Resgate — (.+)$/,
    zh: (m) => `兌換 — ${tr(m[1], 'zh-Hant')}`,
    en: (m) => `Redemption — ${tr(m[1], 'en')}`,
  },
  {
    pattern: /^Resgate confirmado: (.+)$/,
    zh: (m) => `兌換成功：${tr(m[1], 'zh-Hant')}`,
    en: (m) => `Redemption confirmed: ${tr(m[1], 'en')}`,
  },
  {
    pattern: /^(.+) — use o código ([A-Z0-9-]+) em (.+)\.$/,
    zh: (m) => `${tr(m[1], 'zh-Hant')} — 兌換碼 ${m[2]}，請於 ${m[3]} 使用。`,
    en: (m) => `${tr(m[1], 'en')} — use code ${m[2]} at ${m[3]}.`,
  },
  {
    pattern: /^(.+) — use o código ([A-Z0-9-]+)\.$/,
    zh: (m) => `${tr(m[1], 'zh-Hant')} — 兌換碼 ${m[2]}。`,
    en: (m) => `${tr(m[1], 'en')} — use code ${m[2]}.`,
  },
  {
    pattern: /^(.+) — bônus de participação$/,
    zh: (m) => `${tr(m[1], 'zh-Hant')} — 參與獎勵`,
    en: (m) => `${tr(m[1], 'en')} — participation bonus`,
  },
  {
    pattern: /^Seu código (.+) foi utilizado com sucesso\.$/,
    zh: (m) => `兌換碼 ${m[1]} 已成功使用。`,
    en: (m) => `Your code ${m[1]} was used successfully.`,
  },

  /* ----------------------------------------------- dynamic notification copy */
  {
    pattern: /^Você subiu para o nível (.+)$/,
    zh: (m) => `你已升級至${tr(m[1], 'zh-Hant')}等級`,
    en: (m) => `You reached the ${tr(m[1], 'en')} level`,
  },
  {
    pattern: /^Máquina (.+) está (\d+)% cheia$/,
    zh: (m) => `機器 ${tr(m[1], 'zh-Hant')} 已裝滿 ${m[2]}%`,
    en: (m) => `Machine ${tr(m[1], 'en')} is ${m[2]}% full`,
  },
  {
    pattern: /^Saque PIX de (.+) enviado$/,
    zh: (m) => `PIX 提領 ${m[1]} 已送出`,
    en: (m) => `PIX withdrawal of ${m[1]} sent`,
  },
  {
    pattern: /^Novo desafio no Aurora: (.+)$/,
    zh: (m) => `Aurora 新挑戰：${m[1]}`,
    en: (m) => `New challenge at Aurora: ${m[1]}`,
  },
  {
    pattern: /^R\$ (.+) debitados no Quiosque Aurora\.$/,
    zh: (m) => `已於 Quiosque Aurora 扣款 R$ ${m[1]}。`,
    en: (m) => `R$ ${m[1]} charged at Quiosque Aurora.`,
  },
  {
    pattern: /^Você reciclou (\d+) itens e ganhou (\d+) pontos \+ R\$ (.+) de cashback\.$/,
    zh: (m) => `你回收了 ${m[1]} 件，獲得 ${m[2]} 點 + R$ ${m[3]} 回饋金。`,
    en: (m) => `You recycled ${m[1]} items and earned ${m[2]} points + R$ ${m[3]} cashback.`,
  },
  {
    pattern: /^Faltam (\d+) kg para o condomínio bater a meta\.$/,
    zh: (m) => `社區還差 ${m[1]} 公斤就能達成目標。`,
    en: (m) => `The building is ${m[1]} kg away from the goal.`,
  },
  {
    pattern: /^(.+) entrou com o código (.+)\. \+(\d+) pontos\.$/,
    zh: (m) => `${m[1]} 已使用邀請碼 ${m[2]} 加入。+${m[3]} 點。`,
    en: (m) => `${m[1]} joined with code ${m[2]}. +${m[3]} points.`,
  },
  {
    pattern: /^Você ganhou (\d+) pontos por usar o código (.+)\.$/,
    zh: (m) => `你使用邀請碼 ${m[2]} 獲得 ${m[1]} 點。`,
    en: (m) => `You earned ${m[1]} points by using code ${m[2]}.`,
  },
  {
    pattern: /^Você ganhou (\d+) pontos com a indicação de (.+)\.$/,
    zh: (m) => `你透過 ${m[2]} 的推薦獲得 ${m[1]} 點。`,
    en: (m) => `You earned ${m[1]} points from the referral by ${m[2]}.`,
  },
  {
    pattern: /^Resgate confirmado$/,
    zh: () => '兌換成功',
    en: () => 'Redemption confirmed',
  },

  /* --------------------------------------------------- referral rule values */
  {
    pattern: /^Seu amigo ganha (\d+) pontos ao aplicar o código\.$/,
    zh: (m) => `朋友套用邀請碼可獲得 ${m[1]} 點。`,
    en: (m) => `Your friend gets ${m[1]} points when applying the code.`,
  },
  {
    pattern: /^Você ganha (\d+) pontos após a primeira reciclagem do seu amigo\.$/,
    zh: (m) => `朋友完成第一次回收後你可獲得 ${m[1]} 點。`,
    en: (m) => `You get ${m[1]} points after your friend recycles for the first time.`,
  },

  /* ------------------------------------------------------ reward stock labels */
  {
    pattern: /^Só (\d+) restantes$/,
    zh: (m) => `僅剩 ${m[1]} 件`,
    en: (m) => `Only ${m[1]} left`,
  },
  {
    pattern: /^Últimas (\d+) unidades$/,
    zh: (m) => `最後 ${m[1]} 件`,
    en: (m) => `Last ${m[1]} units`,
  },

  /* ------------------------------------------------------- leaderboard window */
  {
    pattern: /^Últimos (\d+) dias$/,
    zh: (m) => `最近 ${m[1]} 天`,
    en: (m) => `Last ${m[1]} days`,
  },
];

function localizeString(value: string, locale: Locale): string {
  const exact = EXACT[value];
  if (exact) return exact[locale];
  for (const rule of RULES) {
    const match = rule.pattern.exec(value);
    if (match) return locale === 'en' ? rule.en(match) : rule.zh(match);
  }
  return value;
}

/**
 * Walk an API/mock payload and replace known Portuguese content with the target
 * locale. Returns a new tree; the input is never mutated.
 */
export function localizeDeep<T>(value: T, locale: Locale): T {
  if (typeof value === 'string') return localizeString(value, locale) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => localizeDeep(item, locale)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = localizeDeep(item, locale);
    }
    return out as unknown as T;
  }
  return value;
}
