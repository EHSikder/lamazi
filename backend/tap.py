"""Tap Payments helper. Server-side only — never exposes TAP_SECRET_KEY."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx

TAP_API_BASE = 'https://api.tap.company/v2'
TAP_SECRET_KEY = os.environ.get('TAP_SECRET_KEY', '')
TAP_MERCHANT_ID = os.environ.get('TAP_MERCHANT_ID', '')


def _headers() -> Dict[str, str]:
    return {
        'Authorization': f'Bearer {TAP_SECRET_KEY}',
        'Content-Type': 'application/json',
        'accept': 'application/json',
    }


async def create_charge(
    *,
    order_id: str,
    order_number: str,
    amount: float,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    redirect_url: str,
    webhook_url: Optional[str] = None,
    description: str = '',
) -> Dict[str, Any]:
    first = (customer_name or 'Customer').split()[0]
    last = ' '.join((customer_name or 'Customer').split()[1:]) or 'Customer'
    phone_digits = (customer_phone or '').replace('+965', '').replace(' ', '').replace('-', '') or '00000000'
    body = {
        'amount': float(amount),
        'currency': 'KWD',
        'customer_initiated': True,
        'threeDSecure': True,
        'save_card': False,
        'description': description or f'LAMAZI Sweets Order #{order_number}',
        'metadata': {'order_id': order_id, 'order_number': order_number},
        'reference': {'transaction': order_id, 'order': order_number},
        'receipt': {'email': True, 'sms': True},
        'customer': {
            'first_name': first,
            'last_name': last,
            'email': customer_email or 'customer@lamazi.com',
            'phone': {'country_code': '965', 'number': phone_digits},
        },
        'source': {'id': 'src_all'},
        'redirect': {'url': redirect_url},
    }
    # Tap requires `post.url` in the charge body to register a webhook
    # (Tap does NOT support webhook URLs in dashboard — they are per-charge).
    # See https://developers.tap.company/docs/webhook
    if webhook_url:
        body['post'] = {'url': webhook_url}
    if TAP_MERCHANT_ID:
        body['merchant'] = {'id': TAP_MERCHANT_ID}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f'{TAP_API_BASE}/charges', headers=_headers(), json=body)
        return {'status': resp.status_code, 'data': resp.json() if resp.text else {}}


async def get_charge(charge_id: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f'{TAP_API_BASE}/charges/{charge_id}', headers=_headers())
        return {'status': resp.status_code, 'data': resp.json() if resp.text else {}}
