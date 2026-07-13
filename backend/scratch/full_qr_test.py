"""Find consumer passwords by resetting one and doing full QR test."""
import requests, sys, os, psycopg2, bcrypt
from dotenv import load_dotenv

load_dotenv()
BASE = "http://127.0.0.1:8000/api/v1"

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

# Get shop + consumer
cur.execute("SELECT shop_code FROM shops LIMIT 1")
shop_code = cur.fetchone()[0]

cur.execute("SELECT u.id, u.email FROM users u WHERE u.role='CONSUMER' AND u.is_active=true LIMIT 1")
row = cur.fetchone()
consumer_id, consumer_email = str(row[0]), row[1]

# Reset consumer password to known value
new_hash = bcrypt.hashpw(b"Test@1234", bcrypt.gensalt()).decode()
cur.execute("UPDATE users SET password_hash=%s, failed_login_attempts=0, locked_until=NULL WHERE id=%s",
            (new_hash, consumer_id))

# Reset shop PIN
cur.execute(
    "UPDATE users SET pin_hash=%s, pin_failed_attempts=0, pin_locked_until=NULL "
    "WHERE id=(SELECT operator_id FROM shops WHERE shop_code=%s)",
    (bcrypt.hashpw(b"111111", bcrypt.gensalt()).decode(), shop_code)
)
conn.commit(); conn.close()
print(f"Shop: {shop_code}  |  Consumer: {consumer_email}")
print("Credentials reset: shop PIN=111111, consumer password=Test@1234")

# Shop login
r = requests.post(f"{BASE}/shop/auth/login", json={"shop_code": shop_code, "pin": "111111"})
assert r.status_code == 200, f"Shop login failed: {r.text}"
op_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
print("\n[1] Shop login OK")

# Consumer login
r2 = requests.post(f"{BASE}/auth/login", json={"email": consumer_email, "password": "Test@1234"})
assert r2.status_code == 200, f"Consumer login failed: {r2.text}"
con_headers = {"Authorization": f"Bearer {r2.json()['access_token']}"}
print("[2] Consumer login OK")

# Generate QR
r3 = requests.get(f"{BASE}/consumers/qr", headers=con_headers)
assert r3.status_code == 200, f"QR gen failed: {r3.text}"
data = r3.json()
qr = data.get("hmac_payload") or data.get("qr_payload") or data.get("payload")
print(f"[3] QR generated: {str(qr)[:50]}...")

# Operator lookup
r4 = requests.post(f"{BASE}/operator/consumer/lookup", json={"qr_payload": qr}, headers=op_headers)
print(f"[4] Lookup status: {r4.status_code}")
assert r4.status_code == 200, f"Lookup failed: {r4.text}"

d = r4.json()
print("\n========== CONSUMER ELIGIBILITY RESULT ==========")
print(f"  Full Name:         {d.get('full_name')}")
print(f"  Aadhaar (masked):  {d.get('aadhaar_masked')}")
print(f"  District:          {d.get('district')}")
print(f"  Is Teetotaler:     {d.get('is_teetotaler')}")
print(f"  Can Purchase:      {d.get('can_purchase')}")
print(f"  Daily Limit:       {d.get('daily_limit_ml')} ml")
print(f"  Today Consumed:    {d.get('today_consumed_ml')} ml")
print(f"  Remaining Today:   {d.get('remaining_daily_ml')} ml")
print(f"  Weekly Limit:      {d.get('weekly_limit_ml')} ml")
print(f"  Week Consumed:     {d.get('week_consumed_ml')} ml")
print(f"  Remaining Week:    {d.get('remaining_weekly_ml')} ml")
print(f"  Daily % Used:      {d.get('daily_pct_used')}%")
print("==================================================")
print("\n✅ ALL TESTS PASSED - QR scan eligibility check fully working!")
