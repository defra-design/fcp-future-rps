/**
 * Session helpers for the grasslands-v2 multi-step land and actions journey.
 */

var parcelReference = require('./sfi-grasslands-v3-parcel-reference')

function getSessionData (req) {
  req.session.data = req.session.data || {}
  return req.session.data
}

function parseJson (value, fallback) {
  if (!value) {
    return fallback
  }
  if (typeof value === 'object') {
    return value
  }
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

function getApplicationParcels (req) {
  var data = getSessionData(req)
  var parcels = parseJson(data.sfiApplicationParcels, [])
  if (!Array.isArray(parcels)) {
    parcels = []
  }
  data.sfiApplicationParcels = parcels
  return parcels
}

// Fixed total/available for user-testing OS refs (SO3757 3193 / 3194).
var PROTOTYPE_PARCEL_AREAS = {
  'gate-field': { totalArea: '44.8800', availableArea: '39.8100' },
  'far-meadow': { totalArea: '56.3200', availableArea: '56.3200' }
}

function applyPrototypeParcelAreas (parcel) {
  if (!parcel || !parcel.parcelId) {
    return parcel
  }
  var areas = PROTOTYPE_PARCEL_AREAS[parcel.parcelId]
  if (!areas) {
    return parcel
  }
  return Object.assign({}, parcel, {
    totalArea: areas.totalArea,
    availableArea: areas.availableArea
  })
}

function getDraftParcel (req) {
  var data = getSessionData(req)
  return applyPrototypeParcelAreas(parseJson(data.sfiDraftLandParcel, null))
}

function setDraftParcel (req, parcel) {
  var data = getSessionData(req)
  data.sfiDraftLandParcel = applyPrototypeParcelAreas(parcel || null)
  return data.sfiDraftLandParcel
}

function getDraftActions (req) {
  var data = getSessionData(req)
  var actions = parseJson(data.sfiDraftLandActions, [])
  if (!Array.isArray(actions)) {
    actions = []
  }
  return actions
}

function setDraftActions (req, actions) {
  var data = getSessionData(req)
  data.sfiDraftLandActions = Array.isArray(actions) ? actions : []
  return data.sfiDraftLandActions
}

function clearDraft (req) {
  var data = getSessionData(req)
  delete data.sfiDraftLandParcel
  delete data.sfiDraftLandActions
  delete data.sfiDraftParcelId
  clearClig3SupplementsComplete(req)
}

function clearLandActionsEditSnapshot (req) {
  delete getSessionData(req).sfiLandActionsEditSnapshot
}

function getLandActionsEditSnapshot (req) {
  return getSessionData(req).sfiLandActionsEditSnapshot || null
}

function shouldShowCancelLandActions (req) {
  return Boolean(getLandActionsEditSnapshot(req)) || hasSavedLandAndActions(req)
}

function cancelLandActionsDraft (req) {
  var data = getSessionData(req)
  var snapshot = getLandActionsEditSnapshot(req)

  clearDraft(req)
  clearLandActionsEditSnapshot(req)
  delete data.focusActionCode
  delete data.clig3SupplementsDirectEdit

  if (snapshot && snapshot.parcel) {
    upsertApplicationParcel(req, snapshot.parcel)
    syncParcelSelectionsData(req)
  }

  return hasSavedLandAndActions(req)
}

function clearClig3SupplementsComplete (req) {
  var data = getSessionData(req)
  delete data.clig3SupplementsCompleteParcelId
  delete data.clig3SupplementsCompleteQuantity
}

function markClig3SupplementsComplete (req, actions) {
  var data = getSessionData(req)
  var parcel = getDraftParcel(req)
  if (!parcel || !parcel.parcelId || !draftHasClig3(actions)) {
    clearClig3SupplementsComplete(req)
    return
  }
  data.clig3SupplementsCompleteParcelId = parcel.parcelId
  data.clig3SupplementsCompleteQuantity = getClig3AppliedQuantity(actions)
}

function shouldShowClig3Supplements (req, actions) {
  if (!draftHasClig3(actions)) {
    return false
  }
  var data = getSessionData(req)
  var parcel = getDraftParcel(req)
  if (!parcel || !parcel.parcelId) {
    return true
  }
  if (data.clig3SupplementsCompleteParcelId !== parcel.parcelId) {
    return true
  }
  var completeQty = Number(data.clig3SupplementsCompleteQuantity)
  var currentQty = getClig3AppliedQuantity(actions)
  if (!Number.isFinite(completeQty)) {
    return true
  }
  // Only return to the supplements page when CLIG3 quantity has changed
  return Math.abs(completeQty - currentQty) > 0.0001
}

function formatLandCover (landCover) {
  if (Array.isArray(landCover)) {
    return landCover
  }
  if (!landCover) {
    return []
  }
  return [String(landCover)]
}

function formatLandCoverLines (landCover, totalArea) {
  var names = formatLandCover(landCover)
  if (!names.length) {
    names = ['Permanent grassland']
  }

  var shares = typeof parcelReference.allocateLandCoverAreas === 'function'
    ? parcelReference.allocateLandCoverAreas(names, totalArea)
    : names.map(function (name) {
      return { name: name, ha: null }
    })

  if (shares.length <= 1) {
    return [shares[0] ? shares[0].name : 'Permanent grassland']
  }

  return shares.map(function (share) {
    return share.name + ' - ' + toNumber(share.ha).toFixed(4) + ' ha'
  })
}

function getParcelDisplayReference (parcel) {
  if (!parcel) {
    return ''
  }
  if (parcel.parcelReference) {
    return String(parcel.parcelReference)
  }
  var fromId = parcelReference.format(parcel.parcelId || parcel)
  if (fromId) {
    return fromId
  }
  // Legacy sessions may still have name / OS grid ref
  return parcel.osReference || parcel.osRef || parcel.parcelName || ''
}

function upsertApplicationParcel (req, parcelEntry) {
  var parcels = getApplicationParcels(req)
  var existingIndex = parcels.findIndex(function (parcel) {
    return parcel.parcelId === parcelEntry.parcelId
  })

  if (existingIndex === -1) {
    parcels.push(parcelEntry)
  } else {
    parcels[existingIndex] = parcelEntry
  }

  getSessionData(req).sfiApplicationParcels = parcels
  return parcels
}

function buildParcelSelectionsDataFromApplication (req) {
  var parcels = getApplicationParcels(req)
  var selections = {}

  parcels.forEach(function (parcel) {
    selections[parcel.parcelId] = {
      parcelId: parcel.parcelId,
      parcelName: getParcelDisplayReference(parcel),
      osRef: getParcelDisplayReference(parcel),
      parcelReference: getParcelDisplayReference(parcel),
      landCover: formatLandCover(parcel.landCover).join(', ') || 'Permanent grassland',
      totalArea: parcel.totalArea,
      actions: (parcel.actions || []).map(function (action) {
        return {
          code: action.code,
          name: action.name,
          quantity: action.quantity,
          unit: action.unit,
          annualPayment: action.yearlyPayment
        }
      })
    }
  })

  return JSON.stringify(selections)
}

function syncParcelSelectionsData (req) {
  getSessionData(req).sfiParcelSelectionsData = buildParcelSelectionsDataFromApplication(req)
}

function hasSavedLandAndActions (req) {
  var parcels = getApplicationParcels(req)
  return parcels.some(function (parcel) {
    return parcel && Array.isArray(parcel.actions) && parcel.actions.length > 0
  })
}

function toNumber (value) {
  var number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatMoney (value) {
  return '£' + toNumber(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatHectares (value) {
  return toNumber(value).toFixed(4) + ' hectares'
}

function formatHaShort (value) {
  return toNumber(value).toFixed(4) + ' ha'
}

function formatQuantityDisplay (action) {
  var unit = (action && action.unit) ? String(action.unit) : 'ha'
  var quantity = toNumber(action && action.quantity)

  if (unit === 'pond') {
    var pondCount = Math.round(quantity)
    return pondCount === 1
      ? '1 pond'
      : pondCount.toLocaleString('en-GB') + ' ponds'
  }

  if (unit === 'm') {
    return Math.round(quantity).toLocaleString('en-GB') + ' m'
  }

  return quantity.toFixed(4) + ' ' + unit
}

function formatActionValueDisplay (action) {
  var quantityText = formatQuantityDisplay(action)
  var payment = toNumber(action && action.yearlyPayment)

  if (payment > 0 || (action && action.yearlyPayment != null && action.yearlyPayment !== '')) {
    return quantityText + ' (' + formatMoney(payment) + ')'
  }

  return quantityText
}

var actionNamesByCode = null

function getCatalogActionName (code) {
  if (!actionNamesByCode) {
    actionNamesByCode = {}
    try {
      require('./data/sfi24-codes-names.json').forEach(function (row) {
        if (row && row.code) {
          actionNamesByCode[String(row.code).toUpperCase()] = row.name
        }
      })
    } catch (error) {
      actionNamesByCode = {}
    }
  }
  return actionNamesByCode[String(code || '').toUpperCase()] || ''
}

function resolveActionDisplayName (action) {
  var code = String((action && action.code) || '').toUpperCase()
  var name = String((action && action.name) || '').trim()
  var catalogName = getCatalogActionName(code)
  if (!name || name.toUpperCase() === code) {
    return catalogName || name || code
  }
  return name
}

// Stacked on a base action (same land) — do not add to exclusive hectares used
var STACKED_SUPPLEMENT_CODES = {
  GRH7: true,
  GRH8: true,
  GRH10: true
}

// Official SFI payment rates (£/ha) — keep aligned with sfi-scheme-2026 catalog
var CLIG3_SUPPLEMENT_RATE_PER_HA = {
  GRH7: 157,
  GRH8: 187,
  GRH10: 28
}

var CLIG3_SUPPLEMENT_CODE_ORDER = ['GRH7', 'GRH8', 'GRH10']

function isStackedSupplementAction (code) {
  return !!STACKED_SUPPLEMENT_CODES[String(code || '').toUpperCase()]
}

function isClig3SupplementAction (code) {
  return isStackedSupplementAction(code)
}

function groupParcelActionsForDisplay (actions) {
  var list = Array.isArray(actions) ? actions : []
  var supplements = list.filter(function (action) {
    return isClig3SupplementAction(action && action.code)
  })
  var hasClig3 = list.some(function (action) {
    return String((action && action.code) || '').toUpperCase() === 'CLIG3'
  })

  if (!hasClig3 || !supplements.length) {
    return list
  }

  var grouped = []
  list.forEach(function (action) {
    if (isClig3SupplementAction(action && action.code)) {
      return
    }
    grouped.push(action)
    if (String((action && action.code) || '').toUpperCase() === 'CLIG3') {
      supplements.forEach(function (supplement) {
        grouped.push(supplement)
      })
    }
  })
  return grouped
}

function supplementRequiresQuantityInput (code) {
  var normalised = String(code || '').toUpperCase()
  return normalised === 'GRH7' || normalised === 'GRH8'
}

function supplementAppliesFullClig3Area (code) {
  return String(code || '').toUpperCase() === 'GRH10'
}

function findActionByCode (actions, code) {
  var normalised = String(code || '').toUpperCase()
  return (actions || []).find(function (action) {
    return String((action && action.code) || '').toUpperCase() === normalised
  }) || null
}

function draftHasClig3 (actions) {
  return Boolean(findActionByCode(actions, 'CLIG3'))
}

function getClig3AppliedQuantity (actions) {
  var clig3 = findActionByCode(actions, 'CLIG3')
  if (!clig3) {
    return 0
  }
  return toNumber(clig3.quantity)
}

function getSelectedClig3SupplementCode (actions) {
  var selected = (actions || []).find(function (action) {
    return isClig3SupplementAction(action && action.code)
  })
  return selected ? String(selected.code).toUpperCase() : ''
}

function getSelectedClig3SupplementQuantity (actions) {
  var code = getSelectedClig3SupplementCode(actions)
  if (!code) {
    return ''
  }
  var selected = findActionByCode(actions, code)
  if (!selected || selected.quantity == null || selected.quantity === '') {
    return ''
  }
  return String(selected.quantity)
}

function stripClig3Supplements (actions) {
  return (actions || []).filter(function (action) {
    return !isClig3SupplementAction(action && action.code)
  })
}

function getClig3SupplementGuidanceUrl (code, name) {
  var codeSlug = String(code || '').toLowerCase()
  var nameSlug = String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  if (!codeSlug || !nameSlug) {
    return 'https://www.gov.uk/find-funding-for-land-or-farms'
  }
  return 'https://www.gov.uk/find-funding-for-land-or-farms/' + codeSlug + '-' + nameSlug
}

function getClig3SupplementOptions (clig3Ha) {
  var availableHa = Math.max(0, toNumber(clig3Ha))
  var availableFormatted = availableHa.toFixed(4) + ' hectares'

  return CLIG3_SUPPLEMENT_CODE_ORDER.map(function (code) {
    var name = getCatalogActionName(code) || code
    var ratePerHa = CLIG3_SUPPLEMENT_RATE_PER_HA[code]
    var requiresQuantity = supplementRequiresQuantityInput(code)
    var appliesFullArea = supplementAppliesFullClig3Area(code)

    return {
      code: code,
      name: name,
      ratePerHa: ratePerHa,
      rateText: '£' + ratePerHa + '/ha',
      availableText: appliesFullArea
        ? availableFormatted + ' available'
        : 'Up to ' + availableFormatted + ' available',
      requiresQuantityInput: requiresQuantity,
      appliesFullClig3Area: appliesFullArea,
      guidanceUrl: getClig3SupplementGuidanceUrl(code, name)
    }
  })
}

function parseSupplementQuantity (rawValue) {
  if (rawValue == null) {
    return { valid: false, value: 0 }
  }
  var normalised = String(rawValue).replace(/,/g, '').replace(/\s/g, '').trim()
  if (!normalised) {
    return { valid: false, value: 0 }
  }
  var value = Number(normalised)
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, value: 0 }
  }
  return { valid: true, value: Math.round(value * 10000) / 10000 }
}

function applyClig3SupplementSelection (actions, supplementCode, quantityRaw) {
  var nextActions = stripClig3Supplements(actions)
  var code = String(supplementCode || '').toUpperCase()
  if (!code || !STACKED_SUPPLEMENT_CODES[code] || !draftHasClig3(nextActions)) {
    return { actions: nextActions, error: null }
  }

  var name = getCatalogActionName(code) || code
  var ratePerHa = CLIG3_SUPPLEMENT_RATE_PER_HA[code]
  if (!Number.isFinite(ratePerHa)) {
    return { actions: nextActions, error: null }
  }

  var clig3Ha = getClig3AppliedQuantity(nextActions)
  var quantity = clig3Ha

  if (supplementRequiresQuantityInput(code)) {
    var parsed = parseSupplementQuantity(quantityRaw)
    if (!parsed.valid) {
      return {
        actions: nextActions,
        error: {
          fieldId: 'quantity-' + code.toLowerCase(),
          text: 'Enter a quantity for ' + code
        }
      }
    }
    if (parsed.value > clig3Ha + 0.00005) {
      return {
        actions: nextActions,
        error: {
          fieldId: 'quantity-' + code.toLowerCase(),
          text: 'Quantity must be ' + clig3Ha.toFixed(4) + ' hectares or less'
        }
      }
    }
    quantity = parsed.value
  }

  nextActions.push({
    code: code,
    name: name,
    quantity: String(quantity),
    unit: 'ha',
    paymentRate: ratePerHa,
    yearlyPayment: Math.round(quantity * ratePerHa * 100) / 100
  })

  return { actions: nextActions, error: null }
}

function summariseParcelActions (parcel) {
  var actions = Array.isArray(parcel && parcel.actions) ? parcel.actions : []
  var areaUsed = 0
  var yearlyPayment = 0

  actions.forEach(function (action) {
    yearlyPayment += toNumber(action && action.yearlyPayment)
    if (action && action.unit === 'ha' && !isStackedSupplementAction(action.code)) {
      areaUsed += toNumber(action.quantity)
    }
  })

  var totalArea = toNumber(parcel && parcel.totalArea)
  var availableArea = parcel && parcel.availableArea != null && parcel.availableArea !== ''
    ? toNumber(parcel.availableArea)
    : totalArea
  var availableLeft = availableArea - areaUsed

  return {
    areaUsed: areaUsed,
    areaUsedFormatted: formatHaShort(areaUsed),
    availableLeft: availableLeft,
    availableLeftFormatted: formatHaShort(availableLeft),
    totalAreaFormatted: formatHaShort(totalArea),
    yearlyPayment: yearlyPayment,
    yearlyPaymentFormatted: formatMoney(yearlyPayment),
    actions: actions.map(function (action) {
      return Object.assign({}, action, {
        name: resolveActionDisplayName(action),
        yearlyPaymentFormatted: formatMoney(action && action.yearlyPayment),
        quantityDisplay: formatQuantityDisplay(action),
        valueDisplay: formatActionValueDisplay(action)
      })
    })
  }
}

function buildBasketParcels (req) {
  var applicationParcels = getApplicationParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      actions: Array.isArray(parcel.actions) ? parcel.actions.slice() : [],
      isDraft: false
    })
  })

  var draftParcel = getDraftParcel(req)
  var draftActions = getDraftActions(req)

  if (draftParcel && draftParcel.parcelId && Array.isArray(draftActions) && draftActions.length > 0) {
    var draftEntry = {
      parcelId: draftParcel.parcelId,
      parcelName: draftParcel.parcelName,
      osReference: draftParcel.osReference,
      totalArea: draftParcel.totalArea,
      landCover: formatLandCover(draftParcel.landCover),
      availableArea: draftParcel.availableArea,
      actions: draftActions.slice(),
      isDraft: true
    }

    var existingIndex = applicationParcels.findIndex(function (parcel) {
      return parcel.parcelId === draftEntry.parcelId
    })

    if (existingIndex === -1) {
      applicationParcels.push(draftEntry)
    } else {
      applicationParcels[existingIndex] = draftEntry
    }
  }

  return applicationParcels
    .filter(function (parcel) {
      return parcel && Array.isArray(parcel.actions) && parcel.actions.length > 0
    })
    .reverse()
    .map(function (parcel) {
      var summary = summariseParcelActions(parcel)
      var reference = getParcelDisplayReference(parcel) || 'Unknown parcel'

      return Object.assign({}, parcel, summary, {
        heading: 'Parcel reference ' + reference,
        parcelReference: reference,
        landCoverLines: formatLandCoverLines(parcel.landCover, parcel.totalArea)
      })
    })
}

