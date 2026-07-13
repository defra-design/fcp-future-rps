/**
 * Session helpers for the grasslands-v2 multi-step land and actions journey.
 */

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
  var parcels = parseJson(data.applicationParcels, [])
  if (!Array.isArray(parcels)) {
    parcels = []
  }
  data.applicationParcels = parcels
  return parcels
}

function getDraftParcel (req) {
  var data = getSessionData(req)
  return parseJson(data.draftLandParcel, null)
}

function setDraftParcel (req, parcel) {
  var data = getSessionData(req)
  data.draftLandParcel = parcel || null
  return data.draftLandParcel
}

function getDraftActions (req) {
  var data = getSessionData(req)
  var actions = parseJson(data.draftLandActions, [])
  if (!Array.isArray(actions)) {
    actions = []
  }
  return actions
}

function setDraftActions (req, actions) {
  var data = getSessionData(req)
  data.draftLandActions = Array.isArray(actions) ? actions : []
  return data.draftLandActions
}

function clearDraft (req) {
  var data = getSessionData(req)
  delete data.draftLandParcel
  delete data.draftLandActions
  delete data.draftParcelId
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

  getSessionData(req).applicationParcels = parcels
  return parcels
}

function buildParcelSelectionsDataFromApplication (req) {
  var parcels = getApplicationParcels(req)
  var selections = {}

  parcels.forEach(function (parcel) {
    selections[parcel.parcelId] = {
      parcelId: parcel.parcelId,
      parcelName: parcel.parcelName,
      osRef: parcel.osReference,
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
  getSessionData(req).parcelSelectionsData = buildParcelSelectionsDataFromApplication(req)
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

function summariseParcelActions (parcel) {
  var actions = Array.isArray(parcel && parcel.actions) ? parcel.actions : []
  var areaUsed = 0
  var yearlyPayment = 0

  actions.forEach(function (action) {
    yearlyPayment += toNumber(action && action.yearlyPayment)
    if (action && action.unit === 'ha') {
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
    .map(function (parcel) {
      var summary = summariseParcelActions(parcel)
      var heading = parcel.parcelName || 'Land parcel'
      if (parcel.osReference) {
        heading += ' - ' + parcel.osReference
      }

      return Object.assign({}, parcel, summary, {
        heading: heading
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
  data.applicationParcels = parcels
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
      return true
    }
    return false
  }

  setDraftParcel(req, {
    parcelId: parcel.parcelId,
    parcelName: parcel.parcelName,
    osReference: parcel.osReference,
    totalArea: parcel.totalArea,
    landCover: formatLandCover(parcel.landCover),
    availableArea: parcel.availableArea
  })
  setDraftActions(req, Array.isArray(parcel.actions) ? parcel.actions : [])

  getSessionData(req).applicationParcels = parcels.filter(function (entry) {
    return entry.parcelId !== parcelId
  })
  syncParcelSelectionsData(req)
  return true
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

  return setDraftParcel(req, {
    parcelId: body.selectedParcelId,
    parcelName: body.selectedParcelName,
    osReference: body.selectedParcelOsRef,
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

  upsertApplicationParcel(req, {
    parcelId: draftParcel.parcelId,
    parcelName: draftParcel.parcelName,
    osReference: draftParcel.osReference,
    totalArea: draftParcel.totalArea,
    landCover: formatLandCover(draftParcel.landCover),
    availableArea: draftParcel.availableArea,
    actions: draftActions
  })

  syncParcelSelectionsData(req)
  clearDraft(req)
  return getApplicationParcels(req)
}

module.exports = {
  getApplicationParcels: getApplicationParcels,
  getDraftParcel: getDraftParcel,
  setDraftParcel: setDraftParcel,
  getDraftActions: getDraftActions,
  setDraftActions: setDraftActions,
  clearDraft: clearDraft,
  formatLandCover: formatLandCover,
  upsertApplicationParcel: upsertApplicationParcel,
  syncParcelSelectionsData: syncParcelSelectionsData,
  hasSavedLandAndActions: hasSavedLandAndActions,
  summariseDraftActions: summariseDraftActions,
  remainingAvailableArea: remainingAvailableArea,
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
