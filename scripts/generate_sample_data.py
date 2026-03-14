"""
Generates sample Customer_Details.csv and Monthly_Transactions.csv plus XLSX exports
for the Apartment Maintenance Management System demo.

Usage:
  python -m venv .venv
  .\\.venv\\Scripts\\activate
  pip install pandas openpyxl
  python scripts/generate_sample_data.py

Outputs (in `out/`):
  Customer_Details.csv
  Customer_Details.xlsx
  Monthly_Transactions.csv
  Monthly_Transactions.xlsx
  validation_report.txt

Notes:
- Deterministic (seeded) generation for reproducibility.
- MonthlyAmount_2025 stored in master; Monthly_Transactions references applicable amount.
- Dates use Indian format DD-MM-YYYY.
"""

import random
from datetime import datetime
from pathlib import Path

import pandas as pd

OUT_DIR = Path("out")
OUT_DIR.mkdir(exist_ok=True)

YEAR = 2025
MONTHS = [
    ("JAN", 1), ("FEB", 2), ("MAR", 3), ("APR", 4), ("MAY", 5), ("JUN", 6),
    ("JUL", 7), ("AUG", 8), ("SEP", 9), ("OCT", 10), ("NOV", 11), ("DEC", 12)
]

APARTMENT_TYPE_RULES = [
    (101, 130, "1BHK", 2500),
    (131, 180, "2BHK", 3000),
    (181, 200, "3BHK", 4000),
]

OWNER_NAMES = [
    "Arun Kumar","Priya Sharma","Rohan Patel","Sonia Mehta","Vivek Gupta",
    "Neha Singh","Amit Desai","Kavita Rao","Rahul Verma","Smita Nair",
    "Suresh Pillai","Ritu Kapoor","Manish Joshi","Pooja Iyer","Kiran Menon",
    "Anjali Khanna","Deepak Chawla","Shreya Bose","Nikhil Reddy","Geeta Balan",
    "Sachin Rao","Leena Thomas","Pradeep Kaur","Meera Nair","Vikram Shah",
    "Naveen Kumar","Priyanka Das","Aakash Sharma","Divya Singh","Arjun Bose",
    "Gaurav Jain","Sana Ahmed","Madan Lal","Anita Ghosh","Kamal Gupta",
    "Radhika Sen","Harish Patel","Isha Varma","Kartikeya Rao","Bhavna Joshi",
    "Siddharth Gupta","Rina Dutta","Anoop Menon","Shalini Verma","Tarun Iyer",
    "Maya Kapoor","Yash Shah","Radha Nair","Vikram Anand","Suhasini Rao",
    "Rakesh Singh","Priti Sharma","Dinesh Patel","Sunita Desai","Ashok Kumar",
    "Kavya Menon","Nitin Joshi","Simran Kaur","Vikrant Rao","Shweta Verma",
    "Aman Dhawan","Lata Iyer","Mohit Malhotra","Rekha Thakur","Aditya Saini",
    "Bhavya Gupta","Chetan Reddy","Diya Kapoor","Eshan Bhatia","Falguni Sen",
    "Girish Kumar","Hema Rao","Imran Khan","Jaya Nair","Kabir Mehra",
    "Lalit Jain","Manu Sharma","Nisha Bhattacharya","Omkar Deshmukh","Pavan Kumar",
    "Qudsia Begum","Ritu Malhotra","Sameer Khan","Tanya Roy","Uday Singh",
    "Varun Chopra","Wamiqa Ansari","Xavier D'Souza","Yogesh Nair","Zoya Khan",
]

TENANT_NAMES = [
    "Rahul Tripathi","Sneha Rao","Vikram Das","Madhuri Yadav","Ankur Singh",
    "Kriti Sharma","Rohit Kapoor","Sana Mehta","Ritu Jain","Om Prakash",
]

BLOCKS = ["A","B","C","D"]
FLOORS = ["G"] + list(range(1, 11))

random.seed(12345)


def flat_range():
    for n in range(101, 201):
        yield f"A-{n}"


def apartment_type_for_flat(n):
    for start, end, typ, amt in APARTMENT_TYPE_RULES:
        if start <= n <= end:
            return typ, amt
    return "2BHK", 3000