function summariseBasket (basketParcels) {
  var totalYearlyPayment = 0

  ;(basketParcels || []).forEach(function (parcel) {
    totalYearlyPayment += toNumber(parcel && parcel.yearlyPayment)
  })

  return {
    totalYearlyPayment: totalYearlyPayment,
    totalYearlyPaymentFormatted: formatMoney(totalYearlyPayment),
    isEmpty: !basketParcels || basketParcels.length === 0
  }
}

function removeParcelFromBasket (req, parcelId) {
  var data = getSessionData(req)
  var draftParcel = getDraftParcel(req)

  if (draftParcel && draftParcel.parcelId === parcelId) {
    clearDraft(req)
  }

  var parcels = getApplicationParcels(req).filter(function (parcel) {
    return parcel.parcelId !== parcelId
  })
  data.sfiApplicationParcels = parcels
  syncParcelSelectionsData(req)
  return parcels
}

function loadParcelIntoDraftForEdit (req, parcelId) {
  var parcels = getApplicationParcels(req)
  var parcel = parcels.find(function (entry) {
    return entry.parcelId === parcelId
  })

  if (!parcel) {
    var draftParcel = getDraftParcel(req)
    if (draftParcel && draftParcel.parcelId === parcelId) {
      // First parcel can still be draft-only (not committed until Continue /
      // Add another on confirm). Snapshot it so Cancel changes / no-Back
      // edit mode works the same as for saved parcels.
      ensureLandActionsEditSnapshotFromDraft(req, draftParcel)
      return true
    }
    return false
  }

  setDraftParcel(req, {
    parcelId: parcel.parcelId,
    parcelName: getParcelDisplayReference(parcel),
    osReference: getParcelDisplayReference(parcel),
    parcelReference: getParcelDisplayReference(parcel),
    totalArea: parcel.totalArea,
    landCover: formatLandCover(parcel.landCover),
    availableArea: parcel.availableArea
  })
  setDraftActions(req, Array.isArray(parcel.actions) ? parcel.actions : [])

  // Snapshot so Cancel changes can restore the pre-edit basket state.
  // Editing moves the parcel out of application into draft.
  getSessionData(req).sfiLandActionsEditSnapshot = {
    parcel: JSON.parse(JSON.stringify(parcel))
  }

  // Already chose supplements for this saved parcel — only revisit if CLIG3 quantity changes
  markClig3SupplementsComplete(req, getDraftActions(req))

  getSessionData(req).sfiApplicationParcels = parcels.filter(function (entry) {
    return entry.parcelId !== parcelId
  })
  syncParcelSelectionsData(req)
  return true
}

