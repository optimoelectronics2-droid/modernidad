(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const StateService = {
    _state: {
      view: 'dashboard',
      moduleId: null,
      filter: 'all',
      recordId: null,
      search: '',
      detailTab: 'info',
      subView: null,
      subParams: {},
      finTab: 'dashboard',
      agendaTab: 'calendar',
      agendaFilterDate: null
    },
    
    _navStack: [],
    _listeners: [],
    
    get: function(key) {
      return key ? this._state[key] : this._state;
    },
    
    set: function(key, value) {
      this._state[key] = value;
      this._notify();
    },
    
    setAll: function(params) {
      Object.assign(this._state, params);
      this._notify();
    },
    
    go: function(view, params) {
      this._navStack.push(JSON.parse(JSON.stringify(this._state)));
      this._state = Object.assign({
        view: 'dashboard', moduleId: null, filter: 'all',
        recordId: null, search: '', detailTab: 'info',
        subView: null, subParams: {}, finTab: 'dashboard'
      }, params, { view: view });
      this._notify();
      window.scrollTo(0,0);
      const app = document.getElementById('app');
      if (app && app.scrollTo) app.scrollTo(0,0);
    },
    
    replace: function(view, params) {
      this._state = Object.assign({
        view: 'dashboard', moduleId: this._state.moduleId, filter: 'all',
        recordId: null, search: '', detailTab: 'info',
        subView: null, subParams: {}, finTab: this._state.finTab || 'dashboard'
      }, params, { view: view });
      this._notify();
      window.scrollTo(0,0);
    },
    
    back: function() {
      if (this._navStack.length === 0) {
        this._state = { view: 'dashboard', moduleId: null, filter: 'all', recordId: null, search: '', detailTab: 'info', subView: null, subParams: {}, finTab: 'dashboard' };
        this._notify();
        return;
      }
      this._state = this._navStack.pop();
      this._notify();
      window.scrollTo(0,0);
    },
    
    canGoBack: function() {
      return this._navStack.length > 0;
    },
    
    onChange: function(fn) {
      this._listeners.push(fn);
      return () => {
        this._listeners = this._listeners.filter(l => l !== fn);
      };
    },
    
    notify: function() {
      const s = this._state;
      this._listeners.forEach(fn => fn(s));
    },
    _notify: function() {
      this.notify();
    },
    
    resetNav: function() {
      this._navStack = [];
    }
  };
  
  window.SIGR.StateService = StateService;
})();