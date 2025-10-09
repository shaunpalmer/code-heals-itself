"""
Buggy test script for live healing demonstration
This has several intentional errors for ai-debugging.py to fix
"""

# Error 1: Missing import (will cause NameError)
def process_data():
    df = pandas.DataFrame({'a': [1, 2, 3]})  # pandas not imported
    return df

# Error 2: Syntax error
def calculate_sum()
    numbers = [1, 2, 3, 4, 5]  # Missing colon
    return sum(numbers)

# Error 3: Type error with None
def get_user_name(user):
    return user.name.upper()  # Will fail if user is None

# Run the buggy functions
if __name__ == "__main__":
    print("Starting buggy test...")
    
    # This will trigger healing
    result = process_data()
    print(f"Data: {result}")
    
    total = calculate_sum()
    print(f"Sum: {total}")
    
    name = get_user_name(None)
    print(f"Name: {name}")
    
    print("Done!")
