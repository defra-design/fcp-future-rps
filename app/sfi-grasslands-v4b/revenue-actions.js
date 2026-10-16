/**
 * sfi-grasslands-v4b: actions-first journey.
 * Users pick the revenue actions they are interested in, then add quantities
 * for those actions parcel by parcel. Saved parcels use the same application
 * store as the basket (sfi-grasslands-v4b-land-actions).
 */

var landActions = require('./land-actions')
var consent = require('./consent')
var parcelReference = require('./parcel-reference')
var compatibilityMatrix = require('../compatibility-matrix')
var outlyingParcels = require('../assets/javascripts/sfi-grasslands-v4b-outlying-parcels')
var parcelsById = outlyingParcels.addTo(Object.assign({}, require('../data/sfi-grasslands-v4b-land-details-parcels.json')))

var INTERESTED_ACTIONS_KEY = 'sfiV4bInterestedActions'
var FLASH_KEY = 'sfiV4bSelectParcelsFlash'

// rate is per unit, except 'm' where the published rate is per 100 metres
var ACTIONS = [
  // minQuantity: the smallest amount that can be entered (from the validation designs)
  { code: 'BND1', name: 'Maintain dry stone walls', unit: 'm', rate: 27, rateText: '£27 per 100 metres (both sides) each year', minQuantity: 20 },
  { code: 'BND2', name: 'Maintain earth banks or stone-faced hedgebanks', unit: 'm', rate: 11, rateText: '£11 per 100 metres (one side) each year' },
  { code: 'CHRW2', name: 'Manage hedgerows', unit: 'm', rate: 13, rateText: '£13 per 100 metres (one side) each year' },
  { code: 'CIGL1', name: 'Take grassland field corners or blocks out of management', unit: 'ha', rate: 333, rateText: '£333 per hectare each year' },
  { code: 'CIGL2', name: 'Winter bird food on improved grassland', unit: 'ha', rate: 515, rateText: '£515 per hectare each year' },
  // CLIG3 always takes all the eligible land left after the other actions on the parcel
  { code: 'CLIG3', name: 'Manage grassland with very low nutrient inputs', unit: 'ha', rate: 151, rateText: '£151 per hectare each year', wholeRemainingArea: true },
  { code: 'CNUM2', name: 'Legumes on improved grassland', unit: 'ha', rate: 102, rateText: '£102 per hectare each year' },
  { code: 'CSAM3', name: 'Herbal leys', unit: 'ha', rate: 224, rateText: '£224 per hectare each year' },
  { code: 'GRH7', name: 'Haymaking supplement', unit: 'ha', rate: 157, rateText: '£157 per hectare each year', supplementOf: 'CLIG3' },
  { code: 'GRH8', name: 'Haymaking supplement (late cut)', unit: 'ha', rate: 187, rateText: '£187 per hectare each year', supplementOf: 'CLIG3' },
  // GRH10 always covers all the CLIG3 area on the parcel. GRH7 and GRH8 can cover part of it.
  { code: 'GRH10', name: 'Lenient grazing supplement', unit: 'ha', rate: 28, rateText: '£28 per hectare each year', supplementOf: 'CLIG3', fullBaseArea: true },
  { code: 'GRH12', name: 'Manage rough grassland for upland breeding waders', unit: 'ha', rate: 203, rateText: '£203 per hectare each year' },
  { code: 'HEF1', name: 'Maintain weatherproof traditional farm or forestry buildings', unit: 'm²', rate: 5, rateText: '£5 per square metre each year' },
  { code: 'SCR2', name: 'Manage scrub and open habitat mosaics', unit: 'ha', rate: 350, rateText: '£350 per hectare each year' },
  { code: 'WBD1', name: 'Manage ponds', unit: 'pond', rate: 257, rateText: '£257 per pond each year' },
  { code: 'WBD2', name: 'Manage ditches', unit: 'm', rate: 4, rateText: '£4 per 100 metres (both sides) each year' }
]

var UNIT_LABELS = {
  ha: { suffix: 'ha', plural: 'hectares' },
  m: { suffix: 'm', plural: 'metres' },
  'm²': { suffix: 'm²', plural: 'square metres' },
  pond: { suffix: 'ponds', plural: 'ponds' }
}

var actionsByCode = ACTIONS.reduce(function (lookup, action) {
  lookup[action.code] = action
  return lookup
}, {})

function getSessionData (req) {
  req.session.data = req.session.data || {}
  return req.session.data
}

