(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const ActivityView = {
    render: async function() {
      const activities = await window.SIGR.ActivityService.getRecent(100, 0);
      
      let html = `<div class="view">
        ${topbar('Centro de actividad', activities.length + ' eventos')}
        <div class="activity-wrap">`;
      
      if (activities.length === 0) {
        html += `<div class="empty"><div class="eicon">📊</div><div class="etitle">Sin actividad aún</div><div class="etext">Todas las acciones del sistema aparecerán aquí cronológicamente.</div></div>`;
      } else {
        const grouped = {};
        activities.forEach(a => {
          const label = groupLabel(a.date);
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push(a);
        });
        
        const order = ['Hoy','Ayer','Esta semana','Este mes','Este año','Anteriores'];
        order.forEach(g => {
          if (!grouped[g]) return;
          html += `<div class="date-section"><div class="date-label">${g}</div>`;
          html += grouped[g].map(a => `
            <div class="act-item" ${a.recordId ? `data-action="openDetail" data-mod="${a.moduleId}" data-id="${a.recordId}"` : ''}>
              <div class="act-icon" style="background:${this._iconBg(a.type)}">${this._icon(a.type)}</div>
              <div class="act-body">
                <div class="act-text">${esc(a.description || a.typeLabel)}</div>
                <div class="act-meta">
                  <span>${esc(a.user||'Sistema')}</span>
                  <span>·</span>
                  <span>${relTime(a.date)}</span>
                  ${a.moduleName ? `<span>·</span><span>${esc(a.moduleName)}</span>` : ''}
                </div>
              </div>
              ${a.recordId ? '<div class="chev" style="color:var(--text-faint)">›</div>' : ''}
            </div>`).join('');
          html += `</div>`;
        });
      }
      
      html += `</div></div>`;
      return html;
    },
    
    _icon: function(type) {
      const icons = {
        'RECORD_CREATED': '📄','RECORD_UPDATED': '✏️','RECORD_DELETED': '🗑',
        'RECORD_RESTORED': '↩️','MOVEMENT_ADDED': '📌','FILE_ATTACHED': '📎',
        'COMMENT_ADDED': '💬','STATUS_CHANGED': '🔄','PRIORITY_CHANGED': '⚡',
        'REMINDER_CREATED': '⏰','REMINDER_COMPLETED': '✅','REMINDER_SENT': '🔔',
        'EMAIL_SENT': '📧','NOTIFICATION_SENT': '🔔','RELATION_ADDED': '🔗',
        'SUBRECORD_CREATED': '📋','FAVORITE_TOGGLED': '⭐','ARCHIVE_TOGGLED': '🗄',
        'VERSION_RESTORED': '🕒'
      };
      return icons[type] || '📌';
    },
    
    _iconBg: function(type) {
      const colors = {
        'RECORD_CREATED': 'rgba(18,214,138,0.15)','RECORD_UPDATED': 'rgba(92,168,255,0.15)',
        'RECORD_DELETED': 'rgba(251,90,126,0.15)','MOVEMENT_ADDED': 'rgba(156,140,255,0.15)',
        'FILE_ATTACHED': 'rgba(245,166,35,0.15)','COMMENT_ADDED': 'rgba(245,185,66,0.15)',
        'STATUS_CHANGED': 'rgba(251,90,126,0.15)','EMAIL_SENT': 'rgba(92,168,255,0.15)',
        'NOTIFICATION_SENT': 'rgba(245,166,35,0.15)'
      };
      return colors[type] || 'rgba(255,255,255,0.06)';
    }
  };
  
  window.SIGR.ActivityView = ActivityView;
})();