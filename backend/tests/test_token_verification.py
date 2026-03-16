"""
Test verifica token JWT e FGP tramite la libreria mase-utils-secu.

Esegue una richiesta a un'app FastAPI protetta con enable_token_authorization:
la verifica (JWT con JWKS + FGP con chiave ECDSA MASE) è interamente gestita da mase-secu.

Parametri: cookie e FGP (default da sviluppo; override con VITE_MOCK_COOKIE, VITE_MOCK_FGP).
Variabili d'ambiente per mase-secu: JWT_URI, MASE_API_*, MASE_SECU_SSL_VERIFY, AUTH_ENABLED.

Esecuzione:
  cd cadastre/backend && PYTHONPATH=src python tests/test_token_verification.py   # standalone
  cd cadastre/backend && PYTHONPATH=src python -m pytest tests/test_token_verification.py -v
"""
from __future__ import annotations

import os
import ssl
import sys
from typing import Any

try:
    import pytest
except ImportError:
    pytest = None  # Esecuzione standalone senza pytest (es. nel container backend)

# Parametri di test (stessi di infrastructure/compose/.env)
TEST_JWT_URI = os.getenv("JWT_URI", "https://sim-dev.mase.gov.it/core/api/iam/protocol/openid-connect/certs")
TEST_MASE_API_AUTH = os.getenv("MASE_API_AUTHENTICATION", "https://sim-dev.mase.gov.it/core/api/authentication")
TEST_MASE_API_IAM = os.getenv("MASE_API_IAM", "http://iam.apps.psnleo01.ocp.mase.priv/iam")
TEST_SSL_VERIFY = os.getenv("MASE_SECU_SSL_VERIFY", "false").strip().lower() in ("true", "1", "yes")
TEST_CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