var CLIG3_SUPPLEMENT_CODES = ACTIONS
  .filter(function (action) { return action.supplementOf === 'CLIG3' })
  .map(function (action) { return action.code })

function addPair (lookup, left, right) {
  if (!lookup[left]) {
    lookup[left] = []
  }
  if (lookup[left].indexOf(right) === -1) {
    lookup[left].push(right)
  }
}

// Same AAC matrix as v4a / v4b land-first, plus CLIG3 supplements which
// are not listed as deny-pairs in the CSV.
function getIncompatibleByCode (req) {
  var year = compatibilityMatrix.resolveYear(Number(getSessionData(req).compatibilityYear))
  var codes = ACTIONS.map(function (action) { return action.code })
  var incompatibleByCode = {}

  codes.forEach(function (code) {
    incompatibleByCode[code] = []
  })

  for (var i = 0; i < codes.length; i++) {
    for (var j = i + 1; j < codes.length; j++) {
      if (!compatibilityMatrix.areActionsCompatible(codes[i], codes[j], year)) {
        addPair(incompatibleByCode, codes[i], codes[j])
        addPair(incompatibleByCode, codes[j], codes[i])
      }
    }
  }

  CLIG3_SUPPLEMENT_CODES.forEach(function (code) {
    CLIG3_SUPPLEMENT_CODES.forEach(function (other) {
      if (code !== other) {
        addPair(incompatibleByCode, code, other)
      }
    })
  })

  return incompatibleByCode
}

