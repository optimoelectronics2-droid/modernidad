/* ============ SIGR Pro - Backup & Sync Settings View ============ */
(function(){
  'use strict';

  window.SIGR = window.SIGR || {};

  const BackupSettingsView = {
    _state: { restoreFileId: null, mode: 'merge' },

    render: async function() {
      const BS = window.SIGR.BackupService;
      const GA = window.SIGR.GoogleAuthService;
      const SM = window.SIGR.SyncManager;

      let cfg = {};
      try { cfg = await BS.getConfig(); } catch(e) {}
      let accounts = [];
      try { await GA.loadConfig(); accounts = GA.getAccounts(); } catch(e) {}
      const status = SM ? SM.getStatus() : {};
      let backups = [];
      let backupsErr = '';

      try {
        if (cfg.activeAccountId) {
          backups = await BS.listBackups(cfg.activeAccountId);
        }
      } catch(e) {
        backupsErr = e.message || 'No se pudo listar';
      }

      const activeAccount = accounts.find(a => a.id === cfg.activeAccountId) || accounts[0] || null;
      const lastBackup = cfg.lastBackup;
      const fmtSize = b => b ? (b.size > 1048576 ? (b.size/1048576).toFixed(1)+' MB' : Math.max(1, Math.round(b.size/1024))+' KB') : '';
      const fmtDate = ts => ts ? new Date(ts).toLocaleString('es-ES') : '—';

      const accountRows = accounts.filter(a => a.type === 'oauth').map(a => `
        <div class="settings-card" data-action="bsSetActive" data-account="${a.id}" style="cursor:pointer">
          <div class="si">${a.id === (cfg.activeAccountId || activeAccount && activeAccount.id) ? '✅' : '👤'}</div>
          <div class="st" style="flex:1">
            <div>${esc(a.name || 'Cuenta')}</div>
            <div style="font-size:11px;color:var(--text-faint)">${esc(a.email || a.id)}</div>
          </div>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" data-action="bsTestAccount" data-account="${a.id}">Probar</button>
          <button class="btn btn-ghost danger" style="font-size:11px;padding:4px 8px" data-action="bsRemoveAccount" data-account="${a.id}">✕</button>
        </div>`).join('') || '<div class="empty" style="padding:16px"><div class="etext">Sin cuentas. Conecta tu cuenta de Google para activar las copias automáticas.</div></div>';

      const webCid = await GA.getWebClientId().catch(() => '');

      const backupRows = backups.slice(0, 20).map(b => `
        <div class="settings-card">
          <div class="si">${b.encrypted ? '🔐' : '📦'}</div>
          <div class="st" style="flex:1">
            <div style="font-size:13px">${esc(b.name)}</div>
            <div style="font-size:11px;color:var(--text-faint)">${fmtSize(b)} · ${fmtDate(new Date(b.createdTime).getTime())}</div>
          </div>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" data-action="bsRestore" data-file="${b.id}" data-name="${esc(b.name)}" data-enc="${b.encrypted?'1':'0'}">Restaurar</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" data-action="bsDeleteBackup" data-file="${b.id}">🗑</button>
        </div>`).join('') || '<div style="padding:12px;color:var(--text-faint);font-size:12px;text-align:center">No hay copias en Drive todavía' + (backupsErr ? ' (' + esc(backupsErr) + ')' : '') + '</div>';

      return `<div class="view">
        ${topbar('Copia de seguridad y sincronización', null)}
        <div class="form-wrap">

          <div class="empty" style="padding:16px">
            <div class="eicon">☁️</div>
            <div class="etitle">Google Drive</div>
            <div class="etext" style="font-size:12px">Copias automáticas, cifradas y sincronizadas en tu Google Drive. La sincronización se reanuda sola ante cualquier fallo.</div>
          </div>

          <div class="settings-section-title">📡 Estado</div>
          <div class="settings-card" style="flex-direction:column;align-items:flex-start;gap:6px">
            <div style="display:flex;width:100%;justify-content:space-between;align-items:center">
              <span class="st" style="font-size:13px">${status.state === 'backing-up' ? '🔄 Sincronizando…' : status.state === 'error' ? '⚠️ Error' : status.state === 'passphrase-required' ? '🔐 Contraseña requerida' : '✅ En orden'}</span>
              <span class="tag status" style="background:${status.state === 'error' ? '#FB5A7E' : status.state === 'passphrase-required' ? '#F5A623' : '#12D68A'}">${esc(status.message || 'Listo')}</span>
            </div>
            ${status.state === 'passphrase-required' ? `<button class="btn btn-primary" style="--mc:#F5A623;margin-top:4px" data-action="bsSavePassphrase">🔐 Ingresar contraseña de cifrado</button>` : ''}
            <div style="font-size:12px;color:var(--text-faint)">
              Última copia: ${fmtDate(lastBackup ? lastBackup.at : 0)} · Cambios en cola: ${status.queueSize ?? 0}
            </div>
            ${lastBackup ? `<div style="font-size:12px;color:var(--text-faint)">${esc(lastBackup.name)} (${fmtSize(lastBackup)})</div>` : ''}
          </div>

          <div class="settings-section-title">👤 Cuentas de Google</div>
          ${accountRows}
          <button class="btn btn-primary" data-action="bsConnectPersonal" style="--mc:#5CA8FF;margin-top:8px">＋ Iniciar sesión con Google</button>
          ${!webCid ? `
          <div class="settings-card" style="flex-direction:column;align-items:flex-start;gap:8px;margin-top:10px;background:rgba(92,168,255,.06);border-color:rgba(92,168,255,.25)">
            <div style="font-size:13px;font-weight:600">Inicio de sesión normal (ventana de Google)</div>
            <div style="font-size:12px;color:var(--text-dim)">Para que se abra la ventana de Google donde solo eliges tu cuenta (sin código), crea un cliente OAuth <b>tipo "Aplicación web"</b> en <b>console.cloud.google.com</b> → Credenciales → Crear credenciales → ID de cliente OAuth, con origen autorizado <b>${esc((typeof location !== 'undefined' && location.origin) || 'https://modernidad-284.netlify.app')}</b>, y pega aquí su Client ID:</div>
            <div style="display:flex;gap:8px;width:100%">
              <input type="text" id="bsWebCid" placeholder="1234-abcd....apps.googleusercontent.com" style="flex:1;min-width:0" value="${esc(cfg.webClientId || '')}">
              <button class="btn btn-ghost" data-action="bsSaveWebCid" style="font-size:12px">Guardar</button>
            </div>
            <div style="font-size:11px;color:var(--text-faint)">Sin esto, el inicio de sesión usa el método de código (device flow), que también funciona pero requiere escribir un código.</div>
          </div>` : ''}

          <div class="settings-section-title">⚙ Automático</div>
          <div class="field">
            <label class="toggle-row">
              <span>Copia de seguridad automática</span>
              <input type="checkbox" id="bsAuto" ${cfg.autoBackup !== false ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Intervalo (horas)</label>
              <select id="bsInterval">
                ${[1, 3, 6, 12, 24].map(h => `<option value="${h}" ${cfg.intervalHours === h ? 'selected' : ''}>${h === 1 ? '1 hora' : 'Cada ' + h + ' horas'}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Copias a conservar</label>
              <select id="bsRetention">
                ${[3, 7, 15, 30, 60].map(n => `<option value="${n}" ${(cfg.retention || 7) === n ? 'selected' : ''}>${n} copias</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="settings-section-title">🔐 Cifrado (opcional)</div>
          <div class="field">
            <label>Contraseña de cifrado de copias</label>
            <input type="password" id="bsPassphrase" placeholder="${cfg.passphraseSet ? 'Cambiar contraseña (ya hay una configurada)' : 'Deja vacío para copias sin cifrar'}" autocomplete="new-password">
          </div>
          <div style="font-size:11px;color:var(--text-faint);margin-bottom:8px">
            ${cfg.passphraseSet ? 'Cifrado activo (' + esc(cfg.passphraseHint || '') + '). Las copias .enc no se pueden leer sin esta contraseña.' : 'Se recomienda cifrar: tus datos viajan protegidos con AES-256.'}
          </div>
          <div class="detail-actions" style="padding:0">
            <button class="dact" data-action="bsSavePassphrase"><span class="di">🔐</span>${cfg.passphraseSet ? 'Cambiar contraseña' : 'Activar cifrado'}</button>
          </div>

          <div class="settings-section-title">🛠 Acciones</div>
          <div class="detail-actions" style="padding:0">
            <button class="dact" data-action="bsBackupNow"><span class="di">☁️</span>Crear copia de seguridad ahora</button>
            <button class="dact" data-action="bsExportLocal"><span class="di">💾</span>Exportar copia local (.json)</button>
            <button class="dact" data-action="bsImportLocal"><span class="di">📂</span>Importar copia local…</button>
            <button class="dact" data-action="bsRefresh"><span class="di">🔄</span>Actualizar lista</button>
          </div>
          <input type="file" id="bsImportFile" accept=".json,.enc" style="display:none">

          <div class="settings-section-title">🗄 Copias en Google Drive</div>
          ${backupRows}

        </div>
      </div>`;
    },

    handleAction: async function(el) {
      const action = el.dataset.action;
      const BS = window.SIGR.BackupService;
      const GA = window.SIGR.GoogleAuthService;
      const SM = window.SIGR.SyncManager;

      switch(action) {
        case 'bsConnectPersonal': {
          const btn = el;
          btn.disabled = true;
          try {
            const res = await GA.signInWithGoogle();
            if (res.userCode) {
              this._state.flow = res;
              const body = `<div style="text-align:center;padding:12px 0">
                <div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">Toca el botón para abrir Google, escribe el código y acepta los permisos:</div>
                <button class="btn" data-action="bsOpenDevicePage" style="width:100%;margin-bottom:12px">🌐 Abrir página de Google</button>
                <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#12D68A;margin-bottom:10px">${esc(res.userCode)}</div>
                <button class="btn btn-ghost" data-action="bsCopyUserCode" style="font-size:12px;margin-bottom:12px">📋 Copiar código</button>
                <div id="bsDeviceStatus" style="font-size:12px;color:var(--text-faint)">Esperando autorización…</div>
                <div style="font-size:11px;color:var(--text-faint);margin-top:12px">Si ves "Acceso bloqueado": consola de Google → Pantalla de consentimiento → Usuarios de prueba → añade tu correo y vuelve a intentarlo.</div>
              </div>`;
              window.openModal({ title: 'Iniciar sesión con Google', body, closeOnOverlay: false });
              try { await navigator.clipboard.writeText(res.userCode); } catch(e) {}
              this._pollDevice(res);
            } else {
              showToast('Sesión iniciada: ' + (res.email || 'Google') + ' ✓');
              const cfg = await BS.getConfig();
              if (!cfg.activeAccountId) {
                cfg.activeAccountId = res.id;
                await BS.saveConfig(cfg);
              }
              this.refresh();
            }
          } catch(e) {
            showToast(e.message || 'No se pudo iniciar sesión');
            btn.disabled = false;
          }
          break;
        }

        case 'bsOpenDevicePage': {
          const flow = this._state.flow;
          if (!flow) return;
          window.open(flow.verificationUrl, '_blank', 'noopener');
          break;
        }

        case 'bsSaveWebCid': {
          const cid = (document.getElementById('bsWebCid')?.value || '').trim();
          if (!cid) { showToast('Pega el Client ID primero'); break; }
          if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cid)) { showToast('Ese no parece un Client ID de Google'); break; }
          await GA.setWebClientId(cid);
          showToast('Client ID guardado. Toca "Iniciar sesión con Google" de nuevo ✓');
          this.refresh();
          break;
        }

        case 'bsCopyUserCode': {
          const flow = this._state.flow;
          if (!flow) return;
          try { await navigator.clipboard.writeText(flow.userCode); showToast('Código copiado'); } catch(e) { showToast('Copia manualmente: ' + flow.userCode); }
          break;
        }

        case 'bsRemoveAccount': {
          const id = el.dataset.account;
          const acc = GA.getAccount(id);
          window.showConfirm(`¿Quitar la cuenta ${acc ? acc.email : ''}? Las copias en Drive no se borran.`, 'Quitar cuenta', async () => {
            await GA.removeAccount(id);
            const cfg = await BS.getConfig();
            if (cfg.activeAccountId === id) { cfg.activeAccountId = null; cfg.lastBackup = null; await BS.saveConfig(cfg); }
            showToast('Cuenta eliminada');
            this.refresh();
          });
          break;
        }

        case 'bsSetActive': {
          const cfg = await BS.getConfig();
          cfg.activeAccountId = el.dataset.account;
          await BS.saveConfig(cfg);
          showToast('Cuenta activa seleccionada');
          this.refresh();
          break;
        }

        case 'bsTestAccount': {
          const id = el.dataset.account;
          showToast('Probando conexión…');
          try {
            const info = await GA.testConnection(id);
            const driveName = info.user && (info.user.displayName || info.user.emailAddress) || 'Google Drive';
            showToast('Conexión exitosa: ' + driveName + ' ✓');
          } catch(e) {
            showToast(e.message || 'Conexión fallida');
          }
          break;
        }

        case 'bsBackupNow': {
          const cfg = await BS.getConfig();
          const accounts = GA.getAccounts();
          if (!accounts.length) { showToast('Primero agrega una cuenta de Google'); return; }
          showToast('Creando copia de seguridad…');
          try {
            if (cfg.passphraseSet && !BS.getPassphrase()) {
              const ph = await this._promptPassphrase();
              if (!ph) { showToast('Copia cancelada'); return; }
              BS.setPassphrase(ph);
            }
            await SM.runBackupNow();
            showToast('Copia de seguridad creada en Google Drive ☁️');
            this.refresh();
          } catch(e) {
            showToast(e.message || 'Error al crear la copia');
          }
          break;
        }

        case 'bsSavePassphrase': {
          const ph = document.getElementById('bsPassphrase')?.value || '';
          if (ph.length < 4) { showToast('La contraseña debe tener al menos 4 caracteres'); return; }
          await BS.setPassphraseProtected(ph);
          showToast(ph ? 'Cifrado activado. La próxima copia será .enc' : 'Cifrado desactivado');
          const SM = window.SIGR.SyncManager;
          if (SM && SM.process) SM.process();
          this.refresh();
          break;
        }

        case 'bsRestore': {
          const fileId = el.dataset.file;
          const name = el.dataset.name;
          const enc = el.dataset.enc === '1';
          this._openRestoreModal(fileId, name, enc);
          break;
        }

        case 'bsDoRestore': {
          const fileId = this._state.restoreFileId;
          const mode = this._state.mode;
          const pass = this._state.enc ? (document.getElementById('bsRestorePass')?.value || '') : null;
          const btn = el;
          btn.disabled = true; btn.textContent = 'Restaurando…';
          try {
            const cfg = await BS.getConfig();
            const accounts = GA.getAccounts();
            const accountId = cfg.activeAccountId || (accounts[0] && accounts[0].id);
            if (!accountId) throw new Error('No hay cuenta activa');
            await BS.restoreBackup(accountId, fileId, { mode: mode, passphrase: pass });
            closeModal();
            showToast('Restauración completada ✓');
            setTimeout(() => { try { location.reload(); } catch(e) {} }, 800);
          } catch(e) {
            showToast(e.message || 'Error al restaurar');
            btn.disabled = false; btn.textContent = 'Restaurar ahora';
          }
          break;
        }

        case 'bsRestoreMode': {
          const mode = el.dataset.mode;
          this._state.mode = mode;
          document.querySelectorAll('[data-action="bsRestoreMode"]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
          break;
        }

        case 'bsDeleteBackup': {
          const fileId = el.dataset.file;
          window.showConfirm('¿Eliminar esta copia de Drive?', 'Eliminar', async () => {
            try {
              const cfg = await BS.getConfig();
              await BS.deleteBackup(cfg.activeAccountId, fileId);
              showToast('Copia eliminada');
              this.refresh();
            } catch(e) { showToast('Error al eliminar'); }
          });
          break;
        }

        case 'bsRefresh':
          this.refresh();
          break;

        case 'bsExportLocal':
          try {
            await BS.exportLocalFile();
            showToast('Copia local descargada');
          } catch(e) { showToast(e.message || 'Error al exportar'); }
          break;

        case 'bsImportLocal':
          document.getElementById('bsImportFile')?.click();
          break;

        case 'bsImportFileChosen': {
          const file = document.getElementById('bsImportFile')?.files[0];
          if (!file) return;
          window.showConfirm('Se reemplazará todo el contenido actual. ¿Continuar?', 'Reemplazar todo', async () => {
            try {
              await BS.importLocalFile(file);
              showToast('Importación completada ✓');
              setTimeout(() => { try { location.reload(); } catch(e) {} }, 800);
            } catch(e) { showToast(e.message || 'Error al importar'); }
          });
          break;
        }

        case 'bsConfirmPrompt':
          this._confirmPrompt();
          break;
      }
    },

    refresh: async function() {
      const html = await this.render();
      const app = document.getElementById('app');
      if (!app) return;
      app.innerHTML = html;
      if (window.SIGR.attachHandlers) window.SIGR.attachHandlers();
      if (window.SIGR.attachGlobalEvents) window.SIGR.attachGlobalEvents();
      const self = this;
      const bsImportFile = document.getElementById('bsImportFile');
      if (bsImportFile) bsImportFile.onchange = () => self.handleAction({ dataset: { action: 'bsImportFileChosen' } });
    },

    _pollDevice: async function(flow) {
      const GA = window.SIGR.GoogleAuthService;
      const BS = window.SIGR.BackupService;
      const modalOpen = () => {
        const m = document.getElementById('modal');
        return !!m && m.classList.contains('open');
      };
      try {
        const tokenResult = await GA.pollDeviceFlow(flow, () => {}, () => !modalOpen());
        const account = await GA.finishOAuthAccount(flow, tokenResult);
        const status = document.getElementById('bsDeviceStatus');
        if (status) status.innerHTML = '<span style="color:#12D68A">✅ Autorizado correctamente</span>';
        setTimeout(async () => {
          if (!modalOpen()) return;
          closeModal();
          try {
            const cfg = await BS.getConfig();
            if (!cfg.activeAccountId) {
              cfg.activeAccountId = account.id;
              await BS.saveConfig(cfg);
              showToast('Cuenta conectada y activada: ' + (account.email || 'Google') + ' ✓');
            } else {
              showToast('Cuenta conectada: ' + (account.email || 'Google') + ' ✓');
            }
          } catch(e) { showToast('Cuenta conectada: ' + (account.email || 'Google') + ' ✓'); }
          this.refresh();
        }, 700);
      } catch(e) {
        if (e.message === '__stopped__') return;
        const status = document.getElementById('bsDeviceStatus');
        if (status) {
          status.innerHTML = '<span style="color:#FB5A7E">✖ ' + esc(e.message || 'Error') + '</span>';
        } else {
          showToast((e.message || 'Error de autenticación') + ' — Toca "Iniciar sesión" de nuevo');
        }
      }
    },

    _openRestoreModal: function(fileId, name, enc) {
      this._state.restoreFileId = fileId;
      this._state.mode = 'merge';
      this._state.enc = enc;
      const body = `
        <div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">${esc(name)}</div>
        <div class="pri-row" style="margin-bottom:10px">
          <button type="button" class="pri-opt on" style="--mc:#12D68A" data-action="bsRestoreMode" data-mode="merge">Fusionar (recomendado)</button>
          <button type="button" class="pri-opt" style="--mc:#F5A623" data-action="bsRestoreMode" data-mode="replace">Reemplazar todo</button>
        </div>
        <div style="font-size:12px;color:var(--text-faint);margin-bottom:10px">
          <strong>Fusionar</strong>: conserva los datos locales y agrega lo que falte (por fecha de edición).<br>
          <strong>Reemplazar</strong>: borra todo lo actual y restaura la copia. Se crea una copia de seguridad previa automáticamente.
        </div>
        ${enc ? `<div class="field"><label>Contraseña de cifrado</label><input type="password" id="bsRestorePass" placeholder="Contraseña usada al crear la copia"></div>` : ''}`;
      const footer = `<button class="btn" data-action="closeModal">Cancelar</button>
        <button class="btn btn-primary" data-action="bsDoRestore" style="--mc:#12D68A">Restaurar ahora</button>`;
      window.openModal({ title: 'Restaurar copia', body, footer });
    },

    _promptPassphrase: function() {
      return new Promise(resolve => {
        this._state._promptResolve = resolve;
        const body = `<div class="field"><label>Contraseña</label><input type="password" id="bsPromptPass" placeholder="••••••"></div>`;
        const footer = `<button class="btn" data-action="closeModal">Cancelar</button>
          <button class="btn btn-primary" data-action="bsConfirmPrompt" style="--mc:#9C8CFF">Aceptar</button>`;
        window.openModal({ title: 'Contraseña de cifrado', body, footer });
      });
    },

    _confirmPrompt: function() {
      const resolve = this._state._promptResolve;
      this._state._promptResolve = null;
      if (resolve) resolve(document.getElementById('bsPromptPass')?.value || null);
    }
  };

  window.SIGR.BackupSettingsView = BackupSettingsView;
})();
