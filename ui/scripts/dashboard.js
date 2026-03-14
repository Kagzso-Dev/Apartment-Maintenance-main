const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

window.state = {
  data: null,
  month: 1,
  year: 2025,
  filter: "all",
  isAdmin: localStorage.getItem("isAdmin") === "true",
  editingRecord: null,
  viewMode: 'owner', // 'owner' or 'flat'
};
const state = window.state;

function fmtCurrency(n) {
  const currency = state.currency || 'INR';
  const symbol = state.currencySymbol || '₹';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(n || 0);
  } catch {
    return `${symbol}${(n || 0).toLocaleString('en-IN')}`;
  }
}
const fmtINR = fmtCurrency; // Maintain alias for compatibility

function formatPaymentDate(dateValue) {
  if (!dateValue) return '';

  // If it's already a string in DD-MM-YYYY format, return as is
  if (typeof dateValue === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(dateValue)) {
    return dateValue;
  }

  // If it's a Date object or datetime string, convert to DD-MM-YYYY
  try {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch (e) {
    console.warn('Failed to parse date:', dateValue, e);
  }

  return String(dateValue);
}

function parseVacantPeriods(str) {
  if (!str || !str.trim()) return [];
  return str.split('|').map(range => {
    const [from, to] = range.split('to').map(d => d.trim());
    return { from: parseDateStr(from), to: parseDateStr(to) };
  }).filter(r => r.from && r.to);
}

function parseDateStr(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = Number(parts[0]), month = Number(parts[1]), year = Number(parts[2]);
    return { day, month, year };
  }
  return null;
}

function isMonthInVacantPeriod(month, year, vacantPeriods) {
  if (!vacantPeriods || vacantPeriods.length === 0) return false;
  return vacantPeriods.some(period => {
    const fromMatch = year > period.from.year || (year === period.from.year && month >= period.from.month);
    const toMatch = year < period.to.year || (year === period.to.year && month <= period.to.month);
    return fromMatch && toMatch;
  });
}

function getEffectiveMonthlyAmount(flat, month, year) {
  if (isMonthInVacantPeriod(month, year, flat.vacantPeriods)) {
    return (flat.monthlyAmount * flat.vacantRatePct) / 100;
  }
  return flat.monthlyAmount;
}

async function loadData() {
  try {
    console.log('[Dashboard] loadData() starting…');
    const [config, master, ledger] = await Promise.all([
      XLSXLoader.fetchXLSX('./data/Customer_Details.xlsx', 'Config'),
      XLSXLoader.fetchXLSX('./data/Customer_Details.xlsx', 'Sheet1'),
      XLSXLoader.fetchXLSX('./data/Monthly_Transactions.xlsx'),
    ]);
    console.log('[Dashboard] XLSX fetched:', {
      configRows: config && config.length,
      masterRows: master && master.length,
      ledgerRows: ledger && ledger.length,
    });

    // Parse config into key-value object
    const settings = {};
    config.forEach(row => {
      if (row.SettingName && row.SettingValue) {
        settings[row.SettingName] = row.SettingValue;
      }
    });
    state.currency = settings.Currency || 'INR';
    state.currencySymbol = settings.CurrencySymbol || '₹';
    console.log('Loaded config:', settings);

    console.log('Raw master data (first row):', master[0]);
    console.log('Raw ledger data (first row):', ledger[0]);

    const flats = master.map(r => {
      try {
        return {
          flatNo: (r.FlatNo || '').trim(),
          ownerName: (r.OwnerName || '').trim(),
          apartmentType: (r.ApartmentType || '').trim(),
          monthlyAmount: Number(r.MonthlyAmount_2025 || 0),
          status: (r.Status || 'Active').trim(),
          occupancyType: (r.OccupancyType || 'Rented').trim(),
          vacantPeriods: parseVacantPeriods(r.VacantPeriods || ''),
          vacantRatePct: Number(r.VacantRatePct || 100),
        };
      } catch (e) {
        console.error('Error parsing flat:', r, e);
        return null;
      }
    }).filter(f => f !== null);

    const tx = ledger.map(r => {
      try {
        return {
          TransactionID: (r.TransactionID || '').trim(),
          paymentTxnId: (r.PaymentTransactionID || r.TransactionRef || r.TxnId || '').trim(),
          flatNo: (r.FlatNo || '').trim(),
          ownerName: (r.OwnerName || '').trim(),
          phone: (r.Phone || '').trim(),
          monthName: (r.Month || '').trim(),
          month: Math.max(1, MONTHS.indexOf((r.Month || '').trim()) + 1),
          year: Number(r.Year || 0),
          paymentStatus: (r.PaymentStatus || '').trim(),
          paymentMode: (r.PaymentMode || '').trim(),
          paymentAmount: Number(r.PaymentAmount || 0),
          paymentDate: formatPaymentDate(r.PaymentDate),
          pendingAmount: Number(r.PendingAmount || 0),
          remarks: (r.Remarks || '').trim(),
          monthlyAmount: Number(r.MonthlyAmount || 0),
        };
      } catch (e) {
        console.error('Error parsing transaction:', r, e);
        return null;
      }
    }).filter(t => t !== null);

    // Extract apartment name from first master row if available
    const apartmentName = settings.ApartmentName || 'Apartment Name';
    const year = Number(settings.Year) || 2025;
    state.data = { apartmentName, year, flats, transactions: tx, config: settings };

    console.log('Data loaded successfully:', flats.length, 'flats,', tx.length, 'transactions');
    console.log('Sample flat:', flats[0]);
    console.log('Sample transaction:', tx[0]);
  } catch (e) {
    console.error('[Dashboard] CRITICAL ERROR loading XLSX:', e);
    alert('Failed to load data files. Please check:\n1. Files exist in ./data/ folder\n2. Server is running\n3. Console for detailed errors');
    state.data = { apartmentName: 'Apartment', year: 2025, flats: [], transactions: [] };
  }

  state.year = state.data.year || 2025;
  state.month = 1;
  const apartmentNameDisplay = state.data.apartmentName || 'Apartment';
  document.getElementById('bannerApartmentName').textContent = apartmentNameDisplay;
  buildSelectors();
  render();
  wireActions();
  wireAdminActions();
}

