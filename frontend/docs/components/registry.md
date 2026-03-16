# Configurazione registry (dxc-webkit)

**dxc-webkit** non è su npm pubblico; è pubblicato sul **registry Nexus 3** interno MASE.

## Registry npm

| Ambiente | URL |
|----------|-----|
| **Nexus 3 (MASE)** | `https://nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv/repository/npm-group/` |

Il pacchetto viene risolto da lì (es. `dxc-webkit-1.5.0.tgz` / `1.6.0` nello stesso repository).

## Configurazione

1. Creare o copiare `.npmrc` nella root del progetto (come in **cu1.5-fe-MVP3-local**):

   ```ini
   registry=https://nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv/repository/npm-group/
   strict-ssl=false
   ```

2. Se il registry richiede autenticazione, aggiungere le credenziali (o usare un token) secondo le istruzioni dell’infrastruttura MASE.

3. Eseguire `npm install` (o `yarn`).

**Certificati SSL scaduti:** se il registry Nexus ha certificati scaduti e `npm install` fallisce con errore di verifica TLS, eseguire (solo in sviluppo, in ambiente controllato):

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm install
```

In `.npmrc` è già presente `strict-ssl=false`; la variabile d’ambiente disabilita anche la verifica a livello Node. È consigliabile far rinnovare i certificati dal team infrastruttura.

Se non hai accesso al registry, le altre due librerie (**react-select**, **react-toastify**) si installano da npm pubblico; i componenti in `@/shared/ui-components` che dipendono da dxc-webkit andranno sostituiti o mockati fino a quando il package non sarà disponibile.

---

## Verifica raggiungibilità e diagnosi errori

Il registry usa il dominio interno **`.mase.priv`**, quindi è raggiungibile solo da determinate reti (VPN MASE o rete aziendale). **Esegui i controlli sotto dal tuo PC (con VPN attiva)**; i test eseguiti da altri ambienti (CI, IDE remoto, ecc.) possono dare NXDOMAIN anche se da te il registry è raggiungibile.

**Verifica rapida dal browser:** se aprendo [https://nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv](https://nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv) la pagina risponde (anche con login), dalla stessa macchina anche `npm install` può raggiungere il registry; esegui l’install da terminale nella cartella del progetto.

### 1. Controllo DNS

```bash
host nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv
# oppure
nslookup nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv
```

| Risultato | Causa probabile | Cosa fare |
|-----------|-----------------|-----------|
| **`not found` / `NXDOMAIN`** | Il nome non viene risolto: il DNS che usi (rete locale, VPN spenta) non conosce il dominio `.mase.priv`. | Connettersi alla **VPN aziendale MASE** o usare un PC sulla **rete interna** dove il DNS risolve i domini `.mase.priv`. |
| **Indirizzo IP restituito** | DNS ok; il problema può essere rete/firewall/porta (vedi punto 2). | Procedere con il controllo HTTP. |

### 2. Controllo connessione HTTP

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" --connect-timeout 10 \
  "https://nexus3-cdp.apps.dxccdp-svil.ocp.mase.priv/repository/npm-group/"
```

| Risultato | Causa probabile | Cosa fare |
|-----------|-----------------|-----------|
| **`HTTP 200`** (o **`401`**) | Registry raggiungibile. Con 401 serve autenticazione. | Configurare credenziali in `.npmrc` se richiesto; poi `npm install`. |
| **`Connection timed out`** | Il server non risponde: firewall, rete non autorizzata, o servizio down. | Verificare di essere in VPN/rete MASE; contattare l’infrastruttura se il problema persiste. |
| **`Could not resolve host`** | Stesso problema del punto 1: DNS non risolve il nome. | Come per NXDOMAIN: VPN o rete interna. |
| **Errore certificato SSL** | Certificato non fidato (es. interno/self‑signed). | Nel progetto è già usato `strict-ssl=false` in `.npmrc`; se l’errore persiste, verificare proxy/certificati di rete. |

### 3. Riepilogo cause tipiche

| Problema | Causa | Soluzione |
|----------|--------|-----------|
| **NXDOMAIN / host not found** | Dominio `.mase.priv` risolvibile solo in rete MASE. | Attivare **VPN MASE** o lavorare da **rete aziendale**. |
| **Timeout** | Rete o firewall blocca l’accesso al server Nexus. | Stessa rete/VPN; in caso contrario aprire un ticket all’infrastruttura. |
| **401 Unauthorized** | Registry richiede login. | Aggiungere in `.npmrc` (o in un file sicuro) `_auth` / `_authToken` come da istruzioni MASE. |
| **SSL certificate** | Certificato non riconosciuto. | `.npmrc` con `strict-ssl=false`; per ambienti con proxy, verificare variabili `HTTP_PROXY` / `HTTPS_PROXY` e certificati. |

Dopo aver risolto DNS/rete, in **cadastre/frontend** eseguire `npm install` per verificare che **dxc-webkit** venga scaricato correttamente.
