import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const LOCALE = process.env.SHOT_LOCALE || 'zh-Hant';
const OUT = process.env.OUT_DIR
  ? path.resolve(process.cwd(), process.env.OUT_DIR)
  : path.resolve(process.cwd(), '..', 'docs', 'screenshots');

const screens = [
  { name: '01-welcome', route: '/welcome', seed: 'onboarding' },
  { name: '02-sign-in', route: '/sign-in', seed: 'onboarding' },
  { name: '03-home', route: '/home', seed: 'auth' },
  { name: '04-rewards', route: '/rewards', seed: 'auth' },
  { name: '05-reward-detail', route: '/reward/rwd_coffee', seed: 'auth' },
  { name: '06-scan', route: '/scan', seed: 'auth' },
  { name: '07-impact', route: '/impact', seed: 'auth' },
  { name: '08-wallet', route: '/wallet', seed: 'auth' },
  { name: '09-orders', route: '/orders', seed: 'auth' },
  { name: '10-campaign', route: '/campaign/cmp_outubro', seed: 'auth' },
  { name: '11-leaderboard', route: '/leaderboard', seed: 'auth' },
  { name: '12-checkout', route: '/checkout', seed: 'auth' },
  { name: '13-payout', route: '/payout', seed: 'auth' },
  { name: '14-profile', route: '/profile', seed: 'auth' },
  { name: '15-settings', route: '/settings', seed: 'auth' },
  { name: '16-privacy', route: '/privacy', seed: 'auth' },
  { name: '17-notifications', route: '/notifications', seed: 'auth' },
  { name: '18-referral', route: '/referral', seed: 'auth' },
  { name: '19-machines', route: '/machines', seed: 'auth' },
  { name: '20-help', route: '/help', seed: 'auth' },
  { name: '21-home-dark', route: '/home', seed: 'auth', theme: 'dark' },
  { name: '22-rewards-dark', route: '/rewards', seed: 'auth', theme: 'dark' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AUTH_TOKEN = process.env.RECIO_TOKEN || 'demo-access-token';

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = process.env.BROWSER_URL
    ? await puppeteer.connect({ browserURL: process.env.BROWSER_URL, defaultViewport: null })
    : await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--hide-scrollbars',
          '--force-color-profile=srgb',
          '--lang=pt-BR',
          '--disable-features=Translate,BackForwardCache',
        ],
      });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 200));
  });

  // prime the origin so we can write localStorage
  await page.goto(`${BASE}/welcome`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await page.evaluate(
    (token, locale) => {
      localStorage.setItem('recio.token', token);
      localStorage.setItem('recio.onboarded', '1');
      localStorage.setItem('recio.locale', locale);
      localStorage.setItem('recio.theme', 'light');
    },
    AUTH_TOKEN,
    LOCALE,
  );

  // Optional: create a live recycling session through the API so the session
  // screen and receipt are captured with real data.
  const API = process.env.API_URL;
  let sessionId = null;
  if (API && process.env.RECIO_TOKEN) {
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RECIO_TOKEN}` };
      const started = await fetch(`${API}/sessions/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ machineCode: 'RVM-SP-001', source: 'qr' }),
      });
      if (started.ok) {
        const payload = await started.json();
        sessionId = payload.session?.id ?? null;
        for (let i = 0; i < 4 && sessionId; i += 1) {
          await fetch(`${API}/sessions/${sessionId}/simulate-deposit`, { method: 'POST', headers, body: '{}' });
        }
        if (sessionId) screens.push({ name: '23-session-live', route: `/session/${sessionId}`, seed: 'auth' });
      }
    } catch {
      // demo screenshots still work without a live session
    }
  }

  for (const screen of screens) {
    const theme = screen.theme || 'light';
    await page.evaluate((t) => localStorage.setItem('recio.theme', t), theme);
    if (screen.seed === 'onboarding') {
      await page.evaluate(() => {
        localStorage.removeItem('recio.token');
        localStorage.removeItem('recio.onboarded');
      });
    } else {
      await page.evaluate((token) => {
        localStorage.setItem('recio.token', token);
        localStorage.setItem('recio.onboarded', '1');
      }, AUTH_TOKEN);
    }
    try {
      await page.goto(`${BASE}${screen.route}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});
      await sleep(1600);
      await page.screenshot({ path: path.join(OUT, `${screen.name}.png`), type: 'png' });
      console.log('captured', screen.name);
    } catch (error) {
      console.error('failed', screen.name, error.message);
    }
  }

  if (sessionId && API && process.env.RECIO_TOKEN) {
    try {
      await fetch(`${API}/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RECIO_TOKEN}` },
        body: '{}',
      });
      await page.goto(`${BASE}/session/${sessionId}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(1600);
      await page.screenshot({ path: path.join(OUT, '24-session-receipt.png'), type: 'png' });
      console.log('captured 24-session-receipt');
    } catch (error) {
      console.error('failed 24-session-receipt', error.message);
    }
  }

  if (process.env.BROWSER_URL) browser.disconnect();
  else await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});




