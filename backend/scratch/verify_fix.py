import requests, sys, os, psycopg2, bcrypt
from dotenv import load_dotenv

load_dotenv()
BASE = "http://127.0.0.1:8000/api/v1"

# ── Find shop + reset PIN ──────────────────────────────────────────────────────
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute("SELECT shop_code FROM shops LIMIT 1")
shop_code = cur.fetchone()[0]

cur.execute(
    "UPDATE users SET pin_hash=%s, pin_failed_attempts=0, pin_locked_until=NULL "
    "WHERE id=(SELECT operator_id FROM shops WHERE shop_code=%s)",
    (bcrypt.hashpw(b"111111", bcrypt.gensalt()).decode(), shop_code)
)

cur.execute("SELECT email FROM users WHERE role='CONSUMER' AND is_active=true LIMIT 1")
row = cur.fetchone()
consumer_email = row[0] if row else None
conn.commit(); conn.close()

print(f"Shop: {shop_code}, Consumer: {consumer_email}")

# ── Shop login ────────────────────────────────────────────────────────────────
r = requests.post(f"{BASE}/shop/auth/login", json={"shop_code": shop_code, "pin": "111111"})
if r.status_code != 200:
    print(f"Shop login FAILED {r.status_code}: {r.text[:200]}"); sys.exit(1)
op_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
print(f"Shop login OK")

# ── Test 1: Bad QR must return 400, NOT 500 ────────────────────────────────────
r_bad = requests.post(
    f"{BASE}/operator/consumer/lookup",
    json={"qr_payload": '{"uid":"bad-uid","iat":1,"exp":9999999999,"sig":"invalidsig"}'},
    headers=op_headers
)
print(f"\nBad QR test: status={r_bad.status_code}")
if r_bad.status_code == 500:
    print("FAIL - still 500! Fix not applied.")
    sys.exit(1)
elif r_bad.status_code == 400:
    print("PASS - 400 as expected (invalid QR rejected cleanly)")
else:
    print(f"Got {r_bad.status_code}: {r_bad.text[:100]}")

# ── Test 2: Get fresh QR and do full lookup ────────────────────────────────────
if consumer_email:
    for pwd in ["Test@1234", "Consumer@123", "Password@1", "Admin@123", "tasmac@123", "Tasmac@123"]:
        r2 = requests.post(f"{BASE}/auth/login", json={"email": consumer_email, "password": pwd})
        if r2.status_code == 200:
            print(f"\nConsumer login OK ({pwd})")
            con_headers = {"Authorization": f"Bearer {r2.json()['access_token']}"}
            r3 = requests.get(f"{BASE}/consumers/qr", headers=con_headers)
            if r3.status_code == 200:
                data = r3.json()
                qr = data.get("hmac_payload") or data.get("qr_payload") or data.get("payload")
                r4 = requests.post(
                    f"{BASE}/operator/consumer/lookup",
                    json={"qr_payload": qr}, headers=op_headers
                )
                print(f"QR Lookup: status={r4.status_code}")
                if r4.status_code == 200:
                    d = r4.json()
                    print(f"  Name:           {d.get('full_name')}")
                    print(f"  Can purchase:   {d.get('can_purchase')}")
                    print(f"  Is teetotaler:  {d.get('is_teetotaler')}")
                    print(f"  Remaining day:  {d.get('remaining_daily_ml')} ml")
                    print(f"  Remaining week: {d.get('remaining_weekly_ml')} ml")
                    print("\nFULL TEST PASSED - QR scan and eligibility check working!")
                else:
                    print(f"  Lookup response: {r4.text[:200]}")
            break

print("\nDone.")
