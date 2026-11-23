/**
 * ROOMIE – Share Fairly, Live Comfortably
 * Demo app with LocalStorage
 */

(function () {
  'use strict';

  // ========== CONSTANTS & DEMO DATA ==========
  const STORAGE_KEY = 'roomie_data_v2'; // v2: mặc định 0đ, không còn dữ liệu mẫu
  const CATEGORIES = {
    food: { name: 'Ăn uống', icon: 'Ă', class: 'cat-food' },
    utility: { name: 'Hóa đơn', icon: 'HĐ', class: 'cat-utility' },
    household: { name: 'Đồ dùng sinh hoạt', icon: 'ĐD', class: 'cat-household' },
    shopping: { name: 'Mua sắm chung', icon: 'MS', class: 'cat-shopping' },
    other: { name: 'Khác', icon: 'K', class: 'cat-other' },
    settlement: { name: 'Thanh toán', icon: '↔', class: 'settlement' }
  };

  const MEMBER_COLORS = ['c0', 'c1', 'c2', 'c3', 'c0', 'c1', 'c2', 'c3']; // lặp lại nếu > 4 người

  const DEMO_MEMBERS = [
    { id: 'm1', name: 'Thương', avatar: 'T' },
    { id: 'm2', name: 'Minh Anh', avatar: 'M' },
    { id: 'm3', name: 'Hà', avatar: 'H' },
    { id: 'm4', name: 'Linh', avatar: 'L' }
  ];

  // Demo expenses: total 1.100.000đ
  // Tiền điện 450k (utility) - paid by Thương, equal split all 4
  // Tiền nước 180k (utility) - paid by Minh Anh, equal split all 4
  // Đồ ăn 320k (food) - paid by Hà, equal split all 4
  // Đồ dùng chung 150k (household) - paid by Linh, equal split all 4
  function createDemoExpenses() {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    return [
      {
        id: 'e1',
        name: 'Tiền điện tháng này',
        amount: 450000,
        category: 'utility',
        payerId: 'm1',
        participants: ['m1', 'm2', 'm3', 'm4'],
        splitType: 'equal',
        shares: { m1: 112500, m2: 112500, m3: 112500, m4: 112500 },
        date: `${thisMonth}-05`,
        note: 'Hóa đơn điện EVN',
        createdAt: Date.now() - 86400000 * 10
      },
      {
        id: 'e2',
        name: 'Tiền nước',
        amount: 180000,
        category: 'utility',
        payerId: 'm2',
        participants: ['m1', 'm2', 'm3', 'm4'],
        splitType: 'equal',
        shares: { m1: 45000, m2: 45000, m3: 45000, m4: 45000 },
        date: `${thisMonth}-08`,
        note: '',
        createdAt: Date.now() - 86400000 * 7
      },
      {
        id: 'e3',
        name: 'Đồ ăn siêu thị',
        amount: 320000,
        category: 'food',
        payerId: 'm3',
        participants: ['m1', 'm2', 'm3', 'm4'],
        splitType: 'equal',
        shares: { m1: 80000, m2: 80000, m3: 80000, m4: 80000 },
        date: `${thisMonth}-12`,
        note: 'Mua thực phẩm tuần',
        createdAt: Date.now() - 86400000 * 4
      },
      {
        id: 'e4',
        name: 'Đồ dùng chung',
        amount: 150000,
        category: 'household',
        payerId: 'm4',
        participants: ['m1', 'm2', 'm3', 'm4'],
        splitType: 'equal',
        shares: { m1: 37500, m2: 37500, m3: 37500, m4: 37500 },
        date: `${thisMonth}-15`,
        note: 'Nước rửa chén, giấy vệ sinh...',
        createdAt: Date.now() - 86400000 * 2
      }
    ];
  }

  function getDefaultData() {
    return {
      household: {
        name: 'The Cozy House',
        location: 'Hà Nội',
        inviteCode: 'COZY-2024-HN'
      },
      members: DEMO_MEMBERS,
      currentUserId: 'm1', // Thương
      expenses: [],      // Bắt đầu từ 0đ – người dùng tự nhập
      settlements: []
    };
  }

  function loadSampleData() {
    if (!confirm('Tải dữ liệu mẫu?\n\nSẽ thay bằng 4 khoản chi demo (tổng 1.100.000đ) và xóa thanh toán hiện tại.\nDùng khi cần thuyết trình.')) return;
    const savedUser = state.currentUserId;
    state.expenses = createDemoExpenses();
    state.settlements = [];
    if (state.members.find(m => m.id === savedUser)) {
      state.currentUserId = savedUser;
    }
    saveState();
    renderAll();
    showToast('Đã tải dữ liệu mẫu (1.100.000đ)');
  }

  // ========== STATE & STORAGE ==========
  let state = null;
  let db = null;           // Firebase database ref
  let dbRef = null;        // Reference to shared data path
  let useFirebase = false;
  let isSaving = false;    // prevent feedback loop
  let unsubscribe = null;

  function isFirebaseConfigured() {
    const cfg = window.ROOMIE_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') return false;
    if (!cfg.databaseURL || cfg.databaseURL.includes('YOUR_PROJECT')) return false;
    return typeof firebase !== 'undefined';
  }

  function initFirebase() {
    if (!isFirebaseConfigured()) {
      console.log('[ROOMIE] Firebase chưa cấu hình → dùng LocalStorage');
      useFirebase = false;
      return false;
    }
    try {
      firebase.initializeApp(window.ROOMIE_FIREBASE_CONFIG);
      db = firebase.database();
      const path = window.ROOMIE_DB_PATH || 'roomie/cozy-house';
      dbRef = db.ref(path);
      useFirebase = true;
      console.log('[ROOMIE] Đã kết nối Firebase:', path);
      return true;
    } catch (err) {
      console.error('[ROOMIE] Lỗi khởi tạo Firebase:', err);
      useFirebase = false;
      return false;
    }
  }

  function normalizeState(data) {
    if (!data) return getDefaultData();
    // Ensure arrays
    if (!Array.isArray(data.expenses)) data.expenses = [];
    if (!Array.isArray(data.settlements)) data.settlements = [];
    if (!Array.isArray(data.members)) data.members = DEMO_MEMBERS;
    // Ensure shares
    data.expenses.forEach(e => {
      if (!e.shares) e.shares = computeShares(e);
    });
    // currentUserId lấy từ local (mỗi máy một người), không lấy từ shared
    const savedUser = localStorage.getItem('roomie_current_user');
    if (savedUser && data.members.find(m => m.id === savedUser)) {
      data.currentUserId = savedUser;
    } else if (!data.members.find(m => m.id === data.currentUserId)) {
      data.currentUserId = data.members[0]?.id || 'm1';
    }
    return data;
  }

  function loadState(callback) {
    if (useFirebase && dbRef) {
      // Realtime listener – mọi thay đổi từ người khác sẽ cập nhật ngay
      dbRef.on('value', (snapshot) => {
        if (isSaving) return; // bỏ qua sự kiện do chính mình ghi
        const val = snapshot.val();
        if (val) {
          state = normalizeState(val);
        } else {
          // Lần đầu: chưa có dữ liệu → ghi demo
          state = getDefaultData();
          saveState();
        }
        if (callback) callback();
        else if (document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) {
          renderAll();
        }
      }, (err) => {
        console.error('[ROOMIE] Lỗi đọc Firebase:', err);
        showToast('Lỗi kết nối dữ liệu. Kiểm tra Rules Firebase.');
        // fallback
        useFirebase = false;
        loadStateLocal();
        if (callback) callback();
      });
    } else {
      loadStateLocal();
      if (callback) callback();
    }
  }

  function loadStateLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = normalizeState(JSON.parse(raw));
        return;
      }
    } catch (e) {
      console.warn('Load local failed', e);
    }
    state = getDefaultData();
    saveStateLocal();
  }

  function saveState() {
    // Luôn nhớ user hiện tại trên máy local
    localStorage.setItem('roomie_current_user', state.currentUserId);

    if (useFirebase && dbRef) {
      isSaving = true;
      // Không đẩy currentUserId lên shared DB (mỗi người chọn user riêng)
      const toSave = {
        household: state.household,
        members: state.members,
        expenses: state.expenses,
        settlements: state.settlements
        // currentUserId cố ý bỏ qua
      };

      dbRef.set(toSave)
        .then(() => {
          isSaving = false;
        })
        .catch(err => {
          isSaving = false;
          console.error('[ROOMIE] Lỗi ghi Firebase:', err);
          showToast('Không lưu được lên cloud. Kiểm tra Rules Firebase.');
          saveStateLocal();
        });
    } else {
      saveStateLocal();
    }
  }

  function saveStateLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetDemo() {
    if (!confirm('Xóa toàn bộ khoản chi & thanh toán?\n\nTất cả số tiền sẽ về 0đ. Thành viên trong phòng vẫn được giữ.\n\n(Nếu đang dùng Firebase, dữ liệu chung của mọi người cũng sẽ bị xóa.)')) return;
    const savedUser = localStorage.getItem('roomie_current_user');
    state = getDefaultData();
    if (savedUser && state.members.find(m => m.id === savedUser)) {
      state.currentUserId = savedUser;
    }
    // Xóa cache cũ mọi phiên bản
    try {
      localStorage.removeItem('roomie_data_v1');
      localStorage.removeItem('roomie_data_v2');
    } catch (_) {}
    saveState();
    renderAll();
    showToast('Đã xóa hết khoản chi – về 0đ');
  }

  // ========== HELPERS ==========
  function formatMoney(n) {
    if (n == null || isNaN(n)) return '0đ';
    const abs = Math.abs(Math.round(n));
    return abs.toLocaleString('vi-VN') + 'đ';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function getMember(id) {
    return state.members.find(m => m.id === id) || { name: '?', avatar: '?' };
  }

  function getMemberColor(id) {
    const idx = state.members.findIndex(m => m.id === id);
    return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
  }

  function getCurrentUser() {
    return getMember(state.currentUserId);
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  // ========== CORE FINANCIAL LOGIC ==========
  /**
   * Compute equal or custom shares.
   * Ensures sum of shares === amount (handles rounding).
   */
  function computeShares(expense) {
    const { amount, participants, splitType, customShares } = expense;
    const shares = {};
    if (!participants || participants.length === 0) return shares;

    if (splitType === 'custom' && customShares) {
      let total = 0;
      participants.forEach(id => {
        shares[id] = Math.round(Number(customShares[id]) || 0);
        total += shares[id];
      });
      // Adjust last participant for rounding difference
      const diff = amount - total;
      if (diff !== 0 && participants.length > 0) {
        const last = participants[participants.length - 1];
        shares[last] += diff;
      }
      return shares;
    }

    // Equal split
    const n = participants.length;
    const base = Math.floor(amount / n);
    let remainder = amount - base * n;
    participants.forEach((id, i) => {
      shares[id] = base + (i < remainder ? 1 : 0);
    });
    return shares;
  }

  /**
   * Net balance for each member:
   * balance = totalPaid - totalShare
   * Positive => others owe them
   * Negative => they owe others
   */
  function computeBalances() {
    const balances = {};
    state.members.forEach(m => {
      balances[m.id] = 0;
    });

    // From expenses
    state.expenses.forEach(exp => {
      // Payer paid the full amount
      balances[exp.payerId] = (balances[exp.payerId] || 0) + exp.amount;
      // Each participant owes their share
      Object.entries(exp.shares || {}).forEach(([id, share]) => {
        balances[id] = (balances[id] || 0) - share;
      });
    });

    // From settlements: from pays to "to"
    // from: balance increases (they paid debt)
    // to: balance decreases (they received money)
    state.settlements.forEach(s => {
      balances[s.fromId] = (balances[s.fromId] || 0) + s.amount;
      balances[s.toId] = (balances[s.toId] || 0) - s.amount;
    });

    return balances;
  }

  /**
   * Simple settlement suggestions: greedy matching of debtors to creditors.
   * Returns array of { fromId, toId, amount }
   */
  function computeSettlementSuggestions() {
    const balances = computeBalances();
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([id, bal]) => {
      if (bal < -1) debtors.push({ id, amount: -bal }); // owes this much
      else if (bal > 1) creditors.push({ id, amount: bal }); // is owed this much
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const suggestions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const pay = Math.min(d.amount, c.amount);
      if (pay > 0) {
        suggestions.push({
          fromId: d.id,
          toId: c.id,
          amount: Math.round(pay)
        });
      }
      d.amount -= pay;
      c.amount -= pay;
      if (d.amount < 1) i++;
      if (c.amount < 1) j++;
    }
    return suggestions;
  }

  // Stats for current user
  function getUserStats() {
    const balances = computeBalances();
    const me = state.currentUserId;
    const myBalance = balances[me] || 0;

    let totalExpense = 0;
    let youPaid = 0;
    const catTotals = {};

    state.expenses.forEach(e => {
      totalExpense += e.amount;
      if (e.payerId === me) youPaid += e.amount;
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    // youOwe = how much you still need to pay (if balance negative)
    // owedToYou = how much others still need to pay you (if balance positive)
    const youOwe = myBalance < 0 ? -myBalance : 0;
    const owedToYou = myBalance > 0 ? myBalance : 0;

    return {
      totalExpense,
      youPaid,
      youOwe,
      owedToYou,
      myBalance,
      catTotals,
      balances
    };
  }

  /**
   * Chi tiết 4 ô thống kê trên Dashboard
   * type: 'total' | 'paid' | 'owe' | 'owed'
   */
  function openStatDetail(type) {
    const me = state.currentUserId;
    const meName = getCurrentUser().name;
    const titleEl = document.getElementById('modal-stat-title');
    const contentEl = document.getElementById('stat-detail-content');
    let title = '';
    let html = '';

    if (type === 'total') {
      title = 'Tổng chi tiêu tháng này';
      const expenses = [...state.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      html += `<div class="stat-detail-summary">Tổng cộng <strong>${formatMoney(total)}</strong> · ${expenses.length} khoản chi</div>`;
      if (expenses.length === 0) {
        html += '<div class="stat-empty">Chưa có khoản chi nào</div>';
      } else {
        html += '<div class="stat-detail-list">';
        expenses.forEach(e => {
          const payer = getMember(e.payerId);
          const cat = CATEGORIES[e.category] || {};
          const partCount = (e.participants || []).length;
          html += `
            <div class="stat-detail-item">
              <div class="stat-detail-icon ${cat.class || ''}">${cat.icon || '?'}</div>
              <div class="stat-detail-info">
                <div class="stat-detail-name">${e.name}</div>
                <div class="stat-detail-meta">
                  ${formatDate(e.date)} · ${cat.name || e.category}<br>
                  ${payer.name} thanh toán · ${partCount} người chia
                  ${e.note ? '<br>' + e.note : ''}
                </div>
              </div>
              <div class="stat-detail-amount">${formatMoney(e.amount)}</div>
            </div>`;
        });
        html += '</div>';
      }
    }

    else if (type === 'paid') {
      title = `Bạn đã thanh toán (${meName})`;
      // Các khoản chi do mình trả
      const paidExpenses = state.expenses
        .filter(e => e.payerId === me)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      // Các lần mình chuyển tiền cho người khác (settlement from = me)
      const paidSettlements = state.settlements
        .filter(s => s.fromId === me)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const totalExp = paidExpenses.reduce((s, e) => s + e.amount, 0);
      const totalSet = paidSettlements.reduce((s, e) => s + e.amount, 0);

      html += `<div class="stat-detail-summary">
        Tổng bạn đã chi: <strong>${formatMoney(totalExp + totalSet)}</strong><br>
        <span style="font-size:12px;color:var(--text-secondary)">
          Trong đó: trả hộ khoản chi ${formatMoney(totalExp)} · chuyển trả nợ ${formatMoney(totalSet)}
        </span>
      </div>`;

      if (paidExpenses.length === 0 && paidSettlements.length === 0) {
        html += '<div class="stat-empty">Bạn chưa thanh toán khoản nào</div>';
      } else {
        html += '<div class="stat-detail-list">';
        paidExpenses.forEach(e => {
          const cat = CATEGORIES[e.category] || {};
          const myShare = (e.shares && e.shares[me]) || 0;
          html += `
            <div class="stat-detail-item">
              <div class="stat-detail-icon ${cat.class || ''}">${cat.icon || '?'}</div>
              <div class="stat-detail-info">
                <div class="stat-detail-name">${e.name}</div>
                <div class="stat-detail-meta">
                  ${formatDate(e.date)} · Bạn trả hộ toàn bộ<br>
                  Phần bạn chịu: ${formatMoney(myShare)} · Còn lại người khác nợ bạn
                </div>
              </div>
              <div class="stat-detail-amount">${formatMoney(e.amount)}</div>
            </div>`;
        });
        paidSettlements.forEach(s => {
          const to = getMember(s.toId);
          html += `
            <div class="stat-detail-item">
              <div class="stat-detail-icon settlement">↔</div>
              <div class="stat-detail-info">
                <div class="stat-detail-name">Trả nợ cho ${to.name}</div>
                <div class="stat-detail-meta">
                  ${formatDate(s.date)}${s.note ? ' · ' + s.note : ''}
                </div>
              </div>
              <div class="stat-detail-amount">${formatMoney(s.amount)}</div>
            </div>`;
        });
        html += '</div>';
      }
    }

    else if (type === 'owe') {
      title = `Bạn cần thanh toán (${meName})`;
      const balances = computeBalances();
      const myBal = balances[me] || 0;

      if (myBal >= 0) {
        html += `<div class="stat-detail-summary">Bạn không còn nợ ai. Số dư: <strong>${formatMoney(myBal)}</strong></div>`;
        html += '<div class="stat-empty">Không có khoản nào cần thanh toán</div>';
      } else {
        // Các khoản chi mà mình tham gia nhưng không phải người trả → mình đang nợ phần share
        const owingItems = [];
        state.expenses.forEach(e => {
          if (e.payerId === me) return; // mình đã trả rồi
          if (!e.participants || !e.participants.includes(me)) return;
          const share = (e.shares && e.shares[me]) || 0;
          if (share > 0) {
            owingItems.push({
              type: 'expense',
              name: e.name,
              date: e.date,
              amount: share,
              payerId: e.payerId,
              category: e.category,
              note: e.note
            });
          }
        });

        // Trừ đi những gì mình đã settle
        // Hiển thị gợi ý thanh toán hiện tại
        const suggestions = computeSettlementSuggestions().filter(s => s.fromId === me);

        html += `<div class="stat-detail-summary">
          Tổng bạn còn phải trả: <strong>${formatMoney(-myBal)}</strong>
        </div>`;

        if (owingItems.length > 0) {
          html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Các khoản chi bạn đang tham gia (phần bạn chịu):</p>';
          html += '<div class="stat-detail-list">';
          owingItems.sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(item => {
            const payer = getMember(item.payerId);
            const cat = CATEGORIES[item.category] || {};
            html += `
              <div class="stat-detail-item">
                <div class="stat-detail-icon ${cat.class || ''}">${cat.icon || '?'}</div>
                <div class="stat-detail-info">
                  <div class="stat-detail-name">${item.name}</div>
                  <div class="stat-detail-meta">
                    Ngày phát sinh: ${formatDate(item.date)} · ${cat.name || ''}<br>
                    ${payer.name} đã trả hộ · Bạn cần hoàn phần của mình
                    ${item.note ? '<br>' + item.note : ''}
                  </div>
                </div>
                <div class="stat-detail-amount">${formatMoney(item.amount)}</div>
              </div>`;
          });
          html += '</div>';
        }

        if (suggestions.length > 0) {
          html += '<p style="font-size:13px;color:var(--text-secondary);margin:16px 0 10px">Gợi ý thanh toán hiện tại:</p>';
          html += '<div class="stat-detail-list">';
          suggestions.forEach(s => {
            const to = getMember(s.toId);
            html += `
              <div class="stat-detail-item">
                <div class="stat-detail-icon settlement">↔</div>
                <div class="stat-detail-info">
                  <div class="stat-detail-name">Trả cho ${to.name}</div>
                  <div class="stat-detail-meta">Số tiền còn nợ sau khi đối soát</div>
                </div>
                <div class="stat-detail-amount">${formatMoney(s.amount)}</div>
              </div>`;
          });
          html += '</div>';
        }
      }
    }

    else if (type === 'owed') {
      title = `Người khác nợ bạn (${meName})`;
      const balances = computeBalances();
      const myBal = balances[me] || 0;

      if (myBal <= 0) {
        html += `<div class="stat-detail-summary">Hiện không có ai nợ bạn.</div>`;
        html += '<div class="stat-empty">Không có khoản phải thu</div>';
      } else {
        // Các khoản mình đã trả hộ
        const myPaid = state.expenses
          .filter(e => e.payerId === me)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const suggestions = computeSettlementSuggestions().filter(s => s.toId === me);

        html += `<div class="stat-detail-summary">
          Tổng người khác đang nợ bạn: <strong>${formatMoney(myBal)}</strong>
        </div>`;

        if (myPaid.length > 0) {
          html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Các khoản bạn đã trả hộ:</p>';
          html += '<div class="stat-detail-list">';
          myPaid.forEach(e => {
            const cat = CATEGORIES[e.category] || {};
            const myShare = (e.shares && e.shares[me]) || 0;
            const othersOwe = e.amount - myShare;
            const others = (e.participants || [])
              .filter(id => id !== me)
              .map(id => getMember(id).name)
              .join(', ');
            html += `
              <div class="stat-detail-item">
                <div class="stat-detail-icon ${cat.class || ''}">${cat.icon || '?'}</div>
                <div class="stat-detail-info">
                  <div class="stat-detail-name">${e.name}</div>
                  <div class="stat-detail-meta">
                    ${formatDate(e.date)} · Bạn trả ${formatMoney(e.amount)}<br>
                    Phần bạn chịu ${formatMoney(myShare)} · Người khác nợ ${formatMoney(othersOwe)}
                    ${others ? '<br>Người tham gia: ' + others : ''}
                  </div>
                </div>
                <div class="stat-detail-amount">+${formatMoney(othersOwe)}</div>
              </div>`;
          });
          html += '</div>';
        }

        if (suggestions.length > 0) {
          html += '<p style="font-size:13px;color:var(--text-secondary);margin:16px 0 10px">Ai cần trả bạn:</p>';
          html += '<div class="stat-detail-list">';
          suggestions.forEach(s => {
            const from = getMember(s.fromId);
            html += `
              <div class="stat-detail-item">
                <div class="stat-detail-icon settlement">↔</div>
                <div class="stat-detail-info">
                  <div class="stat-detail-name">${from.name} cần trả bạn</div>
                  <div class="stat-detail-meta">Sau khi đối soát toàn bộ khoản chi & thanh toán</div>
                </div>
                <div class="stat-detail-amount">${formatMoney(s.amount)}</div>
              </div>`;
          });
          html += '</div>';
        }
      }
    }

    titleEl.textContent = title;
    contentEl.innerHTML = html;
    document.getElementById('modal-stat').classList.remove('hidden');
  }

  // ========== RENDER FUNCTIONS ==========
  function renderReminder(stats) {
    const banner = document.getElementById('reminder-banner');
    if (!banner) return;

    const suggestions = computeSettlementSuggestions();
    const me = state.currentUserId;
    const iOwe = suggestions.filter(s => s.fromId === me);
    const oweMe = suggestions.filter(s => s.toId === me);

    if (iOwe.length === 0 && oweMe.length === 0) {
      banner.classList.add('hidden');
      return;
    }

    banner.classList.remove('hidden');
    const titleEl = document.getElementById('reminder-title');
    const textEl = document.getElementById('reminder-text');

    const parts = [];
    if (iOwe.length > 0) {
      const total = iOwe.reduce((s, x) => s + x.amount, 0);
      const names = iOwe.map(s => getMember(s.toId).name).join(', ');
      parts.push(`Bạn cần trả ${formatMoney(total)} cho ${names}`);
      titleEl.textContent = 'Nhắc nhở: Bạn còn khoản cần thanh toán';
    }
    if (oweMe.length > 0) {
      const total = oweMe.reduce((s, x) => s + x.amount, 0);
      const names = oweMe.map(s => getMember(s.fromId).name).join(', ');
      parts.push(`${names} đang nợ bạn ${formatMoney(total)}`);
      if (iOwe.length === 0) titleEl.textContent = 'Nhắc nhở: Có người đang nợ bạn';
    }
    textEl.textContent = parts.join(' · ');
  }

  function renderAll() {
    renderDashboard();
    renderHousehold();
    renderExpenses();
    renderDebts();
    renderHistory();
    updateUserHeader();
  }

  function updateUserHeader() {
    const user = getCurrentUser();
    document.getElementById('current-user-name').textContent = user.name;
    const avatarEl = document.getElementById('current-avatar');
    avatarEl.textContent = user.avatar;
    avatarEl.className = 'avatar ' + getMemberColor(user.id);
    document.getElementById('greeting').textContent = `Xin chào, ${user.name}`;

    // Populate user switcher
    const switcher = document.getElementById('user-switcher');
    if (switcher) {
      switcher.innerHTML = state.members.map(m =>
        `<option value="${m.id}" ${m.id === state.currentUserId ? 'selected' : ''}>${m.name}</option>`
      ).join('');
    }
  }

  function renderDashboard() {
    const stats = getUserStats();
    document.getElementById('stat-total-expense').textContent = formatMoney(stats.totalExpense);
    document.getElementById('stat-you-paid').textContent = formatMoney(stats.youPaid);
    document.getElementById('stat-you-owe').textContent = formatMoney(stats.youOwe);
    document.getElementById('stat-owed-to-you').textContent = formatMoney(stats.owedToYou);

    // Nhắc nhở thanh toán tự động
    renderReminder(stats);

    // Category chart
    const chartEl = document.getElementById('category-chart');
    const maxCat = Math.max(...Object.values(stats.catTotals), 1);
    const cats = Object.entries(stats.catTotals).sort((a, b) => b[1] - a[1]);
    if (cats.length === 0) {
      chartEl.innerHTML = '<div class="empty-state"><p>Chưa có khoản chi</p></div>';
    } else {
      chartEl.innerHTML = cats.map(([key, val]) => {
        const pct = (val / maxCat) * 100;
        const cat = CATEGORIES[key] || { name: key };
        return `
          <div class="cat-bar-item">
            <div class="cat-bar-header">
              <span class="cat-bar-name">${cat.name}</span>
              <span class="cat-bar-amount">${formatMoney(val)}</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
      }).join('');
    }

    // Debt summary (top 4)
    const debtEl = document.getElementById('debt-summary');
    const balEntries = Object.entries(stats.balances)
      .map(([id, bal]) => ({ id, bal, member: getMember(id) }))
      .sort((a, b) => b.bal - a.bal);

    debtEl.innerHTML = balEntries.map(({ id, bal, member }) => {
      const isMe = id === state.currentUserId;
      let label = '';
      if (bal > 1) label = `+${formatMoney(bal)}`;
      else if (bal < -1) label = `-${formatMoney(-bal)}`;
      else label = 'Cân bằng';
      return `
        <div class="debt-item">
          <div class="debt-member">
            <div class="debt-avatar ${getMemberColor(id)}">${member.avatar}</div>
            <span>${member.name}${isMe ? ' (bạn)' : ''}</span>
          </div>
          <span class="debt-amount ${bal > 1 ? 'pos' : bal < -1 ? 'neg' : 'zero'}">${label}</span>
        </div>`;
    }).join('');

    // Recent transactions (last 5 expenses + settlements)
    const recent = [
      ...state.expenses.map(e => ({ ...e, type: 'expense' })),
      ...state.settlements.map(s => ({ ...s, type: 'settlement', name: `Thanh toán`, amount: s.amount }))
    ]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);

    const recentEl = document.getElementById('recent-transactions');
    if (recent.length === 0) {
      recentEl.innerHTML = '<div class="empty-state"><p>Chưa có giao dịch</p></div>';
    } else {
      recentEl.innerHTML = recent.map(item => {
        if (item.type === 'expense') {
          const payer = getMember(item.payerId);
          const cat = CATEGORIES[item.category] || {};
          return `
            <div class="tx-item clickable" data-view-expense="${item.id}">
              <div class="tx-icon ${cat.class || ''}">${cat.icon || '?'}</div>
              <div class="tx-info">
                <div class="tx-name">${item.name}</div>
                <div class="tx-meta">${payer.name} thanh toán · ${formatDate(item.date)}</div>
              </div>
              <div class="tx-amount">${formatMoney(item.amount)}</div>
            </div>`;
        } else {
          const from = getMember(item.fromId);
          const to = getMember(item.toId);
          return `
            <div class="tx-item">
              <div class="tx-icon settlement">↔</div>
              <div class="tx-info">
                <div class="tx-name">${from.name} → ${to.name}</div>
                <div class="tx-meta">Thanh toán · ${formatDate(item.date)}</div>
              </div>
              <div class="tx-amount">${formatMoney(item.amount)}</div>
            </div>`;
        }
      }).join('');
    }
  }

  function renderHousehold() {
    document.getElementById('household-name').textContent = state.household.name;
    document.getElementById('household-location').textContent = state.household.location;
    document.getElementById('member-count').textContent = `${state.members.length} thành viên`;
    document.getElementById('invite-code').textContent = state.household.inviteCode;
    document.getElementById('invite-link').textContent = `https://roomie.app/join/${state.household.inviteCode}`;

    const list = document.getElementById('members-list');
    list.innerHTML = state.members.map(m => {
      const isMe = m.id === state.currentUserId;
      return `
        <div class="member-card">
          <div class="member-avatar ${getMemberColor(m.id)}">${m.avatar}</div>
          <div class="member-info">
            <div class="member-name">${m.name}${isMe ? ' (bạn)' : ''}</div>
            <div class="member-role">${isMe ? 'Bạn đang xem' : 'Thành viên'}</div>
          </div>
          <div class="member-actions">
            <button class="btn-icon" title="Đổi tên" data-edit-member="${m.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" title="Xóa thành viên" data-delete-member="${m.id}" ${state.members.length <= 1 ? 'disabled' : ''}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function renderExpenses() {
    const list = document.getElementById('expenses-list');
    const sorted = [...state.expenses].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (sorted.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>Chưa có khoản chi nào. Hãy thêm khoản chi đầu tiên!</p></div>';
      return;
    }

    list.innerHTML = sorted.map(e => {
      const payer = getMember(e.payerId);
      const cat = CATEGORIES[e.category] || {};
      return `
        <div class="tx-item clickable" data-view-expense="${e.id}">
          <div class="tx-icon ${cat.class || ''}">${cat.icon || '?'}</div>
          <div class="tx-info">
            <div class="tx-name">${e.name}</div>
            <div class="tx-meta">${payer.name} · ${cat.name} · ${formatDate(e.date)} · ${e.participants.length} người chia</div>
          </div>
          <div class="tx-amount">${formatMoney(e.amount)}</div>
          <div class="tx-actions">
            <button class="btn-icon" title="Sửa" data-edit-expense="${e.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-danger" title="Xóa khoản chi" data-delete-expense="${e.id}">Xóa</button>
          </div>
        </div>`;
    }).join('');
  }

  function renderDebts() {
    const stats = getUserStats();
    const bal = stats.myBalance;
    document.getElementById('debt-your-balance').textContent =
      bal > 1 ? `+${formatMoney(bal)}` : bal < -1 ? `-${formatMoney(-bal)}` : '0đ';
    document.getElementById('debt-your-balance').className =
      'stat-value ' + (bal > 1 ? 'positive' : bal < -1 ? 'negative' : '');

    document.getElementById('debt-you-owe-total').textContent = formatMoney(stats.youOwe);
    document.getElementById('debt-owed-total').textContent = formatMoney(stats.owedToYou);

    // Balances list
    const balList = document.getElementById('balances-list');
    const entries = Object.entries(stats.balances)
      .map(([id, b]) => ({ id, b, m: getMember(id) }))
      .sort((a, b) => b.b - a.b);

    balList.innerHTML = entries.map(({ id, b, m }) => {
      const isMe = id === state.currentUserId;
      let text = b > 1 ? `Được nhận ${formatMoney(b)}` :
                 b < -1 ? `Cần trả ${formatMoney(-b)}` : 'Đã cân bằng';
      const cls = b > 1 ? 'pos' : b < -1 ? 'neg' : 'zero';
      return `
        <div class="balance-row ${isMe ? 'current' : ''}">
          <div class="debt-member">
            <div class="debt-avatar ${getMemberColor(id)}">${m.avatar}</div>
            <span>${m.name}${isMe ? ' (bạn)' : ''}</span>
          </div>
          <span class="debt-amount ${cls}">${text}</span>
        </div>`;
    }).join('');

    // Settlement suggestions
    const suggestions = computeSettlementSuggestions();
    const sugEl = document.getElementById('settlement-suggestions');
    if (suggestions.length === 0) {
      sugEl.innerHTML = '<div class="empty-state"><p>Tất cả đã cân bằng. Không có khoản nợ nào.</p></div>';
    } else {
      sugEl.innerHTML = suggestions.map(s => {
        const from = getMember(s.fromId);
        const to = getMember(s.toId);
        return `
          <div class="settlement-item">
            <div class="settlement-text">
              <strong>${from.name}</strong> cần trả <strong>${to.name}</strong>
              <div class="settlement-amount-badge">${formatMoney(s.amount)}</div>
            </div>
            <button class="btn btn-sm btn-primary" data-settle-from="${s.fromId}" data-settle-to="${s.toId}" data-settle-amount="${s.amount}">
              Ghi nhận
            </button>
          </div>`;
      }).join('');
    }
  }

  function renderHistory() {
    const search = (document.getElementById('search-history')?.value || '').toLowerCase();
    const catFilter = document.getElementById('filter-category')?.value || 'all';
    const timeFilter = document.getElementById('filter-time')?.value || 'all';

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);

    let items = [
      ...state.expenses.map(e => ({ ...e, type: 'expense' })),
      ...state.settlements.map(s => ({
        ...s,
        type: 'settlement',
        name: `Thanh toán: ${getMember(s.fromId).name} → ${getMember(s.toId).name}`,
        category: 'settlement'
      }))
    ];

    items = items.filter(item => {
      if (search && !item.name.toLowerCase().includes(search)) return false;
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (timeFilter === 'this-month' && !item.date?.startsWith(thisMonth)) return false;
      if (timeFilter === 'last-month' && !item.date?.startsWith(lastMonth)) return false;
      return true;
    });

    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const list = document.getElementById('history-list');
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>Không tìm thấy giao dịch nào</p></div>';
      return;
    }

    list.innerHTML = items.map(item => {
      if (item.type === 'expense') {
        const payer = getMember(item.payerId);
        const cat = CATEGORIES[item.category] || {};
        return `
          <div class="tx-item clickable" data-view-expense="${item.id}">
            <div class="tx-icon ${cat.class || ''}">${cat.icon || '?'}</div>
            <div class="tx-info">
              <div class="tx-name">${item.name}</div>
              <div class="tx-meta">${payer.name} thanh toán · ${cat.name} · ${formatDate(item.date)}</div>
            </div>
            <div class="tx-amount">${formatMoney(item.amount)}</div>
          </div>`;
      } else {
        return `
          <div class="tx-item">
            <div class="tx-icon settlement">↔</div>
            <div class="tx-info">
              <div class="tx-name">${item.name}</div>
              <div class="tx-meta">${formatDate(item.date)}${item.note ? ' · ' + item.note : ''}</div>
            </div>
            <div class="tx-amount">${formatMoney(item.amount)}</div>
          </div>`;
      }
    }).join('');
  }

  // ========== MODALS ==========
  let editingExpenseId = null;
  let editingMemberId = null;

  function openExpenseModal(expenseId = null) {
    editingExpenseId = expenseId;
    const modal = document.getElementById('modal-expense');
    const title = document.getElementById('modal-expense-title');
    const form = document.getElementById('form-expense');

    // Populate payer select
    const payerSelect = document.getElementById('expense-payer');
    payerSelect.innerHTML = state.members.map(m =>
      `<option value="${m.id}">${m.name}</option>`
    ).join('');

    // Participants
    const partEl = document.getElementById('expense-participants');
    partEl.innerHTML = state.members.map(m => `
      <label class="participant-chip selected" data-id="${m.id}">
        <input type="checkbox" value="${m.id}" checked>
        ${m.name}
      </label>
    `).join('');

    // Chip toggle
    partEl.querySelectorAll('.participant-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const cb = chip.querySelector('input');
        cb.checked = !cb.checked;
        chip.classList.toggle('selected', cb.checked);
        updateCustomSplitUI();
      });
    });

    // Reset form
    form.reset();
    document.querySelector('input[name="split-type"][value="equal"]').checked = true;
    document.getElementById('custom-split-area').classList.add('hidden');
    document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);

    if (expenseId) {
      title.textContent = 'Chỉnh sửa khoản chi';
      const exp = state.expenses.find(e => e.id === expenseId);
      if (exp) {
        document.getElementById('expense-name').value = exp.name;
        document.getElementById('expense-amount').value = exp.amount;
        document.getElementById('expense-date').value = exp.date;
        document.getElementById('expense-category').value = exp.category;
        document.getElementById('expense-payer').value = exp.payerId;
        document.getElementById('expense-note').value = exp.note || '';
        document.querySelector(`input[name="split-type"][value="${exp.splitType}"]`).checked = true;

        // Set participants
        partEl.querySelectorAll('.participant-chip').forEach(chip => {
          const id = chip.dataset.id;
          const checked = exp.participants.includes(id);
          chip.querySelector('input').checked = checked;
          chip.classList.toggle('selected', checked);
        });

        if (exp.splitType === 'custom') {
          document.getElementById('custom-split-area').classList.remove('hidden');
          updateCustomSplitUI(exp.shares);
        }
      }
    } else {
      title.textContent = 'Thêm khoản chi mới';
    }

    modal.classList.remove('hidden');
  }

  function updateCustomSplitUI(existingShares = null) {
    const area = document.getElementById('custom-split-area');
    const isCustom = document.querySelector('input[name="split-type"]:checked').value === 'custom';
    if (!isCustom) {
      area.classList.add('hidden');
      return;
    }
    area.classList.remove('hidden');

    const selected = Array.from(document.querySelectorAll('#expense-participants input:checked'))
      .map(cb => cb.value);
    const amount = Number(document.getElementById('expense-amount').value) || 0;
    const equalShare = selected.length ? Math.round(amount / selected.length) : 0;

    area.innerHTML = selected.map(id => {
      const m = getMember(id);
      const val = existingShares ? (existingShares[id] || 0) : equalShare;
      return `
        <div class="custom-row">
          <span>${m.name}</span>
          <input type="number" data-member="${id}" value="${val}" min="0" step="1">
        </div>`;
    }).join('') + `<p style="font-size:12px;color:var(--text-secondary);margin-top:6px">Tổng phải bằng ${formatMoney(amount)}</p>`;
  }

  function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    editingExpenseId = null;
    editingMemberId = null;
  }

  function openSettleModal(fromId, toId, suggestedAmount) {
    document.getElementById('settle-from').value = fromId;
    document.getElementById('settle-to').value = toId;
    document.getElementById('settle-amount').value = suggestedAmount || '';
    document.getElementById('settle-amount').max = suggestedAmount || 999999999;
    document.getElementById('settle-note').value = '';
    const from = getMember(fromId);
    const to = getMember(toId);
    document.getElementById('settle-info').innerHTML =
      `<strong>${from.name}</strong> thanh toán cho <strong>${to.name}</strong><br>
       Số tiền còn nợ: <strong>${formatMoney(suggestedAmount)}</strong>
       <div class="settle-quick" style="margin-top:10px">
         <button type="button" class="btn btn-secondary btn-sm" id="btn-settle-full">Thanh toán toàn bộ</button>
         <button type="button" class="btn btn-secondary btn-sm" id="btn-settle-half">Một nửa</button>
       </div>`;
    document.getElementById('modal-settle').classList.remove('hidden');

    // Quick buttons
    document.getElementById('btn-settle-full')?.addEventListener('click', () => {
      document.getElementById('settle-amount').value = Math.round(suggestedAmount);
    });
    document.getElementById('btn-settle-half')?.addEventListener('click', () => {
      document.getElementById('settle-amount').value = Math.round(suggestedAmount / 2);
    });
  }

  function openExpenseDetail(expenseId) {
    const exp = state.expenses.find(e => e.id === expenseId);
    if (!exp) return;
    const payer = getMember(exp.payerId);
    const cat = CATEGORIES[exp.category] || {};
    const content = document.getElementById('detail-content');

    let sharesHtml = Object.entries(exp.shares || {}).map(([id, share]) => {
      const m = getMember(id);
      const isPayer = id === exp.payerId;
      return `
        <div class="share-row ${isPayer ? 'payer' : ''}">
          <span>${m.name}${isPayer ? ' (người trả)' : ''}</span>
          <span>${formatMoney(share)}</span>
        </div>`;
    }).join('');

    content.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Tên khoản chi</span>
        <span class="detail-value">${exp.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Số tiền</span>
        <span class="detail-value">${formatMoney(exp.amount)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Danh mục</span>
        <span class="detail-value">${cat.name || exp.category}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Người thanh toán</span>
        <span class="detail-value">${payer.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Ngày</span>
        <span class="detail-value">${formatDate(exp.date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Cách chia</span>
        <span class="detail-value">${exp.splitType === 'equal' ? 'Chia đều' : 'Tùy chỉnh'}</span>
      </div>
      ${exp.note ? `<div class="detail-row"><span class="detail-label">Ghi chú</span><span class="detail-value">${exp.note}</span></div>` : ''}
      <div class="detail-shares">
        <h4>Phần chia của từng người</h4>
        ${sharesHtml}
      </div>
      <div class="modal-footer" style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
        <button type="button" class="btn btn-secondary" data-edit-from-detail="${exp.id}">Sửa</button>
        <button type="button" class="btn btn-danger" data-delete-from-detail="${exp.id}">Xóa khoản chi</button>
      </div>
    `;
    document.getElementById('modal-detail').classList.remove('hidden');
  }

  function deleteExpenseById(expenseId) {
    const exp = state.expenses.find(e => e.id === expenseId);
    if (!exp) return;
    if (!confirm(`Xóa khoản chi "${exp.name}" (${formatMoney(exp.amount)})?\n\nCông nợ sẽ được tính lại.`)) return;
    state.expenses = state.expenses.filter(x => x.id !== expenseId);
    saveState();
    closeModals();
    renderAll();
    showToast('Đã xóa khoản chi');
  }

  // ========== MEMBER MANAGEMENT ==========
  function openMemberModal(memberId = null) {
    editingMemberId = memberId;
    const modal = document.getElementById('modal-member');
    const title = document.getElementById('modal-member-title');
    const input = document.getElementById('member-name');
    const form = document.getElementById('form-member');

    form.reset();
    if (memberId) {
      const m = getMember(memberId);
      title.textContent = 'Đổi tên thành viên';
      input.value = m.name || '';
    } else {
      title.textContent = 'Thêm thành viên';
      input.value = '';
    }
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
  }

  function getAvatarFromName(name) {
    const cleaned = (name || '').trim();
    if (!cleaned) return '?';
    // Lấy chữ cái đầu của từ cuối (thường là tên)
    const parts = cleaned.split(/\s+/);
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase();
  }

  function addMember(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên thành viên');
      return false;
    }
    // Không trùng tên (không phân biệt hoa thường)
    if (state.members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Tên thành viên đã tồn tại');
      return false;
    }
    const id = 'm' + Date.now();
    state.members.push({
      id,
      name: trimmed,
      avatar: getAvatarFromName(trimmed)
    });
    saveState();
    renderAll();
    showToast(`Đã thêm ${trimmed}`);
    return true;
  }

  function renameMember(memberId, newName) {
    const trimmed = newName.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên');
      return false;
    }
    if (state.members.some(m => m.id !== memberId && m.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Tên thành viên đã tồn tại');
      return false;
    }
    const m = state.members.find(x => x.id === memberId);
    if (!m) return false;
    m.name = trimmed;
    m.avatar = getAvatarFromName(trimmed);
    saveState();
    renderAll();
    showToast('Đã đổi tên thành viên');
    return true;
  }

  function deleteMember(memberId) {
    if (state.members.length <= 1) {
      showToast('Phòng phải còn ít nhất 1 thành viên');
      return;
    }
    const m = getMember(memberId);

    // Kiểm tra xem thành viên có đang nằm trong khoản chi / thanh toán không
    const inExpenses = state.expenses.some(e =>
      e.payerId === memberId || (e.participants && e.participants.includes(memberId))
    );
    const inSettlements = state.settlements.some(s =>
      s.fromId === memberId || s.toId === memberId
    );

    let msg = `Xóa thành viên "${m.name}"?`;
    if (inExpenses || inSettlements) {
      msg += '\n\nLưu ý: Thành viên này đang có trong một số khoản chi / thanh toán. Các giao dịch cũ vẫn giữ nguyên lịch sử, nhưng người này sẽ không còn xuất hiện trong danh sách chia tiền mới.';
    }

    if (!confirm(msg)) return;

    // Xóa khỏi danh sách thành viên
    state.members = state.members.filter(x => x.id !== memberId);

    // Nếu đang xem với tư cách người này → chuyển sang người khác
    if (state.currentUserId === memberId) {
      state.currentUserId = state.members[0].id;
      localStorage.setItem('roomie_current_user', state.currentUserId);
    }

    // Loại khỏi participants của các expense (không xóa expense)
    state.expenses.forEach(e => {
      if (e.participants) {
        e.participants = e.participants.filter(id => id !== memberId);
      }
      if (e.shares && e.shares[memberId] !== undefined) {
        delete e.shares[memberId];
      }
      // Nếu payer bị xóa → gán payer sang người đầu tiên còn lại (nếu còn participant)
      if (e.payerId === memberId) {
        e.payerId = (e.participants && e.participants[0]) || state.members[0].id;
      }
      // Nếu không còn ai tham gia → xóa expense
      if (!e.participants || e.participants.length === 0) {
        // sẽ filter sau
      }
    });
    state.expenses = state.expenses.filter(e => e.participants && e.participants.length > 0);

    // Xóa các settlement liên quan đến người này
    state.settlements = state.settlements.filter(s =>
      s.fromId !== memberId && s.toId !== memberId
    );

    saveState();
    renderAll();
    showToast(`Đã xóa ${m.name}`);
  }

  // ========== EVENT HANDLERS ==========
  function initEvents() {
    // Auth
    document.getElementById('btn-demo').addEventListener('click', () => {
      const btn = document.getElementById('btn-demo');
      btn.disabled = true;
      btn.textContent = 'Đang tải dữ liệu...';

      loadState(() => {
        // Khôi phục lựa chọn user từ local
        const savedUser = localStorage.getItem('roomie_current_user');
        if (savedUser && state.members.find(m => m.id === savedUser)) {
          state.currentUserId = savedUser;
        }
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        renderAll();
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3"/></svg> Trải nghiệm Demo`;
        if (useFirebase) {
          showToast('Đã kết nối dữ liệu dùng chung (Firebase)');
        }
      });
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      document.getElementById('app').classList.add('hidden');
      document.getElementById('auth-screen').classList.remove('hidden');
    });

    document.getElementById('btn-reset-demo').addEventListener('click', resetDemo);
    document.getElementById('btn-load-sample')?.addEventListener('click', loadSampleData);
    document.getElementById('btn-reminder-go')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-page="debts"]')?.click();
    });

    // User switcher – chỉ lưu local, không ghi đè lên shared data của người khác
    document.getElementById('user-switcher')?.addEventListener('change', (e) => {
      state.currentUserId = e.target.value;
      localStorage.setItem('roomie_current_user', state.currentUserId);
      renderAll();
      showToast(`Đã chuyển sang xem với tư cách ${getCurrentUser().name}`);
    });

    // Navigation
    document.querySelectorAll('.nav-item, [data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.page;
        if (!page) return;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');
        if (page === 'history') renderHistory();
        if (page === 'debts') renderDebts();
        if (page === 'expenses') renderExpenses();
        if (page === 'dashboard') renderDashboard();
      });
    });

    // Add expense buttons
    document.getElementById('btn-add-expense').addEventListener('click', () => openExpenseModal());
    document.getElementById('btn-add-expense-dash').addEventListener('click', () => openExpenseModal());

    // Clickable stat cards on Dashboard
    document.querySelectorAll('.clickable-stat').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.stat;
        if (type) openStatDetail(type);
      });
    });

    // Invite
    document.getElementById('btn-invite').addEventListener('click', () => {
      document.getElementById('invite-panel').classList.toggle('hidden');
    });
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard?.writeText(state.household.inviteCode);
      showToast('Đã sao chép mã mời');
    });

    // Member management
    document.getElementById('btn-add-member')?.addEventListener('click', () => openMemberModal());

    document.getElementById('form-member')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('member-name').value;
      let ok = false;
      if (editingMemberId) {
        ok = renameMember(editingMemberId, name);
      } else {
        ok = addMember(name);
      }
      if (ok) {
        closeModals();
        editingMemberId = null;
      }
    });

    // Edit / Delete member (delegation)
    document.getElementById('members-list')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-member]');
      const delBtn = e.target.closest('[data-delete-member]');
      if (editBtn) {
        openMemberModal(editBtn.dataset.editMember);
      }
      if (delBtn) {
        deleteMember(delBtn.dataset.deleteMember);
      }
    });

    // Modal close
    document.querySelectorAll('[data-close], .modal-backdrop').forEach(el => {
      el.addEventListener('click', closeModals);
    });

    // Split type change
    document.querySelectorAll('input[name="split-type"]').forEach(radio => {
      radio.addEventListener('change', () => updateCustomSplitUI());
    });
    document.getElementById('expense-amount').addEventListener('input', () => {
      if (document.querySelector('input[name="split-type"]:checked').value === 'custom') {
        updateCustomSplitUI();
      }
    });

    // Submit expense
    document.getElementById('form-expense').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('expense-name').value.trim();
      const amount = Number(document.getElementById('expense-amount').value);
      const date = document.getElementById('expense-date').value;
      const category = document.getElementById('expense-category').value;
      const payerId = document.getElementById('expense-payer').value;
      const note = document.getElementById('expense-note').value.trim();
      const splitType = document.querySelector('input[name="split-type"]:checked').value;

      const participants = Array.from(
        document.querySelectorAll('#expense-participants input:checked')
      ).map(cb => cb.value);

      if (participants.length === 0) {
        showToast('Chọn ít nhất một thành viên tham gia');
        return;
      }
      if (!name || amount <= 0) {
        showToast('Vui lòng nhập đầy đủ thông tin');
        return;
      }

      let customShares = null;
      if (splitType === 'custom') {
        customShares = {};
        let total = 0;
        document.querySelectorAll('#custom-split-area input[data-member]').forEach(inp => {
          const val = Math.round(Number(inp.value) || 0);
          customShares[inp.dataset.member] = val;
          total += val;
        });
        if (Math.abs(total - amount) > 1) {
          showToast(`Tổng phần chia (${formatMoney(total)}) phải bằng số tiền (${formatMoney(amount)})`);
          return;
        }
      }

      const expense = {
        id: editingExpenseId || 'e' + Date.now(),
        name,
        amount,
        category,
        payerId,
        participants,
        splitType,
        customShares,
        date,
        note,
        createdAt: editingExpenseId
          ? (state.expenses.find(x => x.id === editingExpenseId)?.createdAt || Date.now())
          : Date.now()
      };
      expense.shares = computeShares(expense);

      if (editingExpenseId) {
        const idx = state.expenses.findIndex(x => x.id === editingExpenseId);
        if (idx >= 0) state.expenses[idx] = expense;
        showToast('Đã cập nhật khoản chi');
      } else {
        state.expenses.push(expense);
        showToast('Đã thêm khoản chi');
      }

      saveState();
      closeModals();
      renderAll();
    });

    // Delete / Edit expense (delegation)
    document.getElementById('expenses-list').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-expense]');
      const delBtn = e.target.closest('[data-delete-expense]');
      if (editBtn) {
        e.stopPropagation();
        openExpenseModal(editBtn.dataset.editExpense);
        return;
      }
      if (delBtn) {
        e.stopPropagation();
        deleteExpenseById(delBtn.dataset.deleteExpense);
        return;
      }
    });

    // View expense detail + actions from detail modal
    document.querySelector('.main').addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-view-expense]');
      if (viewBtn && !e.target.closest('.tx-actions')) {
        openExpenseDetail(viewBtn.dataset.viewExpense);
      }
    });

    document.getElementById('detail-content')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-delete-from-detail]');
      const editBtn = e.target.closest('[data-edit-from-detail]');
      if (delBtn) {
        deleteExpenseById(delBtn.dataset.deleteFromDetail);
      }
      if (editBtn) {
        closeModals();
        openExpenseModal(editBtn.dataset.editFromDetail);
      }
    });

    // Settlement buttons (delegation)
    document.getElementById('settlement-suggestions').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-settle-from]');
      if (btn) {
        openSettleModal(
          btn.dataset.settleFrom,
          btn.dataset.settleTo,
          Number(btn.dataset.settleAmount)
        );
      }
    });

    // Submit settlement
    document.getElementById('form-settle').addEventListener('submit', (e) => {
      e.preventDefault();
      const fromId = document.getElementById('settle-from').value;
      const toId = document.getElementById('settle-to').value;
      const amount = Number(document.getElementById('settle-amount').value);
      const note = document.getElementById('settle-note').value.trim();

      if (amount <= 0) {
        showToast('Số tiền không hợp lệ');
        return;
      }

      // Check remaining debt (allow small rounding tolerance)
      const suggestions = computeSettlementSuggestions();
      const match = suggestions.find(s => s.fromId === fromId && s.toId === toId);
      const maxAllowed = match ? match.amount : 0;
      if (amount > maxAllowed + 2) {
        showToast(`Không thể thanh toán vượt quá số nợ còn lại (${formatMoney(maxAllowed)})`);
        return;
      }
      if (amount <= 0) {
        showToast('Số tiền phải lớn hơn 0');
        return;
      }

      state.settlements.push({
        id: 's' + Date.now(),
        fromId,
        toId,
        amount: Math.round(amount),
        note,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now()
      });

      saveState();
      closeModals();
      renderAll();
      showToast('Đã ghi nhận thanh toán');
    });

    // History filters
    ['search-history', 'filter-category', 'filter-time'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', renderHistory);
      document.getElementById(id)?.addEventListener('change', renderHistory);
    });
  }

  // ========== INIT ==========
  document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initEvents();

    // Hiển thị trạng thái kết nối trên màn hình auth
    const note = document.querySelector('.auth-note');
    if (note) {
      if (useFirebase) {
        note.innerHTML = '✅ Đã kết nối <strong>dữ liệu dùng chung</strong> (Firebase).<br>Bắt đầu từ <strong>0đ</strong> – tự thêm khoản chi. Có nút “Tải dữ liệu mẫu” nếu cần demo.';
      } else {
        note.innerHTML = 'Phòng <strong>The Cozy House</strong> · Bắt đầu từ <strong>0đ</strong>.<br><small style="opacity:0.8">Tự thêm khoản chi. Nút “Tải dữ liệu mẫu” để demo thuyết trình.</small>';
      }
    }
  });
})();
