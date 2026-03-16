#!/usr/bin/env python3
"""
Diagnostica: verifica se il kid del token JWT è presente nel JWKS di JWT_URI.
Se il kid non c'è o le chiavi non coincidono, la verifica firma fallirà.

Uso:
  cd cadastre/backend && python scripts/check_jwks_kid.py
  Oppure con variabili da .env: VITE_MOCK_COOKIE, JWT_URI, MASE_SECU_SSL_VERIFY
"""
from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.request

# Cookie da env (stesso di .env compose)
COOKIE = os.getenv("VITE_MOCK_COOKIE", "")
JWT_URI = os.getenv("JWT_URI", "https://sim-dev.mase.gov.it/core/api/iam/protocol/openid-connect/certs")
SSL_VERIFY = os.getenv("MASE_SECU_SSL_VERIFY", "false").strip().lower() in ("true", "1", "yes")


def extract_access_token(cookie_header: str) -> str | None:
    for part in cookie_header.strip().strip('"').split(";"):
        part = part.strip()
        if part.startswith("access_token="):
            return part.split("=", 1)[1].strip()
    return None


def jwt_header_and_payload(token: str) -> tuple[dict, dict]:
    import base64
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("JWT deve avere 3 parti")
    def b64decode(s: str) -> bytes:
        pad = 4 - len(s) % 4
        if pad != 4:
            s += "=" * pad
        return base64.urlsafe_b64decode(s)
    header = json.loads(b64decode(parts[0]).decode())
    payload = json.loads(b64decode(parts[1]).decode())
    return header, payload


def main() -> None:
    print("Diagnostica JWKS vs token")
    print("  JWT_URI =", JWT_URI)
    print("  SSL_VERIFY =", SSL_VERIFY)

    token = extract_access_token(COOKIE)
    if not token:
        print("ERRORE: nessun access_token in VITE_MOCK_COOKIE")
        sys.exit(1)

    try:
        header, payload = jwt_header_and_payload(token)
    except Exception as e:
        print("ERRORE decode token:", e)
        sys.exit(1)

    kid = header.get("kid")
    alg = header.get("alg")
    iss = payload.get("iss")
    print("  Token kid =", kid)
    print("  Token alg =", alg)
    print("  Token iss =", iss)

    # Fetch JWKS
    ctx = ssl.create_default_context()
    if not SSL_VERIFY:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(JWT_URI, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            jwks = json.loads(r.read().decode())
    except Exception as e:
        print("ERRORE fetch JWKS:", e)
        sys.exit(1)

    keys = jwks.get("keys", [])
    print("  JWKS: numero chiavi =", len(keys))
    kids_in_jwks = [k.get("kid") for k in keys]
    print("  JWKS kids =", kids_in_jwks)

    if kid not in kids_in_jwks:
        print("\n>>> MOTIVO FALLIMENTO: il token ha kid=%r ma nel JWKS non c'è questa chiave." % kid)
        print("    Possibili cause: JWT_URI punta a un realm/endpoint diverso da chi ha firmato il token,")
        print("    o rotazione chiavi (token firmato con chiave vecchia, JWKS espone solo la nuova).")
        sys.exit(1)

    idx = kids_in_jwks.index(kid)
    print("  Indice della chiave usata dal token nel JWKS =", idx)
    print("\n>>> Il kid del token è presente nel JWKS (indice %d)." % idx)
    if idx != 0:
        print("    Se mase-utils-secu usa JWKS_INDEX=0 (default), sta usando la chiave SBAGLIATA.")
        print("    Prova in .env: JWKS_INDEX=%d" % idx)
    print("    Altrimenti: formato chiave/alg in mase-utils-secu o audience/issuer.")
    sys.exit(0)


if __name__ == "__main__":
    main()
