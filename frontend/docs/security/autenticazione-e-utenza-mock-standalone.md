# Autenticazione, autorizzazione e utenza mock in standalone

Documentazione del flusso di autenticazione del microfrontend **Catasto arboreo** (@mase/siv), integrazione con portale MASE e backend, e **utenza mockata** in modalità standalone (compose).

---

## Panoramica

Il microfrontend **non gestisce il login**: l’utente si autentica nello **shell** (portale MASE). Il frontend:

- **Invia** alle REST API **FGP** (header) e **cookie** di sessione.
- **Riceve** i dati utente dallo shell (Single-SPA `customProps`) e li espone nello store.

**Non viene usato alcun JWT** lato frontend: la sessione è basata su **cookie** e **header FGP**. La verifica dell’identità e dei permessi avviene sul **backend**, che si appoggia all’**IAM (Keycloak)**.

---

## Meccanismi utilizzati

| Meccanismo | Dove | Ruolo |
|------------|------|--------|
| **Header `fgp`** | `sessionStorage.getItem('fgp')` | Token/identificativo di sessione inviato in ogni richiesta HTTP. Valorizzato dallo shell/portale dopo il login. |
| **Cookie** | `credentials: 'include'` nella fetch | Il browser invia automaticamente i cookie di sessione (impostati da IAM/portale al login). |
| **Stato utente** | `useAuthStore` (Zustand) | Profilo utente (nome, email, authorities) ricevuto dallo shell e usato in UI. |

---

## Flusso completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. UTENTE ACCEDE AL PORTALE MASE (shell)                                     │
│     → Login su IAM (Keycloak)                                                 │
│     → Shell riceve sessione: cookie + eventuale FGP in sessionStorage         │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. NAVIGAZIONE AL MICROFRONTEND (es. /siv/...)                               │
│     → Single-SPA monta @mase/siv                                             │
│     → mount(props) chiama authService.setUserFromProps(props)                 │
│     → Se lo shell passa customProps.user → useAuthStore viene aggiornato      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. CHIAMATE API DAL MICROFRONTEND                                            │
│     → Territory API (e ogni altro client) usa authFetch come fetchFn           │
│     → authFetch: per ogni richiesta invia header "fgp" + credentials: include │
│     → Backend riceve cookie + header fgp e valida la sessione (IAM/Keycloak)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Componenti lato frontend

### 1. `authFetch` — richieste autenticate

**Percorso:** `src/shared/lib/auth/authFetch.ts`

- Legge **FGP** da `sessionStorage['fgp']`.
- Espone una funzione `(url: string) => Promise<Response>` che:
  - aggiunge l’header **`fgp`** (se presente);
  - usa **`credentials: 'include'`** per inviare i cookie.
- È il **fetchFn** di default per `createTerritoryApi` e per tutte le API territorio (regions, provinces, green areas, green assets).

```ts
import { authFetch, createAuthFetch } from '@/shared/lib/auth'

// Uso tipico: passato a createTerritoryApi / createFetcher
createTerritoryApi({ baseUrl: API_URL, fetchFn: authFetch })
```

### 2. `useAuthStore` — stato utente

**Percorso:** `src/app/store/useAuthStore.ts`

- Store Zustand con: `user`, `isAuthenticated`, `isLoading`.
- Azioni: `setUser`, `setIsLoading`, `logout` (solo reset locale, nessun token da invalidare).
- Tipo **AuthUser**: `nome`, `cognome`, `email`, `preferred_username`, `authorities`.

```ts
import { useAuthStore } from '@/app/store'

const { user, isAuthenticated, logout } = useAuthStore()
```

### 3. `authService` — collegamento con lo shell

**Percorso:** `src/app/auth/authService.ts`

- **setUserFromProps(props)**  
  Legge `props.customProps?.user` (Single-SPA) e aggiorna lo store. Chiamato in `mount(props)`.
- **logout()**  
  Esegue `useAuthStore.getState().logout()` (pulizia stato; il logout effettivo avviene nello shell/portale).

### 4. Mount Single-SPA

**Percorso:** `src/mase-siv.tsx`

- In **mount(props)** vengono eseguiti, in ordine:
  1. attesa di `i18nReady`;
  2. `authService.setUserFromProps(props)` per allineare lo stato utente allo shell;
  3. mount del componente React.

---

## Integrazione con il backend e Keycloak

- Il **backend** (es. servizi REST del catasto o altri CU) riceve ogni richiesta con **cookie** e **header `fgp`**.
- La **validazione della sessione** e l’**autorizzazione** sono responsabilità del backend, tipicamente con:
  - **Spring Security** + OAuth2 Resource Server (JWT validati con JWKS dell’IAM);
  - libreria **it.mase.secu** (autenticazione MASE, cookie/FGP, integrazione IAM).
- L’**IAM** (in ambiente MASE spesso **Keycloak**) espone:
  - endpoint OpenID Connect (es. `/protocol/openid-connect/certs` per JWKS);
  - gestione login, cookie di sessione e, se previsto, emissione/gestione del contesto FGP.

Il microfrontend non parla direttamente con Keycloak: si limita a inoltrare **FGP** e **cookie** già impostati dal portale.

