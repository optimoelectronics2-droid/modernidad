(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const TABS = [
    { id: 'info', label: 'Info', icon: 'ℹ️' },
    { id: 'movements', label: 'Movimientos', icon: '📌' },
    { id: 'activity', label: 'Actividad', icon: '📊' },
    { id: 'files', label: 'Archivos', icon: '📎' },
    { id: 'comments', label: 'Comentarios', icon: '💬' },
    { id: 'reminders', label: 'Recordatorios', icon: '⏰' },
    { id: 'relations', label: 'Relaciones', icon: '🔗' },
    { id: 'history', label: 'Historial', icon: '📋' },
    { id: 'versions', label: 'Versiones', icon: '🕒' },
    { id: 'settings', label: 'Config.', icon: '⚙️' }
  ];
  
  const SidePanelComponent = {
    TABS: TABS,
    
    renderTabs: function(activeTab) {
      return `<div class="sp-tabs" id="detailTabs">
        ${TABS.map(t => `
          <button class="sp-tab ${t.id === activeTab ? 'on' : ''}" data-action="setDetailTab" data-tab="${t.id}">
            <span class="sp-tab-icon">${t.icon}</span>
            <span class="sp-tab-label">${t.label}</span>
          </button>
        `).join('')}
      </div>`;
    },
    
    renderInfoTab: function(mod, rec) {
      const title = rec[mod.titleField] || '(Sin título)';
      const statusF = mod.fields.find(f => f.statusField);
      const priF = mod.fields.find(f => f.type === 'priority');
      const fields = mod.fields.filter(f => f.key !== mod.titleField && f.type !== 'textarea');
      const textFields = mod.fields.filter(f => f.type === 'textarea');
      
      let html = `<div class="detail-title">${esc(title)}</div>`;
      
      let badges = '';
      if (statusF && rec[statusF.key]) badges += `<span class="tag status" style="background:${STATUS_COLORS[rec[statusF.key]]||'#666'};font-size:12px;padding:5px 12px">${esc(rec[statusF.key])}</span>`;
      if (priF && rec[priF.key]) badges += `<span class="tag" style="font-size:12px;padding:5px 12px;background:${PRI_COLORS[rec[priF.key]]||'#666'};color:#fff">${esc(rec[priF.key])} prioridad</span>`;
      if (rec.favorite) badges += `<span class="tag" style="font-size:12px;padding:5px 12px;color:var(--warn);background:rgba(245,185,66,0.15)">★ Favorito</span>`;
      if (rec.color) badges += `<span class="tag" style="font-size:12px;padding:5px 12px;background:${rec.color}33;color:${rec.color}">●</span>`;
      if (badges) html += `<div class="detail-badges">${badges}</div>`;
      
      const rows = fields.filter(f => rec[f.key]).map(f =>
        `<div class="detail-field"><span class="dl">${f.label}</span><span class="dv">${f.key === 'monto' ? '$' + Number(rec[f.key]).toLocaleString() : esc(rec[f.key])}</span></div>`
      ).join('');
      if (rows) html += `<div class="detail-box">${rows}</div>`;
      
      textFields.filter(f => rec[f.key]).forEach(f => {
        html += `<div class="date-label" style="margin:16px 4px 8px">${f.label}</div><div class="detail-content">${nl2br(rec[f.key])}</div>`;
      });
      
      if (rec.observaciones) {
        html += `<div class="date-label" style="margin:16px 4px 8px">Observaciones</div><div class="detail-content">${nl2br(rec.observaciones)}</div>`;
      }
      if (rec.privateNotes) {
        html += `<div class="date-label" style="margin:16px 4px 8px;color:var(--warn)">🔒 Notas privadas</div><div class="detail-content" style="background:rgba(245,185,66,0.06);border-color:rgba(245,185,66,0.2)">${nl2br(rec.privateNotes)}</div>`;
      }
      
      if (rec.gps) {
        html += `<div class="detail-field"><span class="dl">📍 Ubicación</span><span class="dv">${rec.gps.lat}, ${rec.gps.lng}</span></div>`;
      }
      
      html += `<div class="detail-box" style="margin-top:16px">
        <div class="detail-field"><span class="dl">Código</span><span class="dv" style="font-family:monospace">${rec.code || '—'}</span></div>
        <div class="detail-field"><span class="dl">Creado por</span><span class="dv">${rec.createdBy || 'Usuario'}</span></div>
        <div class="detail-field"><span class="dl">Responsable</span><span class="dv">${rec.assignedTo || '—'}</span></div>
        <div class="detail-field"><span class="dl">Creado</span><span class="dv">${fmtDate(rec.createdAt)} · ${fmtTime(rec.createdAt)}</span></div>
        <div class="detail-field"><span class="dl">Última modificación</span><span class="dv">${fmtDate(rec.updatedAt)} · ${fmtTime(rec.updatedAt)}</span></div>
        ${rec.empresa ? `<div class="detail-field"><span class="dl">Empresa</span><span class="dv">${esc(rec.empresa)}</span></div>` : ''}
        ${rec.sucursal ? `<div class="detail-field"><span class="dl">Sucursal</span><span class="dv">${esc(rec.sucursal)}</span></div>` : ''}
      </div>`;
      
      return html;
    }
  };
  
  window.SIGR.SidePanelComponent = SidePanelComponent;
})();