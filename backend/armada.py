"""Armada Delivery v2 integration.

Docs: https://docs.armadadelivery.com/v2/
Auth: Armada-Access-Token header. We treat the configured ARMADA_API_KEY value
as the access token (Armada console exposes both an API key + secret; the v2
HTTP API accepts the key as the Access-Token header).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

ARMADA_BASE_URL = os.environ.get('ARMADA_BASE_URL', 'https://api.armadadelivery.com/v2')
ARMADA_API_KEY = os.environ.get('ARMADA_API_KEY', '')
ARMADA_API_SECRET = os.environ.get('ARMADA_API_SECRET', '')
ARMADA_BRANCH_ID = os.environ.get('ARMADA_BRANCH_ID', '')


def is_configured() -> bool:
    return bool(ARMADA_API_KEY and ARMADA_BRANCH_ID)


def _headers() -> Dict[str, str]:
    return {
        'Armada-Access-Token': ARMADA_API_KEY,
        'Armada-Api-Secret': ARMADA_API_SECRET,
        'Content-Type': 'application/json',
    }


def _kuwait_destination(order: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    addr = order.get('delivery_address') or {}
    if not addr.get('area') or not addr.get('block') or not addr.get('building'):
        return None
    d: Dict[str, Any] = {
        'contact_name': (order.get('customer_name') or 'Customer').strip(),
        'contact_phone': order.get('customer_phone') or '',
        'area': str(addr.get('area')),
        'block': str(addr.get('block')),
        'street': str(addr.get('street') or '0'),
        'building': str(addr.get('building')),
    }
    if addr.get('floor'):
        d['floor'] = str(addr['floor'])
    if addr.get('apartment'):
        d['apartment'] = str(addr['apartment'])
    if addr.get('additional_directions'):
        d['instructions'] = str(addr['additional_directions'])
    if addr.get('geo_lat') is not None and addr.get('geo_lng') is not None:
        d['latitude'] = float(addr['geo_lat'])
        d['longitude'] = float(addr['geo_lng'])
    return d


async def create_delivery(order: Dict[str, Any]) -> Dict[str, Any]:
    if not is_configured():
        raise RuntimeError('Armada not configured')

    destination = _kuwait_destination(order)
    if destination is None:
        raise ValueError('Order missing required address fields (area/block/building)')

    payment_type = 'paid' if order.get('payment_status') == 'paid' else 'cash'

    body = {
        'reference': order.get('order_number') or order.get('id'),
        'origin_format': 'branch_format',
        'origin': {'branch_id': ARMADA_BRANCH_ID},
        'destination_format': 'kuwait_format',
        'destination': destination,
        'payment': {
            'amount': float(order.get('total_amount') or 0),
            'type': payment_type,
        },
    }

    url = f'{ARMADA_BASE_URL}/deliveries'
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=_headers(), json=body)
        if resp.status_code >= 400:
            logging.error('Armada create_delivery failed (%s): %s', resp.status_code, resp.text)
            raise RuntimeError(f'Armada error {resp.status_code}: {resp.text}')
        return resp.json()


async def cancel_delivery(code: str) -> Dict[str, Any]:
    if not is_configured():
        raise RuntimeError('Armada not configured')
    url = f'{ARMADA_BASE_URL}/deliveries/{code}/cancel'
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=_headers())
        if resp.status_code >= 400:
            raise RuntimeError(f'Armada cancel error {resp.status_code}: {resp.text}')
        return resp.json()
