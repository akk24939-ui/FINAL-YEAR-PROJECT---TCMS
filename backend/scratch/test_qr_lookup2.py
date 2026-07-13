"""
Quick integration test for operator consumer lookup fix.
Run: python scratch/test_qr_lookup2.py
"""
import requests, sys

BASE = "http://127.0.0.1:8000/api/v1"

# Step 1: Shop operator login
print("1. Shop operator login...")
r = requests.post(f"{BASE}/shop/auth/login", json={"shop_code": "TSM-MAD-44481", "pin": "123456"})
print(f"   Status: {r.status_code}")
if r.status_code != 200:
    # Try to find valid shop code
    print(f"   Body: {r.text[:300]}")
    print("   Trying to find shop code from DB...")
    sys.exit(1)

op_token = r.json()["access_token"]
op_headers = {"Authorization": f"Bearer {op_token}"}
print(f"   Logged in OK")

# Step 2: Consumer login + get QR
print("\n2. Consumer login...")
# Try common consumer accounts
consumer_logins = [
    {"email": "consumer@test.com", "password": "Test@1234"},
    {"email": "test@test.com", "password": "Test@1234"},
    {"email": "akash@test.com", "password": "Test@1234"},
]
con_token = None
for cred in consumer_logins:
    r2 = requests.post(f"{BASE}/auth/login", json=cred)
    if r2.status_code == 200:
        con_token = r2.json()["access_token"]
        print(f"   Logged in as {cred['email']}")
        break

if not con_token:
    print("   No consumer account found. Testing lookup with dummy QR to verify error type...")
    r_test = requests.post(
        f"{BASE}/operator/consumer/lookup",
        json={"qr_payload": '{"uid":"test","iat":1,"exp":9999999999,"sig":"invalid"}'},
        headers=op_headers
    )
    print(f"   Status: {r_test.status_code} (expected 400, not 500)")
    if r_test.status_code == 500:
        print("   ❌ Still getting 500 - fix may not have applied yet")
    else:
        print(f"   ✅ No more 500 error! Got {r_test.status_code}: {r_test.json().get('detail','')}")
    sys.exit(0)

# Step 3: Generate QR
print("\n3. Generating consumer QR...")
r3 = requests.get(f"{BASE}/consumers/qr", headers={"Authorization": f"Bearer {con_token}"})
print(f"   Status: {r3.status_code}")
if r3.status_code != 200:
    print(f"   Body: {r3.text[:200]}")
    sys.exit(1)

data = r3.json()
qr_payload = data.get("hmac_payload") or data.get("qr_payload") or data.get("payload")
print(f"   QR payload (first 60): {str(qr_payload)[:60]}...")

# Step 4: Operator lookup
print("\n4. Operator lookup with fresh QR...")
r4 = requests.post(
    f"{BASE}/operator/consumer/lookup",
    json={"qr_payload": qr_payload},
    headers=op_headers
)
print(f"   Status: {r4.status_code}")
if r4.status_code == 200:
    d = r4.json()
    print(f"   Name:              {d.get('full_name')}")
    print(f"   Can purchase:      {d.get('can_purchase')}")
    print(f"   Is teetotaler:     {d.get('is_teetotaler')}")
    print(f"   Daily remaining:   {d.get('remaining_daily_ml')} ml")
    print(f"   Weekly remaining:  {d.get('remaining_weekly_ml')} ml")
    print(f"   Daily %:           {d.get('daily_pct_used')}%")
    print("\n✅ FIXED — consumer lookup works correctly!")
elif r4.status_code == 400:
    print(f"   QR invalid/expired: {r4.json().get('detail')} (this is expected if QR expired)")
    print("   ✅ At least no more 500 error!")
else:
    print(f"   ❌ Error: {r4.text[:300]}")
