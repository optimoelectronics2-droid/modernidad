(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const NotificationsCenterView = {
    render: async function() {
      const reminders = await window.SIGR.ReminderService.getAll();
      
      const pending = (reminders || []).filter(r => r.status === 'pending');
      const sent = (reminders || []).filter(r => r.status === 'sent');
      const failed = (reminders || []).filter(r => r.status === 'failed');
      const snoozed = (reminders || []).filter(r => r.status === 'snoozed');
      const cancelled = (reminders || []).filter(r => r.status === 'cancelled');
      
      return `<div class="view">
        ${topbar('Centro de notificaciones', pending.length + ' pendientes')}
        
        <div class="notif-stats">
          <div class="notif-stat" data-action="filterNotifs" data-filter="all" style="--nc:#9C8CFF">
            <span class="notif-stat-num">${reminders.length}</span>
            <span class="notif-stat-lbl">Total</span>
          </div>
          <div class="notif-stat" data-action="filterNotifs" data-filter="pending" style="--nc:#F5B942">
            <span class="notif-stat-num">${pending.length}</span>
            <span class="notif-stat-lbl">Pendientes</span>
          </div>
          <div class="notif-stat" data-action="filterNotifs" data-filter="sent" style="--nc:#5CA8FF">
            <span class="notif-stat-num">${sent.length}</span>
            <span class="notif-stat-lbl">Enviadas</span>
          </div>
          <div class="notif-stat" data-action="filterNotifs" data-filter="snoozed" style="--nc:#F5A623">
            <span class="notif-stat-num">${snoozed.length}</span>
            <span class="notif-stat-lbl">Pospuestas</span>
          </div>
          <div class="notif-stat" data-action="filterNotifs" data-filter="cancelled" style="--nc:#8D93A8">
            <span class="notif-stat-num">${cancelled.length}</span>
            <span class="notif-stat-lbl">Canceladas</span>
          </div>
        </div>
        
        <div id="notifList" class="notif-list">
          ${this._renderList(reminders)}
        </div>
      </div>`;
    },
    
    _renderList: function(reminders) {
      if (!reminders || reminders.length === 0) {
        return `<div class="empty"><div class="eicon">🔔</div><div class="etitle">Sin notificaciones</div><div class="etext">Todas las notificaciones aparecerán aquí.</div></div>`;
      }
      
      return reminders.sort((a,b) => b.createdAt - a.createdAt).map(r => `
        <div class="notif-item" style="border-left-color:${r.color||'#9C8CFF'}">
          <div class="notif-header">
            <span class="notif-title">${esc(r.title)}</span>
            <span class="tag status" style="background:${r.status==='pending'?'#F5B942':r.status==='sent'?'#5CA8FF':r.status==='completed'?'#12D68A':r.status==='snoozed'?'#F5A623':'#8D93A8'};font-size:10px">${r.status}</span>
          </div>
          <div class="notif-meta">
            <span>📅 ${r.date}</span>
            <span>⏰ ${r.time}</span>
            <span>📧 ${r.channels ? r.channels.join(', ') : r.channel || 'notificación'}</span>
          </div>
          ${r.message ? `<div class="notif-msg">${esc(r.message)}</div>` : ''}
          ${r.recordTitle ? `<div class="notif-ref">📎 ${esc(r.recordTitle)}${r.moduleName ? ' · ' + esc(r.moduleName) : ''}</div>` : ''}
          ${r.sentAt ? `<div class="notif-sent">✓ Enviado: ${new Date(r.sentAt).toLocaleString('es-ES')}</div>` : ''}
          <div class="notif-actions">
            ${r.status === 'pending' ? `<button class="btn-sm" data-action="completeReminder" data-id="${r.id}">✓ Completar</button>` : ''}
            ${r.status === 'pending' || r.status === 'sent' ? `<button class="btn-sm" data-action="snoozeReminder" data-id="${r.id}">⏰ Posponer</button>` : ''}
            <button class="btn-sm" data-action="deleteReminder" data-id="${r.id}" style="color:var(--danger)">✕</button>
          </div>
        </div>`).join('');
    },
    
    filterList: async function(filter) {
      const container = document.getElementById('notifList');
      if (!container) return;
      
      let reminders = await window.SIGR.ReminderService.getAll();
      
      if (filter !== 'all') {
        reminders = reminders.filter(r => r.status === filter);
      }
      
      container.innerHTML = this._renderList(reminders);
    }
  };
  
  window.SIGR.NotificationsCenterView = NotificationsCenterView;
})();