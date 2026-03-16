# mase-utils-commons — Utilità condivise

Libreria Python MASE con funzioni di utilità per **naming** (camelCase ↔ snake_case), **tipi** (primitive, istanze di classe) e **serializzazione** JSON ↔ oggetti Python. Usata da altre librerie MASE (es. `mase-utils-secu`, `mase-utils-cache`) e può essere usata direttamente nel backend per uniformare la gestione di DTO e risposte API.

---

## A cosa serve

- **Naming:** `camel_to_snake` per convertire identificatori da camelCase a snake_case (utile per chiavi JSON/API → attributi Python).
- **Tipi:** `is_primitive`, `is_class_instance` per distinguere tipi base da oggetti/dict.
- **Serializzazione:** `json_to_object`, `json_to_objects`, `object_to_json` per trasformare dict/list in istanze di classi (con annotazioni e Pydantic) e viceversa, in modo ricorsivo.

---

## Dipendenze e installazione

```text
# requirements.txt (esempio con registry Nexus)
--index-url https://nexus.../repository/pypi-public/simple/
--trusted-host nexus...
mase-utils-commons==1.1.0
```

Dipendenze: `pydantic` (per supporto a modelli Pydantic in serializzazione).

---

## API

### camel_to_snake

Converte una stringa da **camelCase** (o PascalCase) a **snake_case**.

```python
from mase_utils_commons import camel_to_snake

camel_to_snake("userId")      # "user_id"
camel_to_snake("UserName")   # "user_name"
camel_to_snake("HTTPHeader") # "h_t_t_p_header"  (ogni maiuscola → _ + minuscola)
```

Utile quando le API o i JSON usano camelCase e i modelli Python usano snake_case.

---

### is_primitive

Restituisce `True` se il valore è un tipo “primitivo”: `int`, `float`, `str`, `bool`, `bytes`.

```python
from mase_utils_commons import is_primitive

is_primitive(42)        # True
is_primitive("hello")   # True
is_primitive([])        # False
is_primitive({"a": 1})  # False
is_primitive(my_obj)    # False (oggetti sono non-primitivi)
```

Usato internamente da altre utility (es. per non trattare un dict come “istanza di classe”).

---

### is_class_instance

Restituisce `True` se il valore è un’**istanza di una classe** (oggetto con `__class__`) e non è un primitivo né un `dict`.

```python
from mase_utils_commons import is_class_instance

is_class_instance(MyModel())   # True
is_class_instance({"a": 1})   # False
is_class_instance("x")        # False
```

Utile per decidere se serializzare un valore come oggetto (con `object_to_json`) o lasciarlo com’è.

---

### json_to_object

Converte un **dict** (o struttura ricorsiva di dict/list) in un’**istanza** della classe indicata. Supporta:

- Classi con `__annotations__` e costruttore che accetta keyword argument.
- Sottoclassi di **Pydantic** `BaseModel` (costruttore con keyword).
- Liste: se un campo è tipizzato come `list[SomeClass]`, gli elementi dict vengono convertiti in `SomeClass`.
- Riferimenti a tipi per nome (stringa) quando usati nelle annotazioni.

```python
from mase_utils_commons import json_to_object

class User:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

data = {"name": "Alice", "age": 30}
user = json_to_object(data, User)
# user.name == "Alice", user.age == 30
```

Con Pydantic:

```python
from pydantic import BaseModel
from mase_utils_commons import json_to_object

class User(BaseModel):
    name: str
    age: int

user = json_to_object({"name": "Alice", "age": 30}, User)
```

Solo le chiavi presenti negli attributi/annotazioni della classe vengono mappate; le altre sono ignorate.

---

### json_to_objects

Applica `json_to_object` a **ogni elemento** di una lista.

```python
from mase_utils_commons import json_to_objects

items = [{"name": "a", "age": 1}, {"name": "b", "age": 2}]
users = json_to_objects(items, User)
# list di istanze User
```

---

### object_to_json

Converte un oggetto Python in strutture **dict/list** ricorsivamente:

- **Liste:** ogni elemento viene convertito con `object_to_json`.
- **Oggetti** (con `__dict__`): gli attributi vengono convertiti in dict con chiavi uguali ai nomi degli attributi; i valori sono a loro volta convertiti.
- **Primitivi:** restituiti così come sono.

```python
from mase_utils_commons import object_to_json

user = User(name="Alice", age=30)
object_to_json(user)  # {"name": "Alice", "age": 30}

# Con liste e oggetti annidati
object_to_json([user, other])  # [{"name": "Alice", "age": 30}, ...]
```

Utile per preparare risposte API, salvare in cache (con `mase-utils-cache`) o inviare payload a servizi che si aspettano dict/list.

---

## Uso tipico nel backend

- **Risposte API:** da modelli dominio o Pydantic → `object_to_json(model)` se serve un dict da serializzare in JSON (FastAPI di solito serializza già i modelli Pydantic; per classi custom `object_to_json` è comodo).
- **Request body / integrazioni:** da JSON (dict) a modelli → `json_to_object(payload, MyModel)` o `json_to_objects(list_of_dicts, MyModel)`.
- **Naming:** chiavi da API in camelCase → `camel_to_snake(key)` per allinearle agli attributi Python o ai nomi di colonna.
- **Logica generica:** `is_primitive` / `is_class_instance` quando si deve trattare in modo diverso tipi base e oggetti (validazione, serializzazione custom, ecc.).

---

## Riepilogo per gli sviluppatori

| Funzione | Scopo |
|----------|--------|
| `camel_to_snake(name)` | Convertire identificatore camelCase → snake_case. |
| `is_primitive(value)` | Verificare se è int/float/str/bool/bytes. |
| `is_class_instance(value)` | Verificare se è un’istanza di classe (non dict, non primitivo). |
| `json_to_object(obj, cls)` | Dict (o struttura ricorsiva) → istanza di `cls`. |
| `json_to_objects(objs, cls)` | Lista di dict → lista di istanze di `cls`. |
| `object_to_json(obj)` | Oggetto (o lista di oggetti) → dict/list ricorsivo. |
