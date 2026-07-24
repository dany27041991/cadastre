# Geoinsight — parità cu1.5-fe (standalone + shell)

**Data:** 2026-07-06  
**Decisione:** parità identica su Vite standalone e webpack Single-SPA (opzione C).

## Obiettivo

Usare la stessa mappa di `cu1.5-fe`: `@mase/commons-geoinsight@1.5.0`, webgis **155**, CU **PNRR**, `mapId=1`, stesso lifecycle ref/ready e layout z-index.

## Architettura dual-runtime

| Runtime | Bootstrap Geoinsight | Auth |
|---------|---------------------|------|
| **Vite** (`main.tsx`) | `initGeoinsightModule()` + AMD loader | `initMockAuth()` + proxy Vite |
| **Shell** (`mase-siv.tsx`) | Import map `@mase/commons-geoinsight` | Portal `fgp` + cookie |

Componente condiviso: `GeoinsightMapContainer` (contratto allineato a `cu1.5-fe/src/components/map/Map.tsx`).

## Config (identica cu1.5)

```ts
webgisId: 155
cuId: 'PNRR'
mapId: 1
```

Override via `VITE_GEOINSIGHT_*` finché non esiste webgis SIV dedicato.

## Componenti

- `GeoinsightMapContainer` — ref on mount/unmount, `ready` → CRS + `injectMapDrawHandleStyles`
- `GeoinsightFocusContainer` — z-index 700 / 1035 (pattern `FocusContainerMap`)
- `injectMapDrawHandleStyles` — port da cu1.5
- `geoinsightMapStyle` — shell: `calc(HEIGHT_BODY - 50px)`; standalone: absolute fill

## Loader Vite (standalone)

- Mantenere AMD script bundle reale
- Stub `@mase/commons-client` con fetch proxy + unwrap `response.data`
- Proxy: Cookie + fgp da env

## Fuori scope

- Draw geometry events (HEC-RAS cu1.5)
- WebGIS SIV dedicato (blocker team WebGIS)

## Criteri di successo

- Standalone: tile visibili, `toc_layers` 200, canvas presente
- Shell: stesso `<Geoinsight>` props e ref API `mapId=1`
- Nessuna regressione adapter territorio SIV
