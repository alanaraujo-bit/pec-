/**
 * Verificação visual do app inteiro.
 *
 * Cria uma conta real na API, monta um PC de verdade com peças do catálogo, injeta a
 * sessão no navegador e fotografa cada tela. Não é teste de snapshot — é o substituto do
 * "abrir o app e olhar", que nesta máquina não dá para fazer no emulador (ver BLOCKERS.md).
 *
 * Também reporta erro de console por tela: tela bonita com exceção no console não passou.
 */

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'https://api-production-eb453.up.railway.app';
const OUT = resolve('./.shots');

mkdirSync(OUT, { recursive: true });

async function apiCall(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Monta um cenário realista: PC desequilibrado, que produz um diagnóstico interessante. */
async function seed() {
  const stamp = Date.now().toString(36);
  const handle = `demo_${stamp}`.slice(0, 20);

  const auth = await apiCall('POST', '/auth/register', {
    body: {
      email: `${handle}@pece.demo`,
      password: 'demo-visual-123',
      handle,
      displayName: 'Alan Araujo',
      region: 'BR',
    },
  });
  const token = auth.token;

  await apiCall('PUT', '/me/profile', {
    token,
    body: {
      workloads: [
        { kind: 'aaa-gaming', weight: 3 },
        { kind: 'streaming', weight: 1 },
      ],
      resolution: '1080p',
      targetFps: 144,
      budgetTier: 'moderate',
      budgetAmount: 4000,
      currency: 'BRL',
      priorities: ['value-for-money'],
      expertise: 'beginner',
    },
  });

  const rig = await apiCall('POST', '/rigs', { token, body: { name: 'PC Principal' } });
  const rigId = rig.rig.id;

  // Processador de 2020 segurando uma placa de topo, com um pente só de memória.
  for (const componentId of [
    'cpu-i5-10400f',
    'gpu-rtx-4080-super',
    'mb-msi-b560m-pro',
    'sto-kingston-nv2-1tb',
    'psu-corsair-rm850x',
    'cool-cm-hyper212',
    'case-corsair-4000d-airflow',
    'mon-aoc-24g2',
  ]) {
    await apiCall('POST', `/rigs/${rigId}/components`, { token, body: { componentId } });
  }
  await apiCall('POST', `/rigs/${rigId}/components`, {
    token,
    body: { componentId: 'ram-corsair-veng-ddr4-16-3200', quantity: 1 },
  });

  // Uma troca já registrada, para a tela de evolução ter história de verdade.
  const detail = await apiCall('GET', `/rigs/${rigId}`, { token });
  const oldCooler = detail.rig.components.find((c) => c.component.category === 'COOLER');
  await apiCall('POST', `/rigs/${rigId}/components`, {
    token,
    body: {
      componentId: 'cool-deepcool-ak620',
      replacesRigComponentId: oldCooler.id,
      paidAmount: 320,
      paidCurrency: 'BRL',
    },
  });

  await apiCall('PATCH', `/rigs/${rigId}`, { token, body: { showValue: true } });

  const mainEvent = await apiCall('POST', '/events', {
    token,
    body: {
      kind: 'UPGRADE',
      title: 'Troquei o cooler: Hyper 212 → AK620',
      body: 'As temperaturas caíram bastante em sessão longa.',
      rigId,
      payload: { from: 'Hyper 212 Black Edition', to: 'AK620', scoreDelta: 3 },
    },
  });

  // Uma segunda pessoa, para o feed e o ranking não ficarem com um item só.
  const otherHandle = `bia_${stamp}`.slice(0, 20);
  const other = await apiCall('POST', '/auth/register', {
    body: {
      email: `${otherHandle}@pece.demo`,
      password: 'demo-visual-123',
      handle: otherHandle,
      displayName: 'Beatriz Lima',
      region: 'BR',
    },
  });
  await apiCall('PUT', '/me/profile', {
    token: other.token,
    body: {
      workloads: [{ kind: 'aaa-gaming', weight: 3 }],
      resolution: '1440p',
      targetFps: 75,
      budgetTier: 'moderate',
      budgetAmount: null,
      currency: 'BRL',
      priorities: ['value-for-money'],
      expertise: 'intermediate',
    },
  });
  const otherRig = await apiCall('POST', '/rigs', { token: other.token, body: { name: 'Setup da Bia' } });
  for (const componentId of [
    'cpu-r7-7800x3d',
    'gpu-rtx-4070-super',
    'mb-msi-b650-tomahawk',
    'sto-samsung-990pro-1tb',
    'psu-corsair-rm750x',
    'cool-deepcool-ak620',
    'case-nzxt-h5-flow',
  ]) {
    await apiCall('POST', `/rigs/${otherRig.rig.id}/components`, {
      token: other.token,
      body: { componentId },
    });
  }
  await apiCall('POST', `/rigs/${otherRig.rig.id}/components`, {
    token: other.token,
    body: { componentId: 'ram-corsair-veng-ddr5-16-6000', quantity: 2 },
  });
  await apiCall('POST', '/events', {
    token: other.token,
    body: {
      kind: 'BUILD',
      title: 'Montagem nova fechada: 7800X3D + 4070 Super',
      body: 'Foquei em equilíbrio em vez de gastar tudo na placa de vídeo.',
      rigId: otherRig.rig.id,
    },
  });

  await apiCall('PUT', `/users/${otherHandle}/follow`, { token });

  // Um comentário, para a tela de evento não aparecer vazia na verificação.
  await apiCall('POST', `/events/${mainEvent.event.id}/comments`, {
    token: other.token,
    body: { body: 'Boa troca! Caiu quanto a temperatura?' },
  });

  return {
    token,
    handle,
    rigId,
    otherHandle,
    otherRigId: otherRig.rig.id,
    eventId: mainEvent.event.id,
  };
}

async function main() {
  console.log('Preparando cenário na API real...');
  const ctx = await seed();
  console.log(`  conta @${ctx.handle}, máquina ${ctx.rigId}\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run'],
  });

  const screens = [
    { name: '01-onboarding', route: '/onboarding', anon: true },
    { name: '02-home', route: '/' },
    { name: '03-rigs', route: '/rigs' },
    { name: '04-rig-detail', route: `/rigs/${ctx.rigId}`, full: true },
    { name: '05-intelligence', route: `/rigs/${ctx.rigId}/intelligence`, full: true },
    { name: '06-add-component', route: `/rigs/${ctx.rigId}/add`, full: true },
    { name: '07-history', route: `/rigs/${ctx.rigId}/history`, full: true },
    { name: '08-rankings', route: '/rankings' },
    { name: '09-profile', route: '/profile', full: true },
    { name: '10-other-profile', route: `/profile?handle=${ctx.otherHandle}`, full: true },
    { name: '11-event', route: `/events/${ctx.eventId}`, full: true },
    { name: '12-compare', route: `/compare?left=${ctx.rigId}`, full: true },
    {
      name: '12b-compare-result',
      route: `/compare?left=${ctx.rigId}&right=${ctx.otherRigId}`,
      full: true,
    },
    { name: '13-welcome', route: '/', anon: true },
    { name: '14-login', route: '/(auth)/login', anon: true },
  ];

  let problems = 0;

  for (const screen of screens) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    // A sessão precisa existir antes do primeiro render, senão o porteiro redireciona.
    await page.evaluateOnNewDocument(
      (token, anon) => {
        if (anon) localStorage.removeItem('pece.token');
        else localStorage.setItem('pece.token', token);
      },
      ctx.token,
      Boolean(screen.anon),
    );

    await page.goto(`${APP}${screen.route}`, { waitUntil: 'networkidle2', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 3500));

    const file = join(OUT, `${screen.name}.png`);
    await page.screenshot({ path: file, fullPage: Boolean(screen.full) });

    const real = [...new Set(errors)].filter(
      (e) =>
        !e.includes('401') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('shadow') &&
        !e.includes('pointerEvents') &&
        !e.includes('useNativeDriver'),
    );

    if (real.length > 0) {
      problems += 1;
      console.log(`✖ ${screen.name}`);
      for (const e of real.slice(0, 4)) console.log(`    ${e.slice(0, 180)}`);
    } else {
      console.log(`✔ ${screen.name}`);
    }

    await page.close();
  }

  await browser.close();
  console.log(`\n${screens.length - problems}/${screens.length} telas sem erro de console`);
  console.log(`Capturas em ${OUT}`);
}

main().catch((err) => {
  console.error('Falhou:', err.message);
  process.exit(1);
});
