(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const SchedulerService = {
    _jobs: [],
    _timerId: null,
    _interval: 30000,
    _running: false,
    
    start: function() {
      if (this._running) return;
      this._running = true;
      this._tick();
      this._timerId = setInterval(() => this._tick(), this._interval);
      window.addEventListener('online', () => this._onOnline());
      return this;
    },
    
    stop: function() {
      this._running = false;
      if (this._timerId) {
        clearInterval(this._timerId);
        this._timerId = null;
      }
    },
    
    setInterval: function(ms) {
      this._interval = ms;
      if (this._running) {
        this.stop();
        this.start();
      }
    },
    
    _tick: function() {
      if (!window.SIGR.ReminderService) return;
      window.SIGR.ReminderService.processDue().catch(() => {});
      
      if (window.SIGR.SyncManager) {
        window.SIGR.SyncManager.process().catch(() => {});
      }
      
      this._checkOnline();
    },
    
    _onOnline: function() {
      if (window.SIGR.EmailService) {
        window.SIGR.EmailService.sendPending().catch(() => {});
      }
      if (window.SIGR.SyncManager) {
        window.SIGR.SyncManager.process().catch(() => {});
      }
    },
    
    _checkOnline: function() {
      if (navigator.onLine && window.SIGR.EmailService) {
        window.SIGR.EmailService.sendPending().catch(() => {});
      }
    },
    
    registerJob: function(name, fn, interval) {
      const job = { name, fn, interval, lastRun: 0 };
      this._jobs.push(job);
      return job;
    },
    
    unregisterJob: function(name) {
      this._jobs = this._jobs.filter(j => j.name !== name);
    }
  };
  
  window.SIGR.SchedulerService = SchedulerService;
})();