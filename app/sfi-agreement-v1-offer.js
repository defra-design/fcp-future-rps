/**
 * Build the SFI Agreement v1 offer review model from grasslands v3 session data.
 */
function parseParcelSelectionsData (rawValue) {
  if (!rawValue) {
    return null
  }
  if (typeof rawValue === 'object') {
    return rawValue
  }
  if (typeof rawValue !== 'string') {
    return null
  }
  try {
    return JSON.parse(rawValue)
  } catch (error) {
    try {
      return JSON.parse(rawValue.replace(/'/g, '"'))
    } catch (innerError) {
      return null
    }
  }
}

function parseNumber (value) {
  if (value === undefined || value === null) {
    return null
  }
  var parsed = Number(String(value).trim().replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney (amount) {
  var value = Number(amount)
  if (!Number.isFinite(value)) {
    value = 0
  }
  return '£' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatQuantity (quantity, unit) {
  if (!Number.isFinite(quantity)) {
    return '—'
  }
  var unitLabel = unit || 'ha'
  if (unitLabel === 'pond') {
    unitLabel = 'ponds'
  }
  var quantityText = Number.isInteger(quantity)
    ? quantity.toLocaleString('en-GB')
    : quantity.toFixed(4)
  return quantityText + ' ' + unitLabel
}

// Keep aligned with ACTIONS_SUMMARY_RATE_BY_CODE in routes.js (MVP subset + common codes).
var RATE_BY_CODE = {
  BND1: 27,
  BND2: 11,
  CHRW2: 13,
  CIGL1: 333,
  CIGL2: 515,
  CIGL3: 235,
  CLIG3: 151,
  CNUM2: 102,
  CSAM3: 224,
  CIPM2: 798,
  GRH7: 157,
  GRH8: 187,
  GRH10: 28,
  GRH12: 651,
  HEF1: 25,
  SCR2: 350,
  WBD1: 297,
  WBD2: 4
}

var PER_100M_CODES = {
  BND1: true,
  BND2: true,
  CHRW2: true,
  WBD2: true
}

var LINEAR_CODES = {
  BND1: true,
  BND2: true,
  CHRW2: true,
  WBD2: true
}

var NAME_BY_CODE = {
  BND1: 'Maintain dry stone walls',
  BND2: 'Maintain earth banks or stone-faced hedgebanks',
  CHRW2: 'Manage hedgerows',
  CIGL1: 'Take grassland field corners or blocks out of management',
  CIGL2: 'Winter bird food on improved grassland',
  CIGL3: '4m to 12m grass buffer strip on improved grassland',
  CLIG3: 'Manage grassland with very low nutrient inputs',
  CNUM2: 'Legumes on improved grassland',
  CSAM3: 'Herbal leys',
  CIPM2: 'Flower-rich grass margins, blocks or in-field strips',
  GRH7: 'Haymaking supplement',
  GRH8: 'Haymaking supplement (late cut)',
  GRH10: 'Lenient grazing supplement',
  GRH12: 'Manage rough grassland for upland breeding waders',
  HEF1: 'Maintain weatherproof traditional farm or forestry buildings',
  SCR2: 'Manage scrub and open habitat mosaics',
  WBD1: 'Manage ponds',
  WBD2: 'Manage ditches'
}

function resolveActionName (code, action) {
  var fromAction = action && action.name && String(action.name).trim()
  if (fromAction && fromAction.toUpperCase() !== String(code).toUpperCase()) {
    return fromAction
  }
  return NAME_BY_CODE[code] || fromAction || code
}

function defaultUnitForCode (code) {
  if (code === 'WBD1') {
    return 'ponds'
  }
  if (LINEAR_CODES[code]) {
    return 'm'
  }
  return 'ha'
}

function formatPaymentRate (code, unit) {
  var rate = RATE_BY_CODE[code]
  if (!Number.isFinite(rate)) {
    return '—'
  }
  if (unit === 'pond' || unit === 'ponds') {
    return '£' + rate + ' per pond'
  }
  if (PER_100M_CODES[code]) {
    return '£' + rate + ' per 100m'
  }
  if (unit === 'm') {
    return '£' + rate + '/m'
  }
  if (unit === 'm2' || unit === 'm²') {
    return '£' + rate + '/m²'
  }
  return '£' + rate + '/ha'
}

function calculatePayment (code, quantity, unit) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0
  }
  var rate = RATE_BY_CODE[code]
  if (!Number.isFinite(rate)) {
    return 0
  }
  if (unit === 'm' && PER_100M_CODES[code]) {
    return (quantity / 100) * rate
  }
  return quantity * rate
}

function getParcelSelectionsFromSession (sessionData) {
  var data = sessionData || {}
  return parseParcelSelectionsData(data.parcelSelectionsData) ||
    parseParcelSelectionsData(data.sfiParcelSelectionsData) ||
    {}
}

// Shown when the user has not completed the grasslands application yet.
// Replaced automatically once parcelSelectionsData exists in the session.
var EXAMPLE_PARCEL_SELECTIONS = {
  'gate-field': {
    parcelId: 'gate-field',
    parcelReference: 'SO3757 3194',
    totalArea: '44.8800',
    actions: [
      {
        code: 'CSAM3',
        name: 'Herbal leys',
        quantity: '6.4500',
        unit: 'ha',
        annualPayment: 1444.8
      },
      {
        code: 'CNUM2',
        name: 'Legumes on improved grassland',
        quantity: '3.2000',
        unit: 'ha',
        annualPayment: 326.4
      }
    ]
  },
  'far-meadow': {
    parcelId: 'far-meadow',
    parcelReference: 'SO3757 3193',
    totalArea: '56.3200',
    actions: [
      {
        code: 'CSAM3',
        name: 'Herbal leys',
        quantity: '8.7500',
        unit: 'ha',
        annualPayment: 1960
      },
      {
        code: 'CIPM2',
        name: 'Flower-rich grass margins, blocks or in-field strips',
        quantity: '1.2500',
        unit: 'ha',
        annualPayment: 997.5
      },
      {
        code: 'CIGL1',
        name: 'Take grassland field corners or blocks out of management',
        quantity: '0.6200',
        unit: 'ha',
        annualPayment: 206.46
      }
    ]
  },
  'church-field': {
    parcelId: 'church-field',
    parcelReference: 'SO3757 3190',
    totalArea: '36.9876',
    actions: [
      {
        code: 'WBD1',
        name: 'Manage ponds',
        quantity: '2',
        unit: 'ponds',
        annualPayment: 594
      },
      {
        code: 'BND1',
        name: 'Maintain existing hedgerow trees',
        quantity: '320.0400',
        unit: 'm',
        annualPayment: 86.41
      }
    ]
  }
}

function compareByActionName (a, b) {
  var nameCompare = String(a.name || a.label || '').localeCompare(String(b.name || b.label || ''), 'en-GB', {
    sensitivity: 'base'
  })
  if (nameCompare !== 0) {
    return nameCompare
  }
  var codeCompare = String(a.code || '').localeCompare(String(b.code || ''), 'en-GB')
  if (codeCompare !== 0) {
    return codeCompare
  }
  return String(a.parcelReference || '').localeCompare(String(b.parcelReference || ''), 'en-GB')
}

function buildOfferRows (parcelSelections) {
  var byCode = {}
  var landParcels = []
  var detailRows = []

  Object.keys(parcelSelections || {}).forEach(function (parcelId) {
    var parcel = parcelSelections[parcelId] || {}
    var parcelLabel = parcel.parcelReference || parcel.osRef || parcel.parcelName || parcelId
    var actions = Array.isArray(parcel.actions) ? parcel.actions : []
    var parcelHa = 0

    actions.forEach(function (action) {
      var code = String((action && action.code) || '').trim().toUpperCase()
      if (!code) {
        return
      }
      var unit = (action && action.unit) || defaultUnitForCode(code)
      var quantity = parseNumber(action && action.quantity)
      if (quantity === null || !(quantity > 0)) {
        return
      }

      if (unit === 'ha') {
        parcelHa += quantity
      }

      var actionName = resolveActionName(code, action)

      detailRows.push({
        parcelReference: parcelLabel,
        code: code,
        name: actionName,
        label: actionName + ' (' + code + ')',
        quantityText: formatQuantity(quantity, unit)
      })

      if (!byCode[code]) {
        byCode[code] = {
          code: code,
          name: actionName,
          unit: unit,
          quantity: 0,
          payment: 0,
          parcels: []
        }
      }

      byCode[code].quantity += quantity
      var storedPayment = parseNumber(action && action.annualPayment)
      if (storedPayment === null) {
        storedPayment = parseNumber(action && action.yearlyPayment)
      }
      byCode[code].payment += storedPayment !== null
        ? storedPayment
        : calculatePayment(code, quantity, unit)

      if (byCode[code].parcels.indexOf(parcelLabel) === -1) {
        byCode[code].parcels.push(parcelLabel)
      }
    })

    if (actions.length) {
      var areaValue = parseNumber(parcel.totalArea)
      if (areaValue === null || !(areaValue > 0)) {
        areaValue = parcelHa > 0 ? Math.round(parcelHa * 10000) / 10000 : null
      }
      landParcels.push({
        parcelReference: parcelLabel,
        areaText: areaValue !== null ? formatQuantity(areaValue, 'ha') : '—'
      })
    }
  })

  detailRows.sort(compareByActionName)

  var actionRows = Object.keys(byCode).map(function (code) {
    var row = byCode[code]
    // Year 1 keeps exact pence; years 2 and 3 are whole pounds (.00).
    var yearOnePayment = Math.round(row.payment * 100) / 100
    var yearLaterPayment = Math.floor(yearOnePayment)
    var threeYearPayment = Math.round((yearOnePayment + yearLaterPayment + yearLaterPayment) * 100) / 100
    return {
      code: row.code,
      name: row.name,
      label: row.name + ' (' + row.code + ')',
      parcelsText: row.parcels.join(', '),
      quantityText: formatQuantity(row.quantity, row.unit),
      quantityValue: row.quantity,
      unit: row.unit,
      paymentRateText: formatPaymentRate(row.code, row.unit),
      yearOnePayment: yearOnePayment,
      yearOnePaymentText: formatMoney(yearOnePayment),
      yearLaterPayment: yearLaterPayment,
      yearLaterPaymentText: formatMoney(yearLaterPayment),
      annualPayment: yearOnePayment,
      annualPaymentText: formatMoney(yearOnePayment),
      threeYearPayment: threeYearPayment,
      threeYearPaymentText: formatMoney(threeYearPayment)
    }
  }).sort(compareByActionName)

  var yearOneTotal = actionRows.reduce(function (sum, row) {
    return sum + row.yearOnePayment
  }, 0)
  var yearLaterTotal = actionRows.reduce(function (sum, row) {
    return sum + row.yearLaterPayment
  }, 0)
  yearOneTotal = Math.round(yearOneTotal * 100) / 100
  yearLaterTotal = Math.round(yearLaterTotal * 100) / 100
  var threeYearTotal = Math.round((yearOneTotal + yearLaterTotal + yearLaterTotal) * 100) / 100

  return {
    hasActions: actionRows.length > 0,
    isExample: false,
    landParcels: landParcels,
    detailRows: detailRows,
    actionRows: actionRows,
    yearOneTotal: yearOneTotal,
    yearOneTotalText: formatMoney(yearOneTotal),
    yearLaterTotal: yearLaterTotal,
    yearLaterTotalText: formatMoney(yearLaterTotal),
    yearTotal: yearOneTotal,
    yearTotalText: formatMoney(yearOneTotal),
    threeYearTotal: threeYearTotal,
    threeYearTotalText: formatMoney(threeYearTotal),
    agreementYears: [
      { number: 1, isFirstYear: true },
      { number: 2, isFirstYear: false },
      { number: 3, isFirstYear: false }
    ],
    holder: {
      name: 'Agile Farms Ltd',
      sbi: '123456789',
      addressLines: [
        'Agile Farms Ltd',
        'Canal Walk',
        'Newbury',
        'Berkshire',
        'SK22 1DL'
      ],
      addressInline: 'Canal Walk, Newbury, Berkshire, SK22 1DL',
      agreementName: 'SFI 2026',
      agreementType: 'Sustainable Farming Incentive',
      startDate: 'When you accept your agreement offer',
      endDate: null,
      duration: '3 years from the agreement start date',
      agreementNumber: 'GR1234D',
      signedBy: 'Alfred Waldron',
      signedBusiness: 'Agile Farms Ltd',
      signedOn: null
    },
    signed: false,
    actionStartDate: null,
    actionEndDate: null
  }
}

function applyAgreementStatus (offer, options) {
  var signed = !!(options && options.signed)
  offer.signed = signed

  if (!signed) {
    return offer
  }

  offer.holder.startDate = '1 September 2026'
  offer.holder.endDate = '31 August 2029'
  offer.holder.duration = '3 years'
  offer.holder.signedOn = '11 September 2026'
  offer.actionStartDate = '01/09/2026'
  offer.actionEndDate = '31/08/2029'
  return offer
}

function buildOfferFromSession (sessionData, options) {
  var parcelSelections = getParcelSelectionsFromSession(sessionData)
  var offer = buildOfferRows(parcelSelections)

  if (!offer.hasActions) {
    offer = buildOfferRows(EXAMPLE_PARCEL_SELECTIONS)
    offer.isExample = true
  }

  return applyAgreementStatus(offer, options)
}

module.exports = {
  buildOfferFromSession: buildOfferFromSession,
  formatMoney: formatMoney
}
