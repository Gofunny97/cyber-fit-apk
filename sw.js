/* ================================================================
   NEON//FIT — Service Worker
   预缓存全部资源，安装后完全离线可用。
   ================================================================ */
const CACHE = "neonfit-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE)
      // 逐个添加：单个失败不应导致整体安装失败
      .then(c=>Promise.all(
        ASSETS.map(u=>c.add(u).catch(err=>console.warn("[SW] skip", u, err)))
      ))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method!=="GET") return;

  const url = new URL(req.url);
  // 只接管同源资源
  if(url.origin !== self.location.origin) return;

  // 导航请求：网络优先，失败回退到缓存的首页（保证离线可打开）
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req)
        .then(res=>{
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put("./index.html", copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match("./index.html").then(r=>r||caches.match("./")))
    );
    return;
  }

  // 静态资源：缓存优先，后台更新
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>{
        if(res && res.status===200 && res.type==="basic"){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});

// 支持页面主动触发更新
self.addEventListener("message", e=>{
  if(e.data === "SKIP_WAITING") self.skipWaiting();
});