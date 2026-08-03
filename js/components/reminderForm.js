(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const ReminderFormComponent = {
    render: function(editData) {
      const d = editData || {};
      const channels = d.channels || ['notification'];
      const chk = (v) => channels.includes(v) ? 'checked' : '';
      const adv = d.remindBefore || 0;
      
      return `<div class="modal-over" id="reminderModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>${d.id ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h3>
            <button class="modal-close" data-action="closeModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label>Titulo <span class="req">*</span></label>
              <input type="text" id="remTitle" value="${d.title || ''}" placeholder="ej: Pago pendiente">
            </div>
            <div class="field">
              <label>Mensaje</label>
              <textarea id="remMessage" rows="2" placeholder="Mensaje del recordatorio...">${d.message || ''}</textarea>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Fecha <span class="req">*</span></label>
                <input type="date" id="remDate" value="${d.date || ''}">
              </div>
              <div class="field">
                <label>Hora <span class="req">*</span></label>
                <input type="time" id="remTime" value="${d.time || '09:00'}">
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Avisar antes</label>
                <select id="remAdvance">
                  <option value="0" ${adv===0?'selected':''}>A tiempo (sonar exacto)</option>
                  <option value="5" ${adv===5?'selected':''}>5 minutos antes</option>
                  <option value="10" ${adv===10?'selected':''}>10 minutos antes</option>
                  <option value="15" ${adv===15?'selected':''}>15 minutos antes</option>
                  <option value="30" ${adv===30?'selected':''}>30 minutos antes</option>
                  <option value="60" ${adv===60?'selected':''}>1 hora antes</option>
                  <option value="1440" ${adv===1440?'selected':''}>1 dia antes</option>
                </select>
              </div>
              <div class="field">
                <label>Prioridad</label>
                <select id="remPriority">
                  ${['baja','media','alta','urgente'].map(p =>
                    `<option value="${p}" ${d.priority===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <div class="field">
              <label>Frecuencia</label>
              <select id="remFrequency">
                ${['once','daily','weekly','monthly','annual','custom'].map(f =>
                  `<option value="${f}" ${d.frequency===f?'selected':''}>${
                    {once:'Una vez',daily:'Diario',weekly:'Semanal',monthly:'Mensual',annual:'Anual',custom:'Personalizado'}[f]
                  }</option>`
                ).join('')}
              </select>
            </div>
            <div class="field">
              <label>Canales de notificacion</label>
              <div class="chk-grid">
                <label class="chk-label"><input type="checkbox" class="remChannel" value="notification" ${chk('notification')}> Notificacion local</label>
                <label class="chk-label"><input type="checkbox" class="remChannel" value="email" ${chk('email')}> Correo electronico</label>
                <label class="chk-label"><input type="checkbox" class="remChannel" value="daily_summary" ${chk('daily_summary')}> Resumen diario</label>
                <label class="chk-label"><input type="checkbox" class="remChannel" value="weekly_summary" ${chk('weekly_summary')}> Resumen semanal</label>
                <label class="chk-label"><input type="checkbox" class="remChannel" value="monthly_summary" ${chk('monthly_summary')}> Resumen mensual</label>
                <label class="chk-label"><input type="checkbox" class="remChannel" value="calendar" ${chk('calendar')}> Calendario</label>
              </div>
            </div>
            <div class="field">
              <label>Color</label>
              <div class="color-row" id="remColorRow">
                ${['#9C8CFF','#5CA8FF','#12D68A','#F5B942','#F5A623','#FB5A7E','#FF6B9D','#00D4AA'].map(c =>
                  `<button class="color-opt ${d.color===c?'on':''}" style="background:${c}" data-color="${c}"></button>`
                ).join('')}
              </div>
            </div>
            <div class="field">
              <label>Categoria</label>
              <select id="remCategory">
                <option value="">General</option>
                <option value="pago" ${d.category==='pago'?'selected':''}>Pago</option>
                <option value="compra" ${d.category==='compra'?'selected':''}>Compra</option>
                <option value="pendiente" ${d.category==='pendiente'?'selected':''}>Pendiente</option>
                <option value="cita" ${d.category==='cita'?'selected':''}>Cita</option>
                <option value="vencimiento" ${d.category==='vencimiento'?'selected':''}>Vencimiento</option>
                <option value="seguimiento" ${d.category==='seguimiento'?'selected':''}>Seguimiento</option>
              </select>
            </div>
            <div class="field">
              <label>Observaciones</label>
              <textarea id="remObs" rows="2" placeholder="Notas adicionales...">${d.observations || ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
            <button class="btn btn-primary" data-action="saveReminder" style="--mc:#9C8CFF">${d.id ? 'Actualizar' : 'Crear recordatorio'}</button>
          </div>
        </div>
      </div>`;
    }
  };
  
  window.SIGR.ReminderFormComponent = ReminderFormComponent;
})();
