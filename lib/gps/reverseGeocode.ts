type NominatimAddress = {
  village?: string
  hamlet?: string
  suburb?: string
  neighbourhood?: string
  neighborhood?: string
  town?: string
  city?: string
  municipality?: string
  county?: string
  state_district?: string
  state?: string
}

export type NominatimReverse = {
  address?: NominatimAddress
  display_name?: string
}

export function villageNameFromNominatim(data: NominatimReverse | null | undefined): string {
  const addr = data?.address
  if (!addr) return ''
  const place =
    addr.village ||
    addr.hamlet ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.neighborhood ||
    addr.town ||
    addr.city ||
    addr.municipality ||
    ''
  const district = addr.state_district || addr.county || ''
  if (place && district && !place.toLowerCase().includes(district.toLowerCase())) {
    return `${place}, ${district}`
  }
  return place || district || ''
}
