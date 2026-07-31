/* ============ SIGR Pro - SyncManager (auto backup + retry engine) ============ */
(function(){
  'use strict';

  window.SIGR = window.SIGR || {};

  const SyncManager = {
    _running: false,
    _timer: null,
    _listeners: [],
    _status: {
      state: 'idle',            /* idle | backing-up | error */
      lastResult: null,
      message: '',
      queueSize: 0,
      lastSync: 0,
      nextAuto: null
    },
    _lastErrorAt: 0,
    _lastSuccessAt: 0,
    _failureCount: 0,

    init: async function() {
      window.addEventListener('online', () => {
        this._status.message = 'Conexión restablecida: sincronizando…';
        this._notify();
        this.process();
      });
      window.addEventListener('offline', () => {
        this._status.message = 'Sin conexión: los cambios se guardarán en cola';
        this._status.state = 'idle';
        this._notify();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.process();
      });

      try { await window.SIGR.BackupService.getConfig(); } catch(e) {}
      try { await window.SIGR.GoogleAuthService.loadConfig(); } catch(e) {}

      const freq = await this._syncIntervalMs();
      this._schedule(freq);
      this.process();
      return this;
    },

    _syncIntervalMs: async function() {
      try {
        const nc = await window.SIGR.StorageService.getSetting('notification_config', null);
        if (nc && nc.syncFreq) return Math.max(60000, parseInt(nc.syncFreq, 10));
      } catch(e) {}
      return 300000;
    },

    _schedule: function(intervalMs) {
      if (this._timer) clearInterval(this._timer);
      this._timer = setInterval(() => this.process(), intervalMs || 300000);
    },

    onChange: function(fn) {
      this._listeners.push(fn);
      return () => { this._listeners = this._listeners.filter(f => f !== fn); };
    },

    _notify: function() {
      this._listeners.forEach(fn => { try { fn(this._status); } catch(e) {} });
    },

    getStatus: function() {
      return Object.assign({}, this._status);
    },

    _setStatus: function(patch) {
      Object.assign(this._status, patch);
      this._notify();
    },

    /* Public trigger: called after every local change (debounced inside) */
    scheduleProcess: function() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.process(), 8000);
    },

    isOnline: function() {
      return typeof navigator !== 'undefined' && navigator.onLine;
    },

    async process() {
      if (this._running) return;
      if (!this.isOnline()) return;

      this._running = true;
      try {
        const cfg = await window.SIGR.BackupService.getConfig();
        const accounts = window.SIGR.GoogleAuthService.getAccounts();
        if (!cfg.activeAccountId && accounts.length) cfg.activeAccountId = accounts[0].id;
        const account = accounts.find(a => a.id === cfg.activeAccountId);
        if (!account) return;

        let queueSize = 0;
        try { queueSize = (await window.SIGR.StorageService.getSyncQueue()).length; } catch(e) {}

        const now = Date.now();
        const lastBackupAt = cfg.lastBackup ? cfg.lastBackup.at : 0;
        const dueInterval = (cfg.intervalHours || 6) * 3600000;
        const queueDirty = queueSize > 0;
        const intervalDue = queueDirty || lastBackupAt === 0 || now - lastBackupAt >= dueInterval;

        if (!intervalDue && !queueDirty) {
          this._setStatus({ state: 'idle', message: 'Sin cambios pendientes', queueSize: queueSize, lastSync: now });
          return;
        }

        this._setStatus({ state: 'backing-up', message: 'Creando copia de seguridad en Google Drive…', queueSize: queueSize });
        const result = await window.SIGR.BackupService.createBackup(cfg.activeAccountId);
        await window.SIGR.StorageService.clearSyncQueue().catch(() => {});

        this._lastSuccessAt = Date.now();
        this._failureCount = 0;
        cfg.lastError = null;
        await window.SIGR.BackupService.saveConfig(cfg);
        this._setStatus({
          state: 'idle',
          queueSize: 0,
          lastSync: Date.now(),
          lastResult: result,
          message: 'Copia de seguridad completada: ' + result.name
        });

        try {
          window.SIGR.ActivityService.log('BACKUP_CREATED', {
            moduleId: 'sistema', description: 'Copia de seguridad subida a Google Drive',
            recordTitle: result.name
          }).catch(() => {});
        } catch(e) {}

        const next = await this._syncIntervalMs();
        this._schedule(next);
      } catch(e) {
        this._lastErrorAt = Date.now();
        this._failureCount++;
        const isPassphrase = /contraseña de cifrado/i.test((e && e.message) || '');
        const isConfig = /comparte una carpeta|Client ID|cuota/i.test((e && e.message) || '');
        this._setStatus({
          state: isPassphrase ? 'passphrase-required' : 'error',
          message: isPassphrase ? 'Copias cifradas activas: ingresa tu contraseña de cifrado para poder subir' : 'Error de sincronización: ' + (e && e.message || 'desconocido'),
          lastSync: Date.now()
        });
        /* retry with backoff: 1min, 2min, 4min... max 30min; after 3 consecutive failures (or
           config/passphrase errors) wait the normal interval instead of hammering the API */
        const backoff = Math.min(1800000, 60000 * Math.pow(2, Math.floor((Date.now() - this._lastErrorAt) / 60000)));
        const retryDelay = (isPassphrase || isConfig || this._failureCount >= 3) ? await this._syncIntervalMs() : backoff;
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => this.process(), retryDelay);
      } finally {
        this._running = false;
      }
    },

    async runBackupNow() {
      const cfg = await window.SIGR.BackupService.getConfig();
      const accounts = window.SIGR.GoogleAuthService.getAccounts();
      if (!accounts.length) throw new Error('No hay cuentas de Google configuradas');
      const accountId = cfg.activeAccountId || accounts[0].id;
      this._setStatus({ state: 'backing-up', message: 'Creando copia de seguridad…' });
      const result = await window.SIGR.BackupService.createBackup(accountId);
      await window.SIGR.StorageService.clearSyncQueue().catch(() => {});
      this._lastSuccessAt = Date.now();
      this._failureCount = 0;
      this._setStatus({ state: 'idle', message: 'Copia creada: ' + result.name, lastResult: result, lastSync: Date.now() });
      return result;
    }
  };

  window.SIGR.SyncManager = SyncManager;
})();
