# 部署指南（RecIO Rewards）

目标：把 `apps/api` 与 `apps/mobile` 部署成一套可试点、可复制的环境。演示环境 10 分钟可上线，生产环境按第 6 节清单逐项收口。

---

## 1. 架构与部署形态

```text
[Expo App / Web SPA]  --HTTPS-->  [API: Express 5]  -->  SQLite (持久卷)
        |                              |
        |                              +--> Stripe (测试/正式, Webhook)
        |                              +--> 对象存储（LGPD 导出文件，可选）
        |
   EAS Build / OTA（移动端） · 静态托管（Web）
```

- **API 必须单实例 + 本地持久磁盘**（SQLite）。横向扩容前先迁移 Postgres。
- **App** 通过 `EXPO_PUBLIC_API_URL` 在构建时绑定 API 地址，因此每个环境单独构建（EAS profile / CI）。
- **Web** 是从同一 Expo 代码导出的 SPA，用于预览/演示，也可作为桌面浏览器入口。

---

## 2. 后端部署

### 2.1 Docker Compose（推荐试点 / 内网）

```bash
cd apps/api
cp .env.example .env
# 必改：JWT_SECRET=$(openssl rand -hex 32)
docker compose up -d --build
curl http://localhost:8787/health
# {"ok":true,"version":"1.0.0","mode":"demo","stripe":"unconfigured"}
```

- 数据卷 `recio-data` 挂载到 `/app/data`，包含 `recio.db`（WAL 模式）与 LGPD 导出文件。
- 容器内置 healthcheck；`restart: unless-stopped`。
- 升级：`docker compose build && docker compose up -d`，SQLite 文件不丢。

### 2.2 Render / Railway / Fly.io

| 项目 | 值 |
| --- | --- |
| Build | `npm ci && npm run build` |
| Start | `npm start`（读取 `dist/`） |
| 磁盘 | 挂载持久卷到 `/app/data`（Fly: `[mounts] source="recio_data" destination="/app/data"`） |
| 健康检查 | `/health` |
| 实例数 | **1**（SQLite 单写者） |

### 2.3 反向代理与 TLS

Nginx/Caddy 终结 TLS，转发到 `127.0.0.1:8787`：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8787/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 2m;
}
```

设置 `TRUST_PROXY=true`（限流按真实 IP 计数），`CORS_ORIGINS=https://app.example.com`。

### 2.4 环境变量

| 变量 | 生产建议 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 生产模式会拒绝默认 JWT 密钥 |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | |
| `DB_PATH` | `/app/data/recio.db` | 必须落在持久卷 |
| `JWT_SECRET` | 32+ 随机字节 | **必须** |
| `AUTH_DEV_MODE` | `false` | 关闭固定验证码 `123456`，接短信网关（`src/services/auth.ts` 留了接入点） |
| `AUTO_SEED` | `false` | 生产不自动灌演示数据 |
| `DEMO_MODE` | `false` | 关闭 `simulate-deposit` 与 mock 支付 |
| `STRIPE_SECRET_KEY` | `sk_live_...` / 先 `sk_test_...` | 留空则使用 mock provider |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Webhook 验签必需 |
| `CORS_ORIGINS` | 前端域名，逗号分隔 | 生产只允许白名单 |
| `PUBLIC_WEB_URL` | `https://app.example.com` | 邀请链接等 |
| `LOG_JSON` | `true` | 便于日志采集 |
| `TRUST_PROXY` | `true`（在反代后） | |

### 2.5 Stripe 测试模式（当前默认）

1. Dashboard → Developers → API keys，复制 `sk_test_...` 写入 `.env`。
2. 本地转发 Webhook：
   ```bash
   stripe listen --forward-to localhost:8787/api/v1/webhooks/stripe
   # 把输出的 whsec_... 写入 STRIPE_WEBHOOK_SECRET，重启 API
   ```
3. App 内「钱包 → 添加」选择套餐 → 创建 Checkout → 测试卡 `4242 4242 4242 4242`（任意未来日期/CVC）。
4. 验证：Webhook `checkout.session.completed` 入账一次；重复事件按 `eventId` 去重；退款会冲正。