function buildSelectors() {
  const monthChips = document.getElementById('monthChips');
  const yearChips = document.getElementById('yearChips');

  monthChips.innerHTML = '';
  MONTHS.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'chip' + (i + 1 === state.month ? ' active' : '');
    b.textContent = m;
    b.setAttribute('data-month', String(i + 1));
    b.addEventListener('click', () => {
      state.month = i + 1;
      render();
    });
    monthChips.appendChild(b);
  });

  yearChips.innerHTML = '';
  const y = state.year;
  [y - 1, y, y + 1].forEach(yr => {
    const b = document.createElement('button');
    b.className = 'chip' + (yr === state.year ? ' active' : '');
    b.textContent = String(yr);
    b.setAttribute('data-year', String(yr));
    b.addEventListener('click', () => {
      state.year = yr;
      render();
    });
    yearChips.appendChild(b);
  });
}

function getPeriodTransactions() {
  return (state.data.transactions || []).filter(t =>
    t.year === state.year && t.month === state.month
  );
}

function computeSummaries() {
  const flats = state.data.flats || [];
  const tx = getPeriodTransactions();
  const activeFlats = flats.filter(f => f.status === 'Active');
  const totalFlats = activeFlats.length;

  let paidCount = 0;
  let collected = 0;
  let outstanding = 0;
  const flatMap = Object.fromEntries(flats.map(f => [f.flatNo, f]));

  tx.forEach(row => {
    const flat = flatMap[row.flatNo];
    if (!flat || flat.status !== 'Active') return;
    const effectiveAmount = getEffectiveMonthlyAmount(flat, row.month, row.year);
    const paidAmount = Number(row.paymentAmount || 0);
    const isFullyPaid = row.paymentStatus === 'Paid' && paidAmount >= effectiveAmount;
    const isPartial = (row.paymentStatus === 'Partial') || (row.paymentStatus === 'Paid' && paidAmount > 0 && paidAmount < effectiveAmount);

    if (isFullyPaid) {
      paidCount += 1;
      collected += paidAmount;
    } else if (isPartial) {
      collected += paidAmount;
      outstanding += Math.max(0, effectiveAmount - paidAmount);
    } else {
      outstanding += effectiveAmount;
    }
  });

  const pendingCount = totalFlats - paidCount;
  return { totalFlats, paidCount, pendingCount, collected, outstanding };
}

function renderSummary() {
  const { totalFlats, paidCount, pendingCount, collected, outstanding } = computeSummaries();

  document.getElementById('totalFlats').textContent = String(totalFlats);
  document.getElementById('paidCount').textContent = String(paidCount);
  document.getElementById('pendingCount').textContent = String(pendingCount);
  document.getElementById('totalCollected').textContent = fmtINR(collected);
  document.getElementById('totalOutstanding').textContent = fmtINR(outstanding);

  const period = `${MONTHS[state.month - 1]} ${state.year}`;
  document.getElementById('currentPeriod').textContent = period;
}

