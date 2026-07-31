(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const TYPE_ICONS = {
    'general':'📌','retiro_efectivo':'💵','ingreso_efectivo':'💰',
    'pago':'💳','cobro':'💵','compra':'🛒','venta':'📦',
    'devolucion':'↩️','transferencia':'🔄','gasto':'📉','ingreso':'📈',
    'nota':'📝','incidencia':'⚠️','documento':'📄','fotografia':'📸',
    'observacion':'👁','pendiente':'📋','entrega_factura':'🧾',
    'devolucion_efectivo':'💵','cierre':'✅','seguimiento':'📊',
    'autorizacion':'🔑','aprobacion':'✅'
  };
  
  const TYPE_COLORS = {
    'retiro_efectivo':'#FB5A7E','ingreso_efectivo':'#12D68A',
    'pago':'#F5A623','cobro':'#12D68A','compra':'#5CA8FF',
    'venta':'#9C8CFF','devolucion':'#F5B942','transferencia':'#5CA8FF',
    'gasto':'#FB5A7E','ingreso':'#12D68A','nota':'#8D93A8',
    'incidencia':'#FB5A7E','documento':'#5CA8FF','fotografia':'#9C8CFF',
    'observacion':'#F5B942','pendiente':'#F5A623','entrega_factura':'#5CA8FF',
    'devolucion_efectivo':'#12D68A','cierre':'#12D68A','seguimiento':'#9C8CFF',
    'autorizacion':'#FB5A7E','aprobacion':'#12D68A'
  };
  
  const STATUS_BADGES = {
    'pendiente':['Pendiente','#F5B942'],
    'en_proceso':['En proceso','#5CA8FF'],
    'completado':['Completado','#12D68A'],
    'cancelado':['Cancelado','#FB5A7E'],
    'aprobado':['Aprobado','#12D68A'],
    'rechazado':['Rechazado','#FB5A7E'],
    'autorizado':['Autorizado','#9C8CFF'],
    'entregado':['Entregado','#5CA8FF'],
    'recibido':['Recibido','#12D68A'],
    'pendiente_comprobante':['Pendiente comprobante','#F5B942'],
    'balanceado':['Balanceado','#12D68A']
  };
  
  function typeIcon(type) { return TYPE_ICONS[type] || '📌'; }
  function typeColor(type) { return TYPE_COLORS[type] || '#9C8CFF'; }
  
  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  }
  function relTime(ts) {
    if (!ts) return '';
    const diff = Date.now()-ts, m=Math.floor(diff/60000), h=Math.floor(m/60);
    if(m<1) return 'ahora';
    if(m<60) return m+' min';
    if(h<24) return h+' h';
    return fmtDate(ts);
  }
  function esc(s) { return (s??'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  
  const TimelineComponent = {
    render: function(items, opts) {
      opts = opts || {};
      const emptyText = opts.emptyText || 'Sin movimientos registrados';
      const compact = opts.compact || false;
      
      if (!items || items.length === 0) {
        return `<div class="tl-empty">${emptyText}</div>`;
      }
      
      let html = `<div class="timeline ${compact?'tl-compact':''}">`;
      
      items.forEach((item, idx) => {
        const isLast = idx === items.length - 1;
        html += this._renderCard(item, isLast, opts);
      });
      
      html += '</div>';
      return html;
    },
    
    _renderCard: function(item, isLast, opts) {
      const m = item.movement || item;
      const code = m.code || ('#' + (item.id || '').slice(-6));
      const dateStr = m.date ? fmtDate(m.date) + ' · ' + (m.time || fmtTime(m.date)) : '';
      const icon = m.type ? typeIcon(m.type) : '📌';
      const color = m.type ? typeColor(m.type) : '#9C8CFF';
      const statusInfo = STATUS_BADGES[m.status] || null;
      const priorityColors = { 'baja':'#5CA8FF','media':'#F5B942','alta':'#FB5A7E','urgente':'#FB5A7E' };
      const priColor = priorityColors[m.priority] || '';
      
      const hasDetail = m.motivo || m.observaciones || m.client || m.provider || 
                        m.responsable || (m.files && m.files.length) || 
                        (m.photos && m.photos.length) || (m.pdfs && m.pdfs.length) ||
                        (m.audio_items && m.audio_items.length) || (m.video_items && m.video_items.length) ||
                        m.signature || m.amount;
      
      return `<div class="tl-item" data-mov-id="${esc(m.id||'')}">
        <div class="tl-dot" style="background:${color}20;border:2px solid ${color};color:${color}">${icon}</div>
        ${isLast ? '' : `<div class="tl-line" style="background:${color}20"></div>`}
        <div class="tl-card" style="border-left:3px solid ${color}">
          <div class="tl-card-header">
            <div class="tl-card-code">
              <span class="tl-code">${esc(code)}</span>
              <span class="tl-datetime">${esc(dateStr)}</span>
            </div>
            <div class="tl-card-badges">
              ${m.priority && priColor ? `<span class="tl-pri-badge" style="background:${priColor}20;color:${priColor}">${esc(m.priority)}</span>` : ''}
              ${statusInfo ? `<span class="tl-status-badge" style="background:${statusInfo[1]}20;color:${statusInfo[1]}">${esc(statusInfo[0])}</span>` : ''}
            </div>
          </div>
          
          <div class="tl-card-summary">
            ${m.description ? `<div class="tl-card-desc">${esc(m.description)}</div>` : ''}
            ${m.amount ? `<div class="tl-card-amount" style="color:${color}">${esc(m.currency||'')} ${Number(m.amount).toLocaleString()}</div>` : ''}
          </div>
          
          <div class="tl-card-meta">
            ${m.user ? `<span class="tl-meta-item">👤 ${esc(m.user)}</span>` : ''}
            ${m.responsable ? `<span class="tl-meta-item">📋 ${esc(m.responsable)}</span>` : ''}
            ${m.client ? `<span class="tl-meta-item">👤 Cliente: ${esc(m.client)}</span>` : ''}
            ${m.provider ? `<span class="tl-meta-item">🏭 Prov: ${esc(m.provider)}</span>` : ''}
            ${(m.files&&m.files.length) || (m.photos&&m.photos.length) || (m.pdfs&&m.pdfs.length) ? `<span class="tl-meta-item">📎 ${(m.files||[]).length+(m.photos||[]).length+(m.pdfs||[]).length} archivos</span>` : ''}
            <span class="tl-meta-item tl-reltime">${relTime(m.date||m.createdAt)}</span>
          </div>
          
          ${hasDetail ? `
          <div class="tl-card-extra" id="tlExtra-${esc(m.id||'')}" style="display:none">
            ${m.motivo ? `<div class="tl-extra-row"><strong>Motivo:</strong> ${esc(m.motivo)}</div>` : ''}
            ${m.observaciones ? `<div class="tl-extra-row"><strong>Observaciones:</strong> ${esc(m.observaciones)}</div>` : ''}
            ${m.currency && m.amount ? `<div class="tl-extra-row"><strong>Monto:</strong> ${esc(m.currency)} ${Number(m.amount).toLocaleString()}</div>` : ''}
            ${m.client ? `<div class="tl-extra-row"><strong>Cliente:</strong> ${esc(m.client)}</div>` : ''}
            ${m.provider ? `<div class="tl-extra-row"><strong>Proveedor:</strong> ${esc(m.provider)}</div>` : ''}
            ${m.responsable ? `<div class="tl-extra-row"><strong>Responsable:</strong> ${esc(m.responsable)}</div>` : ''}
            ${m.location ? `<div class="tl-extra-row"><strong>Ubicación:</strong> ${esc(m.location)}</div>` : ''}
            
            ${m.files && m.files.length ? `<div class="tl-extra-row"><strong>Archivos:</strong><div class="tl-card-files">${m.files.map(f => `<span class="tl-card-file">📄 ${esc(f.name)}</span>`).join('')}</div></div>` : ''}
            ${m.photos && m.photos.length ? `<div class="tl-extra-row"><strong>Fotografías:</strong><div class="tl-card-files">${m.photos.map(f => `<span class="tl-card-file">📸 ${esc(f.name)}</span>`).join('')}</div></div>` : ''}
            ${m.pdfs && m.pdfs.length ? `<div class="tl-extra-row"><strong>PDF:</strong><div class="tl-card-files">${m.pdfs.map(f => `<span class="tl-card-file">📕 ${esc(f.name)}</span>`).join('')}</div></div>` : ''}
            ${m.audio_items && m.audio_items.length ? `<div class="tl-extra-row"><strong>Audio:</strong><div class="tl-card-files">${m.audio_items.map(f => `<span class="tl-card-file">🎵 ${esc(f.name)}</span>`).join('')}</div></div>` : ''}
            ${m.video_items && m.video_items.length ? `<div class="tl-extra-row"><strong>Video:</strong><div class="tl-card-files">${m.video_items.map(f => `<span class="tl-card-file">🎬 ${esc(f.name)}</span>`).join('')}</div></div>` : ''}
            ${m.signature ? `<div class="tl-extra-row"><strong>Firma:</strong> <span class="tl-card-file">✍️ Firmado</span></div>` : ''}
            ${m.changeHistory && m.changeHistory.length ? `<div class="tl-extra-row"><strong>Historial de cambios:</strong> ${m.changeHistory.length} modificación(es)</div>` : ''}
          </div>
          
          <div class="tl-card-actions">
            <button class="tl-btn tl-btn-expand" data-action="toggleMovDetails" data-mov-id="${esc(m.id||'')}">▼ Ver detalles</button>
            <button class="tl-btn" data-action="editMovement" data-mov-id="${esc(m.id||'')}">✎ Editar</button>
            <button class="tl-btn" data-action="printMovement" data-mov-id="${esc(m.id||'')}">🖨 Imprimir</button>
            <button class="tl-btn tl-btn-danger" data-action="deleteMovement" data-mov-id="${esc(m.id||'')}">🗑</button>
          </div>` : `
          <div class="tl-card-actions">
            <button class="tl-btn" data-action="editMovement" data-mov-id="${esc(m.id||'')}">✎ Editar</button>
            <button class="tl-btn" data-action="printMovement" data-mov-id="${esc(m.id||'')}">🖨 Imprimir</button>
            <button class="tl-btn tl-btn-danger" data-action="deleteMovement" data-mov-id="${esc(m.id||'')}">🗑</button>
          </div>`}
          
          <div class="tl-card-footer">
            <span class="tl-card-user">👤 ${esc(m.user||'Usuario')}</span>
            <span class="tl-card-updated">${m.updatedAt ? 'Modificado: ' + relTime(m.updatedAt) : ''}</span>
          </div>
        </div>
      </div>`;
    },
    
    renderSimple: function(items, opts) {
      opts = opts || {};
      const emptyText = opts.emptyText || 'Sin actividad';
      if (!items || items.length === 0) {
        return `<div class="tl-empty">${emptyText}</div>`;
      }
      let html = '<div class="timeline tl-compact">';
      items.forEach((item, idx) => {
        const isLast = idx === items.length - 1;
        const date = item.date ? fmtDate(item.date) + ' ' + (item.time || fmtTime(item.date)) : '';
        const desc = item.description || item.typeLabel || '';
        html += `<div class="tl-item">
          <div class="tl-dot" style="background:rgba(156,140,255,0.15);border:2px solid #9C8CFF;color:#9C8CFF;width:32px;height:32px;font-size:12px">${item.typeIcon || (item.type==='RECORD_CREATED'?'📝':'📌')}</div>
          ${isLast ? '' : '<div class="tl-line"></div>'}
          <div class="tl-content">
            <div class="tl-header"><span class="tl-time">${date}</span><span class="tl-type" style="color:#9C8CFF">${esc(item.typeLabel||'')}</span></div>
            <div class="tl-text">${esc(desc)}</div>
          </div>
        </div>`;
      });
      html += '</div>';
      return html;
    }
  };
  
  window.SIGR.TimelineComponent = TimelineComponent;
})();