# Cookie e FGP per test (stessi valori di infrastructure/compose/.env.example)
TEST_COOKIE = os.getenv(
    "VITE_MOCK_COOKIE",
    "bb288830539ac2a5a7f52491ff788b04=16236be98aa96f69e8a65ecbdf903de9; fb9488657fdbdf5f62ddf8aa8ebf3aa6=3675db0a825023d03b8832b08ff7fa82; b56471057cb4f55cc8f66313800be001=063cad8192959d631a27f04347373192; JSESSIONID=BB2E58A38B6654F29805F23BF3DC57BA; 1fb081b9a9d2f87c5dc5e1e66a312ec1=5bbbf63524a2edd0fad2ce96e5366167; access_token=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJSZTNLcDlKYUNQYy1hZTdoREtxb3ktV2wxbHlCWnJ0M2h6WjdpUm4yV01VIn0.eyJleHAiOjE3NzMzOTU2MzgsImlhdCI6MTc3MzM5NTMzOCwiYXV0aF90aW1lIjoxNzczMzkzOTgzLCJqdGkiOiJvbnJ0cnQ6ZDEyYmQ2ZWEtY2M3My1jNjExLTRmYjgtN2U4ZjA0MzVkZWI4IiwiaXNzIjoiaHR0cHM6Ly9zaW0tZGV2Lm1hc2UuZ292Lml0L2lhbS9pZGVudGl0eS9yZWFsbXMvTUFTRV9TSU0iLCJhdWQiOlsiYWxmcmVzY28iLCJhY2NvdW50Il0sInN1YiI6IjE2YjE5ODY4LWU4NTItNDY1Mi05M2M5LTkyM2JiYzRkYTg5NyIsInR5cCI6IkJlYXJlciIsImF6cCI6ImR4cCIsInNpZCI6ImRlYTA5NzFmLWY2MTgtMzc3NS00YzI3LWVkOTA1NGUwYmI3OSIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9zaW0tZGV2Lm1hc2UuZ292Lml0IiwiaHR0cHM6Ly9tYXNlLWZlLXBvcnRhbC1kZXZlbGR4YXAtcG9ydGFsaS5hcHBzLmR4YXAtc3ZpbC5vY3AubWFzZS5wcml2IiwiaHR0cDovL2xvY2FsaG9zdDo5MDAwIl0sInJlc291cmNlX2FjY2VzcyI6eyJhbGZyZXNjbyI6eyJyb2xlcyI6WyJpYW06YWxmcmVzY286cm9sZTpjb2xsYWJvcmF0b3IiLCJpYW06YWxmcmVzY286cm9sZTpjb25zdW1lciJdfSwiZHhwIjp7InJvbGVzIjpbImlhbTpkeHA6cm9sZTpwaWFuaWZpY2F0b3JlIiwiaWFtOmR4cDpyb2xlOmFkbWluIiwiaWFtOmR4cDpyb2xlOmFkbWluX2FjcXVhIiwiaWFtOmR4cDpyb2xlOnN2aWx1cHBvIiwiaWFtOmR4cDpyb2xlOnJ1b2xvX2VzcGVydG8iLCJpYW06ZHhwOnJvbGU6cnVvbG9fdmFsaWRhdG9yZSIsImlhbTpkeHA6cm9sZTpydW9sb19iYXNpYyIsImlhbTpkeHA6cm9sZTpjb25zdWx0YXRvcmUiLCJpYW06ZHhwOnJvbGU6cmljZXJjYXRvcmUiLCJpYW06ZHhwOnJvbGU6YWRtaW5fc3VvbG8iLCJpYW06ZHhwOnJvbGU6cnVvbG9fc3BlYyJdfSwiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJvcGVuaWQgZ3JvdXBzIHByb2ZpbGUgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiY29nbm9tZSI6IkRpIEdpb3ZhbmJhdHRpc3RhIiwibmFtZSI6IkdpdWxpbyBDZXNhcmUgRGkgR2lvdmFuYmF0dGlzdGEiLCJncm91cHMiOlsiL0RhdGFpa3UvRFhDIiwiL0RhdGFpa3UvUmVhZGVycyIsIi9Qb3J0YWxlIGRlbGxhIENvbXVuaWNhemlvbmUvUmVkYXR0b3JpIiwiL3Rlc3Rncm91cCJdLCJub21lIjoiR2l1bGlvIENlc2FyZSIsInByZWZlcnJlZF91c2VybmFtZSI6InV0ZW50ZTE2QG1hc2UiLCJnaXZlbl9uYW1lIjoiR2l1bGlvIENlc2FyZSIsImZpc2NhbF9jb2RlIjoiTFZMREFBODVUNTBHNzAyQiIsImZhbWlseV9uYW1lIjoiRGkgR2lvdmFuYmF0dGlzdGEiLCJlbWFpbCI6InV0ZW50ZTE2QG1hc2UuY29tIn0.oUhNsxAxHDF78WSN5H0Ptw0d9VctmCXqOtmFE75X1NYIUTkAnF9pVakz_x9MZKkjSUjtba_gvzCgh9Se5buH-AIYeMlxhsigLsg-4iR06VQSp4dICIbHKXlpjVQA-qTZJMNclEq2vkT5-9896rVhcidZ1UdnlBL8kt_m1tlTW_IN1kKLBHHMGMr-bjsEM1oEvApkwdPpDD8jMfYFQce-WWGam6OG6oPKdba741pdJAsBm8I_8OnXLosmhjU_MbuqmqktzY2YBiwhd0hgtD13z5O1tzvWeu7eqUksJtotk02IXx-wRlamc8h7SejD9LrPW7U7VqeQJScLqb9hMaa6dw; id_token=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJSZTNLcDlKYUNQYy1hZTdoREtxb3ktV2wxbHlCWnJ0M2h6WjdpUm4yV01VIn0.eyJleHAiOjE3NzMzOTU2MzgsImlhdCI6MTc3MzM5NTMzOCwiYXV0aF90aW1lIjoxNzczMzkzOTgzLCJqdGkiOiIyODlmNTc2MC03MGYzLWM3YTQtOWVhNi1hYjBjZjYzMjYzMTgiLCJpc3MiOiJodHRwczovL3NpbS1kZXYubWFzZS5nb3YuaXQvaWFtL2lkZW50aXR5L3JlYWxtcy9NQVNFX1NJTSIsImF1ZCI6ImR4cCIsInN1YiI6IjE2YjE5ODY4LWU4NTItNDY1Mi05M2M5LTkyM2JiYzRkYTg5NyIsInR5cCI6IklEIiwiYXpwIjoiZHhwIiwic2lkIjoiZGVhMDk3MWYtZjYxOC0zNzc1LTRjMjctZWQ5MDU0ZTBiYjc5IiwiYXRfaGFzaCI6IlJoREVMaEVTcWItd25GTVdYbENzNVEiLCJhY3IiOiIxIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImNvZ25vbWUiOiJEaSBHaW92YW5iYXR0aXN0YSIsIm5hbWUiOiJHaXVsaW8gQ2VzYXJlIERpIEdpb3ZhbmJhdHRpc3RhIiwiZ3JvdXBzIjpbIi9EYXRhaWt1L0RYQyIsIi9EYXRhaWt1L1JlYWRlcnMiLCIvUG9ydGFsZSBkZWxsYSBDb211bmljYXppb25lL1JlZGF0dG9yaSIsIi90ZXN0Z3JvdXAiXSwibm9tZSI6IkdpdWxpbyBDZXNhcmUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ1dGVudGUxNkBtYXNlIiwiZ2l2ZW5fbmFtZSI6IkdpdWxpbyBDZXNhcmUiLCJmaXNjYWxfY29kZSI6IkxWTERBQTg1VDUwRzcwMkIiLCJmYW1pbHlfbmFtZSI6IkRpIEdpb3ZhbmJhdHRpc3RhIiwiZW1haWwiOiJ1dGVudGUxNkBtYXNlLmNvbSJ9.Xf6aA_mu10nSUchZimabhacoF6kTkKmJVcbf66AzAyX6-mIBVvJIhQJywwsbvA3ubobvUcgiF8mr_864YIPBAHf-otGCisIOFHklOJuxzAI5bKnNBStZo0PR2huf1RqbZYXuD8em5iQ2QEjDo5CSUo_4jn52hMSXbBdqwifn76d7rtNrH2z5Q4mxBpWBqVG3VrhXVHuqi3NCNT217sXksAIKqI3dq4vzrYpF29S5TLpAdV01yN4eEBlqGjeBLneWIC5vo2yx8p5IY6DQ4dG3XSxkGxz7E4Ne66yuNdCXCg8dG2zOoDvZE1A6aFOEwZJli33CuM5oPDgwhPbgKxOXIg; refresh_token=eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI3ZjZjNTg5NC0zMzhjLTRmZWEtOTNkMi1jZDJhMTJlZTA4NmQifQ.eyJleHAiOjE3NzM0MjI3ODMsImlhdCI6MTc3MzM5NTMzOCwianRpIjoiNDk0ZTk2ZTgtZjJjYS1jM2NlLTQzYzItOTEwYzZmYWUyNDNmIiwiaXNzIjoiaHR0cHM6Ly9zaW0tZGV2Lm1hc2UuZ292Lml0L2lhbS9pZGVudGl0eS9yZWFsbXMvTUFTRV9TSU0iLCJhdWQiOiJodHRwczovL3NpbS1kZXYubWFzZS5nb3YuaXQvaWFtL2lkZW50aXR5L3JlYWxtcy9NQVNFX1NJTSIsInN1YiI6IjE2YjE5ODY4LWU4NTItNDY1Mi05M2M5LTkyM2JiYzRkYTg5NyIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJkeHAiLCJzaWQiOiJkZWEwOTcxZi1mNjE4LTM3NzUtNGMyNy1lZDkwNTRlMGJiNzkiLCJzY29wZSI6Im9wZW5pZCB3ZWItb3JpZ2lucyBwZ3Vfcm9sZXMgc2VydmljZV9hY2NvdW50IGdyb3VwcyBhY3IgcHJvZmlsZSBiYXNpYyBlbWFpbCByb2xlcyJ9.eAFRkNBWPZAyRGQECJzRTi-6lTMRAp053bPnZQXhBqlfqXb6-VGwW6FrzHwRl9c2nb1Rq92G1-343QCkkls5IQ; uuid-a287974e-a15b-4756-9de0-a537690b34da=MIGHAkIAhJm6sKzeREUASgH0SVpxSL0b5c0kxULH0Xdwzg5tEPVXXd6EQ3xXLDmGMB1u7xJjFujBg1YJLrsOh+3D1kk8v1MCQU7WvHmYkZhS2IBqBxGbcUFt4pOdh9Ha0xLL1/iO3zZXRCiZsmla98pfAEn5ndblNKnMLWWz56oQ2/Mlas6xJzGY",
)
TEST_FGP = os.getenv("VITE_MOCK_FGP", "a287974e-a15b-4756-9de0-a537690b34da")


