/*
 * Service worker de MesValeurs : consultation hors connexion des pages récentes.
 *
 * - Pages de l'espace connecté : réseau d'abord ; chaque page reçue est gardée
 *   (60 pages au plus, 7 jours) et réaffichée telle quelle sans connexion, avec sa date.
 * - Fichiers statiques de Next (/_next/static, immuables) : cache d'abord.
 * - Jamais gardés : API, authentification, pages de connexion, requêtes autres que GET.
 * - Pages effacées à la déconnexion, au changement d'entreprise (message « clear »)
 *   et dès qu'une page renvoie vers la connexion (session terminée).
 */
const PAGES_CACHE = "mv-pages-v1"; // même nom que src/lib/pwa/cache.ts
const STATIC_CACHE = "mv-static-v1";
const OFFLINE_URL = "/hors-ligne";
const MAX_PAGES = 60;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_STATIC = 400;

const NEVER_CACHED = /^\/(api|auth|icons)(\/|$)|^\/(connexion|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe|verification-mfa|onboarding|hors-ligne)(\/|$)/;
const SIGN_IN_PAGES = /^\/(connexion|verification-mfa)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== PAGES_CACHE && name !== STATIC_CACHE).map((name) => caches.delete(name)));
      await trimPages();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode !== "navigate") {
    return;
  }
  if (NEVER_CACHED.test(url.pathname)) {
    if (SIGN_IN_PAGES.test(url.pathname)) {
      event.waitUntil(caches.delete(PAGES_CACHE));
    }
    event.respondWith(fetch(request).catch(offlinePage));
    return;
  }
  event.respondWith(networkFirst(event, request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    // Les fichiers des anciens déploiements s'accumulent : seuls les plus récents restent
    const keys = await cache.keys();
    const old = keys.filter((key) => new URL(key.url).pathname !== OFFLINE_URL).slice(0, -MAX_STATIC);
    await Promise.all(old.map((key) => cache.delete(key)));
  }
  return response;
}

async function networkFirst(event, request) {
  let response;
  try {
    response = await fetch(request);
  } catch {
    return (await freshPage(request)) || offlinePage();
  }
  // Renvoyé vers la connexion : session terminée, les pages gardées sont effacées
  if (SIGN_IN_PAGES.test(new URL(response.url).pathname)) {
    event.waitUntil(caches.delete(PAGES_CACHE));
    return response;
  }
  const isHtml = (response.headers.get("content-type") || "").includes("text/html");
  if (response.ok && response.type === "basic" && !response.redirected && isHtml) {
    event.waitUntil(keepPage(request, response.clone()));
  }
  return response;
}

/** Garde la page, datée : l'attribut sur <html> sert au bandeau « Hors connexion ». */
async function keepPage(request, response) {
  const html = (await response.text()).replace(/<html\b/i, `<html data-offline-saved-at="${Date.now()}"`);
  const headers = new Headers(response.headers);
  headers.set("x-saved-at", String(Date.now()));
  headers.delete("content-length");
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(request, new Response(html, { status: response.status, statusText: response.statusText, headers }));
  await trimPages();
}

async function freshPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(request);
  if (!cached) {
    return null;
  }
  if (Date.now() - Number(cached.headers.get("x-saved-at") || 0) > MAX_AGE_MS) {
    await cache.delete(request);
    return null;
  }
  return cached;
}

/** Retire les pages trop anciennes, puis les plus anciennes au-delà de MAX_PAGES. */
async function trimPages() {
  const cache = await caches.open(PAGES_CACHE);
  const entries = await Promise.all(
    (await cache.keys()).map(async (request) => {
      const response = await cache.match(request);
      return { request, savedAt: Number((response && response.headers.get("x-saved-at")) || 0) };
    }),
  );
  entries.sort((a, b) => b.savedAt - a.savedAt);
  const expired = entries.filter((entry, index) => index >= MAX_PAGES || Date.now() - entry.savedAt > MAX_AGE_MS);
  await Promise.all(expired.map((entry) => cache.delete(entry.request)));
}

async function offlinePage() {
  return (await caches.match(OFFLINE_URL)) || new Response("Hors connexion", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
}
