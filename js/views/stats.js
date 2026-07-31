(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const StatsView = {
    render: function() {
      const state = window.SIGR.StateService.get();
      const m = modOf(state.moduleId);
      if (!m) return '<div class="empty">Módulo no encontrado</div>';
      
      const recs = activeRecords(m.id);
      const active = recs.filter(r => !r.archived);
      const fav = recs.filter(r => r.favorite).length;
      const arch = recs.filter(r => r.archived).length;
      const trashN = (DB[m.id] || []).filter(r => r.deleted).length;
      
      let extra = '';
      const statusF = m.fields.find(f => f.statusField);
      if (statusF) {
        const counts = {};
        statusF.options.forEach(o => counts[o] = 0);
        active.forEach(r => { if (r[statusF.key] && counts[r[statusF.key]] !== undefined) counts[r[statusF.key]]++; });
        const max = Math.max(1, ...Object.values(counts));
        extra = `<div class="stat-card wide"><div class="sl" style="margin-bottom:2px">Distribución por ${statusF.label.toLowerCase()}</div>
          ${statusF.options.map(o => `
            <div class="stat-bar-row">
              <span class="sbl">${o}</span>
              <span class="stat-bar-bg"><span class="stat-bar-fill" style="width:${(counts[o]/max*100)||0}%;background:${STATUS_COLORS[o]||m.hex}"></span></span>
              <span class="sbn">${counts[o]}</span>
            </div>`).join('')}
        </div>`;
      }
      
      let moneyCard = '';
      if (m.id === 'pagos') {
        const total = active.reduce((s, r) => s + (Number(r.monto)||0), 0);
        const pend = active.filter(r => r.estado === 'Pendiente' || r.estado === 'Vencido').reduce((s, r) => s + (Number(r.monto)||0), 0);
        moneyCard = `<div class="stat-card"><div class="sv">$${total.toLocaleString()}</div><div class="sl">Monto total</div></div>
          <div class="stat-card"><div class="sv">$${pend.toLocaleString()}</div><div class="sl">Monto pendiente/vencido</div></div>`;
      }
      
      const latest = active.slice().sort((a,b) => b.updatedAt - a.updatedAt).slice(0,5);
      
      return `<div class="view" style="--mc:${m.hex}">
        ${topbar('Estadísticas', m.name)}
        <div class="stats-grid">
          <div class="stat-card"><div class="sv">${active.length}</div><div class="sl">Registros activos</div></div>
          <div class="stat-card"><div class="sv">${fav}</div><div class="sl">Favoritos</div></div>
          <div class="stat-card"><div class="sv">${arch}</div><div class="sl">Archivados</div></div>
          <div class="stat-card"><div class="sv">${trashN}</div><div class="sl">En papelera</div></div>
          ${moneyCard}
          ${extra}
        </div>
        
        ${latest.length > 0 ? `
        <div style="padding:0 20px 30px">
          <div class="date-label" style="margin:8px 4px">Últimos registros modificados</div>
          ${latest.map(r => {
            const title = r[m.titleField] || '(Sin título)';
            return `<div class="rec" style="--mc:${m.hex}" data-action="openDetail" data-mod="${m.id}" data-id="${r.id}">
              <div class="rdot"></div>
              <div class="rbody">
                <div class="rtitle">${esc(title)}</div>
              </div>
              <div class="rtime">${relTime(r.updatedAt)}</div>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;
    }
  };
  
  window.SIGR.StatsView = StatsView;
})();