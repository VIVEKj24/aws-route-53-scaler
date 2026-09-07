"""
Phase 3+4 verification script.
Run from backend/ with venv active:
  venv\Scripts\python verify_records.py
"""
import http.cookiejar
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"
CJ = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CJ))

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        resp = opener.open(req)
        raw = resp.read()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else {}


def check(n, ok, msg):
    results.append((n, ok, msg))


# ── 0. Login ──────────────────────────────────────────────────────────────────
code, body = request("POST", "/api/auth/login",
                     {"username": "admin@example.com", "password": "Password123!"})
assert code == 200, f"Login failed: {code} {body}"
print("Logged in OK")

# ── 0b. Create a fresh zone ───────────────────────────────────────────────────
code, body = request("POST", "/api/hosted-zones",
                     {"name": "test-phase4.com", "comment": "verification zone"})
# Accept 201 or 409 (already exists from a previous run)
if code == 409:
    # find existing
    code2, list_body = request("GET", "/api/hosted-zones?search=test-phase4.com")
    zone_id = list_body["items"][0]["id"]
    print(f"Zone already exists, using zone_id={zone_id}")
    # clean up extra records so tests start fresh
    code3, recs = request("GET", f"/api/hosted-zones/{zone_id}/records")
    for r in recs["items"]:
        if not r["is_default"]:
            request("DELETE", f"/api/hosted-zones/{zone_id}/records/{r['id']}")
else:
    assert code == 201, f"Create zone failed: {code} {body}"
    zone_id = body["id"]
    print(f"Created zone_id={zone_id}")

ZID = zone_id
print(f"Using zone_id={ZID}\n")

# ── Check 1: list → 1 record (default NS) ────────────────────────────────────
code, body = request("GET", f"/api/hosted-zones/{ZID}/records")
ok = code == 200 and body["total"] == 1 and body["items"][0]["is_default"] is True
check(1, ok, f"List records -> total={body.get('total')}, is_default={body.get('items', [{}])[0].get('is_default')}")

ns_record_id = body["items"][0]["id"]

# ── Check 2: create valid A record ────────────────────────────────────────────
code, body = request("POST", f"/api/hosted-zones/{ZID}/records",
    {"name": "www.test-phase4.com", "type": "A", "ttl": 300,
     "values": ["192.0.2.1", "192.0.2.2"]})
ok = code == 201 and body.get("type") == "A"
check(2, ok, f"Create A record -> {code}, id={body.get('id')}")
a_record_id = body.get("id")

# ── Check 3: create A with invalid IP -> 400 ──────────────────────────────────
code, body = request("POST", f"/api/hosted-zones/{ZID}/records",
    {"name": "bad.test-phase4.com", "type": "A", "ttl": 300,
     "values": ["not-an-ip"]})
ok = code == 400 and "not-an-ip" in body.get("detail", "")
check(3, ok, f"Invalid A value -> {code}, detail={body.get('detail')}")

# ── Check 4a: create valid MX record ─────────────────────────────────────────
code, body = request("POST", f"/api/hosted-zones/{ZID}/records",
    {"name": "test-phase4.com", "type": "MX", "ttl": 3600,
     "values": ["10 mail.test-phase4.com."]})
ok = code == 201
check("4a", ok, f"Create valid MX -> {code}")
mx_record_id = body.get("id")

# ── Check 4b: create MX with no priority -> 400 ───────────────────────────────
code, body = request("POST", f"/api/hosted-zones/{ZID}/records",
    {"name": "test-phase4.com", "type": "MX", "ttl": 3600,
     "values": ["mail.test-phase4.com."]})
ok = code == 400
check("4b", ok, f"Invalid MX (no priority) -> {code}, detail={body.get('detail')}")

# ── Check 5: filter by type=A ────────────────────────────────────────────────
code, body = request("GET", f"/api/hosted-zones/{ZID}/records?type=A")
ok = code == 200 and body["total"] == 1 and body["items"][0]["type"] == "A"
check(5, ok, f"Filter type=A -> total={body.get('total')}")

# ── Check 6: search by name ───────────────────────────────────────────────────
code, body = request("GET", f"/api/hosted-zones/{ZID}/records?search=www")
ok = code == 200 and body["total"] == 1 and "www" in body["items"][0]["name"]
check(6, ok, f"Search www -> total={body.get('total')}, name={body.get('items', [{}])[0].get('name')}")

# ── Check 7: PUT update ttl ───────────────────────────────────────────────────
code, body = request("PUT", f"/api/hosted-zones/{ZID}/records/{a_record_id}",
    {"ttl": 600})
ok = code == 200 and body.get("ttl") == 600 and body.get("name") == "www.test-phase4.com"
check(7, ok, f"PUT ttl -> {code}, ttl={body.get('ttl')}, name={body.get('name')}")

# ── Check 8: DELETE default NS record -> 400 ──────────────────────────────────
code, body = request("DELETE", f"/api/hosted-zones/{ZID}/records/{ns_record_id}")
ok = code == 400 and "Default records cannot be deleted" in body.get("detail", "")
check(8, ok, f"Delete default -> {code}, detail={body.get('detail')}")

# ── Check 9a: DELETE A record -> 204 ──────────────────────────────────────────
code, body = request("DELETE", f"/api/hosted-zones/{ZID}/records/{a_record_id}")
ok = code == 204
check("9a", ok, f"Delete A record -> {code}")

# ── Check 9b: GET deleted record -> 404 ───────────────────────────────────────
code, body = request("GET", f"/api/hosted-zones/{ZID}/records/{a_record_id}")
ok = code == 404
check("9b", ok, f"GET deleted record -> {code}")

# ── Results ───────────────────────────────────────────────────────────────────
print("\n=== Phase 3+4 Records Verification ===")
all_pass = True
for num, ok, msg in results:
    status = PASS if ok else FAIL
    print(f"  {status} [{num}] {msg}")
    if not ok:
        all_pass = False

print()
if all_pass:
    print("All checks PASSED.")
else:
    print("Some checks FAILED — see above.")
    raise SystemExit(1)
