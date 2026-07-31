(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const DetailView = {
    _cache: { movements: null, activity: null },
    
    render: async function() {
      const state = window.SIGR.StateService.get();
      const m = modOf(state.moduleId);
      if (!m) { back(); return ''; }
      
      const r = (DB[m.id] || []).find(x => x.id === state.recordId);
      if (!r) { back(); return ''; }
      
      this._cache = { movements: null, activity: null };
      
      const tab = state.detailTab || 'info';
      let tabContent = '';
      
      switch(tab) {
        case 'info': tabContent = window.SIGR.SidePanelComponent.renderInfoTab(m, r); break;
        case 'movements': tabContent = await this._renderMovementsTab(m, r); break;
        case 'activity': tabContent = await this._renderActivityTab(m, r); break;
        case 'files': tabContent = this._renderFilesTab(r); break;
        case 'comments': tabContent = this._renderCommentsTab(r); break;
        case 'reminders': tabContent = await this._renderRemindersTab(m, r); break;
        case 'relations': tabContent = await this._renderRelationsTab(m, r); break;
        case 'history': tabContent = await this._renderHistoryTab(m, r); break;
        case 'versions': tabContent = await this._renderVersionsTab(m, r); break;
        case 'settings': tabContent = this._renderSettingsTab(m, r); break;
      }
      
      const title = r[m.titleField] || '(Sin título)';
      const statusF = m.fields.find(f=>f.statusField);
      const statusVal = statusF ? r[statusF.key] : null;
      
      let actions = r.deleted ? `
        <div class="detail-hero">
          <div class="detail-hero-title">${esc(title)}</div>
          <div class="detail-hero-meta">
            ${statusVal ? `<span class="tag status" style="background:${STATUS_COLORS[statusVal]||'#666'}">${esc(statusVal)}</span>` : ''}
            ${r.code ? `<span class="tag">${esc(r.code)}</span>` : ''}
            ${r.favorite ? '<span class="tag" style="color:var(--warn)">★ Favorito</span>' : ''}
          </div>
        </div>
        <div class="detail-actions">
          <button class="dact" data-action="restoreRecord" data-mod="${m.id}" data-id="${r.id}"><span class="di">↩</span>Restaurar</button>
          <button class="dact danger" data-action="permaDelete" data-mod="${m.id}" data-id="${r.id}"><span class="di">✕</span>Eliminar definitivo</button>
        </div>` : `
        <div class="detail-hero">
          <div class="detail-hero-title">${esc(title)}</div>
          <div class="detail-hero-meta">
            ${statusVal ? `<span class="tag status" style="background:${STATUS_COLORS[statusVal]||'#666'}">${esc(statusVal)}</span>` : ''}
            ${r.code ? `<span class="tag">${esc(r.code)}</span>` : ''}
            ${r.favorite ? '<span class="tag" style="color:var(--warn)">★ Favorito</span>' : ''}
          </div>
        </div>
        <div class="detail-actions">
          <button class="dact" data-action="editRecord" data-mod="${m.id}" data-id="${r.id}"><span class="di">✎</span>Editar</button>
          <button class="dact" data-action="addMovement" data-mod="${m.id}" data-id="${r.id}"><span class="di">📌</span>Movimiento</button>
          <button class="dact" data-action="addReminderNow" data-mod="${m.id}" data-id="${r.id}"><span class="di">⏰</span>Recordatorio</button>
        </div>
        <div class="detail-actions" style="margin-top:6px">
          <button class="dact" data-action="toggleFav" data-mod="${m.id}" data-id="${r.id}"><span class="di">${r.favorite?'★':'☆'}</span>${r.favorite?'Quitar fav.':'Favorito'}</button>
          <button class="dact" data-action="toggleArchive" data-mod="${m.id}" data-id="${r.id}"><span class="di">🗄</span>${r.archived?'Desarchivar':'Archivar'}</button>
          <button class="dact danger" data-action="deleteRecord" data-mod="${m.id}" data-id="${r.id}"><span class="di">🗑</span>Eliminar</button>
        </div>`;
      
      return `<div class="view" style="--mc:${m.hex}">
        ${topbar(m.name, null)}
        <div class="detail-wrap">
          ${window.SIGR.SidePanelComponent.renderTabs(tab)}
          <div id="detailTabContent" class="detail-tab-content">${tabContent}</div>
          ${actions}
        </div>
        <div id="detailModalContainer"></div>
      </div>`;
    },
    
    _renderMovementsTab: async function(m, r) {
      try {
        const movements = await window.SIGR.StorageService.getMovements(r.id);
        this._cache.movements = movements;
        
        let html = `<div class="mov-actions-bar">
          <button class="dact" data-action="addMovement" data-mod="${m.id}" data-id="${r.id}" style="flex:1"><span class="di">📌</span>Nuevo movimiento</button>
          <button class="dact" data-action="deleteAllMovements" data-mod="${m.id}" data-id="${r.id}" style="flex:0 0 auto;min-width:50px;color:var(--danger)" title="Eliminar todos los movimientos"><span class="di">🗑</span></button>
        </div>`;
        
        if (!movements || movements.length === 0) {
          html += `<div class="empty"><div class="eicon">📭</div><div class="etitle">Bitácora vacía</div><div class="etext">Agrega el primer movimiento para iniciar el historial del expediente.</div></div>`;
        } else {
          html += `<div class="mov-stats-bar">
            <span class="mov-stat"><strong>${movements.length}</strong> movimiento${movements.length===1?'':'s'}</span>
            <span class="mov-stat"><strong>${movements.filter(m => m.status==='completado'||m.status==='balanceado'||m.status==='aprobado').length}</strong> completados</span>
            <span class="mov-stat"><strong>${movements.filter(m => m.amount).reduce((s,m) => s+Number(m.amount||0), 0).toLocaleString()}</strong> total ${movements[0]?.currency||'RD$'}</span>
          </div>`;
          html += window.SIGR.TimelineComponent.render(movements, { emptyText: 'Sin movimientos registrados' });
        }
        return html;
      } catch(e) {
        console.warn('Movements load error:', e);
        return `<div class="empty"><div class="eicon">⚠️</div><div class="etitle">Error al cargar movimientos</div><div class="etext">${esc(e.message)}</div></div>`;
      }
    },
    
    _renderActivityTab: async function(m, r) {
      try {
        const activity = await window.SIGR.ActivityService.getByRecord(r.id, 50);
        const items = activity.map(a => ({
          id: a.id, date: a.date, type: a.type,
          typeLabel: a.typeLabel, description: a.description,
          user: a.user, metadata: a.metadata
        }));
        return window.SIGR.TimelineComponent.renderSimple(items, { emptyText: 'Sin actividad registrada' });
      } catch(e) {
        return `<div class="empty"><div class="eicon">⚠️</div></div>`;
      }
    },
    
    _renderFilesTab: function(r) {
      const files = r.attachments || [];
      let html = `<div class="detail-actions" style="margin-bottom:16px">
        <button class="dact" data-action="attachFile" data-mod="${window.SIGR.StateService.get().moduleId}" data-id="${r.id}" style="flex:1"><span class="di">📎</span>Adjuntar archivo</button>
      </div>`;
      if (files.length === 0) {
        html += `<div class="empty"><div class="eicon">📁</div><div class="etitle">Sin archivos</div><div class="etext">Adjunta imágenes, PDF, Word, Excel, audio o video.</div></div>`;
      } else {
        html += `<div class="file-grid">${files.map(f => `
          <div class="file-card">
            <div class="file-icon">${this._fileIcon(f.type)}</div>
            <div class="file-name">${esc(f.name)}</div>
            <div class="file-meta">${f.size || ''}</div>
          </div>`).join('')}</div>`;
      }
      return html;
    },
    
    _fileIcon: function(type) {
      if (!type) return '📄';
      if (type.startsWith('image/')) return '🖼️';
      if (type.includes('pdf')) return '📕';
      if (type.includes('word') || type.includes('doc')) return '📘';
      if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return '📗';
      if (type.includes('audio') || type.includes('mp3') || type.includes('wav')) return '🎵';
      if (type.includes('video') || type.includes('mp4')) return '🎬';
      return '📄';
    },
    
    _renderCommentsTab: function(r) {
      const comments = r.comments || [];
      let html = `<div class="comment-input-wrap">
        <textarea id="newComment" placeholder="Escribe un comentario (Ctrl+Enter para enviar)..." rows="2"></textarea>
        <button class="btn btn-primary" data-action="addComment" data-mod="${window.SIGR.StateService.get().moduleId}" data-id="${r.id}" style="--mc:#9C8CFF;padding:12px 20px;flex:0 0 auto">Enviar</button>
      </div>`;
      if (comments.length === 0) {
        html += `<div class="empty" style="padding:30px"><div class="eicon">💬</div><div class="etitle">Sin comentarios</div></div>`;
      } else {
        html += `<div class="comment-list">${comments.sort((a,b)=>b.date-a.date).map(c => `
          <div class="comment-item">
            <div class="comment-header"><strong>${esc(c.user||'Usuario')}</strong><span class="comment-time">${relTime(c.date)}</span></div>
            <div class="comment-text">${esc(c.text)}</div>
          </div>`).join('')}</div>`;
      }
      return html;
    },
    
    _renderRemindersTab: async function(m, r) {
      let reminders = [];
      try { reminders = await window.SIGR.ReminderService.getByRecord(r.id); } catch(e) {}
      let html = `<div class="detail-actions" style="margin-bottom:16px">
        <button class="dact" data-action="addReminderNow" data-mod="${m.id}" data-id="${r.id}" style="flex:1"><span class="di">⏰</span>Crear recordatorio</button>
      </div>`;
      if (reminders.length === 0) {
        html += `<div class="empty"><div class="eicon">⏰</div><div class="etitle">Sin recordatorios</div></div>`;
      } else {
        html += `<div class="reminder-list">${reminders.map(rem => `
          <div class="reminder-item" style="border-left-color:${rem.color||'#9C8CFF'}">
            <div class="reminder-title">${esc(rem.title)}</div>
            <div class="reminder-meta">
              <span>📅 ${rem.date}</span><span>⏰ ${rem.time}</span>
              <span class="tag status" style="background:${rem.status==='pending'?'#F5B942':rem.status==='completed'?'#12D68A':'#8D93A8'};font-size:10px">${rem.status}</span>
            </div>
            ${rem.message ? `<div class="reminder-msg">${esc(rem.message)}</div>` : ''}
            <div class="reminder-actions">
              <button class="btn-sm" data-action="completeReminder" data-id="${rem.id}">✓ Completar</button>
              <button class="btn-sm" data-action="snoozeReminder" data-id="${rem.id}">⏰ Posponer</button>
              <button class="btn-sm" data-action="deleteReminder" data-id="${rem.id}" style="color:var(--danger)">×</button>
            </div>
          </div>`).join('')}</div>`;
      }
      return html;
    },
    
    _renderRelationsTab: async function(m, r) {
      let relations = [];
      try { relations = await window.SIGR.StorageService.getRelations(r.id); } catch(e) {}
      let html = `<div class="detail-actions" style="margin-bottom:16px">
        <button class="dact" data-action="addRelation" data-mod="${m.id}" data-id="${r.id}" style="flex:1"><span class="di">🔗</span>Relacionar registro</button>
      </div>`;
      if (relations.length === 0) {
        html += `<div class="empty"><div class="eicon">🔗</div><div class="etitle">Sin relaciones</div></div>`;
      } else {
        html += `<div class="relation-list">${relations.map(rel => `
          <div class="relation-item">
            <span class="relation-icon">🔗</span>
            <div class="relation-body">
              <div class="relation-title">${esc(rel.targetTitle||'Registro relacionado')}</div>
              <div class="relation-type">${esc(rel.type||'Relación')}</div>
            </div>
            <button class="btn-sm" data-action="removeRelation" data-id="${rel.id}" style="color:var(--danger)">×</button>
          </div>`).join('')}</div>`;
      }
      return html;
    },
    
    _renderHistoryTab: async function(m, r) {
      let audit = [];
      try { audit = await window.SIGR.AuditService.getByRecord(r.id, 100); } catch(e) {}
      if (audit.length === 0) {
        return `<div class="empty"><div class="eicon">📋</div><div class="etitle">Historial vacío</div></div>`;
      }
      return `<div class="audit-list">${audit.map(a => `
        <div class="audit-item">
          <div class="audit-header">
            <span class="audit-action">${esc(a.action)}</span>
            <span class="audit-time">${relTime(a.date)}</span>
          </div>
          <div class="audit-user">${esc(a.user)}</div>
          ${a.field ? `<div class="audit-field">Campo: ${esc(a.field)}</div>` : ''}
          ${a.description ? `<div class="audit-desc">${esc(a.description)}</div>` : ''}
          ${a.oldValue !== null && a.newValue !== null ? `<div class="audit-values"><span class="audit-old">${esc(a.oldValue)}</span><span class="audit-arrow">→</span><span class="audit-new">${esc(a.newValue)}</span></div>` : ''}
        </div>`).join('')}</div>`;
    },
    
    _renderVersionsTab: async function(m, r) {
      let versions = [];
      try { versions = await window.SIGR.StorageService.getVersions(r.id); } catch(e) {}
      if (versions.length === 0) {
        return `<div class="empty"><div class="eicon">🕒</div><div class="etitle">Sin versiones guardadas</div></div>`;
      }
      return `<div class="version-list">${versions.map((v, i) => `
        <div class="version-item">
          <div class="version-header">
            <span class="version-num">${esc(v.label || 'Versión #' + (versions.length - i))}</span>
            <span class="version-time">${fmtDate(v.date)} · ${fmtTime(v.date)}</span>
          </div>
          <button class="btn-sm" data-action="restoreVersion" data-ver-id="${v.id}" data-mod="${m.id}" data-id="${r.id}">↩ Restaurar</button>
        </div>`).join('')}</div>`;
    },
    
    _renderSettingsTab: function(m, r) {
      return `<div class="detail-box" style="margin-top:0">
        <div class="field"><label>Código único</label><input type="text" id="recCode" value="${r.code || ''}" placeholder="Auto-generado"></div>
        <div class="field"><label>Color</label><div class="color-row" id="recColorRow">${['#9C8CFF','#5CA8FF','#12D68A','#F5B942','#F5A623','#FB5A7E','#FF6B9D','#00D4AA','#845EC2','#FF6F00'].map(c => `<button class="color-opt ${r.color===c?'on':''}" style="background:${c}" data-color="${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Empresa</label><input type="text" id="recEmpresa" value="${r.empresa || ''}" placeholder="Nombre de la empresa"></div>
        <div class="field"><label>Sucursal</label><input type="text" id="recSucursal" value="${r.sucursal || ''}" placeholder="Sucursal o departamento"></div>
        <div class="field"><label>Responsable</label><input type="text" id="recAssignedTo" value="${r.assignedTo || ''}" placeholder="Persona asignada"></div>
        <div class="field"><label>Notas privadas 🔒</label><textarea id="recPrivateNotes" rows="3" placeholder="Notas visibles solo para ti...">${r.privateNotes || ''}</textarea></div>
        <button class="btn btn-primary" data-action="saveRecordSettings" data-mod="${m.id}" data-id="${r.id}" style="--mc:${m.hex};margin-top:8px">Guardar configuración</button>
      </div>`;
    },
    
    refreshTab: async function() {
      const container = document.getElementById('detailTabContent');
      if (!container) return;
      const state = window.SIGR.StateService.get();
      const m = modOf(state.moduleId);
      const r = (DB[m.id] || []).find(x => x.id === state.recordId);
      if (!m || !r) return;
      const tab = state.detailTab || 'info';
      let content = '';
      switch(tab) {
        case 'movements': content = await this._renderMovementsTab(m, r); break;
        case 'activity': content = await this._renderActivityTab(m, r); break;
        case 'reminders': content = await this._renderRemindersTab(m, r); break;
        default: break;
      }
      if (content) container.innerHTML = content;
    }
  };
  
  window.SIGR.DetailView = DetailView;
})();