const CACHE = 'sigr-cache-v5';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/js/core/storage.js',
  '/js/core/state.js',
  '/js/services/ActivityService.js',
  '/js/services/AuditService.js',
  '/js/services/NotificationService.js',
  '/js/services/ReminderService.js',
  '/js/services/EmailService.js',
  '/js/services/SchedulerService.js',
  '/js/services/SyncService.js',
  '/js/services/FinanceService.js',
  '/js/services/AgendaService.js',
  '/js/services/VaultService.js',
  '/js/services/GoogleAuthService.js',
  '/js/services/DriveService.js',
  '/js/services/BackupService.js',
  '/js/services/SyncManager.js',
  '/js/views/backupSettings.js',
  '/js/views/dashboard.js',
  '/js/views/list.js',
  '/js/views/detail.js',
  '/js/views/form.js',
  '/js/views/stats.js',
  '/js/views/activity.js',
  '/js/views/reminders.js',
  '/js/views/calendar.js',
  '/js/views/settings.js',
  '/js/views/finance.js',
  '/js/views/agendaView.js',
  '/js/views/vaultView.js',
  '/js/views/notifications.js',
  '/js/components/timeline.js',
  '/js/components/sidePanel.js',
  '/js/components/movementForm.js',
  '/js/components/reminderForm.js',
  '/js/app.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(ASSETS).catch(() => {/* partial ok */})
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(m => m || caches.match(url.pathname))
    )
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = data.url || '/index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
