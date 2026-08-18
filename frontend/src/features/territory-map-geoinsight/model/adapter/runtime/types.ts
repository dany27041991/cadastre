export type PendingOp = () => void

export interface GeoinsightMapRuntimeHost {
  readonly pending: PendingOp[]
  activateDrawnGeometryInfo(): void
  handleDrawnGeometryInfo(
    mapId: number,
    coordinates: number[],
    epsg: string,
    features: unknown
  ): void
}
