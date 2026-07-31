(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  function uid() { return 'rem-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function today() { return new Date().toISOString().slice(0,10); }
  
  const FREQUENCIES = ['once','daily','weekly','monthly','annual','custom'];
  const CHANNELS = ['notification','email','daily_summary','weekly_summary','monthly_summary','calendar'];
  const STATUSES = ['pending','sent','completed','failed','snoozed','cancelled'];
  
  const ReminderService = {
    FREQUENCIES: FREQUENCIES,
    CHANNELS: CHANNELS,
    STATUSES: STATUSES,
    
    create: async function(data) {
      const reminder = {
        id: uid(),
        moduleId: data.moduleId,
        recordId: data.recordId,
        recordTitle: data.recordTitle || '',
        moduleName: data.moduleName || '',
        title: data.title || 'Recordatorio',
        message: data.message || '',
        date: data.date || today(),
        time: data.time || '09:00',
        priority: data.priority || 'media',
        type: data.type || 'general',
        frequency: data.frequency || 'once',
        channel: data.channel || ['notification'],
        channels: data.channels || ['notification'],
        status: 'pending',
        color: data.color || '#9C8CFF',
        category: data.category || '',
        observations: data.observations || '',
        snoozedUntil: null,
        sentAt: null,
        completedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      try {
        await window.SIGR.StorageService.addReminder(reminder);
        await window.SIGR.ActivityService.reminderCreated(
          { id: data.moduleId, name: data.moduleName || '' },
          { id: data.recordId, titleField: 'title', [data.recordId ? 'title' : '']: data.recordTitle || '' }
        );
      } catch(e) { console.warn('ReminderService: create error', e); }
      
      this._scheduleNotification(reminder);
      this._scheduleEmail(reminder);
      
      return reminder;
    },
    
    update: async function(reminder) {
      reminder.updatedAt = Date.now();
      try {
        await window.SIGR.StorageService.updateReminder(reminder);
      } catch(e) { console.warn('ReminderService: update error', e); }
    },
    
    complete: async function(id) {
      const reminders = await this.getAll();
      const r = reminders.find(x => x.id === id);
      if (!r) return;
      window.SIGR.NotificationService.cancelByReminderId(id);
      r.status = 'completed';
      r.completedAt = Date.now();
      await this.update(r);
      return r;
    },
    
    snooze: async function(id, minutes) {
      const reminders = await this.getAll();
      const r = reminders.find(x => x.id === id);
      if (!r) return;
      r.status = 'snoozed';
      r.snoozedUntil = Date.now() + (minutes || 10) * 60000;
      await this.update(r);
      setTimeout(() => {
        r.status = 'pending';
        r.snoozedUntil = null;
        this.update(r);
        this._scheduleNotification(r);
      }, (minutes || 10) * 60000);
      return r;
    },
    
    cancel: async function(id) {
      const reminders = await this.getAll();
      const r = reminders.find(x => x.id === id);
      if (!r) return;
      window.SIGR.NotificationService.cancelByReminderId(id);
      r.status = 'cancelled';
      await this.update(r);
      return r;
    },
    
    delete: async function(id) {
      window.SIGR.NotificationService.cancelByReminderId(id);
      try { await window.SIGR.StorageService.deleteReminder(id); }
      catch(e) { console.warn('ReminderService: delete error', e); }
    },
    
    getAll: async function(filter) {
      try { return await window.SIGR.StorageService.getAllReminders(filter); }
      catch(e) { return []; }
    },
    
    getPending: async function() {
      return this.getAll(r => r.status === 'pending' || r.status === 'snoozed');
    },
    
    getToday: async function() {
      const d = today();
      return this.getAll(r => {
        if (r.status === 'cancelled' || r.status === 'completed') return false;
        if (r.date === d) return true;
        if (r.frequency === 'daily') return true;
        if (r.frequency === 'weekly') {
          const rd = new Date(r.date);
          const now = new Date();
          return rd.getDay() === now.getDay();
        }
        if (r.frequency === 'monthly') {
          const rd = new Date(r.date);
          const now = new Date();
          return rd.getDate() === now.getDate();
        }
        return false;
      });
    },
    
    getUpcoming: async function(days) {
      days = days || 7;
      const now = new Date();
      now.setHours(0,0,0,0);
      const end = new Date(now.getTime() + days*86400000);
      return this.getAll(r => {
        if (r.status === 'cancelled' || r.status === 'completed') return false;
        const rd = new Date(r.date + 'T' + (r.time || '09:00'));
        return rd >= now && rd <= end;
      });
    },
    
    getOverdue: async function() {
      const now = new Date().toISOString().slice(0,10);
      return this.getAll(r => {
        if (r.status !== 'pending') return false;
        return r.date < now;
      });
    },
    
    getByRecord: async function(recordId) {
      const all = await this.getAll();
      return all.filter(r => r.recordId === recordId);
    },
    
    processDue: async function() {
      const pending = await this.getPending();
      const now = new Date();
      const today = now.toISOString().slice(0,10);
      const timeStr = now.toTimeString().slice(0,5);
      
      for (const reminder of pending) {
        let shouldFire = false;
        
        if (reminder.status === 'snoozed' && reminder.snoozedUntil && Date.now() >= reminder.snoozedUntil) {
          reminder.status = 'pending';
          reminder.snoozedUntil = null;
          shouldFire = true;
        }
        
        if (reminder.status !== 'pending') continue;
        
        if (reminder.date === today && reminder.time <= timeStr) {
          shouldFire = true;
        }
        
        if (reminder.frequency === 'daily') {
          shouldFire = true;
        }
        
        if (shouldFire) {
          this._scheduleNotification(reminder);
          
          if (reminder.channels && reminder.channels.includes('email')) {
            this._scheduleEmail(reminder);
          }
          
          if (reminder.frequency !== 'once') {
            reminder.status = 'pending';
          } else {
            reminder.status = 'sent';
          }
          reminder.sentAt = Date.now();
          await this.update(reminder);
        }
      }
    },
    
    _scheduleNotification: function(reminder) {
      const notifDate = new Date(reminder.date + 'T' + (reminder.time || '09:00'));
      const opts = {
        title: '\uD83D\uDD14 ' + (reminder.title || 'Recordatorio'),
        body: reminder.message || reminder.recordTitle || '',
        tag: 'reminder-' + reminder.id,
        data: { type: 'reminder', reminderId: reminder.id, moduleId: reminder.moduleId, recordId: reminder.recordId },
        vibrate: [200, 100, 200, 100, 200]
      };
      if (notifDate.getTime() <= Date.now()) {
        window.SIGR.NotificationService.sendLocal(opts);
      } else {
        window.SIGR.NotificationService.schedule(opts, notifDate, reminder.frequency);
      }
    },
    
    _scheduleEmail: function(reminder) {
      if (window.SIGR.EmailService && window.SIGR.EmailService.isConfigured()) {
        window.SIGR.EmailService.schedule(reminder);
      }
    },
    
    getStats: async function() {
      const all = await this.getAll();
      return {
        total: all.length,
        pending: all.filter(r => r.status === 'pending').length,
        completed: all.filter(r => r.status === 'completed').length,
        sent: all.filter(r => r.status === 'sent').length,
        cancelled: all.filter(r => r.status === 'cancelled').length,
        snoozed: all.filter(r => r.status === 'snoozed').length,
        overdue: all.filter(r => r.status === 'pending' && r.date < today()).length,
        today: all.filter(r => r.date === today() && r.status !== 'cancelled' && r.status !== 'completed').length
      };
    }
  };
  
  window.SIGR.ReminderService = ReminderService;
})();