function ensureLandActionsEditSnapshotFromDraft (req, draftParcel) {
  if (getLandActionsEditSnapshot(req)) {
    return
  }

  var displayReference = getParcelDisplayReference(draftParcel)
  getSessionData(req).sfiLandActionsEditSnapshot = {
    parcel: JSON.parse(JSON.stringify({
      parcelId: draftParcel.parcelId,
      parcelName: displayReference,
      osReference: displayReference,
      parcelReference: displayReference,
      totalArea: draftParcel.totalArea,
      landCover: formatLandCover(draftParcel.landCover),
      availableArea: draftParcel.availableArea,
      actions: getDraftActions(req)
    }))
  }
}

function findBasketParcel (req, parcelId) {
  return buildBasketParcels(req).find(function (parcel) {
    return parcel.parcelId === parcelId
  }) || null
}

function summariseDraftActions (actions) {
  var list = Array.isArray(actions) ? actions : []
  var totalYearlyPayment = 0
  var totalAreaUsed = 0

  list.forEach(function (action) {
    totalYearlyPayment += toNumber(action && action.yearlyPayment)
    if (action && action.unit === 'ha') {
      totalAreaUsed += toNumber(action.quantity)
    }
  })

  return {
    totalYearlyPayment: totalYearlyPayment,
    totalYearlyPaymentFormatted: formatMoney(totalYearlyPayment),
    totalAreaUsed: totalAreaUsed,
    totalAreaUsedFormatted: formatHectares(totalAreaUsed)
  }
}

