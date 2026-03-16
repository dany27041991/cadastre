# mase-utils-cache — Cache distribuita Hazelcast

Libreria Python MASE che espone **decoratori** per mettere in cache i risultati di funzioni usando **Hazelcast** come backend distribuito. Utile per ridurre chiamate ripetute a DB o servizi esterni e condividere la cache tra più istanze dell’applicazione.

---

## A cosa serve

- **`@cacheable(name, key)`** — Legge dalla cache; se il valore c’è lo restituisce, altrimenti esegue la funzione, salva il risultato nella mappa Hazelcast e lo restituisce.
- **`@cache_evict(name, key, before_invocation, all_entries)`** — Invalida una o più mappe (per chiave o intera mappa) prima e/o dopo l’esecuzione della funzione.
- **`@cache_put(name, key)`** — Esegue sempre la funzione e scrive il risultato in cache (utile per aggiornare la cache senza “leggere prima”).

I nomi delle mappe devono terminare con **`_py`** (convenzione per distinguere le mappe usate da questo layer da quelle eventualmente usate da altri linguaggi).

---

## Dipendenze e installazione

```text
# requirements.txt (esempio con registry Nexus)
--index-url https://nexus.../repository/pypi-public/simple/
--trusted-host nexus...
mase-utils-cache==1.1.0
```

Dipendenze principali: `hazelcast-python-client`, `mase-utils-commons` (per serializzazione JSON degli oggetti).

---

## Configurazione (variabili d’ambiente)

| Variabile | Descrizione |
|-----------|-------------|
| `HAZELCAST_ENABLED` | Se valorizzato (es. `true`), il client Hazelcast viene creato; altrimenti i decoratori eseguono solo la funzione senza cache. |
| `HAZELCAST_CLUSTER_NAME` | Nome del cluster Hazelcast. |
| `HAZELCAST_ADDRESS` | Indirizzo del membro (es. `localhost:5701`). Usato se non sono impostati service name e namespace. |
| `HAZELCAST_SERVICE_NAME` | (Opzionale) Nome del servizio in Kubernetes. |
| `HAZELCAST_NAMESPACE` | (Opzionale) Namespace Kubernetes. Se presenti, i membri sono `{HAZELCAST_SERVICE_NAME}.{HAZELCAST_NAMESPACE}`. |

Se `HAZELCAST_ENABLED` non è impostato o il client non è connesso, i decoratori **non** sollevano eccezioni: eseguono la funzione senza leggere/scrivere cache (fallback “no cache”).

---

## Uso

### 1. Cacheable — leggere o calcolare e mettere in cache

```python
from mase_utils_cache import cacheable

@cacheable(name="my_cache_py")  # nome mappa deve finire con _py
def get_item(item_id: str) -> dict:
    # chiamata DB o servizio esterno
    return {"id": item_id, "name": "..."}

# Prima chiamata: esegue get_item e salva in Hazelcast sotto chiave derivata da (item_id)
# Chiamate successive con stesso item_id: ritorna il valore dalla cache
result = get_item("123")
```

**Chiave di cache:** di default è un hash (MD5) di tutti gli argomenti posizionali. Per funzioni con molti parametri è meglio usare solo alcuni campi con `key`:

```python
@cacheable(name="users_py", key=["user_id"])
def get_user(user_id: str, include_roles: bool = False) -> User:
    ...

# La chiave di cache è derivata solo da user_id (include_roles ignorato)
```

`key` è una lista di **nomi di parametri** in notazione dot per accedere a sotto-campi (es. `["request.user.id"]` se il primo argomento ha un attributo `user.id`). Il valore usato per la chiave non può essere `None`.

**Tipo di ritorno:** se la funzione ha type hint `return` (es. `-> User` o `-> list[User]`), il valore letto dalla cache viene deserializzato con `mase_utils_commons.json_to_object` nel tipo indicato; altrimenti si ottiene il dict/list così com’è salvato in JSON.

---

### 2. Cache_evict — invalidare la cache

Utile dopo operazioni di scrittura (create/update/delete) per evitare dati obsoleti.

```python
from mase_utils_cache import cache_evict

@cache_evict(name=["users_py"], key=["user_id"], before_invocation=True)
def update_user(user_id: str, data: dict):
    # prima invalida la voce per user_id, poi esegue update_user
    ...

# Invalidare tutte le entry della mappa (dopo un’operazione “globale”)
@cache_evict(name=["users_py"], all_entries=True, before_invocation=True)
def reload_all_users():
    ...
```

| Parametro | Descrizione |
|-----------|-------------|
| `name` | Lista di nomi di mappe (es. `["users_py", "roles_py"]`). |
| `key` | Lista di “key props” come in `cacheable`; se vuota la chiave è derivata da tutti gli argomenti. |
| `before_invocation` | Se `True`, l’evict avviene prima della chiamata alla funzione; se `False`, dopo. |
| `all_entries` | Se `True`, viene chiamato `destroy()` sulla mappa; se `False`, viene rimosso solo l’entry con la chiave calcolata. |

---

### 3. Cache_put — scrivere sempre in cache

Esegue sempre la funzione e salva il risultato in cache. Non legge dalla cache (a differenza di `cacheable`).

```python
from mase_utils_cache import cache_put

@cache_put(name="stats_py", key=["scope"])
def compute_stats(scope: str) -> dict:
    ...
    return {"count": 42}
```

Utile quando si vuole aggiornare la cache in modo esplicito (es. dopo un’operazione che cambia i dati e si vuole riscrivere la voce corrispondente).

---

## Limitazioni e note

- **Funzioni async:** la versione attuale dei decoratori è pensata per funzioni **sincrone**. L’uso su funzioni async può richiedere adattamenti o versioni future della libreria.
- **Serializzazione:** i valori vengono salvati in Hazelcast come **stringa JSON**. La libreria usa `mase_utils_commons.object_to_json` / `json_to_object` per oggetti Python; tipi base (dict, list, str, int, ecc.) sono supportati.
- **Naming:** il nome della mappa deve terminare con `_py` (es. `users_py`), altrimenti il decoratore solleva eccezione.
- **Client non connesso:** se il client Hazelcast non è configurato o non ha connessioni attive, i decoratori eseguono solo la funzione, senza errore.

---

## Riepilogo per gli sviluppatori

| Obiettivo | Decoratore | Esempio |
|-----------|------------|---------|
| Leggere da cache o calcolare e salvare | `@cacheable(name="..._py", key=[...])` | `get_user(user_id)` |
| Invalidare cache dopo una write | `@cache_evict(name=["..._py"], key=[...])` | `update_user(user_id, data)` |
| Invalidare tutta una mappa | `@cache_evict(name=["..._py"], all_entries=True)` | `reload_all_users()` |
| Sempre eseguire e aggiornare la cache | `@cache_put(name="..._py", key=[...])` | `compute_stats(scope)` |
