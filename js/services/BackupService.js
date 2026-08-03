/* ============ SIGR Pro - Backup & Restore Engine (Google Drive) ============ */
(function(){
  'use strict';

  window.SIGR = window.SIGR || {};

  const CFG_KEY = 'backup_config';
  const DEFAULT_FOLDER = 'BrayNotas Backups';
  const FORMAT = 'SIGR_BACKUP';
  const FORMAT_VERSION = 2;

  const BackupService = {
    FORMAT: FORMAT,
    _passphrase: null,
    _memConfig: null,

    /* ---------------- config ---------------- */

    async getConfig() {
      if (this._memConfig) return this._memConfig;
      let cfg = {
        autoBackup: true,
        intervalHours: 6,
        retention: 7,
        passphraseSet: false,
        passphraseHint: '',
        activeAccountId: null,
        folders: {},
        lastBackup: null,
        lastError: null,
        lastRestore: null
      };
      try {
        const saved = await window.SIGR.StorageService.getSetting(CFG_KEY, null);
        if (saved) cfg = Object.assign(cfg, saved);
      } catch(e) {}
      this._memConfig = cfg;
      return cfg;
    },

    async saveConfig(cfg) {
      this._memConfig = cfg;
      await window.SIGR.StorageService.setSetting(CFG_KEY, cfg);
    },

    getPassphrase() { return this._passphrase; },
    setPassphrase(p) { this._passphrase = p || null; },

    async setPassphraseProtected(passphrase) {
      const cfg = await this.getConfig();
      cfg.passphraseSet = !!passphrase;
      cfg.passphraseHint = passphrase
        ? passphrase.slice(0, 2) + '…' + ('·').repeat(Math.min(6, passphrase.length))
        : '';
      await this.saveConfig(cfg);
      this.setPassphrase(passphrase);
    },

    async _deviceId() {
      let id = localStorage.getItem('sigr:deviceId');
      if (!id) {
        id = 'dev-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
        localStorage.setItem('sigr:deviceId', id);
      }
      return id;
    },

    /* ---------------- snapshot build / parse ---------------- */

    async _snapshotFingerprint() {
      try {
        const records = await this._collectRecords();
        const stores = await window.SIGR.StorageService.getAllStoresData();
        delete stores.syncQueue;
        return JSON.stringify({ records: records, stores: stores }).length + ':' +
          Object.keys(records).reduce((a, m) => a + JSON.stringify(records[m] || []).length, 0);
      } catch(e) { return String(Date.now()); }
    },

    async _collectRecords() {
      const records = {};
      const prefix = 'sigr:records:';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) {
          try { records[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) {}
        }
      }
      return records;
    },

    _collectLocalStorage() {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('sigr:') === 0 && k.indexOf('sigr:records:') !== 0 && k !== 'sigr:lastSync' && k !== 'sigr:deviceId') {
          try { out[k] = localStorage.getItem(k); } catch(e) {}
        }
      }
      return out;
    },

    async buildSnapshot() {
      const stores = await window.SIGR.StorageService.getAllStoresData();
      delete stores.syncQueue;
      return {
        format: FORMAT,
        version: FORMAT_VERSION,
        createdAt: Date.now(),
        deviceId: await this._deviceId(),
        app: 'BrayNotas',
        records: await this._collectRecords(),
        local: this._collectLocalStorage(),
        stores: stores
      };
    },

    /* ---------------- crypto ---------------- */

    async _sha256Bytes(bytes) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async _deriveKey(passphrase, salt) {
      const enc = new TextEncoder();
      const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    },

    async _encryptBytes(bytes, passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await this._deriveKey(passphrase, salt);
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes);
      return { salt: salt, iv: iv, cipher: new Uint8Array(cipher) };
    },

    async _decryptBytes(payload, passphrase) {
      const salt = new Uint8Array(payload.salt);
      const iv = new Uint8Array(payload.iv);
      const key = await this._deriveKey(passphrase, salt);
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, payload.cipher);
        return new Uint8Array(plain);
      } catch(e) {
        throw new Error('Contraseña incorrecta o copia dañada');
      }
    },

    _bytesToB64(bytes) {
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    },

    _b64ToBytes(b64) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    },

    async _wrap(bytes, passphrase) {
      const sha256 = await this._sha256Bytes(bytes);
      let fileBytes = bytes;
      let salt = null;
      let iv = null;
      if (passphrase) {
        const enc = await this._encryptBytes(bytes, passphrase);
        salt = this._bytesToB64(enc.salt);
        iv = this._bytesToB64(enc.iv);
        fileBytes = enc.cipher;
      }
      return {
        encrypted: !!passphrase,
        salt: salt,
        iv: iv,
        sha256: sha256,
        fileBytes: fileBytes,
        size: fileBytes.byteLength
      };
    },

    /* ---------------- Drive folder ---------------- */

    async _getFolder(accountId) {
      const cfg = await this.getConfig();
      const shared = (cfg.folders || {})[accountId];
      if (shared && shared.folderId) {
        try {
          const f = await window.SIGR.DriveService.getFile(accountId, shared.folderId);
          if (f && f.id) return f;
        } catch(e) { /* folder may have been deleted -> recreate */ }
      }
      const folder = await window.SIGR.DriveService.ensureFolder(accountId, DEFAULT_FOLDER);
      cfg.folders = cfg.folders || {};
      cfg.folders[accountId] = { folderId: folder.id, folderName: folder.name };
      await this.saveConfig(cfg);
      return folder;
    },

    _isQuotaError: function(err) {
      return !!((err && (err.apiError && err.apiError.reason === 'storageQuotaExceeded')) ||
        /storageQuotaExceeded|storage quota/i.test((err && err.message) || ''));
    },

    _friendlyUploadError: function(err, accountId) {
      if (this._isQuotaError(err)) {
        const acc = window.SIGR.GoogleAuthService.getAccount(accountId);
        if (acc && acc.type === 'sa') {
          return new Error('La cuenta de servicio no puede guardar en su propio Drive (sin cuota). Comparte una carpeta de tu Google Drive con ' + acc.email + ' como Editor y elige esa carpeta en "Elegir carpeta compartida".');
        }
        return new Error('Google Drive sin espacio disponible. Libera espacio o usa otra cuenta.');
      }
      return err;
    },

    async setSharedFolder(accountId, folderId, folderName) {
      const cfg = await this.getConfig();
      cfg.folders = cfg.folders || {};
      cfg.folders[accountId] = { folderId: folderId, folderName: folderName || 'Carpeta compartida' };
      await this.saveConfig(cfg);
    },

    /* ---------------- backup ---------------- */

    async createBackup(accountId, opts) {
      opts = opts || {};
      const cfg = await this.getConfig();
      const passphrase = opts.passphrase !== undefined ? opts.passphrase : this._passphrase;
      if (cfg.passphraseSet && !passphrase) throw new Error('Ingresa la contraseña de cifrado');

      const snapshot = await this.buildSnapshot();
      const json = JSON.stringify(snapshot);
      const bytes = new TextEncoder().encode(json);

      const wrapped = passphrase ? await this._wrap(bytes, passphrase) : null;
      let payload = bytes;
      let isEncrypted = false;
      if (wrapped) {
        isEncrypted = true;
        const envelope = {
          format: FORMAT,
          version: 2,
          createdAt: Date.now(),
          encrypted: true,
          sha256: wrapped.sha256,
          salt: wrapped.salt,
          iv: wrapped.iv,
          data: this._bytesToB64(wrapped.fileBytes)
        };
        payload = new TextEncoder().encode(JSON.stringify(envelope));
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = 'SIGR-Backup-' + stamp + (isEncrypted ? '.enc' : '.json');
      const blob = new Blob([payload], { type: 'application/octet-stream' });

      const folder = await this._getFolder(accountId);
      let uploaded;
      try {
        uploaded = await window.SIGR.DriveService.upload(accountId, folder.id, fileName, blob, 'application/octet-stream');
      } catch(e) {
        throw this._friendlyUploadError(e, accountId);
      }

      if (uploaded.size && String(uploaded.size) !== String(blob.size)) {
        throw new Error('Verificación de tamaño falló en Drive');
      }

      /* rotation: keep only the N most recent */
      try {
        const files = await window.SIGR.DriveService.listFiles(accountId, folder.id);
        const backups = files.filter(f => /^SIGR-Backup-.*\.(json|enc)$/.test(f.name))
          .sort((a, b) => (a.createdTime || '').localeCompare(b.createdTime || ''));
        while (backups.length > (cfg.retention || 7)) {
          const oldest = backups.shift();
          try { await window.SIGR.DriveService.remove(accountId, oldest.id); } catch(e) {}
        }
      } catch(e) {}

      cfg.lastBackup = { at: Date.now(), fileId: uploaded.id, name: fileName, size: blob.size, accountId: accountId, encrypted: isEncrypted };
      cfg.lastError = null;
      await this.saveConfig(cfg);
      return cfg.lastBackup;
    },

    /* ---------------- listing / download / restore ---------------- */

    async listBackups(accountId) {
      const folder = await this._getFolder(accountId);
      const files = await window.SIGR.DriveService.listFiles(accountId, folder.id);
      return files
        .filter(f => /^SIGR-Backup-.*\.(json|enc)$/.test(f.name))
        .map(f => ({
          id: f.id,
          name: f.name,
          size: parseInt(f.size || '0', 10),
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          encrypted: /\.enc$/.test(f.name)
        }))
        .sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || ''));
    },

    async downloadBackup(accountId, fileId) {
      return window.SIGR.DriveService.download(accountId, fileId);
    },

    async parseBackupBlob(blob, passphrase) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text;
      try { text = new TextDecoder().decode(bytes); } catch(e) { throw new Error('Copia no legible'); }
      let wrapped = null;
      try { wrapped = JSON.parse(text); } catch(e) {}
      if (wrapped && wrapped.format === FORMAT) {
        if (wrapped.encrypted) {
          if (!passphrase) throw new Error('Esta copia está cifrada: ingresa la contraseña');
          if (wrapped.data) {
            const cipher = this._b64ToBytes(wrapped.data);
            const payload = { salt: this._b64ToBytes(wrapped.salt), iv: this._b64ToBytes(wrapped.iv), cipher: cipher };
            const plain = await this._decryptBytes(payload, passphrase);
            text = new TextDecoder().decode(plain);
          } else {
            throw new Error('Copia cifrada con formato antiguo. Crea una copia nueva.');
          }
        }
        const sha = await this._sha256Bytes(new TextEncoder().encode(text));
        if (wrapped.sha256 && sha !== wrapped.sha256) throw new Error('Integridad de la copia falló (hash no coincide)');
        return JSON.parse(text);
      }
      /* plain .json */
      return JSON.parse(text);
    },

    async restoreBackup(accountId, fileId, opts) {
      opts = opts || {};
      const cfg = await this.getConfig();
      const passphrase = opts.passphrase !== undefined ? opts.passphrase : this._passphrase;

      const blob = await this.downloadBackup(accountId, fileId);
      const snapshot = await this.parseBackupBlob(blob, passphrase);
      if (snapshot.format !== FORMAT) throw new Error('Archivo de copia no reconocido');

      /* safety: always create a backup of the current state first */
      try { await this.createBackup(accountId, { passphrase: passphrase || undefined }); } catch(e) {}

      if (opts.mode === 'merge') {
        await this._mergeSnapshot(snapshot);
      } else {
        await this._replaceSnapshot(snapshot);
      }

      cfg.lastRestore = { at: Date.now(), fileId: fileId, mode: opts.mode || 'replace', from: snapshot.deviceId || 'desconocido' };
      await this.saveConfig(cfg);
      return cfg.lastRestore;
    },

    async _replaceSnapshot(snapshot) {
      if (snapshot.records) {
        for (const moduleId of Object.keys(snapshot.records)) {
          localStorage.setItem('sigr:records:' + moduleId, JSON.stringify(snapshot.records[moduleId]));
        }
      }
      if (snapshot.local) {
        for (const k of Object.keys(snapshot.local)) {
          try { localStorage.setItem(k, snapshot.local[k]); } catch(e) {}
        }
      }
      await window.SIGR.StorageService.replaceStoresData(snapshot.stores || {});
      await window.SIGR.StorageService.clearSyncQueue().catch(() => {});
      try { window.SIGR.persistAll && window.SIGR.persistAll(); } catch(e) {}
    },

    async _mergeSnapshot(snapshot) {
      if (snapshot.records) {
        for (const moduleId of Object.keys(snapshot.records)) {
          const remote = snapshot.records[moduleId] || [];
          let local = [];
          try { local = JSON.parse(localStorage.getItem('sigr:records:' + moduleId) || '[]'); } catch(e) {}
          const byId = {};
          local.forEach(r => { if (r && r.id) byId[r.id] = r; });
          remote.forEach(r => {
            if (!r || !r.id) return;
            const l = byId[r.id];
            if (!l) { byId[r.id] = r; return; }
            const rTime = r.updatedAt || r.createdAt || 0;
            const lTime = l.updatedAt || l.createdAt || 0;
            if (rTime > lTime) byId[r.id] = r;
            else if (rTime === lTime && JSON.stringify(r) !== JSON.stringify(l)) {
              const clone = JSON.parse(JSON.stringify(r));
              clone.id = clone.id + '-dup';
              byId[clone.id] = clone;
            }
          });
          localStorage.setItem('sigr:records:' + moduleId, JSON.stringify(Object.values(byId)));
        }
      }
      await window.SIGR.StorageService.mergeStoresData(snapshot.stores || {});
    },

    async deleteBackup(accountId, fileId) {
      return window.SIGR.DriveService.remove(accountId, fileId);
    },

    /* ---------------- local file fallback (export/import without Drive) ---------------- */

    async exportLocalFile() {
      const snapshot = await this.buildSnapshot();
      const json = JSON.stringify(snapshot, null, 1);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'SIGR-Backup-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    },

    async importLocalFile(file) {
      const blob = new Blob([file], { type: file.type });
      const snapshot = await this.parseBackupBlob(blob, null);
      if (snapshot.format !== FORMAT) throw new Error('Archivo de copia no reconocido');
      await this._replaceSnapshot(snapshot);
    },

    /* ---------------- status ---------------- */

    async getStatus() {
      const cfg = await this.getConfig();
      let queueSize = 0;
      try {
        const q = await window.SIGR.StorageService.getSyncQueue();
        queueSize = q.length;
      } catch(e) {}
      return {
        autoBackup: cfg.autoBackup,
        intervalHours: cfg.intervalHours,
        retention: cfg.retention,
        passphraseSet: cfg.passphraseSet,
        activeAccountId: cfg.activeAccountId,
        lastBackup: cfg.lastBackup,
        lastError: cfg.lastError,
        queueSize: queueSize
      };
    }
  };

  window.SIGR.BackupService = BackupService;
})();