function remainingAvailableArea (draftParcel, totalAreaUsed) {
  if (!draftParcel || draftParcel.availableArea == null || draftParcel.availableArea === '') {
    return null
  }
  var remaining = toNumber(draftParcel.availableArea) - toNumber(totalAreaUsed)
  return {
    value: remaining,
    formatted: formatHectares(remaining)
  }
}

function saveDraftParcelFromBody (req, body) {
  var landCover = parseJson(body.selectedParcelLandCover, null)
  if (!Array.isArray(landCover)) {
    landCover = formatLandCover(body.selectedParcelLandCover)
    if (landCover.length === 1 && String(landCover[0]).indexOf(',') !== -1) {
      landCover = String(landCover[0]).split(',').map(function (part) {
        return part.trim()
      }).filter(Boolean)
    }
  }

  var displayReference = body.selectedParcelReference ||
    body.selectedParcelOsRef ||
    body.selectedParcelName ||
    parcelReference.format(body.selectedParcelId)

  return setDraftParcel(req, {
    parcelId: body.selectedParcelId,
    parcelName: displayReference,
    osReference: displayReference,
    parcelReference: displayReference,
    totalArea: body.selectedParcelTotalArea,
    landCover: landCover,
    availableArea: body.selectedParcelAvailableArea
  })
}

