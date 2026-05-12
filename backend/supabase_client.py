"""Thin async REST wrapper around Supabase PostgREST.

Keeps backend stateless and avoids the supabase-py SDK. All multi-tenant calls
must pass tenant_id / branch_id filters explicitly — this module does not
inject them automatically.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
SUPABASE_ANON_KEY = os.environ['SUPABASE_ANON_KEY']


def _headers(prefer: str = 'return=representation') -> Dict[str, str]:
    return {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': prefer,
    }


async def sb_request(
    method: str,
    table: str,
    data: Any = None,
    params: Optional[Dict[str, str]] = None,
    prefer: str = 'return=representation',
) -> Any:
    url = f'{SUPABASE_URL}/rest/v1/{table}'
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == 'GET':
            resp = await client.get(url, headers=_headers(prefer), params=params)
        elif method == 'POST':
            resp = await client.post(url, headers=_headers(prefer), json=data, params=params)
        elif method == 'PATCH':
            resp = await client.patch(url, headers=_headers(prefer), json=data, params=params)
        elif method == 'DELETE':
            resp = await client.delete(url, headers=_headers(prefer), params=params)
        else:
            raise ValueError(f'Unsupported method {method}')

        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=f'Supabase: {resp.text}')
        if resp.status_code == 204 or not resp.text:
            return None
        return resp.json()


async def sb_select(table: str, params: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    res = await sb_request('GET', table, params=params)
    return res or []


async def sb_insert(table: str, data: Dict[str, Any]) -> Dict[str, Any]:
    res = await sb_request('POST', table, data=data)
    if isinstance(res, list) and res:
        return res[0]
    return res or {}


async def sb_update(table: str, data: Dict[str, Any], params: Dict[str, str]) -> Optional[Dict[str, Any]]:
    res = await sb_request('PATCH', table, data=data, params=params)
    if isinstance(res, list) and res:
        return res[0]
    return res


async def sb_delete(table: str, params: Dict[str, str]) -> None:
    await sb_request('DELETE', table, params=params)
