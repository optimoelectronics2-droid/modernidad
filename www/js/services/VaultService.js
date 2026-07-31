(function(){
  'use strict';
  window.SIGR = window.SIGR || {};

  const VAULT_CATEGORIES = [
    { id: 'social', label: 'Red Social' },
    { id: 'email', label: 'Email' },
    { id: 'bank', label: 'Banco' },
    { id: 'work', label: 'Trabajo' },
    { id: 'entertainment', label: 'Entretenimiento' },
    { id: 'shopping', label: 'Compras' },
    { id: 'other', label: 'Otro' }
  ];

  const STORE_KEY = 'vault_config';
  let _unlocked = false;
  let _masterKey = null;

  function getSalt() {
    let salt = localStorage.getItem('sigr:vault_salt');
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16));
      salt = btoa(String.fromCharCode(...salt));
      localStorage.setItem('sigr:vault_salt', salt);
    }
    return Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  }

  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  async function decrypt(ciphertextB64, key) {
    const combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  }

  const VaultService = {
    getCategories() { return VAULT_CATEGORIES; },
    isUnlocked() { return _unlocked; },

    isConfigured() {
      return !!localStorage.getItem(STORE_KEY);
    },

    async setup(masterPassword) {
      if (masterPassword.length < 4) throw new Error('La contrase\u00F1a debe tener al menos 4 caracteres');
      localStorage.removeItem('sigr:vault_salt');
      const salt = getSalt();
      _masterKey = await deriveKey(masterPassword, salt);
      const testEnc = await encrypt('vault_ok', _masterKey);
      localStorage.setItem(STORE_KEY, JSON.stringify({ test: testEnc, createdAt: Date.now() }));
      _unlocked = true;
      return true;
    },

    async unlock(masterPassword) {
      try {
        const cfg = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        if (!cfg.test) throw new Error('B\u00F3veda no configurada');
        const salt = getSalt();
        _masterKey = await deriveKey(masterPassword, salt);
        const dec = await decrypt(cfg.test, _masterKey);
        if (dec !== 'vault_ok') throw new Error('Contrase\u00F1a incorrecta');
        _unlocked = true;
        return true;
      } catch(e) {
        _masterKey = null;
        _unlocked = false;
        throw e;
      }
    },

    lock() {
      _unlocked = false;
      _masterKey = null;
    },

    async changePassword(oldPassword, newPassword) {
      if (!oldPassword || !newPassword) throw new Error('Se requieren ambas contrase\u00F1as');
      const cfg = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (!cfg.test) throw new Error('B\u00F3veda no configurada');
      const salt = getSalt();
      const oldKey = await deriveKey(oldPassword, salt);
      const items = await this.getAllItems();
      this.lock();
      localStorage.removeItem('sigr:vault_salt');
      const newSalt = getSalt();
      _masterKey = await deriveKey(newPassword, newSalt);
      for (const item of items) {
        if (item.encrypted) {
          try {
            const dec = await decrypt(item.encrypted, oldKey);
            item.encrypted = await encrypt(dec, _masterKey);
          } catch(e) {
            console.warn('Vault: item re-encrypt skipped', item.id, e.message);
          }
        }
      }
      const testEnc = await encrypt('vault_ok', _masterKey);
      localStorage.setItem(STORE_KEY, JSON.stringify({ test: testEnc, createdAt: Date.now() }));
      _unlocked = true;
      return true;
    },

    async saveItem(data) {
      if (!_unlocked || !_masterKey) throw new Error('B\u00F3veda bloqueada');
      const plainPayload = JSON.stringify({
        username: data.username || '',
        password: data.password || '',
        notes: data.notes || ''
      });
      const encrypted = await encrypt(plainPayload, _masterKey);
      return window.SIGR.StorageService.addVaultItem({
        id: 'vlt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
        service: data.service || '',
        category: data.category || 'other',
        url: data.url || '',
        encrypted: encrypted
      });
    },

    async updateItem(data) {
      if (!_unlocked || !_masterKey) throw new Error('B\u00F3veda bloqueada');
      const existing = await window.SIGR.StorageService.getVaultItem(data.id);
      if (!existing) return null;
      const plainPayload = JSON.stringify({
        username: data.username || '',
        password: data.password || '',
        notes: data.notes || ''
      });
      existing.service = data.service || '';
      existing.category = data.category || 'other';
      existing.url = data.url || '';
      existing.encrypted = await encrypt(plainPayload, _masterKey);
      return window.SIGR.StorageService.updateVaultItem(existing);
    },

    async getItem(id) {
      const item = await window.SIGR.StorageService.getVaultItem(id);
      if (!item || !_unlocked || !_masterKey) return item;
      if (item.encrypted) {
        const dec = await decrypt(item.encrypted, _masterKey);
        const data = JSON.parse(dec);
        item._username = data.username;
        item._password = data.password;
        item._notes = data.notes;
      }
      return item;
    },

    async getAllItems() {
      const items = await window.SIGR.StorageService.getAllVaultItems();
      if (!_unlocked || !_masterKey) return items.map(i => ({ ...i, _locked: true }));
      for (const item of items) {
        if (item.encrypted) {
          try {
            const dec = await decrypt(item.encrypted, _masterKey);
            const data = JSON.parse(dec);
            item._username = data.username;
            item._password = data.password;
            item._notes = data.notes;
            item._locked = false;
          } catch(e) {
            item._locked = true;
          }
        }
      }
      return items;
    },

    async deleteItem(id) {
      return window.SIGR.StorageService.deleteVaultItem(id);
    }
  };

  window.SIGR.VaultService = VaultService;
})();
