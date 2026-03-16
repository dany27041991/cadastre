# Flusso autenticativo nell’infrastruttura

Questo documento descrive **in modo concreto** il flusso di autenticazione quando un client (frontend, Postman, altro servizio) usa le API nell’ambiente MASE: dal dominio pubblico al gateway, a IAM (Keycloak) e alla verifica JWT nei microservizi.

---

## 1. Il client chiama il dominio pubblico

Il client effettua una richiesta HTTP verso il dominio pubblico dell’ambiente (es. DEV):

```http
GET https://sim-dev.mase.gov.it/core/api/v1/1.5/...
Authorization: Bearer <JWT>
Cookie: access_token=...; ...
```

La richiesta **non arriva direttamente ai microservizi**: passa prima dal gateway.

```
Client
   │
   ▼
sim-dev.mase.gov.it
```

Questo dominio è l’**entrypoint pubblico** dell’ambiente.

---

## 2. Il dominio punta all’API Gateway

Il dominio pubblico è configurato per inoltrare il traffico a un gateway interno. In ambiente MASE il gateway è tipicamente:

```
nginx-api-gateway.cdp
```

Flusso:

```
Client
   │
   ▼
sim-dev.mase.gov.it
   │
   ▼
nginx-api-gateway.cdp (API Gateway)
```

Il gateway effettua il **routing delle API** in base al path.

---

## 3. Il gateway instrada la richiesta al microservizio

Il gateway legge il path e inoltra alla destinazione corretta.

### Autenticazione

Path:

```
/core/api/authentication
```

viene inoltrato al servizio di autenticazione, ad esempio:

```
mase-be-authentication-sv.develdxap-trasversali:8080
```

```
Client → sim-dev.mase.gov.it → API Gateway → mase-be-authentication-sv
```

### IAM (JWKS, certificati)

Path:

```
/core/api/iam/protocol/openid-connect/certs
```

viene inoltrato a IAM (Keycloak), ad esempio tramite:

```
nginx-api-gateway.cdp:8080/iam/protocol/openid-connect/certs
```

```
Client → sim-dev.mase.gov.it → API Gateway → IAM (Keycloak)
```

---

## 4. IAM (Keycloak) gestisce i token

IAM è il sistema che gestisce:

- login utente
- OAuth2 / OpenID Connect
- emissione e validazione JWT

In fase di login:

```
Client → Authentication API → IAM
```

IAM restituisce:

- **access_token** (JWT)
- **refresh_token**
- eventuale **id_token**

Questi token (in particolare l’access_token) vengono poi inviati dal client a ogni chiamata API (header `Authorization: Bearer <JWT>` o cookie, a seconda del flusso).

---

## 5. Il client usa il token per le API

Dopo il login, il client chiama le API di business inviando il token, ad esempio:

```http
GET /core/api/v1/1.5/resource
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Cookie: access_token=...; fgp=...; uuid-<fgp>=...
```

A seconda dell’architettura (portale/shell MASE) il token può essere inviato in cookie (`access_token`) e con header `fgp` per la verifica di sessione; il backend riceve cookie e header e li usa per autenticare la richiesta.

---

## 6. Il microservizio verifica il JWT

Il microservizio **non** conosce la chiave privata di IAM. Per verificare la firma del JWT usa l’endpoint **JWKS** (chiavi pubbliche), configurato come **JWT_URI** nel backend, ad esempio:

```
https://sim-dev.mase.gov.it/core/api/iam/protocol/openid-connect/certs
```

oppure, da dentro il cluster:

```
http://iam.apps.psnleo01.ocp.mase.priv/iam/protocol/openid-connect/certs
```

L’endpoint restituisce un JSON tipo:

```json
{
  "keys": [
    {
      "kid": "...",
      "kty": "RSA",
      "alg": "RS256",
      ...
    }
  ]
}
```

Il backend (es. tramite **mase-utils-secu**) usa queste **chiavi pubbliche** per verificare la firma del token senza dover chiamare IAM a ogni richiesta. In più può chiamare **MASE_API_AUTHENTICATION** per la chiave ECDSA (verifica FGP) e **MASE_API_IAM** per ruoli/enti/gruppi (resources_access).

---

## 7. I diversi URL verso IAM / Authentication

Nell’infrastruttura esistono più modi per raggiungere IAM e il servizio di autenticazione, a seconda di chi chiama e da dove.

| Uso | URL tipico | Note |
|-----|------------|------|
| **Client esterni** (browser, Postman) | `https://sim-dev.mase.gov.it/core/api/iam` | Tramite gateway pubblico. |
| **Dentro il cluster** (microservizi) | `http://nginx-api-gateway.cdp:8080/iam` | Gateway interno. |
| **Route OpenShift / rete interna** | `http://iam.apps.psnleo01.ocp.mase.priv/iam` | IAM esposto in rete aziendale. |

Nel backend cadastre le variabili **JWT_URI**, **MASE_API_AUTHENTICATION** e **MASE_API_IAM** devono puntare agli URL raggiungibili dal contesto in cui gira il backend (stesso cluster → URL interni; esterno → URL tramite gateway pubblico, se previsto).

---

## 8. Schema completo del flusso

```
                CLIENT
                   │
                   ▼
        https://sim-dev.mase.gov.it
                   │
                   ▼
             API Gateway
             (nginx-api-gateway.cdp)
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
   IAM (Keycloak)      Authentication API
   (certs, token)      (mase-be-authentication)
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
              JWT Token
         (access_token, cookie, fgp)
                   │
                   ▼
             Backend APIs
        (verifica JWT con JWKS, FGP, IAM)
```

---

## 9. Sintesi

1. Il **client** chiama il **dominio pubblico** (es. sim-dev.mase.gov.it).
2. Il **gateway** riceve la richiesta e la inoltra al microservizio corretto in base al path.
3. **IAM** (Keycloak) gestisce login e token (access_token, refresh_token).
4. Il **client** invia il token (header e/o cookie) a ogni chiamata API.
5. I **microservizi** validano il JWT usando l’endpoint **certs** (JWT_URI) e, se configurato, integrano FGP e IAM (MASE_API_AUTHENTICATION, MASE_API_IAM) come descritto in [mase-utils-secu](./mase-utils-secu.md).

---

## Riferimenti

- **[mase-utils-secu](./mase-utils-secu.md)** — Come il backend cadastre usa JWT_URI, MASE_API_AUTHENTICATION e MASE_API_IAM per autenticazione e autorizzazione.
