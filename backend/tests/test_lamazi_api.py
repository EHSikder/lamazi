"""Backend API tests for LAMAZI Sweets — Phase 1 review."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://6b04f1d2-2e5c-4bac-a03b-3e79aceb3bd3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TENANT_ID = "f1b0c252-6921-40c2-9f39-77e0c35225b9"
BRANCH_ID = "e5895a11-73cb-4c39-be93-a6b4f90acd05"
CATEGORY_ID = "75d1476a-ca2f-4a8b-87fc-70aa1ce3926f"

S = requests.Session()
S.headers.update({"Content-Type": "application/json"})


# ---------------- Public endpoints ----------------
def test_health():
    r = S.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_branch_status():
    r = S.get(f"{API}/branch/status", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "is_open" in data
    assert isinstance(data["is_open"], bool)


def test_menu_categories():
    r = S.get(f"{API}/menu/categories", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(c.get("id") == CATEGORY_ID for c in data)


def test_menu_items_list():
    r = S.get(f"{API}/menu/items", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) == 6, f"expected 6 active items, got {len(items)}"
    for it in items:
        assert it.get("status") == "active"
        assert float(it.get("base_price")) == 15.0
        assert it.get("name_en") and it.get("name_ar")
        assert it.get("image_url")


def test_menu_items_filter_by_category():
    r = S.get(f"{API}/menu/items", params={"category_id": CATEGORY_ID}, timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    for it in items:
        assert it["category_id"] == CATEGORY_ID


def test_menu_item_detail():
    items = S.get(f"{API}/menu/items", timeout=15).json()
    item_id = items[0]["id"]
    r = S.get(f"{API}/menu/items/{item_id}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == item_id
    assert isinstance(data.get("variants"), list)
    assert isinstance(data.get("modifier_groups"), list)


def test_menu_item_detail_404():
    r = S.get(f"{API}/menu/items/{uuid.uuid4()}", timeout=15)
    assert r.status_code == 404


def test_loyalty_settings():
    r = S.get(f"{API}/loyalty/settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "enabled" in data
    assert "points_per_kwd" in data
    assert "redemption_rate" in data


def test_public_settings():
    r = S.get(f"{API}/settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ["min_order_amount", "delivery_fee", "cod_enabled", "online_enabled", "tap_public_key"]:
        assert k in data
    assert data["tap_public_key"].startswith("pk_")


def test_delivery_zones():
    r = S.get(f"{API}/delivery-zones", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------- Coupons ----------------
def test_coupon_validate_invalid():
    r = S.post(f"{API}/coupons/validate", json={"code": "INVALID", "subtotal": 50}, timeout=15)
    assert r.status_code in (400, 404)


# ---------------- Orders (cash) ----------------
@pytest.fixture(scope="module")
def cash_order():
    items = S.get(f"{API}/menu/items", timeout=15).json()
    item = items[0]
    payload = {
        "order_type": "takeaway",
        "customer_name": "TEST_E2E Buyer",
        "customer_phone": "+96599000000",
        "customer_email": "test_e2e@example.com",
        "items": [{
            "item_id": item["id"],
            "item_name_en": item["name_en"],
            "item_name_ar": item.get("name_ar"),
            "quantity": 1,
            "unit_price": 12.0,
            "total_price": 12.0,
            "notes": "TEST_E2E cash order",
            "modifiers": [],
        }],
        "subtotal": 12.0,
        "discount_amount": 0,
        "delivery_fee": 0,
        "total_amount": 12.0,
        "payment_method": "cash",
        "notes": "TEST_E2E_AUTOMATED",
    }
    r = S.post(f"{API}/orders", json=payload, timeout=30)
    assert r.status_code == 200, f"create order failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["id"] and data["order_number"]
    assert data["status"] == "pending"
    assert data["requires_payment"] is False
    yield data
    # cleanup: mark cancelled
    try:
        S.patch(f"{API}/admin/orders/{data['id']}/status",
                json={"status": "cancelled", "notes": "TEST cleanup"}, timeout=15)
    except Exception:
        pass


def test_cash_order_get(cash_order):
    r = S.get(f"{API}/orders/{cash_order['id']}", timeout=15)
    assert r.status_code == 200
    o = r.json()
    assert o["id"] == cash_order["id"]
    assert isinstance(o.get("items"), list)
    assert len(o["items"]) == 1
    assert o["payment_status"] in ("pending", None)


# ---------------- Admin endpoints ----------------
def test_admin_dashboard():
    r = S.get(f"{API}/admin/dashboard", timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["revenue_today", "orders_today", "pending_count", "in_progress_count",
              "delivered_today_count", "total_customers", "recent_orders"]:
        assert k in d


def test_admin_orders():
    r = S.get(f"{API}/admin/orders", timeout=20)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    for o in rows:
        assert o.get("payment_status") != "payment_pending"
        assert o["branch_id"] == BRANCH_ID


def test_admin_categories_list():
    r = S.get(f"{API}/admin/categories", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_items_list():
    r = S.get(f"{API}/admin/items", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_modifier_groups_list():
    r = S.get(f"{API}/admin/modifier-groups", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_modifiers_list():
    r = S.get(f"{API}/admin/modifiers", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_category_create_and_delete():
    payload = {"name_en": "TEST_E2E Category", "name_ar": "TEST", "sort_order": 99}
    r = S.post(f"{API}/admin/categories", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    created = r.json()
    # Insert returns list or dict
    cid = (created[0]["id"] if isinstance(created, list) else created.get("id"))
    assert cid
    # verify in list
    rows = S.get(f"{API}/admin/categories", timeout=15).json()
    assert any(c["id"] == cid for c in rows)
    # delete
    d = S.delete(f"{API}/admin/categories/{cid}", timeout=15)
    assert d.status_code == 200
    rows2 = S.get(f"{API}/admin/categories", timeout=15).json()
    assert not any(c["id"] == cid for c in rows2)


def test_admin_coupon_create_validate_delete():
    payload = {
        "code": "TESTCOUP10", "name_en": "Test 10%", "discount_type": "percent",
        "discount_value": 10, "min_basket": 5, "per_customer_limit": 0, "status": "active",
    }
    # cleanup any prior
    existing = S.get(f"{API}/admin/coupons", timeout=15).json()
    for c in existing:
        if c.get("code") == "TESTCOUP10":
            S.delete(f"{API}/admin/coupons/{c['id']}", timeout=15)

    r = S.post(f"{API}/admin/coupons", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    created = r.json()
    cid = (created[0]["id"] if isinstance(created, list) else created.get("id"))
    assert cid

    v = S.post(f"{API}/coupons/validate", json={"code": "TESTCOUP10", "subtotal": 50}, timeout=15)
    assert v.status_code == 200, v.text
    vd = v.json()
    assert vd["valid"] is True
    assert vd["discount_amount"] == 5.0  # 10% of 50

    d = S.delete(f"{API}/admin/coupons/{cid}", timeout=15)
    assert d.status_code == 200


def test_admin_loyalty_get_post():
    r = S.get(f"{API}/admin/loyalty", timeout=15)
    assert r.status_code == 200
    original = r.json()
    # Save back same values
    payload = {
        "enabled": bool(original.get("enabled", True)),
        "points_per_kwd": float(original.get("points_per_kwd", 1.0)),
        "min_order_amount": float(original.get("min_order_amount", 0)),
        "redemption_rate": float(original.get("redemption_rate", 0.01)),
        "min_points_to_redeem": int(original.get("min_points_to_redeem", 0)),
        "max_redemption_percent": float(original.get("max_redemption_percent", 100.0)),
    }
    p = S.post(f"{API}/admin/loyalty", json=payload, timeout=15)
    assert p.status_code == 200


def test_admin_operating_hours_get_post():
    r = S.get(f"{API}/admin/operating-hours", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "hours" in data
    current = data["hours"] or {}
    # write a monday entry (preserve others)
    new_hours = dict(current)
    new_hours["monday"] = {"is_open": True, "ranges": [{"open": "09:00", "close": "23:00"}]}
    p = S.post(f"{API}/admin/operating-hours", json={"hours": new_hours}, timeout=15)
    assert p.status_code == 200
    # restore
    if current:
        S.post(f"{API}/admin/operating-hours", json={"hours": current}, timeout=15)


def test_admin_settings_validation():
    # First get current to restore later
    cur = S.get(f"{API}/admin/settings", timeout=15).json()
    bad = {"min_order_amount": cur.get("min_order_amount", 10),
           "delivery_fee": cur.get("delivery_fee", 0.5),
           "cod_enabled": False, "online_enabled": False}
    r = S.post(f"{API}/admin/settings", json=bad, timeout=15)
    assert r.status_code == 400
    # Now valid
    good = {"min_order_amount": cur.get("min_order_amount", 10),
            "delivery_fee": cur.get("delivery_fee", 0.5),
            "cod_enabled": True, "online_enabled": True}
    r2 = S.post(f"{API}/admin/settings", json=good, timeout=15)
    assert r2.status_code == 200


def test_admin_adjust_points_nonexistent():
    r = S.post(f"{API}/admin/customers/adjust-points",
               json={"customer_id": str(uuid.uuid4()), "delta": 5, "note": "TEST"}, timeout=15)
    assert r.status_code == 404


def test_admin_check_unauth():
    r = S.get(f"{API}/admin/check", params={"email": "nonexistent@x.com"}, timeout=15)
    assert r.status_code == 403


def test_customer_upsert():
    cid = str(uuid.uuid4())
    payload = {"id": cid, "email": f"test_{cid[:8]}@example.com",
               "name": "TEST_E2E Customer", "phone": "+96588000000"}
    r = S.post(f"{API}/customer/upsert", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    # verify
    g = S.get(f"{API}/customer/{cid}", timeout=15)
    assert g.status_code == 200
    assert g.json()["id"] == cid