# Build Customer_Details
customers = []
phones_used = set()
for idx, flat in enumerate(flat_range()):
    n = 101 + idx
    owner = OWNER_NAMES[idx % len(OWNER_NAMES)]
    tenant = "" if (idx % 7) else random.choice(TENANT_NAMES)
    while True:
        prefix = random.choice([98, 97, 96, 95])
        phone = f"{prefix}{random.randint(10000000,99999999):08d}"
        if phone not in phones_used:
            phones_used.add(phone)
            break
    email = ""
    if (idx % 5) != 0:
        email_local = owner.split()[0].lower() + str(random.randint(1,99))
        email = f"{email_local}@example.com"
    block = BLOCKS[(idx // 25) % len(BLOCKS)]
    floor = FLOORS[(idx % len(FLOORS))]
    apt_type, monthly_amt = apartment_type_for_flat(n)
    customers.append({
        "FlatNo": flat.replace("-", ""),
        "FlatNoDisplay": flat,
        "OwnerName": owner,
        "TenantName": tenant,
        "Phone": phone,
        "Email": email,
        "Block": block,
        "Floor": str(floor),
        "ApartmentType": apt_type,
        "MonthlyAmount_2025": monthly_amt,
        "AmountEffectiveFrom": "01-01-2025",
        "Status": "Active",
    })

master_cols = [
    "FlatNo", "FlatNoDisplay", "OwnerName", "TenantName", "Phone", "Email",
    "Block", "Floor", "ApartmentType", "MonthlyAmount_2025", "AmountEffectiveFrom", "Status"
]
master_df = pd.DataFrame([{k: c[k] for k in master_cols} for c in customers])
master_df.to_csv(OUT_DIR / "Customer_Details.csv", index=False)
master_df.to_excel(OUT_DIR / "Customer_Details.xlsx", index=False)

# Monthly_Transactions
transactions = []
for c_idx, c in enumerate(customers):
    flat_no = c["FlatNo"]
    owner = c["OwnerName"]
    phone = c["Phone"]
    monthly_amount = int(c["MonthlyAmount_2025"])

    pending = 0
    combine_pattern = (c_idx % 13 == 0)
    miss_pattern = (c_idx % 11 == 0)

    for m_idx, (m_name, m_num) in enumerate(MONTHS, start=1):
        pending += monthly_amount
        paid = True
        if miss_pattern and (m_idx % 5 == 0):
            paid = False
        elif (m_idx + c_idx) % 4 == 0:
            paid = False

        payment_amount = ""
        payment_date = ""
        payment_mode = ""

        if combine_pattern and (m_idx % 4 == 0):
            payment_amount = pending
            day = 5 + ((c_idx + m_idx) % 20)
            payment_date = f"{day:02d}-{m_num:02d}-{YEAR}"
            payment_mode = random.choice(["UPI", "Cash", "Bank"])
            pending = 0
            payment_status = "Paid"
        elif paid:
            payment_amount = monthly_amount
            day = 3 + ((c_idx + m_idx) % 25)
            payment_date = f"{day:02d}-{m_num:02d}-{YEAR}"
            payment_mode = random.choice(["UPI", "Cash", "Bank"])
            pending -= monthly_amount
            if pending < 0:
                pending = 0
            payment_status = "Paid"
        else:
            payment_status = "Not Paid"
            payment_amount = ""
            payment_date = ""
            payment_mode = ""

        pending_amount = int(pending)
        txn_id = f"APT{YEAR}-{m_name}-{flat_no}-{m_idx:03d}"
        remarks = ""
        if combine_pattern and (m_idx % 4 == 0):
            remarks = "Combined payment - cleared previous dues"

        transactions.append({
            "TransactionID": txn_id,
            "FlatNo": flat_no,
            "OwnerName": owner,
            "Phone": phone,
            "Month": m_name,
            "Year": YEAR,
            "PaymentStatus": payment_status,
            "PaymentMode": payment_mode,
            "PaymentAmount": payment_amount,
            "PaymentDate": payment_date,
            "PendingAmount": pending_amount,
            "Remarks": remarks,
            "MonthlyAmount": monthly_amount,
        })

import pandas as pd

txn_df = pd.DataFrame(transactions)
txn_df.to_csv(OUT_DIR / "Monthly_Transactions.csv", index=False)
txn_df.to_excel(OUT_DIR / "Monthly_Transactions.xlsx", index=False)

# Validation report
validation = []
flatnos = master_df["FlatNo"].tolist()
validation.append(("Unique flats in Customer_Details", len(flatnos) == len(set(flatnos)), len(flatnos)))
expected_txns = 100 * 12
validation.append(("Transaction rows", len(txn_df) == expected_txns, len(txn_df)))
validation.append(("Unique TransactionID", txn_df["TransactionID"].nunique() == len(txn_df), txn_df["TransactionID"].nunique()))

sample_ok = True
for i in range(10):
    f = master_df.iloc[i]
    tx = txn_df[txn_df["FlatNo"] == f["FlatNo"]]
    if not (tx["OwnerName"].unique().tolist() == [f["OwnerName"]]):
        sample_ok = False
        break
validation.append(("OwnerName consistent for first 10 flats", sample_ok, None))
validation.append(("Pending non-negative", (txn_df["PendingAmount"] >= 0).all(), int((txn_df["PendingAmount"] < 0).sum())))

with open(OUT_DIR / "validation_report.txt", "w", encoding="utf-8") as vf:
    vf.write(f"Validation Report - Generated {datetime.utcnow().isoformat()} UTC\n")
    vf.write("YEAR: %d\n" % YEAR)
    vf.write("Expected transactions: %d\n\n" % expected_txns)
    for name, ok, val in validation:
        vf.write(f"{name}: {'PASS' if ok else 'FAIL'}")
        if val is not None:
            vf.write(f" (value: {val})")
        vf.write("\n")

print("Generation complete. Files in out/.")
