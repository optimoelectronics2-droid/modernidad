/* ============ SIGR Pro - Main Application ============ */
(function(){
  'use strict';
  
  /* ============ CONFIG ============ */
  const MODULES = [
    { id:'personal', name:'Apuntes personales', icon:'📝', color:'var(--c-personal)', hex:'#9C8CFF',
      titleField:'titulo', previewField:'contenido',
      fields:[
        {key:'titulo', label:'Título', type:'text', required:true, placeholder:'¿Sobre qué es esta nota?'},
        {key:'contenido', label:'Contenido', type:'textarea', placeholder:'Escribe aquí...'},
        {key:'prioridad', label:'Prioridad', type:'priority', options:['Baja','Media','Alta']},
        {key:'etiquetas', label:'Etiquetas', type:'text', placeholder:'ej: familia, ideas, viaje'},
      ]},
    { id:'tienda', name:'Apuntes de la tienda', icon:'🏪', color:'var(--c-tienda)', hex:'#F5A623',
      titleField:'titulo', previewField:'contenido',
      fields:[
        {key:'titulo', label:'Título', type:'text', required:true, placeholder:'ej: Pedido de cliente'},
        {key:'categoria', label:'Categoría', type:'select', options:['Cliente','Proveedor','Idea','Incidencia','Compra','Inventario','Cotización','Seguimiento'], statusField:true},
        {key:'contenido', label:'Detalle', type:'textarea', placeholder:'Describe el registro...'},
        {key:'etiquetas', label:'Etiquetas', type:'text'},
      ]},
    { id:'pagos', name:'Registro de pagos', icon:'💰', color:'var(--c-pagos)', hex:'#12D68A',
      titleField:'concepto', previewField:'notas',
      fields:[
        {key:'concepto', label:'Concepto', type:'text', required:true, placeholder:'ej: Pago de proveedor'},
        {key:'monto', label:'Monto', type:'number', required:true, placeholder:'0.00'},
        {key:'persona', label:'Persona / Cliente / Proveedor', type:'text'},
        {key:'metodo', label:'Método de pago', type:'select', options:['Efectivo','Transferencia','Tarjeta','Cheque','Otro']},
        {key:'estado', label:'Estado', type:'select', options:['Pagado','Pendiente','Vencido','Recibido'], statusField:true},
        {key:'fecha', label:'Fecha', type:'date'},
        {key:'notas', label:'Notas', type:'textarea'},
      ]},
    { id:'pendientes', name:'Pendientes', icon:'📋', color:'var(--c-pendientes)', hex:'#FB5A7E',
      titleField:'titulo', previewField:'descripcion',
      fields:[
        {key:'titulo', label:'Título', type:'text', required:true, placeholder:'¿Qué hay que hacer?'},
        {key:'descripcion', label:'Descripción', type:'textarea'},
        {key:'responsable', label:'Responsable', type:'text'},
        {key:'prioridad', label:'Prioridad', type:'priority', options:['Baja','Media','Alta','Urgente']},
        {key:'fechaLimite', label:'Fecha límite', type:'date'},
        {key:'estado', label:'Estado', type:'select', options:['Pendiente','En proceso','Finalizado','Cancelado'], statusField:true},
      ]},
  ];
  
  const STATUS_COLORS = {
    'Pagado':'#12D68A','Recibido':'#12D68A','Finalizado':'#12D68A',
    'Pendiente':'#F5B942','En proceso':'#5CA8FF',
    'Vencido':'#FB5A7E','Cancelado':'#FB5A7E',
    'Cliente':'#5CA8FF','Proveedor':'#F5A623','Idea':'#9C8CFF','Incidencia':'#FB5A7E','Compra':'#12D68A','Inventario':'#F5B942','Cotización':'#5CA8FF','Seguimiento':'#9C8CFF'
  };
  const PRI_COLORS = {'Baja':'#5CA8FF','Media':'#F5B942','Alta':'#FB5A7E','Urgente':'#FB5A7E'};
  
  function modOf(id){ return MODULES.find(m=>m.id===id); }
  function uid(){ return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function recCode(){ return 'EXP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase(); }
  
  /* ============ STATE ============ */
  let DB = {};
  let dataReady = false;
  
  /* ============ STORAGE (legacy) ============ */
  async function loadAll(){
    try {
      for(const m of MODULES){
        try {
          const res = await window.storage.get('records:'+m.id, false);
          DB[m.id] = res && res.value ? JSON.parse(res.value) : [];
        } catch(e){ DB[m.id] = []; }
      }
    } catch(e){ MODULES.forEach(m => { DB[m.id] = []; }); }
    dataReady = true;
  }
  
  async function persist(moduleId){
    try {
      await window.storage.set('records:'+moduleId, JSON.stringify(DB[moduleId]), false);
      try {
        await window.SIGR.StorageService.trackChange('records', moduleId, { moduleId: moduleId, records: DB[moduleId] }, 'upsert');
        if (window.SIGR.SyncManager) window.SIGR.SyncManager.scheduleProcess();
      } catch(e){}
    } catch(e){ showToast('No se pudo guardar.'); }
  }
  
  /* ============ HELPERS ============ */
  function fmtDate(ts){
    const d = new Date(ts);
    return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  }
  function fmtTime(ts){
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  }
  function relTime(ts){
    const diff = Date.now()-ts, m=Math.floor(diff/60000), h=Math.floor(m/60), d=Math.floor(h/24);
    if(m<1) return 'ahora';
    if(m<60) return m+' min';
    if(h<24) return h+' h';
    if(d<7) return d+' d';
    return fmtDate(ts);
  }
  function groupLabel(ts){
    const now = new Date(); const d = new Date(ts);
    const startOf = dt=>new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()).getTime();
    const today = startOf(now), day = startOf(d);
    const diffDays = Math.round((today-day)/86400000);
    const dow = now.getDay()===0?6:now.getDay()-1;
    const weekStart = today - dow*86400000;
    if(diffDays===0) return 'Hoy';
    if(diffDays===1) return 'Ayer';
    if(day>=weekStart) return 'Esta semana';
    if(d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()) return 'Este mes';
    if(diffDays<365) return 'Este año';
    return 'Anteriores';
  }
  function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function nl2br(s){ return esc(s); }
  
  function showToast(msg){
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>t.classList.remove('show'), 1900);
  }
  
  function activeRecords(moduleId){
    return (DB[moduleId]||[]).filter(r=>!r.deleted);
  }
  function pendingCount(m){
    const recs = activeRecords(m.id).filter(r=>!r.archived);
    const statusField = m.fields.find(f=>f.statusField);
    if(!statusField) return 0;
    return recs.filter(r=>{ const v=r[statusField.key]; return v==='Pendiente'||v==='Vencido'||v==='En proceso'; }).length;
  }
  
  /* ============ RENDER ============ */
  async function render(){
    const app = document.getElementById('app');
    if(!app) return;
    if(!dataReady){ app.innerHTML = '<div style="padding:80px 20px;text-align:center;color:var(--text-dim)">Cargando…</div>'; return; }
    
    const state = window.SIGR.StateService.get();
    let html = '';
    try {
      switch(state.view){
        case 'dashboard': html = window.SIGR.DashboardView.render(); break;
        case 'settings': html = await window.SIGR.SettingsView.render(); break;
        case 'list': html = await window.SIGR.ListView.render(); break;
        case 'form': html = window.SIGR.FormView.render(); break;
        case 'detail': html = await window.SIGR.DetailView.render(); break;
        case 'stats': html = window.SIGR.StatsView.render(); break;
        case 'activity': html = await window.SIGR.ActivityView.render(); break;
        case 'reminders': html = await window.SIGR.RemindersView.render(); break;
        case 'calendar': html = await window.SIGR.CalendarView.render(); break;
        case 'notifications': html = await window.SIGR.NotificationsCenterView.render(); break;
        case 'finance': html = await window.SIGR.FinanceView.render(); break;
        case 'agenda': html = await window.SIGR.AgendaView.render(); break;
        case 'vault': html = await window.SIGR.VaultView.render(); break;
        default: html = window.SIGR.DashboardView.render();
      }
    } catch(e) {
      console.error('Render error:', e);
      html = `<div class="empty"><div class="eicon">⚠️</div><div class="etitle">Error al cargar</div><div class="etext">${esc(e.message)}</div></div>`;
    }
    app.innerHTML = html;
    attachHandlers();
    attachGlobalEvents();
  }
  
  /* ============ EVENT DELEGATION ============ */
  function attachHandlers(){
    document.onclick = async (e) => {
      const el = e.target.closest('[data-action]');
      if(!el) return;
      const action = el.dataset.action;
      const mod = el.dataset.mod, id = el.dataset.id;
      const state = window.SIGR.StateService.get();
      
      switch(action) {
        case 'back': window.SIGR.StateService.back(); break;
        case 'openModule': window.SIGR.StateService.go('list', {moduleId:mod, filter:'all'}); break;
        case 'openSettings': {
          const subView = el.dataset.section;
          if(subView) {
            const html = await window.SIGR.SettingsView.renderSection(subView);
            const app = document.getElementById('app');
            if(app) app.innerHTML = html;
            attachHandlers();
            attachGlobalEvents();
          } else {
            window.SIGR.StateService.go('settings');
          }
          break;
        }
        case 'openSettingsDetail': {
          const section = el.dataset.section;
          const html = await window.SIGR.SettingsView.renderSection(section);
          const appEl = document.getElementById('app');
          if(appEl) appEl.innerHTML = html;
          attachHandlers();
          attachGlobalEvents();
          break;
        }
        case 'openBackupSettings': {
          await openBackupSettingsView();
          break;
        }
        case 'openStats': window.SIGR.StateService.go('stats', {moduleId:mod}); break;
        case 'openActivity': window.SIGR.StateService.go('activity'); break;
        case 'openReminders': window.SIGR.StateService.go('reminders'); break;
        case 'openCalendar': window.SIGR.StateService.go('calendar'); break;
        case 'openFinance': window.SIGR.StateService.go('finance', {finTab:'dashboard'}); break;
        case 'openAgenda': window.SIGR.StateService.go('agenda', {agendaTab:'calendar'}); break;
        case 'openVault': window.SIGR.StateService.go('vault'); break;
        case 'openNotificationsCenter': window.SIGR.StateService.go('notifications'); break;
        case 'newRecord': window.SIGR.StateService.go('form', {moduleId:mod}); break;
        case 'editRecord': window.SIGR.StateService.go('form', {moduleId:mod, recordId:id}); break;
        case 'openDetail': window.SIGR.StateService.go('detail', {moduleId:mod, recordId:id, filter:state.filter, detailTab:'info'}); break;
        case 'setFilter': window.SIGR.StateService.set('filter', el.dataset.f); break;
        case 'setDetailTab': window.SIGR.StateService.set('detailTab', el.dataset.tab); break;
        
        case 'saveRecord': await saveRecordAction(mod, id||null); break;
        case 'toggleFav': await toggleFav(mod, id); break;
        case 'toggleArchive': await toggleArchive(mod, id); break;
        case 'deleteRecord': await deleteRecordAction(mod, id); break;
        case 'restoreRecord': await restoreRecordAction(mod, id); break;
        case 'permaDelete': await permaDeleteAction(mod, id); break;
        case 'emptyAllTrash': await emptyAllTrashAction(); break;
        
        case 'addMovement': openMovementModal(mod, id); break;
        case 'addReminderNow': openReminderModal(mod, id); break;
        case 'addComment': await addComment(mod, id); break;
        case 'addRelation': openRelationModal(mod, id); break;
        case 'saveRelation': await saveRelation(el); break;
        case 'removeRelation': await removeRelation(el.dataset.id); break;
        case 'restoreVersion': await restoreVersion(el.dataset.verId, mod, id); break;
        case 'saveRecordSettings': await saveRecordSettings(mod, id); break;
        
        case 'setPriority': {
          const key = el.dataset.key, val = el.dataset.val;
          const wrap = document.querySelector(`[data-priwrap="${key}"]`);
          if(wrap){
            wrap.querySelectorAll('.pri-opt').forEach(b=>b.classList.toggle('on', b.dataset.val===val));
            wrap.parentElement.querySelector(`input[type=hidden][data-key="${key}"]`).value = val;
          }
          break;
        }
        
        /* Finance actions */
        case 'finTab': case 'newFinMovement': case 'saveFinMovement':
        case 'newFinPerson': case 'saveFinPerson': case 'finDebtDetail':
        case 'finNewDebtMov': case 'saveFinDebtMov': case 'finDeletePerson':
        case 'finAddBudget': case 'finCalcSavings': case 'finCalcRule':
        case 'finCalcBreakEven': case 'finFilter':
          await window.SIGR.FinanceView.handleAction(el); break;
        /* Agenda actions */
        case 'agendaTab': case 'agendaPrev': case 'agendaNext': case 'agendaSelectDay':
        case 'newAgendaEvent': case 'agendaSaveEvent': case 'agendaEditEvent':
        case 'agendaUpdateEvent': case 'agendaDeleteEvent': case 'agendaToggleComplete':
          await window.SIGR.AgendaView.handleAction(el); break;
        /* Vault actions */
        case 'vaultSetup': case 'vaultUnlock': case 'vaultLock': case 'vaultNewItem':
        case 'vaultSaveItem': case 'vaultEditItem': case 'vaultUpdateItem':
        case 'vaultShowItem': case 'vaultDeleteItem': case 'vaultSearch':
        case 'vaultConfirmDelete': case 'vaultCopyField': case 'vaultTogglePass':
          await window.SIGR.VaultView.handleAction(el); break;
        /* Backup & Sync actions */
        case 'bsRemoveAccount': case 'bsSetActive': case 'bsTestAccount': case 'bsBackupNow':
        case 'bsSavePassphrase': case 'bsRestore': case 'bsDoRestore': case 'bsRestoreMode':
        case 'bsDeleteBackup': case 'bsRefresh': case 'bsExportLocal': case 'bsImportLocal':
        case 'bsImportFileChosen': case 'bsConnectPersonal': case 'bsOpenDevicePage':
        case 'bsCopyUserCode': case 'bsSaveWebCid': case 'bsConfirmPrompt':
          await window.SIGR.BackupSettingsView.handleAction(el); break;
        case 'closeModal': closeModal(); break;
        case 'deleteAllMovements': await deleteAllMovements(mod, id); break;
        case 'saveMovement': await saveMovement(mod, id); break;
        case 'updateMovement': await updateMovement(el); break;
        case 'toggleMovDetails': toggleMovDetails(el); break;
        case 'editMovement': openEditMovementModal(el); break;
        case 'printMovement': printMovement(el); break;
        case 'deleteMovement': await deleteSingleMovement(el); break;
        case 'triggerPhotoUpload': document.getElementById('movPhotoInput')?.click(); break;
        case 'triggerPdfUpload': document.getElementById('movPdfInput')?.click(); break;
        case 'triggerAudioUpload': document.getElementById('movAudioInput')?.click(); break;
        case 'triggerVideoUpload': document.getElementById('movVideoInput')?.click(); break;
        case 'toggleMovSection': toggleMovSection(el); break;
        case 'saveReminder': await saveReminder(mod, id); break;
        case 'saveNotifConfig': await window.SIGR.SettingsView.saveNotifConfig(); showToast('Configuración guardada'); break;
        case 'saveEmailConfig': await window.SIGR.SettingsView.saveEmailConfig(); break;
        case 'saveSecurityConfig': await window.SIGR.SettingsView.saveSecurityConfig(); break;
        case 'saveAppearanceConfig': await window.SIGR.SettingsView.saveAppearanceConfig(); break;
        case 'testEmail': showToast('Correo de prueba (simulado)'); break;
        
        case 'completeReminder': await completeReminder(el.dataset.id); break;
        case 'snoozeReminder': await snoozeReminder(el.dataset.id); break;
        case 'deleteReminder': await deleteReminder(el.dataset.id); break;
        case 'filterReminders': await filterReminders(el.dataset.filter); break;
        case 'filterNotifs': await filterNotifs(el.dataset.filter); break;
        
        case 'calPrev': await window.SIGR.CalendarView.navigate('prev'); break;
        case 'calNext': await window.SIGR.CalendarView.navigate('next'); break;
        case 'calSelectDay': await window.SIGR.CalendarView.selectDay(el.dataset.date); break;
        
        case 'getGps': await getCurrentPosition(); break;
        case 'getFormGps': await getCurrentPosition(); break;
        case 'triggerFileUpload': document.getElementById('movFileInput')?.click(); break;
        case 'requestSignature': toggleSignatureModal(); break;
        case 'clearSignature': clearSignature(); break;
        case 'toggleFormSection': window.SIGR.FormView.toggleSection(el.dataset.section); break;
        case 'dismissNotif': el.closest('.notif-fallback')?.remove(); break;
        
        case 'attachFile': triggerFileAttach(mod, id); break;
        /* Sidebar & Global nav */
        case 'toggleSidebar': toggleSidebar(); break;
        case 'goDashboard': closeSidebar(); window.SIGR.StateService.go('dashboard'); break;
        case 'goFinance': closeSidebar(); window.SIGR.StateService.go('finance', {finTab:'dashboard'}); break;
        case 'goAgenda': closeSidebar(); window.SIGR.StateService.go('agenda', {agendaTab:'calendar'}); break;
        case 'goVault': closeSidebar(); window.SIGR.StateService.go('vault'); break;
        case 'goActivity': closeSidebar(); window.SIGR.StateService.go('activity'); break;
        case 'goReminders': closeSidebar(); window.SIGR.StateService.go('reminders'); break;
        case 'goCalendar': closeSidebar(); window.SIGR.StateService.go('calendar'); break;
        case 'goNotifications': closeSidebar(); window.SIGR.StateService.go('notifications'); break;
        case 'goSettings': closeSidebar(); window.SIGR.StateService.go('settings'); break;
        case 'goBackup': closeSidebar(); await openBackupSettingsView(); break;
        case 'toggleSearch': toggleSearch(); break;
        case 'closeSearch': closeSearch(); break;
        case 'confirmAction': {
          closeModal();
          if(typeof window._confirmCb === 'function') window._confirmCb();
          window._confirmCb = null;
          break;
        }
      }
    };
    
    /* Global search handlers */
    const gsInput = document.getElementById('globalSearchInput');
    if(gsInput){
      gsInput.oninput = function(){ handleGlobalSearch(this.value); };
    }
    
    /* Search handlers */
    const gs = document.getElementById('globalSearch');
    if(gs){
      gs.oninput = async function(){
        const state = window.SIGR.StateService.get();
        state.search = this.value;
        const results = document.getElementById('globalResults');
        const cards = document.getElementById('cardsWrap');
        if(results) results.innerHTML = await globalSearchResults(this.value);
        if(cards) cards.style.display = this.value.trim() ? 'none' : 'flex';
      };
    }
    const ms = document.getElementById('modSearch');
    if(ms){
      ms.oninput = () => {
        const pos = ms.selectionStart;
        window.SIGR.StateService.set('search', ms.value);
        const ms2 = document.getElementById('modSearch');
        if(ms2){ ms2.focus(); ms2.setSelectionRange(pos,pos); }
      };
    }
    const vs = document.getElementById('vaultSearch');
    if(vs){
      vs.oninput = () => {
        const VV = window.SIGR.VaultView;
        if(VV) { VV._search = vs.value; window.SIGR.StateService.notify(); }
      };
    }
    
    /* Color picker */
    document.querySelectorAll('.color-row').forEach(row => {
      row.querySelectorAll('.color-opt').forEach(btn => {
        btn.onclick = () => {
          row.querySelectorAll('.color-opt').forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
        };
      });
    });
  }
  
  function attachGlobalEvents(){
    /* File inputs for movement modal */
    const fileConfigs = [
      { input: 'movFileInput', list: 'movFileList' },
      { input: 'movPhotoInput', list: 'movPhotoList' },
      { input: 'movPdfInput', list: 'movPdfList' },
      { input: 'movAudioInput', list: 'movAudioList' },
      { input: 'movVideoInput', list: 'movVideoList' }
    ];
    fileConfigs.forEach(cfg => {
      const fi = document.getElementById(cfg.input);
      if(fi){
        fi.onchange = () => {
          const list = document.getElementById(cfg.list);
          if(list){
            list.innerHTML = '';
            Array.from(fi.files).slice(0,5).forEach(f => {
              list.innerHTML += `<span class="file-tag">${esc(f.name)}</span>`;
            });
            if(fi.files.length > 5) list.innerHTML += `<span class="file-tag">+${fi.files.length-5} más</span>`;
          }
        };
      }
    });
    
    /* Provider change */
    const prov = document.getElementById('cfgEmailProvider');
    if(prov){
      prov.onchange = () => {
        const isSmtp = prov.value === 'smtp';
        document.getElementById('smtpHostField').style.display = isSmtp ? '' : 'none';
        document.getElementById('smtpPortField').style.display = isSmtp ? '' : 'none';
        document.getElementById('cfgApiKey').parentElement.style.display = isSmtp ? 'none' : '';
      };
    }
    
    /* PIN toggle */
    const pinToggle = document.getElementById('cfgPinEnabled');
    if(pinToggle){
      pinToggle.onchange = () => {
        const pf = document.getElementById('pinField');
        if(pf) pf.style.display = pinToggle.checked ? '' : 'none';
      };
    }
    
    /* New comment: Ctrl+Enter to send */
    const nc = document.getElementById('newComment');
    if(nc){
      nc.onkeydown = (e) => {
        if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
          const btn = document.querySelector('[data-action="addComment"]');
          if(btn) btn.click();
        }
      };
    }
    
    /* Keyboard shortcuts */
    document.onkeydown = (e) => {
      if(e.key === 'Escape'){
        const sidebar = document.getElementById('sidebar');
        if(sidebar && sidebar.classList.contains('open')){ closeSidebar(); e.preventDefault(); return; }
        closeSearch();
        closeModal();
      }
      if((e.ctrlKey || e.metaKey) && e.key === 'k'){
        e.preventDefault();
        const gsBar = document.getElementById('globalSearchBar');
        if(gsBar && gsBar.classList.contains('open')){ closeSearch(); return; }
        toggleSearch();
      }
    };
  }
  
  /* ============ GLOBAL SEARCH ============ */
  async function globalSearchResults(q){
    if(!q || q.trim().length < 1) return '';
    const qq = q.trim().toLowerCase();
    let blocks = '';
    
    MODULES.forEach(m => {
      const matches = activeRecords(m.id).filter(r => {
        const hay = m.fields.map(f => r[f.key]).join(' ').toLowerCase();
        return hay.includes(qq);
      }).slice(0,4);
      if(matches.length){
        blocks += `<div class="date-label" style="margin:16px 24px 8px">${m.icon} ${m.name}</div>`;
        blocks += `<div style="padding:0 20px">${matches.map(r => recordCardHtml(m,r)).join('')}</div>`;
      }
    });
    
    try {
      const movResults = await window.SIGR.StorageService.searchMovements(qq);
      if(movResults && movResults.length > 0){
        blocks += `<div class="date-label" style="margin:16px 24px 8px">📌 Movimientos</div>`;
        movResults.slice(0,5).forEach(mov => {
          const m = modOf(mov.moduleId);
          blocks += `<div class="rec" style="--mc:${m?.hex||'#9C8CFF'};padding:10px 16px;font-size:13px" data-action="openDetail" data-mod="${mov.moduleId}" data-id="${mov.recordId}">
            <div class="rtitle">${esc((mov.description || '').substring(0,60))}</div>
            <div class="rmeta"><span class="tag">${esc(mov.type||'movimiento')}</span>${mov.amount?`<span class="tag">$${mov.amount}</span>`:''}<span class="tag">${relTime(mov.date)}</span></div>
          </div>`;
        });
      }
    } catch(e) {}
    
    if(!blocks) blocks = `<div class="empty"><div class="eicon">🔍</div><div class="etitle">Sin resultados</div><div class="etext">No encontramos coincidencias para "${esc(q)}"</div></div>`;
    return blocks;
  }
  
  function recordCardHtml(m, r){
    const title = r[m.titleField] || '(Sin título)';
    const preview = r[m.previewField] || '';
    const statusF = m.fields.find(f=>f.statusField);
    const statusVal = statusF ? r[statusF.key] : null;
    const priF = m.fields.find(f=>f.type==='priority');
    const priVal = priF ? r[priF.key] : null;
    const tags = (r.etiquetas||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,3);
    let metaHtml = '';
    if(statusVal) metaHtml += `<span class="tag status" style="background:${STATUS_COLORS[statusVal]||'#666'}">${esc(statusVal)}</span>`;
    if(priVal) metaHtml += `<span class="tag status" style="background:${PRI_COLORS[priVal]||'#666'}">${esc(priVal)}</span>`;
    tags.forEach(t=> metaHtml += `<span class="tag">#${esc(t)}</span>`);
    if(m.id==='pagos' && r.monto) metaHtml += `<span class="tag" style="color:var(--c-pagos)">$${Number(r.monto).toLocaleString()}</span>`;
    return `<div class="rec" style="--mc:${m.hex}" data-action="openDetail" data-mod="${m.id}" data-id="${r.id}">
      <div class="rdot"></div>
      <div class="rbody">
        <div class="rtitle">${r.favorite?'<span class="fav">★</span>':''}${esc(title)}</div>
        ${preview?`<div class="rprev">${esc(preview)}</div>`:''}
        ${metaHtml?`<div class="rmeta">${metaHtml}</div>`:''}
      </div>
      <div class="rtime">${relTime(r.updatedAt)}</div>
    </div>`;
  }
  
  /* ============ FORM HELPERS ============ */
  function fieldHtml(m, f, val){
    val = val==null?'':val;
    if(f.type==='textarea'){
      return `<div class="field"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label>
        <textarea data-key="${f.key}" placeholder="${esc(f.placeholder||'')}">${esc(val)}</textarea></div>`;
    }
    if(f.type==='select'){
      const opts = f.options.map(o=>`<option value="${esc(o)}" ${val===o?'selected':''}>${esc(o)}</option>`).join('');
      return `<div class="field"><label>${f.label}</label><select data-key="${f.key}"><option value="">Selecciona...</option>${opts}</select></div>`;
    }
    if(f.type==='priority'){
      const opts = f.options.map(o=>`<button type="button" class="pri-opt ${val===o?'on':''}" style="--mc:${PRI_COLORS[o]||m.hex}" data-action="setPriority" data-key="${f.key}" data-val="${o}">${o}</button>`).join('');
      return `<div class="field"><label>${f.label}</label><div class="pri-row" data-priwrap="${f.key}">${opts}</div><input type="hidden" data-key="${f.key}" value="${esc(val)}"></div>`;
    }
    if(f.type==='date'){
      return `<div class="field"><label>${f.label}</label><input type="date" data-key="${f.key}" value="${esc(val)}"></div>`;
    }
    if(f.type==='number'){
      return `<div class="field"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label><input type="number" step="0.01" inputmode="decimal" data-key="${f.key}" placeholder="${esc(f.placeholder||'')}" value="${esc(val)}"></div>`;
    }
    return `<div class="field"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label><input type="text" data-key="${f.key}" placeholder="${esc(f.placeholder||'')}" value="${esc(val)}"></div>`;
  }
  
  function collectForm(){
    const wrap = document.getElementById('formWrap');
    const data = {};
    wrap.querySelectorAll('[data-key]').forEach(el => {
      data[el.dataset.key] = el.value;
    });
    const extra = ['fAssignedTo','fCreatedBy','fEmpresa','fSucursal','fEtiquetas','fObservaciones','fPrivateNotes','fGps','fFollowStatus','fNextAction','fFollowDate','fFollowTime','fReminderMessage','fFileReference','fInitialComment','fCode','fVisibility'];
    extra.forEach(id => {
      const el = document.getElementById(id);
      if(el) data[id.replace(/^f/,'').replace(/^./,c=>c.toLowerCase())] = el.value;
    });
    const colorRow = document.getElementById('fColorRow');
    if(colorRow){
      const active = colorRow.querySelector('.color-opt.on');
      if(active) data.color = active.dataset.color;
    }
    const gpsField = document.getElementById('fGps');
    if(gpsField && gpsField.value.trim()){
      const parts = gpsField.value.split(',').map(s => parseFloat(s.trim()));
      if(parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])){
        data.gps = { lat: parts[0], lng: parts[1] };
      }
    }
    const createReminder = document.getElementById('fCreateReminder');
    if(createReminder) data.createReminder = createReminder.checked;
    return data;
  }
  
  function recordTitle(m, rec){
    return rec ? (rec[m.titleField] || rec.titulo || rec.concepto || '(Sin título)') : '(Sin título)';
  }
  
  function moneyLabel(value){
    const n = Number(value || 0);
    if(!value || Number.isNaN(n)) return '';
    return 'RD$' + n.toLocaleString('es-DO', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  
  function statusToMovementStatus(value){
    if(!value) return '';
    return value.toString().trim().toLowerCase().replace(/\s+/g,'_');
  }
  
  async function appendMovementForRecord(m, rec, movement){
    if(!m || !rec) return null;
    const full = Object.assign({
      moduleId: m.id,
      recordId: rec.id,
      recordTitle: recordTitle(m, rec),
      date: Date.now(),
      user: 'Sistema',
      type: 'general',
      description: '',
      comment: '',
      observaciones: '',
      status: '',
      priority: rec.prioridad || 'normal',
      category: m.id,
      subcategory: '',
      amount: null,
      client: '',
      provider: '',
      files: []
    }, movement || {});
    full.status = statusToMovementStatus(full.status);
    await window.SIGR.StorageService.addMovement(full);
    await window.SIGR.ActivityService.movementAdded(m, rec, full).catch(()=>{});
    return full;
  }
  
  async function registerPaymentWorkflow(m, rec){
    const amount = moneyLabel(rec.monto);
    const person = rec.persona ? ` de ${rec.persona}` : '';
    const status = rec.estado || 'Pendiente';
    await appendMovementForRecord(m, rec, {
      type: 'pago',
      description: `Pago creado${person}${amount ? ' por ' + amount : ''}.`,
      status,
      amount: rec.monto || null,
      client: rec.persona || '',
      provider: rec.persona || '',
      category: 'financiero',
      subcategory: rec.metodo || '',
      comment: rec.notas || '',
      user: rec.createdBy || 'Usuario'
    });
    
    if(rec.fecha){
      try {
        const reminder = await window.SIGR.ReminderService.create({
          moduleId: m.id,
          recordId: rec.id,
          recordTitle: recordTitle(m, rec),
          moduleName: m.name,
          title: `Seguimiento de pago: ${recordTitle(m, rec)}`,
          message: `${status}. ${amount ? 'Monto: ' + amount + '. ' : ''}${rec.notas || ''}`.trim(),
          date: rec.fecha,
          time: '09:00',
          priority: status === 'Vencido' ? 'alta' : 'media',
          category: 'pago',
          channels: ['notification'],
          color: m.hex
        });
        await appendMovementForRecord(m, rec, {
          type: 'pendiente',
          description: `Recordatorio generado para el pago (${rec.fecha} 09:00).`,
          status: 'pendiente',
          category: 'recordatorio',
          subcategory: 'pago',
          comment: reminder.title,
          user: 'Sistema'
        });
      } catch(e) {}
    }
    
    if(status === 'Pagado' || status === 'Recibido'){
      await appendMovementForRecord(m, rec, {
        type: 'cobro',
        description: `Pago confirmado${amount ? ': ' + amount : ''}.`,
        status: 'completado',
        amount: rec.monto || null,
        category: 'financiero',
        subcategory: 'confirmacion',
        user: rec.createdBy || 'Usuario'
      });
    }
  }
  
  async function registerFormWorkflow(m, rec, data){
    if(data.initialComment && data.initialComment.trim() && rec._lastInitialCommentLogged !== data.initialComment.trim()){
      rec.comments = rec.comments || [];
      rec.comments.unshift({ id: uid(), user: data.createdBy || 'Usuario', text: data.initialComment.trim(), date: Date.now() });
      rec._lastInitialCommentLogged = data.initialComment.trim();
      await appendMovementForRecord(m, rec, {
        type: 'nota',
        description: 'Comentario inicial agregado.',
        comment: data.initialComment.trim(),
        category: 'comentario',
        status: 'registrado',
        user: data.createdBy || 'Usuario'
      });
    }
    
    if(data.fileReference && data.fileReference.trim() && rec._lastFileReferenceLogged !== data.fileReference.trim()){
      rec._lastFileReferenceLogged = data.fileReference.trim();
      await appendMovementForRecord(m, rec, {
        type: 'documento',
        description: `Referencia de archivo: ${data.fileReference.trim()}.`,
        category: 'archivo',
        status: 'pendiente',
        user: data.createdBy || 'Usuario'
      });
    }
    
    const reminderSignature = [data.followDate, data.followTime || '09:00', data.nextAction || '', data.reminderMessage || ''].join('|');
    if(data.createReminder && data.followDate && rec._lastReminderSignature !== reminderSignature){
      rec._lastReminderSignature = reminderSignature;
      try {
        const reminder = await window.SIGR.ReminderService.create({
          moduleId: m.id,
          recordId: rec.id,
          recordTitle: recordTitle(m, rec),
          moduleName: m.name,
          title: data.nextAction || `Seguimiento: ${recordTitle(m, rec)}`,
          message: data.reminderMessage || data.nextAction || '',
          date: data.followDate,
          time: data.followTime || '09:00',
          priority: data.prioridad === 'Alta' || data.prioridad === 'Urgente' ? 'alta' : 'media',
          category: 'seguimiento',
          channels: ['notification'],
          color: rec.color || m.hex
        });
        await appendMovementForRecord(m, rec, {
          type: 'pendiente',
          description: `Recordatorio de seguimiento generado (${reminder.date} ${reminder.time}).`,
          status: 'pendiente',
          category: 'recordatorio',
          subcategory: 'seguimiento',
          comment: reminder.title,
          user: 'Sistema'
        });
      } catch(e) {}
    }
  }
  
  /* ============ CRUD ACTIONS ============ */
  async function saveRecordAction(moduleId, recordId){
    const m = modOf(moduleId);
    const data = collectForm();
    const reqMissing = m.fields.filter(f=>f.required && !data[f.key]?.trim());
    if(reqMissing.length){ showToast('Completa: ' + reqMissing.map(f=>f.label).join(', ')); return; }
    
    DB[moduleId] = DB[moduleId]||[];
    if(recordId){
      const idx = DB[moduleId].findIndex(r=>r.id===recordId);
      if(idx>-1){
        const oldRec = JSON.parse(JSON.stringify(DB[moduleId][idx]));
        DB[moduleId][idx] = Object.assign({}, DB[moduleId][idx], data, {updatedAt:Date.now()});
        const updatedRec = DB[moduleId][idx];
        try {
          await window.SIGR.AuditService.register({
            moduleId, recordId, action: 'Registro actualizado',
            oldValue: oldRec, newValue: DB[moduleId][idx], description: 'Datos del registro modificados'
          });
          await window.SIGR.AuditService.snapshot(m, oldRec);
          await window.SIGR.StorageService.saveVersion({
            recordId, moduleId, date: Date.now(), snapshot: JSON.parse(JSON.stringify(oldRec)),
            label: 'Antes de editar: ' + new Date().toLocaleString('es-ES')
          });
          await window.SIGR.ActivityService.log('RECORD_UPDATED', {
            moduleId, recordId, recordTitle: data[m.titleField]||'(Sin título)',
            moduleName: m.name, description: `Registro actualizado en ${m.name}`
          });
          await appendMovementForRecord(m, updatedRec, {
            type: 'seguimiento',
            description: 'Registro actualizado.',
            status: 'actualizado',
            category: 'auditoria',
            user: updatedRec.createdBy || 'Usuario'
          });
          const statusField = m.fields.find(f=>f.statusField);
          if(statusField && oldRec[statusField.key] !== updatedRec[statusField.key]){
            await appendMovementForRecord(m, updatedRec, {
              type: 'seguimiento',
              description: `Estado cambiado de ${oldRec[statusField.key] || 'N/A'} a ${updatedRec[statusField.key] || 'N/A'}.`,
              status: updatedRec[statusField.key] || '',
              category: 'estado',
              user: updatedRec.createdBy || 'Usuario'
            });
            if(m.id === 'pagos' && (updatedRec.estado === 'Pagado' || updatedRec.estado === 'Recibido')){
              await appendMovementForRecord(m, updatedRec, {
                type: 'cobro',
                description: `Pago confirmado${moneyLabel(updatedRec.monto) ? ': ' + moneyLabel(updatedRec.monto) : ''}.`,
                status: 'completado',
                amount: updatedRec.monto || null,
                category: 'financiero',
                subcategory: 'confirmacion',
                user: updatedRec.createdBy || 'Usuario'
              });
            }
          }
          await registerFormWorkflow(m, updatedRec, data);
        } catch(e) {}
      }
    } else {
      const now = Date.now();
      const newRec = Object.assign({
        id: uid(), code: recCode(), createdAt: now, updatedAt: now,
        favorite: false, archived: false, deleted: false,
        color: data.color || m.hex, createdBy: data.createdBy || 'Usuario',
        assignedTo: data.assignedTo || '',
        empresa: data.empresa || '', sucursal: data.sucursal || '',
        observaciones: data.observaciones || '', privateNotes: data.privateNotes || '',
        attachments: [], comments: [], gps: data.gps || null
      }, data);
      newRec.privateNotes = data.privateNotes || '';
      newRec.observaciones = data.observaciones || '';
      DB[moduleId].unshift(newRec);
      
      try {
        await window.SIGR.ActivityService.log('RECORD_CREATED', {
          moduleId, recordId: newRec.id, recordTitle: data[m.titleField]||'(Sin título)',
          moduleName: m.name, description: `Registro creado en ${m.name}`
        });
        await appendMovementForRecord(m, newRec, {
          date: now,
          user: newRec.createdBy || 'Usuario',
          description: 'Registro creado.',
          type: 'general',
          status: 'activo',
          category: 'expediente',
          priority: newRec.prioridad || 'normal'
        });
        if(m.id === 'pagos') await registerPaymentWorkflow(m, newRec);
        await registerFormWorkflow(m, newRec, data);
      } catch(e) {}
    }
    await persist(moduleId);
    showToast(recordId ? 'Cambios guardados' : 'Registro creado');
    window.SIGR.StateService._navStack = window.SIGR.StateService._navStack.filter(s=>s.view!=='form');
    window.SIGR.StateService.setAll({view:'list', moduleId, filter:'all', recordId:null, search:''});
  }
  
  async function toggleFav(mod,id){
    const r = (DB[mod]||[]).find(x=>x.id===id); if(!r) return;
    r.favorite = !r.favorite; r.updatedAt = Date.now();
    await persist(mod); showToast(r.favorite?'Añadido a favoritos':'Quitado de favoritos');
  }
  
  async function toggleArchive(mod,id){
    const r = (DB[mod]||[]).find(x=>x.id===id); if(!r) return;
    r.archived = !r.archived; r.updatedAt = Date.now();
    await persist(mod); showToast(r.archived?'Archivado':'Desarchivado');
    window.SIGR.StateService._navStack = window.SIGR.StateService._navStack.filter(s=>s.view!=='detail');
    window.SIGR.StateService.setAll({view:'list', moduleId:mod, filter:'all', recordId:null, search:''});
  }
  
  async function deleteRecordAction(mod,id){
    const r = (DB[mod]||[]).find(x=>x.id===id); if(!r) return;
    r.deleted = true; r.updatedAt = Date.now();
    await persist(mod); showToast('Movido a la papelera');
    await window.SIGR.ActivityService.log('RECORD_DELETED', {
      moduleId:mod, recordId:id, description: 'Registro eliminado'
    }).catch(()=>{});
    window.SIGR.StateService._navStack = window.SIGR.StateService._navStack.filter(s=>s.view!=='detail');
    window.SIGR.StateService.setAll({view:'list', moduleId:mod, filter:'all', recordId:null, search:''});
  }
  
  async function restoreRecordAction(mod,id){
    const r = (DB[mod]||[]).find(x=>x.id===id); if(!r) return;
    r.deleted = false; r.updatedAt = Date.now();
    await persist(mod); showToast('Registro restaurado');
    window.SIGR.StateService._navStack = window.SIGR.StateService._navStack.filter(s=>s.view!=='detail');
    window.SIGR.StateService.setAll({view:'list', moduleId:mod, filter:'trash', recordId:null, search:''});
  }
  
  async function permaDeleteAction(mod,id){
    DB[mod] = (DB[mod]||[]).filter(x=>x.id!==id);
    await persist(mod); showToast('Eliminado permanentemente');
    window.SIGR.StateService._navStack = window.SIGR.StateService._navStack.filter(s=>s.view!=='detail');
    window.SIGR.StateService.setAll({view:'list', moduleId:mod, filter:'trash', recordId:null, search:''});
  }
  
  async function emptyAllTrashAction(){
    for(const m of MODULES){
      DB[m.id] = (DB[m.id]||[]).filter(r=>!r.deleted);
      await persist(m.id);
    }
    showToast('Todas las papeleras vaciadas');
  }
  
  async function deleteAllMovements(mod, id){
    window.showConfirm('¿Eliminar todos los movimientos de este expediente? Esta acción no se puede deshacer.', 'Eliminar todo', async () => {
      try {
        const movements = await window.SIGR.StorageService.getMovements(id);
        for(const m of movements){
          await window.SIGR.StorageService.deleteMovement(m.id);
        }
        window.showToast(`${movements.length} movimiento(s) eliminados`);
        window.SIGR.DetailView.refreshTab();
      } catch(e) { window.showToast('Error al eliminar movimientos'); }
    });
  }
  
  /* ============ MOVEMENTS ============ */
  function openMovementModal(mod, id){
    const container = document.getElementById('detailModalContainer') || document.getElementById('app');
    const div = document.createElement('div');
    div.id = 'movementModalWrap';
    div.innerHTML = window.SIGR.MovementFormComponent.render(null, mod, id);
    container.appendChild(div);
    attachHandlers();
    attachGlobalEvents();
  }
  
  async function saveMovement(mod, id){
    const data = window.SIGR.MovementFormComponent.collect();
    if(!data.desc || !data.desc.trim()){ showToast('Describe el movimiento'); return; }
    
    const m = modOf(mod);
    const rec = (DB[mod]||[]).find(r => r.id === id);
    
    const mov = {
      moduleId: mod, recordId: id,
      recordTitle: rec && m ? recordTitle(m, rec) : '',
      user: data.user || 'Usuario',
      description: data.desc.trim(),
      type: data.type || 'general',
      motivo: data.motivo || '',
      observaciones: data.obs || '',
      status: data.status || '',
      priority: data.priority || 'normal',
      amount: data.amount || null,
      currency: data.currency || 'RD$',
      client: data.client || '',
      provider: data.provider || '',
      responsable: data.responsable || '',
      files: data.files || [],
      photos: data.photos || [],
      pdfs: data.pdfs || [],
      audio_items: data.audio_items || [],
      video_items: data.video_items || [],
      signature: data.signature || null,
      date: data.date ? new Date(data.date).getTime() : Date.now(),
      time: data.time || new Date().toTimeString().slice(0,5)
    };
    
    try {
      await window.SIGR.StorageService.addMovement(mov);
      await window.SIGR.ActivityService.movementAdded(
        m, rec || { id, [m?.titleField]: '' }, mov
      );
      if(rec){
        rec.updatedAt = Date.now();
        await persist(mod);
      }
      showToast('Movimiento ' + mov.code + ' registrado');
    } catch(e) { showToast('Error al guardar movimiento'); }
    
    closeModal();
    window.SIGR.DetailView.refreshTab();
  }
  
  async function updateMovement(el){
    const movId = el.dataset.movId;
    if(!movId) return;
    const data = window.SIGR.MovementFormComponent.collect();
    if(!data.desc || !data.desc.trim()){ showToast('Describe el movimiento'); return; }
    
    try {
      const mov = await window.SIGR.StorageService.getMovementById(movId);
      if(!mov) { showToast('Movimiento no encontrado'); return; }
      
      const changes = [];
      const oldDesc = mov.description; const newDesc = data.desc.trim();
      if(oldDesc !== newDesc) changes.push({ field:'description', old:oldDesc, new:newDesc, date:Date.now(), user:'Usuario' });
      
      mov.description = newDesc;
      mov.motivo = data.motivo || '';
      mov.observaciones = data.obs || '';
      mov.status = data.status || '';
      mov.priority = data.priority || 'normal';
      mov.amount = data.amount || null;
      mov.currency = data.currency || 'RD$';
      mov.client = data.client || '';
      mov.provider = data.provider || '';
      mov.responsable = data.responsable || '';
      mov.user = data.user || mov.user;
      mov.type = data.type || mov.type;
      mov.date = data.date ? new Date(data.date).getTime() : mov.date;
      mov.time = data.time || mov.time;
      if(data.files && data.files.length) mov.files = (mov.files||[]).concat(data.files);
      if(data.photos && data.photos.length) mov.photos = (mov.photos||[]).concat(data.photos);
      if(data.pdfs && data.pdfs.length) mov.pdfs = (mov.pdfs||[]).concat(data.pdfs);
      if(data.audio_items && data.audio_items.length) mov.audio_items = (mov.audio_items||[]).concat(data.audio_items);
      if(data.video_items && data.video_items.length) mov.video_items = (mov.video_items||[]).concat(data.video_items);
      if(data.signature) mov.signature = data.signature;
      if(changes.length) mov.changeHistory = (mov.changeHistory||[]).concat(changes);
      
      await window.SIGR.StorageService.updateMovement(mov);
      showToast('Movimiento ' + (mov.code||'') + ' actualizado');
    } catch(e) { showToast('Error al actualizar'); }
    
    closeModal();
    window.SIGR.DetailView.refreshTab();
  }
  
  function toggleMovDetails(el){
    const movId = el.dataset.movId;
    if(!movId) return;
    const extra = document.getElementById('tlExtra-' + movId);
    if(!extra) return;
    const isHidden = extra.style.display === 'none' || !extra.style.display;
    extra.style.display = isHidden ? 'block' : 'none';
    el.textContent = isHidden ? '▲ Ocultar detalles' : '▼ Ver detalles';
  }
  
  function openEditMovementModal(el){
    const movId = el.dataset.movId;
    if(!movId) return;
    window.SIGR.StorageService.getMovementById(movId).then(mov => {
      if(!mov) { showToast('Movimiento no encontrado'); return; }
      const container = document.getElementById('detailModalContainer') || document.getElementById('app');
      const div = document.createElement('div');
      div.id = 'movementModalWrap';
      div.innerHTML = window.SIGR.MovementFormComponent.render(mov, mov.moduleId, mov.recordId);
      container.appendChild(div);
      attachHandlers();
      attachGlobalEvents();
    });
  }
  
  function printMovement(el){
    const movId = el.dataset.movId;
    if(!movId) return;
    window.SIGR.StorageService.getMovementById(movId).then(mov => {
      if(!mov) { showToast('Movimiento no encontrado'); return; }
      const w = window.open('', '_blank');
      if(!w) { showToast('Permite ventanas emergentes'); return; }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${mov.code||'Movimiento'}</title><style>body{font-family:sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto}h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:10px}.row{margin:8px 0;display:flex}.row strong{min-width:140px}.desc{margin:16px 0;padding:12px;background:#f5f5f5;border-radius:6px}.footer{margin-top:30px;font-size:12px;color:#666}</style></head><body>
        <h1>${esc(mov.code||'Movimiento')}</h1>
        <div class="row"><strong>Fecha:</strong> ${new Date(mov.date).toLocaleString('es-ES')}</div>
        <div class="row"><strong>Tipo:</strong> ${esc(mov.type||'')}</div>
        <div class="row"><strong>Estado:</strong> ${esc(mov.status||'')}</div>
        <div class="row"><strong>Usuario:</strong> ${esc(mov.user||'')}</div>
        <div class="row"><strong>Responsable:</strong> ${esc(mov.responsable||'')}</div>
        ${mov.amount ? `<div class="row"><strong>Monto:</strong> ${esc(mov.currency||'')} ${Number(mov.amount).toLocaleString()}</div>` : ''}
        ${mov.client ? `<div class="row"><strong>Cliente:</strong> ${esc(mov.client)}</div>` : ''}
        ${mov.provider ? `<div class="row"><strong>Proveedor:</strong> ${esc(mov.provider)}</div>` : ''}
        <div class="desc"><strong>Descripción:</strong><br>${esc(mov.description||'')}</div>
        ${mov.motivo ? `<div class="row"><strong>Motivo:</strong> ${esc(mov.motivo)}</div>` : ''}
        ${mov.observaciones ? `<div class="row"><strong>Observaciones:</strong> ${esc(mov.observaciones)}</div>` : ''}
        <div class="footer">SIGR Pro - Documento generado el ${new Date().toLocaleString('es-ES')}</div>
      </body></html>`);
      w.document.close();
      w.print();
    });
  }
  
  async function deleteSingleMovement(el){
    const movId = el.dataset.movId;
    if(!movId) return;
    window.showConfirm('¿Eliminar este movimiento de la bitácora?', 'Eliminar', async () => {
      try {
        await window.SIGR.StorageService.deleteMovement(movId);
        window.showToast('Movimiento eliminado');
        window.SIGR.DetailView.refreshTab();
      } catch(e) { window.showToast('Error al eliminar'); }
    });
  }
  
  function toggleMovSection(el){
    const id = el.dataset.section;
    if(!id) return;
    const body = document.getElementById(id);
    if(!body) return;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open');
    el.classList.toggle('open');
  }
  
  /* ============ REMINDERS ============ */
  function openReminderModal(mod, id){
    const container = document.getElementById('detailModalContainer') || document.getElementById('app');
    const div = document.createElement('div');
    div.id = 'reminderModalWrap';
    div.innerHTML = window.SIGR.ReminderFormComponent.render({
      date: new Date().toISOString().slice(0,10),
      time: new Date().toTimeString().slice(0,5)
    });
    container.appendChild(div);
    attachHandlers();
    attachGlobalEvents();
  }
  
  async function saveReminder(mod, id){
    const title = document.getElementById('remTitle')?.value;
    if(!title || !title.trim()){ showToast('Ingresa un título'); return; }
    
    const channels = [];
    document.querySelectorAll('.remChannel:checked').forEach(c => channels.push(c.value));
    if(channels.length === 0) channels.push('notification');
    
    const colorRow = document.getElementById('remColorRow');
    let color = '#9C8CFF';
    if(colorRow){
      const active = colorRow.querySelector('.color-opt.on');
      if(active) color = active.dataset.color;
    }
    
    const m = modOf(mod);
    const rec = m ? (DB[mod]||[]).find(r => r.id === id) : null;
    
    const reminder = {
      moduleId: mod, recordId: id,
      recordTitle: rec ? (rec[m.titleField] || '(Sin título)') : '',
      moduleName: m ? m.name : '',
      title: title.trim(),
      message: document.getElementById('remMessage')?.value || '',
      date: document.getElementById('remDate')?.value || new Date().toISOString().slice(0,10),
      time: document.getElementById('remTime')?.value || '09:00',
      priority: document.getElementById('remPriority')?.value || 'media',
      frequency: document.getElementById('remFrequency')?.value || 'once',
      channels: channels,
      color: color,
      category: document.getElementById('remCategory')?.value || '',
      observations: document.getElementById('remObs')?.value || ''
    };
    
    try {
      const createdReminder = await window.SIGR.ReminderService.create(reminder);
      if(m && rec){
        await appendMovementForRecord(m, rec, {
          type: 'pendiente',
          description: `Recordatorio creado: ${createdReminder.title}.`,
          status: 'pendiente',
          priority: createdReminder.priority,
          category: 'recordatorio',
          subcategory: createdReminder.category || '',
          comment: `${createdReminder.date} ${createdReminder.time}`,
          user: 'Usuario'
        });
      }
      showToast('Recordatorio creado');
    } catch(e) { showToast('Error al crear recordatorio'); }
    
    closeModal();
    window.SIGR.DetailView.refreshTab();
  }
  
  async function completeReminder(id){
    try {
      const rem = await window.SIGR.ReminderService.complete(id);
      if(rem?.moduleId && rem?.recordId){
        const m = modOf(rem.moduleId);
        const rec = (DB[rem.moduleId]||[]).find(r => r.id === rem.recordId);
        await appendMovementForRecord(m, rec, {
          type: 'seguimiento',
          description: `Recordatorio completado: ${rem.title}.`,
          status: 'completado',
          category: 'recordatorio',
          user: 'Usuario'
        }).catch(()=>{});
      }
      showToast('Recordatorio completado');
      const tab = document.querySelector('[data-tab="reminders"]');
      if(tab) window.SIGR.DetailView.refreshTab();
      else render();
    } catch(e) { showToast('Error'); }
  }
  
  async function snoozeReminder(id){
    try {
      const rem = await window.SIGR.ReminderService.snooze(id, 10);
      if(rem?.moduleId && rem?.recordId){
        const m = modOf(rem.moduleId);
        const rec = (DB[rem.moduleId]||[]).find(r => r.id === rem.recordId);
        await appendMovementForRecord(m, rec, {
          type: 'seguimiento',
          description: `Recordatorio pospuesto 10 minutos: ${rem.title}.`,
          status: 'pospuesto',
          category: 'recordatorio',
          user: 'Usuario'
        }).catch(()=>{});
      }
      showToast('Pospuesto 10 minutos');
      const tab = document.querySelector('[data-tab="reminders"]');
      if(tab) window.SIGR.DetailView.refreshTab();
      else render();
    } catch(e) { showToast('Error'); }
  }
  
  async function deleteReminder(id){
    try {
      await window.SIGR.ReminderService.delete(id);
      showToast('Recordatorio eliminado');
      const remindersView = document.querySelector('.reminder-list-wide');
      if(remindersView) render();
      else window.SIGR.DetailView.refreshTab();
    } catch(e) { showToast('Error'); }
  }
  
  async function filterReminders(filter){
    document.querySelectorAll('.filter-row .chip').forEach(c => c.classList.remove('on'));
    document.querySelector(`[data-action="filterReminders"][data-filter="${filter}"]`)?.classList.add('on');
    await window.SIGR.RemindersView.filterList(filter);
  }
  
  async function filterNotifs(filter){
    await window.SIGR.NotificationsCenterView.filterList(filter);
  }
  
  /* ============ COMMENTS ============ */
  async function addComment(mod, id){
    const text = document.getElementById('newComment')?.value;
    if(!text || !text.trim()) return;
    const rec = (DB[mod]||[]).find(r => r.id === id);
    if(!rec) return;
    if(!rec.comments) rec.comments = [];
    rec.comments.unshift({ id: uid(), user: 'Usuario', text: text.trim(), date: Date.now() });
    rec.updatedAt = Date.now();
    await persist(mod);
    showToast('Comentario agregado');
    document.getElementById('newComment').value = '';
    
    await window.SIGR.ActivityService.log('COMMENT_ADDED', {
      moduleId: mod, recordId: id, recordTitle: rec[modOf(mod)?.titleField]||'(Sin título)',
      moduleName: modOf(mod)?.name||'', description: 'Comentario agregado'
    }).catch(()=>{});
    await appendMovementForRecord(modOf(mod), rec, {
      type: 'nota',
      description: 'Comentario agregado.',
      comment: text.trim(),
      category: 'comentario',
      status: 'registrado',
      user: 'Usuario'
    }).catch(()=>{});
    
    const tab = document.querySelector('[data-tab="comments"]');
    if(tab) render();
  }
  
  /* ============ RELATIONS ============ */
  function openRelationModal(mod, id){
    const modules = MODULES.filter(m => {
      return (DB[m.id]||[]).filter(r => !r.deleted && !r.archived && r.id !== id).length > 0;
    });
    
    if(modules.length === 0){ showToast('No hay otros registros disponibles'); return; }
    
    let html = `<div class="modal-over" id="relationModal" style="z-index:60">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Relacionar registro</h3>
          <button class="modal-close" data-action="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Módulo</label>
            <select id="relModule">
              <option value="">Selecciona...</option>
              ${modules.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Registro</label>
            <select id="relRecord"><option value="">Primero selecciona un módulo</option></select>
          </div>
          <div class="field">
            <label>Tipo de relación</label>
            <select id="relType">
              <option value="relacionado">Relacionado</option>
              <option value="padre">Padre / contiene</option>
              <option value="hijo">Hijo / pertenece a</option>
              <option value="referencia">Referencia cruzada</option>
              <option value="dependencia">Dependencia</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
          <button class="btn btn-primary" data-action="saveRelation" data-mod="${mod}" data-id="${id}" style="--mc:#9C8CFF">Relacionar</button>
        </div>
      </div>
    </div>`;
    
    const container = document.getElementById('detailModalContainer') || document.getElementById('app');
    const div = document.createElement('div');
    div.innerHTML = html;
    container.appendChild(div);
    
    const relMod = document.getElementById('relModule');
    relMod.onchange = () => {
      const sel = document.getElementById('relRecord');
      const mId = relMod.value;
      const recs = (DB[mId]||[]).filter(r => !r.deleted && !r.archived && r.id !== id);
      const m = modOf(mId);
      sel.innerHTML = recs.map(r => `<option value="${r.id}">${esc(r[m?.titleField||'titulo']||'(Sin título)')}</option>`).join('') || '<option value="">Sin registros disponibles</option>';
    };
  }
  
  async function saveRelation(el){
    const mod = el.dataset.mod, id = el.dataset.id;
    const targetModule = document.getElementById('relModule')?.value;
    const targetRecord = document.getElementById('relRecord')?.value;
    const relType = document.getElementById('relType')?.value || 'relacionado';
    
    if(!targetModule || !targetRecord){ showToast('Selecciona módulo y registro'); return; }
    
    const m = modOf(targetModule);
    const rec = (DB[targetModule]||[]).find(r => r.id === targetRecord);
    const sourceMod = modOf(mod);
    const sourceRec = (DB[mod]||[]).find(r => r.id === id);
    
    try {
      await window.SIGR.StorageService.addRelation({
        recordId: id, targetRecordId: targetRecord, targetModuleId: targetModule,
        targetTitle: rec ? rec[m?.titleField||'titulo'] : 'Registro',
        type: relType, date: Date.now()
      });
      await window.SIGR.ActivityService.log('RELATION_ADDED', {
        moduleId: mod, recordId: id, description: 'Relación agregada',
        metadata: { targetModule, targetRecord, relType }
      }).catch(()=>{});
      await appendMovementForRecord(sourceMod, sourceRec, {
        type: 'seguimiento',
        description: `Registro relacionado con ${rec ? recordTitle(m, rec) : 'otro expediente'}.`,
        status: 'registrado',
        category: 'relacion',
        subcategory: relType,
        user: 'Usuario'
      }).catch(()=>{});
      showToast('Registro relacionado');
      closeModal();
      window.SIGR.DetailView.refreshTab();
    } catch(e) { showToast('Error al relacionar'); }
  }
  
  async function removeRelation(relationId){
    try {
      await window.SIGR.StorageService.removeRelation(relationId);
      showToast('Relación eliminada');
      window.SIGR.DetailView.refreshTab();
    } catch(e) { showToast('Error'); }
  }
  
  /* ============ VERSIONS ============ */
  async function restoreVersion(verId, mod, id){
    try {
      const versions = await window.SIGR.StorageService.getVersions(id);
      const ver = versions.find(v => v.id === verId);
      if(!ver || !ver.snapshot) { window.showToast('Versión no encontrada'); return; }
      
      window.showConfirm('¿Restaurar esta versión? Se perderán los cambios posteriores.', 'Restaurar', async () => {
        try {
          const idx = DB[mod].findIndex(r => r.id === id);
          if(idx === -1) return;
          const currentSnapshot = JSON.parse(JSON.stringify(DB[mod][idx]));
          await window.SIGR.StorageService.saveVersion({
            recordId: id, moduleId: mod, date: Date.now(), snapshot: currentSnapshot,
            label: 'Antes de restaurar: ' + new Date().toLocaleString('es-ES')
          });
          DB[mod][idx] = Object.assign({}, ver.snapshot, { updatedAt: Date.now() });
          await persist(mod);
          window.showToast('Versión restaurada');
          await window.SIGR.ActivityService.log('VERSION_RESTORED', {
            moduleId: mod, recordId: id, description: 'Versión anterior restaurada'
          }).catch(()=>{});
          render();
        } catch(e) { window.showToast('Error al restaurar'); }
      });
    } catch(e) { window.showToast('Error al cargar versión'); }
  }
  
  /* ============ RECORD SETTINGS ============ */
  async function saveRecordSettings(mod, id){
    const rec = (DB[mod]||[]).find(r => r.id === id);
    if(!rec) return;
    
    rec.code = document.getElementById('recCode')?.value || rec.code;
    const colorRow = document.getElementById('recColorRow');
    if(colorRow){
      const active = colorRow.querySelector('.color-opt.on');
      if(active) rec.color = active.dataset.color;
    }
    rec.empresa = document.getElementById('recEmpresa')?.value || '';
    rec.sucursal = document.getElementById('recSucursal')?.value || '';
    rec.assignedTo = document.getElementById('recAssignedTo')?.value || '';
    rec.privateNotes = document.getElementById('recPrivateNotes')?.value || '';
    rec.updatedAt = Date.now();
    
    await persist(mod);
    showToast('Configuración guardada');
    render();
  }
  
  /* ============ GPS ============ */
  async function getCurrentPosition(){
    if(!navigator.geolocation){ showToast('GPS no disponible'); return; }
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true, timeout:10000}));
      const loc = document.getElementById('movLocation');
      if(loc) loc.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      const formLoc = document.getElementById('fGps');
      if(formLoc) formLoc.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      showToast('Ubicación obtenida');
    } catch(e) { showToast('No se pudo obtener ubicación'); }
  }
  
  /* ============ SIGNATURE ============ */
  let sigCanvas = null, sigCtx = null, isDrawing = false;
  
  function toggleSignatureModal(){
    const preview = document.getElementById('movSignaturePreview');
    if(!preview) return;
    const img = document.getElementById('movSignatureImg');
    const canvas = document.getElementById('sigCanvas');
    const wasHidden = preview.style.display === 'none' || !preview.style.display;
    preview.style.display = wasHidden ? 'block' : 'none';
    if(wasHidden && canvas){
      if(img && img.style.display !== 'none') {
        canvas.style.display = 'none';
        return;
      }
      canvas.style.display = 'block';
      sigCanvas = canvas;
      sigCtx = canvas.getContext('2d');
      sigCtx.strokeStyle = '#000';
      sigCtx.lineWidth = 2;
      sigCtx.lineCap = 'round';
      
      canvas.onmousedown = () => { isDrawing = true; };
      canvas.onmousemove = (e) => {
        if(!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        sigCtx.stroke();
      };
      canvas.onmouseup = () => { isDrawing = false; sigCtx.beginPath(); };
      canvas.ontouchstart = (e) => { isDrawing = true; const t=e.touches[0]; sigCtx.moveTo(t.clientX - canvas.getBoundingClientRect().left, t.clientY - canvas.getBoundingClientRect().top); };
      canvas.ontouchmove = (e) => {
        if(!isDrawing) return;
        const t = e.touches[0]; const rect = canvas.getBoundingClientRect();
        sigCtx.lineTo(t.clientX - rect.left, t.clientY - rect.top);
        sigCtx.stroke();
      };
      canvas.ontouchend = () => { isDrawing = false; sigCtx.beginPath(); };
    }
  }
  
  function clearSignature(){
    if(sigCtx && sigCanvas){
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
  }
  
  /* ============ FILE ATTACH ============ */
  function triggerFileAttach(mod, id){
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.mp3,.wav,.mp4,.txt';
    input.onchange = async () => {
      const rec = (DB[mod]||[]).find(r => r.id === id);
      if(!rec || !input.files.length) return;
      if(!rec.attachments) rec.attachments = [];
      Array.from(input.files).slice(0,10).forEach(f => {
        rec.attachments.push({ id: uid(), name: f.name, type: f.type, size: (f.size/1024).toFixed(1)+'KB', date: Date.now() });
      });
      rec.updatedAt = Date.now();
      await persist(mod);
      showToast(`${Math.min(input.files.length,10)} archivo(s) adjuntado(s)`);
      await window.SIGR.ActivityService.fileAttached(modOf(mod), rec, input.files[0].name).catch(()=>{});
      await appendMovementForRecord(modOf(mod), rec, {
        type: 'documento',
        description: `${Math.min(input.files.length,10)} archivo(s) adjuntado(s).`,
        status: 'registrado',
        category: 'archivo',
        subcategory: 'adjunto',
        files: Array.from(input.files).slice(0,10).map(f => ({ name: f.name, type: f.type, size: (f.size/1024).toFixed(1)+'KB' })),
        user: 'Usuario'
      }).catch(()=>{});
      render();
    };
    input.click();
  }
  
  /* ============ CONFIRM ============ */
  function showConfirm(msg, confirmLabel, onConfirm){
    const body = '<div style="text-align:center;padding:20px 8px"><div style="font-size:42px;margin-bottom:12px">\u26A0\uFE0F</div><div style="font-size:15px;color:var(--text);line-height:1.5">'+esc(msg)+'</div></div>';
    const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-danger" data-action="confirmAction">'+esc(confirmLabel||'Eliminar')+'</button>';
    window.openModal({ title: 'Confirmar', body, footer, closeOnOverlay: false, onClose: ()=>{ window._confirmCb = null; } });
    window._confirmCb = onConfirm;
  }

  /* ============ MODAL ============ */
  function openModal(config){
    const title = config.title || '';
    const bodyHTML = config.body || '';
    const footerHTML = config.footer;
    const wide = config.wide;
    const closeOnOverlay = config.closeOnOverlay !== false;
    const onClose = config.onClose;
    const overlayClick = closeOnOverlay ? 'onclick="if(event.target===this)window.closeModal()"' : '';
    const footer = footerHTML !== undefined
      ? '<div class="modal-footer">'+footerHTML+'</div>'
      : '<div class="modal-footer"><button class="btn" data-action="closeModal">Cerrar</button></div>';
    const html =
      '<div class="modal-over" '+overlayClick+'><div class="modal-card'+(wide?' modal-card-wide':'')+'">'+
      '<div class="modal-header"><h3 class="modal-title">'+esc(title)+'</h3><button class="modal-close" data-action="closeModal">\u2716</button></div>'+
      '<div class="modal-body">'+bodyHTML+'</div>'+
      footer+
      '</div></div>';
    const modal = document.getElementById('modal');
    if(modal){ modal.innerHTML = html; modal.classList.add('open'); }
    setTimeout(() => {
      const firstInput = modal?.querySelector('input:not([type="hidden"]), textarea, select, button');
      if(firstInput) firstInput.focus();
    }, 100);
    return { close: ()=>{ closeModal(); if(onClose) onClose(); } };
  }
  function closeModal(){
    const wraps = ['movementModalWrap','reminderModalWrap','relationModal'];
    wraps.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.remove();
    });
    const modal = document.getElementById('modal');
    if(modal) modal.classList.remove('open');
    document.querySelectorAll('.modal-overlay, .modal-over').forEach(el => el.remove());
  }
  
  /* ============ TOPBAR ============ */
  function topbar(title, sub, right){
    return `<div class="topbar">
      <button class="back-btn" data-action="back">←</button>
      <div class="topbar-title"><h1>${esc(title)}</h1>${sub?`<div class="sub">${esc(sub)}</div>`:''}</div>
      ${right||''}
    </div>`;
  }
  
  /* ============ SIDEBAR ============ */
  function renderSidebar(){
    const nav = document.getElementById('sidebarNav');
    if(!nav) return;
    const modules = window.SIGR.MODULES || MODULES;
    let html = '<div class="sidebar-section"><div class="sidebar-section-title">Principal</div>';
    html += '<button class="sidebar-item" data-action="goDashboard"><span class="si-icon">\uD83C\uDFE0</span>Dashboard</button>';
    html += '<button class="sidebar-item" data-action="goFinance"><span class="si-icon">\uD83D\uDCB0</span>Finanzas</button>';
    html += '<button class="sidebar-item" data-action="goAgenda"><span class="si-icon">\uD83D\uDCC5</span>Agenda</button>';
    html += '<button class="sidebar-item" data-action="goVault"><span class="si-icon">\uD83D\uDD10</span>B\u00F3veda</button>';
    html += '</div><div class="sidebar-divider"></div>';
    html += '<div class="sidebar-section"><div class="sidebar-section-title">M\u00F3dulos</div>';
    modules.forEach(m => {
      const count = activeRecords(m.id).filter(r=>!r.archived).length;
      html += '<button class="sidebar-item" data-action="openModule" data-mod="'+m.id+'"><span class="si-icon">'+m.icon+'</span>'+esc(m.name)+'<span class="si-count">'+count+'</span></button>';
    });
    html += '</div><div class="sidebar-divider"></div>';
    html += '<div class="sidebar-section"><div class="sidebar-section-title">Sistema</div>';
    html += '<button class="sidebar-item" data-action="goActivity"><span class="si-icon">\uD83D\uDCCA</span>Actividad</button>';
    html += '<button class="sidebar-item" data-action="goReminders"><span class="si-icon">\u23F0</span>Recordatorios</button>';
    html += '<button class="sidebar-item" data-action="goCalendar"><span class="si-icon">\uD83D\uDCC5</span>Calendario</button>';
    html += '<button class="sidebar-item" data-action="goNotifications"><span class="si-icon">\uD83D\uDD14</span>Notificaciones</button>';
    html += '<button class="sidebar-item" data-action="goBackup"><span class="si-icon">\u2601\uFE0F</span>Copias de seguridad</button>';
    html += '<button class="sidebar-item" data-action="goSettings"><span class="si-icon">\u2699\uFE0F</span>Configuraci\u00F3n</button>';
    html += '</div>';
    nav.innerHTML = html;
  }
  function openSidebar(){ renderSidebar(); document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sidebarOverlay')?.classList.add('open'); }
  function closeSidebar(){ document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }
  function toggleSidebar(){ if(document.getElementById('sidebar')?.classList.contains('open')) closeSidebar(); else openSidebar(); }

  /* ============ SYNC STATUS BADGE (floating, always visible) ============ */
  function updateSyncBadge(status){
    if(!status) return;
    const st = status || {};
    const accounts = window.SIGR.GoogleAuthService ? window.SIGR.GoogleAuthService.getAccounts() : [];
    const hasConfig = accounts.length > 0;
    const visible = hasConfig || st.state === 'error' || st.state === 'passphrase-required';
    let badge = document.getElementById('syncBadge');
    if(!badge){
      badge = document.createElement('div');
      badge.id = 'syncBadge';
      badge.addEventListener('click', () => { try { openBackupSettingsView(); } catch(e) {} });
      document.body.appendChild(badge);
    }
    if(!visible){
      badge.style.display = 'none';
      return;
    }
    badge.style.display = 'flex';
    let icon = '\u2601\uFE0F', text = 'Sincronizado', cls = 'ok';
    if(st.state === 'backing-up'){ icon = '\uD83D\uDD04'; text = 'Sincronizando\u2026'; cls = 'sync'; }
    else if(st.state === 'error'){ icon = '\u26A0\uFE0F'; text = 'Error de sincronizaci\u00F3n'; cls = 'err'; }
    else if(st.state === 'passphrase-required'){ icon = '\uD83D\uDD10'; text = 'Contrase\u00F1a requerida'; cls = 'warn'; }
    else if(!navigator.onLine){ icon = '\uD83D\uDEAB'; text = 'Sin conexi\u00F3n'; cls = 'off'; }
    else {
      const last = st.lastResult && st.lastResult.name ? st.lastResult.name : '';
      text = 'Sincronizado' + (last ? ' \u00B7 ' + last : '');
    }
    badge.className = 'sync-badge ' + cls;
    badge.innerHTML = '<span class="sb-icon">' + icon + '</span><span class="sb-text">' + esc(text) + '</span>';
  }

  /* ============ BACKUP SETTINGS VIEW (reusable) ============ */
  async function openBackupSettingsView(){
    const html = await window.SIGR.BackupSettingsView.render();
    const appEl = document.getElementById('app');
    if(appEl) appEl.innerHTML = html;
    attachHandlers();
    attachGlobalEvents();
    const BV = window.SIGR.BackupSettingsView;
    const bi = document.getElementById('bsImportFile');
    if (bi) bi.onchange = () => BV.handleAction({ dataset: { action: 'bsImportFileChosen' } });
  }

  /* ============ GLOBAL SEARCH ============ */
  let searchOpen = false;
  function toggleSearch(){
    const bar = document.getElementById('globalSearchBar');
    const input = document.getElementById('globalSearchInput');
    if(!bar) return;
    searchOpen = !searchOpen;
    bar.classList.toggle('open', searchOpen);
    if(searchOpen && input){ input.focus(); input.select(); }
  }
  function closeSearch(){
    const bar = document.getElementById('globalSearchBar');
    if(bar) bar.classList.remove('open');
    searchOpen = false;
  }
  let searchTimer;
  function handleGlobalSearch(q){
    clearTimeout(searchTimer);
    const state = window.SIGR.StateService.get();
    if(state) state.search = q;
    const cards = document.getElementById('cardsWrap');
    if(cards) cards.style.display = (q && q.trim()) ? 'none' : '';
    searchTimer = setTimeout(async () => {
      const results = document.getElementById('globalResults');
      if(!results) return;
      if(!q || q.trim().length < 1){ results.innerHTML = ''; return; }
      results.innerHTML = '<div style="padding:8px 16px;color:var(--text-faint);font-size:13px">Buscando...</div>';
      try {
        const html = await globalSearchResults(q);
        results.innerHTML = html || '<div class="empty-small" style="padding:20px;text-align:center;color:var(--text-faint)">Sin resultados</div>';
      } catch(e) { results.innerHTML = '<div class="empty-small" style="padding:20px;text-align:center;color:var(--danger)">Error al buscar</div>'; }
    }, 250);
  }

  /* ============ GLOBAL TOPBAR ============ */
  function appTopbar(title, opts){
    opts = opts || {};
    const searchOpen = opts.searchOpen;
    const searchVal = opts.searchVal || '';
    const rightHTML = opts.right || '';
    const hideMenu = opts.hideMenu;
    return '<div class="app-topbar">'+
      '<div class="at-left">'+
      (hideMenu?'':'<button class="at-menu" data-action="toggleSidebar" title="Men\u00FA">\u2630</button>')+
      '<div class="at-title">'+esc(title)+(opts.sub?'<div class="at-sub">'+esc(opts.sub)+'</div>':'')+'</div></div>'+
      '<div class="at-actions">'+
      (opts.onSearch!==false?'<button class="at-search-btn" data-action="toggleSearch" title="Buscar (Ctrl+K)">\uD83D\uDD0D</button>':'')+
      rightHTML+
      '</div>'+
      '<div class="at-search-bar'+(searchOpen?' open':'')+'" id="globalSearchBar">'+
      '<input type="text" id="globalSearchInput" placeholder="Buscar en todos los m\u00F3dulos..." value="'+esc(searchVal)+'">'+
      '<button class="at-menu" data-action="closeSearch" title="Cerrar b\u00FAsqueda">\u2716</button></div></div>';
  }

  /* ============ GENERATE ICONS ============ */
  function generatePwaIcons() {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    sizes.forEach(s => {
      const canvas = document.createElement('canvas');
      canvas.width = s; canvas.height = s;
      const ctx = canvas.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#9C8CFF');
      g.addColorStop(0.5, '#5CA8FF');
      g.addColorStop(1, '#12D68A');
      ctx.fillStyle = '#0A0C12';
      ctx.beginPath();
      ctx.roundRect(0, 0, s, s, s * 0.18);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.roundRect(s*0.09, s*0.09, s*0.82, s*0.82, s*0.14);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#9C8CFF';
      ctx.font = `bold ${s*0.35}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SIGR', s/2, s/2 + 4);
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = canvas.toDataURL('image/png');
      document.head.appendChild(link);
    });
  }
  
  /* ============ INIT ============ */
  window.SIGR = window.SIGR || {};
  window.MODULES = MODULES;
  window.STATUS_COLORS = STATUS_COLORS;
  window.PRI_COLORS = PRI_COLORS;
  window.DB = DB;
  window.esc = esc;
  window.nl2br = nl2br;
  window.fmtDate = fmtDate;
  window.fmtTime = fmtTime;
  window.relTime = relTime;
  window.groupLabel = groupLabel;
  window.topbar = topbar;
  window.back = function(){ window.SIGR.StateService.back(); };
  window.showToast = showToast;
  window.showConfirm = showConfirm;
  window.activeRecords = activeRecords;
  window.pendingCount = pendingCount;
  window.modOf = modOf;
  window.uid = uid;
  window.recCode = recCode;
  window.globalSearchResults = globalSearchResults;
  window.recordCardHtml = recordCardHtml;
  window.collectForm = collectForm;
  window.persist = persist;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openSidebar = openSidebar;
  window.closeSidebar = closeSidebar;
  window.toggleSidebar = toggleSidebar;
  window.handleGlobalSearch = handleGlobalSearch;
  window.appTopbar = appTopbar;
  window.fieldHtml = fieldHtml;
  
  window.SIGR.MODULES = MODULES;
  window.SIGR.STATUS_COLORS = STATUS_COLORS;
  window.SIGR.PRI_COLORS = PRI_COLORS;
  window.SIGR.DB = DB;
  window.SIGR.render = render;
  window.SIGR.attachHandlers = attachHandlers;
  window.SIGR.attachGlobalEvents = attachGlobalEvents;
  window.SIGR.openBackupSettingsView = openBackupSettingsView;
  window.SIGR.showToast = showToast;
  window.SIGR.activeRecords = activeRecords;
  window.SIGR.pendingCount = pendingCount;
  window.SIGR.fmtDate = fmtDate;
  window.SIGR.fmtTime = fmtTime;
  window.SIGR.relTime = relTime;
  window.SIGR.groupLabel = groupLabel;
  window.SIGR.esc = esc;
  window.SIGR.nl2br = nl2br;
  window.SIGR.topbar = topbar;
  window.SIGR.recordCardHtml = recordCardHtml;
  window.SIGR.globalSearchResults = globalSearchResults;
  window.SIGR.collectForm = collectForm;
  window.SIGR.appTopbar = appTopbar;
  window.SIGR.openSidebar = openSidebar;
  window.SIGR.closeSidebar = closeSidebar;
  window.SIGR.modOf = modOf;
  window.SIGR.uid = uid;
  window.SIGR.persist = persist;
  window.SIGR.closeModal = closeModal;
  
  (async function init(){
    try {
      if (!window.SIGR.StorageService) {
        console.error('StorageService not loaded');
        document.getElementById('app').innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-dim)">Error: StorageService no disponible</div>';
        return;
      }
      
      await window.SIGR.StorageService.ready();
      await window.SIGR.PinLock.setup();
      await window.SIGR.PinLock.ensure();
      const appPin = window.SIGR.PinLock.getPin();
      if (appPin) {
        try {
          const bcfg = await window.SIGR.BackupService.getConfig();
          if (!bcfg.passphraseSet) {
            await window.SIGR.BackupService.setPassphraseProtected(appPin);
          } else if (!window.SIGR.BackupService.getPassphrase()) {
            window.SIGR.BackupService.setPassphrase(appPin);
          }
        } catch(e) {}
      }
      await loadAll();
      
      window.SIGR.NotificationService.init();
      console.log('NotificationService native:', window.SIGR.NotificationService.isNative(), 'permission:', window.SIGR.NotificationService.getPermission());
      if (window.SIGR.NotificationService.isNative() || window.SIGR.NotificationService.getPermission() === 'default') {
        const perm = await window.SIGR.NotificationService.requestPermission();
        console.log('Notification permission result:', perm);
        if (perm !== 'granted' && typeof window.showToast === 'function') {
          window.showToast('Notificaciones no disponibles. Actívalas en Configuración > Notificaciones.');
        }
      }
      window.SIGR.SchedulerService.start();
      await window.SIGR.EmailService.loadConfig();
      try {
        await window.SIGR.SyncManager.init();
        window.SIGR.SyncManager.onChange(st => updateSyncBadge(st));
        updateSyncBadge(window.SIGR.SyncManager.getStatus());
      } catch(e) {
        console.warn('SyncManager init:', e);
      }
      
      try { generatePwaIcons(); } catch(e) { console.warn('PWA icons:', e); }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      }
      
      dataReady = true;
      
      window.SIGR.StateService.onChange(() => render());
      render();
    } catch(e){
      console.error('Init error:', e);
      document.getElementById('app').innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--danger)"><div style="font-size:40px;margin-bottom:12px">⚠️</div><div style="font-weight:600;margin-bottom:8px">Error al iniciar</div><div style="color:var(--text-dim);font-size:14px">' + esc(e.message) + '</div></div>';
    }
  })();
})();
