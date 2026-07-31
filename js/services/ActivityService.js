(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  function now() { return Date.now(); }
  function uid() { return 'act-' + now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  
  const ActivityService = {
    _types: {
      RECORD_CREATED: 'Registro creado',
      RECORD_UPDATED: 'Registro actualizado',
      RECORD_DELETED: 'Registro eliminado',
      RECORD_RESTORED: 'Registro restaurado',
      MOVEMENT_ADDED: 'Movimiento agregado',
      FILE_ATTACHED: 'Archivo adjuntado',
      COMMENT_ADDED: 'Comentario agregado',
      STATUS_CHANGED: 'Estado cambiado',
      PRIORITY_CHANGED: 'Prioridad cambiada',
      REMINDER_CREATED: 'Recordatorio creado',
      REMINDER_COMPLETED: 'Recordatorio completado',
      REMINDER_SENT: 'Recordatorio enviado',
      EMAIL_SENT: 'Correo enviado',
      NOTIFICATION_SENT: 'Notificación enviada',
      RELATION_ADDED: 'Relación agregada',
      SUBRECORD_CREATED: 'Subregistro creado',
      FAVORITE_TOGGLED: 'Favorito cambiado',
      ARCHIVE_TOGGLED: 'Archivado cambiado',
      VERSION_RESTORED: 'Versión restaurada'
    },
    
    getTypes: function() { return this._types; },
    
    log: async function(type, data) {
      const activity = {
        id: uid(),
        type: type,
        typeLabel: this._types[type] || type,
        moduleId: data.moduleId || null,
        recordId: data.recordId || null,
        recordTitle: data.recordTitle || '',
        moduleName: data.moduleName || '',
        user: data.user || 'Usuario',
        description: data.description || this._types[type] || '',
        metadata: data.metadata || {},
        date: now()
      };
      try {
        await window.SIGR.StorageService.addActivity(activity);
        this._monitorStorage();
      } catch(e) { console.warn('ActivityService: storage error', e); }
      return activity;
    },
    
    getRecent: async function(limit, offset) {
      try {
        return await window.SIGR.StorageService.getActivity(limit || 50, offset || 0);
      } catch(e) { return []; }
    },
    
    getByRecord: async function(recordId, limit) {
      limit = limit || 100;
      try {
        const all = await window.SIGR.StorageService.getActivity(1000, 0);
        return all.filter(a => a.recordId === recordId).slice(0, limit);
      } catch(e) { return []; }
    },
    
    _monitorStorage: async function() {
      try {
        const count = await window.SIGR.StorageService.getCount('activity');
        if (count > 10000) {
          console.info('ActivityService: historial grande conservado permanentemente', count);
        }
      } catch(e) {}
    },
    
    recordCreated: async (mod, rec) => ActivityService.log('RECORD_CREATED', {
      moduleId: mod.id, recordId: rec.id, recordTitle: rec[mod.titleField]||'(Sin título)',
      moduleName: mod.name, description: `${mod.name}: ${rec[mod.titleField]||'(Sin título)'}`
    }),
    
    movementAdded: async (mod, rec, movement) => ActivityService.log('MOVEMENT_ADDED', {
      moduleId: mod.id, recordId: rec.id, recordTitle: rec[mod.titleField]||'(Sin título)',
      moduleName: mod.name, description: `Movimiento en ${mod.name}: ${movement.description||''}`
    }),
    
    statusChanged: async (mod, rec, oldVal, newVal) => ActivityService.log('STATUS_CHANGED', {
      moduleId: mod.id, recordId: rec.id, recordTitle: rec[mod.titleField]||'(Sin título)',
      moduleName: mod.name,
      description: `Estado cambiado: ${oldVal||'N/A'} → ${newVal}`,
      metadata: { oldValue: oldVal, newValue: newVal }
    }),
    
    fileAttached: async (mod, rec, fileName) => ActivityService.log('FILE_ATTACHED', {
      moduleId: mod.id, recordId: rec.id, recordTitle: rec[mod.titleField]||'(Sin título)',
      moduleName: mod.name, description: `Archivo adjuntado: ${fileName}`
    }),
    
    reminderCreated: async (mod, rec) => ActivityService.log('REMINDER_CREATED', {
      moduleId: mod.id, recordId: rec.id, recordTitle: rec[mod.titleField]||'(Sin título)',
      moduleName: mod.name, description: `Recordatorio creado en ${mod.name}`
    })
  };
  
  window.SIGR.ActivityService = ActivityService;
})();
