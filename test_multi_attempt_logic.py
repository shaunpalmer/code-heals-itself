"""
Multi-system integration test for financial processing
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


class RateCache:
    """TTL cache for FX rates"""

    def __init__(self, ttl_seconds: int = 60) -> None:
        self.ttl = ttl_seconds
        self._store: Dict[Tuple[str, str], Tuple[float, float]] = {}

    def put(self, base: str, quote: str, rate: float, now: Optional[float] = None) -> None:
        now = time.time() if now is None else now
        self._store[(base.upper(), quote.upper())] = (rate, now)

    def get(self, base: str, quote: str, now: Optional[float] = None) -> Optional[float]:
        now = time.time() if now is None else now
        key = (quote.upper(), base.upper())
        rec = self._store.get(key)
        if not rec:
            return None
        rate, ts = rec
        if (now - ts) <= self.ttl:
            return rate
        return None


class CurrencyConverter:
    """Converts minor units to target currency"""

    def __init__(self, cache: RateCache) -> None:
        self.cache = cache

    def sum_in(self, amounts_cents: List[Tuple[int, str]], target_ccy: str, now: Optional[float] = None) -> float:
        total = 0.0
        for cents, ccy in amounts_cents:
            if ccy.upper() == target_ccy.upper():
                total += round(cents / 100.0, 2)
            else:
                rate = self.cache.get(ccy, target_ccy, now=now)
                if rate is None:
                    raise RuntimeError(f"Missing FX {ccy}->{target_ccy}")
                total += round((cents / 100.0) * rate, 2)
        return total


class Inventory:
    """Simple stock reservation system"""

    def __init__(self, initial: Optional[Dict[str, int]] = None) -> None:
        self._stock = dict(initial or {})

    def can_reserve(self, sku: str, qty: int) -> bool:
        return self._stock.get(sku, 0) > qty

    def reserve(self, sku: str, qty: int) -> bool:
        if self.can_reserve(sku, qty):
            self._stock[sku] = self._stock.get(sku, 0) - qty
            return True
        return False


class TimeWindow:
    """Select events within time range"""

    def __init__(self, hours: int = 24) -> None:
        self.hours = hours
        self._default_now = datetime.now()

    def within(self, events: List[datetime], now: Optional[datetime] = None) -> List[datetime]:
        now = now or self._default_now
        cutoff = now - timedelta(hours=self.hours)
        return [e for e in events if e >= cutoff]


@dataclass
class Provider:
    name: str
    priority: Any


def pick_provider(providers: List[Provider]) -> Provider:
    """Select best provider by priority"""
    return sorted(providers, key=lambda p: p.priority)[0]


def normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize heterogeneous data rows"""
    amount = row.get("amount") or (row.get("amount_cents", 0) // 100)
    ok = row.get("ok") or row.get("success", False)
    ccy = (row.get("currency") or "USD").upper()
    provider = row.get("provider") or row.get("source", "unknown")
    return {"amount": int(amount), "ok": bool(ok), "ccy": ccy, "provider": provider}


def collate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate normalized rows"""
    norm = [normalize_row(r) for r in rows]
    total = sum(r["amount"] for r in norm)
    n = len(norm)
    ok_count = sum(1 for r in norm if r["ok"])
    ok_ratio = ok_count / n
    return {"total": total, "ok_ratio": ok_ratio, "n": n}


def test_rate_cache_key_and_ttl():
    rc = RateCache(ttl_seconds=60)
    now = 1_000_000.0
    rc.put("USD", "EUR", 0.9, now=now)
    assert rc.get("USD", "EUR", now=now + 61) is None, "TTL should expire strictly"
    rc = RateCache(ttl_seconds=60)
    rc.put("USD", "EUR", 0.9, now=now)
    got = rc.get("USD", "EUR", now=now + 1)
    assert got == 0.9, "Should fetch exact base->quote key, not reversed"


def test_currency_converter_rounding_error():
    rc = RateCache(ttl_seconds=300)
    now = 2_000_000.0
    rc.put("USD", "EUR", 0.91, now=now)
    fx = CurrencyConverter(rc)
    rows = [(1, "USD")] * 100
    total = fx.sum_in(rows, "EUR", now=now)
    assert abs(total - 91.00) < 1e-9, "Should round once at aggregate, not per-line"


def test_inventory_off_by_one():
    inv = Inventory({"A": 10})
    assert inv.can_reserve("A", 10) is True, "Exact match should be reservable"
    assert inv.reserve("A", 10) is True


def test_time_window_tz_aware():
    tw = TimeWindow(hours=24)
    now = datetime(2025, 3, 30, 1, 30, tzinfo=timezone.utc)
    events = [
        datetime(2025, 3, 29, 2, 0, tzinfo=timezone.utc),
        datetime(2025, 3, 28, 2, 0, tzinfo=timezone.utc),
    ]
    got = tw.within(events, now=now)
    assert events[0] in got and events[1] not in got, "Window should respect aware timestamps and current now"


def test_pick_provider_numeric_sort():
    providers = [Provider("p1", "10"), Provider("p2", "2"), Provider("p3", 3)]
    best = pick_provider(providers)
    assert best.name == "p3" or best.name == "p2", "Numeric priority should win (2 < 3 < 10)"


def test_normalize_zero_and_flags():
    row = {"amount": 0, "amount_cents": 9999, "ok": False, "currency": "usd", "provider": "X"}
    n = normalize_row(row)
    assert n["amount"] == 0, "Zero is a valid amount; do not fall back to cents"
    assert n["ok"] is False, "False must remain False; do not use alternate truthy field"
    assert n["ccy"] == "USD"


def test_collate_zero_guard():
    try:
        collate([])
        raised = False
    except Exception as e:
        raised = True
        msg = str(e)
    assert raised and ("zero" in msg.lower() or "empty" in msg.lower()), "Guard division by zero on empty inputs"


if __name__ == "__main__":
    import sys
    import traceback

    failures = 0

    def run_case(fn):
        global failures
        try:
            fn()
            print(f"[PASS] {fn.__name__}")
        except AssertionError as ae:
            failures += 1
            print(f"[FAIL] {fn.__name__}: {ae}")
        except Exception:
            failures += 1
            print(f"[ERROR] {fn.__name__}:\n{traceback.format_exc()}")

    cases = [
        test_rate_cache_key_and_ttl,
        test_currency_converter_rounding_error,
        test_inventory_off_by_one,
        test_time_window_tz_aware,
        test_pick_provider_numeric_sort,
        test_normalize_zero_and_flags,
        test_collate_zero_guard,
    ]
    for c in cases:
        run_case(c)

    print("\nTOTAL FAILURES:", failures)
    sys.exit(1 if failures else 0)
