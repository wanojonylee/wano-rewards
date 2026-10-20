# Asaas PIX sandbox 端到端演示

本目录是一次**真实后端代码路径**的 PIX 出款演示：

- 后端：`apps/api`（Express + SQLite ledger，未改代码）
- PIX provider：`PIX_PROVIDER=asaas`，调用 **Asaas v3 协议兼容的本地沙箱模拟器**
  （`tools/asaas-simulator.mjs`），而不是 mock provider
- Webhook：模拟器按 `asaas-access-token` 签名，回调真实的 `/api/v1/webhooks/pix`
- 结果：支付成功、失败退款、重试、对账 `variance = 0` 全部由后端真实处理

> ⚠️ 说明：本机没有 Asaas 账号/凭证，且 Asaas 沙箱需要巴西 CPF/CNPJ 注册，所以这里用
> **协议级模拟器**跑通整条链路。换成真实 Asaas 沙箱只需替换环境变量（见文末）。

## 录制与截图

| 文件 | 内容 |
| --- | --- |
| [asaas-payout-demo.gif](asaas-payout-demo.gif) | 录屏：待审 → 失败退款 → 新建请求 → 支付成功 → 对账 R$ 0,00 |
| [01-pending.png](01-pending.png) | 待审的 R$20 提现（provider: `tr_...`） |
| [02-failed-refunded.png](02-failed-refunded.png) | `TRANSFER_FAILED` 后状态失败、自动退款 |
| [03-new-request.png](03-new-request.png) | 重新发起提现 |
| [04-paid.png](04-paid.png) | `TRANSFER_PAID` 后状态已支付，对账正常 |
| [asaas-sandbox-e2e.log](asaas-sandbox-e2e.log) | provider 转账、Webhook 事件、后台列表、对账 JSON |

后台对应页面：[客户端 PIX 队列](../screenshots/admin/03-payouts.png) ·
[对账](../screenshots/admin/04-reconciliation.png)。

## 复现步骤（本地模拟器）

```powershell
# 1) 启动 API（Asaas provider 指向本地模拟器）
cd apps/api
$env:PIX_PROVIDER="asaas"
$env:ASAAS_API_KEY="sandbox_demo_key"
$env:ASAAS_BASE_URL="http://127.0.0.1:8791"
$env:ASAAS_WEBHOOK_TOKEN="wano_pix_demo_token"
$env:RATE_LIMIT_DISABLED="true"
npm run seed
npm run dev

# 2) 取两个 JWT（用户 / 管理员），启动模拟器
cd tools
$env:USER_TOKEN  = node get-token.mjs
$env:ADMIN_TOKEN = node get-admin-token.mjs
node asaas-simulator.mjs        # http://127.0.0.1:8791

# 3) 自动验收（失败退款 + 新单 + 对账）
node asaas-e2e.mjs

# 4) 打开控制室或重新录屏
#    http://127.0.0.1:8791
$env:BROWSER_URL="http://127.0.0.1:9222"; node record-asaas-demo.mjs
# 用 Python 把帧合成 GIF：
python tools/build-demo-gif.py
```

## 切换到真实 Asaas 沙箱

不需要改代码，只换环境变量并暴露公网 Webhook：

```bash
PIX_PROVIDER=asaas
ASAAS_API_KEY=<sandbox key>
ASAAS_BASE_URL=https://sandbox.asaas.com/api
ASAAS_WEBHOOK_TOKEN=<webhook token configured in Asaas>
PIX_PAYOUT_FEE_CENTS=150
```

1. 在 Asaas 后台创建 Webhook，指向 `https://<你的域名>/api/v1/webhooks/pix`，
   事件包含 `TRANSFER_PAID` / `TRANSFER_FAILED`，并设置 `asaas-access-token`。
2. 用测试用户发起 `POST /payouts`（R$20），Asaas 返回 `tr_...`。
3. 在 Asaas 沙箱确认转账，Webhook 会把后台状态改为 `paid`；也可在沙箱触发失败验证退款。
4. 用 `GET /admin/reconciliation` 检查 `varianceCents = 0`。

如果你提供 Asaas 沙箱 `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN`，我可以把同一套脚本切到真实
沙箱再录一遍（无需改代码）。
