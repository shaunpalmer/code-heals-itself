"""
💀 PHP NIGHTMARE CONVERTED TO PYTHON
=====================================

This replicates the PHP nightmare scenario in Python:
- Import confusion (module vs class name mismatch)
- Private method access (singleton pattern violated)
- Null-object pattern masking failures
- Mixed data shapes from multiple providers
- Division by zero in aggregation logic
- Cross-platform import behavior differences

NO SYNTAX ERRORS - Pure logic/OOP/semantic bugs
Expected: 3-6 attempts, requires understanding:
  - Import system semantics
  - Singleton pattern enforcement
  - Null object pattern anti-pattern
  - Data normalization across providers
  - Safe aggregation math
"""

from typing import Protocol, List, Dict, Any
from abc import ABC, abstractmethod


# ============================================================================
# CONTRACTS
# ============================================================================

class PaymentPort(Protocol):
    """Interface for payment settlement providers"""
    def fetch_settlements(self) -> List[Dict[str, Any]]:
        """Returns list of settlements with amount, currency, ok status"""
        ...


# ============================================================================
# ADAPTERS
# ============================================================================

class PaymentsAdapter:  # Bug 1: Class name is PaymentsAdapter but should be PaymentAdapter
    """Real payment adapter - implements singleton pattern"""
    _instance = None
    
    def __init__(self):  # Bug 2: Constructor should be private (prefix with _)
        """Bug: This should be private/protected"""
        pass
    
    @classmethod
    def get_instance(cls):
        """Proper way to get singleton instance"""
        if cls._instance is None:
            cls._instance = cls.__new__(cls)
        return cls._instance
    
    def fetch_settlements(self) -> List[Dict[str, Any]]:
        """Simulates fetching from 3 providers with inconsistent schemas"""
        return [
            # Provider A - standard format
            {'amount': 1200, 'currency': 'USD', 'ok': True, 'provider': 'A'},
            # Provider B - negative (refund)
            {'amount': -120, 'currency': 'USD', 'ok': False, 'provider': 'B'},
            # Provider C - snake_case variant (common in real integrations)
            {'amount_cents': 3000, 'currency': 'usd', 'success': True, 'source': 'C'},
        ]


class NullAdapter:
    """Bug 3: Shadow fallback that hides real failures"""
    def fetch_settlements(self) -> List[Dict[str, Any]]:
        return []  # Silently returns empty - "works" but wrong


# ============================================================================
# REGISTRY (Service Locator Pattern)
# ============================================================================

class ServiceRegistry:
    """Bug 4: Multiple issues in service resolution"""
    
    @staticmethod
    def payment() -> PaymentPort:
        # Bug 5: Tries to import PaymentAdapter but class is PaymentsAdapter
        try:
            # This would work if class name matched
            from __main__ import PaymentAdapter  # Wrong name!
            # Bug 6: Directly instantiates instead of calling get_instance()
            return PaymentAdapter()  # Violates singleton pattern
        except (ImportError, AttributeError):
            # Bug 7: Silently falls back to NullAdapter, masking the real problem
            return NullAdapter()


# ============================================================================
# AGGREGATOR (Business Logic)
# ============================================================================

class SettlementAggregator:
    """Bug 8: Aggregation logic with multiple issues"""
    
    @staticmethod
    def collate(port: PaymentPort) -> Dict[str, Any]:
        """Collates settlements from multiple providers"""
        rows = port.fetch_settlements()
        
        # Normalize mixed data shapes
        normalized = []
        for r in rows:
            # Bug 9: Doesn't handle missing keys gracefully
            amount = r.get('amount', r.get('amount_cents', 0))
            
            # Bug 10: Forgets to convert cents to dollars
            if 'amount_cents' in r:
                amount = amount / 100  # Should use // for integer division
            
            ok = r.get('ok', r.get('success', False))
            provider = r.get('provider', r.get('source', 'unknown'))
            
            # Bug 11: Doesn't normalize currency case
            currency = r.get('currency', 'USD')
            
            normalized.append({
                'amount': amount,
                'ok': ok,
                'provider': provider,
                'currency': currency
            })
        
        # Calculate totals
        total = sum(item['amount'] for item in normalized)
        denom = len(normalized)
        ok_count = sum(1 for item in normalized if item['ok'])
        
        # Bug 12: CRITICAL - Division by zero when NullAdapter returns empty list
        ok_ratio = ok_count / denom  # Crashes if denom == 0!
        
        return {
            'total': total,
            'ok_ratio': ok_ratio
        }


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def run_payment_aggregation():
    """Main entry point that triggers the cascade of bugs"""
    port = ServiceRegistry.payment()
    result = SettlementAggregator.collate(port)
    
    print(f"TOTAL=${result['total']:.2f} OK_RATIO={result['ok_ratio']:.2%}")
    
    # Expected output with correct code:
    # TOTAL=$40.80 OK_RATIO=66.67%
    # (1200 - 120 + 30 = 1110 cents = $11.10, then divide properly)
    
    return result


if __name__ == "__main__":
    try:
        result = run_payment_aggregation()
        print("\n✅ Success!")
        print(f"Result: {result}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
