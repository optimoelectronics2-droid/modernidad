/* ============ SIGR Pro - Google Drive API v3 client ============ */
(function(){
  'use strict';

  window.SIGR = window.SIGR || {};

  const BASE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

  const DriveService = {
    _sleep: function(ms) { return new Promise(r => setTimeout(r, ms)); },

    async _auth(accountId) {
      return window.SIGR.GoogleAuthService.getAccessToken(accountId);
    },

    /* fetch with automatic retry + exponential backoff (never gives up silently) */
    async _fetch(accountId, url, options, retries) {
      let attempt = 0;
      const maxTries = retries === undefined ? 4 : retries;
      while (true) {
        const token = await window.SIGR.GoogleAuthService.getAccessToken(accountId, attempt > 0);
        const res = await fetch(url, Object.assign({}, options, {
          headers: Object.assign({ Authorization: 'Bearer ' + token }, (options && options.headers) || {})
        }));
        if (res.ok) return res;
        const body = await res.clone().json().catch(() => null);
        const status = res.status;
        const apiError = body && body.error;
        const authProblem = status === 401 || !!(apiError && (apiError.code === 401 ||
          (apiError.code === 403 && /invalid_grant|invalid_client|authError|expired/i.test(apiError.message || ''))));
        if (authProblem) {
          await window.SIGR.GoogleAuthService.invalidateToken(accountId);
          if (attempt === 0) { attempt++; continue; }
        }
        const retryable = status === 429 || status >= 500 || status === 408 || status === 0;
        if (!retryable || attempt >= maxTries) {
          const err = new Error(apiError && apiError.message ? apiError.message : 'Error de Drive (HTTP ' + status + ')');
          err.status = status;
          err.apiError = apiError;
          throw err;
        }
        const backoff = Math.min(30000, 1000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
        await this._sleep(backoff);
        attempt++;
      }
    },

    async _json(accountId, url, options, retries) {
      const res = await this._fetch(accountId, url, options, retries);
      return res.json();
    },

    /* ---------------- folders ---------------- */

    async ensureFolder(accountId, folderName) {
      const q = encodeURIComponent("name='" + folderName.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const list = await this._json(accountId, BASE + '/files?q=' + q + '&fields=files(id,name,createdTime)&pageSize=100&spaces=drive');
      if (list.files && list.files.length) return list.files[0];
      const mk = await this._json(accountId, BASE + '/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' })
      });
      return mk;
    },

    async listFolders(accountId, parentId, sharedWithMe) {
      let q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
      if (parentId) q = "'" + parentId + "' in parents and " + q;
      if (sharedWithMe) q = 'sharedWithMe=true and ' + q;
      const enc = encodeURIComponent(q);
      return this._json(accountId, BASE + '/files?q=' + enc + '&fields=files(id,name,createdTime)&pageSize=100&spaces=drive&orderBy=name');
    },

    /* ---------------- files ---------------- */

    async listFiles(accountId, folderId, fields) {
      const q = encodeURIComponent("'" + folderId + "' in parents and trashed=false");
      const f = fields || 'files(id,name,createdTime,modifiedTime,size,md5Checksum)';
      const out = [];
      let pageToken = null;
      do {
        const url = BASE + '/files?q=' + q + '&fields=' + encodeURIComponent('nextPageToken,' + f) + '&pageSize=200&orderBy=createdTime' + (pageToken ? '&pageToken=' + pageToken : '');
        const data = await this._json(accountId, url);
        (data.files || []).forEach(x => out.push(x));
        pageToken = data.nextPageToken || null;
      } while (pageToken);
      return out;
    },

    async upload(accountId, folderId, fileName, blob, mimeType) {
      let attempt = 0;
      const maxTries = 4;
      while (true) {
        try {
          const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: mimeType || 'application/octet-stream' });
          const metadata = new Blob([meta], { type: 'application/json; charset=UTF-8' });
          const form = new FormData();
          form.append('metadata', metadata);
          form.append('file', blob, fileName);
          const res = await this._fetch(accountId, UPLOAD_BASE + '/files?uploadType=multipart&fields=id,name,size,md5Checksum,modifiedTime', {
            method: 'POST',
            body: form
          }, 1);
          return await res.json();
        } catch (e) {
          if (attempt >= maxTries) throw e;
          const backoff = Math.min(30000, 1500 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
          await this._sleep(backoff);
          attempt++;
        }
      }
    },

    async download(accountId, fileId) {
      const res = await this._fetch(accountId, BASE + '/files/' + encodeURIComponent(fileId) + '?alt=media', {}, 4);
      return res.blob();
    },

    async remove(accountId, fileId) {
      return this._fetch(accountId, BASE + '/files/' + encodeURIComponent(fileId), { method: 'DELETE' });
    },

    async getFile(accountId, fileId) {
      return this._json(accountId, BASE + '/files/' + encodeURIComponent(fileId) + '?fields=id,name,size,md5Checksum,modifiedTime,createdTime');
    }
  };

  window.SIGR.DriveService = DriveService;
})();
