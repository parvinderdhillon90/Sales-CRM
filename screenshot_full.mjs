import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const OUT = '/tmp/screenshots_full';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ 
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function loginAndShot(name, email, password, shots) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  
  const resp = await page.request.post(BASE + '/api/auth/login', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' }
  });
  const body = await resp.json();
  if (!body.user) throw new Error('Login failed: ' + JSON.stringify(body));
  
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  for (const [filename, scrollY] of shots) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${filename}` });
    console.log(`  ✓ ${filename}`);
  }

  await ctx.close();
}

console.log('CMD (Parvinder)...');
await loginAndShot('CMD', 'parvinder@cinuniverse.com', 'Parvinder@123', [
  ['cmd_01_top.png',    0],
  ['cmd_02_mid.png',  600],
  ['cmd_03_bot.png', 1200],
]);

console.log('Director (Rajesh)...');
await loginAndShot('Director', 'rajesh@salescrm.com', 'Director@123', [
  ['dir_01_top.png',   0],
  ['dir_02_mid.png', 600],
]);

console.log('Manager (Sunil)...');
await loginAndShot('Manager', 'sunil@salescrm.com', 'Sunil@123', [
  ['mgr_01_top.png',   0],
  ['mgr_02_mid.png', 600],
]);

await browser.close();
console.log('Done →', OUT);
