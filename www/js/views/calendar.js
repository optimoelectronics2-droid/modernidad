(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const CalendarView = {
    _currentMonth: new Date().getMonth(),
    _currentYear: new Date().getFullYear(),
    _viewMode: 'month',
    
    render: async function() {
      this._viewMode = 'month';
      const reminders = await window.SIGR.ReminderService.getAll();
      const activeReminders = (reminders || []).filter(r => r.status === 'pending' || r.status === 'sent');
      
      return `<div class="view">
        ${topbar('Calendario', null)}
        <div class="cal-controls">
          <button class="cal-nav" data-action="calPrev">‹</button>
          <span class="cal-title">${this._monthName()} ${this._currentYear}</span>
          <button class="cal-nav" data-action="calNext">›</button>
        </div>
        <div class="cal-weekdays">
          ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="cal-grid" id="calGrid">
          ${this._renderMonthGrid(activeReminders)}
        </div>
        <div id="calEvents" class="cal-events">
          ${this._renderDayEvents(new Date(), activeReminders)}
        </div>
      </div>`;
    },
    
    _monthName: function() {
      return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][this._currentMonth];
    },
    
    _renderMonthGrid: function(reminders) {
      const year = this._currentYear;
      const month = this._currentMonth;
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date().toISOString().slice(0,10);
      
      const reminderMap = {};
      (reminders || []).forEach(r => {
        if (!reminderMap[r.date]) reminderMap[r.date] = [];
        reminderMap[r.date].push(r);
      });
      
      let cells = '';
      for (let i = 0; i < firstDay; i++) {
        cells += `<div class="cal-cell cal-empty"></div>`;
      }
      
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = dateStr === today;
        const dayReminders = reminderMap[dateStr] || [];
        const count = dayReminders.length;
        
        cells += `<div class="cal-cell ${isToday ? 'cal-today' : ''} ${count > 0 ? 'cal-has-events' : ''}" data-date="${dateStr}" data-action="calSelectDay">
          <span class="cal-day-num">${d}</span>
          ${count > 0 ? `<span class="cal-dot" style="background:${dayReminders[0].color||'#9C8CFF'}"></span>` : ''}
          ${count > 1 ? `<span class="cal-count">+${count}</span>` : ''}
        </div>`;
      }
      
      return cells;
    },
    
    _renderDayEvents: function(date, reminders) {
      const dateStr = date.toISOString().slice(0,10);
      const dayReminders = (reminders || []).filter(r => r.date === dateStr);
      const dayName = date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
      
      let html = `<div class="cal-day-header">📅 ${dayName}</div>`;
      
      if (dayReminders.length === 0) {
        html += `<div class="cal-no-events">Sin eventos este día</div>`;
      } else {
        html += dayReminders.sort((a,b) => a.time.localeCompare(b.time)).map(r => `
          <div class="cal-event-item" style="border-left-color:${r.color||'#9C8CFF'}">
            <div class="cal-event-time">${r.time}</div>
            <div class="cal-event-body">
              <div class="cal-event-title">${esc(r.title)}</div>
              ${r.message ? `<div class="cal-event-desc">${esc(r.message)}</div>` : ''}
              ${r.recordTitle ? `<div class="cal-event-ref">📎 ${esc(r.recordTitle)}</div>` : ''}
              <span class="tag status" style="background:${r.status==='pending'?'#F5B942':r.status==='completed'?'#12D68A':'#8D93A8'};font-size:10px">${r.status}</span>
            </div>
          </div>`).join('');
      }
      
      return html;
    },
    
    navigate: async function(direction) {
      if (direction === 'prev') {
        this._currentMonth--;
        if (this._currentMonth < 0) { this._currentMonth = 11; this._currentYear--; }
      } else {
        this._currentMonth++;
        if (this._currentMonth > 11) { this._currentMonth = 0; this._currentYear++; }
      }
      
      const reminders = await window.SIGR.ReminderService.getAll();
      const active = (reminders || []).filter(r => r.status === 'pending' || r.status === 'sent');
      
      const grid = document.getElementById('calGrid');
      if (grid) grid.innerHTML = this._renderMonthGrid(active);
      
      const title = document.querySelector('.cal-title');
      if (title) title.textContent = `${this._monthName()} ${this._currentYear}`;
      
      const events = document.getElementById('calEvents');
      if (events) events.innerHTML = this._renderDayEvents(new Date(this._currentYear, this._currentMonth, 1), active);
    },
    
    selectDay: async function(dateStr) {
      const reminders = await window.SIGR.ReminderService.getAll();
      const active = (reminders || []).filter(r => r.status === 'pending' || r.status === 'sent');
      const date = new Date(dateStr + 'T12:00:00');
      
      document.querySelectorAll('.cal-cell.cal-selected').forEach(el => el.classList.remove('cal-selected'));
      const cell = document.querySelector(`[data-date="${dateStr}"]`);
      if (cell) cell.classList.add('cal-selected');
      
      const events = document.getElementById('calEvents');
      if (events) events.innerHTML = this._renderDayEvents(date, active);
      
      events.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  
  window.SIGR.CalendarView = CalendarView;
})();