# mase-utils-secu — Autenticazione e autorizzazione

Libreria Python MASE per **autenticazione** (JWT da cookie, FGP + firma ECDSA) e **autorizzazione** (ruoli/enti/gruppi da IAM, `pre_authorize`). Integra con FastAPI tramite middleware e dependency injection.

---

## A cosa serve

- **Autenticazione utente:** lettura del JWT da cookie `access_token`, decodifica con JWKS (Keycloak/IAM), refresh automatico con `refresh_token`.
- **Verifica FGP (fingerprint):** per client non mobile, verifica che l’header `fgp` sia associato a una firma ECDSA nel cookie `uuid-{fgp}` (anti-replay/session binding).
- **Profilo utente da IAM:** chiamata all’API IAM (`resources_access`) per ottenere ruoli, enti, gruppi e applicativi; costruzione del modello `User` in `request.state.user`.
- **Autorizzazione:** dependency `pre_authorize(required_authorities)` per proteggere route in base a ruoli/gruppi.
- **Auth M2M (machine-to-machine):** header `m2m-token` con token OTP per servizi (modello `ServiceAuthenticated`).
- **Propagazione credenziali in uscita:** classe `Authorization` (httpx.Auth) che estrae cookie/header dalla request e li applica alle chiamate HTTP in uscita, aggiornando i cookie sulla response (es. dopo refresh).

### Chi verifica cosa (cookies vs Keycloak, FGP vs MASE)

- **Cookie `access_token` (JWT):** il backend **non** invia i cookie a Keycloak. Usa l’URL **JWKS** (es. `JWT_URI` che punta a Keycloak `/protocol/openid-connect/certs`) per scaricare le **chiavi pubbliche** e **verificare la firma** del JWT in locale. Quindi il token viene **validato contro Keycloak** (firma, exp, ecc.) senza che Keycloak riceva la richiesta. Il refresh del token usa invece il servizio di autenticazione MASE (`MASE_API_AUTHENTICATION` + `/oidc/refresh_token`).
- **FGP (header + cookie `uuid-{fgp}`):** **non** viene verificato su Keycloak. La libreria scarica la **chiave pubblica ECDSA** dal servizio **MASE** (`MASE_API_AUTHENTICATION` + `/public-key/download`) e verifica la firma contenuta nel cookie per il testo `idUser={sub}; uuid={fgp};`. Serve a legare la sessione (fgp) all’utente (sub) e a mitigare il furto del solo token.

In sintesi: **JWT = verificato con le chiavi Keycloak (JWKS)**; **FGP = verificato con il servizio di autenticazione MASE** (chiave pubblica ECDSA).

---

## Dipendenze e installazione

```text
# requirements.txt (esempio con registry Nexus)
--index-url https://nexus.../repository/pypi-public/simple/
--trusted-host nexus...
mase-utils-secu==1.6.0
```

Dipendenze principali della libreria: `fastapi`, `starlette`, `httpx`, `python-jose`, `pyjks`, `pyotp`, `ecdsa`, `pydantic`.

---

## Configurazione (variabili d’ambiente)

| Variabile | Descrizione |
|-----------|-------------|
| `AUTH_ENABLED` | (Backend cadastre) Se `true`/`1`/`yes` abilita il middleware secu (servono anche `JWT_URI` e `MASE_API_AUTHENTICATION`). `false` o assente = auth disabilitata. |
| `JWT_URI` | URL JWKS (es. Keycloak `/protocol/openid-connect/certs`) per validare il JWT. |
| `IAM_ALG` | Algoritmo JWT (default `RS256`). |
| `JWKS_INDEX` | Indice della chiave nel JSON JWKS (default `0`). Con sim-dev il token usa la seconda chiave: impostare `JWKS_INDEX=1` per evitare "Signature verification failed". |
| `MASE_API_AUTHENTICATION` | Base URL del servizio di autenticazione MASE (per chiave pubblica ECDSA e `auth_iam_props`). |
| `MASE_API_IAM` | Base URL API IAM per `resources_access` (ruoli/enti/gruppi). |
| `ALLOWED_ORIGINS` | Origini CORS consentite (separate da virgola). |
| `ALLOWED_METHODS` | Metodi CORS (default `*`). |
| `ALLOWED_HEADERS` | Header CORS (default `*`). |
| `OTP_SECRET` | (Opzionale) Secret per token OTP M2M; se assente, auth M2M disabilitata. |
| `CACHE_MAX_ITEMS` | Max elementi cache utenti deserializzati (default `500`). |
| `CACHE_TIMEOUT_SECONDS` | TTL cache utenti (default `10.0`). |

---

## Uso in FastAPI

### 1. Abilitare l’autenticazione (una sola volta)

