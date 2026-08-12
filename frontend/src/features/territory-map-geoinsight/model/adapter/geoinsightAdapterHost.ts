import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'
import type {
  FeatureSelectHandler,
  GreenDetailSelectHandler,
} from '@/features/territory/types/map'
import type { GeometryRegistry } from '../geometryRegistry'
import type { GeoinsightMapRuntimeHost } from './geoinsightMapRuntime'

/** Shared mutable state and deps for Geoinsight adapter submodules. */
export interface GeoinsightAdapterHost extends GeoinsightMapRuntimeHost {
  readonly registry: GeometryRegistry
  readonly onFeatureSelectRef: { current: FeatureSelectHandler }
  /** Click green area/asset → detail modal (no zoom / navigation). */
  readonly onGreenDetailSelectRef: { current: GreenDetailSelectHandler }
  /**
   * When false, map clicks must not zoom/navigate admin territory features
   * (green overlay toggles active). Cluster explode still allowed.
   * Green area/asset clicks always open detail via onGreenDetailSelectRef.
   */
  readonly isClickNavigationEnabledRef: { current: () => boolean }
  drillExcludeAreaIds: number[]
  lastTerritoryGeometries: GeoinsightGeometryClip[]
  /**
   * Bbox of the last territory outline shown (e.g. municipality boundary).
   * fitGreenExtent unions it with the green bboxes so breadcrumb navigation
   * frames the whole admin unit, not just its green areas: the territory
   * registry entries are removed by setTerritoryFillVisible(false) before the
   * green fit runs, so the registry alone cannot provide this bbox.
   */
  lastTerritoryFitBbox: [number, number, number, number] | null
  lastGreenGeometries: GeoinsightGeometryClip[]
  greenLayerVisible: boolean
  removeGeomIds(ids: string[]): void
  addGeometries(geometries: GeoinsightGeometryClip[], options?: { showLabels?: boolean }): void
}
