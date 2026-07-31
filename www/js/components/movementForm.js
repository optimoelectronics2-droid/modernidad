(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const MovementFormComponent = {
    render: function(movement, modId, recId) {
      const isEdit = !!movement;
      const m = movement || {};
      const now = new Date();
      const today = now.toISOString().slice(0,10);
      const timeStr = now.toTimeString().slice(0,5);
      
      return `<div class="modal-over" id="movementModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>${isEdit ? 'Editar movimiento ' + (m.code||'') : 'Nuevo movimiento'}</h3>
            <button class="modal-close" data-action="closeModal">&times;</button>
          </div>
          <div class="modal-body">
            ${this._section('info', 'Información básica', true, `
              <div class="field-row">
                <div class="field">
                  <label>Tipo de movimiento <span class="req">*</span></label>
                  <select id="movType">
                    <option value="general" ${m.type==='general'?'selected':''}>General</option>
                    <option value="retiro_efectivo" ${m.type==='retiro_efectivo'?'selected':''}>💵 Retiro de efectivo</option>
                    <option value="ingreso_efectivo" ${m.type==='ingreso_efectivo'?'selected':''}>💰 Ingreso de efectivo</option>
                    <option value="pago" ${m.type==='pago'?'selected':''}>💳 Pago</option>
                    <option value="cobro" ${m.type==='cobro'?'selected':''}>💵 Cobro</option>
                    <option value="compra" ${m.type==='compra'?'selected':''}>🛒 Compra</option>
                    <option value="venta" ${m.type==='venta'?'selected':''}>📦 Venta</option>
                    <option value="devolucion" ${m.type==='devolucion'?'selected':''}>↩️ Devolución</option>
                    <option value="transferencia" ${m.type==='transferencia'?'selected':''}>🔄 Transferencia</option>
                    <option value="gasto" ${m.type==='gasto'?'selected':''}>📉 Gasto</option>
                    <option value="ingreso" ${m.type==='ingreso'?'selected':''}>📈 Ingreso</option>
                    <option value="nota" ${m.type==='nota'?'selected':''}>📝 Nota interna</option>
                    <option value="incidencia" ${m.type==='incidencia'?'selected':''}>⚠️ Incidencia</option>
                    <option value="documento" ${m.type==='documento'?'selected':''}>📄 Documento</option>
                    <option value="fotografia" ${m.type==='fotografia'?'selected':''}>📸 Fotografía</option>
                    <option value="observacion" ${m.type==='observacion'?'selected':''}>👁 Observación</option>
                    <option value="pendiente" ${m.type==='pendiente'?'selected':''}>📋 Nuevo pendiente</option>
                    <option value="entrega_factura" ${m.type==='entrega_factura'?'selected':''}>🧾 Entrega de factura</option>
                    <option value="devolucion_efectivo" ${m.type==='devolucion_efectivo'?'selected':''}>💵 Devolución de efectivo</option>
                    <option value="cierre" ${m.type==='cierre'?'selected':''}>✅ Cierre</option>
                    <option value="seguimiento" ${m.type==='seguimiento'?'selected':''}>📊 Seguimiento</option>
                    <option value="autorizacion" ${m.type==='autorizacion'?'selected':''}>🔑 Autorización</option>
                    <option value="aprobacion" ${m.type==='aprobacion'?'selected':''}>✅ Aprobación</option>
                  </select>
                </div>
                <div class="field">
                  <label>Estado</label>
                  <select id="movStatus">
                    <option value="">—</option>
                    <option value="pendiente" ${m.status==='pendiente'?'selected':''}>Pendiente</option>
                    <option value="en_proceso" ${m.status==='en_proceso'?'selected':''}>En proceso</option>
                    <option value="completado" ${m.status==='completado'?'selected':''}>Completado</option>
                    <option value="cancelado" ${m.status==='cancelado'?'selected':''}>Cancelado</option>
                    <option value="aprobado" ${m.status==='aprobado'?'selected':''}>✅ Aprobado</option>
                    <option value="rechazado" ${m.status==='rechazado'?'selected':''}>❌ Rechazado</option>
                    <option value="autorizado" ${m.status==='autorizado'?'selected':''}>Autorizado</option>
                    <option value="entregado" ${m.status==='entregado'?'selected':''}>Entregado</option>
                    <option value="recibido" ${m.status==='recibido'?'selected':''}>Recibido</option>
                    <option value="pendiente_comprobante" ${m.status==='pendiente_comprobante'?'selected':''}>Pendiente de comprobante</option>
                    <option value="balanceado" ${m.status==='balanceado'?'selected':''}>Balanceado</option>
                  </select>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label>Prioridad</label>
                  <select id="movPriority">
                    <option value="normal" ${m.priority==='normal'?'selected':''}>Normal</option>
                    <option value="baja" ${m.priority==='baja'?'selected':''}>Baja</option>
                    <option value="media" ${m.priority==='media'?'selected':''}>Media</option>
                    <option value="alta" ${m.priority==='alta'?'selected':''}>Alta</option>
                    <option value="urgente" ${m.priority==='urgente'?'selected':''}>🚨 Urgente</option>
                  </select>
                </div>
                <div class="field">
                  <label>Responsable</label>
                  <input type="text" id="movResponsable" placeholder="Persona responsable" value="${esc(m.responsable||'')}">
                </div>
              </div>
            `)}
            
            ${this._section('datetime', 'Fecha y hora', false, `
              <div class="field-row">
                <div class="field">
                  <label>Fecha</label>
                  <input type="date" id="movDate" value="${m.date ? new Date(m.date).toISOString().slice(0,10) : today}">
                </div>
                <div class="field">
                  <label>Hora</label>
                  <input type="time" id="movTime" value="${m.time||timeStr}">
                </div>
              </div>
              <div class="field">
                <label>Usuario</label>
                <input type="text" id="movUser" placeholder="Usuario que realiza" value="${esc(m.user||'Usuario')}">
              </div>
            `)}
            
            ${this._section('details', 'Descripción y detalles', true, `
              <div class="field">
                <label>Descripción detallada <span class="req">*</span></label>
                <textarea id="movDesc" placeholder="Describe el movimiento detalladamente..." rows="4">${esc(m.description||'')}</textarea>
              </div>
              <div class="field">
                <label>Motivo</label>
                <textarea id="movMotivo" placeholder="Razón o justificación del movimiento..." rows="3">${esc(m.motivo||'')}</textarea>
              </div>
              <div class="field">
                <label>Observaciones</label>
                <textarea id="movObs" placeholder="Notas, observaciones o detalles adicionales..." rows="3">${esc(m.observaciones||'')}</textarea>
              </div>
            `)}
            
            ${this._section('financial', 'Información financiera', false, `
              <div class="field-row">
                <div class="field">
                  <label>Moneda</label>
                  <select id="movCurrency">
                    <option value="RD$" ${m.currency==='RD$'?'selected':''}>RD$ (Pesos Dominicanos)</option>
                    <option value="US$" ${m.currency==='US$'?'selected':''}>US$ (Dólares)</option>
                    <option value="EUR" ${m.currency==='EUR'?'selected':''}>EUR (Euros)</option>
                  </select>
                </div>
                <div class="field">
                  <label>Monto</label>
                  <input type="number" id="movAmount" step="0.01" placeholder="0.00" value="${m.amount||''}">
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label>Cliente relacionado</label>
                  <input type="text" id="movClient" placeholder="Nombre del cliente" value="${esc(m.client||'')}">
                </div>
                <div class="field">
                  <label>Proveedor relacionado</label>
                  <input type="text" id="movProvider" placeholder="Nombre del proveedor" value="${esc(m.provider||'')}">
                </div>
              </div>
            `)}
            
            ${this._section('files', 'Archivos adjuntos', false, `
              <div class="field">
                <label>Archivos generales</label>
                <div class="file-upload-area" data-action="triggerFileUpload" id="movFileAreaGeneral">
                  <span>+ Agregar archivos (cualquier tipo)</span>
                </div>
                <input type="file" id="movFileInput" multiple accept="*/*" style="display:none">
                <div id="movFileList" class="file-list"></div>
              </div>
              <div class="field">
                <label>Fotografías</label>
                <div class="file-upload-area" id="movPhotoArea" data-action="triggerPhotoUpload">
                  <span>📸 + Agregar fotografías</span>
                </div>
                <input type="file" id="movPhotoInput" multiple accept="image/*" style="display:none">
                <div id="movPhotoList" class="file-list"></div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label>PDF</label>
                  <div class="file-upload-area" id="movPdfArea" data-action="triggerPdfUpload">
                    <span>📕 + PDF</span>
                  </div>
                  <input type="file" id="movPdfInput" accept=".pdf" style="display:none">
                  <div id="movPdfList" class="file-list"></div>
                </div>
                <div class="field">
                  <label>Audio</label>
                  <div class="file-upload-area" id="movAudioArea" data-action="triggerAudioUpload">
                    <span>🎵 + Audio</span>
                  </div>
                  <input type="file" id="movAudioInput" accept="audio/*" style="display:none">
                  <div id="movAudioList" class="file-list"></div>
                </div>
              </div>
              <div class="field">
                <label>Video</label>
                <div class="file-upload-area" id="movVideoArea" data-action="triggerVideoUpload">
                  <span>🎬 + Video</span>
                </div>
                <input type="file" id="movVideoInput" accept="video/*" style="display:none">
                <div id="movVideoList" class="file-list"></div>
              </div>
            `)}
            
            ${this._section('signature', 'Firma digital', false, `
              <div class="field">
                <button class="btn-sm" id="movSign" data-action="requestSignature">✍️ ${m.signature ? 'Ver firma' : 'Agregar firma'}</button>
                <div id="movSignaturePreview" style="display:${m.signature?'block':'none'};margin-top:8px;padding:10px;background:var(--elev);border-radius:10px;border:1px solid var(--border)">
                  <img id="movSignatureImg" src="${m.signature||''}" style="max-width:100%;height:auto;display:${m.signature?'block':'none'};border-radius:6px" />
                  <canvas id="sigCanvas" width="280" height="90" style="width:100%;height:90px;border-radius:8px;background:#fff;display:${m.signature?'none':'block'}"></canvas>
                  <button class="btn-sm" data-action="clearSignature" style="margin-top:6px;color:var(--danger)">Limpiar firma</button>
                </div>
              </div>
            `)}
            
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
            <button class="btn btn-primary" data-action="${isEdit ? 'updateMovement' : 'saveMovement'}" style="--mc:#9C8CFF" data-mod="${modId||''}" data-id="${recId||''}" data-mov-id="${m.id||''}">${isEdit ? 'Guardar cambios' : 'Registrar movimiento'}</button>
          </div>
        </div>
      </div>`;
    },
    
    _section: function(id, title, open, content) {
      return `<div class="form-section">
        <div class="form-section-title ${open?'open':''}" data-action="toggleMovSection" data-section="movsec-${id}">
          <span class="fs-label">${title}</span>
          <span class="fs-chev">▼</span>
        </div>
        <div class="form-section-body ${open?'open':''}" id="movsec-${id}">${content}</div>
      </div>`;
    },
    
    collect: function() {
      const data = {};
      const fields = [
        'movType','movStatus','movPriority','movResponsable',
        'movDate','movTime','movUser',
        'movDesc','movMotivo','movObs',
        'movCurrency','movAmount','movClient','movProvider'
      ];
      fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) data[id.replace('mov','').toLowerCase()] = el.value;
      });
      
      const sigCanvas = document.getElementById('sigCanvas');
      const sigImg = document.getElementById('movSignatureImg');
      if (sigCanvas && sigCanvas.style.display !== 'none') {
        data.signature = sigCanvas.toDataURL('image/png');
      } else if (sigImg && sigImg.style.display !== 'none' && sigImg.src) {
        data.signature = sigImg.src;
      }
      
      ['movFileInput','movPhotoInput','movPdfInput','movAudioInput','movVideoInput'].forEach(inputId => {
        const el = document.getElementById(inputId);
        if (el && el.files && el.files.length > 0) {
          const key = inputId.replace('mov','').replace('Input','').toLowerCase() + (inputId === 'movFileInput' ? '' : '_items');
          const finalKey = inputId === 'movFileInput' ? 'files' : 
                          inputId === 'movPhotoInput' ? 'photos' :
                          inputId === 'movPdfInput' ? 'pdfs' :
                          inputId === 'movAudioInput' ? 'audio_items' : 'video_items';
          if (!data[finalKey]) data[finalKey] = [];
          Array.from(el.files).slice(0,5).forEach(f => {
            data[finalKey].push({ name: f.name, type: f.type, size: (f.size/1024).toFixed(1)+'KB' });
          });
        }
      });
      
      return data;
    }
  };
  
  window.SIGR.MovementFormComponent = MovementFormComponent;
})();