/* ============ SIGR Pro - Google Auth (Service Account JWT + Personal Device Flow) ============ */
(function(){
  'use strict';

  window.SIGR = window.SIGR || {};

  const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
  const TOKEN_URI = 'https://oauth2.googleapis.com/token';
  const DEVICE_URI = 'https://oauth2.googleapis.com/device/code';
  const ACC_CFG_KEY = 'drive_accounts';
  const DEFAULT_CLIENT_ID = '216094399381-uf8untlhtqnh4p6mea05nehfvrgcurci.apps.googleusercontent.com';
  const WEB_CLIENT_ID = ''; /* Client ID tipo "Aplicación web" para el popup profesional (se configura en la consola) */

  const GoogleAuthService = {
    _accounts: [],
    _tokens: {},          /* email/id -> { access_token, expiresAt } */
    _ready: null,
    _gisPromise: null,

    /* ----- helpers ----- */
    _b64url: function(buf) {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    },

    _pemToArrayBuffer: function(pem) {
      const cleaned = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    },

    _jsonToBase64: function(obj) {
      return this._b64url(new TextEncoder().encode(JSON.stringify(obj)));
    },

    _importKey: async function(pem) {
      return crypto.subtle.importKey(
        'pkcs8',
        this._pemToArrayBuffer(pem),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );
    },

    _sign: async function(key, data) {
      const sig = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(data)
      );
      return this._b64url(new Uint8Array(sig));
    },

    _makeJwt: async function(account) {
      const now = Math.floor(Date.now() / 1000);
      const header = this._jsonToBase64({ alg: 'RS256', typ: 'JWT' });
      const payload = this._jsonToBase64({
        iss: account.email,
        scope: SCOPES,
        aud: TOKEN_URI,
        iat: now,
        exp: now + 3600
      });
      const cryptoKey = await this._importKey(account.keyRaw);
      const signature = await this._sign(cryptoKey, header + '.' + payload);
      return header + '.' + payload + '.' + signature;
    },

    async _postForm(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json: json };
    },

    async _saExchange(account) {
      const jwt = await this._makeJwt(account);
      const { status, json } = await this._postForm(TOKEN_URI, 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt));
      if (status !== 200 || !json.access_token) {
        throw new Error('Token de Google rechazado: ' + (json.error_description || json.error || status));
      }
      return json;
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

    /* Professional "Sign in with Google" popup (web). Falls back to device flow when no web client is configured. */
    async signInWithGoogle() {
      const cid = (WEB_CLIENT_ID || '').trim();
      if (!cid) return this.startDeviceFlow();

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
    },

    /* ----- account management ----- */

    async getAccessToken(accountId, force) {
      const account = this.getAccount(accountId);
      if (!account) throw new Error('Cuenta no configurada');

      if (account.type === 'oauth') {
        if (!force && account.accessToken && account.expiresAt && Date.now() < account.expiresAt) return account.accessToken;
        return this._oauthRefresh(account);
      }

      /* service account (JWT) */
      const cached = this._tokens[account.email];
      if (!force && cached && cached.expiresAt && Date.now() < cached.expiresAt) return cached.access_token;
      const tok = await this._saExchange(account);
      this._tokens[account.email] = {
        access_token: tok.access_token,
        expiresAt: Date.now() + (tok.expires_in - 60) * 1000
      };
      account.lastTokenAt = Date.now();
      this._persist();
      return tok.access_token;
    },

    invalidateToken: async function(accountId) {
      const account = this.getAccount(accountId);
      if (!account) return;
      if (account.type === 'oauth') {
        account.accessToken = null;
        account.expiresAt = 0;
      } else {
        this._tokens[account.email] = null;
      }
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
        this._accounts = Array.isArray(accounts) ? accounts : [];
        try {
          const bundled = await fetch('secure/service-account.json', { cache: 'no-store' });
          if (bundled.ok) {
            const sa = await bundled.json();
            if (sa && sa.client_email && sa.private_key && !this._accounts.find(a => a.type === 'sa' && a.email === sa.client_email)) {
              this._accounts.unshift(this._fromServiceAccountJson(sa, 'Cuenta integrada'));
            }
          }
        } catch(e) {}
      })();
      return this._ready;
    },

    _fromServiceAccountJson: function(sa, name) {
      return {
        id: 'sa-' + Math.random().toString(36).slice(2, 10),
        type: 'sa',
        name: name || 'Cuenta de servicio',
        email: sa.client_email,
        clientId: sa.client_id || '',
        keyRaw: sa.private_key,
        addedAt: Date.now()
      };
    },

    addServiceAccount: async function(saJson, name) {
      const sa = typeof saJson === 'string' ? JSON.parse(saJson) : saJson;
      if (!sa || !sa.client_email || !sa.private_key) throw new Error('JSON de cuenta no válido');
      if (this._accounts.find(a => a.email === sa.client_email)) {
        throw new Error('Esa cuenta ya está agregada');
      }
      const account = this._fromServiceAccountJson(sa, name);
      this._accounts.push(account);
      try {
        await this.getAccessToken(account.id);
      } catch(e) {
        this._accounts = this._accounts.filter(a => a.id !== account.id);
        throw e;
      }
      this._persist();
      return account;
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

    /* ----- device flow (personal Google account) ----- */

    async startDeviceFlow(clientId) {
      const cid = ((clientId || '').trim() || DEFAULT_CLIENT_ID).trim();
      if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cid)) {
        throw new Error('No parece un Client ID válido. Debe terminar en ".apps.googleusercontent.com" y copiarse completo de la consola de Google.');
      }
      const { status, json } = await this._postForm(DEVICE_URI,
        'client_id=' + encodeURIComponent(cid) + '&scope=' + encodeURIComponent(SCOPES));
      if (status !== 200 || !json.device_code) {
        if (status === 401 || json.error === 'invalid_client') {
          throw new Error('Google rechazó el Client ID (401). Verifica que está copiado completo, sin espacios, y que el cliente OAuth es tipo "TV y dispositivos con entrada limitada" en la consola.');
        }
        throw new Error('No se pudo iniciar: ' + (json.error_description || json.error || status) + '. Crea un cliente tipo "TV y dispositivos con entrada limitada" y usa su Client ID.');
      }
      return {
        deviceCode: json.device_code,
        userCode: json.user_code,
        verificationUrl: json.verification_url,
        expiresIn: json.expires_in,
        interval: Math.max(5, json.interval || 5),
        clientId: cid
      };
    },

    async pollDeviceFlow(flow, onPending) {
      const deadline = Date.now() + flow.expiresIn * 1000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, flow.interval * 1000));
        const { status, json } = await this._postForm(TOKEN_URI,
          'client_id=' + encodeURIComponent(flow.clientId) +
          '&device_code=' + encodeURIComponent(flow.deviceCode) +
          '&grant_type=urn:ietf:params:oauth:grant-type:device_code');
        if (status === 200 && json.access_token) {
          return {
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiresIn: json.expires_in || 3600
          };
        }
        if (json.error === 'authorization_pending') { continue; }
        if (json.error === 'slow_down') { flow.interval += 5; continue; }
        if (json.error === 'access_denied') throw new Error('Acceso denegado por el usuario');
        if (json.error === 'expired_token') throw new Error('El código expiró. Pulsa de nuevo "Iniciar sesión con Google"');
        if (json.error === 'invalid_grant' || status === 400) {
          if (json.error_description && /already|used|expired/i.test(json.error_description)) {
            throw new Error('La autorización ya se procesó o el código expiró. Comprueba si tu cuenta ya aparece en la lista.');
          }
          throw new Error('Código inválido: asegúrate de escribir el código exacto que muestra la app');
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