def _extract_access_token(cookie_header: str) -> str | None:
    """Estrae il valore del cookie access_token dalla stringa Cookie."""
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith("access_token="):
            return part.split("=", 1)[1].strip()
    return None


def _build_app_with_mase_secu():
    """Crea un'app FastAPI minimale con enable_token_authorization (mase-utils-secu)."""
    # Imposta env prima che la libreria li legga
    os.environ["AUTH_ENABLED"] = "true"
    os.environ["JWT_URI"] = TEST_JWT_URI
    os.environ["MASE_API_AUTHENTICATION"] = TEST_MASE_API_AUTH
    os.environ["MASE_API_IAM"] = TEST_MASE_API_IAM
    os.environ["MASE_SECU_SSL_VERIFY"] = "true" if TEST_SSL_VERIFY else "false"
    os.environ.setdefault("CORS_ORIGINS", TEST_CORS_ORIGINS)

    if not TEST_SSL_VERIFY:
        _orig = ssl.create_default_context
        def _no_verify(*args: object, **kwargs: object) -> ssl.SSLContext:
            ctx = _orig(*args, **kwargs)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            return ctx
        ssl.create_default_context = _no_verify

    from fastapi import Depends, FastAPI
    from mase_utils_secu import enable_token_authorization, TokenAuthConfig
    from mase_utils_secu.types import CurrentUser, get_current_user

    app = FastAPI(title="Test token verification (mase-secu)")

    enable_token_authorization(
        app,
        public_paths=["/health"],
        config=TokenAuthConfig(
            jwt_uri=TEST_JWT_URI,
            iam_alg="RS256",
            mase_api_authentication=TEST_MASE_API_AUTH,
            mase_api_iam=TEST_MASE_API_IAM,
            allowed_origins=[o.strip() for o in TEST_CORS_ORIGINS.split(",")],
            allowed_methods=["*"],
            allowed_headers=["*"],
        ),
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/me")
    def me(user: CurrentUser = Depends(get_current_user)) -> dict[str, Any]:
        return {"sub": getattr(user, "sub", None), "username": getattr(user, "username", None)}

    return app


def _get_app():
    """Lazy build app (una sola volta) per evitare di reimpostare env più volte."""
    if _get_app._app is None:
        _get_app._app = _build_app_with_mase_secu()
    return _get_app._app


_get_app._app = None


def _verify_with_mase_secu(cookie: str, fgp: str) -> tuple[int, dict[str, Any]]:
    """
    Verifica token e FGP tramite mase-utils-secu: richiesta a route protetta con Cookie + fgp.
    Restituisce (status_code, response_json).
    """
    from fastapi.testclient import TestClient
    app = _get_app()
    client = TestClient(app, base_url="http://test")
    response = client.get("/me", headers={"Cookie": cookie, "fgp": fgp})
    try:
        body = response.json()
    except Exception:
        body = {}
    return response.status_code, body


# --- Test ---


def test_extract_access_token_from_cookie() -> None:
    """Verifica che l'access_token venga estratto correttamente dal cookie."""
    token = _extract_access_token(TEST_COOKIE)
    assert token is not None
    assert token.startswith("eyJ")
    assert len(token.split(".")) == 3


def test_fgp_and_cookie_consistent() -> None:
    """Verifica che il FGP sia coerente con il cookie uuid-{fgp}."""
    assert TEST_FGP == "a287974e-a15b-4756-9de0-a537690b34da"
    assert f"uuid-{TEST_FGP}=" in TEST_COOKIE


def test_mase_secu_accepts_cookie_and_fgp() -> None:
    """
    Verifica token e FGP tramite mase-utils-secu: richiesta a /me con Cookie e header fgp.
    La libreria valida JWT (JWKS) e FGP (firma ECDSA MASE); se tutto ok → 200 e user in response.
    """
    try:
        from mase_utils_secu import enable_token_authorization  # noqa: F401
    except ImportError:
        if pytest is not None:
            pytest.skip("mase-utils-secu non installato (build senza Nexus)")
        return
    status, body = _verify_with_mase_secu(TEST_COOKIE, TEST_FGP)
    assert status == 200, f"mase-secu ha rifiutato la richiesta: {status} {body}"
    assert "sub" in body
    assert body["sub"] == "16b19868-e852-4652-93c9-923bbc4da897"


# --- Esecuzione standalone ---


if __name__ == "__main__":
    print("Verifica token e FGP con mase-utils-secu (JWT + FGP)")
    print("  JWT_URI=", TEST_JWT_URI)
    print("  MASE_SECU_SSL_VERIFY=", TEST_SSL_VERIFY)
    print("  FGP=", TEST_FGP[:8] + "...")
    try:
        from mase_utils_secu import enable_token_authorization  # noqa: F401
    except ImportError:
        print("ERRORE: mase-utils-secu non installato. Installare con PIP_EXTRA_INDEX_URL (Nexus).")
        sys.exit(1)
    status, body = _verify_with_mase_secu(TEST_COOKIE, TEST_FGP)
    if status == 200:
        print("OK - mase-secu ha accettato cookie e FGP.")
        print("  Response:", body)
    else:
        print("ERRORE - mase-secu ha rifiutato la richiesta:", status, body)
        sys.exit(1)
