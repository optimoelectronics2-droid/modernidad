/* ============ SIGR Pro - Google Auth (Personal Accounts: GIS popup + Device Flow) ============ */
(function(){
  'use strict';

  window.SIGR = window.SIGR || {};

  const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
  const TOKEN_URI = 'https://oauth2.googleapis.com/token';
  const DEVICE_URI = 'https://oauth2.googleapis.com/device/code';
  const ACC_CFG_KEY = 'drive_accounts';
  const DEFAULT_CLIENT_ID = '216094399381-uf8untlhtqnh4p6mea05nehfvrgcurci.apps.googleusercontent.com';
  const WEB_CLIENT_ID = ''; /* Client ID de respaldo tipo "Aplicación web" (opcional, se prefiere el guardado en la app) */

  const GoogleAuthService = {
    _accounts: [],
    _tokens: {},
    _ready: null,
    _gisPromise: null,

    async _postForm(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json: json };
    },

    async _oauthRefresh(account) {
      if (account.web) {
        const tok = await this._gisSilentRefresh(account);
        if (!tok) throw new Error('Sesión de Google expirada: vuelve a tocar "Iniciar sesión con Google"');
        return tok;
      }
      const { status, json } = await this._postForm(TOKEN_URI,
        'grant_type=refresh_token&client_id=' + encodeURIComponent(account.clientId) +
        '&refresh_token=' + encodeURIComponent(account.refreshToken));
      if (status !== 200 || !json.access_token) {
        throw new Error('Sesión expirada: vuelve a conectar la cuenta (' + (json.error_description || json.error || status) + ')');
      }
      if (json.refresh_token) account.refreshToken = json.refresh_token;
      account.accessToken = json.access_token;
      account.expiresAt = Date.now() + (json.expires_in - 60) * 1000;
      this._persist();
      return json.access_token;
    },

    _gisLoad: function() {
      if (!this._gisPromise) {
        this._gisPromise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.onload = () => resolve(window.google);
          s.onerror = () => reject(new Error('No se pudo cargar el inicio de sesión de Google'));
          document.head.appendChild(s);
        });
      }
      return this._gisPromise;
    },

    async _gisSilentRefresh(account) {
      try {
        const g = await this._gisLoad();
        const token = await new Promise(resolve => {
          const tc = g.accounts.oauth2.initTokenClient({
            client_id: account.clientId || WEB_CLIENT_ID,
            scope: SCOPES,
            callback: resp => resolve(resp && resp.error ? null : resp.access_token)
          });
          tc.request({ prompt: '' });
        });
        if (token) {
          account.accessToken = token;
          account.expiresAt = Date.now() + 3600000;
          this._persist();
        }
        return token;
      } catch(e) { return null; }
    },

    /* Client ID y Client Secret guardados en la app (los pegas en Copias de seguridad) */
    async getClientCredential() {
      try {
        const cfg = await window.SIGR.BackupService.getConfig();
        return {
          clientId: (cfg.webClientId || WEB_CLIENT_ID || '').trim(),
          clientSecret: (cfg.clientSecret || '').trim()
        };
      } catch(e) {
        return { clientId: WEB_CLIENT_ID.trim(), clientSecret: '' };
      }
    },

    async setClientCredential(clientId, clientSecret) {
      const cfg = await window.SIGR.BackupService.getConfig();
      cfg.webClientId = (clientId || '').trim();
      cfg.clientSecret = (clientSecret || '').trim();
      await window.SIGR.BackupService.saveConfig(cfg);
    },

    /* Acepta el JSON descargado de la consola (tiene client_id + client_secret) o solo el Client ID */
    async saveClientInput(raw) {
      const text = (raw || '').trim();
      if (text.startsWith('{')) {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch(e) { throw new Error('El JSON no es válido. Descárgalo de nuevo desde la consola.'); }
        const cid = (parsed.client_id || (parsed.web && parsed.web.client_id) || '').trim();
        const sec = (parsed.client_secret || (parsed.web && parsed.web.client_secret) || '').trim();
        if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cid)) {
          throw new Error('El JSON no contiene un client_id válido. Verifica que descargaste el JSON de un cliente OAuth.');
        }
        await this.setClientCredential(cid, sec);
        return { clientId: cid, clientSecret: sec };
      }
      if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(text)) {
        throw new Error('Eso no parece un Client ID de Google (debe terminar en .apps.googleusercontent.com)');
      }
      await this.setClientCredential(text, '');
      return { clientId: text, clientSecret: '' };
    },

    /* Professional "Sign in with Google" (account picker popup). Falls back to device flow. */
    async signInWithGoogle() {
      const cred = await this.getClientCredential();
      const cid = cred.clientId;
      if (!cid) return this.startDeviceFlow(DEFAULT_CLIENT_ID, cred.clientSecret);

      try {
        const g = await this._gisLoad();
        const accessToken = await new Promise((resolve, reject) => {
          const tc = g.accounts.oauth2.initTokenClient({
            client_id: cid,
            scope: SCOPES,
            callback: resp => {
              if (!resp || resp.error) {
                if (resp && (resp.error === 'access_denied' || resp.error === 'user_canceled')) reject(new Error('Acceso cancelado'));
                else reject(new Error('Google rechazó el acceso: ' + ((resp && (resp.error_description || resp.error)) || 'desconocido')));
                return;
              }
              resolve(resp.access_token);
            }
          });
          tc.request({ prompt: 'select_account' });
        });

        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo?alt=json', {
          headers: { Authorization: 'Bearer ' + accessToken }
        }).then(r => r.json()).catch(() => ({}));
        const email = info.email || '';
        if (!email) throw new Error('No se pudo obtener tu correo de Google');

        let account = this._accounts.find(a => a.type === 'oauth' && a.email === email);
        if (!account) {
          account = {
            id: 'web-' + Date.now(),
            type: 'oauth',
            web: true,
            name: info.name || email,
            email: email,
            clientId: cid,
            accessToken: null,
            refreshToken: '',
            expiresAt: 0,
            createdAt: Date.now()
          };
          this._accounts.push(account);
        }
        account.accessToken = accessToken;
        account.expiresAt = Date.now() + 3600000;
        this._persist();
        return account;
      } catch(e) {
        if (/canceled|denied|rechaz/i.test(e.message)) throw e;
        return this.startDeviceFlow(cid, cred.clientSecret);
      }
    },

    /* ----- account management ----- */

    async getAccessToken(accountId, force) {
      const account = this.getAccount(accountId);
      if (!account) throw new Error('Cuenta no configurada');
      if (!force && account.accessToken && account.expiresAt && Date.now() < account.expiresAt) return account.accessToken;
      return this._oauthRefresh(account);
    },

    invalidateToken: async function(accountId) {
      const account = this.getAccount(accountId);
      if (!account) return;
      account.accessToken = null;
      account.expiresAt = 0;
    },

    getAccount: function(id) {
      return this._accounts.find(a => a.id === id) || null;
    },

    getAccounts: function() {
      return this._accounts.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        email: a.email || ''
      }));
    },

    async loadConfig() {
      if (this._ready) return this._ready;
      this._ready = (async () => {
        let accounts = [];
        try {
          accounts = await window.SIGR.StorageService.getSetting(ACC_CFG_KEY, []);
        } catch(e) {}
        const raw = Array.isArray(accounts) ? accounts : [];
        accounts = raw.filter(a => a && a.type !== 'sa');
        if (accounts.length !== raw.length) {
          try { await window.SIGR.StorageService.setSetting(ACC_CFG_KEY, accounts); } catch(e) {}
        }
        this._accounts = accounts;
      })();
      return this._ready;
    },

    addOAuthAccount: async function(account) {
      if (!account || !account.refreshToken) throw new Error('Cuenta no válida');
      if (this._accounts.find(a => a.type === 'oauth' && a.clientId === account.clientId && a.refreshToken === account.refreshToken)) {
        throw new Error('Esa cuenta ya está conectada');
      }
      this._accounts.push(account);
      try {
        await this.getAccessToken(account.id, true);
      } catch(e) {
        this._accounts = this._accounts.filter(a => a.id !== account.id);
        throw e;
      }
      this._persist();
      return account;
    },

    removeAccount: async function(id) {
      const idx = this._accounts.findIndex(a => a.id === id);
      if (idx > -1) {
        const a = this._accounts[idx];
        if (a.email) delete this._tokens[a.email];
        this._accounts.splice(idx, 1);
        this._persist();
      }
    },

    async _persist() {
      try {
        await window.SIGR.StorageService.setSetting(ACC_CFG_KEY, this._accounts);
      } catch(e) {}
    },

    /* ----- device flow (fallback: TV client ID) ----- */

    async startDeviceFlow(clientId, clientSecret) {
      const cid = ((clientId || '').trim() || DEFAULT_CLIENT_ID).trim();
      const sec = (clientSecret || '').trim();
      if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cid)) {
        throw new Error('No parece un Client ID válido. Debe terminar en ".apps.googleusercontent.com" y copiarse completo de la consola de Google.');
      }
      const { status, json } = await this._postForm(DEVICE_URI,
        'client_id=' + encodeURIComponent(cid) + '&scope=' + encodeURIComponent(SCOPES));
      if (status !== 200 || !json.device_code) {
        throw new Error('No se pudo iniciar: ' + (json.error_description || json.error || status));
      }
      return {
        deviceCode: json.device_code,
        userCode: json.user_code,
        verificationUrl: json.verification_url,
        expiresIn: json.expires_in,
        interval: Math.max(5, json.interval || 5),
        clientId: cid,
        clientSecret: sec
      };
    },

    async pollDeviceFlow(flow, onPending, shouldStop) {
      const deadline = Date.now() + flow.expiresIn * 1000;
      while (Date.now() < deadline) {
        if (shouldStop && shouldStop()) throw new Error('__stopped__');
        await new Promise(r => setTimeout(r, flow.interval * 1000));
        if (shouldStop && shouldStop()) throw new Error('__stopped__');
        let body = 'client_id=' + encodeURIComponent(flow.clientId) +
          '&device_code=' + encodeURIComponent(flow.deviceCode) +
          '&grant_type=urn:ietf:params:oauth:grant-type:device_code';
        if (flow.clientSecret) body += '&client_secret=' + encodeURIComponent(flow.clientSecret);
        const { status, json } = await this._postForm(TOKEN_URI, body);
        if (status === 200 && json.access_token) {
          return {
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiresIn: json.expires_in || 3600
          };
        }
        if (json.error === 'authorization_pending') { if (onPending) onPending(); continue; }
        if (json.error === 'slow_down') { flow.interval += 5; continue; }
        if (json.error === 'access_denied') throw new Error('Acceso denegado por el usuario');
        if (json.error === 'expired_token') throw new Error('El código expiró. Pulsa de nuevo "Iniciar sesión con Google"');
        if (status === 400 || json.error === 'invalid_grant' || json.error === 'invalid_client') {
          throw new Error('No se pudo completar la autorización: ' + (json.error_description || json.error || 'error') + '. Revisa que en Copias de seguridad pegaste el JSON completo del cliente OAuth (Client ID + Client Secret).');
        }
        throw new Error(json.error_description || json.error || 'Error de autenticación');
      }
      throw new Error('Se agotó el tiempo de espera');
    },

    async finishOAuthAccount(flow, tokenResult) {
      let email = '';
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo?alt=json', {
          headers: { Authorization: 'Bearer ' + tokenResult.accessToken }
        });
        const info = await res.json().catch(() => ({}));
        email = info.email || '';
      } catch(e) {}
      const account = {
        id: 'oa-' + Math.random().toString(36).slice(2, 10),
        type: 'oauth',
        name: email ? email.split('@')[0] : 'Cuenta personal',
        email: email,
        clientId: flow.clientId,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || '',
        expiresAt: Date.now() + (tokenResult.expiresIn - 60) * 1000,
        addedAt: Date.now()
      };
      return this.addOAuthAccount(account);
    },

    async testConnection(accountId) {
      const token = await this.getAccessToken(accountId);
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(usage,limit)', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Sin conexión a Drive: ' + ((json.error && json.error.message) || res.status));
      return json;
    }
  };

  window.SIGR.GoogleAuthService = GoogleAuthService;
})();