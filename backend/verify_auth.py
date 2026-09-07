"""
Phase 2 verification script.
Run from backend/ with venv active:
  venv\Scripts\python verify_auth.py
"""
import http.cookiejar
import json
import urllib.request

BASE = "http://localhost:8000"
CJ = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CJ))

PASS = "[PASS]"
FAIL = "[FAIL]"


def post(path, body=None, use_cookies=True):
    data = json.dumps(body).encode() if body else b""
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = opener.open(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get(path, use_cookies=True):
    req = urllib.request.Request(BASE + path, method="GET")
    try:
        resp = opener.open(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get_no_cookie(path):
    """GET without any cookies."""
    req = urllib.request.Request(BASE + path, method="GET")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


results = []

# 1. Wrong password -> 401
code, body = post("/api/auth/login", {"username": "admin@example.com", "password": "wrong"})
ok = code == 401
results.append((1, ok, f"Wrong password -> {code} (expected 401)"))

# 2. Correct login -> 200, body contains username
code, body = post("/api/auth/login", {"username": "admin@example.com", "password": "Password123!"})
ok = code == 200 and "admin@example.com" in json.dumps(body)
results.append((2, ok, f"Correct login -> {code}, body={body}"))

# 3. /me with cookie -> 200
code, body = get("/api/auth/me")
ok = code == 200
results.append((3, ok, f"/me with cookie -> {code}, body={body}"))

# 4. /me without cookie -> 401
code, body = get_no_cookie("/api/auth/me")
ok = code == 401
results.append((4, ok, f"/me no cookie -> {code} (expected 401)"))

# 5. Logout -> 200
code, body = post("/api/auth/logout")
ok = code == 200
results.append((5, ok, f"Logout -> {code}, body={body}"))

# 6. /me after logout -> 401
code, body = get("/api/auth/me")
ok = code == 401
results.append((6, ok, f"/me after logout -> {code} (expected 401)"))

print("\n=== Phase 2 Auth Verification ===")
all_pass = True
for num, ok, msg in results:
    status = PASS if ok else FAIL
    print(f"  {status} [{num}] {msg}")
    if not ok:
        all_pass = False

print()
if all_pass:
    print("All 6 checks PASSED.")
else:
    print("Some checks FAILED — see above.")
    raise SystemExit(1)
