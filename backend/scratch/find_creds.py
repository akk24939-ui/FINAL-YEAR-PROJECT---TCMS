import psycopg2, os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

print("=== SHOPS ===")
cur.execute("SELECT shop_code, name FROM shops LIMIT 5")
for row in cur.fetchall():
    print(f"  {row[0]} | {row[1]}")

print("\n=== USERS (operators) ===")
cur.execute("SELECT u.id, u.full_name, u.email, s.shop_code FROM users u JOIN shops s ON s.operator_id = u.id LIMIT 5")
for row in cur.fetchall():
    print(f"  {row[3]} | {row[2]} | id={str(row[0])[:8]}...")

print("\n=== CONSUMERS (first 3) ===")
cur.execute("SELECT u.email, u.full_name FROM users u WHERE u.role='CONSUMER' LIMIT 3")
for row in cur.fetchall():
    print(f"  {row[0]} | {row[1]}")

conn.close()
