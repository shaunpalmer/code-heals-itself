"""
Mid-range complexity test: Division by zero in data aggregation
This is more complex than syntax errors but not as extreme as the nightmare scenarios.
The bug involves missing guard clause for empty input lists.
"""

def normalize_row(row):
    """Normalize heterogeneous data rows"""
    amount = row.get("amount") or (row.get("amount_cents", 0) // 100)
    ok = row.get("ok") or row.get("success", False)
    ccy = (row.get("currency") or "USD").upper()
    provider = row.get("provider") or row.get("source", "unknown")
    return {"amount": int(amount), "ok": bool(ok), "ccy": ccy, "provider": provider}


def collate(rows):
    """Aggregate normalized rows - BUG: No guard for empty input"""
    norm = [normalize_row(r) for r in rows]
    total = sum(r["amount"] for r in norm)
    n = len(norm)
    ok_count = sum(1 for r in norm if r["ok"])
    ok_ratio = ok_count / n  # BUG: Division by zero when rows is empty
    return {"total": total, "ok_ratio": ok_ratio, "n": n}


def test_collate_with_data():
    """This should work fine"""
    test_data = [
        {"amount": 100, "ok": True, "currency": "USD"},
        {"amount": 50, "ok": False, "currency": "EUR"}
    ]
    result = collate(test_data)
    print("With data:", result)
    return result


def test_collate_empty():
    """This will crash with division by zero"""
    result = collate([])  # Empty list causes division by zero
    print("Empty result:", result)
    return result


if __name__ == "__main__":
    print("Testing collate function...")
    
    # This works
    test_collate_with_data()
    
    # This crashes
    test_collate_empty()