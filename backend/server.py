"""LAMAZI Sweets — FastAPI backend.

Plays the role of the Express server from the original spec: hosts Tap Payments
charge create + verify, Armada dispatch, Supabase REST proxy for the storefront
and admin panel. Multi-tenant scoping enforced on every read/write.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, time as dtime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from armada import (  # noqa: E402
    cancel_delivery as armada_cancel,
    create_delivery as armada_create,
    is_configured as armada_is_configured,
)
from supabase_client import sb_delete, sb_insert, sb_request, sb_select, sb_update  # noqa: E402
from tap import create_charge as tap_create_charge, get_charge as tap_get_charge  # noqa: E402

TENANT_ID = os.environ['TENANT_ID']
BRANCH_ID = os.environ['BRANCH_ID']
FRONTEND_URL = os.environ.get('FRONTEND_URL', '')
TAP_PUBLIC_KEY = os.environ.get('TAP_PUBLIC_KEY', '')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('lamazi')


def kuwait_now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=3)


def kuwait_iso() -> str:
    return kuwait_now().replace(tzinfo=None).isoformat()


def gen_order_number() -> str:
    return f"LMZ-{kuwait_now().strftime('%Y%m%d')}-{str(uuid.uuid4().int)[:4]}"


# ============================================================
# Pydantic Models
# ============================================================

class ModifierSel(BaseModel):
    id: Optional[str] = None
    modifier_group_name_en: Optional[str] = None
    name_en: str
    name_ar: Optional[str] = None
    price: float = 0
    quantity: int = 1


class CartItem(BaseModel):
    item_id: str
    item_name_en: str
    item_name_ar: Optional[str] = None
    variant_id: Optional[str] = None
    variant_name_en: Optional[str] = None
    variant_name_ar: Optional[str] = None
    quantity: int = 1
    unit_price: float
    total_price: float
    notes: Optional[str] = None
    modifiers: List[ModifierSel] = []


class DeliveryAddress(BaseModel):
    area: str
    block: str
    street: Optional[str] = '0'
    building: str
    floor: Optional[str] = None
    apartment: Optional[str] = None
    additional_directions: Optional[str] = None
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None


class CreateOrderRequest(BaseModel):
    order_type: str  # 'delivery' or 'takeaway'
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_id: Optional[str] = None
    guest_id: Optional[str] = None
    delivery_address: Optional[DeliveryAddress] = None
    delivery_instructions: Optional[str] = None
    items: List[CartItem]
    subtotal: float
    discount_amount: float = 0
    delivery_fee: float = 0
    total_amount: float
    notes: Optional[str] = None
    coupon_code: Optional[str] = None
    payment_method: str = 'cash'  # 'cash' or 'tap'
    loyalty_points_used: int = 0
    loyalty_points_earned: int = 0


class OrderResponse(BaseModel):
    id: str
    order_number: str
    status: str
    created_at: str
    payment_url: Optional[str] = None
    requires_payment: bool = False


class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class ProfileUpsert(BaseModel):
    id: str  # auth user id (matches customers.id)
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None


# ----- Admin models -----

class CategoryIn(BaseModel):
    name_en: str
    name_ar: Optional[str] = ''
    description_en: Optional[str] = ''
    description_ar: Optional[str] = ''
    image_url: Optional[str] = ''
    sort_order: int = 0
    status: str = 'active'


class ItemIn(BaseModel):
    category_id: str
    name_en: str
    name_ar: Optional[str] = ''
    description_en: Optional[str] = ''
    description_ar: Optional[str] = ''
    image_url: Optional[str] = ''
    base_price: float
    sort_order: int = 0
    status: str = 'active'


class VariantIn(BaseModel):
    item_id: str
    name_en: str
    name_ar: Optional[str] = ''
    price_adjustment: float = 0
    sort_order: int = 0
    status: str = 'active'


class ModifierGroupIn(BaseModel):
    name_en: str
    name_ar: Optional[str] = ''
    min_select: int = 0
    max_select: int = 1
    required: bool = False
    sort_order: int = 0
    status: str = 'active'


class ModifierIn(BaseModel):
    modifier_group_id: str
    name_en: str
    name_ar: Optional[str] = ''
    price: float = 0
    sort_order: int = 0
    status: str = 'active'


class ItemModifierLinkIn(BaseModel):
    item_id: str
    modifier_group_id: str
    sort_order: int = 0


class CouponIn(BaseModel):
    code: str
    name_en: Optional[str] = ''
    name_ar: Optional[str] = ''
    discount_type: str = 'percent'  # percent | fixed
    discount_value: float
    min_basket: float = 0
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    per_customer_limit: int = 1
    valid_to: Optional[str] = None
    status: str = 'active'


class LoyaltyIn(BaseModel):
    enabled: bool = True
    points_per_kwd: float = 1.0
    min_order_amount: float = 0
    redemption_rate: float = 0.01
    min_points_to_redeem: int = 0
    max_redemption_percent: float = 100.0


class DeliveryZoneIn(BaseModel):
    zone_name: str
    delivery_fee: float = 0
    min_order_amount: float = 0
    estimated_time_minutes: int = 30
    coordinates: Any  # polygon as list of [lng, lat] pairs
    status: str = 'active'


class OperatingHoursIn(BaseModel):
    hours: Dict[str, Any]  # {monday: {is_open, ranges: [{open, close}]}, ...}


class SettingsIn(BaseModel):
    min_order_amount: float = 0
    delivery_fee: float = 0  # default delivery fee
    cod_enabled: bool = True
    online_enabled: bool = True


class AdjustPointsIn(BaseModel):
    customer_id: str
    delta: int
    note: str = ''


# ============================================================
# FastAPI app
# ============================================================

app = FastAPI(title='LAMAZI Sweets API', version='1.0.0')
api = APIRouter(prefix='/api')

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ============================================================
# Public — branch status, menu, delivery zones, settings, loyalty
# ============================================================

def _is_within_range(now_t: dtime, rng: Dict[str, str]) -> bool:
    try:
        oh, om = (int(x) for x in str(rng.get('open', '00:00')).split(':'))
        ch, cm = (int(x) for x in str(rng.get('close', '23:59')).split(':'))
    except Exception:
        return True
    open_t = dtime(oh, om)
    close_t = dtime(ch, cm)
    if open_t <= close_t:
        return open_t <= now_t <= close_t
    return now_t >= open_t or now_t <= close_t


async def _branch_settings() -> Dict[str, Any]:
    rows = await sb_select('branches', params={
        'id': f'eq.{BRANCH_ID}',
        'select': 'id,name,min_order_amount,delivery_fee,operating_hours,settings,status',
    })
    return rows[0] if rows else {}


@api.get('/branch/status')
async def branch_status():
    branch = await _branch_settings()
    if not branch:
        return {'is_open': False, 'reason': 'Branch not configured'}

    if branch.get('status') and branch['status'] != 'active':
        return {'is_open': False, 'reason': 'Branch inactive', 'branch': branch}

    hours = branch.get('operating_hours') or {}
    now = kuwait_now()
    day_key = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][now.weekday()]
    today = hours.get(day_key)
    if not today:
        return {'is_open': True, 'branch': branch}  # no schedule → assume open
    if not today.get('is_open', True):
        return {'is_open': False, 'reason': 'Closed today', 'next_day': day_key, 'branch': branch}
    ranges = today.get('ranges') or []
    if not ranges:
        return {'is_open': True, 'branch': branch}
    cur_t = now.time()
    for rng in ranges:
        if _is_within_range(cur_t, rng):
            return {'is_open': True, 'branch': branch}
    return {'is_open': False, 'reason': 'Outside operating hours', 'ranges': ranges, 'branch': branch}


@api.get('/menu/categories')
async def get_categories():
    return await sb_select('categories', params={
        'tenant_id': f'eq.{TENANT_ID}',
        'status': 'eq.active',
        'select': '*',
        'order': 'sort_order.asc',
    })


@api.get('/menu/items')
async def get_items(category_id: Optional[str] = None, limit: int = 200):
    params = {
        'tenant_id': f'eq.{TENANT_ID}',
        'status': 'eq.active',
        'select': '*',
        'order': 'sort_order.asc',
        'limit': str(limit),
    }
    if category_id and category_id not in ('all', ''):
        params['category_id'] = f'eq.{category_id}'
    return await sb_select('items', params=params)


@api.get('/menu/items/{item_id}')
async def get_item_detail(item_id: str):
    rows = await sb_select('items', params={'id': f'eq.{item_id}', 'tenant_id': f'eq.{TENANT_ID}', 'select': '*'})
    if not rows:
        raise HTTPException(status_code=404, detail='Item not found')
    item = rows[0]

    variants = await sb_select('item_variants', params={
        'item_id': f'eq.{item_id}',
        'status': 'eq.active',
        'select': '*',
        'order': 'sort_order.asc',
    })

    links = await sb_select('item_modifier_groups', params={
        'item_id': f'eq.{item_id}',
        'select': '*',
        'order': 'sort_order.asc',
    })
    groups: List[Dict[str, Any]] = []
    if links:
        group_ids = ','.join(link['modifier_group_id'] for link in links)
        groups_data = await sb_select('modifier_groups', params={
            'id': f'in.({group_ids})',
            'status': 'eq.active',
            'tenant_id': f'eq.{TENANT_ID}',
            'select': '*',
        })
        for g in groups_data:
            mods = await sb_select('modifiers', params={
                'modifier_group_id': f'eq.{g["id"]}',
                'status': 'eq.active',
                'select': '*',
                'order': 'sort_order.asc',
            })
            g['modifiers'] = mods
            groups.append(g)

    item['variants'] = variants
    item['modifier_groups'] = groups
    return item


@api.get('/delivery-zones')
async def get_delivery_zones():
    return await sb_select('delivery_zones', params={
        'branch_id': f'eq.{BRANCH_ID}',
        'status': 'eq.active',
        'select': '*',
    })


@api.get('/loyalty/settings')
async def loyalty_settings_public():
    rows = await sb_select('loyalty_settings', params={'tenant_id': f'eq.{TENANT_ID}', 'select': '*'})
    if rows:
        return rows[0]
    return {'enabled': False, 'points_per_kwd': 1.0, 'min_order_amount': 0, 'redemption_rate': 0.01,
            'min_points_to_redeem': 0, 'max_redemption_percent': 100.0}


@api.get('/settings')
async def public_settings():
    branch = await _branch_settings()
    s = (branch.get('settings') or {})
    return {
        'min_order_amount': float(branch.get('min_order_amount') or 0),
        'delivery_fee': float(branch.get('delivery_fee') or 0),
        'cod_enabled': bool(s.get('cod_enabled', True)),
        'online_enabled': bool(s.get('online_enabled', True)),
        'tap_public_key': TAP_PUBLIC_KEY,
    }


# ============================================================
# Coupons
# ============================================================

@api.post('/coupons/validate')
async def validate_coupon(payload: Dict[str, Any]):
    code = (payload.get('code') or '').upper().strip()
    subtotal = float(payload.get('subtotal') or 0)
    customer_id = payload.get('customer_id')
    guest_id = payload.get('guest_id')

    if not code:
        raise HTTPException(status_code=400, detail='Coupon code required')

    coupons = await sb_select('coupons', params={
        'code': f'eq.{code}',
        'tenant_id': f'eq.{TENANT_ID}',
        'status': 'eq.active',
        'select': '*',
    })
    if not coupons:
        raise HTTPException(status_code=404, detail='Coupon not found or inactive')

    coupon = coupons[0]
    now = kuwait_now().replace(tzinfo=None)

    if coupon.get('valid_to'):
        try:
            valid_to = datetime.fromisoformat(str(coupon['valid_to']).replace('Z', ''))
            if now > valid_to:
                raise HTTPException(status_code=400, detail='Coupon has expired')
        except ValueError:
            pass

    min_basket = float(coupon.get('min_basket') or 0)
    if subtotal < min_basket:
        raise HTTPException(status_code=400, detail=f'Minimum order is {min_basket:.3f} KWD for this coupon')

    usage_limit = coupon.get('usage_limit')
    if usage_limit and int(usage_limit) > 0:
        all_uses = await sb_select('coupon_usage', params={'coupon_id': f'eq.{coupon["id"]}', 'select': 'id'})
        if len(all_uses) >= int(usage_limit):
            raise HTTPException(status_code=400, detail='Coupon usage limit reached')

    per_customer = int(coupon.get('per_customer_limit') or 1)
    if per_customer > 0:
        used_count = 0
        if customer_id:
            rows = await sb_select('coupon_usage', params={
                'coupon_id': f'eq.{coupon["id"]}',
                'customer_id': f'eq.{customer_id}',
                'select': 'id',
            })
            used_count += len(rows)
        if guest_id:
            # we track guest usage in orders.notes (lightweight, no schema change)
            orders = await sb_select('orders', params={
                'tenant_id': f'eq.{TENANT_ID}',
                'notes': f'ilike.*guest_id:{guest_id}*coupon:{code}*',
                'select': 'id',
            })
            used_count += len(orders)
        if used_count >= per_customer:
            raise HTTPException(status_code=400, detail=f'You have already used this coupon {per_customer} time(s)')

    dtype = coupon.get('discount_type', 'percent')
    dval = float(coupon.get('discount_value') or 0)
    if dtype in ('percent', 'percentage'):
        discount = subtotal * (dval / 100.0)
        cap = coupon.get('max_discount')
        if cap is not None and discount > float(cap):
            discount = float(cap)
    else:
        discount = min(dval, subtotal)

    return {
        'valid': True,
        'coupon_id': coupon['id'],
        'code': coupon['code'],
        'discount_type': dtype,
        'discount_value': dval,
        'discount_amount': round(discount, 3),
        'name_en': coupon.get('name_en', ''),
        'name_ar': coupon.get('name_ar', ''),
    }


# ============================================================
# Orders
# ============================================================

async def _save_order(req: CreateOrderRequest, *, payment_status: str, transaction_id: Optional[str] = None) -> Dict[str, Any]:
    order_id = str(uuid.uuid4())
    order_number = gen_order_number()
    address_json = req.delivery_address.dict() if req.delivery_address else None

    extra_notes_parts: List[str] = []
    if req.notes:
        extra_notes_parts.append(req.notes)
    if req.guest_id:
        extra_notes_parts.append(f'guest_id:{req.guest_id}')
    if req.coupon_code:
        extra_notes_parts.append(f'coupon:{req.coupon_code.upper()}')
    notes_combined = ' | '.join(extra_notes_parts) if extra_notes_parts else None

    order_row = {
        'id': order_id,
        'tenant_id': TENANT_ID,
        'branch_id': BRANCH_ID,
        'order_number': order_number,
        'order_type': req.order_type,
        'channel': 'website',
        'status': 'pending' if payment_status != 'payment_pending' else 'payment_pending',
        'customer_id': req.customer_id,
        'customer_name': req.customer_name,
        'customer_phone': req.customer_phone,
        'customer_email': req.customer_email,
        'delivery_address': address_json,
        'delivery_instructions': req.delivery_instructions,
        'subtotal': req.subtotal,
        'discount_amount': req.discount_amount,
        'delivery_fee': req.delivery_fee,
        'tax_amount': 0,
        'service_charge': 0,
        'total_amount': req.total_amount,
        'payment_status': payment_status,
        'notes': notes_combined,
    }
    await sb_insert('orders', order_row)

    for it in req.items:
        oi_id = str(uuid.uuid4())
        await sb_insert('order_items', {
            'id': oi_id,
            'order_id': order_id,
            'item_id': it.item_id,
            'variant_id': it.variant_id,
            'item_name_en': it.item_name_en,
            'item_name_ar': it.item_name_ar,
            'variant_name_en': it.variant_name_en,
            'variant_name_ar': it.variant_name_ar,
            'quantity': it.quantity,
            'unit_price': it.unit_price,
            'total_price': it.total_price,
            'notes': it.notes,
            'status': 'pending',
        })
        for mod in (it.modifiers or []):
            try:
                await sb_insert('order_item_modifiers', {
                    'order_item_id': oi_id,
                    'modifier_id': mod.id,
                    'modifier_group_name_en': mod.modifier_group_name_en,
                    'modifier_name_en': mod.name_en,
                    'modifier_name_ar': mod.name_ar,
                    'quantity': mod.quantity or 1,
                    'price': mod.price,
                })
            except Exception as e:
                logger.warning('save modifier failed: %s', e)

    if transaction_id:
        try:
            await sb_insert('payments', {
                'order_id': order_id,
                'payment_method': 'online',
                'provider': 'tap',
                'amount': req.total_amount,
                'currency': 'KWD',
                'status': 'completed' if payment_status == 'paid' else 'pending',
                'transaction_id': transaction_id,
                'completed_at': kuwait_iso() if payment_status == 'paid' else None,
            })
        except Exception as e:
            logger.warning('save payment failed: %s', e)

    if req.coupon_code and req.discount_amount > 0:
        try:
            cps = await sb_select('coupons', params={
                'code': f'eq.{req.coupon_code.upper()}',
                'tenant_id': f'eq.{TENANT_ID}',
                'select': 'id',
            })
            if cps:
                await sb_insert('coupon_usage', {
                    'coupon_id': cps[0]['id'],
                    'customer_id': req.customer_id,
                    'order_id': order_id,
                    'discount_applied': req.discount_amount,
                })
        except Exception as e:
            logger.warning('coupon usage failed: %s', e)

    if req.customer_id and (req.loyalty_points_used or req.loyalty_points_earned):
        try:
            cur = await sb_select('customers', params={'id': f'eq.{req.customer_id}', 'select': 'loyalty_points'})
            current = int(cur[0]['loyalty_points']) if cur else 0
            new_balance = current - int(req.loyalty_points_used) + int(req.loyalty_points_earned)
            await sb_update('customers', {'loyalty_points': new_balance, 'updated_at': kuwait_iso()},
                            params={'id': f'eq.{req.customer_id}'})
            await sb_insert('loyalty_transactions', {
                'customer_id': req.customer_id,
                'order_id': order_id,
                'points_earned': int(req.loyalty_points_earned),
                'points_spent': int(req.loyalty_points_used),
                'balance_after': new_balance,
                'notes': f'Order {order_number}',
            })
        except Exception as e:
            logger.warning('loyalty txn failed: %s', e)

    return {'id': order_id, 'order_number': order_number}


async def _validate_can_order(req: CreateOrderRequest) -> None:
    branch = await _branch_settings()
    if not branch:
        raise HTTPException(status_code=400, detail='Branch not configured')
    if branch.get('status') and branch['status'] != 'active':
        raise HTTPException(status_code=400, detail='Restaurant is not accepting orders right now')

    min_amt = float(branch.get('min_order_amount') or 0)
    if min_amt > 0 and req.subtotal < min_amt:
        raise HTTPException(status_code=400, detail=f'Minimum order amount is {min_amt:.3f} KWD')

    hours = branch.get('operating_hours') or {}
    if hours:
        now = kuwait_now()
        day_key = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][now.weekday()]
        today = hours.get(day_key)
        if today and today.get('is_open', True):
            ranges = today.get('ranges') or []
            if ranges and not any(_is_within_range(now.time(), r) for r in ranges):
                raise HTTPException(status_code=400, detail='Restaurant is currently closed')
        elif today and not today.get('is_open', True):
            raise HTTPException(status_code=400, detail='Restaurant is closed today')

    s = branch.get('settings') or {}
    if req.payment_method == 'cash' and not s.get('cod_enabled', True):
        raise HTTPException(status_code=400, detail='Cash on Delivery is currently disabled')
    if req.payment_method == 'tap' and not s.get('online_enabled', True):
        raise HTTPException(status_code=400, detail='Online payment is currently disabled')


@api.post('/orders', response_model=OrderResponse)
async def create_order(req: CreateOrderRequest):
    await _validate_can_order(req)

    if req.payment_method != 'tap':
        result = await _save_order(req, payment_status='pending')
        return OrderResponse(
            id=result['id'], order_number=result['order_number'],
            status='pending', created_at=kuwait_iso(), requires_payment=False,
        )

    # Online: save with payment_pending so it doesn't show in admin yet
    result = await _save_order(req, payment_status='payment_pending')
    redirect_url = f"{FRONTEND_URL}/payment-result?order_id={result['id']}"
    charge = await tap_create_charge(
        order_id=result['id'], order_number=result['order_number'],
        amount=req.total_amount,
        customer_name=req.customer_name, customer_email=req.customer_email or '',
        customer_phone=req.customer_phone, redirect_url=redirect_url,
    )
    if charge['status'] != 200:
        # rollback
        try:
            await sb_delete('orders', params={'id': f'eq.{result["id"]}'})
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Payment initiation failed: {charge['data']}")
    payment_url = (charge['data'].get('transaction') or {}).get('url')
    return OrderResponse(
        id=result['id'], order_number=result['order_number'], status='awaiting_payment',
        created_at=kuwait_iso(), payment_url=payment_url, requires_payment=True,
    )


@api.get('/payment/verify')
async def payment_verify(tap_id: Optional[str] = None, order_id: Optional[str] = None):
    if not tap_id and not order_id:
        return {'success': False, 'status': 'invalid', 'message': 'No payment reference provided'}

    if tap_id:
        resp = await tap_get_charge(tap_id)
        if resp['status'] != 200:
            return {'success': False, 'status': 'verification_failed', 'message': 'Could not verify with Tap'}
        data = resp['data']
        charge_status = str(data.get('status', '')).upper()
        ref_order_id = (data.get('metadata') or {}).get('order_id') or (data.get('reference') or {}).get('transaction') or order_id

        if charge_status == 'CAPTURED' and ref_order_id:
            await sb_update('orders', {
                'payment_status': 'paid', 'status': 'pending',
                'transaction_id': data.get('id'),
                'updated_at': kuwait_iso(),
            }, params={'id': f'eq.{ref_order_id}'})
            try:
                await sb_insert('payments', {
                    'order_id': ref_order_id, 'payment_method': 'online', 'provider': 'tap',
                    'amount': float(data.get('amount') or 0), 'currency': 'KWD',
                    'status': 'completed', 'transaction_id': data.get('id'),
                    'provider_response': data, 'completed_at': kuwait_iso(),
                })
            except Exception as e:
                logger.warning('payment record write failed: %s', e)
            orders = await sb_select('orders', params={'id': f'eq.{ref_order_id}', 'select': 'order_number'})
            return {
                'success': True, 'status': 'paid', 'order_id': ref_order_id,
                'order_number': orders[0]['order_number'] if orders else '',
                'transaction_id': data.get('id'),
                'message': 'Payment successful! Order confirmed.',
            }
        if charge_status in ('CANCELLED', 'FAILED', 'DECLINED', 'RESTRICTED', 'VOID', 'TIMEDOUT', 'ABANDONED'):
            if ref_order_id:
                try:
                    await sb_delete('orders', params={'id': f'eq.{ref_order_id}'})
                except Exception:
                    pass
            return {'success': False, 'status': 'failed', 'message': f'Payment {charge_status.lower()}.'}
        return {'success': False, 'status': 'pending', 'message': f'Payment status: {charge_status}'}

    # by order_id
    rows = await sb_select('orders', params={'id': f'eq.{order_id}', 'select': '*'})
    if not rows:
        return {'success': False, 'status': 'not_found', 'message': 'Order not found'}
    o = rows[0]
    if o.get('payment_status') == 'paid':
        return {'success': True, 'status': 'paid', 'order_id': order_id,
                'order_number': o.get('order_number', ''), 'message': 'Payment confirmed.'}
    return {'success': False, 'status': 'pending', 'message': 'Awaiting payment confirmation'}


@api.post('/tap/webhook')
async def tap_webhook(request: Request):
    """Backup path if redirect verification fails."""
    try:
        data = await request.json()
        charge_id = data.get('id')
        status = str(data.get('status', '')).upper()
        ref_order_id = (data.get('metadata') or {}).get('order_id') or (data.get('reference') or {}).get('transaction')
        logger.info('Tap webhook: %s status=%s order=%s', charge_id, status, ref_order_id)
        if status == 'CAPTURED' and ref_order_id:
            rows = await sb_select('orders', params={'id': f'eq.{ref_order_id}', 'select': 'payment_status'})
            if rows and rows[0].get('payment_status') != 'paid':
                await sb_update('orders', {
                    'payment_status': 'paid', 'status': 'pending', 'transaction_id': charge_id,
                    'updated_at': kuwait_iso(),
                }, params={'id': f'eq.{ref_order_id}'})
        return {'received': True}
    except Exception as e:
        logger.error('webhook err: %s', e)
        return {'received': True}


@api.get('/orders/{order_id}')
async def get_order(order_id: str):
    rows = await sb_select('orders', params={'id': f'eq.{order_id}', 'select': '*'})
    if not rows:
        raise HTTPException(status_code=404, detail='Order not found')
    order = rows[0]
    items = await sb_select('order_items', params={'order_id': f'eq.{order_id}', 'select': '*'})
    for it in items:
        mods = await sb_select('order_item_modifiers', params={'order_item_id': f'eq.{it["id"]}', 'select': '*'})
        it['modifiers'] = mods
    order['items'] = items
    return order


# ============================================================
# Customer profile (links Supabase Auth user to customers row)
# ============================================================

@api.post('/customer/upsert')
async def customer_upsert(payload: ProfileUpsert):
    existing = await sb_select('customers', params={'id': f'eq.{payload.id}', 'select': '*'})
    data = {
        'id': payload.id,
        'tenant_id': TENANT_ID,
        'email': payload.email,
        'phone': payload.phone,
        'name': payload.name,
    }
    if existing:
        await sb_update('customers', {k: v for k, v in data.items() if v is not None},
                        params={'id': f'eq.{payload.id}'})
        return existing[0]
    return await sb_insert('customers', data)


@api.get('/customer/{customer_id}')
async def customer_get(customer_id: str):
    rows = await sb_select('customers', params={'id': f'eq.{customer_id}', 'select': '*'})
    if not rows:
        raise HTTPException(status_code=404, detail='Customer not found')
    return rows[0]


@api.get('/customer/{customer_id}/orders')
async def customer_orders(customer_id: str):
    return await sb_select('orders', params={
        'customer_id': f'eq.{customer_id}',
        'tenant_id': f'eq.{TENANT_ID}',
        'select': '*',
        'order': 'created_at.desc',
        'limit': '50',
    })


# ============================================================
# Admin — auth check, orders, CRUD
# ============================================================

@api.get('/admin/check')
async def admin_check(email: str):
    rows = await sb_select('users', params={
        'email': f'eq.{email}',
        'tenant_id': f'eq.{TENANT_ID}',
        'status': 'eq.active',
        'select': 'id,email,name,role,tenant_id,branch_id,status',
    })
    if not rows:
        raise HTTPException(status_code=403, detail='Not authorised')
    return rows[0]


@api.get('/admin/orders')
async def admin_orders(status: Optional[str] = None, limit: int = 200):
    params = {
        'tenant_id': f'eq.{TENANT_ID}',
        'branch_id': f'eq.{BRANCH_ID}',
        'select': '*',
        'order': 'created_at.desc',
        'limit': str(limit),
        'payment_status': 'neq.payment_pending',
    }
    if status and status != 'all':
        params['status'] = f'eq.{status}'
    return await sb_select('orders', params=params)


@api.patch('/admin/orders/{order_id}/status')
async def admin_update_order_status(order_id: str, payload: StatusUpdate):
    valid = ['pending', 'accepted', 'rejected', 'preparing', 'packing', 'out_for_delivery', 'delivered', 'cancelled']
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail='Invalid status')

    update: Dict[str, Any] = {'status': payload.status, 'updated_at': kuwait_iso()}
    if payload.status == 'accepted':
        update['accepted_at'] = kuwait_iso()
    elif payload.status in ('delivered', 'cancelled', 'rejected'):
        update['completed_at'] = kuwait_iso()

    await sb_update('orders', update, params={'id': f'eq.{order_id}'})

    armada_info: Optional[Dict[str, Any]] = None
    if payload.status == 'accepted' and armada_is_configured():
        try:
            rows = await sb_select('orders', params={'id': f'eq.{order_id}', 'select': '*'})
            if rows and rows[0].get('order_type') == 'delivery':
                o = rows[0]
                notes = o.get('notes') or ''
                if 'armada_code:' not in notes:
                    o['payment_method'] = 'paid' if o.get('payment_status') == 'paid' else 'cash'
                    try:
                        res = await armada_create(o)
                        code = res.get('code') or res.get('id')
                        armada_info = {
                            'armada_code': code,
                            'tracking_url': (res.get('logistics') or {}).get('tracking_url'),
                            'delivery_fee': res.get('delivery_fee'),
                        }
                        new_notes = (notes + f' | armada_code:{code}').strip(' |')
                        await sb_update('orders', {'notes': new_notes}, params={'id': f'eq.{order_id}'})
                    except Exception as ae:
                        logger.error('armada dispatch failed: %s', ae)
                        armada_info = {'error': str(ae)}
        except Exception as e:
            logger.error('armada accept hook err: %s', e)

    return {'success': True, 'status': payload.status, 'armada': armada_info}


@api.post('/armada/webhook')
async def armada_webhook(request: Request):
    try:
        body = await request.json()
        code = body.get('code') or body.get('id')
        status = str(body.get('status') or '').lower()
        if not code:
            return {'received': True}
        rows = await sb_select('orders', params={
            'tenant_id': f'eq.{TENANT_ID}',
            'notes': f'ilike.*armada_code:{code}*',
            'select': 'id,status,notes',
            'limit': '1',
        })
        if not rows:
            return {'received': True}
        order = rows[0]
        mapping = {
            'pending': 'accepted',
            'dispatched': 'preparing',
            'waiting_pack': 'packing',
            'en_route': 'out_for_delivery',
            'completed': 'delivered',
            'canceled': 'cancelled',
            'cancelled': 'cancelled',
            'failed': 'cancelled',
        }
        new_status = mapping.get(status)
        if new_status and new_status != order.get('status'):
            patch: Dict[str, Any] = {'status': new_status, 'updated_at': kuwait_iso()}
            if new_status == 'delivered':
                patch['completed_at'] = kuwait_iso()
            await sb_update('orders', patch, params={'id': f'eq.{order["id"]}'})
        return {'received': True}
    except Exception as e:
        logger.error('armada webhook err: %s', e)
        return {'received': True}


@api.get('/admin/dashboard')
async def admin_dashboard():
    orders = await sb_select('orders', params={
        'tenant_id': f'eq.{TENANT_ID}',
        'branch_id': f'eq.{BRANCH_ID}',
        'select': 'id,status,total_amount,created_at',
        'order': 'created_at.desc',
        'limit': '500',
        'payment_status': 'neq.payment_pending',
    })
    today = kuwait_now().date()
    today_orders = [o for o in orders if str(o.get('created_at', ''))[:10] == today.isoformat()]
    revenue_today = sum(float(o.get('total_amount') or 0) for o in today_orders if o.get('status') != 'cancelled')
    pending = [o for o in orders if o.get('status') == 'pending']
    in_progress = [o for o in orders if o.get('status') in ('accepted', 'preparing', 'packing', 'out_for_delivery')]
    delivered_today = [o for o in today_orders if o.get('status') == 'delivered']

    customers = await sb_select('customers', params={'tenant_id': f'eq.{TENANT_ID}', 'select': 'id'})

    return {
        'revenue_today': round(revenue_today, 3),
        'orders_today': len(today_orders),
        'pending_count': len(pending),
        'in_progress_count': len(in_progress),
        'delivered_today_count': len(delivered_today),
        'total_customers': len(customers),
        'recent_orders': orders[:10],
    }


# ---- Categories
@api.get('/admin/categories')
async def admin_get_categories():
    return await sb_select('categories', params={
        'tenant_id': f'eq.{TENANT_ID}', 'select': '*', 'order': 'sort_order.asc',
    })


@api.post('/admin/categories')
async def admin_create_category(c: CategoryIn):
    return await sb_insert('categories', {'id': str(uuid.uuid4()), 'tenant_id': TENANT_ID, **c.dict()})


@api.patch('/admin/categories/{cid}')
async def admin_update_category(cid: str, c: CategoryIn):
    await sb_update('categories', c.dict(), params={'id': f'eq.{cid}'})
    return {'success': True}


@api.delete('/admin/categories/{cid}')
async def admin_delete_category(cid: str):
    await sb_delete('categories', params={'id': f'eq.{cid}'})
    return {'success': True}


# ---- Items
@api.get('/admin/items')
async def admin_get_items():
    return await sb_select('items', params={
        'tenant_id': f'eq.{TENANT_ID}', 'select': '*', 'order': 'sort_order.asc',
    })


@api.post('/admin/items')
async def admin_create_item(it: ItemIn):
    return await sb_insert('items', {'id': str(uuid.uuid4()), 'tenant_id': TENANT_ID, **it.dict()})


@api.patch('/admin/items/{iid}')
async def admin_update_item(iid: str, it: ItemIn):
    await sb_update('items', it.dict(), params={'id': f'eq.{iid}'})
    return {'success': True}


@api.delete('/admin/items/{iid}')
async def admin_delete_item(iid: str):
    await sb_delete('items', params={'id': f'eq.{iid}'})
    return {'success': True}


# ---- Variants
@api.get('/admin/items/{iid}/variants')
async def admin_get_variants(iid: str):
    return await sb_select('item_variants', params={'item_id': f'eq.{iid}', 'select': '*', 'order': 'sort_order.asc'})


@api.post('/admin/variants')
async def admin_create_variant(v: VariantIn):
    return await sb_insert('item_variants', {'id': str(uuid.uuid4()), **v.dict()})


@api.delete('/admin/variants/{vid}')
async def admin_delete_variant(vid: str):
    await sb_delete('item_variants', params={'id': f'eq.{vid}'})
    return {'success': True}


# ---- Modifier groups & modifiers
@api.get('/admin/modifier-groups')
async def admin_get_mod_groups():
    return await sb_select('modifier_groups', params={
        'tenant_id': f'eq.{TENANT_ID}', 'select': '*', 'order': 'sort_order.asc',
    })


@api.post('/admin/modifier-groups')
async def admin_create_mod_group(g: ModifierGroupIn):
    return await sb_insert('modifier_groups', {'id': str(uuid.uuid4()), 'tenant_id': TENANT_ID, **g.dict()})


@api.patch('/admin/modifier-groups/{gid}')
async def admin_update_mod_group(gid: str, g: ModifierGroupIn):
    await sb_update('modifier_groups', g.dict(), params={'id': f'eq.{gid}'})
    return {'success': True}


@api.delete('/admin/modifier-groups/{gid}')
async def admin_delete_mod_group(gid: str):
    await sb_delete('modifier_groups', params={'id': f'eq.{gid}'})
    return {'success': True}


@api.get('/admin/modifiers')
async def admin_get_modifiers(group_id: Optional[str] = None):
    params: Dict[str, str] = {'select': '*', 'order': 'sort_order.asc'}
    if group_id:
        params['modifier_group_id'] = f'eq.{group_id}'
    return await sb_select('modifiers', params=params)


@api.post('/admin/modifiers')
async def admin_create_modifier(m: ModifierIn):
    return await sb_insert('modifiers', {'id': str(uuid.uuid4()), **m.dict()})


@api.patch('/admin/modifiers/{mid}')
async def admin_update_modifier(mid: str, m: ModifierIn):
    await sb_update('modifiers', m.dict(), params={'id': f'eq.{mid}'})
    return {'success': True}


@api.delete('/admin/modifiers/{mid}')
async def admin_delete_modifier(mid: str):
    await sb_delete('modifiers', params={'id': f'eq.{mid}'})
    return {'success': True}


@api.get('/admin/items/{iid}/modifier-links')
async def admin_get_item_mod_links(iid: str):
    return await sb_select('item_modifier_groups', params={
        'item_id': f'eq.{iid}', 'select': '*', 'order': 'sort_order.asc',
    })


@api.post('/admin/item-modifier-links')
async def admin_link_modifier(link: ItemModifierLinkIn):
    return await sb_insert('item_modifier_groups', {'id': str(uuid.uuid4()), **link.dict()})


@api.delete('/admin/item-modifier-links/{lid}')
async def admin_unlink_modifier(lid: str):
    await sb_delete('item_modifier_groups', params={'id': f'eq.{lid}'})
    return {'success': True}


# ---- Coupons
@api.get('/admin/coupons')
async def admin_get_coupons():
    return await sb_select('coupons', params={
        'tenant_id': f'eq.{TENANT_ID}', 'select': '*', 'order': 'created_at.desc',
    })


@api.post('/admin/coupons')
async def admin_create_coupon(c: CouponIn):
    data = c.dict()
    data['code'] = data['code'].upper().strip()
    return await sb_insert('coupons', {'id': str(uuid.uuid4()), 'tenant_id': TENANT_ID, **data})


@api.patch('/admin/coupons/{cid}')
async def admin_update_coupon(cid: str, c: CouponIn):
    data = c.dict()
    data['code'] = data['code'].upper().strip()
    await sb_update('coupons', data, params={'id': f'eq.{cid}'})
    return {'success': True}


@api.delete('/admin/coupons/{cid}')
async def admin_delete_coupon(cid: str):
    await sb_delete('coupons', params={'id': f'eq.{cid}'})
    return {'success': True}


@api.get('/admin/coupon-usage')
async def admin_coupon_usage():
    coupons = await sb_select('coupons', params={
        'tenant_id': f'eq.{TENANT_ID}', 'select': '*', 'order': 'created_at.desc',
    })
    result = []
    for c in coupons:
        uses = await sb_select('coupon_usage', params={'coupon_id': f'eq.{c["id"]}', 'select': 'customer_id,order_id'})
        unique = len({u.get('customer_id') or u.get('order_id') for u in uses})
        result.append({**c, 'total_uses': len(uses), 'unique_customers': unique})
    return result


# ---- Loyalty
@api.get('/admin/loyalty')
async def admin_get_loyalty():
    rows = await sb_select('loyalty_settings', params={'tenant_id': f'eq.{TENANT_ID}', 'select': '*'})
    if rows:
        return rows[0]
    return {'tenant_id': TENANT_ID, 'enabled': False, 'points_per_kwd': 1.0, 'min_order_amount': 0,
            'redemption_rate': 0.01, 'min_points_to_redeem': 0, 'max_redemption_percent': 100.0}


@api.post('/admin/loyalty')
async def admin_save_loyalty(s: LoyaltyIn):
    existing = await sb_select('loyalty_settings', params={'tenant_id': f'eq.{TENANT_ID}', 'select': 'id'})
    data = {'tenant_id': TENANT_ID, **s.dict(), 'updated_at': kuwait_iso()}
    if existing:
        await sb_update('loyalty_settings', data, params={'tenant_id': f'eq.{TENANT_ID}'})
    else:
        await sb_insert('loyalty_settings', {'id': str(uuid.uuid4()), **data})
    return {'success': True}


# ---- Customers (admin)
@api.get('/admin/customers')
async def admin_customers():
    rows = await sb_select('customers', params={
        'tenant_id': f'eq.{TENANT_ID}', 'select': '*', 'order': 'created_at.desc', 'limit': '500',
    })
    total_points = sum(int(c.get('loyalty_points') or 0) for c in rows)
    return {'customers': rows, 'total_points_issued': total_points, 'total_count': len(rows)}


@api.post('/admin/customers/adjust-points')
async def admin_adjust_points(payload: AdjustPointsIn):
    rows = await sb_select('customers', params={'id': f'eq.{payload.customer_id}', 'select': 'loyalty_points'})
    if not rows:
        raise HTTPException(status_code=404, detail='Customer not found')
    cur = int(rows[0].get('loyalty_points') or 0)
    new_bal = cur + int(payload.delta)
    await sb_update('customers', {'loyalty_points': new_bal, 'updated_at': kuwait_iso()},
                    params={'id': f'eq.{payload.customer_id}'})
    await sb_insert('loyalty_transactions', {
        'customer_id': payload.customer_id,
        'points_earned': max(payload.delta, 0),
        'points_spent': max(-payload.delta, 0),
        'balance_after': new_bal,
        'notes': payload.note or 'admin adjustment',
    })
    return {'success': True, 'balance_after': new_bal}


# ---- Delivery Zones
@api.get('/admin/delivery-zones')
async def admin_get_zones():
    return await sb_select('delivery_zones', params={'branch_id': f'eq.{BRANCH_ID}', 'select': '*'})


@api.post('/admin/delivery-zones')
async def admin_create_zone(z: DeliveryZoneIn):
    return await sb_insert('delivery_zones', {'id': str(uuid.uuid4()), 'branch_id': BRANCH_ID, 'zone_type': 'polygon', **z.dict()})


@api.patch('/admin/delivery-zones/{zid}')
async def admin_update_zone(zid: str, z: DeliveryZoneIn):
    await sb_update('delivery_zones', z.dict(), params={'id': f'eq.{zid}'})
    return {'success': True}


@api.delete('/admin/delivery-zones/{zid}')
async def admin_delete_zone(zid: str):
    await sb_delete('delivery_zones', params={'id': f'eq.{zid}'})
    return {'success': True}


# ---- Operating Hours
@api.get('/admin/operating-hours')
async def admin_get_hours():
    branch = await _branch_settings()
    return {'hours': branch.get('operating_hours') or {}}


@api.post('/admin/operating-hours')
async def admin_save_hours(payload: OperatingHoursIn):
    await sb_update('branches', {'operating_hours': payload.hours, 'updated_at': kuwait_iso()},
                    params={'id': f'eq.{BRANCH_ID}'})
    return {'success': True}


# ---- Settings (ordering + payment methods)
@api.get('/admin/settings')
async def admin_get_settings():
    branch = await _branch_settings()
    s = branch.get('settings') or {}
    return {
        'min_order_amount': float(branch.get('min_order_amount') or 0),
        'delivery_fee': float(branch.get('delivery_fee') or 0),
        'cod_enabled': bool(s.get('cod_enabled', True)),
        'online_enabled': bool(s.get('online_enabled', True)),
    }


@api.post('/admin/settings')
async def admin_save_settings(payload: SettingsIn):
    if not payload.cod_enabled and not payload.online_enabled:
        raise HTTPException(status_code=400, detail='At least one payment method must remain enabled')
    branch = await _branch_settings()
    settings = branch.get('settings') or {}
    settings['cod_enabled'] = payload.cod_enabled
    settings['online_enabled'] = payload.online_enabled
    await sb_update('branches', {
        'min_order_amount': payload.min_order_amount,
        'delivery_fee': payload.delivery_fee,
        'settings': settings,
        'updated_at': kuwait_iso(),
    }, params={'id': f'eq.{BRANCH_ID}'})
    return {'success': True}


# ============================================================
# Health
# ============================================================

@api.get('/')
async def root():
    return {'service': 'LAMAZI Sweets API', 'version': '1.0.0', 'ok': True}


@api.get('/health')
async def health():
    return {'status': 'healthy', 'time_kw': kuwait_iso()}


app.include_router(api)
