/**
 * Captura de tela do app rodando, com emulação real de celular.
 *
 * Existe porque o emulador Android não sobe nesta máquina (ver BLOCKERS.md), e porque as
 * duas tentativas mais simples enganam:
 *  - `--window-size` do Chrome headless não define o viewport de layout de forma
 *    confiável (a captura sai recortada de um layout largo, parecendo bug do app);
 *  - iframe é bloqueado pelo servidor de desenvolvimento do Metro.
 *
 * Aqui usamos CDP com `setViewport`, que é o mesmo mecanismo do modo dispositivo do
 * DevTools: o layout é calculado no tamanho do aparelho de verdade.
 *
 * Uso:
 *   node scripts/shot.mjs <nome> <rota> [--full] [--w=390] [--h=844] [--wait=ms]
 *   node scripts/shot.mjs welcome /
 *   node scripts/shot.mjs feed / --full
 */

import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.APP_URL ?? 'http://localhost:8081';
const OUT_DIR = resolve(process.env.SHOT_DIR ?? './.shots');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};

const name = positional[0] ?? 'shot';

/**
 * O Git Bash converte um argumento iniciado por "/" em caminho do Windows antes de
 * entregá-lo ao node.exe — "/" chega como "C:/Program Files/Git". Normalizar aqui evita
 * um erro que, na mensagem, não tem nada a ver com a causa ("Cannot navigate to invalid URL").
 */
function normalizeRoute(raw) {
  if (!raw) return '/';
  if (/^[A-Za-z]:[\\/]/.test(raw)) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

const route = normalizeRoute(positional[1]);
const fullPage = args.includes('--full');
const width = Number(flag('w', 390));
const height = Number(flag('h', 844));
const settle = Number(flag('wait', 2500));

/**
 * Sessão de navegador reutilizável. Abrir e fechar o Chrome a cada tela custaria vários
 * segundos por captura; com várias telas para conferir, isso vira minutos.
 */
export async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check'],
  });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

export async function capture(browser, { name, route, fullPage = false, width = 390, height = 844, settle = 2500 }) {
  mkdirSync(OUT_DIR, { recursive: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${APP}${route}`, { waitUntil: 'networkidle2', timeout: 60_000 });
  // O bundle de desenvolvimento e as animações de entrada precisam assentar.
  await new Promise((r) => setTimeout(r, settle));

  const file = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  await page.close();

  return { file, errors };
}

// Execução direta pela linha de comando.
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { file, errors } = await withBrowser((b) =>
    capture(b, { name, route, fullPage, width, height, settle }),
  );
  if (errors.length > 0) {
    console.log('ERROS NO CONSOLE:');
    for (const e of [...new Set(errors)].slice(0, 10)) console.log(`  ${e}`);
  }
  console.log(file);
}
