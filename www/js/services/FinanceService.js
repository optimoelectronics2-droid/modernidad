(function(){
  'use strict';
  window.SIGR = window.SIGR || {};

  const FINANCE_CATEGORIES = [
    'Alimentación', 'Transporte', 'Salud', 'Educación',
    'Entretenimiento', 'Servicios', 'Ropa', 'Hogar',
    'Negocio', 'Inversión', 'Salario', 'Freelance',
    'Deuda cobrada', 'Otro'
  ];

  const FINANCE_FREQUENCIES = [
    { id: 'unique', label: 'Único' },
    { id: 'weekly', label: 'Semanal' },
    { id: 'biweekly', label: 'Quincenal' },
    { id: 'monthly', label: 'Mensual' },
    { id: 'yearly', label: 'Anual' }
  ];

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  }

  function monthKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  }

  function startOfMonth(monthStr) {
    const [y,m] = monthStr.split('-').map(Number);
    return new Date(y,m-1,1).getTime();
  }

  function endOfMonth(monthStr) {
    const [y,m] = monthStr.split('-').map(Number);
    return new Date(y,m,0,23,59,59,999).getTime();
  }

  const FinanceService = {

    getCategories() { return FINANCE_CATEGORIES; },
    getFrequencies() { return FINANCE_FREQUENCIES; },

    /* ─── Movements CRUD ─── */
    async addMovement(data) {
      const m = {
        type: data.type,
        amount: parseFloat(data.amount) || 0,
        category: data.category || 'Otro',
        description: data.description || '',
        frequency: data.frequency || 'unique',
        date: data.date ? new Date(data.date).getTime() : Date.now(),
        note: data.note || '',
        monthRef: data.monthRef || monthKey(data.date || Date.now())
      };
      return window.SIGR.StorageService.addFinMovement(m);
    },

    async updateMovement(data) {
      const existing = await window.SIGR.StorageService.getFinMovement(data.id);
      if (!existing) return null;
      Object.assign(existing, {
        type: data.type, amount: parseFloat(data.amount) || 0,
        category: data.category, description: data.description,
        frequency: data.frequency, date: new Date(data.date).getTime(),
        note: data.note, monthRef: data.monthRef || monthKey(data.date)
      });
      return window.SIGR.StorageService.updateFinMovement(existing);
    },

    async deleteMovement(id) {
      return window.SIGR.StorageService.deleteFinMovement(id);
    },

    async getMovement(id) {
      return window.SIGR.StorageService.getFinMovement(id);
    },

    async getAllMovements(filter) {
      return window.SIGR.StorageService.getAllFinMovements(filter);
    },

    /* ─── Balances & Aggregations ─── */
    async getBalance() {
      const all = await this.getAllMovements();
      let income = 0, expense = 0;
      for (const m of all) {
        if (m.type === 'income') income += m.amount;
        else expense += m.amount;
      }
      return { income, expense, balance: income - expense, count: all.length };
    },

    async getBalanceByPeriod(start, end) {
      const all = await this.getAllMovements(m => {
        const d = m.date || m.createdAt;
        return d >= start && d <= end;
      });
      let income = 0, expense = 0;
      for (const m of all) {
        if (m.type === 'income') income += m.amount;
        else expense += m.amount;
      }
      return { income, expense, balance: income - expense, movements: all };
    },

    async getBalanceByMonth(monthStr) {
      const start = startOfMonth(monthStr);
      const end = endOfMonth(monthStr);
      return this.getBalanceByPeriod(start, end);
    },

    async getExpensesByCategory(monthStr) {
      const all = monthStr ? (await this.getBalanceByMonth(monthStr)).movements : await this.getAllMovements();
      const map = {};
      for (const m of all) {
        if (m.type !== 'expense') continue;
        const cat = m.category || 'Otro';
        if (!map[cat]) map[cat] = 0;
        map[cat] += m.amount;
      }
      const total = Object.values(map).reduce((a,b) => a+b, 0);
      return Object.entries(map).map(([category, amount]) => ({
        category, amount, pct: total ? Math.round(amount/total*100) : 0
      })).sort((a,b) => b.amount - a.amount);
    },

    async getMonthlyTrend(monthsBack) {
      const all = await this.getAllMovements();
      const map = {};
      for (const m of all) {
        const mk = m.monthRef || monthKey(m.date || m.createdAt);
        if (!map[mk]) map[mk] = { income: 0, expense: 0 };
        if (m.type === 'income') map[mk].income += m.amount;
        else map[mk].expense += m.amount;
      }
      const now = new Date();
      const result = [];
      for (let i = (monthsBack||6); i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mk = monthKey(d.getTime());
        result.push({
          month: mk,
          label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          income: (map[mk]||{}).income || 0,
          expense: (map[mk]||{}).expense || 0
        });
      }
      return result;
    },

    async getCashFlow(days) {
      days = days || 14;
      const end = Date.now();
      const start = end - (days * 86400000);
      const all = await this.getAllMovements(m => {
        const d = m.date || m.createdAt;
        return d >= start && d <= end;
      });
      const map = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - (i * 86400000));
        const key = d.toISOString().slice(0,10);
        map[key] = { date: key, label: d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }), income: 0, expense: 0 };
      }
      for (const m of all) {
        const d = new Date(m.date || m.createdAt);
        const key = d.toISOString().slice(0,10);
        if (map[key]) {
          if (m.type === 'income') map[key].income += m.amount;
          else map[key].expense += m.amount;
        }
      }
      return Object.values(map).reverse();
    },

    async getRecent(limit) {
      limit = limit || 5;
      const all = await this.getAllMovements();
      return all.slice(0, limit);
    },

    async getStats() {
      const balance = await this.getBalance();
      const cats = await this.getExpensesByCategory();
      const topIncome = (await this.getAllMovements(m => m.type === 'income'))
        .sort((a,b) => b.amount - a.amount)[0];
      const topExpense = (await this.getAllMovements(m => m.type === 'expense'))
        .sort((a,b) => b.amount - a.amount)[0];
      const totalMovs = balance.count;
      const days = totalMovs > 0 ? Math.max(1, Math.round((Date.now() - Math.min(...(await this.getAllMovements()).map(m => m.date||m.createdAt))) / 86400000)) : 1;
      return {
        balance: balance.balance,
        income: balance.income,
        expense: balance.expense,
        savingsRate: balance.income > 0 ? Math.round((balance.balance / balance.income) * 100) : 0,
        spendingPerDay: Math.round(balance.expense / days),
        topIncome: topIncome ? { amount: topIncome.amount, category: topIncome.category } : null,
        topExpense: topExpense ? { amount: topExpense.amount, category: topExpense.category } : null
      };
    },

    /* ─── Debts (Persons) ─── */
    async addPerson(data) {
      return window.SIGR.StorageService.addFinPerson({
        name: data.name, type: data.type,
        phone: data.phone || '', note: data.note || ''
      });
    },

    async updatePerson(data) {
      const existing = await window.SIGR.StorageService.getFinPerson(data.id);
      if (!existing) return null;
      Object.assign(existing, { name: data.name, type: data.type, phone: data.phone, note: data.note });
      return window.SIGR.StorageService.updateFinPerson(existing);
    },

    async deletePerson(id) {
      const debts = await window.SIGR.StorageService.getFinDebtsByPerson(id);
      for (const d of debts) await window.SIGR.StorageService.deleteFinDebt(d.id);
      return window.SIGR.StorageService.deleteFinPerson(id);
    },

    async getPerson(id) {
      return window.SIGR.StorageService.getFinPerson(id);
    },

    async getAllPersons() {
      return window.SIGR.StorageService.getAllFinPersons();
    },

    async addDebtMovement(data) {
      return window.SIGR.StorageService.addFinDebt({
        personId: data.personId, type: data.type,
        amount: parseFloat(data.amount) || 0,
        date: data.date ? new Date(data.date).getTime() : Date.now(),
        concept: data.concept || ''
      });
    },

    async deleteDebtMovement(id) {
      return window.SIGR.StorageService.deleteFinDebt(id);
    },

    async getPersonDebts(personId) {
      return window.SIGR.StorageService.getFinDebtsByPerson(personId);
    },

    async getPersonBalance(personId) {
      const debts = await this.getPersonDebts(personId);
      let charges = 0, payments = 0;
      for (const d of debts) {
        if (d.type === 'charge') charges += d.amount;
        else payments += d.amount;
      }
      return { charges, payments, net: charges - payments };
    },

    async getDebtSummary() {
      const persons = await this.getAllPersons();
      let debtorsTotal = 0, creditorsTotal = 0;
      const debtorList = [], creditorList = [];
      for (const p of persons) {
        const bal = await this.getPersonBalance(p.id);
        if (p.type === 'debtor') {
          debtorsTotal += bal.net;
          if (bal.net !== 0) debtorList.push({ ...p, balance: bal.net });
        } else {
          creditorsTotal += bal.net;
          if (bal.net !== 0) creditorList.push({ ...p, balance: bal.net });
        }
      }
      return {
        debtorsTotal: Math.abs(debtorsTotal),
        creditorsTotal: Math.abs(creditorsTotal),
        net: Math.abs(debtorsTotal) - Math.abs(creditorsTotal),
        debtorList: debtorList.sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance)),
        creditorList: creditorList.sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance)),
        personCount: persons.length,
        totalMovements: (await window.SIGR.StorageService.getAllFinDebts()).length
      };
    },

    /* ─── Budgets ─── */
    async setBudget(category, month, limit) {
      const existing = await window.SIGR.StorageService.getFinBudgetByCategoryMonth(category, month);
      if (existing) {
        existing.limit = parseFloat(limit) || 0;
        return window.SIGR.StorageService.addFinBudget(existing);
      }
      return window.SIGR.StorageService.addFinBudget({ category, month, limit: parseFloat(limit) || 0 });
    },

    async deleteBudget(id) {
      return window.SIGR.StorageService.deleteFinBudget(id);
    },

    async getBudgets(month) {
      const budgets = await window.SIGR.StorageService.getAllFinBudgets(month || monthKey(Date.now()));
      const expenses = await this.getExpensesByCategory(month || monthKey(Date.now()));
      const expMap = {};
      for (const e of expenses) expMap[e.category] = e.amount;
      return budgets.map(b => ({
        ...b,
        spent: expMap[b.category] || 0,
        remaining: b.limit - (expMap[b.category] || 0),
        pct: b.limit > 0 ? Math.min(100, Math.round(((expMap[b.category]||0) / b.limit) * 100)) : 0
      }));
    },

    /* ─── Calculators ─── */
    calcSavingsProjection(monthlySaving, annualRate, years) {
      const rate = (annualRate / 100) / 12;
      const months = years * 12;
      let total = 0;
      for (let i = 0; i < months; i++) {
        total = (total + monthlySaving) * (1 + rate);
      }
      return Math.round(total);
    },

    calcBudgetRule50_30_20(monthlyIncome) {
      return {
        needs: Math.round(monthlyIncome * 0.5),
        wants: Math.round(monthlyIncome * 0.3),
        savings: Math.round(monthlyIncome * 0.2)
      };
    },

    calcBreakEven(fixedCosts, unitPrice, unitVariableCost) {
      if (unitPrice <= unitVariableCost) return Infinity;
      return Math.ceil(fixedCosts / (unitPrice - unitVariableCost));
    }
  };

  window.SIGR.FinanceService = FinanceService;
})();
