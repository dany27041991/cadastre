# Documentazione componenti UI

Questo progetto usa le stesse librerie grafiche dell’ecosistema MASE/CU 1.5 per uniformare look & feel e accessibilità.

**Documentazione ufficiale (dxc-webkit):** [https://dxc-webkit-develdxap-portali.apps.dxap-svil.ocp.mase.priv](https://dxc-webkit-develdxap-portali.apps.dxap-svil.ocp.mase.priv)

## Indice

| Documento | Contenuto |
|-----------|-----------|
| [Configurazione registry](registry.md) | Installazione dxc-webkit da registry privato |
| [dxc-webkit](dxc-webkit.md) | Design system MASE – panoramica |
| [dxc-webkit (dettaglio)](dxc-webkit/README.md) | Documentazione dettagliata per ogni componente (Button, Text, Modal, InfoPanel, Input, SearchInput, Table, Badge, Spinner, Upload, Icone, altri) |
| [react-select](react-select.md) | Select e dropdown |
| [react-toastify](react-toastify.md) | Notifiche toast |
| [Componenti condivisi](shared-ui-components.md) | Button, ButtonInv, Line, Spinner (`@/shared/ui-components`) |

## Riepilogo dipendenze

| Pacchetto      | Versione | Scopo                   |
|----------------|----------|--------------------------|
| dxc-webkit     | 1.6.0    | Design system (UI base)  |
| react-select   | ^5.10.2  | Select / dropdown        |
| react-toastify | ^11.0.5  | Notifiche toast         |

Per dubbi su un componente specifico di **dxc-webkit**, confrontare l’uso in `cu1.5-fe-MVP3-local/src` (es. `SelezionaAOI`, `StagingArea`, modali, tabelle).
