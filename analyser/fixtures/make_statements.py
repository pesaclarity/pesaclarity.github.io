"""Writes the analyser's extra synthetic statement PDFs.

Every name, number and receipt is made up; never put real data here, and
never a real statement.

It lays the rows out with the app's own fixture writer
(pesaclarity-app tool/fixtures/statement_pdfs.py), so the layout is the one
the app's tests use:

    pip install reportlab==5.0.1 pypdf==6.17.0
    python3 analyser/fixtures/make_statements.py PATH_TO_PESACLARITY_APP

Writes mpesa_month.pdf and mpesa_month_locked.pdf (AES-128, password 4321)
next to this file. The app's own synthetic statements are copied here
unchanged by the same command.
"""

import importlib.util
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# (receipt, time, details, signed amount in cents), oldest first. Charges
# share their transaction's receipt and time, as M-Pesa prints them.
MONTH = [
    ("TJB0000101", "2026-10-01 07:40:12", "Funds received from - 0700***010 EXAMPLE EMPLOYER LTD", 4500000),
    ("TJB0000102", "2026-10-01 09:02:31", "Pay Bill Online to 888880 - KENYA POWER Acc. 12345678901", -250000),
    ("TJB0000103", "2026-10-01 12:15:00", "Merchant Payment Online to 5000001 - EXAMPLE GROCERS", -183550),
    ("TJB0000104", "2026-10-02 08:10:45", "Buy Bundles Online", -10000),
    ("TJB0000105", "2026-10-02 18:30:20", "Customer Transfer to - 0700***011 MARY WANJIKU", -300000),
    ("TJB0000105", "2026-10-02 18:30:20", "Customer Transfer of Funds Charge", -3300),
    ("TJB0000106", "2026-10-03 07:05:00", "Merchant Payment Online to 5000002 - DEMO FUEL STATION", -350000),
    ("TJB0000107", "2026-10-04 13:20:11", "Customer Withdrawal At Agent Till 300001 - EXAMPLE AGENT SHOP", -500000),
    ("TJB0000107", "2026-10-04 13:20:11", "Withdrawal Charge", -2900),
    ("TJB0000108", "2026-10-05 10:00:00", "Pay Bill Online to 222111 - DEMO WATER CO Acc. W-0042", -120000),
    ("TJB0000109", "2026-10-06 19:45:33", "Merchant Payment Online to 5000003 - SAMPLE CAFE", -65000),
    ("TJB0000110", "2026-10-07 08:01:02", "Airtime Purchase", -5000),
    ("TJB0000111", "2026-10-08 17:12:40", "Funds received from - 0700***012 PETER OTIENO", 150000),
    ("TJB0000112", "2026-10-09 12:30:00", "Merchant Payment Online to 5000001 - EXAMPLE GROCERS", -96500),
    ("TJB0000113", "2026-10-10 09:15:42", "Pay Bill Online to 333222 - DEMO SCHOOL FEES Acc. ADM-77", -1500000),
    ("TJB0000114", "2026-10-11 20:05:10", "Merchant Payment Online to 5000004 - EXAMPLE PHARMACY", -42000),
    ("TJB0000115", "2026-10-12 07:50:00", "Merchant Payment Online to 5000002 - DEMO FUEL STATION", -300000),
    ("TJB0000116", "2026-10-13 14:22:18", "Customer Transfer to - 0700***013 JAMES MWANGI", -100000),
    ("TJB0000116", "2026-10-13 14:22:18", "Customer Transfer of Funds Charge", -1300),
    ("TJB0000117", "2026-10-14 11:11:11", "Pay Bill Online to 444333 - DEMO INTERNET LTD Acc. 55501", -299900),
    ("TJB0000118", "2026-10-15 16:40:00", "Merchant Payment Online to 5000005 - SAMPLE BUTCHERY", -78000),
    ("TJB0000119", "2026-10-16 08:35:27", "Buy Bundles Online", -10000),
    ("TJB0000120", "2026-10-18 10:10:10", "Merchant Payment Online to 5000001 - EXAMPLE GROCERS", -142075),
    ("TJB0000121", "2026-10-19 21:30:45", "Merchant Payment Online to 5000006 - DEMO TAXI RIDES", -45000),
    ("TJB0000122", "2026-10-20 13:00:00", "Funds received from - 0700***014 GRACE ACHIENG", 200000),
    ("TJB0000123", "2026-10-21 09:45:00", "Pay Bill Online to 555444 - SAMPLE SACCO Acc. M-1001", -500000),
    ("TJB0000124", "2026-10-22 18:05:33", "Customer Withdrawal At Agent Till 300002 - DEMO MINI MART", -200000),
    ("TJB0000124", "2026-10-22 18:05:33", "Withdrawal Charge", -2900),
    ("TJB0000125", "2026-10-24 12:12:12", "Merchant Payment Online to 5000003 - SAMPLE CAFE", -38000),
    ("TJB0000126", "2026-10-25 07:30:00", "Merchant Payment Online to 5000002 - DEMO FUEL STATION", -250000),
    ("TJB0000127", "2026-10-27 15:15:15", "Pay Bill Online to 666555 - DEMO INSURANCE Acc. POL-9", -180000),
    ("TJB0000128", "2026-10-28 08:08:08", "Airtime Purchase", -10000),
    ("TJB0000129", "2026-10-29 19:19:19", "Merchant Payment Online to 5000001 - EXAMPLE GROCERS", -211040),
    ("TJB0000130", "2026-10-30 10:30:00", "Customer Transfer to - 0700***011 MARY WANJIKU", -250000),
    ("TJB0000130", "2026-10-30 10:30:00", "Customer Transfer of Funds Charge", -3300),
]
MONTH_OPENING = 1250000  # cents


def money(cents):
    sign = "-" if cents < 0 else ""
    whole, part = divmod(abs(cents), 100)
    return f"{sign}{whole:,}.{part:02d}"


def mpesa_rows(rows, opening):
    """The app writer's ROWS: newest first, with running balances."""
    out, balance = [], opening
    for receipt, time, details, cents in rows:
        balance += cents
        paid_in = money(cents) if cents > 0 else ""
        withdrawn = money(cents) if cents < 0 else ""
        out.append((receipt, time, details, paid_in, withdrawn, money(balance)))
    return out[::-1]


def main(app):
    spec = importlib.util.spec_from_file_location(
        "statement_pdfs", Path(app) / "tool" / "fixtures" / "statement_pdfs.py")
    writer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(writer)

    for name in ("synthetic_statement.pdf", "synthetic_statement_locked.pdf",
                 "synthetic_kcb_statement.pdf", "synthetic_kcb_statement_locked.pdf"):
        shutil.copyfile(Path(app) / "test" / "fixtures" / name, HERE / name)

    writer.ROWS = mpesa_rows(MONTH, MONTH_OPENING)
    plain = HERE / "mpesa_month.pdf"
    writer.build(plain, lines_on_first_page=24)
    writer.encrypt(plain, HERE / "mpesa_month_locked.pdf", "4321")


if __name__ == "__main__":
    main(sys.argv[1])
