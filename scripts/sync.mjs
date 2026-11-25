#!/usr/bin/env node
// Builds the storefront into ./public from the live Gumroad catalogue.
// Run by GitHub Actions on a schedule; also works locally:
//   GUMROAD_ACCESS_TOKEN=... node scripts/sync.mjs
//
// public/index.html             the page (renders from data/products.json)
// public/data/products.json     { profile, products[], updatedAt }
// public/data/avatar.<ext>      profile picture
// public/data/covers/<id>.<ext> one cover per product
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shortTitle, summaryOf, classify, productUrl, isVisible } from './feed.mjs';
import { renderProfile } from './profile.mjs';

const STOREFRONT_URL = 'https://momoikura.github.io/automata/';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');
const API = 'https://api.gumroad.com/v2';
const TIMEOUT_MS = 20000;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

const token = process.env.GUMROAD_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('GUMROAD_ACCESS_TOKEN is not set. Add it as a repository secret.');
  process.exit(1);
}

async function gumroad(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    throw new Error(`Gumroad ${endpoint} failed (${res.status}): ${body?.message ?? 'no message'}`);
  }
  return body;
}

// Downloads an image into public/data. Returns the site-relative path, or '' if it failed.
async function saveImage(url, baseName) {
  if (!url) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = EXT[type];
    if (!ext) throw new Error(`unexpected content type ${type || 'none'}`);
    const rel = `data/${baseName}.${ext}`;
    await writeFile(path.join(OUT, rel), Buffer.from(await res.arrayBuffer()));
    return rel;
  } catch (err) {
    console.warn(`::warning::Could not copy image ${url}: ${err.message}`);
    return '';
  }
}

// /products is paginated (10 per page, newest first); follow next_page_key until the end.
const MAX_PAGES = 50;
async function allProducts() {
  const all = [];
  let key = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await gumroad(`/products${key ? `?page_key=${encodeURIComponent(key)}` : ''}`);
    all.push(...(body.products || []));
    key = body.next_page_key;
    if (!key) return all;
  }
  throw new Error(`Gumroad returned more than ${MAX_PAGES} pages of products; stopping.`);
}

const safeId = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '');

async function main() {
  const [{ user }, products] = await Promise.all([gumroad('/user'), allProducts()]);
  // Never publish an empty shelf: a broken or partial API response should fail the run, not wipe the site.
  if (!products.some(isVisible)) {
    throw new Error(`Gumroad returned ${products.length} products and none are published. Refusing to publish an empty storefront.`);
  }
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'data', 'covers'), { recursive: true });

  const storeUrl = user.url || '';
  const visible = products.filter(isVisible);
  const out = await Promise.all(visible.map(async (p) => ({
    id: p.id,
    url: productUrl(p, storeUrl),
    title: shortTitle(p.name),
    full: p.name,
    price: (p.price ?? 0) / 100,
    currency: p.currency || 'usd',
    sum: summaryOf(p),
    cover: await saveImage(p.preview_url || p.thumbnail_url, `covers/${safeId(p.id)}`),
    coverSource: p.preview_url || p.thumbnail_url || '',
    ...classify(p),
  })));

  const feed = {
    profile: {
      name: user.display_name || user.name,
      username: storeUrl ? new URL(storeUrl).hostname.split('.')[0] : '',
      url: storeUrl,
      avatar: await saveImage(user.profile_picture_url, 'avatar'),
      avatarSource: user.profile_picture_url || '',
    },
    products: out,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(path.join(OUT, 'data', 'products.json'), JSON.stringify(feed));
  await copyFile(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));
  await writeFile(path.join(OUT, '.nojekyll'), '');
  const missing = out.filter((p) => !p.cover).length;
  console.log(`Built ${out.length} products (${missing} without a cover) for ${feed.profile.name}`);

  // The Gumroad profile page, rebuilt from the same feed. Pushed only when it changed.
  const profileHtml = renderProfile(feed, { storefrontUrl: STOREFRONT_URL });
  await writeFile(path.join(OUT, 'profile-preview.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${profileHtml}</body></html>`);
  if (process.env.PUSH_PROFILE === '1') await pushProfile(profileHtml);
}

// Compares without the "Updated" date so an unchanged catalogue doesn't rewrite the profile every run.
const comparable = (html) => String(html || '').replace(/Updated \d{4}-\d{2}-\d{2}/, '');

async function pushProfile(html) {
  const current = await gumroad('/user/custom_html');
  if (comparable(current.custom_html) === comparable(html)) {
    console.log('Gumroad profile already up to date');
    return;
  }
  const res = await fetch(`${API}/user/custom_html`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ custom_html: html }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    throw new Error(`Updating the Gumroad profile failed (${res.status}): ${body?.message ?? 'no message'}`);
  }
  const removed = body?.sanitization_report?.total_removed ?? 0;
  console.log(`Gumroad profile updated (${removed} item(s) removed by Gumroad's sanitizer)`);
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
