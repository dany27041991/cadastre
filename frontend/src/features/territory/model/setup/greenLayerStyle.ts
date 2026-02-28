/**
 * Green layer style: cluster circles, single points, lines, polygons.
 */
import type Feature from 'ol/Feature'
import Style from 'ol/style/Style'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Circle from 'ol/style/Circle'
import Text from 'ol/style/Text'
import Point from 'ol/geom/Point'
import type Geometry from 'ol/geom/Geometry'
import { getCenter } from 'ol/extent'
import { GREEN_CORE_RADIUS } from '../../lib/greenAssetCluster'

// Green palette for layer styles (fill, stroke, cluster).
const COLOR_GREEN_FILL = 'rgba(72, 200, 72, 0.35)'
const COLOR_GREEN_FILL_CORE = 'rgba(72, 200, 72, 0.95)'
const COLOR_GREEN_STROKE = 'rgba(26, 95, 42, 0.9)'
const COLOR_GREEN_CLUSTER_FILL = 'rgba(34, 139, 34, 0.6)'
const COLOR_WHITE = '#fff'

const CLUSTER_RADIUS_BASE = 12
const CLUSTER_RADIUS_FACTOR = 4
const CLUSTER_RADIUS_MAX = 26
const CLUSTER_COUNT_K_THRESHOLD = 999

const GREEN_FILL = new Fill({ color: COLOR_GREEN_FILL })
const GREEN_STROKE = new Stroke({ color: COLOR_GREEN_STROKE, width: 1.5 })
const GREEN_CORE_CIRCLE = new Circle({
  radius: GREEN_CORE_RADIUS,
  fill: new Fill({ color: COLOR_GREEN_FILL_CORE }),
  stroke: new Stroke({ color: COLOR_GREEN_STROKE, width: 1 }),
})

function getPointFromGeometry(geom: Geometry): Point {
  return geom.getType() === 'Point'
    ? (geom as Point)
    : new Point(getCenter(geom.getExtent()))
}

function formatClusterCount(count: number): string {
  return count > CLUSTER_COUNT_K_THRESHOLD
    ? `${(count / 1000).toFixed(1)}k`
    : String(count)
}

export function greenClusterStyleFn(feature: Feature): Style | Style[] {
  const geom = feature.getGeometry()
  if (!geom) return []
  const clusterFeatures = feature.get('features') as Feature[] | undefined
  const count = clusterFeatures?.length ?? 0
  if (count > 1) {
    const point = getPointFromGeometry(geom)
    const radius = Math.min(
      CLUSTER_RADIUS_BASE + Math.log(count) * CLUSTER_RADIUS_FACTOR,
      CLUSTER_RADIUS_MAX
    )
    return new Style({
      image: new Circle({
        radius,
        fill: new Fill({ color: COLOR_GREEN_CLUSTER_FILL }),
        stroke: new Stroke({ color: COLOR_GREEN_STROKE, width: 1.5 }),
      }),
      geometry: point,
      text: new Text({
        text: formatClusterCount(count),
        fill: new Fill({ color: COLOR_WHITE }),
        font: 'bold 11px sans-serif',
      }),
    })
  }
  const geomType = geom.getType()
  if (geomType === 'Point') {
    return new Style({ image: GREEN_CORE_CIRCLE, geometry: geom as Point })
  }
  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    return new Style({ stroke: GREEN_STROKE, geometry: geom })
  }
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
    return new Style({ fill: GREEN_FILL, stroke: GREEN_STROKE, geometry: geom })
  }
  return new Style({
    image: GREEN_CORE_CIRCLE,
    geometry: getPointFromGeometry(geom),
  })
}

export function clusterGeometryFunction(feature: Feature): Point | null {
  const geom = feature.getGeometry()
  return geom ? getPointFromGeometry(geom) : null
}
