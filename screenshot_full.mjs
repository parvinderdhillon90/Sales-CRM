import { chromium } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';

const BASE = 'http://localhost:3000';
const OUT = '/tmp/screenshots_full';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

// Get JWT cookie via curl (bypasses browser timing issues)
function getCookie(email, password) {
  const out = execSync(
    `curl -si -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"${email}","password":"${password}"}'`
  ).toString();
  const match = out.match(/set-cookie:\s*crm_token=([^;]+)/i);
  if (!match) throw new Error('No cookie in response for ' + email);
  return match[1];
}

async function shot(label, email, password, shots) {
  const token = getCookie(email, password);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Inject cookie so middleware sees it
  await ctx.addCookies([{
    name: 'crm_token',
    value: token,
    url: 'http://localhost:3000',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  console.log(label + ' -> ' + page.url());

  for (const [file, y] of shots) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + '/' + file });
    console.log('  v ' + file);
  }
  await ctx.close();
}

console.log('CMD (Parvinder)...');
await shot('CMD', 'parvinder@cinuniverse.com', 'Parvinder@123', [
  ['cmd_01_top.png',    0],
  ['cmd_02_mid.png',  700],
  ['cmd_03_bot.png', 1400],
]);

console.log('Director (Rajesh)...');
await shot('Director', 'rajesh@salescrm.com', 'Director@123', [
  ['dir_01_top.png',   0],
  ['dir_02_mid.png', 700],
]);

console.log('Manager (Sunil)...');
await shot('Manager', 'sunil@salescrm.com', 'Sunil@123', [
  ['mgr_01_top.png',   0],
  ['mgr_02_mid.png', 700],
]);

await browser.close();
console.log('Done ->', OUT);
