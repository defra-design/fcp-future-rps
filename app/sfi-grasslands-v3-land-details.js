/**
 * Read-only land details journey for sfi-grasslands-v3.
 * Reuses Agile Farm (buckinghamshire) parcel coords/areas from select-land data.
 */

var parcelReference = require('./sfi-grasslands-v3-parcel-reference')
var consent = require('./sfi-grasslands-v3-consent')
var parcelsById = require('./data/sfi-grasslands-v3-land-details-parcels.json')

var FARM_NAME = 'Agile Farm'
var LAND_DETAILS_BASE = '/sfi-grasslands-v3/land-details'
var LAND_DETAILS_V2_BASE = '/sfi-grasslands-v3/land-details-v2'

function roundHaFour (value) {
  return Math.round(Math.max(0, Number(value) || 0) * 10000) / 10000
}

function formatHa (value) {
  var numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return '0.0000'
  }
  return numeric.toFixed(4)
}

function formatHaWithCommas (value) {
  var numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return '0.0000'
  }
  return numeric.toLocaleString('en-GB', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
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

function referenceToSlug (reference) {
  return String(reference || '')
    .trim()
    .replace(/\s+/g, '-')
}

function getParcelView (query) {
  // List + map is the default; full-width map needs ?view=map
  return String((query && query.view) || '').toLowerCase() === 'map' ? 'map' : 'list'
}

function buildQueryString (query, options) {
  var opts = options || {}
  var source = query || {}
  var parts = []
  Object.keys(source).forEach(function (key) {
    if (key === 'view') {
      return
    }
    var value = source[key]
    if (value === undefined || value === null || value === '') {
      return
    }
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
  })
  var view = opts.view !== undefined ? opts.view : getParcelView(source)
  if (view === 'map') {
    parts.push('view=map')
  }
  return parts.length ? '?' + parts.join('&') : ''
}

function buildParcelHref (slug, querySuffix, basePath) {
  return (basePath || LAND_DETAILS_BASE) + '/' + slug + (querySuffix || '') + '#selected-land-parcel'
}

function slugToReference (slug) {
  var cleaned = String(slug || '').trim().replace(/-/g, ' ')
  var match = cleaned.match(/^([A-Z]{2}\d{4})\s+(\d{4})$/i)
  if (!match) {
    return null
  }
  return match[1].toUpperCase() + ' ' + match[2]
}

function findParcelIdByReference (reference) {
  var target = String(reference || '').trim()
  var ids = Object.keys(parcelsById)
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]
    var formatted = parcelReference.format(id) || parcelsById[id].parcelReference
    if (formatted === target) {
      return id
    }
  }
  return null
}

function getCoverNamesForParcel (parcelId, parcel) {
  return toCoverNames(parcel.landCover)
}

function buildParcelRecord (parcelId, options) {
  var opts = options || {}
  var querySuffix = opts.querySuffix || ''
  var parcel = parcelsById[parcelId]
  if (!parcel) {
    return null
  }

  var reference = parcelReference.format(parcelId) || parcel.parcelReference
  var totalArea = roundHaFour(parcel.totalArea)
  var coverNames = getCoverNamesForParcel(parcelId, parcel)
  var coverShares = parcelReference.allocateLandCoverAreas(coverNames, totalArea)
  var landCoverSummary = coverNames.join(', ')
  var slug = referenceToSlug(reference)
  var requirements = getParcelRequirements(parcelId)
  var availableActionsCount = Array.isArray(parcel.actions) && parcel.actions.length
    ? parcel.actions.length
    : getAvailableActionsCount(coverNames)

  return {
    id: parcelId,
    name: parcel.name,
    parcelReference: reference,
    slug: slug,
    href: buildParcelHref(slug, querySuffix, opts.basePath),
    totalArea: totalArea,
    totalAreaFormatted: formatHa(totalArea),
    totalAreaLabel: formatHa(totalArea) + ' ha',
    landCoverSummary: landCoverSummary,
    landCovers: coverShares.map(function (share) {
      var areaFormatted = formatHa(share.ha) + ' ha'
      return {
        name: share.name,
        area: share.ha,
        areaFormatted: areaFormatted,
        // Single cover matches total area — no need to repeat the hectares
        line: coverShares.length === 1
          ? share.name
          : share.name + ' - ' + areaFormatted
      }
    }),
    availableActionsCount: availableActionsCount,
    requirements: requirements,
    coords: parcel.coords || []
  }
}

