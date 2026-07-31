(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  function now() { return Date.now(); }
  function uid() { return 'aud-' + now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  
  const AuditService = {
    register: async function(params) {
      const audit = {
        id: uid(),
        moduleId: params.moduleId,
        recordId: params.recordId,
        user: params.user || 'Usuario',
        action: params.action,
        field: params.field || null,
        oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
        description: params.description || '',
        date: now()
      };
      try {
        await window.SIGR.StorageService.addAudit(audit);
        this._monitorStorage();
      } catch(e) { console.warn('AuditService: storage error', e); }
      return audit;
    },
    
    getByRecord: async function(recordId, limit) {
      try {
        return await window.SIGR.StorageService.getAudit(recordId, limit || 100);
      } catch(e) { return []; }
    },
    
    _monitorStorage: async function() {
      try {
        const count = await window.SIGR.StorageService.getCount('audit');
        if (count > 50000) {
          console.info('AuditService: auditoría grande conservada permanentemente', count);
        }
      } catch(e) {}
    },
    
    snapshot: async function(mod, rec) {
      const snapshot = JSON.parse(JSON.stringify(rec));
      try {
        await window.SIGR.StorageService.saveVersion({
          recordId: rec.id,
          moduleId: mod.id,
          date: now(),
          snapshot: snapshot,
          label: 'Versión #'
        });
      } catch(e) {}
    }
  };
  
  window.SIGR.AuditService = AuditService;
})();
