(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  let _permission = 'default';
  
  function _hashId(str){
    let hash = 0;
    if(!str) return Math.abs(Date.now() % 2147483647);
    for(let i = 0; i < str.length; i++){
      const c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash = hash & hash;
    }
    return Math.abs(hash) % 2147483647 || 1;
  }
  
  function _isNative(){
    return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  }
  
  function _everyFromFreq(freq){
    if(freq === 'daily') return 'day';
    if(freq === 'weekly') return 'week';
    if(freq === 'monthly') return 'month';
    if(freq === 'annual') return 'year';
    return null;
  }
  
  const NativeNotifications = {
    async schedule(notifications){
      if(!_isNative()) return;
      try {
        const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        await LocalNotifications.schedule({ notifications });
      } catch(e){
        console.warn('Native schedule error:', e);
      }
    },
    async cancel(ids){
      if(!_isNative()) return;
      try {
        const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
      } catch(e){
        console.warn('Native cancel error:', e);
      }
    },
    async requestPermission(){
      if(!_isNative()) return 'granted';
      try {
        const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        if (!granted && typeof window.showToast === 'function') {
          window.showToast('Permiso de notificaciones denegado. Ve a Configuración > Notificaciones y actívalo.');
        }
        return granted ? 'granted' : 'denied';
      } catch(e){
        console.warn('Native permission error:', e);
        if (typeof window.showToast === 'function') {
          window.showToast('Error al solicitar permiso de notificaciones');
        }
        return 'denied';
      }
    },
    async getPending(){
      if(!_isNative()) return [];
      try {
        const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        const pending = await LocalNotifications.getPending();
        return pending.notifications || [];
      } catch(e){
        return [];
      }
    },
    async registerActionTypes(types){
      if(!_isNative()) return;
      try {
        const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        await LocalNotifications.registerActionTypes({ types });
      } catch(e){}
    }
  };
  
  const NotificationService = {
    _queued: [],
    _supported: false,
    _isNative: false,
    
    init: function() {
      this._isNative = _isNative();
      this._supported = this._isNative || ('Notification' in window);
      if (!this._isNative && this._supported) {
        _permission = Notification.permission;
      }
      this._checkServiceWorker();
      this._restoreSchedules();
      return this;
    },
    
    _checkServiceWorker: function() {
      if (this._isNative) return;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          this._registration = reg;
        }).catch(() => {});
      }
    },
    
    requestPermission: async function() {
      if (this._isNative) {
        _permission = await NativeNotifications.requestPermission();
        return _permission;
      }
      if (!this._supported) return 'denied';
      try {
        _permission = await Notification.requestPermission();
        return _permission;
      } catch(e) {
        try {
          Notification.requestPermission(result => { _permission = result; });
        } catch(e2) {}
        return _permission;
      }
    },
    
    canNotify: function() {
      if (this._isNative) return true;
      return this._supported && _permission === 'granted';
    },
    
    sendLocal: async function(options) {
      const { title, body, tag, data, icon, actions, vibrate, requireInteraction } = options;
      
      if (this._isNative) {
        try {
          const nid = _hashId(tag || ('sigr-' + Date.now()));
          await NativeNotifications.schedule([{
            id: nid,
            title: title || '',
            body: body || '',
            smallIcon: 'ic_stat_icon',
            iconColor: '#9C8CFF',
            schedule: { at: new Date(), allowWhileIdle: true },
            extra: data || {},
            actionTypeId: '',
            attachments: null
          }]);
          this._logSent(options);
          this._markReminderSent(options);
          return true;
        } catch(e) {
          console.warn('Native sendLocal error:', e);
          if (typeof window.showToast === 'function') {
            window.showToast('Error al enviar notificación nativa');
          }
          this._fallback(options);
          return false;
        }
      }
      
      if (this.canNotify()) {
        try {
          const notifOptions = {
            body: body || '',
            icon: icon || 'icons/icon-192.png',
            badge: 'icons/icon-72.png',
            tag: tag || 'sigr-notification',
            data: data || {},
            vibrate: vibrate || [100, 50, 100],
            requireInteraction: requireInteraction !== false,
            actions: actions || []
          };
          if (this._registration) {
            await this._registration.showNotification(title, notifOptions);
          } else {
            new Notification(title, notifOptions);
          }
          this._logSent(options);
          this._markReminderSent(options);
          return true;
        } catch(e) {
          console.warn('NotificationService: send error', e);
          this._fallback(options);
          return false;
        }
      } else {
        this._fallback(options);
        return false;
      }
    },
    
    _fallback: function(options) {
      this._queued.push(options);
      this._markSchedule(options.tag, 'failed');
      this._tryShowFallback(options);
    },
    
    _tryShowFallback: function(options) {
      const container = document.getElementById('notificationFallback');
      if (!container) return;
      const n = document.createElement('div');
      n.className = 'notif-fallback';
      n.innerHTML = '<div class="notif-fb-icon">\uD83D\uDD14</div><div class="notif-fb-body"><div class="notif-fb-title">'+(options.title||'')+'</div>'+(options.body ? '<div class="notif-fb-text">'+options.body+'</div>' : '')+'</div><button class="notif-fb-close" data-action="dismissNotif">&times;</button>';
      container.appendChild(n);
      setTimeout(() => { if (n.parentNode) n.remove(); }, 5000);
    },
    
    schedule: async function(options, date, frequency) {
      this._persistSchedule(options, date);
      
      if (this._isNative) {
        const nid = _hashId(options.tag || ('sigr-' + Date.now()));
        const every = frequency ? _everyFromFreq(frequency) : null;
        try {
          await NativeNotifications.schedule([{
            id: nid,
            title: options.title || '',
            body: options.body || '',
            smallIcon: 'ic_stat_icon',
            iconColor: '#9C8CFF',
            schedule: {
              at: date,
              every: every,
              repeats: !!every,
              allowWhileIdle: true,
              count: every ? 365 : undefined
            },
            extra: options.data || {},
            actionTypeId: ''
          }]);
        } catch(e) {
          console.warn('Native schedule error:', e);
          if (typeof window.showToast === 'function') {
            window.showToast('Error al programar notificación nativa');
          }
        }
        return;
      }
      
      this._scheduleInServiceWorker(options, date);
      const delay = date.getTime() - Date.now();
      if (delay <= 0) {
        this.sendLocal(options);
        return;
      }
      setTimeout(() => {
        this.sendLocal(options);
      }, delay);
    },
    
    cancelByTag: async function(tag) {
      if (!tag) return;
      if (this._isNative) {
        await NativeNotifications.cancel([_hashId(tag)]);
      }
      this._markSchedule(tag, 'cancelled');
    },
    
    cancelByReminderId: async function(reminderId) {
      if (!reminderId) return;
      const tag = 'reminder-' + reminderId;
      await this.cancelByTag(tag);
    },
    
    cancelAllNative: async function() {
      if (!this._isNative) return;
      try {
        const pending = await NativeNotifications.getPending();
        if (pending.length > 0) {
          await NativeNotifications.cancel(pending.map(n => n.id));
        }
      } catch(e) {}
    },
    
    _persistSchedule: async function(options, date) {
      try {
        const key = 'scheduled_notifications';
        const current = await window.SIGR.StorageService.getSetting(key, []);
        const tag = options.tag || ('sigr-' + Date.now());
        const next = (current || []).filter(n => n.tag !== tag);
        next.push({
          tag,
          title: options.title,
          body: options.body || '',
          data: options.data || {},
          icon: options.icon || 'icons/icon-192.png',
          date: date.getTime(),
          status: 'pending',
          createdAt: Date.now()
        });
        await window.SIGR.StorageService.setSetting(key, next);
      } catch(e) {}
    },
    
    _restoreSchedules: async function() {
      if (this._isNative) return;
      try {
        const schedules = await window.SIGR.StorageService.getSetting('scheduled_notifications', []);
        const now = Date.now();
        for (const item of (schedules || []).filter(n => n.status === 'pending')) {
          const options = {
            title: item.title,
            body: item.body,
            tag: item.tag,
            icon: item.icon,
            data: item.data || {}
          };
          const date = new Date(item.date);
          const delay = Math.max(0, item.date - now);
          this._scheduleInServiceWorker(options, date);
          setTimeout(() => this.sendLocal(options), delay);
        }
      } catch(e) {}
    },
    
    _scheduleInServiceWorker: function(options, date) {
      if (this._isNative) return;
      if (!navigator.serviceWorker?.controller) return;
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          notification: {
            title: options.title,
            body: options.body || '',
            tag: options.tag || 'sigr-notification',
            icon: options.icon || 'icons/icon-192.png',
            badge: 'icons/icon-72.png',
            data: options.data || {},
            date: date.getTime()
          }
        });
      } catch(e) {}
    },
    
    _logSent: function(options) {
      window.SIGR.ActivityService.log('NOTIFICATION_SENT', {
        description: 'Notificaci\u00F3n enviada: ' + (options.title||''),
        metadata: { title: options.title, body: options.body }
      }).catch(() => {});
      this._markSchedule(options.tag, 'sent');
    },
    
    _markSchedule: async function(tag, status) {
      if (!tag) return;
      try {
        const key = 'scheduled_notifications';
        const current = await window.SIGR.StorageService.getSetting(key, []);
        const next = (current || []).map(n => n.tag === tag ? Object.assign({}, n, { status, sentAt: Date.now() }) : n);
        await window.SIGR.StorageService.setSetting(key, next);
      } catch(e) {}
    },
    
    _markReminderSent: async function(options) {
      const reminderId = options?.data?.reminderId;
      if (!reminderId || !window.SIGR.ReminderService) return;
      try {
        const all = await window.SIGR.ReminderService.getAll();
        const rem = all.find(r => r.id === reminderId);
        if (!rem || rem.status === 'completed') return;
        rem.status = 'sent';
        rem.sentAt = Date.now();
        await window.SIGR.ReminderService.update(rem);
      } catch(e) {}
    },
    
    getPermission: function() { return _permission; },
    isSupported: function() { return this._supported; },
    isNative: function() { return this._isNative; }
  };
  
  window.SIGR.NotificationService = NotificationService;
})();
