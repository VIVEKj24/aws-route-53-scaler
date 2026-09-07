import sqlite3

c = sqlite3.connect("route53.db")
tables = c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
hz_count = c.execute("SELECT COUNT(*) FROM hosted_zones").fetchone()[0]
default_ns = c.execute("SELECT COUNT(*) FROM records WHERE is_default=1").fetchone()[0]
user = c.execute("SELECT username FROM users").fetchone()[0]
total_records = c.execute("SELECT COUNT(*) FROM records").fetchone()[0]

print("Tables:", [t[0] for t in tables])
print("hosted_zones count:", hz_count)
print("default NS records:", default_ns)
print("total records:", total_records)
print("admin user:", user)
