(function(){
  'use strict';
  window.SIGR = window.SIGR || {};

  const S = () => window.SIGR.AgendaService;
  const esc = s => (s??'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = ts => new Date(ts).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  const fmtTime = ts => new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  const todayStr = () => new Date().toISOString().slice(0,10);

  const AgendaView = {
    _currentMonth: new Date().getMonth(),
    _currentYear: new Date().getFullYear(),
    _tab: 'calendar',

    async render() {
      const state = window.SIGR.StateService.get();
      this._tab = state.agendaTab || 'calendar';
      const events = await S().getEventsByMonth(this._currentYear, this._currentMonth);
      const today = todayStr();
      const dayEvents = await S().getEventsByDate(today);

      const tabs = [
        {id:'calendar', label:'Calendario', icon:'\uD83D\uDCC5'},
        {id:'list', label:'Lista', icon:'\uD83D\uDCCB'},
        {id:'today', label:'Hoy', icon:'\u26A1'}
      ];
      const tabBar = tabs.map(t =>
        '<button class="fin-tab'+(this._tab===t.id?' active':'')+'" data-action="agendaTab" data-tab="'+t.id+'">'+t.icon+' '+esc(t.label)+'</button>'
      ).join('');

      let content = '';
      switch(this._tab) {
        case 'calendar': content = this._renderCalendar(events); break;
        case 'list': content = await this._renderList(); break;
        case 'today': content = this._renderToday(dayEvents); break;
      }

      return '<div class="fin-view">'+
        '<div class="topbar"><button class="back-btn" data-action="back">\u2190</button><div class="topbar-title"><h1>Agenda</h1></div><button class="btn btn-primary btn-sm" data-action="newAgendaEvent" style="margin-right:8px">+ Evento</button></div>'+
        '<div class="fin-tabs">'+tabBar+'</div>'+
        '<div class="fin-content">'+content+'</div></div>';
    },

    _renderCalendar(events) {
      const today = todayStr();
      const firstDay = new Date(this._currentYear, this._currentMonth, 1).getDay();
      const daysInMonth = new Date(this._currentYear, this._currentMonth + 1, 0).getDate();
      const eventMap = {};
      for (const ev of events) {
        if (!ev.completed && ev.date) {
          if (!eventMap[ev.date]) eventMap[ev.date] = [];
          eventMap[ev.date].push(ev);
        }
      }
      let cells = '';
      for (let i = 0; i < firstDay; i++) cells += '<div class="agenda-day empty"></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = this._currentYear+'-'+String(this._currentMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
        const isToday = ds === today;
        const cnt = (eventMap[ds]||[]).length;
        cells += '<div class="agenda-day'+(isToday?' today':'')+'" data-action="agendaSelectDay" data-date="'+ds+'">'+
          '<span class="agenda-day-num">'+d+'</span>'+
          (cnt > 0 ? '<span class="agenda-day-badge">'+cnt+'</span>' : '')+
        '</div>';
      }
      const monthName = new Date(this._currentYear, this._currentMonth).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
      return '<div class="agenda-calendar">'+
        '<div class="agenda-cal-header"><button class="btn btn-sm" data-action="agendaPrev">\u2039</button><span style="font-weight:600;font-size:15px">'+esc(monthName)+'</span><button class="btn btn-sm" data-action="agendaNext">\u203A</button></div>'+
        '<div class="agenda-weekdays">'+['Dom','Lun','Mar','Mi\u00E9','Jue','Vie','S\u00E1b'].map(d=>'<span>'+d+'</span>').join('')+'</div>'+
        '<div class="agenda-grid">'+cells+'</div></div>';
    },

    async _renderList() {
      const all = await S().getEvents(e => !e.completed);
      all.sort((a,b) => (a.date||'') === (b.date||'') ? (a.time||'').localeCompare(b.time||'') : (a.date||'').localeCompare(b.date||''));
      const grouped = {};
      for (const ev of all) {
        const key = ev.date || 'sin-fecha';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ev);
      }
      const today = todayStr();
      let html = '';
      for (const [date, items] of Object.entries(grouped)) {
        const label = date === today ? 'Hoy' : date === 'sin-fecha' ? 'Sin fecha' : fmtDate(new Date(date+'T12:00'));
        html += '<div class="agenda-date-group"><div class="agenda-date-label">'+esc(label)+'</div>';
        for (const ev of items) {
          const type = S().getTypes().find(t => t.id === ev.type) || {icon:'\uD83D\uDCCC',label:'Otro'};
          const pri = S().getPriorities().find(p => p.id === ev.priority) || {color:'#5CA8FF'};
          html += '<div class="agenda-event-card" data-event-id="'+esc(ev.id)+'">'+
            '<div class="agenda-ev-icon" style="background:'+pri.color+'22">'+type.icon+'</div>'+
            '<div class="agenda-ev-info"><div class="agenda-ev-title">'+esc(ev.title)+'</div><div class="agenda-ev-meta">'+esc(type.label)+(ev.time?' \u00B7 '+esc(ev.time):'')+(ev.location?' \u00B7 '+esc(ev.location):'')+'</div></div>'+
            '<div class="agenda-ev-actions"><button class="btn btn-sm" data-action="agendaEditEvent" data-event-id="'+esc(ev.id)+'">\u270F\uFE0F</button><button class="btn btn-sm btn-danger" data-action="agendaDeleteEvent" data-event-id="'+esc(ev.id)+'">\u2716</button></div></div>';
        }
        html += '</div>';
      }
      return '<div class="agenda-list">'+(html||'<div class="empty-small">Sin eventos</div>')+'</div>';
    },

    _renderToday(events) {
      const filtered = events.filter(e => !e.completed);
      const list = filtered.map(ev => {
        const type = S().getTypes().find(t => t.id === ev.type) || {icon:'\uD83D\uDCCC',label:'Otro'};
        const pri = S().getPriorities().find(p => p.id === ev.priority) || {color:'#5CA8FF'};
        return '<div class="agenda-event-card" data-event-id="'+esc(ev.id)+'">'+
          '<div class="agenda-ev-icon" style="background:'+pri.color+'22">'+type.icon+'</div>'+
          '<div class="agenda-ev-info"><div class="agenda-ev-title">'+esc(ev.title)+'</div><div class="agenda-ev-meta">'+esc(type.label)+(ev.time?' \u00B7 '+esc(ev.time):'')+'</div></div>'+
          '<div class="agenda-ev-actions"><button class="btn btn-sm" data-action="agendaEditEvent" data-event-id="'+esc(ev.id)+'">\u270F\uFE0F</button><button class="btn btn-sm" data-action="agendaToggleComplete" data-event-id="'+esc(ev.id)+'" title="Completar">\u2705</button></div></div>';
      }).join('');
      return '<div class="agenda-today"><div class="fin-section-title">Eventos de hoy</div>'+(list||'<div class="empty-small">Sin eventos hoy</div>')+'</div>';
    },

    async _showEventModal(ev) {
      const types = S().getTypes();
      const typeOpts = types.map(t => '<option value="'+t.id+'" '+(ev&&ev.type===t.id?'selected':'')+'>'+t.icon+' '+t.label+'</option>').join('');
      const pris = S().getPriorities();
      const priOpts = pris.map(p => '<option value="'+p.id+'" '+(ev&&ev.priority===p.id?'selected':'')+'>'+p.label+'</option>').join('');
      const rems = S().getReminderOptions();
      const remOpts = rems.map(r => '<option value="'+r.value+'" '+(ev&&ev.reminder==r.value?'selected':'')+'>'+r.label+'</option>').join('');
      const body =
        (ev?'<input type="hidden" id="agendaEventId" value="'+esc(ev.id)+'">':'')+
        '<div class="form-group"><label>T\u00EDtulo</label><input type="text" id="agendaTitle" class="form-input" value="'+(ev?esc(ev.title):'')+'" placeholder="T\u00EDtulo del evento"></div>'+
        '<div class="form-group"><label>Fecha</label><input type="date" id="agendaDate" class="form-input" value="'+(ev?ev.date:todayStr())+'"></div>'+
        '<div class="form-group"><label>Hora</label><input type="time" id="agendaTime" class="form-input" value="'+(ev?esc(ev.time):'')+'" placeholder="--:--"></div>'+
        '<div class="form-group"><label>Tipo</label><select id="agendaType" class="form-input">'+typeOpts+'</select></div>'+
        '<div class="form-group"><label>Prioridad</label><select id="agendaPriority" class="form-input">'+priOpts+'</select></div>'+
        '<div class="form-group"><label>Recordatorio</label><select id="agendaReminder" class="form-input">'+remOpts+'</select></div>'+
        '<div class="form-group"><label>Lugar / URL</label><input type="text" id="agendaLocation" class="form-input" value="'+(ev?esc(ev.location):'')+'" placeholder="Lugar o enlace"></div>'+
        '<div class="form-group"><label>Descripci\u00F3n</label><textarea id="agendaDesc" class="form-input" placeholder="Descripci\u00F3n">'+(ev?esc(ev.description):'')+'</textarea></div>';
      const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-primary" data-action="'+(ev?'agendaUpdateEvent':'agendaSaveEvent')+'">Guardar</button>';
      window.openModal({ title: ev?'Editar Evento':'Nuevo Evento', body, footer });
    },

    async handleAction(el) {
      const action = el.dataset.action;
      switch(action) {
        case 'agendaTab':
          window.SIGR.StateService.set('agendaTab', el.dataset.tab);
          break;
        case 'agendaPrev':
          this._currentMonth--;
          if (this._currentMonth < 0) { this._currentMonth = 11; this._currentYear--; }
          window.SIGR.StateService.notify();
          break;
        case 'agendaNext':
          this._currentMonth++;
          if (this._currentMonth > 11) { this._currentMonth = 0; this._currentYear++; }
          window.SIGR.StateService.notify();
          break;
        case 'agendaSelectDay':
          window.SIGR.StateService.set('agendaTab', 'list');
          window.SIGR.StateService.set('agendaFilterDate', el.dataset.date);
          break;
        case 'newAgendaEvent':
          this._showEventModal(null);
          break;
        case 'agendaSaveEvent': {
          const title = document.getElementById('agendaTitle')?.value;
          if (!title) { window.showToast('Ingresa un t\u00EDtulo'); return; }
          await S().addEvent({
            title, type: document.getElementById('agendaType')?.value,
            priority: document.getElementById('agendaPriority')?.value,
            date: document.getElementById('agendaDate')?.value,
            time: document.getElementById('agendaTime')?.value,
            reminder: parseInt(document.getElementById('agendaReminder')?.value) || 0,
            location: document.getElementById('agendaLocation')?.value,
            description: document.getElementById('agendaDesc')?.value
          });
          window.closeModal(); window.showToast('Evento creado'); window.SIGR.StateService.notify();
          break;
        }
        case 'agendaEditEvent': {
          const ev = await S().getEvent(el.dataset.eventId);
          if (ev) this._showEventModal(ev);
          break;
        }
        case 'agendaUpdateEvent': {
          const eventId = document.getElementById('agendaEventId')?.value;
          if (!eventId) { window.showToast('Error: ID de evento no encontrado'); return; }
          const title = document.getElementById('agendaTitle')?.value;
          if (!title) { window.showToast('Ingresa un t\u00EDtulo'); return; }
          await S().updateEvent({
            id: eventId, title,
            type: document.getElementById('agendaType')?.value,
            priority: document.getElementById('agendaPriority')?.value,
            date: document.getElementById('agendaDate')?.value,
            time: document.getElementById('agendaTime')?.value,
            reminder: parseInt(document.getElementById('agendaReminder')?.value) || 0,
            location: document.getElementById('agendaLocation')?.value,
            description: document.getElementById('agendaDesc')?.value
          });
          window.closeModal(); window.showToast('Evento actualizado'); window.SIGR.StateService.notify();
          break;
        }
        case 'agendaDeleteEvent':
          window.showConfirm('Eliminar evento?', 'Eliminar', async () => {
            await S().deleteEvent(el.dataset.eventId);
            window.showToast('Evento eliminado'); window.SIGR.StateService.notify();
          });
          break;
        case 'agendaToggleComplete':
          await S().toggleComplete(el.dataset.eventId);
          window.SIGR.StateService.notify();
          break;
      }
    }
  };

  window.SIGR.AgendaView = AgendaView;
})();
