"""
🔥 EXTREME DIFFICULTY TEST - Multiple Subtle Bugs
=================================================

This test intentionally combines:
1. Visual confusion (0 vs O in class name)
2. Indentation errors in nested loops
3. Missing syntax (colon)
4. Logic error (off-by-one in loop range)
5. Semantic error (wrong attribute name)
6. Type confusion (string vs int)

These bugs require REASONING, not just pattern matching.
The LLM needs to understand:
- What the code is TRYING to do
- Why it's semantically wrong
- How pieces interact

Expected: 2-4 attempts to get everything right
"""

# Bug-riddled code that's trying to simulate a simple clock with multiple timers

class Clock:
    """Tracks time in seconds"""
    def __init__(self, start=0):
        self.time = start
        self.ticks = 0
    
    def tick(self, amount=1):
        self.time += amount
        self.ticks += 1
    
    def read(self):
        return self.time
    
    def get_ticks(self):
        return self.ticks


class Timer:
    """Tracks elapsed time for a specific event"""
    def __init__(self, name):
        self.name = name
        self.elapsed = "0"  # Bug 5: Should be int, not string!
    
    def add_time(self, seconds):
        self.elapsed += seconds  # Bug 6: String concatenation! Will fail
    
    def report(self):
        return f"{self.name}: {self.elapsed}s"


def run_simulation():
    """
    Simulate 3 clocks running for different durations
    Each clock should tick multiple times
    """
    # Bug 1: Typo - Cl0ck instead of Clock (zero instead of letter O)
    main_clock = Cl0ck(5)
    
    timers = [
        Timer("Morning"),
        Timer("Afternoon"),
        Timer("Evening")
    ]
    
    # Bug 2: Missing colon after for loop
    for i in range(3)
        # Bug 3: Indentation error - inner loop not indented properly
        for j in range(2):
        # Each timer should accumulate time from clock ticks
        main_clock.tick()
        timers[i].add_time(1)
    
    # Try to read results
    print("Main clock time:", main_clock.read())
    print("Total ticks:", main_clock.get_ticks())
    
    for timer in timers:
        print(timer.report())
    
    # Bug 4: Logic error - should divide by number of timers, not hardcoded 2
    average = main_clock.read() / 2  # Wrong! Should be len(timers)
    print(f"Average time per timer: {average}s")


if __name__ == "__main__":
    run_simulation()
