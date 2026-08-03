(function(){
  'use strict';
  window.SIGR = window.SIGR || {};
  var PinLock = {};
  var LOCK_KEY = '__pin_hash';
  var _resolver = null;
  var _locked = true;
  var _visible = false;
  var _currentPin = '';

  function bufToHex(buf){
    return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  async function hashPin(pin){
    var enc = new TextEncoder().encode(pin);
    var d = await crypto.subtle.digest('SHA-256', enc);
    return bufToHex(d);
  }

  PinLock.setup = async function(){
    var hash;
    try { hash = await window.SIGR.StorageService.getSetting(LOCK_KEY, null); } catch(e){ hash = null; }
    if (!hash) {
      hash = await hashPin('0325');
      try { await window.SIGR.StorageService.setSetting(LOCK_KEY, hash); } catch(e) {}
    }
    return hash;
  };

  PinLock.isLocked = function(){ return _locked; };

  PinLock.ensure = function(){
    return new Promise(function(resolve){
      if (!_locked){ resolve(); return; }
      _resolver = resolve;
      show();
    });
  };

  function show(){
    if (_visible) return;
    _visible = true;
    var el = document.getElementById('pinLockOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pinLockOverlay';
      render(el);
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    el.querySelector('input')?.focus();
  }

  function hide(){
    _visible = false;
    var el = document.getElementById('pinLockOverlay');
    if (el) el.style.display = 'none';
  }

  function render(el){
    var nums = '';
    for (var n = 1; n <= 9; n++){
      nums += '<button class="pk-btn" data-n="' + n + '">' + n + '</button>';
    }
    nums += '<button class="pk-btn pk-empty"></button>';
    nums += '<button class="pk-btn" data-n="0">0</button>';
    nums += '<button class="pk-btn pk-del" data-n="del">⌫</button>';

    el.innerHTML = '<div class="pin-lock-bg">'
      + '<div class="pin-lock-card">'
      + '<div class="pin-lock-icon">🔒</div>'
      + '<div class="pin-lock-title">SIGR Pro</div>'
      + '<div class="pin-lock-sub">Ingresa tu PIN de acceso</div>'
      + '<div class="pin-dots" id="pinDots"><span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span></div>'
      + '<div class="pin-error" id="pinError"></div>'
      + '<div class="pin-pad">' + nums + '</div>'
      + '</div></div>';

    var input = '';
    var dots = el.querySelectorAll('.pin-dot');
    var errEl = el.querySelector('.pin-error');

    el.querySelector('.pin-pad').addEventListener('click', async function(e){
      var btn = e.target.closest('.pk-btn');
      if (!btn) return;
      var n = btn.dataset.n;
      if (n === 'del'){
        if (input.length > 0){ input = input.slice(0,-1); }
      } else if (n && /^\d$/.test(n) && input.length < 4){
        input += n;
      }
      dots.forEach(function(d,i){ d.classList.toggle('fill', i < input.length); });
      errEl.textContent = '';

      if (input.length === 4){
        var ok = await check(input);
        if (ok){ _currentPin = input; unlock(); }
        else { input = ''; dots.forEach(function(d){ d.classList.remove('fill'); }); errEl.textContent = 'PIN incorrecto'; shake(el); }
      }
    });
  }

  function shake(el){
    el.querySelector('.pin-lock-card').style.animation = 'none';
    void el.querySelector('.pin-lock-card').offsetWidth;
    el.querySelector('.pin-lock-card').style.animation = 'pinShake 0.3s ease';
  }

  async function check(pin){
    var stored = await window.SIGR.StorageService.getSetting(LOCK_KEY, null);
    if (!stored) return true;
    var h = await hashPin(pin);
    return h === stored;
  }

  function unlock(){
    _locked = false;
    hide();
    if (_resolver){ var r = _resolver; _resolver = null; r(); }
  }

  function lock(){
    if (_locked) return;
    _locked = true;
    show();
  }

  PinLock.getPin = function(){ return _currentPin || ''; };
  PinLock.lock = lock;

  document.addEventListener('visibilitychange', function(){
    if (document.hidden){ lock(); }
  });

  window.SIGR.PinLock = PinLock;
})();