(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const RemindersView = {
    render: async function() {
      const [all, today, upcoming, overdue] = await Promise.all([
        window.SIGR.ReminderService.getAll(),
        window.SIGR.ReminderService.getToday(),
        window.SIGR.ReminderService.getUpcoming(30),
        window.SIGR.ReminderService.getOverdue()
      ]);
      
      const todayFilter = (all || []).filter(r => {
        if (r.status === 'cancelled' || r.status === 'completed') return false;
        return r.date === new Date().toISOString().slice(0,10);
      });
      
      const thisWeek = (all || []).filter(r => {
        if (r.status === 'cancelled' || r.status === 'completed') return false;
        const rd = new Date(r.date);
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
        return rd >= now && rd <= weekEnd && r.date !== now.toISOString().slice(0,10);
      });
      
      const stats = {
        total: all.length,
        pending: all.filter(r => r.status === 'pending').length,
        today: todayFilter.length,
        overdue: overdue.length,
        completed: all.filter(r => r.status === 'completed').length,
        sent: all.filter(r => r.status === 'sent').length
      };
      
      return `<div class="view">
        ${topbar('Recordatorios', stats.pending + ' pendientes')}
        
        <div class="reminder-stats-grid">
          <div class="rem-stat-card" data-action="filterReminders" data-filter="today" style="--rc:#9C8CFF">
            <div class="rem-stat-val">${stats.today}</div>
            <div class="rem-stat-label">Hoy</div>
          </div>
          <div class="rem-stat-card" data-action="filterReminders" data-filter="week" style="--rc:#5CA8FF">
            <div class="rem-stat-val">${thisWeek.length}</div>
            <div class="rem-stat-label">Esta semana</div>
          </div>
          <div class="rem-stat-card" data-action="filterReminders" data-filter="overdue" style="--rc:#FB5A7E">
            <div class="rem-stat-val">${stats.overdue}</div>
            <div class="rem-stat-label">Vencidos</div>
          </div>
          <div class="rem-stat-card" data-action="filterReminders" data-filter="completed" style="--rc:#12D68A">
            <div class="rem-stat-val">${stats.completed}</div>
            <div class="rem-stat-label">Completados</div>
          </div>
        </div>
        
        <div class="filter-row" style="padding:4px 20px 12px">
          <button class="chip on" style="--mc:#9C8CFF" data-action="filterReminders" data-filter="all">Todos</button>
          <button class="chip" style="--mc:#9C8CFF" data-action="filterReminders" data-filter="today">Hoy</button>
          <button class="chip" style="--mc:#9C8CFF" data-action="filterReminders" data-filter="week">Semana</button>
          <button class="chip" style="--mc:#9C8CFF" data-action="filterReminders" data-filter="overdue">Vencidos</button>
          <button class="chip" style="--mc:#9C8CFF" data-action="filterReminders" data-filter="urgent">Urgentes</button>
          <button class="chip" style="--mc:#9C8CFF" data-action="filterReminders" data-filter="completed">Completados</button>
        </div>
        
        <div id="reminderList" class="reminder-list-wide">
          ${this._renderList(all)}
        </div>
      </div>`;
    },
    
    _renderList: function(reminders) {
      if (!reminders || reminders.length === 0) {
        return `<div class="empty"><div class="eicon">⏰</div><div class="etitle">Sin recordatorios</div><div class="etext">Crea recordatorios desde cualquier registro del sistema.</div></div>`;
      }
      
      return reminders.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).map(r => `
        <div class="reminder-wide-item" style="border-left-color:${r.color||'#9C8CFF'}">
          <div class="reminder-wide-header">
            <span class="reminder-wide-title">${esc(r.title)}</span>
            <span class="tag status" style="background:${r.status === 'pending' ? '#F5B942' : r.status === 'completed' ? '#12D68A' : r.status === 'sent' ? '#5CA8FF' : '#8D93A8'};font-size:10px">${r.status}</span>
          </div>
          <div class="reminder-wide-meta">
            <span>📅 ${r.date}</span>
            <span>⏰ ${r.time}</span>
            <span>🔁 ${r.frequency}</span>
            <span>🎯 ${r.priority}</span>
          </div>
          ${r.message ? `<div class="reminder-wide-msg">${esc(r.message)}</div>` : ''}
          ${r.recordTitle ? `<div class="reminder-wide-ref">📎 ${esc(r.recordTitle)} ${r.moduleName ? '· ' + esc(r.moduleName) : ''}</div>` : ''}
          <div class="reminder-wide-actions">
            ${r.status !== 'completed' ? `<button class="btn-sm" data-action="completeReminder" data-id="${r.id}">✓ Completar</button>` : ''}
            ${r.status === 'pending' ? `<button class="btn-sm" data-action="snoozeReminder" data-id="${r.id}">⏰ Posponer</button>` : ''}
            <button class="btn-sm" data-action="deleteReminder" data-id="${r.id}" style="color:var(--danger)">✕ Eliminar</button>
          </div>
        </div>`).join('');
    },
    
    filterList: async function(filter) {
      const container = document.getElementById('reminderList');
      if (!container) return;
      
      let reminders = await window.SIGR.ReminderService.getAll();
      const today = new Date().toISOString().slice(0,10);
      
      switch(filter) {
        case 'today':
          reminders = reminders.filter(r => r.date === today && r.status !== 'cancelled' && r.status !== 'completed');
          break;
        case 'week': {
          const now = new Date();
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const endStr = weekEnd.toISOString().slice(0,10);
          reminders = reminders.filter(r => r.date >= today && r.date <= endStr && r.status !== 'cancelled' && r.status !== 'completed');
          break;
        }
        case 'overdue':
          reminders = reminders.filter(r => r.status === 'pending' && r.date < today);
          break;
        case 'urgent':
          reminders = reminders.filter(r => r.status === 'pending' && (r.priority === 'alta' || r.priority === 'urgente'));
          break;
        case 'completed':
          reminders = reminders.filter(r => r.status === 'completed');
          break;
        default:
          reminders = reminders.filter(r => r.status !== 'cancelled');
      }
      
      container.innerHTML = this._renderList(reminders);
    }
  };
  
  window.SIGR.RemindersView = RemindersView;
})();