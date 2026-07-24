declare module 'terraformer-wkt-parser' {
  const WKT: {
    convert: (geojson: object) => string
    parse: (wkt: string) => object
  }
  export default WKT
}
