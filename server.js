const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from ui directory
app.use(express.static('ui'));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Save updated data back to Excel files (Admin Only)
app.post('/api/save', (req, res) => {
  try {
    const { flats, transactions, isAdmin } = req.body;

    // Backend Protection: Check if the request claims to be from an admin
    // In a real production app, this would check a secure session/JWT.
    if (isAdmin !== true) {
      console.warn('Unauthorized save attempt detected!');
      return res.status(403).json({ success: false, error: 'Access Denied: Admin role required.' });
    }

    console.log('Saving data...', { flatsCount: flats.length, txCount: transactions.length });

    // Prepare Customer_Details data
    const masterData = flats.map(f => ({
      FlatNo: f.flatNo,
      OwnerName: f.ownerName,
      ApartmentType: f.apartmentType,
      MonthlyAmount_2025: f.monthlyAmount,
      AmountEffectiveFrom: '01-01-2025',
      Status: f.status || 'Active',
      OccupancyType: f.occupancyType || 'Rented',
      VacantPeriods: f.vacantPeriods && f.vacantPeriods.length > 0
        ? f.vacantPeriods.map(p => `${p.from.day}-${p.from.month}-${p.from.year} to ${p.to.day}-${p.to.month}-${p.to.year}`).join(' | ')
        : '',
      VacantRatePct: f.vacantRatePct || 100,
    }));

    // Prepare Monthly_Transactions data
    const txData = transactions.map(t => ({
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

    // Create workbook and write Customer_Details
    // Read existing file to preserve Config sheet
    const customerPath = path.join(__dirname, 'ui', 'data', 'Customer_Details.xlsx');
    let wb1;
    try {
      wb1 = XLSX.readFile(customerPath);
    } catch (err) {
      wb1 = XLSX.utils.book_new();
    }

    // Update Sheet1 with new data
    const ws1 = XLSX.utils.json_to_sheet(masterData);
    if (wb1.Sheets['Sheet1']) {
      delete wb1.Sheets['Sheet1'];
      wb1.SheetNames = wb1.SheetNames.filter(name => name !== 'Sheet1');
    }
    XLSX.utils.book_append_sheet(wb1, ws1, 'Sheet1');
    XLSX.writeFile(wb1, customerPath);
    console.log('Saved Customer_Details.xlsx');

    // Create workbook and write Monthly_Transactions
    const wb2 = XLSX.utils.book_new();
    const ws2 = XLSX.utils.json_to_sheet(txData);
    XLSX.utils.book_append_sheet(wb2, ws2, 'Sheet1');
    const txPath = path.join(__dirname, 'ui', 'data', 'Monthly_Transactions.xlsx');
    XLSX.writeFile(wb2, txPath);
    console.log('Saved Monthly_Transactions.xlsx');

    res.json({ success: true, message: 'Files updated successfully' });
  } catch (error) {
    console.error('Error saving files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Open http://localhost:3000 in your browser');
});