function getAvailableActionsCount (coverNames) {
  // Fallback when a parcel has no actions array — grassland demos use ~12
  var names = coverNames || []
  if (names.some(function (name) {
    return /grass/i.test(name)
  })) {
    return 12
  }
  return 8
}

function getParcelRequirements (parcelId) {
  var flags = consent.PARCEL_CONSENT_FLAGS[parcelId] || { sssi: false, hefer: false }
  var items = []
  if (flags.sssi) {
    items.push('site of special scientific interest (SSSI) consent')
  }
  if (flags.hefer) {
    items.push('a Historic Environment Farm Environment Record (HEFER)')
  }

  return {
    show: items.length > 0,
    items: items
  }
}

function getAllParcels (options) {
  var opts = options || {}
  return Object.keys(parcelsById)
    .map(function (parcelId) {
      return buildParcelRecord(parcelId, opts)
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return String(a.parcelReference).localeCompare(String(b.parcelReference))
    })
}

function getFarmSummary () {
  var parcels = getAllParcels()
  var totalArea = parcels.reduce(function (sum, parcel) {
    return sum + Number(parcel.totalArea || 0)
  }, 0)

  return {
    farmName: FARM_NAME,
    parcelCount: parcels.length,
    totalArea: roundHaFour(totalArea),
    totalAreaFormatted: formatHaWithCommas(totalArea),
    totalAreaLabel: formatHaWithCommas(totalArea)
  }
}

function getParcelBySlug (slug, options) {
  var reference = slugToReference(slug)
  if (!reference) {
    return null
  }
  var parcelId = findParcelIdByReference(reference)
  if (!parcelId) {
    return null
  }
  return buildParcelRecord(parcelId, options)
}

function getMapPayload (options) {
  var opts = options || {}
  var parcels = getAllParcels(opts)
  var selectedId = opts.selectedParcelId || null

  return {
    farmName: FARM_NAME,
    selectedParcelId: selectedId,
    fitAllParcels: Boolean(opts.fitAllParcels),
    parcels: parcels.map(function (parcel) {
      return {
        id: parcel.id,
        parcelReference: parcel.parcelReference,
        href: parcel.href,
        totalArea: parcel.totalArea,
        totalAreaLabel: parcel.totalAreaLabel,
        landCoverSummary: parcel.landCoverSummary,
        availableActionsCount: parcel.availableActionsCount,
        coords: parcel.coords,
        selected: parcel.id === selectedId
      }
    })
  }
}

function getPageLocals (query, options) {
  var opts = options || {}
  var basePath = opts.basePath || LAND_DETAILS_BASE
  var parcelView = opts.forceListView ? 'list' : getParcelView(query)
  var querySuffix = buildQueryString(query, { view: parcelView })
  var parcelOptions = { querySuffix: querySuffix, basePath: basePath }
  var parcels = getAllParcels(parcelOptions)
  var selectedParcel = opts.slug ? getParcelBySlug(opts.slug, parcelOptions) : null

  return {
    parcelView: parcelView,
    isListView: parcelView === 'list',
    isLandDetailsV2: Boolean(opts.isLandDetailsV2),
    parcels: parcels,
    farmSummary: getFarmSummary(),
    parcel: selectedParcel,
    landDetailsIndexHref: basePath + buildQueryString(query, { view: parcelView }),
    mapViewHref: basePath + (opts.slug ? '/' + opts.slug : '') + buildQueryString(query, { view: 'map' }),
    listViewHref: basePath + (opts.slug ? '/' + opts.slug : '') + buildQueryString(query, { view: 'list' }),
    mapPayload: getMapPayload({
      querySuffix: querySuffix,
      basePath: basePath,
      selectedParcelId: selectedParcel && selectedParcel.id,
      fitAllParcels: Boolean(opts.fitAllParcels)
    })
  }
}

module.exports = {
  LAND_DETAILS_BASE: LAND_DETAILS_BASE,
  LAND_DETAILS_V2_BASE: LAND_DETAILS_V2_BASE,
  getAllParcels: getAllParcels,
  getFarmSummary: getFarmSummary,
  getParcelBySlug: getParcelBySlug,
  getMapPayload: getMapPayload,
  getParcelView: getParcelView,
  buildQueryString: buildQueryString,
  getPageLocals: getPageLocals,
  formatHa: formatHa
}
