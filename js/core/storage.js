(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const DB_NAME = 'SIGR_DB';
  const DB_VERSION = 8;
  
  let idb = null;
  let initPromise = null;
  
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (idb) return resolve(idb);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('records')) {
          db.createObjectStore('records', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('movements')) {
          const ms = db.createObjectStore('movements', { keyPath: 'id' });
          ms.createIndex('recordId', 'recordId', { unique: false });
          ms.createIndex('moduleId', 'moduleId', { unique: false });
          ms.createIndex('date', 'date', { unique: false });
          ms.createIndex('updatedAt', 'updatedAt', { unique: false });
        } else {
          const tx = e.target.transaction;
          const ms = tx.objectStore('movements');
          if (!ms.indexNames.contains('date')) {
            ms.createIndex('date', 'date', { unique: false });
          }
          if (!ms.indexNames.contains('updatedAt')) {
            ms.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        }
        if (!db.objectStoreNames.contains('reminders')) {
          const rs = db.createObjectStore('reminders', { keyPath: 'id' });
          rs.createIndex('date', 'date', { unique: false });
          rs.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('activity')) {
          const as = db.createObjectStore('activity', { keyPath: 'id' });
          as.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('audit')) {
          const aus = db.createObjectStore('audit', { keyPath: 'id' });
          aus.createIndex('recordId', 'recordId', { unique: false });
          aus.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('versions')) {
          const vs = db.createObjectStore('versions', { keyPath: 'id' });
          vs.createIndex('recordId', 'recordId', { unique: false });
        }
        if (!db.objectStoreNames.contains('relations')) {
          const rls = db.createObjectStore('relations', { keyPath: 'id' });
          rls.createIndex('recordId', 'recordId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('pendingSync')) {
          db.createObjectStore('pendingSync', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fin_movements')) {
          const fms = db.createObjectStore('fin_movements', { keyPath: 'id' });
          fms.createIndex('type', 'type', { unique: false });
          fms.createIndex('category', 'category', { unique: false });
          fms.createIndex('date', 'date', { unique: false });
          fms.createIndex('frequency', 'frequency', { unique: false });
        }
        if (!db.objectStoreNames.contains('fin_debts')) {
          const fds = db.createObjectStore('fin_debts', { keyPath: 'id' });
          fds.createIndex('personId', 'personId', { unique: false });
          fds.createIndex('personId_type', ['personId','type'], { unique: false });
          fds.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('fin_persons')) {
          const fps = db.createObjectStore('fin_persons', { keyPath: 'id' });
          fps.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('fin_budgets')) {
          const fbs = db.createObjectStore('fin_budgets', { keyPath: 'id' });
          fbs.createIndex('category', 'category', { unique: false });
          fbs.createIndex('month', 'month', { unique: false });
          fbs.createIndex('category_month', ['category','month'], { unique: true });
        }
        if (!db.objectStoreNames.contains('agenda_events')) {
          const aes = db.createObjectStore('agenda_events', { keyPath: 'id' });
          aes.createIndex('date', 'date', { unique: false });
          aes.createIndex('type', 'type', { unique: false });
          aes.createIndex('date_type', ['date','type'], { unique: false });
        }
        if (!db.objectStoreNames.contains('vault_items')) {
          const vis = db.createObjectStore('vault_items', { keyPath: 'id' });
          vis.createIndex('category', 'category', { unique: false });
          vis.createIndex('service', 'service', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const sq = db.createObjectStore('syncQueue', { keyPath: 'key' });
          sq.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = e => { idb = e.target.result; resolve(idb); };
      req.onerror = e => reject(e.target.error);
    });
  }
  
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  }
  
  const StorageService = {
    ready: function() {
      if (!initPromise) initPromise = openIDB();
      return initPromise;
    },
    
    getLS: function(key, def) {
      try {
        const v = window.storage ? window.storage.get(key, false) : null;
        if (v && v.value) return JSON.parse(v.value);
      } catch(e) {}
      try {
        const v = localStorage.getItem('sigr:' + key);
        return v ? JSON.parse(v) : def;
      } catch(e) { return def; }
    },
    
    setLS: function(key, val) {
      const str = JSON.stringify(val);
      try { if (window.storage) window.storage.set(key, str, false); } catch(e) {}
      try { localStorage.setItem('sigr:' + key, str); } catch(e) {}
    },
    
    _generateMovementCode: async function(recordId) {
      const movements = await this.getMovements(recordId);
      const maxNum = movements.reduce((max, m) => {
        const match = (m.code || '').match(/MOV-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      return 'MOV-' + String(maxNum + 1).padStart(4, '0');
    },
    
    normalizeMovement: function(movement) {
      const now = Date.now();
      const base = Object.assign({}, movement || {});
      if (!base.id) base.id = uid('mov');
      if (!base.createdAt) base.createdAt = base.date || now;
      if (!base.date) base.date = base.createdAt;
      base.updatedAt = now;
      base.code = base.code || '';
      base.user = base.user || 'Usuario';
      base.type = base.type || 'general';
      base.description = base.description || '';
      base.motivo = base.motivo || '';
      base.comment = base.comment || '';
      base.observaciones = base.observaciones || '';
      base.status = base.status || '';
      base.priority = base.priority || 'normal';
      base.category = base.category || '';
      base.subcategory = base.subcategory || '';
      base.amount = base.amount || null;
      base.currency = base.currency || 'RD$';
      base.client = base.client || '';
      base.provider = base.provider || '';
      base.responsable = base.responsable || '';
      base.files = Array.isArray(base.files) ? base.files : [];
      base.photos = Array.isArray(base.photos) ? base.photos : [];
      base.pdfs = Array.isArray(base.pdfs) ? base.pdfs : [];
      base.audio_items = Array.isArray(base.audio_items) ? base.audio_items : [];
      base.video_items = Array.isArray(base.video_items) ? base.video_items : [];
      base.signature = base.signature || null;
      base.location = base.location || null;
      base.deleted = !!base.deleted;
      base.changeHistory = Array.isArray(base.changeHistory) ? base.changeHistory : [];
      base.schemaVersion = 3;
      return base;
    },
    
    /* ============ MOVEMENTS (append-only by default; never overwrite new history) ============ */
    addMovement: async function(movement) {
      const db = await this.ready();
      if (!movement.code) {
        movement.code = await this._generateMovementCode(movement.recordId);
      }
      if (!movement.time) movement.time = new Date().toTimeString().slice(0,5);
      movement = this.normalizeMovement(movement);
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readwrite');
        const store = tx.objectStore('movements');
        let attempts = 0;
        const add = () => {
          const req = store.add(movement);
          req.onerror = e => {
            e.preventDefault();
            if (req.error && req.error.name === 'ConstraintError' && attempts < 3) {
              attempts += 1;
              movement.id = uid('mov');
              add();
              return;
            }
            reject(req.error);
          };
        };
        add();
        tx.oncomplete = () => resolve(movement.id);
        tx.onerror = e => reject(e.target.error);
      });
    },
    
    updateMovement: async function(movement) {
      const db = await this.ready();
      movement = this.normalizeMovement(movement);
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readwrite');
        tx.objectStore('movements').put(movement);
        tx.oncomplete = () => resolve(movement.id);
        tx.onerror = e => reject(e.target.error);
      });
    },
    
    getMovements: async function(recordId) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readonly');
        const idx = tx.objectStore('movements').index('recordId');
        const req = idx.getAll(recordId);
        req.onsuccess = () => resolve((req.result || []).filter(m => !m.deleted).sort((a,b) => b.date - a.date));
        req.onerror = () => reject(req.error);
      });
    },
    
    getMovementById: async function(movementId) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readonly');
        const req = tx.objectStore('movements').get(movementId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    
    deleteMovement: async function(movementId) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readwrite');
        const store = tx.objectStore('movements');
        const req = store.get(movementId);
        req.onsuccess = () => {
          const movement = req.result;
          if (!movement) return;
          movement.deleted = true;
          movement.deletedAt = Date.now();
          movement.updatedAt = Date.now();
          store.put(movement);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getAllMovements: async function(moduleId, limit, offset) {
      const db = await this.ready();
      limit = limit || 500;
      offset = offset || 0;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readonly');
        const idx = tx.objectStore('movements').index('date');
        const req = idx.openCursor(null, 'prev');
        const results = [];
        let skipped = 0;
        req.onsuccess = e => {
          const cursor = e.target.result;
          if (!cursor) return resolve(results);
          if (cursor.value.deleted) { cursor.continue(); return; }
          if (moduleId && cursor.value.moduleId !== moduleId) { cursor.continue(); return; }
          if (skipped < offset) { skipped++; cursor.continue(); return; }
          results.push(cursor.value);
          if (results.length < limit) cursor.continue();
          else resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    },
    
    searchMovements: async function(query, moduleId) {
      const db = await this.ready();
      const q = query.toLowerCase().trim();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('movements', 'readonly');
        const req = tx.objectStore('movements').getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          list = list.filter(m => !m.deleted);
          if (moduleId) list = list.filter(m => m.moduleId === moduleId);
          if (q) {
            list = list.filter(m => {
              const d = new Date(m.date || m.createdAt || Date.now());
              const hay = [
                m.description, m.comment, m.observaciones, m.client,
                m.provider, m.category, m.subcategory, m.location,
                m.user, m.type, m.status, m.priority, String(m.amount || ''),
                d.toLocaleDateString('es-ES'), d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})
              ].filter(Boolean).join(' ').toLowerCase();
              return hay.includes(q);
            });
          }
          resolve(list.sort((a,b) => b.date - a.date));
        };
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ REMINDERS ============ */
    addReminder: async function(reminder) {
      const db = await this.ready();
      if (!reminder.id) reminder.id = uid('rem');
      return new Promise((resolve, reject) => {
        const tx = db.transaction('reminders', 'readwrite');
        tx.objectStore('reminders').put(reminder);
        tx.oncomplete = () => resolve(reminder.id);
        tx.onerror = () => reject(tx.error);
      });
    },
    
    updateReminder: async function(reminder) {
      reminder.updatedAt = Date.now();
      return this.addReminder(reminder);
    },
    
    getAllReminders: async function(filterFn) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('reminders', 'readonly');
        const req = tx.objectStore('reminders').getAll();
        req.onsuccess = () => {
          let list = req.result || [];
          if (filterFn) list = list.filter(filterFn);
          resolve(list.sort((a,b) => (a.date||'') < (b.date||'') ? -1 : 1));
        };
        req.onerror = () => reject(req.error);
      });
    },
    
    deleteReminder: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('reminders', 'readwrite');
        tx.objectStore('reminders').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    /* ============ ACTIVITY ============ */
    addActivity: async function(activity) {
      const db = await this.ready();
      if (!activity.id) activity.id = uid('act');
      if (!activity.date) activity.date = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('activity', 'readwrite');
        tx.objectStore('activity').put(activity);
        tx.oncomplete = () => resolve(activity.id);
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getActivity: async function(limit, offset) {
      const db = await this.ready();
      limit = limit || 50;
      offset = offset || 0;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('activity', 'readonly');
        const idx = tx.objectStore('activity').index('date');
        const req = idx.openCursor(null, 'prev');
        const results = [];
        let skipped = 0;
        req.onsuccess = e => {
          const cursor = e.target.result;
          if (!cursor) return resolve(results);
          if (skipped < offset) { skipped++; cursor.continue(); return; }
          results.push(cursor.value);
          if (results.length < limit) cursor.continue();
          else resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ AUDIT ============ */
    addAudit: async function(audit) {
      const db = await this.ready();
      if (!audit.id) audit.id = uid('aud');
      if (!audit.date) audit.date = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('audit', 'readwrite');
        tx.objectStore('audit').put(audit);
        tx.oncomplete = () => resolve(audit.id);
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getAudit: async function(recordId, limit) {
      const db = await this.ready();
      limit = limit || 100;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('audit', 'readonly');
        const idx = tx.objectStore('audit').index('recordId');
        const req = idx.getAll(recordId);
        req.onsuccess = () => resolve((req.result||[]).sort((a,b) => b.date - a.date).slice(0, limit));
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ VERSIONS ============ */
    saveVersion: async function(version) {
      const db = await this.ready();
      if (!version.id) version.id = uid('ver');
      return new Promise((resolve, reject) => {
        const tx = db.transaction('versions', 'readwrite');
        tx.objectStore('versions').put(version);
        tx.oncomplete = () => resolve(version.id);
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getVersions: async function(recordId) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('versions', 'readonly');
        const idx = tx.objectStore('versions').index('recordId');
        const req = idx.getAll(recordId);
        req.onsuccess = () => resolve((req.result||[]).sort((a,b) => b.date - a.date));
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ RELATIONS ============ */
    addRelation: async function(relation) {
      const db = await this.ready();
      if (!relation.id) relation.id = uid('rel');
      return new Promise((resolve, reject) => {
        const tx = db.transaction('relations', 'readwrite');
        tx.objectStore('relations').put(relation);
        tx.oncomplete = () => resolve(relation.id);
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getRelations: async function(recordId) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('relations', 'readonly');
        const idx = tx.objectStore('relations').index('recordId');
        const req = idx.getAll(recordId);
        req.onsuccess = () => resolve(req.result||[]);
        req.onerror = () => reject(req.error);
      });
    },
    
    removeRelation: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('relations', 'readwrite');
        tx.objectStore('relations').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    /* ============ SETTINGS ============ */
    getSetting: async function(key, def) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : def);
        req.onerror = () => reject(req.error);
      });
    },
    
    setSetting: async function(key, value) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    /* ============ SYNC ============ */
    addPendingSync: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = uid('sync');
      item.retries = item.retries || 0;
      return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingSync', 'readwrite');
        tx.objectStore('pendingSync').put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getPendingSync: async function() {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingSync', 'readonly');
        const req = tx.objectStore('pendingSync').getAll();
        req.onsuccess = () => resolve(req.result||[]);
        req.onerror = () => reject(req.error);
      });
    },
    
    removePendingSync: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingSync', 'readwrite');
        tx.objectStore('pendingSync').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    clearExpired: async function() {
      return false;
    },
    
    /* ============ FINANCE: MOVEMENTS ============ */
    addFinMovement: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = 'finm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      if (!item.createdAt) item.createdAt = Date.now();
      item.updatedAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_movements', 'readwrite');
        const req = tx.objectStore('fin_movements').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    updateFinMovement: async function(item) {
      const db = await this.ready();
      item.updatedAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_movements', 'readwrite');
        const req = tx.objectStore('fin_movements').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    deleteFinMovement: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_movements', 'readwrite');
        tx.objectStore('fin_movements').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    getFinMovement: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_movements', 'readonly');
        const req = tx.objectStore('fin_movements').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    getAllFinMovements: async function(filter) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_movements', 'readonly');
        const req = tx.objectStore('fin_movements').getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          if (filter) items = items.filter(filter);
          items.sort((a,b) => (b.date||b.createdAt) - (a.date||a.createdAt));
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    },
    getFinMovementsByType: async function(type) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_movements', 'readonly');
        const index = tx.objectStore('fin_movements').index('type');
        const req = index.getAll(type);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ FINANCE: PERSONS (debtors/creditors) ============ */
    addFinPerson: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = 'finp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      if (!item.createdAt) item.createdAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_persons', 'readwrite');
        const req = tx.objectStore('fin_persons').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    updateFinPerson: async function(item) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_persons', 'readwrite');
        const req = tx.objectStore('fin_persons').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    deleteFinPerson: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_persons', 'readwrite');
        tx.objectStore('fin_persons').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    getFinPerson: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_persons', 'readonly');
        const req = tx.objectStore('fin_persons').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    getAllFinPersons: async function(filter) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_persons', 'readonly');
        const req = tx.objectStore('fin_persons').getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          if (filter) items = items.filter(filter);
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ FINANCE: DEBT MOVEMENTS ============ */
    addFinDebt: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = 'find-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      if (!item.createdAt) item.createdAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_debts', 'readwrite');
        const req = tx.objectStore('fin_debts').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    deleteFinDebt: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_debts', 'readwrite');
        tx.objectStore('fin_debts').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    getFinDebtsByPerson: async function(personId) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_debts', 'readonly');
        const index = tx.objectStore('fin_debts').index('personId');
        const req = index.getAll(personId);
        req.onsuccess = () => {
          let items = req.result || [];
          items.sort((a,b) => (b.date||b.createdAt) - (a.date||a.createdAt));
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    },
    getAllFinDebts: async function(filter) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_debts', 'readonly');
        const req = tx.objectStore('fin_debts').getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          if (filter) items = items.filter(filter);
          items.sort((a,b) => (b.date||b.createdAt) - (a.date||a.createdAt));
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ FINANCE: BUDGETS ============ */
    addFinBudget: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = 'finb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      if (!item.createdAt) item.createdAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_budgets', 'readwrite');
        const req = tx.objectStore('fin_budgets').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    deleteFinBudget: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_budgets', 'readwrite');
        tx.objectStore('fin_budgets').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    getFinBudgetByCategoryMonth: async function(category, month) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_budgets', 'readonly');
        const index = tx.objectStore('fin_budgets').index('category_month');
        const req = index.get([category, month]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    getAllFinBudgets: async function(month) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fin_budgets', 'readonly');
        if (month) {
          const index = tx.objectStore('fin_budgets').index('month');
          const req = index.getAll(month);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        } else {
          const req = tx.objectStore('fin_budgets').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        }
      });
    },
    
    /* ============ AGENDA EVENTS ============ */
    addAgendaEvent: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      if (!item.createdAt) item.createdAt = Date.now();
      item.updatedAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('agenda_events', 'readwrite');
        const req = tx.objectStore('agenda_events').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    deleteAgendaEvent: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('agenda_events', 'readwrite');
        tx.objectStore('agenda_events').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    getAgendaEvent: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('agenda_events', 'readonly');
        const req = tx.objectStore('agenda_events').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    getAllAgendaEvents: async function(filter) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('agenda_events', 'readonly');
        const req = tx.objectStore('agenda_events').getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          if (filter) items = items.filter(filter);
          items.sort((a,b) => (a.date||0) - (b.date||0) || (a.time||'').localeCompare(b.time||''));
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    },
    updateAgendaEvent: async function(item) {
      const db = await this.ready();
      item.updatedAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('agenda_events', 'readwrite');
        const req = tx.objectStore('agenda_events').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ VAULT ITEMS ============ */
    addVaultItem: async function(item) {
      const db = await this.ready();
      if (!item.id) item.id = 'vlt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
      if (!item.createdAt) item.createdAt = Date.now();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('vault_items', 'readwrite');
        const req = tx.objectStore('vault_items').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    deleteVaultItem: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('vault_items', 'readwrite');
        tx.objectStore('vault_items').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    getVaultItem: async function(id) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('vault_items', 'readonly');
        const req = tx.objectStore('vault_items').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    getAllVaultItems: async function(filter) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('vault_items', 'readonly');
        const req = tx.objectStore('vault_items').getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          if (filter) items = items.filter(filter);
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    },
    updateVaultItem: async function(item) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('vault_items', 'readwrite');
        const req = tx.objectStore('vault_items').put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },
    
    getCount: async function(storeName) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    
    /* ============ SYNC QUEUE (change tracking) ============ */
    trackChange: async function(store, key, data, op) {
      if (!key && !(data && data.id)) return;
      const entityKey = String(key || data.id);
      const entry = {
        key: store + ':' + entityKey,
        store: store,
        entityKey: entityKey,
        op: op || 'upsert',
        data: data || null,
        updatedAt: Date.now(),
        tries: 0,
        lastError: null,
        lastAttempt: 0
      };
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readwrite');
        const qs = tx.objectStore('syncQueue');
        const getReq = qs.get(entry.key);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing && existing.op === entry.op) {
            existing.data = data;
            existing.updatedAt = entry.updatedAt;
            existing.tries = 0;
            existing.lastError = null;
            qs.put(existing);
          } else {
            qs.put(entry);
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    getSyncQueue: async function() {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readonly');
        const req = tx.objectStore('syncQueue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    
    updateSyncEntry: async function(entry) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readwrite');
        tx.objectStore('syncQueue').put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    removeSyncEntry: async function(key) {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readwrite');
        tx.objectStore('syncQueue').delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    clearSyncQueue: async function() {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('syncQueue', 'readwrite');
        tx.objectStore('syncQueue').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    
    /* ============ SNAPSHOT (full backup/restore) ============ */
    getAllStoresData: async function() {
      const db = await this.ready();
      const stores = Array.from(db.objectStoreNames);
      const out = {};
      for (const s of stores) {
        out[s] = await new Promise((resolve, reject) => {
          const tx = db.transaction(s, 'readonly');
          const req = tx.objectStore(s).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      }
      return out;
    },
    
    replaceStoresData: async function(data) {
      const db = await this.ready();
      const stores = Object.keys(data).filter(s => db.objectStoreNames.contains(s));
      for (const s of stores) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(s, 'readwrite');
          const store = tx.objectStore(s);
          store.clear();
          (data[s] || []).forEach(it => store.put(it));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    },
    
    mergeStoresData: async function(data) {
      const db = await this.ready();
      const stores = Object.keys(data).filter(s => db.objectStoreNames.contains(s) && s !== 'settings' && s !== 'syncQueue');
      for (const s of stores) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(s, 'readwrite');
          const store = tx.objectStore(s);
          const existingReq = store.getAll();
          existingReq.onsuccess = () => {
            const byId = {};
            (existingReq.result || []).forEach(e => { if (e && e.id) byId[e.id] = e; });
            (data[s] || []).forEach(remote => {
              if (!remote || !remote.id) return;
              const local = byId[remote.id];
              if (!local) { byId[remote.id] = remote; return; }
              const rTime = remote.updatedAt || remote.createdAt || remote.date || 0;
              const lTime = local.updatedAt || local.createdAt || local.date || 0;
              if (rTime > lTime) byId[remote.id] = remote;
              else if (rTime === lTime && JSON.stringify(remote) !== JSON.stringify(local)) {
                const clone = JSON.parse(JSON.stringify(remote));
                clone.id = clone.id + '-dup';
                byId[clone.id] = clone;
              }
            });
            Object.keys(byId).forEach(k => store.put(byId[k]));
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    }
  };
  
  window.SIGR.StorageService = StorageService;
  
  /* Auto-track changes on all mutating methods so SyncManager can pick them up */
  (function trackMutations(){
    const upsertOps = ['addMovement','updateMovement','addReminder','updateReminder','addActivity','addAudit','saveVersion','addRelation','addFinMovement','updateFinMovement','addFinPerson','updateFinPerson','addFinDebt','addFinBudget','addAgendaEvent','updateAgendaEvent','addVaultItem','updateVaultItem'];
    const deleteOps = ['deleteMovement','deleteReminder','removeRelation','deleteFinMovement','deleteFinPerson','deleteFinDebt','deleteFinBudget','deleteAgendaEvent','deleteVaultItem'];
    upsertOps.forEach(name => {
      const orig = StorageService[name];
      if (!orig) return;
      StorageService[name] = async function() {
        const result = await orig.apply(this, arguments);
        const arg = arguments[0];
        try {
          if (arg && typeof arg === 'object') {
            await StorageService.trackChange(name, arg.id || result, { entity: arg }, 'upsert');
          } else if (result && typeof result === 'object' && result.id) {
            await StorageService.trackChange(name, result.id, { entity: result }, 'upsert');
          }
        } catch(e) {}
        return result;
      };
    });
    deleteOps.forEach(name => {
      const orig = StorageService[name];
      if (!orig) return;
      StorageService[name] = async function() {
        const result = await orig.apply(this, arguments);
        try {
          await StorageService.trackChange(name, arguments[0], null, 'delete');
        } catch(e) {}
        return result;
      };
    });
  })();
})();