function renderList() {
  const tbody = document.querySelector('#flatsTable tbody');
  const cards = document.getElementById('flatsCards');
  tbody.innerHTML = '';
  cards.innerHTML = '';

  const tx = getPeriodTransactions();
  const flats = state.data.flats || [];
  const flatInfo = Object.fromEntries(flats.map(f => [f.flatNo, f]));

  const filtered = tx.filter(row => {
    const flat = flatInfo[row.flatNo];
    if (flat && flat.status !== 'Active') return false;

    if (state.filter === 'all') return true;

    const effectiveAmount = flat ? getEffectiveMonthlyAmount(flat, row.month, row.year) : row.monthlyAmount;
    const paidAmount = Number(row.paymentAmount || 0);
    const isFullyPaid = row.paymentStatus === 'Paid' && paidAmount >= effectiveAmount;
    const isPartialPaid = (row.paymentStatus === 'Partial') || (row.paymentStatus === 'Paid' && paidAmount > 0 && paidAmount < effectiveAmount);

    if (state.filter === 'paid') return isFullyPaid;
    if (state.filter === 'pending') return !isFullyPaid && !isPartialPaid; // Only Not Paid (excludes partial)
    if (state.filter === 'partial') return isPartialPaid; // Only partial payments
    return true;
  });

  const monthlyAmountByFlat = Object.fromEntries(flats.map(f => [f.flatNo, f]));
  const pendingMonthsByFlat = {};

  // Calculate pending months by counting actual months with pending amounts across the year
  const allYearTransactions = state.data.transactions.filter(t => t.year === state.year);
  flats.forEach(flat => {
    const flatTxns = allYearTransactions.filter(t => t.flatNo === flat.flatNo);
    let pendingCount = 0;

    flatTxns.forEach(txn => {
      const effectiveAmount = getEffectiveMonthlyAmount(flat, txn.month, txn.year);
      const dueAmount = effectiveAmount || txn.monthlyAmount || 0;
      const paidAmount = Number(txn.paymentAmount || 0);
      const pendingAmount = dueAmount - paidAmount;

      if (pendingAmount > 0) {
        pendingCount++;
      }
    });

    pendingMonthsByFlat[flat.flatNo] = pendingCount;
  });

  const tbodyFragment = document.createDocumentFragment();
  const cardsFragment = document.createDocumentFragment();

  filtered.forEach(row => {
    const flat = flatInfo[row.flatNo];
    const info = monthlyAmountByFlat[row.flatNo] || {};
    const effectiveAmount = flat ? getEffectiveMonthlyAmount(flat, row.month, row.year) : row.monthlyAmount;
    const dueAmount = effectiveAmount || row.monthlyAmount || 0;
    const paidAmount = Number(row.paymentAmount || 0);
    const dateStr = row.paymentDate ? row.paymentDate : '-';
    const amountStr = `₹${dueAmount.toLocaleString('en-IN')}`;
    const paidStr = `₹${paidAmount.toLocaleString('en-IN')}`;
    const isFullyPaid = row.paymentStatus === 'Paid' && paidAmount >= dueAmount;
    const isPartial = (row.paymentStatus === 'Partial') || (row.paymentStatus === 'Paid' && paidAmount > 0 && paidAmount < dueAmount);
    const isVacant = flat && isMonthInVacantPeriod(row.month, row.year, flat.vacantPeriods);

    let statusLabel = row.paymentStatus || 'Not Paid';
    let badgeClass = 'pending';
    if (isFullyPaid) { statusLabel = 'Paid'; badgeClass = 'paid'; }
    else if (isPartial) { statusLabel = 'Partial'; badgeClass = 'partial'; }

    const pendingMonths = pendingMonthsByFlat[row.flatNo] || 0;
    const txnId = row.paymentTxnId || '-';

    // Table view
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.flatNo}</td>
      <td>${info.ownerName || '-'}</td>
      <td>${row.paymentMode || '-'}</td>
      <td>${txnId}</td>
      <td>${amountStr}</td>
      <td>${paidStr}</td>
      <td>${dateStr}</td>
    `;

    const tdStatus = document.createElement('td');
    tdStatus.innerHTML = `<span class="badge ${badgeClass}">${statusLabel}</span>${isVacant ? ' <span class="badge" style="background:#8B6914;margin-left:4px;">Vacant</span>' : ''}`;
    tr.insertBefore(tdStatus, tr.children[2]); // Insert before payment mode

    const tdPending = document.createElement('td');
    tdPending.innerHTML = pendingMonths > 0
      ? `<span class="badge pending pending-detail" data-flat="${row.flatNo}">${pendingMonths} mth</span>`
      : `<span class="badge paid">0 mth</span>`;
    const pendingBadge = tdPending.querySelector('.pending-detail');
    if (pendingBadge) {
      pendingBadge.addEventListener('click', () => showPendingBreakdown(row.flatNo));
    }
    tr.appendChild(tdPending);

    if (state.isAdmin) {
      const tdEdit = document.createElement('td');
      tdEdit.style.display = 'flex';
      tdEdit.style.gap = '6px';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-icon';
      btnEdit.textContent = 'Edit';
      btnEdit.addEventListener('click', () => {
        console.log('Edit button clicked for:', row.flatNo);
        openEditModal(row);
      });
      tdEdit.appendChild(btnEdit);

      // Add Bill button only for paid/partial transactions
      if (isFullyPaid || isPartial) {
        const btnBill = document.createElement('button');
        btnBill.className = 'btn-icon';
        btnBill.textContent = 'Bill';
        btnBill.addEventListener('click', () => {
          printInvoice(row, flat);
        });
        tdEdit.appendChild(btnBill);
      }

      tr.appendChild(tdEdit);
    }

    tbodyFragment.appendChild(tr);

    // Card view for mobile
    const card = document.createElement('div');
    card.className = 'card-item';
    let cardHTML = `
      <div class="card-row">
        <div>
          <div class="card-title">${row.flatNo} • ${info.ownerName || ''}</div>
          <div class="card-sub">${dateStr}</div>
        </div>
        <div><span class="badge ${badgeClass}">${statusLabel}</span>${isVacant ? '<span class="badge" style="background:#8B6914;margin-left:4px;">Vacant</span>' : ''}</div>
      </div>
      <div class="card-row" style="margin-top:8px;">
        <div class="card-sub">Due</div>
        <div>${amountStr}</div>
      </div>
      <div class="card-row" style="margin-top:8px;">
        <div class="card-sub">Paid</div>
        <div>${paidStr}</div>
      </div>
      <div class="card-row" style="margin-top:8px;">
        <div class="card-sub">Pending</div>
        <div><span class="badge ${pendingMonths > 0 ? 'pending' : 'paid'} pending-detail" data-flat="${row.flatNo}">${pendingMonths > 0 ? (pendingMonths + ' mth') : '0 mth'}</span></div>
      </div>
    `;

    if (state.isAdmin) {
      const showBillBtn = isFullyPaid || isPartial;
      if (showBillBtn) {
        cardHTML += `
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn-icon edit-card-btn" style="flex:1;" data-txn="${row.TransactionID}">Edit</button>
            <button class="btn-icon bill-card-btn" style="flex:1;" data-txn="${row.TransactionID}">Bill</button>
          </div>
        `;
      } else {
        cardHTML += `<button class="btn-icon edit-card-btn" style="margin-top:8px;width:100%;" data-txn="${row.TransactionID}">Edit</button>`;
      }
    }

    card.innerHTML = cardHTML;

    if (state.isAdmin) {
      const editBtn = card.querySelector('.edit-card-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          console.log('Card edit button clicked for:', row.flatNo);
          openEditModal(row);
        });
      }

      const billBtn = card.querySelector('.bill-card-btn');
      if (billBtn) {
        billBtn.addEventListener('click', () => {
          printInvoice(row, flat);
        });
      }
    }

    const pendingDetailBtn = card.querySelector('.pending-detail');
    if (pendingDetailBtn) {
      pendingDetailBtn.addEventListener('click', () => showPendingBreakdown(row.flatNo));
    }

    cardsFragment.appendChild(card);
  });

  tbody.appendChild(tbodyFragment);
  cards.appendChild(cardsFragment);

  console.log('Rendered', filtered.length, 'records. Admin mode:', state.isAdmin);
}

function render() {
  document.querySelectorAll('#monthChips .chip').forEach(el => {
    const m = Number(el.getAttribute('data-month'));
    el.classList.toggle('active', m === state.month);
  });

  document.querySelectorAll('#yearChips .chip').forEach(el => {
    const y = Number(el.getAttribute('data-year'));
    el.classList.toggle('active', y === state.year);
  });

  renderSummary();
  renderList();
  updateAdminUI();
}

function applyFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('.list-actions .btn[data-filter]').forEach(b => {
    const f = b.getAttribute('data-filter');
    b.classList.toggle('active', f === filter);
  });
  render();
}

function wireActions() {
  document.querySelectorAll('.list-actions .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'exportBtn') return;
      applyFilter(btn.getAttribute('data-filter') || 'all');
    });
  });

  const paidCountEl = document.getElementById('paidCount');
  if (paidCountEl) {
    paidCountEl.addEventListener('click', () => applyFilter('paid'));
  }

  const pendingCountEl = document.getElementById('pendingCount');
  if (pendingCountEl) {
    pendingCountEl.addEventListener('click', () => applyFilter('pending'));
  }

  const totalFlatsEl = document.getElementById('totalFlats');
  if (totalFlatsEl) {
    totalFlatsEl.addEventListener('click', () => applyFilter('all'));
  }

  // View by Owner / Flat toggle wiring
  const viewByOwner = document.getElementById('viewByOwner');
  const viewByFlat = document.getElementById('viewByFlat');
  if (viewByOwner && viewByFlat) {
    viewByOwner.addEventListener('click', () => {
      state.viewMode = 'owner';
      viewByOwner.classList.add('active');
      viewByFlat.classList.remove('active');
      calculateDashboardData();
    });
    viewByFlat.addEventListener('click', () => {
      state.viewMode = 'flat';
      viewByFlat.classList.add('active');
      viewByOwner.classList.remove('active');
      calculateDashboardData();
    });
  }
}

function wireAdminActions() {
  // adminToggle handled by auth.js

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToXLSX);
  }

  const modalClose = document.getElementById('modalClose');
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  const modalCancel = document.getElementById('modalCancel');
  if (modalCancel) {
    modalCancel.addEventListener('click', closeModal);
  }

  const modalSave = document.getElementById('modalSave');
  if (modalSave) {
    modalSave.addEventListener('click', saveEdit);
  }

  // Click outside modal to close
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Pending breakdown modal handlers
  const pendingModalClose = document.getElementById('pendingModalClose');
  if (pendingModalClose) {
    pendingModalClose.addEventListener('click', closePendingModal);
  }

  const pendingModalClose2 = document.getElementById('pendingModalClose2');
  if (pendingModalClose2) {
    pendingModalClose2.addEventListener('click', closePendingModal);
  }

  const pendingModal = document.getElementById('pendingModal');
  if (pendingModal) {
    pendingModal.addEventListener('click', (e) => {
      if (e.target === pendingModal) {
        closePendingModal();
      }
    });
  }

  // Dashboard View Toggling
  const dashboardBtn = document.getElementById('dashboardBtn');
  const flatsBtn = document.getElementById('flatsBtn');
  const flatsView = document.getElementById('flats-view');
  const dashboardView = document.getElementById('dashboard-view');

  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      flatsView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      dashboardBtn.classList.add('hidden');
      flatsBtn.classList.remove('hidden');
      calculateDashboardData();
    });
  }

  if (flatsBtn) {
    flatsBtn.addEventListener('click', () => {
      dashboardView.classList.add('hidden');
      flatsView.classList.remove('hidden');
      flatsBtn.classList.add('hidden');
      dashboardBtn.classList.remove('hidden');
      render(); // Refresh flats view
    });
  }
}



function updateAdminUI() {
  document.body.classList.toggle('admin-mode', state.isAdmin);

  const adminStatus = document.getElementById('adminStatus');
  if (adminStatus) {
    adminStatus.hidden = !state.isAdmin;
  }

  const adminToggle = document.getElementById('adminToggle');
  if (adminToggle) {
    adminToggle.hidden = state.isAdmin;
  }

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.hidden = !state.isAdmin;
  }

  const dashboardBtn = document.getElementById('dashboardBtn');
  const flatsBtn = document.getElementById('flatsBtn');
  const dashboardView = document.getElementById('dashboard-view');

  if (dashboardBtn || flatsBtn) {
    const isDashboardVisible = dashboardView && !dashboardView.classList.contains('hidden');

    if (state.isAdmin) {
      if (isDashboardVisible) {
        dashboardBtn?.classList.add('hidden');
        flatsBtn?.classList.remove('hidden');
      } else {
        dashboardBtn?.classList.remove('hidden');
        flatsBtn?.classList.add('hidden');
      }
    } else {
      dashboardBtn?.classList.add('hidden');
      flatsBtn?.classList.add('hidden');
    }
  }
}



function openEditModal(record) {
  console.log('Opening edit modal for:', record);
  state.editingRecord = record;
  const flat = (state.data.flats || []).find(f => f.flatNo === record.flatNo);
  const dueAmount = flat ? getEffectiveMonthlyAmount(flat, record.month, record.year) : (record.monthlyAmount || 0);

  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.textContent = `Edit Payment - ${record.flatNo}`;
  }

  const modalBody = document.getElementById('modalBody');
  if (!modalBody) {
    console.error('Modal body not found!');
    return;
  }

  modalBody.innerHTML = `
    <div class="form-group">
      <label class="form-label">Flat Number</label>
      <input type="text" class="form-input" value="${record.flatNo}" disabled />
    </div>
    <div class="form-group">
      <label class="form-label">Owner Name</label>
      <input type="text" class="form-input" value="${record.ownerName}" disabled />
    </div>
    <div class="form-group">
      <label class="form-label">Due This Period</label>
      <input type="text" class="form-input" value="${fmtINR(dueAmount)}" disabled />
    </div>
    <div class="form-group">
      <label class="form-label">Payment Status</label>
      <select class="form-select" id="editStatus">
        <option value="Paid" ${record.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
        <option value="Partial" ${record.paymentStatus === 'Partial' ? 'selected' : ''}>Partial</option>
        <option value="Not Paid" ${record.paymentStatus === 'Not Paid' ? 'selected' : ''}>Not Paid</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Payment Mode</label>
      <select class="form-select" id="editMode">
        <option value="">None</option>
        <option value="Cash" ${record.paymentMode === 'Cash' ? 'selected' : ''}>Cash</option>
        <option value="UPI" ${record.paymentMode === 'UPI' ? 'selected' : ''}>UPI</option>
        <option value="Bank" ${record.paymentMode === 'Bank' ? 'selected' : ''}>Bank</option>
        <option value="Cheque" ${record.paymentMode === 'Cheque' ? 'selected' : ''}>Cheque</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Transaction ID (UPI/Bank/Cheque)</label>
      <input type="text" class="form-input" id="editTxnId" value="${record.paymentTxnId || ''}" placeholder="Enter reference / UTR" />
    </div>
    <div class="form-group">
      <label class="form-label">Payment Amount</label>
      <input type="number" class="form-input" id="editAmount" value="${record.paymentAmount || ''}" placeholder="0" />
    </div>
    <div class="form-group">
      <label class="form-label">Payment Date (DD-MM-YYYY)</label>
      <input type="text" class="form-input" id="editDate" value="${record.paymentDate || ''}" placeholder="01-01-2025" />
    </div>
    <div class="form-group">
      <label class="form-label">Remarks</label>
      <input type="text" class="form-input" id="editRemarks" value="${record.remarks || ''}" />
    </div>
  `;

  const modal = document.getElementById('editModal');
  if (modal) {
    modal.hidden = false;
    console.log('Modal opened successfully');
  } else {
    console.error('Modal element not found!');
  }
}

function showPendingBreakdown(flatNo) {
  const flat = (state.data.flats || []).find(f => f.flatNo === flatNo);
  const monthlyAmount = flat ? flat.monthlyAmount : 0;
  if (!monthlyAmount) {
    alert('No monthly amount found for this flat.');
    return;
  }

  const tx = (state.data.transactions || [])
    .filter(t => t.flatNo === flatNo && t.year === state.year)
    .sort((a, b) => a.month - b.month);

  if (!tx.length) {
    alert('No transactions for this flat in the selected year.');
    return;
  }

  let pending = 0;
  const rows = [];

  tx.forEach(t => {
    const effectiveAmount = flat ? getEffectiveMonthlyAmount(flat, t.month, t.year) : monthlyAmount;
    const isVacant = flat && isMonthInVacantPeriod(t.month, t.year, flat.vacantPeriods);

    pending += effectiveAmount;
    const paid = (t.paymentStatus === 'Paid' || t.paymentStatus === 'Partial' || t.paymentStatus === 'Not Paid') ? (t.paymentAmount || 0) : 0;
    pending = Math.max(0, pending - paid);

    const monthName = MONTHS[t.month - 1];
    const needed = Math.max(0, effectiveAmount - paid);

    rows.push({
      month: monthName,
      due: effectiveAmount,
      paid: paid,
      pending: needed,
      isVacant: isVacant,
      isPaid: needed === 0
    });
  });

  // Populate modal
  document.getElementById('pendingModalTitle').textContent = `Pending Breakdown - ${flatNo} (${state.year})`;
  document.getElementById('totalPendingAmount').textContent = fmtINR(pending);

  const tbody = document.getElementById('pendingBreakdownTable');
  tbody.innerHTML = '';

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    tr.style.transition = 'background 0.2s';
    tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(34, 211, 238, 0.08)');
    tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');

    tr.innerHTML = `
      <td style="padding: 12px; color: #fff;">
        <div style="font-weight: 600;">${row.month}</div>
        <div style="font-size: 10px; color: #a1a1a1;">${row.isVacant ? 'VACANT' : 'REGULAR'}</div>
      </td>
      <td style="padding: 12px; text-align: right;">
        <div style="font-size: 10px; color: #a1a1a1;">Due</div>
        <div style="color: #fff;">${fmtINR(row.due)}</div>
      </td>
      <td style="padding: 12px; text-align: right;">
        <div style="font-size: 10px; color: #a1a1a1;">Paid</div>
        <div style="color: #22d3ee; font-weight: 500;">${fmtINR(row.paid)}</div>
      </td>
      <td style="padding: 12px; text-align: right;">
        <div style="font-size: 10px; color: #a1a1a1;">Pending</div>
        <div style="color: ${row.pending > 0 ? '#ff6b6b' : '#00d084'}; font-weight: 500;">${fmtINR(row.pending)}</div>
      </td>
      <td style="padding: 12px; text-align: center;">
        <span class="badge ${row.isPaid ? 'paid' : 'pending'}" style="font-size: 10px; padding: 2px 6px;">${row.isPaid ? 'PAID' : 'DUE'}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const modal = document.getElementById('pendingModal');
  if (modal) {
    modal.hidden = false;
  }
}

function closeModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.hidden = true;
  }
  state.editingRecord = null;
  console.log('Modal closed');
}