### 2.6 备份与恢复

```bash
# 热备份（WAL 安全）
sqlite3 data/recio.db ".backup '/backup/recio-$(date +%F).db'"
# 或停机复制 data/ 整个目录
```

- 每日备份 + 保留 30 天；每季度做一次恢复演练。
- LGPD 导出文件在 `data/exports/`，设置保留期与访问控制。

---

### 2.7 PIX 出款通道（Phase 2）

出款通过 `PIX_PROVIDER` 选择适配器，用户侧接口不变：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PIX_PROVIDER` | `mock` | `mock` 或 `asaas` |
| `ASAAS_API_KEY` | — | Asaas 沙箱/生产 API Key |
| `ASAAS_BASE_URL` | `https://sandbox.asaas.com/api` | 沙箱地址，生产改为官方地址 |
| `ASAAS_WEBHOOK_TOKEN` | — | Asaas Webhook 的 `asaas-access-token` |
| `PIX_PAYOUT_FEE_CENTS` | `150` | 用户费率（R$1,50），从提现额扣除后出款 |
| `PIX_MIN_CENTS` | `2000` | 最低提现 R$20 |
| `PIX_DAILY_CAP_CENTS` | `50000` | 单日上限 R$500 |

流程：用户申请 → 账本扣减 `credit` + `withdrawable`（含手续费）→ provider 创建转账（净额）→
Webhook 确认 `paid`；失败/取消则自动退款（账本 `payout_refund`）并通知用户。重复 Webhook 按事件 ID 幂等。

- Webhook 端点：`POST /api/v1/webhooks/pix`（原始 body，需在反代关闭缓冲）。
- 管理端：`GET /admin/payouts?status=`、`POST /admin/payouts/:id/paid|retry|fail`、`GET /admin/reconciliation?from=&to=`。
- 对账：`ledgerPayoutCents` 应等于 `paidCents + pendingCents`，差异（`varianceCents`）必须为 0；失败退款后仍应平衡。
- Asaas 沙箱联调：申请一笔 R$20 提现 → 后台看到 provider 返回 ID → 在 Asaas 沙箱触发/等待转账事件 → 后台状态变 `paid`。也可用 `POST /webhooks/pix` 模拟（带正确 token）。