function commitDraftToApplication (req) {
  var draftParcel = getDraftParcel(req)
  var draftActions = getDraftActions(req)

  if (!draftParcel || !draftParcel.parcelId) {
    return getApplicationParcels(req)
  }

  var displayReference = getParcelDisplayReference(draftParcel)

  upsertApplicationParcel(req, {
    parcelId: draftParcel.parcelId,
    parcelName: displayReference,
    osReference: displayReference,
    parcelReference: displayReference,
    totalArea: draftParcel.totalArea,
    landCover: formatLandCover(draftParcel.landCover),
    availableArea: draftParcel.availableArea,
    actions: draftActions
  })

  syncParcelSelectionsData(req)
  clearDraft(req)
  clearLandActionsEditSnapshot(req)
  return getApplicationParcels(req)
}

module.exports = {
  getApplicationParcels: getApplicationParcels,
  getDraftParcel: getDraftParcel,
  setDraftParcel: setDraftParcel,
  getDraftActions: getDraftActions,
  setDraftActions: setDraftActions,
  clearDraft: clearDraft,
  cancelLandActionsDraft: cancelLandActionsDraft,
  shouldShowCancelLandActions: shouldShowCancelLandActions,
  formatLandCover: formatLandCover,
  getParcelDisplayReference: getParcelDisplayReference,
  upsertApplicationParcel: upsertApplicationParcel,
  syncParcelSelectionsData: syncParcelSelectionsData,
  hasSavedLandAndActions: hasSavedLandAndActions,
  summariseDraftActions: summariseDraftActions,
  remainingAvailableArea: remainingAvailableArea,
  isClig3SupplementAction: isClig3SupplementAction,
  isStackedSupplementAction: isStackedSupplementAction,
  groupParcelActionsForDisplay: groupParcelActionsForDisplay,
  draftHasClig3: draftHasClig3,
  shouldShowClig3Supplements: shouldShowClig3Supplements,
  markClig3SupplementsComplete: markClig3SupplementsComplete,
  clearClig3SupplementsComplete: clearClig3SupplementsComplete,
  getClig3AppliedQuantity: getClig3AppliedQuantity,
  getSelectedClig3SupplementCode: getSelectedClig3SupplementCode,
  getSelectedClig3SupplementQuantity: getSelectedClig3SupplementQuantity,
  stripClig3Supplements: stripClig3Supplements,
  applyClig3SupplementSelection: applyClig3SupplementSelection,
  getClig3SupplementOptions: getClig3SupplementOptions,
  formatHectares: formatHectares,
  formatMoney: formatMoney,
  formatHaShort: formatHaShort,
  formatQuantityDisplay: formatQuantityDisplay,
  formatActionValueDisplay: formatActionValueDisplay,
  summariseParcelActions: summariseParcelActions,
  buildBasketParcels: buildBasketParcels,
  summariseBasket: summariseBasket,
  removeParcelFromBasket: removeParcelFromBasket,
  loadParcelIntoDraftForEdit: loadParcelIntoDraftForEdit,
  findBasketParcel: findBasketParcel,
  saveDraftParcelFromBody: saveDraftParcelFromBody,
  commitDraftToApplication: commitDraftToApplication
}