function closePendingModal() {
  const modal = document.getElementById('pendingModal');
  if (modal) {
    modal.hidden = true;
  }
  console.log('Pending modal closed');
}

function saveEdit() {
  if (!state.isAdmin) {
    alert('Unauthorized: Only an admin can edit data.');
    return;
  }
  if (!state.editingRecord) {
    alert('Error: No record selected for editing.');
    return;
  }

  const newStatus = document.getElementById('editStatus').value;
  const newMode = document.getElementById('editMode').value;
  const newAmount = Number(document.getElementById('editAmount').value) || 0;
  const newDate = document.getElementById('editDate').value;
  const newTxnId = (document.getElementById('editTxnId')?.value || '').trim();
  const newRemarks = document.getElementById('editRemarks').value;

  console.log('Saving edit:', { newStatus, newMode, newAmount, newDate, newTxnId, newRemarks });

  if (newMode && newMode !== 'Cash' && !newTxnId) {
    alert('Transaction ID is required for non-cash payments.');
    return;
  }
  if (newStatus === 'Partial' && newAmount <= 0) {
    alert('Partial payments need a payment amount greater than 0.');
    return;
  }

  const idx = state.data.transactions.findIndex(t =>
    t.TransactionID === state.editingRecord.TransactionID
  );

  if (idx >= 0) {
    state.data.transactions[idx].paymentStatus = newStatus;
    state.data.transactions[idx].paymentMode = newMode;
    state.data.transactions[idx].paymentAmount = newAmount;
    state.data.transactions[idx].paymentDate = newDate;
    state.data.transactions[idx].paymentTxnId = newTxnId;
    state.data.transactions[idx].remarks = newRemarks;

    // Recalculate pending amounts for this flat using effective amounts (handles vacancy)
    const flatNo = state.data.transactions[idx].flatNo;
    const flat = (state.data.flats || []).find(f => f.flatNo === flatNo);
    const allForFlat = state.data.transactions
      .filter(t => t.flatNo === flatNo && t.year === state.year)
      .sort((a, b) => a.month - b.month);

    let pending = 0;
    allForFlat.forEach(t => {
      const effectiveAmount = flat ? getEffectiveMonthlyAmount(flat, t.month, t.year) : (t.monthlyAmount || 0);
      pending += effectiveAmount;
      const paidAmt = (t.paymentStatus === 'Paid' || t.paymentStatus === 'Partial') ? (t.paymentAmount || 0) : 0;
      pending = Math.max(0, pending - paidAmt);
      t.pendingAmount = pending;
    });

    console.log('Payment updated successfully');
    closeModal();
    render();

    // Auto-save to server
    saveToServer();
  } else {
    console.error('Transaction not found');
    alert('Error: Transaction not found');
  }
}