function slugify (value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getGuidanceUrl (action) {
  return 'https://www.gov.uk/find-funding-for-land-or-farms/' + action.code.toLowerCase() + '-' + slugify(action.name)
}

function getAction (code) {
  return actionsByCode[String(code || '').toUpperCase()] || null
}

function getActionCatalog () {
  return ACTIONS.map(withDisplayFields)
}

function getInterestedCodes (req) {
  var stored = getSessionData(req)[INTERESTED_ACTIONS_KEY]
  var codes = Array.isArray(stored) ? stored : []
  return ACTIONS
    .map(function (action) { return action.code })
    .filter(function (code) { return codes.indexOf(code) !== -1 })
}

function setInterestedCodes (req, codes) {
  var list = (Array.isArray(codes) ? codes : [codes])
    .map(function (code) { return String(code || '').toUpperCase() })
    .filter(function (code) { return Boolean(actionsByCode[code]) })
  getSessionData(req)[INTERESTED_ACTIONS_KEY] = list
  return list
}

var RATE_SHORT_UNITS = { ha: '/ha', m: '/100m', 'm²': '/m²', pond: '/pond' }

function withDisplayFields (action) {
  return Object.assign({}, action, {
    unitLabel: UNIT_LABELS[action.unit],
    guidanceUrl: getGuidanceUrl(action),
    rateShortText: 'Payment rate per year: £' + action.rate + RATE_SHORT_UNITS[action.unit]
  })
}

function getInterestedActions (req) {
  return getInterestedCodes(req).map(function (code) {
    return withDisplayFields(getAction(code))
  })
}

// Interested actions plus anything already saved on the parcel, so saving
// again never drops an action the user has since taken off their list
function getActionsForParcel (req, parcelId) {
  var codes = getInterestedCodes(req)
  var saved = findSavedParcel(req, parcelId)
  ;(saved && saved.actions ? saved.actions : []).forEach(function (action) {
    var code = String(action.code || '').toUpperCase()
    if (actionsByCode[code] && codes.indexOf(code) === -1) {
      codes.push(code)
    }
  })
  return ACTIONS
    .filter(function (action) { return codes.indexOf(action.code) !== -1 })
    .map(withDisplayFields)
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

// Same land-cover rules as the parcel page AAC. A parcel is grey on the map
// when none of the chosen actions can be done on its land cover.
function isLandCoverEligibleForAction (code, coverName) {
  var name = String(coverName || '')
  switch (String(code || '').toUpperCase()) {
    case 'CSAM3':
      return /permanent grassland|temporary grass|arable|fallow|leguminous|perennial|crop/i.test(name)
    case 'SCR2':
      return /scrub|arable|fallow/i.test(name)
    case 'CLIG3':
    case 'CIGL1':
    case 'CIGL2':
    case 'CNUM2':
    case 'GRH7':
    case 'GRH8':
    case 'GRH10':
    case 'GRH12':
      return /permanent grassland|temporary grass/i.test(name)
    default:
      return true
  }
}

function parcelHasEligibleAction (landCover, codes) {
  var covers = toCoverNames(landCover)
  var list = Array.isArray(codes) ? codes : []
  if (!list.length) {
    return true
  }
  return list.some(function (code) {
    return covers.some(function (cover) {
      return isLandCoverEligibleForAction(code, cover)
    })
  })
}

function findSavedParcel (req, parcelId) {
  return landActions.getApplicationParcels(req).find(function (parcel) {
    return parcel.parcelId === parcelId
  }) || null
}

function buildParcel (req, parcelId) {
  var raw = parcelsById[parcelId]
  if (!raw) {
    return null
  }
  var areas = landActions.applyPrototypeParcelAreas({
    parcelId: parcelId,
    totalArea: raw.totalArea,
    availableArea: raw.availableArea || raw.totalArea
  })
  var landCover = toCoverNames(raw.landCover)
  var flags = consent.PARCEL_CONSENT_FLAGS[parcelId] || { sssi: false, hefer: false }
  var saved = findSavedParcel(req, parcelId)
  var savedActions = saved && Array.isArray(saved.actions) ? saved.actions : []
  var summary = landActions.summariseParcelActions({
    totalArea: areas.totalArea,
    availableArea: areas.availableArea,
    actions: savedActions
  })

  return {
    parcelId: parcelId,
    parcelReference: parcelReference.format(parcelId) || raw.parcelReference || raw.name,
    totalArea: String(areas.totalArea),
    availableArea: String(areas.availableArea),
    totalAreaFormatted: Number(areas.totalArea).toFixed(4) + ' hectares',
    totalAreaShort: Number(areas.totalArea).toFixed(4) + ' ha',
    availableAreaFormatted: Number(areas.availableArea).toFixed(4) + ' hectares',
    landCover: landCover,
    landCoverSummary: landCover.join(', '),
    coords: Array.isArray(raw.coords) ? raw.coords : [],
    sssi: Boolean(flags.sssi),
    hefer: Boolean(flags.hefer),
    savedActions: summary.actions,
    savedCount: summary.actions.length,
    savedYearlyPaymentFormatted: summary.yearlyPaymentFormatted
  }
}

function getParcels (req) {
  return Object.keys(parcelsById)
    .map(function (parcelId) {
      return buildParcel(req, parcelId)
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return String(a.parcelReference).localeCompare(String(b.parcelReference))
    })
}

function getSavedQuantities (req, parcelId) {
  var saved = findSavedParcel(req, parcelId)
  var quantities = {}
  ;(saved && saved.actions ? saved.actions : []).forEach(function (action) {
    var code = String(action.code).toUpperCase()
    var catalogue = actionsByCode[code]
    // Hectares go back into the box with 4 decimal places, or the format check rejects them
    quantities[code] = catalogue && catalogue.unit === 'ha' && Number.isFinite(Number(action.quantity))
      ? Number(action.quantity).toFixed(4)
      : String(action.quantity)
  })
  return quantities
}

function calculateYearlyPayment (action, quantity) {
  var amount = action.unit === 'm' ? (quantity / 100) * action.rate : quantity * action.rate
  return Math.round(amount * 100) / 100
}

function formatAmount (value, unit) {
  if (unit === 'ha') {
    return Number(value).toFixed(4) + ' hectares'
  }
  var whole = Math.round(Number(value))
  if (unit === 'pond') {
    return whole === 1 ? '1 pond' : whole.toLocaleString('en-GB') + ' ponds'
  }
  return whole.toLocaleString('en-GB') + ' ' + UNIT_LABELS[unit].plural
}

function formatErrorMessage (unit) {
  if (unit === 'pond') {
    return 'Enter number of ponds – for example, 2'
  }
  if (unit === 'm') {
    return 'Enter number of metres, rounded down to the nearest metre – for example, 234'
  }
  if (unit === 'm²') {
    return 'Enter number of square metres, rounded down to the nearest whole number – for example, 234'
  }
  return 'Enter number of hectares, up to 4 decimal places – for example, 12.3456'
}

function overLimitMessage (unit) {
  if (unit === 'm') {
    return 'Enter a number that is not higher than the available metres'
  }
  if (unit === 'm²') {
    return 'Enter a number that is not higher than the available square metres'
  }
  return 'Enter a number that is not higher than the available hectares'
}

// For example "Enter 20 metres or more"
function minimumMessage (action) {
  return 'Enter ' + formatAmount(action.minQuantity, action.unit) + ' or more'
}

function parseQuantity (raw, action) {
  var text = String(raw == null ? '' : raw).replace(/,/g, '').trim()
  if (!text) {
    return { empty: true }
  }
  var value = Number(text)
  if (!Number.isFinite(value)) {
    return { error: formatErrorMessage(action.unit) }
  }
  if (value <= 0) {
    return { error: formatErrorMessage(action.unit) }
  }
  if (action.unit === 'ha') {
    if (!/^\d+\.\d{4}$/.test(text)) {
      return { error: formatErrorMessage(action.unit) }
    }
  } else if (!Number.isInteger(value)) {
    return { error: formatErrorMessage(action.unit) }
  }
  if (action.minQuantity && value < action.minQuantity) {
    return { error: minimumMessage(action) }
  }
  return { value: value }
}

/**
 * Check the quantities posted for one parcel.
 * maxByCode comes from the AAC calculation in the browser; when it is
 * missing (no JavaScript) only the format of each figure is checked.
 */
/**
 * Codes ticked on the parcel page. Supplements only count while CLIG3 is ticked,
 * because they sit inside the CLIG3 reveal.
 */
function getSelectedCodesFromBody (body) {
  var raw = body.v4bSelected || []
  var codes = (Array.isArray(raw) ? raw : [raw])
    .map(function (code) { return String(code || '').toUpperCase() })
    .filter(function (code) { return Boolean(actionsByCode[code]) })
  var hasClig3 = codes.indexOf('CLIG3') !== -1
  return codes.filter(function (code) {
    return hasClig3 || !actionsByCode[code].supplementOf
  })
}

function validateParcelQuantities (req, parcelId, body) {
  var errors = []
  var actions = []
  var values = {}
  var selectedCodes = getSelectedCodesFromBody(body)

  getActionsForParcel(req, parcelId).forEach(function (action) {
    var fieldName = 'v4bQuantity-' + action.code
    // A full-area supplement (GRH10) always takes the quantity entered for its base action
    var raw = action.fullBaseArea ? body['v4bQuantity-' + action.supplementOf] : body[fieldName]
    var selected = selectedCodes.indexOf(action.code) !== -1
    // An unticked action keeps no quantity, so it gives its land back
    values[action.code] = selected && raw != null ? String(raw) : ''

    if (!selected || body['v4bUnavailable-' + action.code] === 'true') {
      return
    }

    var parsed = parseQuantity(raw, action)
    if (action.fullBaseArea && (parsed.empty || parsed.error)) {
      // The base action's own error covers a bad figure; an empty one needs saying here
      if (parsed.empty) {
        errors.push({
          code: action.code,
          href: '#v4bSelected-' + action.code,
          text: 'Enter a quantity for ' + action.supplementOf + ' to add ' + action.code
        })
      }
      return
    }
    if (parsed.empty && action.wholeRemainingArea) {
      errors.push({
        code: action.code,
        href: '#v4bSelected-' + action.code,
        text: 'There is no eligible land left for ' + action.code + ' on this land parcel. Deselect it, or reduce your other actions'
      })
      return
    }
    // Ticked with nothing entered: same message as a wrong figure (validation designs)
    if (parsed.empty) {
      errors.push({ code: action.code, text: formatErrorMessage(action.unit) })
      return
    }
    if (parsed.error) {
      errors.push({ code: action.code, text: parsed.error })
      return
    }

    // Ponds have no available amount, so there is no upper limit to check
    var maxRaw = action.fullBaseArea || action.unit === 'pond' ? null : body['v4bMax-' + action.code]
    var max = maxRaw === '' || maxRaw == null ? null : Number(maxRaw)
    if (max != null && Number.isFinite(max) && parsed.value > max + 0.00005) {
      errors.push({
        code: action.code,
        text: overLimitMessage(action.unit)
      })
      return
    }

    actions.push({
      code: action.code,
      name: action.name,
      quantity: String(parsed.value),
      unit: action.unit,
      paymentRate: action.rate,
      yearlyPayment: calculateYearlyPayment(action, parsed.value)
    })
  })

  var supplements = actions.filter(function (action) {
    return getAction(action.code).supplementOf
  })
  var clig3 = actions.find(function (action) { return action.code === 'CLIG3' })
  supplements.forEach(function (action) {
    if (!clig3) {
      errors.push({ code: action.code, text: 'Enter a quantity for CLIG3 to add ' + action.code })
    } else if (Number(action.quantity) > Number(clig3.quantity) + 0.00005) {
      errors.push({
        code: action.code,
        text: action.code + ' quantity must be ' + formatAmount(clig3.quantity, 'ha') + ' or less (the area of CLIG3)'
      })
    }
  })

  return { errors: errors, actions: actions, values: values, selectedCodes: selectedCodes }
}

function saveParcelActions (req, parcelId, actions) {
  var parcel = buildParcel(req, parcelId)
  if (!parcel) {
    return null
  }
  if (!actions.length) {
    landActions.removeParcelFromBasket(req, parcelId)
    return parcel
  }
  landActions.upsertApplicationParcel(req, {
    parcelId: parcelId,
    parcelName: parcel.parcelReference,
    osReference: parcel.parcelReference,
    parcelReference: parcel.parcelReference,
    totalArea: parcel.totalArea,
    availableArea: parcel.availableArea,
    landCover: parcel.landCover,
    actions: actions
  })
  landActions.syncParcelSelectionsData(req)
  return parcel
}

function setFlash (req, message) {
  getSessionData(req)[FLASH_KEY] = message
}

function takeFlash (req) {
  var data = getSessionData(req)
  var message = data[FLASH_KEY] || null
  delete data[FLASH_KEY]
  return message
}

// CIGL1 / CIGL2 25% limit — leave out the parcel being edited so it is not counted twice
function getLimitedAreaConfig (req, farmTotalHa, excludeParcelId) {
  return {
    farmTotalHa: farmTotalHa,
    applicationParcels: landActions.getApplicationParcels(req)
      .filter(function (parcel) { return parcel.parcelId !== excludeParcelId })
      .map(function (parcel) {
        return {
          parcelId: parcel.parcelId,
          actions: (parcel.actions || []).map(function (action) {
            return { code: action.code, quantity: action.quantity }
          })
        }
      })
  }
}

/**
 * Where each action is already used in the application:
 * { CLIG3: [{ parcelId, parcelReference }], ... }
 */
function getActionUsage (req) {
  var usage = {}
  landActions.getApplicationParcels(req).forEach(function (parcel) {
    ;(parcel.actions || []).forEach(function (action) {
      var code = String(action.code || '').toUpperCase()
      if (!actionsByCode[code]) {
        return
      }
      usage[code] = usage[code] || []
      usage[code].push({
        parcelId: parcel.parcelId,
        parcelReference: landActions.getParcelDisplayReference(parcel)
      })
    })
  })
  Object.keys(usage).forEach(function (code) {
    usage[code].sort(function (a, b) {
      return String(a.parcelReference).localeCompare(String(b.parcelReference))
    })
  })
  return usage
}

// Take these actions off every parcel in the application. A parcel left with nothing is removed.
function removeActionsFromApplication (req, codes) {
  var removing = codes.map(function (code) { return String(code).toUpperCase() })
  landActions.getApplicationParcels(req).slice().forEach(function (parcel) {
    var remaining = (parcel.actions || []).filter(function (action) {
      return removing.indexOf(String(action.code || '').toUpperCase()) === -1
    })
    if (remaining.length === (parcel.actions || []).length) {
      return
    }
    if (!remaining.length) {
      landActions.removeParcelFromBasket(req, parcel.parcelId)
    } else {
      landActions.upsertApplicationParcel(req, Object.assign({}, parcel, { actions: remaining }))
    }
  })
  landActions.syncParcelSelectionsData(req)
}

module.exports = {
  getActionUsage: getActionUsage,
  removeActionsFromApplication: removeActionsFromApplication,
  getActionCatalog: getActionCatalog,
  getAction: getAction,
  getInterestedCodes: getInterestedCodes,
  setInterestedCodes: setInterestedCodes,
  getInterestedActions: getInterestedActions,
  getActionsForParcel: getActionsForParcel,
  parcelHasEligibleAction: parcelHasEligibleAction,
  getParcels: getParcels,
  buildParcel: buildParcel,
  getSavedQuantities: getSavedQuantities,
  validateParcelQuantities: validateParcelQuantities,
  saveParcelActions: saveParcelActions,
  setFlash: setFlash,
  takeFlash: takeFlash,
  getLimitedAreaConfig: getLimitedAreaConfig,
  getIncompatibleByCode: getIncompatibleByCode
}
