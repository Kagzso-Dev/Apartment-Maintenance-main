Apartment Maintenance Dashboard - Glassmorphism UI with Node.js Backend

=== PROJECT STRUCTURE ===
Apartment Maintance/
├── server.js                  # Node.js Express server for Excel file operations
├── package.json               # Node.js dependencies
├── ui/

│   ├── index.html            # Main application UI
│   ├── data/
│   │   ├── Customer_Details.xlsx     # Flat details and Config
│   │   └── Monthly_Transactions.xlsx # Payment transactions
│   ├── images/
│   │   └── kagzso-logo.svg  # Company logo
│   ├── scripts/
│   │   ├── dashboard.js      # Main application logic
│   │   ├── xlsxLoader.js     # Excel file loader
│   │   └── vendor/
│   │       └── xlsx.min.js   # SheetJS library
│   └── styles/
│       └── glass.css         # Glassmorphism styling
├── scripts/
│   └── generate_sample_data.py  # Python data generator
└── out/                      # Generated files (ignored by git)

=== SETUP & RUN ===

1. Install Dependencies:
   cd "C:\Users\karth\OneDrive\Desktop\Apartment Maintance"
   npm install

2. Start the Server:
   npm start
   # Server runs at http://localhost:3000

3. Open in Browser:
   Navigate to http://localhost:3000

=== FILE PATH CONFIGURATION ===

The application uses two file path systems:

Client-side (Browser - dashboard.js):
  - Uses relative paths: ./data/Customer_Details.xlsx
  - Relative to ui/index.html location
  - Browser fetches: ui/data/Customer_Details.xlsx

Server-side (Node.js - server.js):
  - Uses path.join(__dirname, 'ui', 'data', 'Customer_Details.xlsx')
  - __dirname = directory where server.js is located
  - Builds absolute path: C:\...\Apartment Maintance\ui\data\Customer_Details.xlsx

REQUIRED FILE LOCATIONS:
  ✓ ui/data/Customer_Details.xlsx
  ✓ ui/data/Monthly_Transactions.xlsx

Both files MUST be in ui/data/ folder for the app to work!

=== FEATURES ===

- Glassmorphism UI with responsive design
- Real-time Excel file updates (no download/upload)
- Filter by: All, Paid, Pending, Partial
- Pending months calculation
- Invoice/Bill printing for paid transactions
- Mobile-optimized view (hides admin features)
- Kagzso branding with logo

=== DATA STRUCTURE ===

Customer_Details.xlsx:
  - Config Sheet: ApartmentName, Address, Phone
  - Sheet1: FlatNo, OwnerName, PaymentMode, etc.

Monthly_Transactions.xlsx:
  - Sheet1: TransactionID, FlatNo, PaymentDate, AmountDue, AmountPaid, PaymentStatus

Notes:
- Dates are in DD-MM-YYYY format
- Transaction IDs: APT2025-<MONTH>-<FLATNO>-<SEQ>
- Monthly amounts stored in Customer_Details
- Server preserves Config sheet when updating data
