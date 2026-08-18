/**
 * Runtime patch for @mase/commons-geoinsight temp geometry styles.
 * Bundle hardcodes polygon stroke width 4; cadastre territory uses 1.5 (OpenLayers parity).
 * Point assets use semi-transparent green circles (same opacity as surface assets).
 */
const TEMP_GEOMETRY_POLYGON_STROKE_FROM =
  'fill:new tn({color:l}),stroke:new Kr({color:d,width:4}),image:new ea'
const TEMP_GEOMETRY_POLYGON_STROKE_TO =
  'fill:new tn({color:l}),stroke:new Kr({color:d,width:1.5}),image:new ea'

const TEMP_GEOMETRY_POINT_CIRCLE_FROM =
  'image:new ea({radius:7,fill:new tn({color:a}),stroke:new Kr({color:d,width:2})})'
const TEMP_GEOMETRY_POINT_CIRCLE_TO =
  'image:new ea({radius:6,fill:new tn({color:t==="#15803d"?Ya.printRgbAsStr(i,.42):d}),stroke:new Kr({color:d,width:1.5})})'

const TEMP_GEOMETRY_SELECT_STROKE_FROM =
  'return new wl({fill:new tn({color:o}),stroke:new Kr({color:n,width:4}),image:new ea'
const TEMP_GEOMETRY_SELECT_STROKE_TO =
  'return new wl({fill:new tn({color:o}),stroke:new Kr({color:n,width:3}),image:new ea'

const TEMP_GEOMETRY_SELECT_POINT_CIRCLE_FROM =
  'image:new ea({radius:7,fill:new tn({color:r}),stroke:new Kr({color:n,width:4})})'
const TEMP_GEOMETRY_SELECT_POINT_CIRCLE_TO =
  'image:new ea({radius:6,fill:new tn({color:t==="#15803d"?Ya.printRgbAsStr(e,.42):n}),stroke:new Kr({color:n,width:1.5})})'

/** Green asset surfaces (#0f7637) — less transparent fill; other polygons keep 0.1 alpha. */
const TEMP_GEOMETRY_FILL_ALPHA_FROM =
  'const i=Ya.hexToRgb(t),l=Ya.printRgbAsStr(i,.1),a=Ya.printRgbAsStr(i,.2),d=Ya.printRgbAsStr(i)'
const TEMP_GEOMETRY_FILL_ALPHA_TO =
  'const i=Ya.hexToRgb(t),l=Ya.printRgbAsStr(i,t==="#0f7637"?.42:t==="#38bdf8"?.38:.1),a=Ya.printRgbAsStr(i,.2),d=Ya.printRgbAsStr(i)'

/** Hide labels on technical ids; show count-only text for cluster label helpers. */
const TEMP_GEOMETRY_LABEL_FROM =
  'if(e===!0){let v=0;ue.isNullOrUndefined(n)||(v=-36),f.text=new f5({text:o,font:"16px Arial",overflow:!0,offsetY:v,fill:new tn({color:p}),stroke:new Kr({color:b,width:3})})}return new wl(f)'
const TEMP_GEOMETRY_LABEL_TO =
  'if(e===!0){if(/^(GC_|GS_|GA_|T_|CL_|GH_)/.test(o))return new wl(f);const labelText=String(o).split("\\u200B")[0]||o;return new wl({text:new f5({text:labelText,font:"bold 11px sans-serif",overflow:!0,fill:new tn({color:p}),stroke:new Kr({color:b,width:2})})})}return new wl(f)'

/**
 * JSTS OverlayOp.intersection throws TopologyException on degenerate /
 * non-noded edges (common with dense cluster polygons and some admin
 * geometries). An uncaught throw aborts the whole onMapClick forEach, so
 * clicks appear dead. Swallow the error and treat as non-intersecting.
 */
const GEOMETRIES_INTERSECTS_FROM =
  'static geometriesIntersects(e,o){if(ue.isNullOrUndefined(e)||ue.isNullOrUndefined(o))return!1;const r=e.getType()=="Circle"?gn.geomToGeojson(gn.circleToPolygon(e)):gn.geomToGeojson(e),n=o.getType()=="Circle"?gn.geomToGeojson(gn.circleToPolygon(o)):gn.geomToGeojson(o),i=new Foe,l=i.read(r),a=i.read(n);return!On.intersection(l,a).isEmpty()}'
const GEOMETRIES_INTERSECTS_TO =
  'static geometriesIntersects(e,o){if(ue.isNullOrUndefined(e)||ue.isNullOrUndefined(o))return!1;try{const r=e.getType()=="Circle"?gn.geomToGeojson(gn.circleToPolygon(e)):gn.geomToGeojson(e),n=o.getType()=="Circle"?gn.geomToGeojson(gn.circleToPolygon(o)):gn.geomToGeojson(o),i=new Foe,l=i.read(r),a=i.read(n);return!On.intersection(l,a).isEmpty()}catch(t){return!1}}'

function replaceOrWarn(
  patched: string,
  from: string,
  to: string,
  label: string
): string {
  if (!patched.includes(from)) {
    console.warn(`[geoinsight-patch] ${label} pattern not found — bundle version may have changed`)
    return patched
  }
  return patched.replace(from, to)
}

export function patchGeoinsightBundleSource(source: string | Buffer): string {
  let patched = typeof source === 'string' ? source : source.toString('utf8')

  patched = replaceOrWarn(
    patched,
    TEMP_GEOMETRY_POLYGON_STROKE_FROM,
    TEMP_GEOMETRY_POLYGON_STROKE_TO,
    'temp geometry polygon stroke'
  )

  patched = replaceOrWarn(
    patched,
    TEMP_GEOMETRY_FILL_ALPHA_FROM,
    TEMP_GEOMETRY_FILL_ALPHA_TO,
    'temp geometry polygon fill alpha'
  )

  patched = replaceOrWarn(
    patched,
    TEMP_GEOMETRY_POINT_CIRCLE_FROM,
    TEMP_GEOMETRY_POINT_CIRCLE_TO,
    'temp geometry point circle'
  )

  patched = replaceOrWarn(
    patched,
    TEMP_GEOMETRY_SELECT_STROKE_FROM,
    TEMP_GEOMETRY_SELECT_STROKE_TO,
    'temp geometry select stroke'
  )

  patched = replaceOrWarn(
    patched,
    TEMP_GEOMETRY_LABEL_FROM,
    TEMP_GEOMETRY_LABEL_TO,
    'temp geometry cluster count labels'
  )

  patched = replaceOrWarn(
    patched,
    TEMP_GEOMETRY_SELECT_POINT_CIRCLE_FROM,
    TEMP_GEOMETRY_SELECT_POINT_CIRCLE_TO,
    'temp geometry select point circle'
  )

  patched = replaceOrWarn(
    patched,
    GEOMETRIES_INTERSECTS_FROM,
    GEOMETRIES_INTERSECTS_TO,
    'geometriesIntersects TopologyException guard'
  )

  return patched
}
