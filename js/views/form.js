(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  let _sectionsState = {};
  
  const FormView = {
    render: function() {
      const state = window.SIGR.StateService.get();
      const m = modOf(state.moduleId);
      if (!m) return '<div class="empty">Módulo no encontrado</div>';
      
      const editing = !!state.recordId;
      const rec = editing ? (DB[m.id] || []).find(r => r.id === state.recordId) : {};
      _sectionsState = {};
      
      const mainFields = m.fields.map(f => fieldHtml(m, f, rec[f.key])).join('');
      
      return `<div class="view" style="--mc:${m.hex}">
        ${topbar(editing ? 'Editar expediente' : 'Nuevo expediente', m.name)}
        <div class="form-wrap" id="formWrap">
          ${this._section('📋', 'Información principal', true, mainFields)}
          ${this._section('👤', 'Asignación y empresa', false, `
            <div class="field-row">
              <div class="field"><label>Responsable</label><input type="text" id="fAssignedTo" placeholder="Persona asignada" value="${rec.assignedTo||''}"></div>
              <div class="field"><label>Creado por</label><input type="text" id="fCreatedBy" placeholder="Creado por" value="${rec.createdBy||'Usuario'}"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Empresa</label><input type="text" id="fEmpresa" placeholder="Empresa" value="${rec.empresa||''}"></div>
              <div class="field"><label>Sucursal</label><input type="text" id="fSucursal" placeholder="Sucursal" value="${rec.sucursal||''}"></div>
            </div>
          `)}
          ${this._section('🏷️', 'Etiquetas y color', false, `
            <div class="field"><label>Color</label><div class="color-row" id="fColorRow">${['#9C8CFF','#5CA8FF','#12D68A','#F5B942','#F5A623','#FB5A7E','#FF6B9D','#00D4AA','#845EC2','#FF6F00'].map(c => `<button class="color-opt ${rec.color===c?'on':''}" style="background:${c}" data-color="${c}"></button>`).join('')}</div></div>
            <div class="field"><label>Etiquetas</label><input type="text" id="fEtiquetas" placeholder="ej: urgente, cliente, seguimiento" value="${rec.etiquetas||''}"></div>
          `)}
          ${this._section('📝', 'Notas adicionales', false, `
            <div class="field"><label>Observaciones</label><textarea id="fObservaciones" rows="2" placeholder="Notas públicas...">${rec.observaciones||''}</textarea></div>
            <div class="field"><label>Notas privadas 🔒</label><textarea id="fPrivateNotes" rows="2" placeholder="Solo visible para ti...">${rec.privateNotes||''}</textarea></div>
          `)}
          ${this._section('📊', 'Seguimiento', false, `
            <div class="field-row">
              <div class="field"><label>Estado interno</label><select id="fFollowStatus">
                ${['Abierto','En seguimiento','En espera','Finalizado','Cancelado'].map(v => `<option value="${v}" ${rec.followStatus===v?'selected':''}>${v}</option>`).join('')}
              </select></div>
              <div class="field"><label>Próxima acción</label><input type="text" id="fNextAction" placeholder="Ej: llamar, confirmar, revisar" value="${rec.nextAction||''}"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Fecha de seguimiento</label><input type="date" id="fFollowDate" value="${rec.followDate||''}"></div>
              <div class="field"><label>Hora</label><input type="time" id="fFollowTime" value="${rec.followTime||'09:00'}"></div>
            </div>
          `)}
          ${this._section('⏰', 'Recordatorios', false, `
            <div class="field"><label class="toggle-row">
              <span>Crear recordatorio al guardar</span>
              <input type="checkbox" id="fCreateReminder" ${rec.createReminder?'checked':''}>
              <span class="toggle-track"></span>
            </label></div>
            <div class="field"><label>Mensaje del recordatorio</label><textarea id="fReminderMessage" rows="2" placeholder="Mensaje de seguimiento...">${rec.reminderMessage||''}</textarea></div>
          `)}
          ${this._section('📎', 'Archivos y comentarios', false, `
            <div class="field"><label>Referencia de archivos</label><input type="text" id="fFileReference" placeholder="Ej: factura pendiente, contrato, foto de entrega" value="${rec.fileReference||''}"></div>
            <div class="field"><label>Comentario inicial</label><textarea id="fInitialComment" rows="2" placeholder="Comentario que quedará en el expediente...">${rec.initialComment||''}</textarea></div>
          `)}
          ${this._section('📍', 'Ubicación GPS', false, `
            <div class="field"><label>Dirección / Coordenadas</label><div style="display:flex;gap:8px"><input type="text" id="fGps" placeholder="Lat, Lng o dirección..." value="${rec.gps ? rec.gps.lat+', '+rec.gps.lng : ''}" style="flex:1"><button class="btn-sm" data-action="getFormGps" style="flex-shrink:0">📍 Obtener</button></div></div>
          `)}
          ${this._section('⚙', 'Configuración', false, `
            <div class="field-row">
              <div class="field"><label>Código</label><input type="text" id="fCode" value="${rec.code||''}" placeholder="Auto-generado"></div>
              <div class="field"><label>Visibilidad</label><select id="fVisibility">
                ${['Normal','Privado','Equipo','Archivado'].map(v => `<option value="${v}" ${rec.visibility===v?'selected':''}>${v}</option>`).join('')}
              </select></div>
            </div>
          `)}
        </div>
        <div class="save-bar">
          <button class="btn btn-ghost" data-action="back">Cancelar</button>
          <button class="btn btn-primary" data-action="saveRecord" data-mod="${m.id}" data-id="${editing ? rec.id : ''}">${editing ? 'Guardar cambios' : 'Crear expediente'}</button>
        </div>
      </div>`;
    },
    
    _section: function(icon, title, open, content) {
      const id = 'sec-' + title.replace(/\s+/g,'').toLowerCase();
      _sectionsState[id] = open;
      return `<div class="form-section">
        <div class="form-section-title ${open?'open':''}" data-action="toggleFormSection" data-section="${id}">
          <span class="fs-icon">${icon}</span>
          <span class="fs-label">${title}</span>
          <span class="fs-chev">▼</span>
        </div>
        <div class="form-section-body ${open?'open':''}" id="${id}">${content}</div>
      </div>`;
    },
    
    toggleSection: function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      const title = el.previousElementSibling;
      if (el.classList.contains('open')) {
        el.classList.remove('open');
        if (title) title.classList.remove('open');
      } else {
        el.classList.add('open');
        if (title) title.classList.add('open');
      }
    },
    
    collectAll: function() {
      const wrap = document.getElementById('formWrap');
      const data = {};
      wrap.querySelectorAll('[data-key]').forEach(el => { data[el.dataset.key] = el.value; });
      
      const extra = ['fAssignedTo','fCreatedBy','fEmpresa','fSucursal','fEtiquetas','fObservaciones','fPrivateNotes','fGps','fFollowStatus','fNextAction','fFollowDate','fFollowTime','fReminderMessage','fFileReference','fInitialComment','fCode','fVisibility'];
      extra.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const key = id.replace(/^f/,'').replace(/^./, c => c.toLowerCase());
          data[key] = el.value;
        }
      });
      
      const colorRow = document.getElementById('fColorRow');
      if (colorRow) {
        const active = colorRow.querySelector('.color-opt.on');
        if (active) data.color = active.dataset.color;
      }
      const createReminder = document.getElementById('fCreateReminder');
      if (createReminder) data.createReminder = createReminder.checked;
      
      const gpsField = document.getElementById('fGps');
      if (gpsField && gpsField.value.trim()) {
        const parts = gpsField.value.split(',').map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          data.gps = { lat: parts[0], lng: parts[1] };
        }
      }
      
      return data;
    }
  };
  
  window.SIGR.FormView = FormView;
})();
