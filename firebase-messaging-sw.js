/* Service worker: push-уведомления (Firebase Cloud Messaging) + работа без сети */

// Нажатие на уведомление открывает приложение (регистрируется до Firebase, чтобы сработать первым)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) return c.focus(); }
    return clients.openWindow(self.registration.scope);
  })());
});

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
  "./config.js"
);

try {
  firebase.initializeApp(self.KOT_CONFIG.firebase);
  firebase.messaging(); // уведомления с полем notification показываются автоматически
} catch (e) { /* конфиг ещё не заполнен */ }

// --- кэш оболочки приложения: сначала сеть, без сети — сохранённая копия ---
const CACHE = "kormushka-v7";
const SHELL = ["./", "./index.html", "./app.js", "./config.js", "./cat.jpg", "./cat-hungry.jpg", "./cat-waiting.jpg", "./cat-fed.jpg", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./icons/favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request, { cache: "no-cache" }); // всегда сверяемся с сервером
      if (res.ok) { const c = await caches.open(CACHE); c.put(e.request, res.clone()); }
      return res;
    } catch {
      return (await caches.match(e.request, { ignoreSearch: true })) || caches.match("./index.html");
    }
  })());
});
