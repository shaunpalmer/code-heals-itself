import sqlite3

conn = sqlite3.connect('artifacts/envelopes.db')
cursor = conn.cursor()

print("=" * 60)
print("DATABASE SCHEMA")
print("=" * 60)
print()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

print("Tables:")
for table in tables:
    print(f"  - {table[0]}")
print()

# Check success_patterns table structure
print("success_patterns table:")
cursor.execute("PRAGMA table_info(success_patterns)")
columns = cursor.fetchall()
for col in columns:
    print(f"  - {col[1]} ({col[2]})")
print()

# Show the latest pattern with all fields
print("Latest success pattern:")
cursor.execute("SELECT * FROM success_patterns ORDER BY last_success DESC LIMIT 1")
latest = cursor.fetchone()
if latest:
    col_names = [desc[0] for desc in cursor.description]
    for name, value in zip(col_names, latest):
        print(f"  {name}: {value}")

conn.close()
