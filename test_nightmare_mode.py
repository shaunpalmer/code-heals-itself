"""
💀 NIGHTMARE MODE - Requires Deep Reasoning
==========================================

This code has bugs that require understanding:
- Algorithm correctness (not just syntax)
- Data structure invariants
- Race conditions (simulated)
- Mathematical correctness
- State machine logic

Expected: 4-6 attempts, might not even fix completely
"""

import threading
import time

class BankAccount:
    """Simple bank account with flawed concurrent access"""
    def __init__(self, initial_balance):
        self.balance = initial_balance
        self.lock = threading.Lock()  # Present but UNUSED!
    
    def deposit(self, amount):
        # Bug 1: No lock! Race condition in concurrent environment
        current = self.balance
        time.sleep(0.001)  # Simulate processing delay
        self.balance = current + amount
    
    def withdraw(self, amount):
        # Bug 2: Also no lock, AND wrong logic
        if self.balance > amount:  # Bug 3: Should be >= not >
            current = self.balance
            time.sleep(0.001)
            self.balance = current - amount
            return True
        return False


class Transaction:
    """Represents a financial transaction"""
    def __init__(self, from_account, to_account, amount):
        self.from_acc = from_account
        self.to_acc = to_account
        self.amount = amount
        self.status = "pending"
    
    def execute(self):
        # Bug 4: No atomicity! Partial transaction possible
        if self.from_acc.withdraw(self.amount):
            self.to_acc.deposit(self.amount)
            self.status = "completed"
            return True
        return False


def stress_test_accounts():
    """
    Create accounts and hammer them with concurrent transactions
    Expected: All transactions should complete without data corruption
    Actual: Will have race conditions and incorrect balances
    """
    
    # Bug 5: Missing colon (syntax)
    acc1 = BankAccount(1000)
    acc2 = BankAccount(500)
    
    transactions = []
    threads = []
    
    # Bug 6: Range is wrong - creates 11 transactions instead of 10
    for i in range(11):  # Bug: Should be range(10)
        # Alternate between accounts
        if i % 2 = 0:  # Bug 7: Using = instead of ==
            tx = Transaction(acc1, acc2, 50)
        else
            tx = Transaction(acc2, acc1, 30)  # Bug 8: Missing colon above
        
        transactions.append(tx)
    
    # Execute all transactions concurrently (exposes race conditions)
    for tx in transactions:
        t = threading.Thread(target=tx.execute)
        threads.append(t)
        t.start()
    
    # Wait for completion
    for t in threads:
        t.join()
    
    # Check results - will be WRONG due to race conditions
    print(f"Account 1 balance: {acc1.balance}")
    print(f"Account 2 balance: {acc2.balance}")
    
    total = acc1.balance + acc2.balance
    expected = 1500  # Original sum
    
    print(f"Total: {total}, Expected: {expected}")
    
    # Bug 9: Logic error - wrong assertion
    if total = expected:  # Bug: Using = instead of ==
        print("✅ Conservation of money maintained!")
    else:
        # Bug 10: Wrong calculation - should be abs(total - expected)
        error = total - expected
        print(f"❌ Lost ${error} due to race conditions!")


def fibonacci_memoized(n, memo={}):
    """
    Calculate Fibonacci with memoization
    Bug 11: Mutable default argument! memo={} shared across calls
    Bug 12: Missing base cases
    """
    if n in memo:
        return memo[n]
    
    # Bug 12: Missing if n <= 1: return n
    
    # Bug 13: Wrong recursion - will infinite loop
    result = fibonacci_memoized(n, memo) + fibonacci_memoized(n-2, memo)
    memo[n] = result
    return result


class StateMachine:
    """Simple state machine with transition bugs"""
    def __init__(self):
        self.state = "idle"
        self.transitions = {
            "idle": ["running"],
            "running": ["paused", "stopped"],
            "paused": ["running", "stopped"],
            "stopped": []
        }
    
    def transition(self, new_state):
        # Bug 14: No validation! Can transition to invalid states
        self.state = new_state
        return True
    
    def can_transition(self, new_state):
        # Bug 15: Wrong check - should be 'in', not '=='
        if new_state == self.transitions.get(self.state, []):
            return True
        return False


def run_all_tests():
    """Run all buggy code"""
    print("=" * 70)
    print("💀 NIGHTMARE MODE TEST SUITE")
    print("=" * 70)
    print()
    
    print("Test 1: Concurrent bank transactions")
    try
        stress_test_accounts()  # Bug 16: Missing colon
    except Exception as e:
        print(f"CRASHED: {e}")
    
    print("\nTest 2: Fibonacci with memoization")
    try:
        result = fibonacci_memoized(5)
        print(f"fib(5) = {result}")
    except Exception as e:
        print(f"CRASHED: {e}")
    
    print("\nTest 3: State machine")
    try:
        sm = StateMachine()
        sm.transition("invalid_state")  # Should fail but won't!
        print(f"State: {sm.state}")
    except Exception as e:
        print(f"CRASHED: {e}")


if __name__ == "__main__":
    run_all_tests()
