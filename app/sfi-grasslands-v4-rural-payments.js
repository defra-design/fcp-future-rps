/**
 * Recreated Rural Payments service pages for sfi-grasslands-v4.
 * Opened in a new tab from "Check your digital maps are correct" so users
 * can check their land details in a separate service, then return.
 * Uses the same Agile Farm parcels as the grasslands journey.
 */

var parcelReference = require('./sfi-grasslands-v4-parcel-reference')
var outlyingParcels = require('./assets/javascripts/sfi-grasslands-v4-outlying-parcels')
var parcelsById = outlyingParcels.addTo(Object.assign({}, require('./data/sfi-grasslands-v4-land-details-parcels.json')))

var BASE_PATH = '/sfi-grasslands-v4/rural-payments'
var BUSINESS_NAME = 'AGILE FARM LTD'

// Order matters: rows in the land summary follow this list
var COVER_CATEGORIES = ['Arable Land', 'Permanent Grassland', 'Permanent Crops', 'Other']

function roundHa (value) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100
}

function formatHa (value) {
  return roundHa(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function toCoverNames (landCover) {
  if (Array.isArray(landCover)) {
    return landCover.filter(Boolean)
  }
  if (typeof landCover === 'string' && landCover) {
    return [landCover]
  }
  return ['Permanent grassland']
}

// Rural Payments groups detailed land covers into broad eligible covers
function getCoverCategory (coverName) {
  var name = String(coverName || '').toLowerCase()
  if (/permanent grassland/.test(name)) {
    return 'Permanent Grassland'
  }
  if (/temporary grass|arable|fallow|leguminous/.test(name)) {
    return 'Arable Land'
  }
  if (/perennial|orchard|crop/.test(name)) {
    return 'Permanent Crops'
  }
  return 'Other'
}

function referenceToSlug (reference) {
  return String(reference || '').trim().replace(/\s+/g, '-')
}

function buildParcel (parcelId) {
  var parcel = parcelsById[parcelId]
  if (!parcel) {
    return null
  }

  var reference = parcelReference.format(parcelId) || parcel.parcelReference
  var totalArea = roundHa(parcel.totalArea)
  var availableArea = roundHa(parcel.availableArea != null ? parcel.availableArea : parcel.totalArea)
  var coverShares = parcelReference.allocateLandCoverAreas(toCoverNames(parcel.landCover), totalArea)

  var landCovers = coverShares.map(function (share) {
    return {
      name: share.name,
      area: roundHa(share.ha),
      areaFormatted: formatHa(share.ha),
      category: getCoverCategory(share.name)
    }
  })

  var eligibleCategories = []
  var eligibleCoverArea = 0
  landCovers.forEach(function (cover) {
    if (cover.category === 'Other') {
      return
    }
    eligibleCoverArea += cover.area
    if (eligibleCategories.indexOf(cover.category) === -1) {
      eligibleCategories.push(cover.category)
    }
  })

  var eligibleArea = eligibleCategories.length
    ? roundHa(Math.min(eligibleCoverArea, availableArea))
    : null
  var slug = referenceToSlug(reference)

  return {
    id: parcelId,
    parcelReference: reference,
    slug: slug,
    href: BASE_PATH + '/parcel/' + slug,
    totalArea: totalArea,
    totalAreaFormatted: formatHa(totalArea),
    eligibleCovers: eligibleCategories.length ? eligibleCategories.join(', ') : 'Other',
    eligibleArea: eligibleArea,
    eligibleAreaFormatted: eligibleArea == null ? '-' : formatHa(eligibleArea),
    landCovers: landCovers,
    coords: parcel.coords || []
  }
}

function getAllParcels () {
  return Object.keys(parcelsById).map(buildParcel).filter(Boolean)
}

function getSort (query) {
  var source = query || {}
  var column = source.sort === 'area' ? 'area' : 'parcel'
  var order = source.order === 'desc' ? 'desc' : 'asc'
  return { column: column, order: order }
}

function sortParcels (parcels, sort) {
  var direction = sort.order === 'desc' ? -1 : 1
  return parcels.slice().sort(function (a, b) {
    if (sort.column === 'area') {
      return (a.totalArea - b.totalArea) * direction
    }
    return String(a.parcelReference).localeCompare(String(b.parcelReference)) * direction
  })
}

// Clicking the active column flips the order; another column starts ascending
function buildSortLinks (sort) {
  function linkFor (column) {
    var isActive = sort.column === column
    var nextOrder = isActive && sort.order === 'asc' ? 'desc' : 'asc'
    return {
      href: BASE_PATH + '/land-summary?sort=' + column + '&order=' + nextOrder,
      isActive: isActive,
      ariaSort: isActive ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none',
      arrow: isActive ? (sort.order === 'asc' ? '▲' : '▼') : ''
    }
  }
  return {
    parcel: linkFor('parcel'),
    area: linkFor('area')
  }
}

function buildSummaryRows (parcels) {
  var totals = {}
  COVER_CATEGORIES.forEach(function (category) {
    totals[category] = 0
  })

  var totalArea = 0
  parcels.forEach(function (parcel) {
    totalArea += parcel.totalArea
    parcel.landCovers.forEach(function (cover) {
      totals[cover.category] += cover.area
    })
  })

  var rows = [
    { key: 'Number of parcels', value: String(parcels.length) },
    { key: 'Total area (ha)', value: formatHa(totalArea) }
  ]
  COVER_CATEGORIES.forEach(function (category) {
    if (totals[category] > 0) {
      rows.push({ key: category + ' (ha)', value: formatHa(totals[category]) })
    }
  })
  return rows
}

function formatTodayDate () {
  var today = new Date()
  var day = String(today.getDate()).padStart(2, '0')
  var month = String(today.getMonth() + 1).padStart(2, '0')
  return day + '/' + month + '/' + today.getFullYear()
}

function buildMapPayload (parcels, selectedId) {
  return {
    selectedParcelId: selectedId || null,
    parcels: parcels.map(function (parcel) {
      return {
        id: parcel.id,
        parcelReference: parcel.parcelReference,
        href: parcel.href,
        coords: parcel.coords,
        selected: parcel.id === selectedId
      }
    })
  }
}

function getLandSummaryLocals (query) {
  var sort = getSort(query)
  var parcels = getAllParcels()

  return {
    businessName: BUSINESS_NAME,
    searchDate: (query && query.date) || formatTodayDate(),
    summaryRows: buildSummaryRows(parcels),
    parcels: sortParcels(parcels, sort),
    sortLinks: buildSortLinks(sort),
    mapPayload: buildMapPayload(parcels, null)
  }
}

function getParcelDetailsLocals (slug) {
  var parcels = getAllParcels()
  var parcel = parcels.filter(function (item) {
    return item.slug.toLowerCase() === String(slug || '').toLowerCase()
  })[0]

  if (!parcel) {
    return null
  }

  return {
    businessName: BUSINESS_NAME,
    parcel: parcel,
    mapPayload: buildMapPayload(parcels, parcel.id)
  }
}

module.exports = {
  BASE_PATH: BASE_PATH,
  BUSINESS_NAME: BUSINESS_NAME,
  getLandSummaryLocals: getLandSummaryLocals,
  getParcelDetailsLocals: getParcelDetailsLocals
}
