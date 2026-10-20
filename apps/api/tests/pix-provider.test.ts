import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.PIX_PROVIDER = "mock";

const { AsaasPixProvider } = await import("../src/services/pix/asaas.ts");
const { MockPixProvider } = await import("../src/services/pix/mock.ts");
const { resolvePixProvider } = await import("../src/services/pix/index.ts");
const { ApiError } = await import("../src/errors.ts");

type FetchCall = { url: string; init: RequestInit };

function stubFetch(payloads: unknown[]): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const payload = payloads.shift() ?? {};
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("Asaas adapter sends the documented transfer payload and maps statuses", async () => {
  const originalFetch = globalThis.fetch;
  const calls = stubFetch([
    { id: "tra_123", status: "PENDING" },
    { id: "tra_123", status: "DONE" },
    { id: "tra_123", status: "FAILED", failReason: "Conta inválida" },
    { id: "tra_123", status: "BANK_PROCESSING" },
  ]);
  try {
    const provider = new AsaasPixProvider({
      apiKey: "test-api-key",
      baseUrl: "https://sandbox.asaas.com/api/",
      webhookToken: "test-webhook-token",
    });

    const created = await provider.createPayout({
      payoutId: "pyt_abc",
      amountCents: 2350,
      pixKey: "user@example.com",
      pixKeyType: "email",
      description: "Saque RecIO pyt_abc",
    });
    assert.equal(created.providerPayoutId, "tra_123");
    assert.equal(created.status, "pending");

    const first = calls[0];
    assert.ok(first, "fetch was called");
    assert.equal(first.url, "https://sandbox.asaas.com/api/v3/transfers");
    assert.equal(first.init.method, "POST");
    const headers = new Headers(first.init.headers);
    assert.equal(headers.get("access_token"), "test-api-key");
    assert.equal(headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(first.init.body)), {
      value: 23.5,
      pixAddressKey: "user@example.com",
      pixAddressKeyType: "EMAIL",
      externalReference: "pyt_abc",
      description: "Saque RecIO pyt_abc",
    });

    const paid = await provider.getPayoutStatus("tra_123");
    assert.equal(paid.status, "paid");
    const second = calls[1];
    assert.ok(second);
    assert.equal(second.url, "https://sandbox.asaas.com/api/v3/transfers/tra_123");
    assert.equal(second.init.method, "GET");
    assert.equal(new Headers(second.init.headers).get("access_token"), "test-api-key");

    const failed = await provider.getPayoutStatus("tra_123");
    assert.equal(failed.status, "failed");
    assert.equal(failed.failureReason, "Conta inválida");

    const processing = await provider.getPayoutStatus("tra_123");
    assert.equal(processing.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Asaas webhook requires asaas-access-token and parses paid/failed events", () => {
  const provider = new AsaasPixProvider({
    apiKey: "test-api-key",
    baseUrl: "https://sandbox.asaas.com/api",
    webhookToken: "test-webhook-token",
  });
  const paidPayload = Buffer.from(
    JSON.stringify({
      id: "evt_paid_1",
      event: "TRANSFER_PAID",
      transfer: { id: "tra_123", externalReference: "pyt_abc" },
    }),
  );
  const failedPayload = Buffer.from(
    JSON.stringify({
      id: "evt_failed_1",
      event: "TRANSFER_FAILED",
      transfer: { id: "tra_123" },
      failureReason: "Saldo insuficiente",
    }),
  );

  assert.throws(
    () => provider.verifyWebhook({ "asaas-access-token": "wrong-token" }, paidPayload),
    (error: unknown) => error instanceof ApiError && error.code === "INVALID_SIGNATURE",
  );
  assert.throws(
    () => provider.verifyWebhook({}, paidPayload),
    (error: unknown) => error instanceof ApiError && error.code === "INVALID_SIGNATURE",
  );

  const paid = provider.verifyWebhook({ "asaas-access-token": "test-webhook-token" }, paidPayload);
  assert.equal(paid.id, "evt_paid_1");
  assert.equal(paid.type, "TRANSFER_PAID");
  assert.equal(paid.status, "paid");
  assert.equal(paid.providerPayoutId, "tra_123");
  assert.equal(paid.payoutId, "pyt_abc");

  const failed = provider.verifyWebhook({ "asaas-access-token": "test-webhook-token" }, failedPayload);
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "Saldo insuficiente");

  const ignored = provider.verifyWebhook(
    { "asaas-access-token": "test-webhook-token" },
    Buffer.from(JSON.stringify({ id: "evt_other", event: "TRANSFER_CREATED", transfer: { id: "tra_123" } })),
  );
  assert.equal(ignored.status, "ignored");
});

test("PIX provider factory falls back to mock outside production and fails closed in production", () => {
  assert.ok(resolvePixProvider({ provider: "mock" }) instanceof MockPixProvider);
  assert.ok(
    resolvePixProvider({ provider: "asaas", apiKey: "", production: false }) instanceof MockPixProvider,
    "dev/test without Asaas credentials uses mock",
  );
  assert.ok(resolvePixProvider({ provider: "bogus", production: false }) instanceof MockPixProvider);
  assert.ok(
    resolvePixProvider({
      provider: "asaas",
      apiKey: "test-api-key",
      webhookToken: "token",
      production: true,
    }) instanceof AsaasPixProvider,
  );

  for (const config of [
    { provider: "asaas", apiKey: "", production: true },
    { provider: "", production: true },
    { provider: "bogus", production: true },
  ]) {
    assert.throws(
      () => resolvePixProvider(config),
      (error: unknown) => error instanceof ApiError && error.code === "PAYOUT_PROVIDER_UNAVAILABLE",
    );
  }
});

test("mock provider returns mock_pix ids and the @fail.test trigger", async () => {
  const provider = new MockPixProvider();
  const ok = await provider.createPayout({
    payoutId: "pyt_ok",
    amountCents: 2350,
    pixKey: "user@example.com",
    pixKeyType: "email",
    description: "Saque RecIO pyt_ok",
  });
  assert.match(ok.providerPayoutId, /^mock_pix_/);
  assert.equal(ok.status, "pending");
  assert.equal((await provider.getPayoutStatus(ok.providerPayoutId)).status, "pending");

  const failed = await provider.createPayout({
    payoutId: "pyt_fail",
    amountCents: 2350,
    pixKey: "user@fail.test",
    pixKeyType: "email",
    description: "Saque RecIO pyt_fail",
  });
  assert.equal(failed.status, "failed");
  assert.match(failed.failureReason ?? "", /simulada/i);
  assert.equal((await provider.getPayoutStatus(failed.providerPayoutId)).status, "failed");
});