Dopo aver creato l’app FastAPI, chiamare **una sola volta** `enable_token_authorization`:

```python
from fastapi import FastAPI
from mase_utils_secu import enable_token_authorization, TokenAuthConfig, public_path

app = FastAPI()

# Opzione A: solo path pubblici (stringhe)
enable_token_authorization(app, public_paths=["/health", "/public/hello"])

# Opzione B: path pubblici + config esplicita
config = TokenAuthConfig(
    jwt_uri=os.getenv("JWT_URI"),
    iam_alg="RS256",
    mase_api_authentication=os.getenv("MASE_API_AUTHENTICATION"),
    mase_api_iam=os.getenv("MASE_API_IAM"),
    allowed_origins=os.getenv("ALLOWED_ORIGINS", "").split(","),
)
enable_token_authorization(app, public_paths=["/health"], config=config)
```

- Le route il cui **path** è in `public_paths` (e quelle marcate con `@public_path`, vedi sotto) **non** richiedono autenticazione; su di esse `request.state.user` viene lasciato `None`.
- Tutte le altre route richiedono cookie `access_token` (e, per client non mobile, header `fgp` + cookie `uuid-{fgp}` con firma valida).

### 2. Marcare una route come pubblica (decorator)

Per esporre una route come pubblica **per path e metodo** (senza doverla elencare in `public_paths`):

```python
from mase_utils_secu import public_path

@public_path
@app.get("/my-public-endpoint")
def my_public():
    return {"message": "ok"}
```

- `@public_path` va usato **prima** di `enable_token_authorization`. La route non può avere dependency `pre_authorize` né parametri `CurrentUser`.

### 3. Ottenere l’utente corrente

```python
from mase_utils_secu.types import CurrentUser, OptionalCurrentUser, get_current_user

@app.get("/me")
def me(user: CurrentUser):
    # user è MaseAuthenticated (User o ServiceAuthenticated)
    return {"username": user.username, "sub": user.sub}

@app.get("/optional")
def optional(user: OptionalCurrentUser = None):
    if user is None:
        return {"message": "anonymous"}
    return {"username": user.username}
```

- **`CurrentUser`:** dependency che restituisce `request.state.user`; se assente solleva `401 Unauthorized`.
- **`OptionalCurrentUser`:** come sopra ma restituisce `None` se non autenticato (utile per route che possono essere pubbliche o autenticate).

### 4. Autorizzazione per ruoli/gruppi (`pre_authorize`)

```python
from mase_utils_secu.types import CurrentUser, pre_authorize

@app.get("/admin-only", dependencies=[pre_authorize(["APP_NAME:ADMIN"])])
def admin_only(user: CurrentUser):
    return {"message": "admin"}

# Più autorità: l’utente deve avere almeno una delle autorità indicate
@app.get("/editor", dependencies=[pre_authorize(["APP_NAME:EDITOR", "APP_NAME:ADMIN"])])
def editor(user: CurrentUser):
    return {"message": "editor or admin"}
```

- **`required_authorities`** sono stringhe nel formato `applicativo:RUOLO` (es. `dxp:ADMIN`). Per utenti **User**, la libreria controlla `user.authorityGroups`; se l’utente ha almeno un’autorità richiesta, i gruppi associati vengono messi in `user.allowedGroups`. Se nessuna autorità è presente → `403 Forbidden`.
- Per utenti **ServiceAuthenticated** (M2M), viene controllato che `user.id` (uppercase) sia tra le `required_authorities`.

### 5. Propagare cookie e header alle chiamate in uscita (Authorization)

Per chiamare altri servizi (es. IAM o microservizi) reutilizzando cookie e header della request corrente:

```python
from fastapi import Request, Depends
from mase_utils_secu.types import get_authorization, Authorized

@app.get("/proxy")
async def proxy(auth: Authorized):
    # auth è un httpx.Auth che invia cookie + header "fgp" nelle richieste
    async with auth.httpx_async_client(base_url="https://other-service") as client:
        r = await client.get("/api/data")
        return r.json()
```

- **`get_authorization(request)`** crea un’istanza di `Authorization` che:
  - Estrae dalla request header `cookie`, `fgp` e cookie `access_token`, `refresh_token`, `uuid-*`.
  - Implementa `auth_flow` httpx: dopo la risposta, legge i `Set-Cookie` e aggiorna i cookie da propagare.
- Se nel middleware è stato fatto un refresh token, i nuovi cookie vengono scritti sulla **Response** FastAPI tramite `authorization.set_response(response)` (chiamato dal middleware alla fine della richiesta).
- Per usare la dependency: `auth: Authorized = Depends(get_authorization)` (o l’alias `Authorized`).

---

## Modelli principali e dati utente