---

## Utilizzo nei componenti

- **Leggere utente e stato di autenticazione:**

```tsx
const user = useAuthStore((s) => s.user)
const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
```

- **Logout lato microfrontend** (solo pulizia stato; redirect/logout reale resta allo shell):

```tsx
const logout = useAuthStore((s) => s.logout)
// oppure
import { authService } from '@/app/auth'
authService.logout()
```

- **Nuove API che devono essere autenticate:** usare `authFetch` come `fetchFn` (o un client che già lo usa), in modo che ogni richiesta invii FGP e cookie.

---

## Modalità standalone vs shell

| Modalità | FGP / cookie | Stato utente |
|----------|----------------|--------------|
| **Shell** (portale MASE) | Lo shell imposta cookie e `sessionStorage['fgp']` dopo il login. Le chiamate con `authFetch` li inviano. | Lo shell può passare `customProps.user` in `mount(props)`; `setUserFromProps` aggiorna lo store. |
| **Standalone** | In locale spesso non c’è login IAM: `fgp` assente, cookie assenti. Le API possono rispondere 401 o consentire accesso limitato in base alla configurazione backend. | `customProps.user` di solito non c’è; lo store resta vuoto finché non si fornisce un altro modo per impostare l’utente. |

---

## Utenza mockata in standalone (compose)

Avviando il frontend in **standalone** tramite compose (es. `Dockerfile.standalone`) è possibile passare un’**utenza mockata** tramite variabili d’ambiente, così che l’app invii FGP (e opzionalmente cookie) e mostri un utente in UI senza passare dallo shell.

### Variabili d’ambiente

| Variabile | Descrizione |
|-----------|-------------|
| **VITE_MOCK_FGP** | Valore scritto in `sessionStorage['fgp']`; inviato come header `fgp` in ogni richiesta (es. UUID sessione). |
| **VITE_MOCK_USER** | JSON dell’utente impostato nello store (es. `{"preferred_username":"user@test","nome":"Nome","cognome":"Cognome","email":"user@test"}`). |
| **VITE_MOCK_COOKIE** | Stringa in formato header Cookie (`name=value; name2=value2`). Impostata su `document.cookie` all’avvio. I cookie **httpOnly** non sono impostabili da JS; per sessioni complete il backend potrebbe richiedere cookie impostati dall’IAM o da DevTools. |

### Dove configurarle

- **Compose:** nel file `.env` della cartella `cadastre/infrastructure/compose/` (o in un file caricato dal compose). Le variabili sono passate al servizio `frontend` nel `docker-compose.yml`.
- **Locale (senza Docker):** in un `.env` nella root del frontend; Vite le espone con prefisso `VITE_`.

### Comportamento del bootstrap

- All’avvio dell’app, in `main.tsx` viene chiamato **`initMockAuth()`** (da `src/app/auth/mockAuth.ts`) **prima** del render.
- Se `VITE_MOCK_FGP` è impostato → viene scritto in `sessionStorage['fgp']`.
- Se `VITE_MOCK_USER` è impostato → il JSON viene parsato e passato a `useAuthStore.getState().setUser(user)`.
- Se `VITE_MOCK_COOKIE` è impostato → la stringa viene spezzata per `; ` e ogni `name=value` viene impostato su `document.cookie` (path `/`, SameSite=Lax).
- Solo per sviluppo/test; non usare in produzione.

### Esempio in `.env` (compose)

```env
VITE_MOCK_FGP=f9a7d493-4bf3-4a8e-bb2e-a0edd5714542
VITE_MOCK_USER={"preferred_username":"utente16@mase","nome":"Giulio Cesare","cognome":"Di Giovambattista","email":"utente16@mase.com"}
# VITE_MOCK_COOKIE opzionale: stringa in formato name=value; name2=value2 (per cookie lunghi usare file e source in .env)
```

### Limitazioni sui cookie mock

- I cookie impostati da JavaScript **non** possono essere `httpOnly`; il backend potrebbe aspettarsi cookie impostati dalla risposta IAM (Set-Cookie httpOnly).
- Per replicare una sessione reale (es. con `access_token`, `JSESSIONID`, ecc.) si può: incollare la stringa in `VITE_MOCK_COOKIE` (una riga, eventualmente tra virgolette nel `.env`), oppure impostare i cookie manualmente in DevTools (Application → Cookies) dopo aver aperto l’app.

---

## Riepilogo

- **Autenticazione richieste:** FGP (header) + cookie, inviati tramite **authFetch**.
- **Stato utente in UI:** **useAuthStore**; valorizzato da **authService.setUserFromProps** in mount (shell) o da **initMockAuth** in standalone (variabili mock).
- **Nessun JWT** gestito dal frontend; verifica sessione e permessi sul **backend**, con **IAM (Keycloak)**.
- **Ruolo del microfrontend:** usare le credenziali già fornite dallo shell (cookie + FGP) e mostrare l’utente ricevuto via Single-SPA; in standalone è possibile usare **VITE_MOCK_FGP**, **VITE_MOCK_USER** e **VITE_MOCK_COOKIE** per un’utenza mockata.
