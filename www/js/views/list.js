(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const ListView = {
    render: async function() {
      const state = window.SIGR.StateService.get();
      const m = modOf(state.moduleId);
      if (!m) return '<div class="empty"><div class="eicon">⚠️</div><div class="etitle">Módulo no encontrado</div></div>';
      
      let movements = [];
      try { movements = await window.SIGR.StorageService.getAllMovements(m.id, 5000, 0); } catch(e) {}
      const movementCounts = movements.reduce((acc, mov) => {
        acc[mov.recordId] = (acc[mov.recordId] || 0) + 1;
        return acc;
      }, {});
      (DB[m.id] || []).forEach(r => { r._movementCount = movementCounts[r.id] || 0; });
      
      const recs = this._currentFiltered(m, state, movements);
      
      let groups = {};
      let order = [];
      if (state.filter !== 'trash') {
        recs.forEach(r => {
          const g = groupLabel(r.updatedAt);
          if (!groups[g]) { groups[g] = []; order.push(g); }
          groups[g].push(r);
        });
      } else {
        groups['Papelera'] = recs;
        order = ['Papelera'];
      }
      const glOrder = ['Hoy','Ayer','Esta semana','Este mes','Este año','Anteriores','Papelera'];
      order.sort((a,b) => glOrder.indexOf(a) - glOrder.indexOf(b));
      
      let body = '';
      if (recs.length === 0) {
        const msgs = {
          all: ['📭','Este módulo está vacío','Pulsa el botón + para crear tu primer registro.'],
          fav: ['⭐','Sin favoritos','Marca registros como favoritos para verlos aquí.'],
          archived: ['🗄','Sin archivados','Los registros que archives aparecerán aquí.'],
          trash: ['🗑','Papelera vacía','Los registros eliminados aparecerán aquí por seguridad.']
        };
        const [icon,title,text] = msgs[state.filter] || msgs.all;
        body = `<div class="empty"><div class="eicon">${icon}</div><div class="etitle">${title}</div><div class="etext">${text}</div></div>`;
      } else {
        body = order.map(g => `
          <div class="date-section"><div class="date-label">${g === 'Papelera' ? 'Elementos eliminados' : g}</div>
          ${groups[g].map(r => this._recordCard(m, r)).join('')}</div>
        `).join('');
      }
      
      const chips = [
        {k:'all',l:'Todos'},{k:'fav',l:'★ Favoritos'},{k:'archived',l:'Archivados'},{k:'trash',l:'Papelera'}
      ].map(c => `<button class="chip ${state.filter===c.k?'on':''}" style="--mc:${m.hex}" data-action="setFilter" data-f="${c.k}">${c.l}</button>`).join('');
      
      return `<div class="view" style="--mc:${m.hex}">
        ${topbar(m.name, recs.length + ' registro' + (recs.length===1?'':'s'),
          `<button class="icon-btn" data-action="openStats" data-mod="${m.id}">📊</button>`)}
        <div class="search-wrap" style="margin:0 20px 12px">
          <span class="s-icon">🔍</span>
          <input id="modSearch" type="text" placeholder="Buscar registros y movimientos..." value="${esc(state.search||'')}">
        </div>
        <div class="filter-row">${chips}</div>
        ${body}
        ${state.filter !== 'trash' ? `<div class="fab" style="--mc:${m.hex}" data-action="newRecord" data-mod="${m.id}">+</div>` : ''}
      </div>`;
    },
    
    _currentFiltered: function(m, state, movements) {
      let recs = (DB[m.id] || []).slice();
      if (state.filter === 'trash') recs = recs.filter(r => r.deleted);
      else {
        recs = recs.filter(r => !r.deleted);
        if (state.filter === 'fav') recs = recs.filter(r => r.favorite && !r.archived);
        else if (state.filter === 'archived') recs = recs.filter(r => r.archived);
        else recs = recs.filter(r => !r.archived);
      }
      if (state.search && state.search.trim()) {
        const q = state.search.trim().toLowerCase();
        recs = recs.filter(r => {
          const recordHay = [
            ...m.fields.map(f => r[f.key]),
            r.code, r.createdBy, r.assignedTo, r.empresa, r.sucursal,
            r.observaciones, r.privateNotes, r.etiquetas,
            r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-ES') : '',
            r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) : ''
          ].filter(Boolean).join(' ').toLowerCase();
          const movementHit = (movements || []).some(mov => {
            if (mov.recordId !== r.id) return false;
            const d = new Date(mov.date || mov.createdAt || Date.now());
            const movementHay = [
              mov.description, mov.comment, mov.observaciones, mov.amount,
              mov.user, mov.status, mov.priority, mov.category, mov.subcategory,
              mov.client, mov.provider, mov.type, mov.location,
              d.toLocaleDateString('es-ES'),
              d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})
            ].filter(Boolean).join(' ').toLowerCase();
            return movementHay.includes(q);
          });
          return recordHay.includes(q) || movementHit;
        });
      }
      recs.sort((a,b) => b.updatedAt - a.updatedAt);
      return recs;
    },
    
    _recordCard: function(m, r) {
      const title = r[m.titleField] || '(Sin título)';
      const preview = r[m.previewField] || '';
      const statusF = m.fields.find(f => f.statusField);
      const statusVal = statusF ? r[statusF.key] : null;
      const priF = m.fields.find(f => f.type === 'priority');
      const priVal = priF ? r[priF.key] : null;
      const tags = (r.etiquetas||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,3);
      const movementCount = r._movementCount || 0;
      
      let metaHtml = '';
      if (statusVal) metaHtml += `<span class="tag status" style="background:${STATUS_COLORS[statusVal]||'#666'}">${esc(statusVal)}</span>`;
      if (priVal) metaHtml += `<span class="tag status" style="background:${PRI_COLORS[priVal]||'#666'}">${esc(priVal)}</span>`;
      tags.forEach(t => metaHtml += `<span class="tag">#${esc(t)}</span>`);
      if (m.id === 'pagos' && r.monto) metaHtml += `<span class="tag" style="color:var(--c-pagos)">$${Number(r.monto).toLocaleString()}</span>`;
      if (movementCount > 0) metaHtml += `<span class="tag" style="background:rgba(156,140,255,0.15);color:var(--c-personal)">${movementCount} mov.</span>`;
      
      return `<div class="rec" style="--mc:${m.hex}" data-action="openDetail" data-mod="${m.id}" data-id="${r.id}">
        <div class="rdot"></div>
        <div class="rbody">
          <div class="rtitle">${r.favorite?'<span class="fav">★</span>':''}${esc(title)}</div>
          ${preview ? `<div class="rprev">${esc(preview)}</div>` : ''}
          ${metaHtml ? `<div class="rmeta">${metaHtml}</div>` : ''}
        </div>
        <div class="rtime">${relTime(r.updatedAt)}</div>
      </div>`;
    }
  };
  
  window.SIGR.ListView = ListView;
})();
