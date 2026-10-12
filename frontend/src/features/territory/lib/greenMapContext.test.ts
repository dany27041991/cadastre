import { describe, expect, it } from 'vitest'
import type { BreadcrumbCrumb } from '../types'
import { getGreenContext, greenContextKey } from './greenMapContext'

describe('getGreenContext', () => {
  it('returns empty scope for landing (nationwide)', () => {
    expect(getGreenContext([])).toEqual({
      regionId: undefined,
      provinceId: undefined,
      municipalityId: undefined,
      subMunicipalAreaId: undefined,
      greenAreaId: undefined,
    })
  })

  it('scopes to region when provinces crumb is present', () => {
    const breadcrumb: BreadcrumbCrumb[] = [
      { level: 'provinces', id: 16, label: 'Puglia' },
    ]
    expect(getGreenContext(breadcrumb)).toMatchObject({ regionId: 16 })
    expect(getGreenContext(breadcrumb).provinceId).toBeUndefined()
  })

  it('scopes to province when municipalities crumb is present', () => {
    const breadcrumb: BreadcrumbCrumb[] = [
      { level: 'provinces', id: 16, label: 'Puglia' },
      { level: 'municipalities', id: 75, label: 'Lecce' },
    ]
    expect(getGreenContext(breadcrumb)).toMatchObject({
      regionId: 16,
      provinceId: 75,
    })
    expect(getGreenContext(breadcrumb).municipalityId).toBeUndefined()
  })

  it('scopes to municipality at sub_municipal_areas level', () => {
    const breadcrumb: BreadcrumbCrumb[] = [
      { level: 'provinces', id: 16, label: 'Puglia' },
      { level: 'municipalities', id: 75, label: 'Lecce' },
      { level: 'sub_municipal_areas', id: 5998, label: 'Lecce' },
    ]
    expect(getGreenContext(breadcrumb)).toMatchObject({
      regionId: 16,
      provinceId: 75,
      municipalityId: 5998,
    })
  })

  it('scopes to sub-municipal area at green_areas level', () => {
    const breadcrumb: BreadcrumbCrumb[] = [
      { level: 'provinces', id: 16, label: 'Puglia' },
      { level: 'municipalities', id: 75, label: 'Lecce' },
      { level: 'sub_municipal_areas', id: 5998, label: 'Lecce' },
      {
        level: 'green_areas',
        id: 5998,
        label: 'Santa Rosa',
        regionId: 16,
        provinceId: 75,
        subMunicipalAreaId: 454,
      },
    ]
    expect(getGreenContext(breadcrumb)).toMatchObject({
      regionId: 16,
      provinceId: 75,
      municipalityId: 5998,
      subMunicipalAreaId: 454,
    })
    expect(getGreenContext(breadcrumb).greenAreaId).toBeUndefined()
  })

  it('scopes to green area at sub_areas level', () => {
    const breadcrumb: BreadcrumbCrumb[] = [
      { level: 'provinces', id: 16, label: 'Puglia' },
      { level: 'municipalities', id: 75, label: 'Lecce' },
      {
        level: 'green_areas',
        id: 5998,
        label: 'Aree verdi',
        regionId: 16,
        provinceId: 75,
      },
      {
        level: 'sub_areas',
        id: 1001,
        label: 'Parco',
        regionId: 16,
        provinceId: 75,
        municipalityId: 5998,
      },
    ]
    expect(getGreenContext(breadcrumb)).toMatchObject({
      regionId: 16,
      provinceId: 75,
      municipalityId: 5998,
      greenAreaId: 1001,
    })
    expect(getGreenContext(breadcrumb).subMunicipalAreaId).toBeUndefined()
  })
})

describe('greenContextKey', () => {
  it('changes when administrative depth changes', () => {
    const nation = greenContextKey(getGreenContext([]))
    const region = greenContextKey(
      getGreenContext([{ level: 'provinces', id: 16, label: 'Puglia' }])
    )
    expect(nation).not.toEqual(region)
  })
})
