import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.ADMIN_URL || 'http://127.0.0.1:4174';
const LOCALE = process.env.SHOT_LOCALE || 'zh-Hant';
const OUT = process.env.OUT_DIR
  ? path.resolve(process.cwd(), process.env.OUT_DIR)
  : path.resolve(process.cwd(), '..', 'docs', 'screenshots', 'admin');
const TOKEN = process.env.ADMIN_TOKEN || 'mock-admin-token';
const NAME = process.env.ADMIN_NAME || 'Operador WANO';

const pages = [
  { name: '01-login', route: '/login', auth: false },
  { name: '02-overview', route: '/', auth: true },
  { name: '03-payouts', route: '/payouts', auth: true },
  { name: '04-reconciliation', route: '/reconciliation', auth: true },
  { name: '05-redemptions', route: '/redemptions', auth: true },
  { name: '06-campaigns', route: '/campaigns', auth: true },
  { name: '07-rewards', route: '/rewards', auth: true },
  { name: '08-machines', route: '/machines', auth: true },
  { name: '09-deposits', route: '/deposits', auth: true },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = process.env.BROWSER_URL
    ? await puppeteer.connect({ browserURL: process.env.BROWSER_URL, defaultViewport: null })
    : await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb', '--lang=pt-BR'],
      });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  for (const item of pages) {
    if (item.auth) {
      await page.evaluateOnNewDocument(
        (token, name, locale) => {
          localStorage.setItem('wano.admin.token', token);
          localStorage.setItem('wano.admin.name', name);
          localStorage.setItem('wano.admin.locale', locale);
        },
        TOKEN,
        NAME,
        LOCALE,
      );
    } else {
      await page.evaluateOnNewDocument((locale) => {
        localStorage.removeItem('wano.admin.token');
        localStorage.removeItem('wano.admin.name');
        localStorage.setItem('wano.admin.locale', locale);
      }, LOCALE);
    }
    await page.goto(`${BASE}${item.route}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});
    await sleep(1200);
    await page.screenshot({ path: path.join(OUT, `${item.name}.png`), type: 'png' });
    console.log('captured', item.name);
  }

  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
  else console.log('no console errors');
  if (process.env.BROWSER_URL) browser.disconnect();
  else await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

