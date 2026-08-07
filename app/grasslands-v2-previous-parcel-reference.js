/**
 * grasslands-v2: Parcel reference = sheetId + parcelId (e.g. "SO3757 3159").
 * sheetId is shared for the farm sheet; parcelId increments per land parcel.
 * Used instead of parcel name / Ordnance Survey grid reference in the UI.
 */
(function (root) {
  var PARCEL_REFERENCES = {
    'back-field': { sheetId: 'SO3757', parcelId: '3159' },
    'boundary-meadow': { sheetId: 'SO3757', parcelId: '3160' },
    'brook-pasture': { sheetId: 'SO3757', parcelId: '3161' },
    'chalk-field': { sheetId: 'SO3757', parcelId: '3162' },
    'church-meadow': { sheetId: 'SO3757', parcelId: '3163' },
    'corner-close': { sheetId: 'SO3757', parcelId: '3164' },
    'elm-grove': { sheetId: 'SO3757', parcelId: '3165' },
    'far-pasture': { sheetId: 'SO3757', parcelId: '3166' },
    'gate-pasture': { sheetId: 'SO3757', parcelId: '3167' },
    'hollow-meadow': { sheetId: 'SO3757', parcelId: '3168' },
    'lane-close': { sheetId: 'SO3757', parcelId: '3169' },
    'long-meadow': { sheetId: 'SO3757', parcelId: '3170' },
    'mill-field': { sheetId: 'SO3757', parcelId: '3171' },
    'new-pasture': { sheetId: 'SO3757', parcelId: '3172' },
    'oak-tree-field': { sheetId: 'SO3757', parcelId: '3173' },
    'orchard-field': { sheetId: 'SO3757', parcelId: '3174' },
    'pond-meadow': { sheetId: 'SO3757', parcelId: '3175' },
    'river-pasture': { sheetId: 'SO3757', parcelId: '3176' },
    'south-slope': { sheetId: 'SO3757', parcelId: '3177' },
    'spring-field': { sheetId: 'SO3757', parcelId: '3178' },
    'top-barn-field': { sheetId: 'SO3757', parcelId: '3179' },
    'upper-field': { sheetId: 'SO3757', parcelId: '3180' },
    'valley-pasture': { sheetId: 'SO3757', parcelId: '3181' },
    'willow-grove': { sheetId: 'SO3757', parcelId: '3182' },
    'woods-view': { sheetId: 'SO3757', parcelId: '3183' },
    'ash-copse': { sheetId: 'SO3757', parcelId: '3184' },
    'barn-field': { sheetId: 'SO3757', parcelId: '3185' },
    'beech-wood': { sheetId: 'SO3757', parcelId: '3186' },
    'boundary-field': { sheetId: 'SO3757', parcelId: '3187' },
    'brook-field': { sheetId: 'SO3757', parcelId: '3188' },
    'chalk-slope': { sheetId: 'SO3757', parcelId: '3189' },
    'church-field': { sheetId: 'SO3757', parcelId: '3190' },
    'corner-paddock': { sheetId: 'SO3757', parcelId: '3191' },
    'eastern-meadow': { sheetId: 'SO3757', parcelId: '3192' },
    'far-meadow': { sheetId: 'SO3757', parcelId: '3193' },
    'gate-field': { sheetId: 'SO3757', parcelId: '3194' },
    'home-paddock': { sheetId: 'SO3757', parcelId: '3195' },
    'lane-meadow': { sheetId: 'SO3757', parcelId: '3196' },
    'lower-pasture': { sheetId: 'SO3757', parcelId: '3197' },
    'mill-meadow': { sheetId: 'SO3757', parcelId: '3198' },
    'new-ground': { sheetId: 'SO3757', parcelId: '3199' },
    'north-field-bucks': { sheetId: 'SO3757', parcelId: '3200' },
    'oak-grove': { sheetId: 'SO3757', parcelId: '3201' },
    'orchard-plot': { sheetId: 'SO3757', parcelId: '3202' },
    'pond-close': { sheetId: 'SO3757', parcelId: '3203' },
    'river-meadow': { sheetId: 'SO3757', parcelId: '3204' },
    'spring-pasture': { sheetId: 'SO3757', parcelId: '3205' },
    'stone-bridge': { sheetId: 'SO3757', parcelId: '3206' },
    'upper-slope': { sheetId: 'SO3757', parcelId: '3207' },
    'valley-bottom': { sheetId: 'SO3757', parcelId: '3208' },
    'woodland-edge': { sheetId: 'SO3757', parcelId: '3209' },
  }

  function getParts (parcelOrId) {
    if (!parcelOrId) { return null }
    if (typeof parcelOrId === 'string') {
      return PARCEL_REFERENCES[parcelOrId] || null
    }
    var id = parcelOrId.id || parcelOrId.parcelId || ''
    if (parcelOrId.sheetId && (parcelOrId.landParcelId || parcelOrId.parcelRefId)) {
      return {
        sheetId: String(parcelOrId.sheetId),
        parcelId: String(parcelOrId.landParcelId || parcelOrId.parcelRefId)
      }
    }
    if (parcelOrId.parcelReference && /^[A-Z]{2}\d{4}\s+\d{4}$/.test(String(parcelOrId.parcelReference).trim())) {
      var bits = String(parcelOrId.parcelReference).trim().split(/\s+/)
      return { sheetId: bits[0], parcelId: bits[1] }
    }
    if (id && PARCEL_REFERENCES[id]) {
      return PARCEL_REFERENCES[id]
    }
    return null
  }

  function format (parcelOrId) {
    var parts = getParts(parcelOrId)
    if (!parts) {
      if (parcelOrId && typeof parcelOrId === 'object') {
        return parcelOrId.parcelReference || parcelOrId.osReference || parcelOrId.osRef || parcelOrId.parcelName || parcelOrId.name || ''
      }
      return String(parcelOrId || '')
    }
    return parts.sheetId + ' ' + parts.parcelId
  }

  function applyToParcelData (parcelData) {
    if (!parcelData || typeof parcelData !== 'object') { return parcelData }
    Object.keys(parcelData).forEach(function (id) {
      var parcel = parcelData[id]
      if (!parcel || typeof parcel !== 'object') { return }
      var parts = PARCEL_REFERENCES[id]
      if (!parts) { return }
      parcel.sheetId = parts.sheetId
      parcel.landParcelId = parts.parcelId
      parcel.parcelReference = parts.sheetId + ' ' + parts.parcelId
    })
    return parcelData
  }

  var api = {
    map: PARCEL_REFERENCES,
    getParts: getParts,
    format: format,
    applyToParcelData: applyToParcelData
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
  root.GrasslandsV2ParcelReference = api
})(typeof window !== 'undefined' ? window : globalThis)
