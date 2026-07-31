(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const SyncService = {
    _lastSync: 0,
    _syncing: false,
    _interval: 300000,
    
    init: function() {
      this._lastSync = parseInt(localStorage.getItem('sigr:lastSync') || '0');
      window.addEventListener('online', () => this.process());
      return this;
    },
    
    process: async function() {
      if (this._syncing || !navigator.onLine) return;
      this._syncing = true;
      
      try {
        await this._syncPending();
        this._lastSync = Date.now();
        localStorage.setItem('sigr:lastSync', String(this._lastSync));
      } catch(e) {
        console.warn('SyncService: sync error', e);
      } finally {
        this._syncing = false;
      }
    },
    
    _syncPending: async function() {
      try {
        const pending = await window.SIGR.StorageService.getPendingSync();
        if (pending.length === 0) return;
        
        const emailService = window.SIGR.EmailService;
        if (emailService && emailService.isConfigured()) {
          for (const item of pending) {
            if (item.type === 'email') {
              const result = await emailService.send(item);
              if (result.success) {
                await window.SIGR.StorageService.removePendingSync(item.id);
              } else {
                item.retries = (item.retries || 0) + 1;
                if (item.retries > 10) {
                  await window.SIGR.StorageService.removePendingSync(item.id);
                }
              }
            }
          }
        }
      } catch(e) {}
    },
    
    getLastSync: function() {
      return this._lastSync;
    },
    
    getStatus: function() {
      return {
        syncing: this._syncing,
        lastSync: this._lastSync,
        online: navigator.onLine,
        lastSyncFormatted: this._lastSync ? new Date(this._lastSync).toLocaleString('es-ES') : 'Nunca'
      };
    }
  };
  
  window.SIGR.SyncService = SyncService;
})();