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
        remindBefore: data.remindBefore || 0,
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
    
    resyncSchedules: async function() {
      if (!window.SIGR.NotificationService) return;
      const now = Date.now();
      try {
        const all = await this.getAll();
        for (const r of all) {
          if (r.status !== 'pending' && r.status !== 'snoozed') continue;
          const base = new Date(r.date + 'T' + (r.time || '09:00'));
          if (isNaN(base.getTime())) continue;
          if (r.frequency && r.frequency !== 'once') {
            const main = this._nextOccurrence(base, now, r.frequency);
            this._scheduleOccurrence(r, main, now);
          } else if (base.getTime() > now) {
            this._scheduleOccurrence(r, base, now);
          }
        }
      } catch(e) {}
    },
    
    _nextOccurrence: function(base, now, freq) {
      const d = new Date(base);
      if (freq === 'daily') { while (d.getTime() <= now) d.setDate(d.getDate() + 1); }
      else if (freq === 'weekly') { while (d.getTime() <= now) d.setDate(d.getDate() + 7); }
      else if (freq === 'monthly') { while (d.getTime() <= now) d.setMonth(d.getMonth() + 1); }
      else if (freq === 'annual') { while (d.getTime() <= now) d.setFullYear(d.getFullYear() + 1); }
      return d;
    },
    
    _scheduleOccurrence: function(reminder, atDate, now) {
      const adv = reminder.remindBefore || 0;
      const tagBase = 'reminder-' + reminder.id;
      const data = { type: 'reminder', reminderId: reminder.id, moduleId: reminder.moduleId, recordId: reminder.recordId };
      const title = reminder.title || 'Recordatorio';
      const body = reminder.message || reminder.recordTitle || '';
      
      const fire = (opts, date) => {
        if (date.getTime() <= now) {
          window.SIGR.NotificationService.sendLocal(opts);
        } else {
          window.SIGR.NotificationService.schedule(opts, date, reminder.frequency);
        }
      };
      
      if (adv > 0) {
        const advDate = new Date(atDate.getTime() - adv * 60000);
        if (advDate.getTime() > now) {
          let label;
          if (adv >= 1440) label = '1 dia';
          else if (adv >= 60) label = (adv / 60) + ' hora' + ((adv / 60) === 1 ? '' : 's');
          else label = adv + ' min';
          fire({
            title: '\u23F3 ' + title,
            body: 'Falta ' + label + ': ' + body,
            tag: tagBase + '-adv',
            data: data,
            vibrate: [200, 100, 200]
          }, advDate);
        }
      }
      
      fire({
        title: '\uD83D\uDD14 ' + title,
        body: body,
        tag: tagBase,
        data: data,
        vibrate: [200, 100, 200, 100, 200]
      }, atDate);
    },
    
    _scheduleNotification: function(reminder) {
      const base = new Date(reminder.date + 'T' + (reminder.time || '09:00'));
      const now = Date.now();
      const advMin = reminder.remindBefore || 0;
      const tagBase = 'reminder-' + reminder.id;
      const data = { type: 'reminder', reminderId: reminder.id, moduleId: reminder.moduleId, recordId: reminder.recordId };
      const title = reminder.title || 'Recordatorio';
      const body = reminder.message || reminder.recordTitle || '';
      
      const fire = (opts, date) => {
        if (date.getTime() <= now) {
          window.SIGR.NotificationService.sendLocal(opts);
        } else {
          window.SIGR.NotificationService.schedule(opts, date, reminder.frequency);
        }
      };
      
      if (advMin > 0) {
        const advDate = new Date(base.getTime() - advMin * 60000);
        if (advDate.getTime() > now) {
          let label;
          if (advMin >= 1440) label = '1 dia';
          else if (advMin >= 60) label = (advMin / 60) + ' hora' + ((advMin / 60) === 1 ? '' : 's');
          else label = advMin + ' min';
          fire({
            title: '\u23F3 ' + title,
            body: 'Falta ' + label + ': ' + body,
            tag: tagBase + '-adv',
            data: data,
            vibrate: [200, 100, 200]
          }, advDate);
        }
      }
      
      fire({
        title: '\uD83D\uDD14 ' + title,
        body: body,
        tag: tagBase,
        data: data,
        vibrate: [200, 100, 200, 100, 200]
      }, base);
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