"""
Data loader for CollectIQ collections pack.
Loads CSV files, validates schema, parses dates, returns typed collections.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import pandas as pd

from src.models import Customer, Invoice, Payment, Email

DATA_DIR = Path(__file__).parent.parent / "data"


def _load_csv(filename: str) -> pd.DataFrame:
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    df = pd.read_csv(path, dtype=str)
    df = df.where(pd.notna(df), None)
    return df


def load_customers() -> dict[str, Customer]:
    df = _load_csv("customers.csv")
    customers: dict[str, Customer] = {}
    for _, row in df.iterrows():
        c = Customer(
            customer_id=row["customer_id"],
            customer_name=row["customer_name"],
            contact_email=row["contact_email"],
            sales_rep=row["sales_rep"],
            controller_email=row["controller_email"],
            ceo_email=row["ceo_email"],
            owner_email=row["owner_email"],
            industry=row["industry"],
            payment_terms_days=int(row["payment_terms_days"]),
        )
        customers[c.customer_id] = c
    return customers


def load_invoices() -> dict[str, Invoice]:
    df = _load_csv("invoices.csv")
    invoices: dict[str, Invoice] = {}
    for _, row in df.iterrows():
        inv = Invoice(
            invoice_id=row["invoice_id"],
            customer_id=row["customer_id"],
            amount=float(row["amount"]),
            currency=row.get("currency") or "INR",
            issue_date=row["issue_date"],
            due_date=row["due_date"],
            description=row["description"],
        )
        invoices[inv.invoice_id] = inv
    return invoices


def load_payments() -> list[Payment]:
    df = _load_csv("payments.csv")
    payments: list[Payment] = []
    for _, row in df.iterrows():
        p = Payment(
            payment_id=row["payment_id"],
            invoice_id=row["invoice_id"],
            amount_paid=float(row["amount_paid"]),
            payment_date=row["payment_date"],
            payment_method=row["payment_method"],
            reference=row["reference"],
        )
        payments.append(p)
    return payments


def load_emails() -> list[Email]:
    df = _load_csv("emails.csv")
    emails: list[Email] = []
    for _, row in df.iterrows():
        e = Email(
            email_id=row["email_id"],
            customer_id=row["customer_id"],
            from_email=row["from_email"],
            subject=row["subject"],
            body=row["body"],
            received_date=row["received_date"],
            invoice_ref=row.get("invoice_ref") or None,
        )
        emails.append(e)
    return emails


class CollectionsData:
    """
    Central holder for all collections data. Provides point-in-time filtering.
    """

    def __init__(self) -> None:
        self.customers = load_customers()
        self.invoices = load_invoices()
        self.payments = load_payments()
        self.emails = load_emails()

    def invoices_known_at(self, as_of: "date") -> dict[str, Invoice]:  # type: ignore[name-defined]
        """Return only invoices issued on or before as_of."""
        from datetime import date as dt
        return {
            k: v for k, v in self.invoices.items()
            if v.issue_date <= (as_of if isinstance(as_of, dt) else dt.fromisoformat(str(as_of)))
        }

    def payments_known_at(self, as_of: "date") -> list[Payment]:  # type: ignore[name-defined]
        """Return only payments received on or before as_of."""
        from datetime import date as dt
        cutoff = as_of if isinstance(as_of, dt) else dt.fromisoformat(str(as_of))
        return [p for p in self.payments if p.payment_date <= cutoff]

    def emails_known_at(self, as_of: "date") -> list[Email]:  # type: ignore[name-defined]
        """Return only emails received on or before as_of."""
        from datetime import date as dt
        cutoff = as_of if isinstance(as_of, dt) else dt.fromisoformat(str(as_of))
        return [e for e in self.emails if e.received_date <= cutoff]

    def get_invoice_payments(self, invoice_id: str, as_of: "date") -> list[Payment]:  # type: ignore[name-defined]
        return [p for p in self.payments_known_at(as_of) if p.invoice_id == invoice_id]

    def get_customer_emails(self, customer_id: str, as_of: "date") -> list[Email]:  # type: ignore[name-defined]
        return [e for e in self.emails_known_at(as_of) if e.customer_id == customer_id]
