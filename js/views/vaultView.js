(function(){
  'use strict';
  window.SIGR = window.SIGR || {};

  const esc = s => (s??'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const CAT_LABELS = {
    social: 'Red Social', email: 'Email', bank: 'Banco',
    work: 'Trabajo', entertainment: 'Entretenimiento', shopping: 'Compras', other: 'Otro'
  };
  const CAT_COLORS = {
    'Red Social':'#3B82F6','Email':'#8B5CF6','Banco':'#10B981',
    'Trabajo':'#F59E0B','Entretenimiento':'#EC4899','Compras':'#EF4444','Otro':'#6B7280'
  };

  const VaultView = {
    _search: '',

    async render() {
      const V = window.SIGR.VaultService;
      if (!V.isConfigured()) return this._renderSetup();
      if (!V.isUnlocked()) return this._renderLock();
      return this._renderVault();
    },

    _renderSetup() {
      return '<div class="fin-view">'+
        '<div class="topbar"><button class="back-btn" data-action="back">\u2190</button><div class="topbar-title"><h1>B\u00F3veda</h1></div></div>'+
        '<div class="fin-content" style="text-align:center;padding:40px 20px">'+
        '<div style="font-size:64px;margin-bottom:16px">\uD83D\uDD10</div>'+
        '<div style="font-size:18px;font-weight:700;margin-bottom:4px">Configurar B\u00F3veda</div>'+
        '<div style="font-size:13px;color:var(--text-dim);margin-bottom:20px">AES-256-GCM + PBKDF2</div>'+
        '<input type="password" id="vaultSetupPass" class="form-input" placeholder="Contrase\u00F1a maestra (m\u00EDn. 4 caracteres)" style="max-width:280px;margin:0 auto 12px">'+
        '<input type="password" id="vaultSetupPass2" class="form-input" placeholder="Repetir contrase\u00F1a" style="max-width:280px;margin:0 auto 12px">'+
        '<button class="btn btn-primary" data-action="vaultSetup" style="display:block;margin:0 auto">Crear B\u00F3veda</button></div></div>';
    },

    _renderLock() {
      return '<div class="fin-view">'+
        '<div class="topbar"><button class="back-btn" data-action="back">\u2190</button><div class="topbar-title"><h1>B\u00F3veda</h1></div></div>'+
        '<div class="fin-content" style="text-align:center;padding:40px 20px">'+
        '<div style="font-size:64px;margin-bottom:16px">\uD83D\uDD12</div>'+
        '<div style="font-size:18px;font-weight:700;margin-bottom:4px">B\u00F3veda Bloqueada</div>'+
        '<div style="font-size:13px;color:var(--text-dim);margin-bottom:20px">AES-256-GCM + PBKDF2</div>'+
        '<input type="password" id="vaultUnlockPass" class="form-input" placeholder="Contrase\u00F1a maestra" style="max-width:280px;margin:0 auto 12px">'+
        '<button class="btn btn-primary" data-action="vaultUnlock" style="display:block;margin:0 auto">Desbloquear</button></div></div>';
    },

    async _renderVault() {
      const V = window.SIGR.VaultService;
      const items = await V.getAllItems();
      const q = this._search.toLowerCase();
      const filtered = q ? items.filter(i => (i.service||'').toLowerCase().includes(q) || (i._username||'').toLowerCase().includes(q)) : items;

      const list = filtered.map(item => {
        const catLabel = CAT_LABELS[item.category] || 'Otro';
        const color = CAT_COLORS[catLabel] || '#6B7280';
        const icon = catLabel==='Red Social'?'\uD83D\uDCF1':catLabel==='Email'?'\u2709\uFE0F':catLabel==='Banco'?'\uD83C\uDFE6':catLabel==='Trabajo'?'\uD83D\uDCBC':catLabel==='Entretenimiento'?'\uD83C\uDFAE':catLabel==='Compras'?'\uD83D\uDED2':'\uD83D\uDCE6';
        return '<div class="vault-item" data-vault-id="'+esc(item.id)+'">'+
          '<div class="vault-item-icon">'+icon+'</div>'+
          '<div class="vault-item-info" data-action="vaultShowItem" data-vault-id="'+esc(item.id)+'">'+
          '<div class="vault-item-service">'+esc(item.service||'Sin nombre')+'</div>'+
          '<div class="vault-item-meta"><span class="vault-item-user">'+esc(item._username||'')+'</span><span class="vault-item-badge" style="background:'+color+'18;color:'+color+'">'+esc(catLabel)+'</span></div></div>'+
          '<div class="vault-item-actions">'+
          '<button class="vault-item-btn" data-action="vaultEditItem" data-vault-id="'+esc(item.id)+'" title="Editar">\u270F\uFE0F</button>'+
          '<button class="vault-item-btn" data-action="vaultDeleteItem" data-vault-id="'+esc(item.id)+'" title="Eliminar" style="color:var(--danger)">\u2716</button></div></div>';
      }).join('');

      return '<div class="fin-view">'+
        '<div class="topbar"><button class="back-btn" data-action="back">\u2190</button><div class="topbar-title"><h1>B\u00F3veda</h1></div><button class="btn btn-sm" data-action="vaultLock" style="margin-right:8px;color:var(--text-dim)">\uD83D\uDD12 Bloquear</button></div>'+
        '<div class="vault-toolbar"><input type="text" id="vaultSearch" class="form-input" placeholder="Buscar..." value="'+esc(this._search)+'" data-action="vaultSearch"></div>'+
        '<div class="vault-content">'+
        '<div class="vault-list">'+(list||'<div class="empty-small" style="padding:40px 0;text-align:center;color:var(--text-faint)">\uD83D\uDD10 Sin elementos a\u00FAn</div>')+'</div></div>'+
        '<button class="vault-fab" data-action="vaultNewItem">+</button></div>';
    },

    async _showItemModal(item) {
      const cats = window.SIGR.VaultService.getCategories();
      const catOpts = cats.map(c => '<option value="'+c.id+'" '+(item&&item.category===c.id?'selected':'')+'>'+c.label+'</option>').join('');
      const isNew = !item;
      const body =
        '<div class="form-group"><label>Servicio</label><input type="text" id="vaultService" class="form-input" value="'+(item?esc(item.service):'')+'" placeholder="ej: Gmail, Netflix"></div>'+
        '<div class="form-group"><label>Categor\u00EDa</label><select id="vaultCategory" class="form-input">'+catOpts+'</select></div>'+
        '<div class="form-group"><label>Usuario / Email</label><input type="text" id="vaultUsername" class="form-input" value="'+(item?esc(item._username||''):'')+'" placeholder="usuario@email.com"></div>'+
        '<div class="form-group"><label>Contrase\u00F1a</label><input type="password" id="vaultPassword" class="form-input" value="'+(item?esc(item._password||''):'')+'" placeholder="Contrase\u00F1a"></div>'+
        '<div class="form-group"><label>URL</label><input type="url" id="vaultUrl" class="form-input" value="'+(item?esc(item.url||''):'')+'" placeholder="https://..."></div>'+
        '<div class="form-group"><label>Notas</label><textarea id="vaultNotes" class="form-input" placeholder="Notas">'+(item?esc(item._notes||''):'')+'</textarea></div>';
      const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-primary" data-action="'+(isNew?'vaultSaveItem':'vaultUpdateItem')+'" data-vault-id="'+(item?esc(item.id):'')+'">Guardar \uD83D\uDD10</button>';
      window.openModal({ title: isNew?'Nueva Contrase\u00F1a':'Editar', body, footer });
    },

    async handleAction(el) {
      const V = window.SIGR.VaultService;
      const action = el.dataset.action;
      switch(action) {
        case 'vaultSetup': {
          const p1 = document.getElementById('vaultSetupPass')?.value;
          const p2 = document.getElementById('vaultSetupPass2')?.value;
          if (!p1 || p1.length < 4) { window.showToast('M\u00EDnimo 4 caracteres'); return; }
          if (p1 !== p2) { window.showToast('Las contrase\u00F1as no coinciden'); return; }
          try { await V.setup(p1); window.showToast('B\u00F3veda creada'); window.SIGR.StateService.notify(); }
          catch(e) { window.showToast('Error: '+e.message); }
          break;
        }
        case 'vaultUnlock': {
          const pass = document.getElementById('vaultUnlockPass')?.value;
          if (!pass) { window.showToast('Ingresa la contrase\u00F1a'); return; }
          try { await V.unlock(pass); window.showToast('B\u00F3veda desbloqueada'); window.SIGR.StateService.notify(); }
          catch(e) { window.showToast('Error: '+e.message); }
          break;
        }
        case 'vaultLock':
          V.lock(); window.SIGR.StateService.notify(); break;
        case 'vaultNewItem':
          this._showItemModal(null); break;
        case 'vaultSaveItem': {
          try {
            await V.saveItem({
              service: document.getElementById('vaultService')?.value,
              category: document.getElementById('vaultCategory')?.value,
              username: document.getElementById('vaultUsername')?.value,
              password: document.getElementById('vaultPassword')?.value,
              url: document.getElementById('vaultUrl')?.value,
              notes: document.getElementById('vaultNotes')?.value
            });
            window.closeModal(); window.showToast('Guardado'); window.SIGR.StateService.notify();
          } catch(e) { window.showToast('Error: ' + e.message); }
          break;
        }
        case 'vaultEditItem': {
          const item = await V.getItem(el.dataset.vaultId);
          if (item) this._showItemModal(item);
          break;
        }
        case 'vaultUpdateItem': {
          const id = el.dataset.vaultId;
          if (id) {
            try {
              await V.updateItem({
                id,
                service: document.getElementById('vaultService')?.value,
                category: document.getElementById('vaultCategory')?.value,
                username: document.getElementById('vaultUsername')?.value,
                password: document.getElementById('vaultPassword')?.value,
                url: document.getElementById('vaultUrl')?.value,
                notes: document.getElementById('vaultNotes')?.value
              });
              window.closeModal(); window.showToast('Actualizado'); window.SIGR.StateService.notify();
            } catch(e) { window.showToast('Error: ' + e.message); }
          }
          break;
        }
        case 'vaultShowItem': {
          const item = await V.getItem(el.dataset.vaultId);
          if (!item) return;
          const hasU = !!(item._username||''), hasP = !!(item._password||''), hasN = !!(item._notes||'');
          const body =
            '<div class="vd-row"><label>Servicio</label><span>'+esc(item.service||'')+'</span></div>'+
            '<div class="vd-row"><label>Usuario</label><div class="vd-val"><span>'+esc(item._username||'')+'</span>'+(hasU?'<button class="vd-copy" data-action="vaultCopyField" data-value="'+esc(item._username)+'" title="Copiar">\uD83D\uDCCB</button>':'')+'</div></div>'+
            '<div class="vd-row"><label>Contrase\u00F1a</label><div class="vd-val"><span style="font-family:monospace">'+esc(item._password||'')+'</span>'+(hasP?'<button class="vd-copy" data-action="vaultCopyField" data-value="'+esc(item._password)+'" title="Copiar">\uD83D\uDCCB</button>':'')+'</div></div>'+
            '<div class="vd-row"><label>URL</label><span>'+(item.url?'<a href="'+esc(item.url)+'" target="_blank" style="color:var(--accent)">'+esc(item.url)+'</a>':'<span class="vd-empty">\u2014</span>')+'</span></div>'+
            '<div class="vd-row"><label>Notas</label><span>'+(hasN?esc(item._notes):'<span class="vd-empty">\u2014</span>')+'</span></div>';
          const footer = '<button class="btn" data-action="closeModal">Cerrar</button>';
          window.openModal({ title: item.service||'Detalle', body, footer });
          break;
        }
        case 'vaultCopyField': {
          const val = el.dataset.value;
          if (!val) break;
          try {
            await navigator.clipboard.writeText(val);
            const orig = el.innerHTML;
            el.innerHTML = '\u2713';
            el.style.color = 'var(--ok)';
            setTimeout(() => { el.innerHTML = orig; el.style.color = ''; }, 1200);
          } catch(e) { window.showToast('Error al copiar'); }
          break;
        }
        case 'vaultDeleteItem': {
          const id = el.dataset.vaultId;
          if (!id) break;
          const body =
            '<div style="text-align:center;padding:30px 20px"><div style="font-size:48px;margin-bottom:12px">\u26A0\uFE0F</div>'+
            '<div style="font-size:16px;color:var(--text);margin-bottom:4px">Eliminar este elemento?</div>'+
            '<div style="font-size:13px;color:var(--text-faint)">No se puede recuperar</div></div>';
          const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-danger" data-action="vaultConfirmDelete" data-vault-id="'+esc(id)+'">Eliminar</button>';
          window.openModal({ title: 'Eliminar', body, footer, closeOnOverlay: false });
          break;
        }
        case 'vaultConfirmDelete': {
          await V.deleteItem(el.dataset.vaultId);
          window.closeModal(); window.showToast('Eliminado'); window.SIGR.StateService.notify();
          break;
        }
        case 'vaultSearch':
          this._search = el.value;
          window.SIGR.StateService.notify(); break;
      }
    }
  };

  window.SIGR.VaultView = VaultView;
})();
