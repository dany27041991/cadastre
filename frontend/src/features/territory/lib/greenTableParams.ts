/**
 * Query string per API tabella allineate al contesto mappa (stessi filtri del
 * layer verde). Scope amministrativo opzionale: query vuota = territorio
 * nazionale; ogni selezione del breadcrumb restringe i dati.
 */
import type { BreadcrumbCrumb, TerritoryLevel } from '@/entities/territory'
import { getGreenContext } from './greenMapContext'

function setIfPresent(p: URLSearchParams, key: string, value: number | undefined): void {
  if (value != null) p.set(key, String(value))
}

export type IngestDateQuery = {
  dateFrom?: string | null
  dateTo?: string | null
}

function appendIngestDates(p: URLSearchParams, dates?: IngestDateQuery | null): void {
  if (dates?.dateFrom) p.set('date_from', dates.dateFrom)
  if (dates?.dateTo) p.set('date_to', dates.dateTo)
}

export function buildGreenAreasTableQuery(
  level: TerritoryLevel,
  breadcrumb: BreadcrumbCrumb[],
  clipWkt?: string | null,
  dates?: IngestDateQuery | null
): string {
  const ctx = getGreenContext(breadcrumb)
  const p = new URLSearchParams()
  setIfPresent(p, 'region_id', ctx.regionId)
  setIfPresent(p, 'province_id', ctx.provinceId)
  setIfPresent(p, 'municipality_id', ctx.municipalityId)
  // Prefer breadcrumb greenAreaId over level string — search jump can update
  // crumbs before level settles on SUB_AREAS (municipality-wide table otherwise).
  if (ctx.greenAreaId != null) {
    // Exact selected area only (search / leaf). contained_in_area_id lists
    // children at level+1 and returns 0 rows for leaves.
    p.set('area_id', String(ctx.greenAreaId))
  } else {
    setIfPresent(p, 'sub_municipal_area_id', ctx.subMunicipalAreaId)
  }
  if (clipWkt) p.set('clip_wkt', clipWkt)
  appendIngestDates(p, dates)
  return p.toString()
}

export function buildGreenAssetsTableQuery(
  breadcrumb: BreadcrumbCrumb[],
  clipWkt?: string | null,
  dates?: IngestDateQuery | null
): string {
  const ctx = getGreenContext(breadcrumb)
  const p = new URLSearchParams()
  setIfPresent(p, 'region_id', ctx.regionId)
  setIfPresent(p, 'province_id', ctx.provinceId)
  setIfPresent(p, 'municipality_id', ctx.municipalityId)
  setIfPresent(p, 'sub_municipal_area_id', ctx.subMunicipalAreaId)
  setIfPresent(p, 'green_area_id', ctx.greenAreaId)
  if (clipWkt) p.set('clip_wkt', clipWkt)
  appendIngestDates(p, dates)
  return p.toString()
}
