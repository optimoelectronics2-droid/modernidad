(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const DashboardView = {
    render: function() {
      const state = window.SIGR.StateService.get();
      const today = new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      
      const cards = window.MODULES.map(m => {
        const recs = window.activeRecords(m.id);
        const active = recs.filter(r => !r.archived);
        const last = recs.slice().sort((a,b) => b.updatedAt - a.updatedAt)[0];
        const pend = window.pendingCount(m);
        
        return `<div class="mcard" style="--mc:${m.hex}" data-action="openModule" data-mod="${m.id}">
          <div class="micon">${m.icon}</div>
          <div class="mbody">
            <div class="mname">${m.name}</div>
            <div class="mmeta">
              <span>${active.length} registro${active.length===1?'':'s'}</span>
              ${last ? `<span>· actualizado ${window.relTime(last.updatedAt)}</span>` : ''}
              ${pend > 0 ? `<span class="pulse"></span><span>${pend} pendiente${pend===1?'':'s'}</span>` : ''}
            </div>
          </div>
          <div class="mcount">${active.length}</div>
          <div class="chev">›</div>
        </div>`;
      }).join('');

      const totalRecs = window.MODULES.reduce((sum, m) => sum + window.activeRecords(m.id).filter(r=>!r.archived).length, 0);
      const totalPend = window.MODULES.reduce((sum, m) => sum + window.pendingCount(m), 0);
      
      return `<div class="view">
        ${window.appTopbar('Dashboard', { sub: today, searchVal: state.search||'' })}
        
        <div style="padding:0 16px 12px">
          <div class="dash-stats-row">
            <div class="dash-stat"><span class="dash-stat-val">${totalRecs}</span><span class="dash-stat-label">Registros</span></div>
            <div class="dash-stat"><span class="dash-stat-val">${totalPend}</span><span class="dash-stat-label">Pendientes</span></div>
            <div class="dash-stat"><span class="dash-stat-val">${window.MODULES.length}</span><span class="dash-stat-label">Módulos</span></div>
          </div>
        </div>
        
        <div class="quick-actions">
          <button class="qa-btn" data-action="openFinance"><span class="qa-icon">💰</span><span>Finanzas</span></button>
          <button class="qa-btn" data-action="openAgenda"><span class="qa-icon">📅</span><span>Agenda</span></button>
          <button class="qa-btn" data-action="openVault"><span class="qa-icon">🔐</span><span>Bóveda</span></button>
          <button class="qa-btn" data-action="openActivity"><span class="qa-icon">📊</span><span>Actividad</span></button>
          <button class="qa-btn" data-action="openReminders"><span class="qa-icon">⏰</span><span>Recordatorios</span></button>
          <button class="qa-btn" data-action="openCalendar"><span class="qa-icon">📅</span><span>Calendario</span></button>
          <button class="qa-btn" data-action="openNotificationsCenter"><span class="qa-icon">🔔</span><span>Notificaciones</span></button>
        </div>
        
        <div id="globalResults"></div>
        
        <div class="cards" id="cardsWrap">${cards}</div>
        
        <div class="settings-row">
          <div class="settings-card" data-action="goSettings">
            <div class="si">⚙</div>
            <div class="st">Configuración del sistema</div>
            <div class="chev" style="color:var(--text-faint)">›</div>
          </div>
        </div>
      </div>`;
    }
  };
  
  window.SIGR.DashboardView = DashboardView;
})();