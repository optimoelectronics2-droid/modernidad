(function(){
  'use strict';
  window.SIGR = window.SIGR || {};

  const S = () => window.SIGR.FinanceService;
  const esc = s => (s??'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => '$' + Number(n).toLocaleString('es-DO', {minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtDate = ts => new Date(ts).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  const monthKey = ts => { const d=new Date(ts); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };

  function topbar(title, right){
    return '<div class="topbar"><button class="back-btn" data-action="back">\u2190</button><div class="topbar-title"><h1>'+esc(title)+'</h1></div>'+(right||'')+'</div>';
  }

  const FinanceView = {
    tab: 'dashboard',
    filters: {},

    async render() {
      const state = window.SIGR.StateService.get();
      this.tab = state.finTab || 'dashboard';
      const tabs = [
        {id:'dashboard', label:'Resumen', icon:'\uD83D\uDCCA'},
        {id:'movements', label:'Movimientos', icon:'\uD83D\uDCB8'},
        {id:'debts', label:'Deudas', icon:'\uD83E\uDD1D'},
        {id:'budgets', label:'Presupuesto', icon:'\uD83D\uDCCB'},
        {id:'reports', label:'Reportes', icon:'\uD83D\uDCC8'}
      ];
      const tabBar = tabs.map(t =>
        '<button class="fin-tab'+(this.tab===t.id?' active':'')+'" data-fin-tab="'+t.id+'">'+t.icon+' '+esc(t.label)+'</button>'
      ).join('');

      let content = '';
      switch(this.tab) {
        case 'dashboard': content = await this.renderDashboard(); break;
        case 'movements': content = await this.renderMovements(); break;
        case 'debts': content = await this.renderDebts(); break;
        case 'budgets': content = await this.renderBudgets(); break;
        case 'reports': content = await this.renderReports(); break;
      }

      return '<div class="fin-view">'+topbar('Finanzas')+
        '<div class="fin-tabs">'+tabBar+'</div>'+
        '<div class="fin-content">'+content+'</div></div>';
    },

    /* ════════════ DASHBOARD ════════════ */
    async renderDashboard() {
      const bal = await S().getBalance();
      const stats = await S().getStats();
      const flow = await S().getCashFlow(14);
      const cats = await S().getExpensesByCategory();
      const recent = await S().getRecent(5);
      const total = bal.income + bal.expense;

      const flowBars = flow.map(d => {
        const max = Math.max(...flow.map(f=>Math.max(f.income,f.expense)), 1);
        const ih = Math.round((d.income/max)*60), eh = Math.round((d.expense/max)*60);
        return '<div class="flow-bar"><div class="flow-col"><div class="flow-bar-inc" style="height:'+ih+'px"></div><div class="flow-bar-exp" style="height:'+eh+'px"></div></div><div class="flow-label">'+esc(d.label)+'</div></div>';
      }).join('');

      const catBars = cats.slice(0,6).map(c =>
        '<div class="cat-row"><div class="cat-label">'+esc(c.category)+'</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:'+c.pct+'%"></div></div><div class="cat-amt">'+fmt(c.amount)+'</div><div class="cat-pct">'+c.pct+'%</div></div>'
      ).join('');

      const recentList = recent.map(m =>
        '<div class="fin-recent-item"><div class="fin-recent-icon">'+(m.type==='income'?'\uD83D\uDC9A':'\u2764\uFE0F')+'</div><div class="fin-recent-info"><div class="fin-recent-desc">'+esc(m.description||m.category)+'</div><div class="fin-recent-date">'+fmtDate(m.date||m.createdAt)+'</div></div><div class="fin-recent-amt '+(m.type==='income'?'income':'expense')+'">'+(m.type==='income'?'+':'-')+fmt(m.amount)+'</div></div>'
      ).join('');

      return '<div class="fin-dashboard">'+
        '<div class="fin-balance-card"><div class="fin-balance-label">Balance Total</div><div class="fin-balance-amount '+(bal.balance>=0?'pos':'neg')+'">'+(bal.balance<0?'-':'')+fmt(Math.abs(bal.balance))+'</div><div class="fin-balance-sub">'+bal.count+' movimientos</div></div>'+
        '<div class="fin-summary-row"><div class="fin-summary-item income"><div class="fin-summary-label">Ingresos</div><div class="fin-summary-amount">'+fmt(bal.income)+'</div></div><div class="fin-summary-item expense"><div class="fin-summary-label">Gastos</div><div class="fin-summary-amount">'+fmt(bal.expense)+'</div></div><div class="fin-summary-item"><div class="fin-summary-label">Ahorro</div><div class="fin-summary-amount">'+stats.savingsRate+'%</div></div></div>'+
        '<div class="fin-section"><div class="fin-section-title">Flujo \u2014 14 d\u00EDas</div><div class="flow-chart">'+flowBars+'<div class="flow-legend"><span class="flow-leg-inc">Ingresos</span><span class="flow-leg-exp">Gastos</span></div></div></div>'+
        '<div class="fin-section"><div class="fin-section-title">Gastos por Categor\u00EDa</div><div class="cat-chart">'+(catBars||'<div class="empty-small">Sin datos</div>')+'</div></div>'+
        '<div class="fin-section"><div class="fin-section-title">Recientes</div><div class="fin-recent-list">'+(recentList||'<div class="empty-small">Sin movimientos</div>')+'</div></div>'+
      '</div>';
    },

    /* ════════════ MOVEMENTS ════════════ */
    async renderMovements() {
      const all = await S().getAllMovements();
      const filter = this.filters.movements || {};
      let filtered = all;
      if (filter.type) filtered = filtered.filter(m => m.type === filter.type);
      if (filter.category) filtered = filtered.filter(m => m.category === filter.category);
      if (filter.month) filtered = filtered.filter(m => (m.monthRef||monthKey(m.date||m.createdAt)) === filter.month);

      const income = filtered.filter(m => m.type === 'income').reduce((s,m) => s+m.amount, 0);
      const expense = filtered.filter(m => m.type === 'expense').reduce((s,m) => s+m.amount, 0);
      const cats = S().getCategories();

      const monthOpts = [];
      const months = new Set(all.map(m => m.monthRef || monthKey(m.date||m.createdAt)));
      for (const mk of [...months].sort().reverse()) {
        const [y,m] = mk.split('-').map(Number);
        monthOpts.push({value:mk, label:new Date(y,m-1).toLocaleDateString('es-ES',{month:'long',year:'numeric'})});
      }

      const list = filtered.map(m =>
        '<div class="fin-mov-item"><div class="fin-mov-icon '+(m.type==='income'?'inc':'exp')+'"><span>'+(m.type==='income'?'+':'-')+'</span></div><div class="fin-mov-info"><div class="fin-mov-cat">'+esc(m.category||'Sin categoría')+'</div><div class="fin-mov-desc">'+esc(m.description||'')+'</div><div class="fin-mov-meta">'+esc(m.frequency||'Único')+' \u00B7 '+fmtDate(m.date||m.createdAt)+'</div></div><div class="fin-mov-amt '+(m.type==='income'?'income':'expense')+'">'+(m.type==='income'?'+':'-')+fmt(m.amount)+'</div></div>'
      ).join('');

      return '<div class="fin-movements">'+
        '<div class="fin-mov-header"><div class="fin-mov-summary"><span class="fin-mov-income">Ingresos: '+fmt(income)+'</span><span class="fin-mov-expense">Gastos: '+fmt(expense)+'</span><span class="fin-mov-balance">Balance: '+fmt(income-expense)+'</span></div></div>'+
        '<div class="fin-mov-filters"><select class="fin-filter-type" data-fin-filter="type"><option value="">Todos</option><option value="income" '+(filter.type==='income'?'selected':'')+'>Ingresos</option><option value="expense" '+(filter.type==='expense'?'selected':'')+'>Gastos</option></select>'+
        '<select class="fin-filter-cat" data-fin-filter="category"><option value="">Todas las categorías</option>'+cats.map(c => '<option value="'+c+'" '+(filter.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select>'+
        '<select class="fin-filter-month" data-fin-filter="month"><option value="">Todos los meses</option>'+monthOpts.map(o => '<option value="'+o.value+'" '+(filter.month===o.value?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>'+
        '<button class="btn btn-primary btn-sm" data-action="newFinMovement">+ Nuevo</button></div>'+
        '<div class="fin-mov-list">'+(list||'<div class="empty-small">Sin movimientos</div>')+'</div></div>';
    },

    /* ════════════ DEBTS ════════════ */
    async renderDebts() {
      const summary = await S().getDebtSummary();
      const persons = await S().getAllPersons();

      const debtorRows = summary.debtorList.map(p =>
        '<div class="fin-debt-person" data-person-id="'+esc(p.id)+'"><div class="fin-debtp-info"><div class="fin-debtp-name">'+esc(p.name)+'</div><div class="fin-debtp-phone">'+(p.phone?esc(p.phone):'')+'</div></div><div class="fin-debtp-balance">'+fmt(Math.abs(p.balance))+'</div><div class="fin-debtp-actions"><button class="btn btn-sm" data-action="finDebtDetail" data-person-id="'+esc(p.id)+'">Detalle</button><button class="btn btn-sm btn-danger" data-action="finDeletePerson" data-person-id="'+esc(p.id)+'">\u2716</button></div></div>'
      ).join('');
      const creditorRows = summary.creditorList.map(p =>
        '<div class="fin-debt-person" data-person-id="'+esc(p.id)+'"><div class="fin-debtp-info"><div class="fin-debtp-name">'+esc(p.name)+'</div><div class="fin-debtp-phone">'+(p.phone?esc(p.phone):'')+'</div></div><div class="fin-debtp-balance">'+fmt(Math.abs(p.balance))+'</div><div class="fin-debtp-actions"><button class="btn btn-sm" data-action="finDebtDetail" data-person-id="'+esc(p.id)+'">Detalle</button><button class="btn btn-sm btn-danger" data-action="finDeletePerson" data-person-id="'+esc(p.id)+'">\u2716</button></div></div>'
      ).join('');

      return '<div class="fin-debts">'+
        '<div class="fin-debt-summary"><div class="fin-debt-summary-item"><div class="fin-debt-summary-label">Me Deben</div><div class="fin-debt-summary-amount">'+fmt(summary.debtorsTotal)+'</div></div><div class="fin-debt-summary-item"><div class="fin-debt-summary-label">Yo Debo</div><div class="fin-debt-summary-amount">'+fmt(summary.creditorsTotal)+'</div></div><div class="fin-debt-summary-item"><div class="fin-debt-summary-label">Neto</div><div class="fin-debt-summary-amount">'+fmt(summary.net)+'</div></div></div>'+
        '<div class="fin-debt-info"><span>'+summary.personCount+' personas</span><span>'+summary.totalMovements+' movimientos</span></div>'+
        '<button class="btn btn-primary btn-sm" data-action="newFinPerson" style="margin:8px 0">+ Persona</button>'+
        '<div class="fin-section"><div class="fin-section-title">Deudores</div>'+(debtorRows||'<div class="empty-small">Sin deudores</div>')+'</div>'+
        '<div class="fin-section"><div class="fin-section-title">Acreedores</div>'+(creditorRows||'<div class="empty-small">Sin acreedores</div>')+'</div></div>';
    },

    async renderDebtDetail(personId) {
      const person = await S().getPerson(personId);
      if (!person) return '<div class="empty-small">Persona no encontrada</div>';
      const bal = await S().getPersonBalance(personId);
      const debts = await S().getPersonDebts(personId);
      const label = person.type === 'debtor' ? 'Me debe' : 'Le debo';
      const list = debts.map(d =>
        '<div class="fin-debt-item"><div class="fin-debt-icon '+(d.type==='charge'?'charge':'payment')+'">'+(d.type==='charge'?'\u2795':'\u2796')+'</div><div class="fin-debt-info"><div class="fin-debt-concept">'+esc(d.concept||'Sin concepto')+'</div><div class="fin-debt-date">'+fmtDate(d.date||d.createdAt)+'</div></div><div class="fin-debt-amount '+(d.type==='charge'?'charge':'payment')+'">'+(d.type==='charge'?'+':'-')+fmt(d.amount)+'</div></div>'
      ).join('');
      return '<div class="fin-debt-detail">'+
        topbar(person.name)+
        '<div class="fin-debt-detail-summary"><div class="fin-debt-detail-label">'+label+'</div><div class="fin-debt-detail-amount">'+fmt(Math.abs(bal.net))+'</div></div>'+
        '<div class="fin-debt-detail-bal"><span>Cargos: '+fmt(bal.charges)+'</span><span>Abonos: '+fmt(bal.payments)+'</span></div>'+
        '<div class="fin-debt-add"><button class="btn btn-primary btn-sm" data-action="finNewDebtMov" data-person-id="'+personId+'">+ Movimiento</button></div>'+
        '<div class="fin-debt-movs">'+(list||'<div class="empty-small">Sin movimientos</div>')+'</div></div>';
    },

    /* ════════════ BUDGETS ════════════ */
    async renderBudgets() {
      const now = new Date();
      const currentMonth = monthKey(now.getTime());
      const budgets = await S().getBudgets(currentMonth);
      const cats = S().getCategories();

      const list = budgets.map(b => {
        const pct = b.pct;
        const barClass = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
        return '<div class="fin-budget-item"><div class="fin-budget-header"><span class="fin-budget-cat">'+esc(b.category)+'</span><span class="fin-budget-pct">'+b.pct+'%</span></div><div class="fin-budget-bar-wrap"><div class="fin-budget-bar '+barClass+'" style="width:'+pct+'%"></div></div><div class="fin-budget-details"><span>Gastado: '+fmt(b.spent)+'</span><span>Límite: '+fmt(b.limit)+'</span><span class="'+(b.remaining<0?'neg':'')+'">Restante: '+fmt(b.remaining)+'</span></div></div>';
      }).join('');

      const catOpts = cats.map(c => '<option value="'+c+'">'+c+'</option>').join('');

      return '<div class="fin-budgets">'+
        '<div class="fin-section-title">Presupuesto Mensual</div>'+
        '<div class="fin-budget-add"><select class="fin-budget-cat-select">'+catOpts+'</select><input type="number" class="fin-budget-limit-input" placeholder="Límite mensual" style="width:120px"><button class="btn btn-primary btn-sm" data-action="finAddBudget">+ Agregar</button></div>'+
        '<div class="fin-budget-list">'+(list||'<div class="empty-small">Sin presupuestos definidos</div>')+'</div></div>';
    },

    /* ════════════ REPORTS ════════════ */
    async renderReports() {
      const stats = await S().getStats();
      const trend = await S().getMonthlyTrend(6);
      const cats = await S().getExpensesByCategory();

      const trendRows = trend.map(t =>
        '<tr><td>'+esc(t.label)+'</td><td class="income">'+fmt(t.income)+'</td><td class="expense">'+fmt(t.expense)+'</td></tr>'
      ).join('');

      const catTable = cats.map(c =>
        '<tr><td>'+esc(c.category)+'</td><td>'+fmt(c.amount)+'</td><td>'+c.pct+'%</td></tr>'
      ).join('');

      return '<div class="fin-reports">'+
        '<div class="fin-section"><div class="fin-section-title">Resumen</div>'+
        '<div class="fin-stats-grid"><div class="fin-stat-item"><div class="fin-stat-value">'+stats.savingsRate+'%</div><div class="fin-stat-label">Tasa Ahorro</div></div>'+
        '<div class="fin-stat-item"><div class="fin-stat-value">'+fmt(stats.spendingPerDay)+'</div><div class="fin-stat-label">Gasto/Día</div></div>'+
        '<div class="fin-stat-item"><div class="fin-stat-value income">'+(stats.topIncome?fmt(stats.topIncome.amount):'—')+'</div><div class="fin-stat-label">Mayor Ingreso</div></div>'+
        '<div class="fin-stat-item"><div class="fin-stat-value expense">'+(stats.topExpense?fmt(stats.topExpense.amount):'—')+'</div><div class="fin-stat-label">Mayor Gasto</div></div></div></div>'+

        '<div class="fin-section"><div class="fin-section-title">Gastos por Categoría</div>'+
        '<table class="fin-table"><thead><tr><th>Categoría</th><th>Monto</th><th>%</th></tr></thead><tbody>'+catTable+'</tbody></table></div>'+

        '<div class="fin-section"><div class="fin-section-title">Tendencia Mensual</div>'+
        '<table class="fin-table"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th></tr></thead><tbody>'+trendRows+'</tbody></table></div>'+

        '<div class="fin-section"><div class="fin-section-title">Calculadoras</div>'+
        '<div class="fin-calc-card"><div class="fin-calc-title">Proyección de Ahorro</div>'+
        '<input type="number" id="calcSaveMonthly" placeholder="Ahorro mensual" class="fin-calc-input"><input type="number" id="calcSaveRate" placeholder="Tasa anual %" class="fin-calc-input"><input type="number" id="calcSaveYears" placeholder="Años" class="fin-calc-input">'+
        '<button class="btn btn-primary btn-sm" data-action="finCalcSavings">Calcular</button><div id="calcSaveResult" class="fin-calc-result"></div></div>'+

        '<div class="fin-calc-card"><div class="fin-calc-title">Regla 50/30/20</div>'+
        '<input type="number" id="calcRuleIncome" placeholder="Ingreso mensual" class="fin-calc-input">'+
        '<button class="btn btn-primary btn-sm" data-action="finCalcRule">Calcular</button><div id="calcRuleResult" class="fin-calc-result"></div></div>'+

        '<div class="fin-calc-card"><div class="fin-calc-title">Punto de Equilibrio</div>'+
        '<input type="number" id="calcBreakFixed" placeholder="Costos fijos" class="fin-calc-input"><input type="number" id="calcBreakPrice" placeholder="Precio/unidad" class="fin-calc-input"><input type="number" id="calcBreakVar" placeholder="Costo variable/unit." class="fin-calc-input">'+
        '<button class="btn btn-primary btn-sm" data-action="finCalcBreakEven">Calcular</button><div id="calcBreakResult" class="fin-calc-result"></div></div></div>'+
      '</div>';
    },

    /* ═══════════════════════════════════════ */
    /* ACTIONS */
    /* ═══════════════════════════════════════ */
    async handleAction(el) {
      const action = el.dataset.action;
      switch(action) {
        case 'finTab': {
          window.SIGR.StateService.set('finTab', el.dataset.finTab);
          break;
        }
        case 'newFinMovement': {
          this._showMovementModal();
          break;
        }
        case 'saveFinMovement': {
          await this._saveMovement();
          break;
        }
        case 'newFinPerson': {
          this._showPersonModal();
          break;
        }
        case 'saveFinPerson': {
          await this._savePerson();
          break;
        }
        case 'finDebtDetail': {
          const pid = el.dataset.personId;
          const content = await this.renderDebtDetail(pid);
          const modal = document.getElementById('modal');
          if(modal) { modal.querySelector('.modal-body').innerHTML = content; modal.classList.add('open'); }
          break;
        }
        case 'finNewDebtMov': {
          this._showDebtMovModal(el.dataset.personId);
          break;
        }
        case 'saveFinDebtMov': {
          await this._saveDebtMov();
          break;
        }
        case 'finDeletePerson': {
          window.showConfirm('Eliminar persona y todos sus movimientos?', 'Eliminar', async () => {
            await S().deletePerson(el.dataset.personId);
            window.showToast('Persona eliminada');
            window.SIGR.StateService.notify();
          });
          break;
        }
        case 'finAddBudget': {
          const cat = document.querySelector('.fin-budget-cat-select')?.value;
          const limit = document.querySelector('.fin-budget-limit-input')?.value;
          if(!cat || !limit) { window.showToast('Completa los campos'); return; }
          const now = new Date();
          await S().setBudget(cat, monthKey(now.getTime()), limit);
          window.showToast('Presupuesto agregado');
          window.SIGR.StateService.notify();
          break;
        }
        case 'finCalcSavings': {
          const ms = parseFloat(document.getElementById('calcSaveMonthly')?.value) || 0;
          const rate = parseFloat(document.getElementById('calcSaveRate')?.value) || 0;
          const years = parseFloat(document.getElementById('calcSaveYears')?.value) || 0;
          const res = S().calcSavingsProjection(ms, rate, years);
          document.getElementById('calcSaveResult').innerHTML = '<div class="fin-calc-result-val">'+fmt(res)+'</div>';
          break;
        }
        case 'finCalcRule': {
          const inc = parseFloat(document.getElementById('calcRuleIncome')?.value) || 0;
          const rule = S().calcBudgetRule50_30_20(inc);
          document.getElementById('calcRuleResult').innerHTML =
            '<div class="fin-calc-rule"><span>Necesidades (50%): '+fmt(rule.needs)+'</span><span>Deseos (30%): '+fmt(rule.wants)+'</span><span>Ahorro (20%): '+fmt(rule.savings)+'</span></div>';
          break;
        }
        case 'finCalcBreakEven': {
          const fc = parseFloat(document.getElementById('calcBreakFixed')?.value) || 0;
          const pr = parseFloat(document.getElementById('calcBreakPrice')?.value) || 0;
          const vc = parseFloat(document.getElementById('calcBreakVar')?.value) || 0;
          const be = S().calcBreakEven(fc, pr, vc);
          document.getElementById('calcBreakResult').innerHTML =
            '<div class="fin-calc-result-val">'+(be===Infinity?'No alcanzable':be+' unidades')+'</div>';
          break;
        }
        case 'finFilter': {
          const select = el.querySelector('select') || el;
          const key = select.dataset.finFilter;
          if(!this.filters.movements) this.filters.movements = {};
          this.filters.movements[key] = select.value;
          window.SIGR.StateService.notify();
          break;
        }
      }
    },

    /* ─── Modal: Movement ─── */
    _showMovementModal(m) {
      const cats = S().getCategories();
      const catOpts = cats.map(c => '<option value="'+c+'" '+(m&&m.category===c?'selected':'')+'>'+c+'</option>').join('');
      const freqs = S().getFrequencies();
      const freqOpts = freqs.map(f => '<option value="'+f.id+'" '+(m&&m.frequency===f.id?'selected':'')+'>'+f.label+'</option>').join('');
      const body =
        '<div class="form-group"><label>Tipo</label><div class="fin-type-toggle"><button class="btn '+(m&&m.type==='income'?'btn-primary':'')+'" data-fin-type="income" id="finMovTypeInc">Ingreso</button><button class="btn '+(m&&m.type==='expense'?'btn-primary':'')+'" data-fin-type="expense" id="finMovTypeExp">Gasto</button></div></div>'+
        '<div class="form-group"><label>Monto</label><input type="number" id="finMovAmount" class="form-input" value="'+(m?m.amount:'')+'" placeholder="0.00"></div>'+
        '<div class="form-group"><label>Descripción</label><input type="text" id="finMovDesc" class="form-input" value="'+(m?esc(m.description):'')+'" placeholder="Descripción"></div>'+
        '<div class="form-group"><label>Categoría</label><select id="finMovCat" class="form-input">'+catOpts+'</select></div>'+
        '<div class="form-group"><label>Frecuencia</label><select id="finMovFreq" class="form-input">'+freqOpts+'</select></div>'+
        '<div class="form-group"><label>Fecha</label><input type="date" id="finMovDate" class="form-input" value="'+(m?new Date(m.date).toISOString().slice(0,10):new Date().toISOString().slice(0,10))+'"></div>'+
        '<div class="form-group"><label>Nota</label><textarea id="finMovNote" class="form-input" placeholder="Nota opcional">'+(m?esc(m.note):'')+'</textarea></div>';
      const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-primary" data-action="saveFinMovement">Guardar</button>';
      window.openModal({ title: m?'Editar Movimiento':'Nuevo Movimiento', body, footer });
      if(!m) document.getElementById('finMovTypeInc')?.classList.add('btn-primary');
    },

    async _saveMovement() {
      const typeEl = document.querySelector('[data-fin-type].btn-primary');
      const type = typeEl ? typeEl.dataset.finType : 'income';
      const amount = document.getElementById('finMovAmount')?.value;
      const description = document.getElementById('finMovDesc')?.value;
      const category = document.getElementById('finMovCat')?.value;
      const frequency = document.getElementById('finMovFreq')?.value;
      const date = document.getElementById('finMovDate')?.value;
      const note = document.getElementById('finMovNote')?.value;
      if(!amount) { window.showToast('Ingresa un monto'); return; }
      await S().addMovement({ type, amount, description, category, frequency, date, note });
      window.closeModal();
      window.showToast('Movimiento guardado');
      window.SIGR.StateService.notify();
    },

    /* ─── Modal: Person ─── */
    _showPersonModal(p) {
      const body =
        '<div class="form-group"><label>Nombre</label><input type="text" id="finPersonName" class="form-input" value="'+(p?esc(p.name):'')+'" placeholder="Nombre"></div>'+
        '<div class="form-group"><label>Tipo</label><select id="finPersonType" class="form-input"><option value="debtor" '+(p&&p.type==='debtor'?'selected':'')+'>Deudor (me debe)</option><option value="creditor" '+(p&&p.type==='creditor'?'selected':'')+'>Acreedor (yo debo)</option></select></div>'+
        '<div class="form-group"><label>Teléfono</label><input type="text" id="finPersonPhone" class="form-input" value="'+(p?esc(p.phone):'')+'" placeholder="Teléfono"></div>'+
        '<div class="form-group"><label>Nota</label><textarea id="finPersonNote" class="form-input" placeholder="Nota">'+(p?esc(p.note):'')+'</textarea></div>';
      const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-primary" data-action="saveFinPerson">Guardar</button>';
      window.openModal({ title: p?'Editar Persona':'Nueva Persona', body, footer });
    },

    async _savePerson() {
      const name = document.getElementById('finPersonName')?.value;
      const type = document.getElementById('finPersonType')?.value;
      const phone = document.getElementById('finPersonPhone')?.value;
      const note = document.getElementById('finPersonNote')?.value;
      if(!name) { window.showToast('Ingresa un nombre'); return; }
      await S().addPerson({ name, type, phone, note });
      window.closeModal();
      window.showToast('Persona guardada');
      window.SIGR.StateService.notify();
    },

    /* ─── Modal: Debt Movement ─── */
    _showDebtMovModal(personId) {
      const body =
        '<div class="form-group"><label>Tipo</label><select id="finDebtMovType" class="form-input"><option value="charge">Cargo (aumenta deuda)</option><option value="payment">Abono (disminuye deuda)</option></select></div>'+
        '<div class="form-group"><label>Monto</label><input type="number" id="finDebtMovAmount" class="form-input" placeholder="0.00"></div>'+
        '<div class="form-group"><label>Fecha</label><input type="date" id="finDebtMovDate" class="form-input" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
        '<div class="form-group"><label>Concepto</label><input type="text" id="finDebtMovConcept" class="form-input" placeholder="Concepto"></div>'+
        '<input type="hidden" id="finDebtMovPersonId" value="'+esc(personId)+'">';
      const footer = '<button class="btn" data-action="closeModal">Cancelar</button><button class="btn btn-primary" data-action="saveFinDebtMov">Agregar</button>';
      window.openModal({ title: 'Nuevo Movimiento', body, footer });
    },

    async _saveDebtMov() {
      const personId = document.getElementById('finDebtMovPersonId')?.value;
      const type = document.getElementById('finDebtMovType')?.value;
      const amount = document.getElementById('finDebtMovAmount')?.value;
      const date = document.getElementById('finDebtMovDate')?.value;
      const concept = document.getElementById('finDebtMovConcept')?.value;
      if(!amount) { window.showToast('Ingresa un monto'); return; }
      await S().addDebtMovement({ personId, type, amount, date, concept });
      window.closeModal();
      window.showToast('Movimiento agregado');
      window.SIGR.StateService.notify();
    }
  };

  window.SIGR.FinanceView = FinanceView;
})();