function exportToXLSX() {
  if (!state.isAdmin) {
    alert('Unauthorized: Only an admin can export reports.');
    return;
  }
  if (!window.XLSX) {
    alert('XLSX library not loaded. Cannot export.');
    return;
  }

  console.log('Exporting to XLSX...');

  const masterData = state.data.flats.map(f => ({
    FlatNo: f.flatNo,
    OwnerName: f.ownerName,
    ApartmentType: f.apartmentType,
    MonthlyAmount_2025: f.monthlyAmount,
    AmountEffectiveFrom: '01-01-2025',
    Status: f.status || 'Active',
    OccupancyType: f.occupancyType || 'Rented',
    VacantPeriods: f.vacantPeriods && f.vacantPeriods.length > 0 ? f.vacantPeriods.map(p => `${p.from.day}-${p.from.month}-${p.from.year} to ${p.to.day}-${p.to.month}-${p.to.year}`).join(' | ') : '',
    VacantRatePct: f.vacantRatePct || 100,
  }));

  const txData = state.data.transactions.map(t => ({
    TransactionID: t.TransactionID,
    PaymentTransactionID: t.paymentTxnId || '',
    FlatNo: t.flatNo,
    OwnerName: t.ownerName,
    Phone: t.phone,
    Month: t.monthName,
    Year: t.year,
    PaymentStatus: t.paymentStatus,
    PaymentMode: t.paymentMode,
    PaymentAmount: t.paymentAmount || '',
    PaymentDate: t.paymentDate || '',
    PendingAmount: t.pendingAmount,
    Remarks: t.remarks || '',
    MonthlyAmount: t.monthlyAmount,
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(masterData);
  const ws2 = XLSX.utils.json_to_sheet(txData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Customer_Details');
  XLSX.utils.book_append_sheet(wb, ws2, 'Monthly_Transactions');

  const filename = `Apartment_Maintenance_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('Exported to:', filename);
}

async function saveToServer() {
  try {
    const response = await fetch('http://localhost:3000/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flats: state.data.flats,
        transactions: state.data.transactions,
        isAdmin: state.isAdmin
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('✓ Changes saved successfully to Excel files!');
      console.log('Data saved to server');
    } else {
      alert('Error saving: ' + result.error);
      console.error('Save error:', result.error);
    }
  } catch (error) {
    alert('Error: Could not connect to server. Make sure the server is running (npm start).');
    console.error('Network error:', error);
  }
}

function printInvoice(transaction, flatDetails) {
  const config = state.data.config || {};
  const apartmentName = config.apartmentName || 'Apartment Name';
  const address = config.address || '';
  const phone = config.phone || '';

  const effectiveAmount = flatDetails ? getEffectiveMonthlyAmount(flatDetails, transaction.month, transaction.year) : transaction.monthlyAmount;
  const paidAmount = Number(transaction.paymentAmount || 0);
  const dueAmount = effectiveAmount || transaction.monthlyAmount || 0;

  const invoiceWindow = window.open('', '_blank', 'width=800,height=600');

  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${transaction.flatNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          background: #fff;
          color: #000;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #000;
          padding: 30px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
          color: #000;
        }
        .header p {
          font-size: 14px;
          color: #333;
          margin: 5px 0;
        }
        .invoice-title {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          margin: 20px 0;
          color: #000;
        }
        .invoice-details {
          display: flex;
          justify-content: space-between;
          margin: 20px 0;
        }
        .details-section {
          flex: 1;
        }
        .details-section h3 {
          font-size: 14px;
          margin-bottom: 10px;
          color: #000;
        }
        .details-section p {
          font-size: 13px;
          margin: 5px 0;
          color: #333;
        }
        .payment-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .payment-table th,
        .payment-table td {
          border: 1px solid #000;
          padding: 12px;
          text-align: left;
          font-size: 13px;
        }
        .payment-table th {
          background: #f0f0f0;
          font-weight: bold;
          color: #000;
        }
        .payment-table td {
          color: #333;
        }
        .total-row {
          font-weight: bold;
          background: #f9f9f9;
        }
        .footer {
          margin-top: 40px;
          border-top: 2px solid #000;
          padding-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        .status-paid {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .status-partial {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }
        @media print {
          body { padding: 0; }
          .invoice-container { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <h1>${apartmentName}</h1>
          ${address ? `<p>${address}</p>` : ''}
          ${phone ? `<p>Phone: ${phone}</p>` : ''}
        </div>

        <div class="invoice-title">PAYMENT RECEIPT</div>

        <div class="invoice-details">
          <div class="details-section">
            <h3>Bill To:</h3>
            <p><strong>${transaction.ownerName || ''}</strong></p>
            <p>Flat No: ${transaction.flatNo}</p>
            ${transaction.phone ? `<p>Phone: ${transaction.phone}</p>` : ''}
          </div>
          <div class="details-section" style="text-align: right;">
            <h3>Invoice Details:</h3>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
            <p><strong>Period:</strong> ${transaction.monthName} ${transaction.year}</p>
            <p><strong>Txn ID:</strong> ${transaction.paymentTxnId || transaction.TransactionID}</p>
            <p><strong>Status:</strong> <span class="status-badge ${paidAmount >= dueAmount ? 'status-paid' : 'status-partial'}">${paidAmount >= dueAmount ? 'PAID' : 'PARTIAL'}</span></p>
          </div>
        </div>

        <table class="payment-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Period</th>
              <th>Due Amount</th>
              <th>Paid Amount</th>
              <th>Payment Mode</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Maintenance Charges</td>
              <td>${transaction.monthName} ${transaction.year}</td>
              <td>₹${dueAmount.toLocaleString('en-IN')}</td>
              <td>₹${paidAmount.toLocaleString('en-IN')}</td>
              <td>${transaction.paymentMode || '-'}</td>
            </tr>
            ${paidAmount < dueAmount ? `
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">Balance Due:</td>
              <td colspan="3">₹${(dueAmount - paidAmount).toLocaleString('en-IN')}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">Total Paid:</td>
              <td colspan="3">₹${paidAmount.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 30px; font-size: 13px;">
          <p><strong>Payment Date:</strong> ${transaction.paymentDate || new Date().toLocaleDateString('en-GB')}</p>
          ${transaction.remarks ? `<p><strong>Remarks:</strong> ${transaction.remarks}</p>` : ''}
        </div>

        <div class="footer">
          <p>This is a computer-generated receipt and does not require a signature.</p>
          <p>Thank you for your payment!</p>
          <p style="margin-top: 15px; font-weight: bold; color: #000;">Powered by <a href="https://kagzso.com" target="_blank" style="color: #22d3ee; text-decoration: none;">Kagzso.com</a></p>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  invoiceWindow.document.write(invoiceHTML);
  invoiceWindow.document.close();

  try {
    closeModal();
    closePendingModal();
  } catch (_) { }
}

// Dashboard & Analytics Implementation
let charts = {};

function calculateDashboardData() {
  const flats = state.data.flats || [];
  const transactions = state.data.transactions || [];
  const activeFlats = flats.filter(f => f.status === 'Active');

  // 1. Overall Summary (Yearly context)
  let totalCollected = 0;
  let totalOutstanding = 0;
  let currentPaidCount = 0;

  const currentYearTx = transactions.filter(t => t.year === state.year);
  const flatMap = Object.fromEntries(flats.map(f => [f.flatNo, f]));

  // Current month specific for top boxes
  const currentMonthTx = currentYearTx.filter(t => t.month === state.month);

  currentMonthTx.forEach(tx => {
    const flat = flatMap[tx.flatNo];
    if (!flat || flat.status !== 'Active') return;
    const effectiveDue = getEffectiveMonthlyAmount(flat, tx.month, tx.year);
    const paid = tx.paymentAmount || 0;
    if (tx.paymentStatus === 'Paid' && paid >= effectiveDue) currentPaidCount++;
  });

  currentYearTx.forEach(tx => {
    const flat = flatMap[tx.flatNo];
    if (!flat || flat.status !== 'Active') return;
    const effectiveDue = getEffectiveMonthlyAmount(flat, tx.month, tx.year);
    totalCollected += (tx.paymentAmount || 0);
    totalOutstanding += Math.max(0, effectiveDue - (tx.paymentAmount || 0));
  });

  // Calculate unique customers count
  const uniqueOwners = new Set(activeFlats.map(f => f.ownerName).filter(n => n && n !== '-'));

  // Update Summary UI
  document.getElementById('dbTotalFlats').textContent = activeFlats.length;
  document.getElementById('dbPaidFlats').textContent = currentPaidCount;
  document.getElementById('dbPendingFlats').textContent = activeFlats.length - currentPaidCount;
  document.getElementById('dbTotalCollected').textContent = fmtINR(totalCollected);
  document.getElementById('dbTotalOutstanding').textContent = fmtINR(totalOutstanding);
  document.getElementById('dbTotalCustomers').textContent = uniqueOwners.size;
  document.getElementById('dbPeriod').textContent = state.year;


  // 2. Charts
  renderTrendChart(currentYearTx);
  renderStatusChart(currentPaidCount, activeFlats.length);
  renderModeChart(currentYearTx);

  // 3. Customer Analytics Table
  renderCustomerAnalytics(flats, currentYearTx);
}

function renderTrendChart(yearTx) {
  const data = new Array(12).fill(0);
  yearTx.forEach(tx => data[tx.month - 1] += (tx.paymentAmount || 0));

  const ctx = document.getElementById('collectionTrendChart').getContext('2d');
  if (charts.trend) charts.trend.destroy();

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [{
        label: 'Collection',
        data: data,
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
        x: { grid: { display: false }, ticks: { color: '#888' } }
      }
    }
  });
}

function renderStatusChart(paid, total) {
  const ctx = document.getElementById('paymentStatusChart').getContext('2d');
  if (charts.status) charts.status.destroy();

  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Pending'],
      datasets: [{
        data: [paid, total - paid],
        backgroundColor: ['#34d399', '#f87171'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      cutout: '75%',
      plugins: { legend: { position: 'bottom', labels: { color: '#888' } } }
    }
  });
}

function renderModeChart(yearTx) {
  const modes = { 'Cash': 0, 'UPI': 0, 'Bank': 0, 'Cheque': 0 };
  yearTx.forEach(tx => {
    if (tx.paymentMode && modes[tx.paymentMode] !== undefined) modes[tx.paymentMode]++;
  });

  const ctx = document.getElementById('paymentModeChart').getContext('2d');
  if (charts.mode) charts.mode.destroy();

  charts.mode = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(modes),
      datasets: [{
        data: Object.values(modes),
        backgroundColor: ['#6366f1', '#22d3ee', '#34d399', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#888' } } }
    }
  });
}

function renderCustomerAnalytics(flats, yearTx) {
  const tbody = document.querySelector('#customerAnalyticsTable tbody');
  const thead = document.querySelector('#customerAnalyticsTable thead');
  tbody.innerHTML = '';
  const fragment = document.createDocumentFragment();

  // Update Headers based on view mode
  if (state.viewMode === 'owner') {
    thead.innerHTML = `
      <tr>
        <th>Owner/Name</th>
        <th style="text-align: center;">Flats Count</th>
        <th style="text-align: right;">Total Paid</th>
        <th style="text-align: center;">Status (P/U)</th>
        <th style="text-align: right;">Last Payment</th>
        <th style="text-align: center;">Action</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th>Flat Number</th>
        <th style="text-align: right;">Monthly Amt</th>
        <th style="text-align: right;">Total Paid</th>
        <th style="text-align: center;">Status (P/U)</th>
        <th style="text-align: right;">Last Payment</th>
        <th style="text-align: center;">Action</th>
      </tr>
    `;
  }

  const activeFlats = flats.filter(f => f.status === 'Active');
  const items = {};

  if (state.viewMode === 'owner') {
    // Group flats by owner
    activeFlats.forEach(flat => {
      if (!items[flat.ownerName]) {
        items[flat.ownerName] = {
          id: flat.ownerName,
          title: flat.ownerName,
          subtitle: '',
          flats: [],
          totalPaid: 0,
          paidMths: 0,
          pendingMths: 0,
          lastDate: '-',
          summaryVal: 0, // Number of flats
        };
      }
      items[flat.ownerName].flats.push(flat.flatNo);
    });
  } else {
    // Treat each flat as an item
    activeFlats.forEach(flat => {
      items[flat.flatNo] = {
        id: flat.flatNo,
        title: flat.flatNo,
        subtitle: flat.ownerName,
        flats: [flat.flatNo],
        totalPaid: 0,
        paidMths: 0,
        pendingMths: 0,
        lastDate: '-',
        summaryVal: flat.monthlyAmount, // Monthly amount
      };
    });
  }

  // Populate analytics from transactions
  const transactions = yearTx || [];
  transactions.forEach(tx => {
    const key = state.viewMode === 'owner' ? tx.ownerName : tx.flatNo;
    if (items[key]) {
      const paid = tx.paymentAmount || 0;
      const flat = activeFlats.find(f => f.flatNo === tx.flatNo);
      const effectiveDue = flat ? getEffectiveMonthlyAmount(flat, tx.month, tx.year) : 0;

      items[key].totalPaid += paid;
      if (tx.paymentStatus === 'Paid' && (paid >= effectiveDue)) {
        items[key].paidMths++;
      } else if (tx.paymentStatus !== 'Vacant' && tx.paymentStatus !== 'Exempt') {
        items[key].pendingMths++;
      }
      if (tx.paymentDate && tx.paymentDate !== '-') {
        items[key].lastDate = tx.paymentDate;
      }
    }
  });

  // Calculate subtitles for owner mode
  if (state.viewMode === 'owner') {
    Object.values(items).forEach(item => {
      item.subtitle = item.flats.join(', ');
      item.summaryVal = item.flats.length;
    });
  }

  Object.values(items).forEach(item => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

    const summaryStr = state.viewMode === 'owner' ? `${item.summaryVal}` : fmtINR(item.summaryVal);

    tr.innerHTML = `
          <td style="padding: 16px;">
            <div style="font-weight: 600; color: #fff;">${item.title}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${item.subtitle}</div>
          </td>
          <td style="padding: 16px; text-align: ${state.viewMode === 'owner' ? 'center' : 'right'};">${summaryStr}</td>
          <td style="padding: 16px; text-align: right; color: var(--accent); font-weight: 600;">${fmtINR(item.totalPaid)}</td>
          <td style="padding: 16px; text-align: center;">
            <span style="color: #34d399; font-weight: 600;">${item.paidMths}p</span> / <span style="color: #f87171; font-weight: 600;">${item.pendingMths}u</span>
          </td>
          <td style="padding: 16px; text-align: right; color: var(--text-secondary); font-size: 12px;">${item.lastDate}</td>
          <td style="padding: 16px; text-align: center;">
            <button class="btn ghost toggle-history" style="padding: 6px 12px; font-size: 11px;">View History</button>
          </td>
        `;

    const htr = document.createElement('tr');
    htr.className = 'history-row hidden';

    // Sort transactions for history display
    const historyData = transactions.filter(t =>
      state.viewMode === 'owner' ? t.ownerName === item.id : t.flatNo === item.id
    ).sort((a, b) => a.month - b.month);

    const historyHTML = `
          <div style="padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; margin: 10px;">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 16px; color: var(--accent); display: flex; align-items: center; gap: 8px;">
               <span>📜</span> Payment History for ${item.title} (${state.year})
            </div>
            <div class="history-grid">
              ${MONTHS.map((m, i) => {
      const txs = historyData.filter(t => t.month === i + 1);
      // Summarize month if multiple flats (owner mode)
      let status = 'Not Paid';
      let color = '#f87171';

      if (txs.length > 0) {
        const allPaid = txs.every(t => t.paymentStatus === 'Paid');
        const anyPaid = txs.some(t => t.paymentStatus === 'Paid' || t.paymentStatus === 'Partial');
        if (allPaid) { status = 'Paid'; color = '#34d399'; }
        else if (anyPaid) { status = 'Partial'; color = '#fbbf24'; }
      }

      return `
                  <div class="history-item" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
                    <div class="history-month" style="opacity: 0.6;">${m}</div>
                    <div class="history-status" style="color: ${color}; font-size: 10px;">${status}</div>
                  </div>
                `;
    }).join('')}
            </div>
          </div>
        `;

    htr.innerHTML = `<td colspan="6" style="padding: 0;">${historyHTML}</td>`;

    tr.querySelector('.toggle-history').addEventListener('click', (e) => {
      const isVisible = !htr.classList.contains('hidden');
      document.querySelectorAll('.history-row').forEach(row => row.classList.add('hidden'));
      if (!isVisible) {
        htr.classList.remove('hidden');
        e.target.textContent = 'Hide History';
      } else {
        e.target.textContent = 'View History';
      }
    });

    fragment.appendChild(tr);
    fragment.appendChild(htr);
  });
  tbody.appendChild(fragment);
}

// Global ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    try {
      closeModal();
      closePendingModal();
    } catch (_) { }
  }
});



