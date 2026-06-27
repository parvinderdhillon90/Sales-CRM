import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3004';
const OUT = '/tmp/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ 
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function loginAndShot(name, email, password, filename) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  
  // Direct API login then navigate
  const resp = await page.request.post(BASE + '/api/auth/login', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' }
  });
  const body = await resp.json();
  if (!body.user) throw new Error('Login failed: ' + JSON.stringify(body));
  
  // The cookie is set, now navigate to dashboard
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${filename}`, fullPage: true });
  console.log(`✓ ${name} → ${filename}`);
  await ctx.close();
}

await loginAndShot('CMD Parvinder',    'parvinder@cinuniverse.com', 'Parvinder@123',   '01_cmd_dashboard.png');
await loginAndShot('Director Rajesh',  'rajesh@salescrm.com',       'Director@123',    '02_director_dashboard.png');
await loginAndShot('Manager Sunil',    'sunil@salescrm.com',         'Sunil@123',       '03_manager_sunil_dashboard.png');
await loginAndShot('Manager Siddharth','siddharth@salescrm.com',    'Siddharth@123',   '04_manager_siddharth_dashboard.png');

await browser.close();
console.log('All screenshots saved to', OUT);