Dopo l’autenticazione il middleware imposta **`request.state.user`** con un’istanza di **`User`** (o **`ServiceAuthenticated`** per M2M). Da lì si risale a identità, ruoli e contesto.

### User (utente da IAM)

| Attributo | Tipo | Descrizione |
|-----------|------|-------------|
| **username** | `str \| None` | Nome utente (es. `preferred_username`). |
| **sub** | `str` | Subject/ID utente (UUID). |
| **nome** | `str` | Nome. |
| **cognome** | `str` | Cognome. |
| **email** | `str \| None` | Email. |
| **codFiscale** | `str \| None` | Codice fiscale. |
| **ente** | `str \| None` | Ente di appartenenza. |
| **authorities** | `list[str]` | Ruoli in formato `applicativo:RUOLO` (es. `dxp:ADMIN`, `dxp:CONSULTANT`). |
| **applications** | `list[str]` | Applicativi a cui l’utente ha accesso. |
| **groups** | `list[str]` | Tutti i gruppi dell’utente. |
| **allowedGroups** | `list[str]` | Gruppi consentiti per la route (compilato da `pre_authorize`). |
| **authorityGroups** | `dict[str, list[str]]` | Mappa autorità → gruppi. |
| **authorityEntes** | `dict[str, list[str]]` | Mappa autorità → enti. |
| **entes** | `list[Ente]` | Enti con gruppi e applicativi (struttura annidata). |
| **flgSpid** | `bool \| None` | Flag SPID. |

Esempio in una route:

```python
from mase_utils_secu.types import CurrentUser, User

def me(user: CurrentUser):
    if isinstance(user, User):
        return {
            "username": user.username,
            "nome": user.nome,
            "cognome": user.cognome,
            "email": user.email,
            "ruoli": user.authorities,
            "gruppi": user.groups,
        }
    return {"id": user.id}  # ServiceAuthenticated
```

### ServiceAuthenticated (M2M)

- **id**: identificativo del servizio.
- **totp**: valore TOTP (uso interno).

### MaseAuthenticated

Classe base (Pydantic + ABC) per `User` e `ServiceAuthenticated`; usata in `CurrentUser` / `OptionalCurrentUser`.

---

## Flusso del middleware (in sintesi)

1. Se la request è in whitelist (path pubblico o route con `@public_path`) → `request.state.user = None`, nessuna verifica, si prosegue.
2. Se non c’è `access_token` ma è configurato OTP → tentativo auth M2M con header `m2m-token`; in successo `request.state.user = ServiceAuthenticated`.
3. Altrimenti:
   - Decodifica JWT da `access_token` (JWKS).
   - Per client non mobile: verifica header `fgp` e firma ECDSA nel cookie `uuid-{fgp}` (chiave pubblica da `MASE_API_AUTHENTICATION`).
   - Chiamata IAM `resources_access` (con cache per access_token) e costruzione `User` in `request.state.user`.
4. Se il JWT è scaduto: uso di `refresh_token` per ottenere nuovi cookie; aggiornamento della request e riesecuzione del passo 3; i nuovi cookie vengono scritti sulla response.
5. Alla fine della request, se è presente `request.state.authorization`, viene chiamato `authorization.set_response(response)` per scrivere i cookie aggiornati.

---

## Autenticazione M2M (m2m-token)

Se è impostato `OTP_SECRET`, il middleware accetta anche l’header **`m2m-token`**: un token OTP verificato da `TokenOtpHandler`. In caso di successo, `request.state.user` è un’istanza di **`ServiceAuthenticated`** (`id`, `totp`). Le route possono usare `pre_authorize([...])` con l’`id` del servizio per limitare l’accesso.

---

## Cosa non fa la libreria

- **Non** gestisce login UI o redirect a Keycloak: l’access_token/refresh_token arrivano dal portale/shell che ha già autenticato l’utente.
- **Non** valida permessi a livello di singola risorsa (es. “può modificare solo il record X”): fornisce solo ruoli/gruppi e `pre_authorize` su base ruoli; la logica fine va implementata in applicazione.

---

## Riepilogo per gli sviluppatori

| Necessità | Cosa usare |
|-----------|------------|
| Proteggere l’app con JWT + FGP + IAM | `enable_token_authorization(app, public_paths=[...])` |
| Route senza login | Aggiungere il path in `public_paths` o usare `@public_path` sulla route |
| Utente corrente in una route | Parametro `user: CurrentUser` (o `OptionalCurrentUser`) |
| Solo certi ruoli/gruppi | `dependencies=[pre_authorize(["APP:ROLE"])]` |
| Chiamate HTTP in uscita con cookie/fgp | `auth: Authorized` e `auth.httpx_async_client(...)` |
| Auth servizio-to-servizio | Header `m2m-token` + `OTP_SECRET`; `request.state.user` → `ServiceAuthenticated` |
