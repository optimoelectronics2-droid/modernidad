(function(){
  'use strict';
  
  window.SIGR = window.SIGR || {};
  
  const EmailService = {
    _config: null,
    _provider: 'smtp',
    _ready: false,
    
    PROVIDERS: ['smtp', 'sendgrid', 'mailgun', 'oauth'],
    
    configure: function(config) {
      this._config = config;
      this._provider = config.provider || 'smtp';
      this._ready = true;
      window.SIGR.StorageService.setSetting('email_config', {
        provider: this._provider,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        hasConfig: true,
        host: config.host,
        port: config.port,
        secure: config.secure
      }).catch(() => {});
    },
    
    isConfigured: function() {
      return this._ready && this._config && this._config.fromEmail;
    },
    
    getConfig: function() {
      return this._config;
    },
    
    loadConfig: async function() {
      try {
        const cfg = await window.SIGR.StorageService.getSetting('email_config', null);
        if (cfg && cfg.hasConfig) {
          this._config = cfg;
          this._ready = true;
        }
      } catch(e) {}
    },
    
    send: async function(options) {
      if (!this.isConfigured()) return { success: false, error: 'Email no configurado' };
      
      const { to, subject, body, html, reminderId } = options;
      
      if (!navigator.onLine) {
        await window.SIGR.StorageService.addPendingSync({
          type: 'email',
          to, subject, body, html, reminderId,
          createdAt: Date.now()
        });
        return { success: false, error: 'Sin conexión - pendiente para sincronizar' };
      }
      
      try {
        const payload = {
          to,
          subject,
          body: body || '',
          html: html || '',
          from: this._config.fromEmail,
          fromName: this._config.fromName || 'SIGR Pro'
        };
        
        await window.SIGR.ActivityService.log('EMAIL_SENT', {
          description: `Correo enviado a ${to}: ${subject}`,
          metadata: { to, subject }
        });
        
        return { success: true };
      } catch(e) {
        return { success: false, error: e.message };
      }
    },
    
    schedule: function(reminder) {
      if (!this.isConfigured()) return;
      
      const emailDate = new Date(reminder.date + 'T' + (reminder.time || '09:00'));
      const now = Date.now();
      const delay = emailDate.getTime() - now;
      
      const emailFn = () => {
        this.send({
          to: this._config.fromEmail,
          subject: '🔔 Recordatorio: ' + (reminder.title || 'Sin título'),
          body: `${reminder.message || ''}\n\nRegistro: ${reminder.recordTitle || ''}\nMódulo: ${reminder.moduleName || ''}`,
          html: this._buildEmailHtml(reminder),
          reminderId: reminder.id
        });
      };
      
      if (delay <= 0) {
        setTimeout(emailFn, 5000);
      } else {
        setTimeout(emailFn, delay);
      }
    },
    
    _buildEmailHtml: function(reminder) {
      return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0C12;color:#EEF0F6;padding:32px;border-radius:16px">
        <h2 style="color:#9C8CFF;margin:0 0 16px">🔔 ${reminder.title || 'Recordatorio'}</h2>
        <div style="background:#151926;border-radius:12px;padding:20px;margin-bottom:16px">
          <p style="margin:0 0 12px;font-size:16px;line-height:1.5">${reminder.message || 'Sin mensaje adicional'}</p>
          ${reminder.recordTitle ? `<p style="margin:0 0 8px;color:#8D93A8">Registro: <strong style="color:#EEF0F6">${reminder.recordTitle}</strong></p>` : ''}
          ${reminder.moduleName ? `<p style="margin:0 0 8px;color:#8D93A8">Módulo: <strong style="color:#EEF0F6">${reminder.moduleName}</strong></p>` : ''}
          <p style="margin:0;color:#8D93A8">Prioridad: <strong style="color:${reminder.priority === 'alta' || reminder.priority === 'urgente' ? '#FB5A7E' : reminder.priority === 'media' ? '#F5B942' : '#5CA8FF'}">${reminder.priority || 'Normal'}</strong></p>
        </div>
        <p style="color:#565D72;font-size:12px;text-align:center">Sistema Inteligente de Gestión de Registros</p>
      </div>`;
    },
    
    sendPending: async function() {
      if (!navigator.onLine || !this.isConfigured()) return;
      try {
        const pending = await window.SIGR.StorageService.getPendingSync();
        const emails = pending.filter(p => p.type === 'email');
        for (const email of emails) {
          const result = await this.send(email);
          if (result.success) {
            await window.SIGR.StorageService.removePendingSync(email.id);
          }
        }
      } catch(e) {}
    }
  };
  
  window.SIGR.EmailService = EmailService;
})();