// ============================================================
//  바람 ERP - Service Worker
//  오프라인 캐싱 + 백그라운드 업데이트
// ============================================================

const CACHE_NAME = 'baram-erp-v1';

// 캐싱할 핵심 파일 목록
const CORE_ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/static/pretendard.css',
];

// ── 설치: 핵심 파일 캐싱 ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] 일부 파일 캐싱 실패:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── 활성화: 구버전 캐시 삭제 ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── fetch: Network First 전략 ─────────────────────────────────
// 구글시트 API는 항상 네트워크, 나머지는 캐시 폴백
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 구글시트 API / Apps Script → 항상 네트워크 (캐싱 X)
  if (url.includes('script.google.com') ||
      url.includes('sheets.googleapis.com') ||
      url.includes('docs.google.com/spreadsheets')) {
    return; // 기본 fetch 사용
  }

  // GET 요청만 캐싱
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 네트워크 성공 → 캐시 업데이트 후 반환
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // 오프라인 → 캐시에서 반환
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // HTML 요청이면 메인 페이지로 폴백
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./');
          }
        });
      })
  );
});

// ── 푸시: 업데이트 알림 (선택) ───────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
