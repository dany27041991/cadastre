import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { patchGeoinsightBundleSource } from './patchGeoinsightBundle'

const bundlePath = path.join(
  process.cwd(),
  'public/vendor/mase-commons-geoinsight.js'
)

describe('patchGeoinsightBundleSource', () => {
  it('patches polygon stroke and solid point circles in the vendor bundle', () => {
    const source = fs.readFileSync(bundlePath, 'utf8')
    const patched = patchGeoinsightBundleSource(source)

    expect(patched).toContain('stroke:new Kr({color:d,width:1.5}),image:new ea')
    expect(patched).toContain(
      'image:new ea({radius:6,fill:new tn({color:t==="#15803d"?Ya.printRgbAsStr(i,.42):d}),stroke:new Kr({color:d,width:1.5})})'
    )
    expect(patched).toContain('t==="#0f7637"?.42:t==="#38bdf8"?.38:.1')
    expect(patched).toContain('/^(GC_|GS_|GA_|T_)/.test(o)')
    expect(patched).not.toContain(
      'image:new ea({radius:7,fill:new tn({color:a}),stroke:new Kr({color:d,width:2})})'
    )
    expect(patched).toContain(
      'static geometriesIntersects(e,o){if(ue.isNullOrUndefined(e)||ue.isNullOrUndefined(o))return!1;try{'
    )
    expect(patched).toContain('catch(t){return!1}}')
  })
})
