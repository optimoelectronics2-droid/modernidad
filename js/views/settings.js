(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const SettingsView = {
    render: async function() {
      const totalActive = MODULES.reduce((s, m) => s + activeRecords(m.id).filter(r => !r.archived).length, 0);
      const totalTrash = MODULES.reduce((s, m) => s + (DB[m.id] || []).filter(r => r.deleted).length, 0);
      
      let notifConfig = { email: '', timezone: 'America/Santo_Domingo', dateFormat: 'DD/MM/YYYY', workStart: '08:00', workEnd: '18:00', silentStart: '22:00', silentEnd: '07:00', sound: true, vibration: true, syncFreq: '300000', batterySaver: false };
      
      try {
        const saved = await window.SIGR.StorageService.getSetting('notification_config', null);
        if (saved) notifConfig = Object.assign(notifConfig, saved);
      } catch(e) {}
      
      return `<div class="view">
        ${topbar('Configuración', null)}
        
        <div class="settings-section">
          <div class="settings-section-title">⚙ General</div>
          <div class="settings-card" data-action="openSettingsDetail" data-section="notifications">
            <div class="si">🔔</div>
            <div class="st">Notificaciones y recordatorios</div>
            <div class="chev" style="color:var(--text-faint)">›</div>
          </div>
          <div class="settings-card" data-action="openSettingsDetail" data-section="email">
            <div class="si">📧</div>
            <div class="st">Correo electrónico</div>
            <div class="chev" style="color:var(--text-faint)">›</div>
          </div>
          <div class="settings-card" data-action="openSettingsDetail" data-section="security">
            <div class="si">🔒</div>
            <div class="st">Seguridad y privacidad</div>
            <div class="chev" style="color:var(--text-faint)">›</div>
          </div>
          <div class="settings-card" data-action="openSettingsDetail" data-section="appearance">
            <div class="si">🎨</div>
            <div class="st">Apariencia</div>
            <div class="chev" style="color:var(--text-faint)">›</div>
          </div>
          <div class="settings-card" data-action="openBackupSettings" style="border-left:3px solid #12D68A">
            <div class="si">☁️</div>
            <div class="st">Copia de seguridad y sincronización</div>
            <div class="chev" style="color:var(--text-dim)">Google Drive ›</div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="settings-section-title">📊 Sistema</div>
          <div class="settings-card">
            <div class="si">📦</div>
            <div class="st">${MODULES.length} módulos activos</div>
            <div class="chev" style="color:var(--text-faint)">${totalActive} registros</div>
          </div>
          <div class="settings-card">
            <div class="si">🗄</div>
            <div class="st">Papelera</div>
            <div class="chev" style="color:var(--text-dim)">${totalTrash} elementos</div>
          </div>
          <div class="detail-actions" style="padding:8px 0">
            <button class="dact danger" data-action="emptyAllTrash"><span class="di">🗑</span>Vaciar todas las papeleras</button>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="settings-section-title">🔐 Información</div>
          <div class="settings-card" style="flex-direction:column;align-items:flex-start;gap:4px">
            <div class="st">BrayNotas v1.0.0</div>
            <div style="font-size:12px;color:var(--text-faint)">Sistema Inteligente de Gestión de Registros</div>
            <div style="font-size:12px;color:var(--text-faint)">Diseñado para gestión personal y empresarial</div>
          </div>
        </div>
      </div>`;
    },
    
    renderSection: async function(section) {
      switch(section) {
        case 'notifications': return this._renderNotificationSettings();
        case 'email': return this._renderEmailSettings();
        case 'security': return this._renderSecuritySettings();
        case 'appearance': return this._renderAppearanceSettings();
        case 'backup': return await window.SIGR.BackupSettingsView.render();
        default: return '<div>Sección no encontrada</div>';
      }
    },
    
    _renderNotificationSettings: async function() {
      let cfg = { email: '', timezone: 'America/Santo_Domingo', dateFormat: 'DD/MM/YYYY', workStart: '08:00', workEnd: '18:00', silentStart: '22:00', silentEnd: '07:00', sound: true, vibration: true, syncFreq: '300000', batterySaver: false };
      try {
        const saved = await window.SIGR.StorageService.getSetting('notification_config', null);
        if (saved) cfg = Object.assign(cfg, saved);
      } catch(e) {}
      
      let permLabel = 'Pendiente de permiso';
      let permClass = 'warn';
      let granted = false;
      try {
        const ns = window.SIGR.NotificationService;
        if (ns.isNative()) { permLabel = 'Nativo (app)'; permClass = 'ok'; granted = true; }
        else if (ns.canNotify()) { permLabel = 'Activadas ✓'; permClass = 'ok'; granted = true; }
        else if (ns.getPermission() === 'denied') { permLabel = 'Bloqueado por el navegador'; permClass = 'err'; }
        else { permLabel = 'No solicitado todavía'; permClass = 'warn'; }
      } catch(e) {}
      
      return `<div class="view">
        ${topbar('Notificaciones')}
        <div class="form-wrap">
          <div class="settings-card" style="border-left:3px solid ${granted ? 'var(--success,#12D68A)' : 'var(--warning,#F5A623)'}">
            <div style="font-weight:700;font-size:15px;margin-bottom:6px">Notificaciones del sistema</div>
            <div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">Estado: <span class="perm-pill ${permClass}">${permLabel}</span></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" data-action="enableNotifs" style="--mc:#9C8CFF">🔔 Activar notificaciones</button>
              <button class="btn btn-sm" data-action="testNotification">🧪 Probar notificación</button>
            </div>
            <div style="font-size:11.5px;color:var(--text-dim);margin-top:10px;line-height:1.5">Las notificaciones reales (toque + sonido) aparecen aunque estés en otra pestaña, si instalas la app: menú ⋮ › <b>Instalar aplicación</b> ó <b>Añadir a pantalla de inicio</b>.</div>
          </div>
          <div class="field">
            <label>Correo principal para notificaciones</label>
            <input type="email" id="cfgNotifEmail" value="${cfg.email}" placeholder="tucorreo@ejemplo.com">
          </div>
          <div class="field">
            <label>Zona horaria</label>
            <select id="cfgTimezone">
              ${['America/Santo_Domingo','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Puerto_Rico','America/Havana','America/Mexico_City','America/Bogota','America/Lima','America/Santiago','America/Buenos_Aires','America/Sao_Paulo','Europe/Madrid','Atlantic/Canary'].map(tz =>
                `<option value="${tz}" ${cfg.timezone===tz?'selected':''}>${tz.replace('_',' ').split('/').slice(1).join('/')||tz}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Formato de fecha</label>
              <select id="cfgDateFormat">
                <option value="DD/MM/YYYY" ${cfg.dateFormat==='DD/MM/YYYY'?'selected':''}>DD/MM/AAAA</option>
                <option value="MM/DD/YYYY" ${cfg.dateFormat==='MM/DD/YYYY'?'selected':''}>MM/DD/AAAA</option>
                <option value="YYYY-MM-DD" ${cfg.dateFormat==='YYYY-MM-DD'?'selected':''}>AAAA-MM-DD</option>
              </select>
            </div>
            <div class="field">
              <label>Frecuencia de sincronización</label>
              <select id="cfgSyncFreq">
                <option value="60000" ${cfg.syncFreq==='60000'?'selected':''}>Cada minuto</option>
                <option value="300000" ${cfg.syncFreq==='300000'?'selected':''}>Cada 5 minutos</option>
                <option value="600000" ${cfg.syncFreq==='600000'?'selected':''}>Cada 10 minutos</option>
                <option value="1800000" ${cfg.syncFreq==='1800000'?'selected':''}>Cada 30 minutos</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Horario laboral inicio</label>
              <input type="time" id="cfgWorkStart" value="${cfg.workStart}">
            </div>
            <div class="field">
              <label>Horario laboral fin</label>
              <input type="time" id="cfgWorkEnd" value="${cfg.workEnd}">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Silencio inicio</label>
              <input type="time" id="cfgSilentStart" value="${cfg.silentStart}">
            </div>
            <div class="field">
              <label>Silencio fin</label>
              <input type="time" id="cfgSilentEnd" value="${cfg.silentEnd}">
            </div>
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Sonido de notificaciones</span>
              <input type="checkbox" id="cfgSound" ${cfg.sound?'checked':''}>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Vibración</span>
              <input type="checkbox" id="cfgVibration" ${cfg.vibration?'checked':''}>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Modo ahorro de batería</span>
              <input type="checkbox" id="cfgBatterySaver" ${cfg.batterySaver?'checked':''}>
              <span class="toggle-track"></span>
            </label>
          </div>
          <button class="btn btn-primary" data-action="saveNotifConfig" style="--mc:#9C8CFF;margin-top:8px">Guardar configuración</button>
        </div>
      </div>`;
    },
    
    _renderEmailSettings: function() {
      return `<div class="view">
        ${topbar('Configuración de correo')}
        <div class="form-wrap">
          <div class="empty" style="padding:20px">
            <div class="eicon">📧</div>
            <div class="etitle">Configura tu proveedor de correo</div>
            <div class="etext">Los recordatorios podrán enviarse automáticamente por correo electrónico.<br><br>
            Compatible con:<br>
            • SMTP (Gmail, Outlook, etc.)<br>
            • SendGrid API<br>
            • Mailgun API<br>
            • OAuth 2.0<br><br>
            No almacenamos contraseñas en texto plano.<br>
            Los datos se guardan cifrados localmente.</div>
          </div>
          <div class="field">
            <label>Proveedor</label>
            <select id="cfgEmailProvider">
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
              <option value="mailgun">Mailgun</option>
              <option value="oauth">OAuth 2.0</option>
            </select>
          </div>
          <div class="field">
            <label>Correo remitente</label>
            <input type="email" id="cfgEmailFrom" placeholder="tu@correo.com">
          </div>
          <div class="field">
            <label>Nombre remitente</label>
            <input type="text" id="cfgEmailName" placeholder="Tu nombre o empresa">
          </div>
          <div class="field" id="smtpHostField">
            <label>Servidor SMTP</label>
            <input type="text" id="cfgSmtpHost" placeholder="smtp.gmail.com">
          </div>
          <div class="field-row" id="smtpPortField">
            <div class="field">
              <label>Puerto</label>
              <input type="number" id="cfgSmtpPort" placeholder="587" value="587">
            </div>
            <div class="field" style="justify-content:flex-end;display:flex">
              <label class="toggle-row" style="padding-top:20px">
                <span>Conexión segura</span>
                <input type="checkbox" id="cfgSmtpSecure" checked>
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
          <div class="field">
            <label>API Key (para SendGrid/Mailgun)</label>
            <input type="password" id="cfgApiKey" placeholder="• • • • • • • •">
          </div>
          <button class="btn btn-primary" data-action="saveEmailConfig" style="--mc:#5CA8FF;margin-top:8px">Guardar configuración de correo</button>
          <button class="btn btn-ghost" data-action="testEmail" style="margin-top:8px">Enviar correo de prueba</button>
        </div>
      </div>`;
    },
    
    _renderSecuritySettings: function() {
      return `<div class="view">
        ${topbar('Seguridad')}
        <div class="form-wrap">
          <div class="field">
            <label class="toggle-row">
              <span>PIN de acceso</span>
              <input type="checkbox" id="cfgPinEnabled">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="field" id="pinField" style="display:none">
            <label>Código PIN</label>
            <input type="password" id="cfgPin" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="••••••">
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Autobloqueo al minimizar</span>
              <input type="checkbox" id="cfgAutoLock">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="field">
            <label>Tiempo de autobloqueo</label>
            <select id="cfgLockTimeout">
              <option value="30000">30 segundos</option>
              <option value="60000">1 minuto</option>
              <option value="300000">5 minutos</option>
            </select>
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Cifrado de datos sensibles</span>
              <input type="checkbox" id="cfgEncryption">
              <span class="toggle-track"></span>
            </label>
          </div>
          <button class="btn btn-primary" data-action="saveSecurityConfig" style="--mc:#FB5A7E;margin-top:8px">Guardar configuración</button>
        </div>
      </div>`;
    },
    
    _renderAppearanceSettings: function() {
      return `<div class="view">
        ${topbar('Apariencia')}
        <div class="form-wrap">
          <div class="field">
            <label>Tema</label>
            <select id="cfgTheme">
              <option value="dark" selected>Oscuro (predeterminado)</option>
              <option value="dark-blue">Azul oscuro</option>
              <option value="dark-purple">Púrpura oscuro</option>
              <option value="dark-green">Verde oscuro</option>
              <option value="light">Claro</option>
            </select>
          </div>
          <div class="field">
            <label>Tamaño de fuente</label>
            <select id="cfgFontSize">
              <option value="small">Pequeño</option>
              <option value="medium" selected>Mediano</option>
              <option value="large">Grande</option>
            </select>
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Animaciones y transiciones</span>
              <input type="checkbox" id="cfgAnimations" checked>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="field">
            <label class="toggle-row">
              <span>Modo compacto</span>
              <input type="checkbox" id="cfgCompact">
              <span class="toggle-track"></span>
            </label>
          </div>
          <button class="btn btn-primary" data-action="saveAppearanceConfig" style="--mc:#9C8CFF;margin-top:8px">Guardar configuración</button>
        </div>
      </div>`;
    },
    
    saveNotifConfig: async function() {
      const cfg = {
        email: document.getElementById('cfgNotifEmail')?.value || '',
        timezone: document.getElementById('cfgTimezone')?.value || 'America/Santo_Domingo',
        dateFormat: document.getElementById('cfgDateFormat')?.value || 'DD/MM/YYYY',
        workStart: document.getElementById('cfgWorkStart')?.value || '08:00',
        workEnd: document.getElementById('cfgWorkEnd')?.value || '18:00',
        silentStart: document.getElementById('cfgSilentStart')?.value || '22:00',
        silentEnd: document.getElementById('cfgSilentEnd')?.value || '07:00',
        sound: document.getElementById('cfgSound')?.checked || false,
        vibration: document.getElementById('cfgVibration')?.checked || false,
        syncFreq: document.getElementById('cfgSyncFreq')?.value || '300000',
        batterySaver: document.getElementById('cfgBatterySaver')?.checked || false
      };
      await window.SIGR.StorageService.setSetting('notification_config', cfg);
      if (cfg.syncFreq) {
        window.SIGR.SchedulerService.setInterval(parseInt(cfg.syncFreq));
      }
      showToast('Configuración guardada');
    },
    
    saveEmailConfig: async function() {
      const cfg = {
        provider: document.getElementById('cfgEmailProvider')?.value || 'smtp',
        fromEmail: document.getElementById('cfgEmailFrom')?.value || '',
        fromName: document.getElementById('cfgEmailName')?.value || '',
        host: document.getElementById('cfgSmtpHost')?.value || '',
        port: parseInt(document.getElementById('cfgSmtpPort')?.value || '587'),
        secure: document.getElementById('cfgSmtpSecure')?.checked || false,
        apiKey: document.getElementById('cfgApiKey')?.value || '',
        hasConfig: true
      };
      if (!cfg.fromEmail) { showToast('Ingresa un correo remitente'); return; }
      window.SIGR.EmailService.configure(cfg);
      showToast('Configuración de correo guardada');
    },
    
    saveSecurityConfig: async function() {
      const cfg = {
        pinEnabled: document.getElementById('cfgPinEnabled')?.checked || false,
        pin: document.getElementById('cfgPin')?.value || '',
        autoLock: document.getElementById('cfgAutoLock')?.checked || false,
        lockTimeout: parseInt(document.getElementById('cfgLockTimeout')?.value || '60000'),
        encryption: document.getElementById('cfgEncryption')?.checked || false
      };
      await window.SIGR.StorageService.setSetting('security_config', cfg);
      showToast('Configuración de seguridad guardada');
    },
    
    saveAppearanceConfig: async function() {
      const cfg = {
        theme: document.getElementById('cfgTheme')?.value || 'dark',
        fontSize: document.getElementById('cfgFontSize')?.value || 'medium',
        animations: document.getElementById('cfgAnimations')?.checked || false,
        compact: document.getElementById('cfgCompact')?.checked || false
      };
      await window.SIGR.StorageService.setSetting('appearance_config', cfg);
      showToast('Configuración de apariencia guardada');
    }
  };
  
  window.SIGR.SettingsView = SettingsView;
})();