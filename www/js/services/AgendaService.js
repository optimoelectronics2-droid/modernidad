(function(){
  'use strict';
  window.SIGR = window.SIGR || {};

  const EVENT_TYPES = [
    { id: 'payment', label: 'Pago', icon: '\uD83D\uDCB3' },
    { id: 'collection', label: 'Cobro', icon: '\uD83D\uDCB0' },
    { id: 'meeting', label: 'Reuni\u00F3n', icon: '\uD83D\uDCCB' },
    { id: 'appointment', label: 'Cita', icon: '\uD83C\uDFE5' },
    { id: 'birthday', label: 'Cumplea\u00F1os', icon: '\uD83C\uDF82' },
    { id: 'personal', label: 'Personal', icon: '\uD83D\uDC64' },
    { id: 'work', label: 'Trabajo', icon: '\uD83D\uDCBC' },
    { id: 'reminder', label: 'Recordatorio', icon: '\uD83D\uDD14' },
    { id: 'other', label: 'Otro', icon: '\uD83D\uDCCC' }
  ];

  const PRIORITIES = [
    { id: 'low', label: 'Baja', color: '#12D68A' },
    { id: 'normal', label: 'Normal', color: '#5CA8FF' },
    { id: 'high', label: 'Alta', color: '#F5B942' },
    { id: 'urgent', label: 'Urgente', color: '#FF6B6B' }
  ];

  const REMINDER_OPTIONS = [
    { value: 0, label: 'Sin recordatorio' },
    { value: 5, label: '5 min antes' },
    { value: 15, label: '15 min antes' },
    { value: 30, label: '30 min antes' },
    { value: 60, label: '1 hora antes' },
    { value: 1440, label: '1 d\u00EDa antes' }
  ];

  const S = () => window.SIGR.StorageService;

  const AgendaService = {
    getTypes() { return EVENT_TYPES; },
    getPriorities() { return PRIORITIES; },
    getReminderOptions() { return REMINDER_OPTIONS; },

    async addEvent(data) {
      const event = {
        title: data.title,
        type: data.type || 'other',
        priority: data.priority || 'normal',
        date: data.date,
        time: data.time || '',
        reminder: data.reminder || 0,
        location: data.location || '',
        description: data.description || '',
        completed: false
      };
      return S().addAgendaEvent(event);
    },

    async updateEvent(data) {
      const existing = await S().getAgendaEvent(data.id);
      if (!existing) return null;
      Object.assign(existing, {
        title: data.title, type: data.type, priority: data.priority,
        date: data.date, time: data.time, reminder: data.reminder,
        location: data.location, description: data.description
      });
      return S().updateAgendaEvent(existing);
    },

    async deleteEvent(id) { return S().deleteAgendaEvent(id); },
    async getEvent(id) { return S().getAgendaEvent(id); },

    async getEvents(filter) {
      return S().getAllAgendaEvents(filter);
    },

    async getEventsByDate(dateStr) {
      return S().getAllAgendaEvents(e => e.date === dateStr && !e.completed);
    },

    async getUpcoming(limit) {
      const today = new Date().toISOString().slice(0,10);
      const all = await S().getAllAgendaEvents(e => !e.completed);
      return all.filter(e => e.date >= today).slice(0, limit || 10);
    },

    async getEventsByMonth(year, month) {
      const prefix = year + '-' + String(month+1).padStart(2,'0');
      return S().getAllAgendaEvents(e => e.date && e.date.startsWith(prefix));
    },

    async toggleComplete(id) {
      const ev = await S().getAgendaEvent(id);
      if (!ev) return;
      ev.completed = !ev.completed;
      return S().updateAgendaEvent(ev);
    },

    async getTodayCount() {
      const today = new Date().toISOString().slice(0,10);
      const events = await S().getAllAgendaEvents(e => e.date === today && !e.completed);
      return events.length;
    }
  };

  window.SIGR.AgendaService = AgendaService;
})();