## 3. Web 端部署

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.example.com/api/v1 npx expo export -p web
# 产物：apps/mobile/dist/
```

- **Vercel/Netlify**：静态目录 `dist`，SPA 回退到 `index.html`（`/* → /index.html 200`）。
- **Nginx**：
  ```nginx
  root /var/www/recio;
  location / { try_files $uri $uri/ /index.html; }
  ```
- 缓存：`index.html` 不缓存；`/_expo/static/*` 长缓存（带 hash）。
- 每次 API 地址变化都要重新 export（地址在构建时注入）。

---

### 3.2 运营后台部署（apps/admin）

后台是独立静态 SPA，构建时注入 API 地址：

```bash
cd apps/admin
VITE_API_URL=https://api.example.com/api/v1 npm run build
# 产物 apps/admin/dist/
```

- **Vercel/Netlify**：root 指向 `apps/admin`，build `npm run build`，输出 `dist`，SPA 回退 `/* → /index.html`。
- **Docker**：`docker build --build-arg VITE_API_URL=... -t wano-admin . && docker run -p 8080:80 wano-admin`（含 nginx SPA 配置与安全响应头）。
- **Nginx**：`try_files $uri $uri/ /index.html;`，缓存 `/assets/` 一年。
- 登录仅允许 `role=admin` 的账号；API 的 `CORS_ORIGINS` 需包含后台域名。
- 演示模式：不设置 `VITE_API_URL` 时使用内置 mock 数据，适合评审与截图。

## 4. 移动端部署（EAS）

```bash
cd apps/mobile
npm i -g eas-cli && eas login
eas init                     # 生成 projectId，写入 app.json extra.eas
# 修改 app.json：bundleIdentifier / package 为正式包名
eas build -p android --profile preview     # APK 内测
eas build -p android --profile production  # AAB 上架
eas build -p ios --profile production      # 需 Apple 开发者账号
eas submit -p android --profile production
eas update --branch production --message "fix: ..."   # OTA 热更新
```

- `eas.json` 中每个 profile 的 `EXPO_PUBLIC_API_URL` 必须指向对应环境。
- 首次上架准备：隐私政策 URL、数据安全表单（Google）、App Privacy（Apple）、年龄分级、账号删除入口（已内置 `/privacy`）。
- 相机权限文案在 `app.json` 的 `expo-camera` 插件中，审核会检查。

---

## 5. 验收步骤（部署后逐条执行）

```bash
# API
curl https://api.example.com/health
cd apps/api && npm test
node ../../tools/verify-api.mjs https://api.example.com/api/v1   # 需 DEMO_MODE/AUTH_DEV_MODE 打开

# App（真机）
- 登录 → 首页余额/活动/排行榜加载
- 扫码或手输机器码 → 投瓶（整机或 simulate）→ 收据 → 流水
- 兑换 1 个奖励 → 订单出现二维码/兑换码
- 充值套餐（测试卡）→ 余额与积分到账一次
- PIX 提现 R$ 20 → 状态 pending（后台放款）\n- 后台用管理员账号登录 → 提现队列显示待审 → 点击「Pago」；对账页 variance = R$ 0,00\n- 后台活动/奖励编辑保存成功，审计日志有记录
- 切换深色/英文 → 文案完整
- 隐私页导出/注销入口可用
```

---

## 6. 生产上线清单（Go-live checklist）

**安全**

- [ ] `JWT_SECRET` 随机且不入库；轮换方案明确
- [ ] `AUTH_DEV_MODE=false`，短信/邮件通道真实可用且有频控
- [ ] `CORS_ORIGINS` 白名单、Helmet、TLS、HSTS
- [ ] 管理端 API 仅内网/VPN 或独立域名 + IP 白名单
- [ ] 日志脱敏（手机号/CPF/邮箱）、审计日志保留
- [ ] 依赖漏洞扫描 + 镜像固定 digest

**数据与合规（巴西）**

- [ ] LGPD 法律依据、DPA、隐私政策与同意记录
- [ ] ANPD 事件通报流程（3 个工作日）
- [ ] 跨境访问（中国团队）SCC + TIA
- [ ] 数据保留期与删除流程演练（§20 与税务 5 年要求的书面裁定）
- [ ] 积分/抽奖活动 SPA 授权、IRRF 代扣、CDC 7 天退换
- [ ] PIX 出款切本地 PSP（Stripe 跨境直付 PIX 不可靠），KYC/AML 阈值
- [ ] 应用商店：Apple 3.1.1 / Google 支付政策、广告标识

**可靠性**

- [ ] 单实例 + 持久卷 + 每日备份 + 恢复演练
- [ ] 监控：`/health`、5xx、延迟、Webhook 失败、提现积压
- [ ] 告警：按 5 分钟窗口；值班联系人
- [ ] 容量：试点 10 台 → 100 台 → 1000 台的压测结论
- [ ] 迁移 Postgres 的触发条件（多实例/写入 > X/s）

**运营**

- [ ] 活动、奖励、库存、兑换履约 SOP
- [ ] 提现审核队列与对账（材料收入 / 积分负债 / 现金返现）
- [ ] 客诉与反欺诈申诉流程
- [ ] 数据看板：DAU、投瓶 kg、兑换率、PIX 提现、留存

---

## 7. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| App 一直弹回登录 | `EXPO_PUBLIC_API_URL` 未注入或 token 过期；重新登录 |
| `401 INVALID_CODE` | OTP 单次有效；重新获取验证码 |
| 支付仍走 mock | `STRIPE_SECRET_KEY` 未配置或未以 `sk_` 开头 |
| Webhook 验签失败 | 未使用 raw body / `STRIPE_WEBHOOK_SECRET` 不匹配 |
| 重启后余额丢失 | 数据卷未挂载或 `DB_PATH` 指向容器临时目录 |
| 多实例数据不一致 | SQLite 不支持多写；改为单实例或迁移 Postgres |
| 安卓相机无权限 | `app.json` 插件权限 + 真机授权；Web 端不支持相机，已提供手输码 |

