const CACHE_NAME = "police-prep-cbt-v1";
const OFFLINE_URL = "/index.html";

// Core app shell (critical for CBT to load offline)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  
  // Icons
  "/icon-192x192.png",
  "/icon-512x512.png",

  // Screenshots
  "/mobile.png",
  "/desktop.png"
];


// 🟢 INSTALL (cache app shell)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});


// 🔵 ACTIVATE (cleanup old caches)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});


// 🌐 FETCH STRATEGY
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // 🧠 Handle API (questions, results, auth)
  if (request.url.includes("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 📄 Page navigation (CBT pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // 📦 Static assets (CSS, JS, images)
  event.respondWith(cacheFirst(request));
});


// 📦 CACHE FIRST (for static assets)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}


// 🌐 NETWORK FIRST (for API & dynamic CBT data)
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return caches.match(request);
  }
}


// 🔄 BACKGROUND SYNC (retry failed CBT submissions)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-results") {
    event.waitUntil(syncResults());
  }
});

async function syncResults() {
  console.log("🔄 Syncing CBT results...");
  // TODO: resend failed exam submissions (IndexedDB queue)
}


// ⏱️ PERIODIC SYNC (update questions silently)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "update-questions") {
    event.waitUntil(updateQuestions());
  }
});

async function updateQuestions() {
  console.log("⏱️ Updating CBT questions...");
  // fetch("/api/questions") and update cache
}


// 🔔 PUSH NOTIFICATIONS
self.addEventListener("push", (event) => {
  let data = {
    title: "Police Prep CBT",
    body: "New exam questions available. Stay sharp!",
    url: "/index.html"
  };

  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: {
      url: data.url || "/index.html"
    },
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});


// 🔘 NOTIFICATION CLICK
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
