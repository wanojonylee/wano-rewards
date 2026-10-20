/**
 * Records the Asaas sandbox payout demo (CDP screencast frames -> GIF) and
 * captures key states as PNGs.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEMO_URL = process.env.DEMO_URL || 'http://127.0.0.1:8791/';
const OUT_DIR = path.resolve(process.cwd(), '..', 'docs', 'demo');
const FRAMES_DIR = path.resolve(process.cwd(), 'demo-frames');
const BROWSER_URL = process.env.BROWSER_URL || 'http://127.0.0.1:9222';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.rm(FRAMES_DIR, { recursive: true, force: true });
  await fs.mkdir(FRAMES_DIR, { recursive: true });

  const browser = await puppeteer.connect({ browserURL: BROWSER_URL, defaultViewport: null });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 160));
  });

  await page.goto(DEMO_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});
  await sleep(1200);

  const frames = [];
  const client = await page.createCDPSession();
  client.on('Page.screencastFrame', async (frame) => {
    frames.push({ data: frame.data, ts: frame.metadata.timestamp });
    await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), type: 'png' });
    console.log('screenshot', name);
  };

  await sleep(1200);
  await shot('01-pending');

  await page.click('#failed');
  await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Falhou'), { timeout: 15000 });
  await sleep(1400);
  await shot('02-failed-refunded');

  await page.click('#create');
  await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Pendente'), { timeout: 15000 });
  await sleep(1400);
  await shot('03-new-request');

  await page.click('#paid');
  await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Pago'), { timeout: 15000 });
  await sleep(1800);
  await shot('04-paid');

  await sleep(1600);
  await client.send('Page.stopScreencast').catch(() => {});

  // persist frames
  for (let i = 0; i < frames.length; i += 1) {
    await fs.writeFile(path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.jpg`), Buffer.from(frames[i].data, 'base64'));
  }
  await fs.writeFile(path.join(FRAMES_DIR, 'timestamps.json'), JSON.stringify(frames.map((f) => f.ts)));
  console.log(`frames: ${frames.length}`);

  if (process.env.BROWSER_URL) browser.disconnect();
  else await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
