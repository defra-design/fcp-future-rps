/**
 * Capital items for the v5 journey (one-off payments, claimed once the work is finished).
 * Chosen once at "Select capital items (optional)", then added to land parcels on the map page.
 * Stored separately from revenue actions:
 * - interested codes: sfiV5InterestedCapitalItems
 * - per parcel: capitalItems array on each entry of sfiV5ApplicationParcels
 */

var SESSION_KEY = 'sfiV5InterestedCapitalItems'

var CAPITAL_ITEMS = [
  { code: 'FG1', name: 'Fencing', unit: 'm', unitLabel: 'metre', paymentRate: 6.34, slug: 'fencing-fg1', group: 'Fencing and gates' },
  { code: 'FG2', name: 'Sheep netting', unit: 'm', unitLabel: 'metre', paymentRate: 7.47, slug: 'sheep-netting-fg2', group: 'Fencing and gates' },
  { code: 'FG12', name: 'Wooden field gate', unit: 'gate', unitLabel: 'gate', paymentRate: 489.90, slug: 'wooden-field-gate-fg12', group: 'Fencing and gates' },
  { code: 'FG13', name: 'Stone gate post', unit: 'post', unitLabel: 'post', paymentRate: 651.42, slug: 'stone-gate-post-fg13', group: 'Fencing and gates' }
]

function formatMoney (value) {
  var n = Number(value) || 0
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function decorate (item) {
  var isLength = item.unit === 'm'
  return Object.assign({}, item, {
    guidanceUrl: 'https://www.gov.uk/countryside-stewardship-grants/' + item.slug,
    paymentRateFormatted: formatMoney(item.paymentRate) + ' per ' + item.unitLabel,
    quantityHint: isLength ? 'Enter the length in metres' : 'Number of ' + item.unitLabel + 's',
    quantitySuffix: isLength ? 'metres' : item.unitLabel + 's',
    quantityLabel: isLength ? 'Length' : 'Quantity'
  })
}

function getCatalogue () {
  return CAPITAL_ITEMS.map(decorate)
}

function getItem (code) {
  var found = CAPITAL_ITEMS.find(function (item) { return item.code === code })
  return found ? decorate(found) : null
}

function getGroups () {
  var groups = []
  getCatalogue().forEach(function (item) {
    var group = groups.find(function (g) { return g.heading === item.group })
    if (!group) {
      group = { heading: item.group, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  })
  return groups
}

function toArray (value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value === undefined || value === null || value === '' || value === '_unchecked') return []
  return [value]
}

function getInterestedCodes (req) {
  var data = req.session.data || {}
  var codes = toArray(data[SESSION_KEY])
  return codes.filter(function (code) { return !!getItem(code) })
}

function setInterestedCodes (req, codes) {
  req.session.data = req.session.data || {}
  req.session.data[SESSION_KEY] = toArray(codes).filter(function (code) {
    return code !== '_unchecked' && !!getItem(code)
  })
  return req.session.data[SESSION_KEY]
}

function hasMadeChoice (req) {
  var data = req.session.data || {}
  return Object.prototype.hasOwnProperty.call(data, SESSION_KEY)
}

function formatQuantity (item, quantity) {
  var n = Number(quantity) || 0
  if (item.unit === 'm') return n.toLocaleString('en-GB') + ' m'
  return n + ' ' + item.unitLabel + (n === 1 ? '' : 's')
}

function buildParcelItem (code, quantity) {
  var item = getItem(code)
  if (!item) return null
  var q = Number(quantity) || 0
  var payment = q * item.paymentRate
  return {
    code: item.code,
    name: item.name,
    unit: item.unit,
    quantity: q,
    quantityFormatted: formatQuantity(item, q),
    paymentRate: item.paymentRate,
    paymentRateFormatted: item.paymentRateFormatted,
    payment: payment,
    paymentFormatted: formatMoney(payment),
    guidanceUrl: item.guidanceUrl
  }
}

/**
 * Validate capital item checkboxes and quantities posted from the map page.
 * Body fields: v5CapitalSelected (codes), v5CapitalQuantity-CODE
 */
function validateParcelCapitalItems (body) {
  var selected = toArray(body && body.v5CapitalSelected).filter(function (code) { return !!getItem(code) })
  var errors = []
  var items = []
  var values = {}

  selected.forEach(function (code) {
    var item = getItem(code)
    var raw = String((body && body['v5CapitalQuantity-' + code]) || '').trim().replace(/,/g, '')
    values[code] = raw
    var fieldId = 'v5CapitalQuantity-' + code
    var label = item.unit === 'm' ? 'the length of ' + item.name.toLowerCase() + ' in metres' : 'the number of ' + item.unitLabel + 's'

    if (!raw) {
      errors.push({ text: 'Enter ' + label, href: '#' + fieldId, code: code })
      return
    }
    var n = Number(raw)
    if (!isFinite(n) || n <= 0) {
      errors.push({ text: (item.unit === 'm' ? 'Length' : 'Number of ' + item.unitLabel + 's') + ' must be a number greater than 0', href: '#' + fieldId, code: code })
      return
    }
    if (item.unit !== 'm' && Math.round(n) !== n) {
      errors.push({ text: 'Number of ' + item.unitLabel + 's must be a whole number', href: '#' + fieldId, code: code })
      return
    }
    items.push(buildParcelItem(code, n))
  })

  return { errors: errors, items: items, values: values, selectedCodes: selected }
}

function normaliseParcelItems (items) {
  return (Array.isArray(items) ? items : [])
    .map(function (i) { return i && buildParcelItem(i.code, i.quantity) })
    .filter(Boolean)
}

function summariseParcel (items) {
  var list = normaliseParcelItems(items)
  var total = list.reduce(function (sum, i) { return sum + i.payment }, 0)
  return { capitalItems: list, capitalTotal: total, capitalTotalFormatted: formatMoney(total) }
}

/**
 * Totals for capital items across parcels, plus one row per item code for payment tables.
 */
function summariseApplication (parcels) {
  var rows = []
  var total = 0
  ;(parcels || []).forEach(function (parcel) {
    normaliseParcelItems(parcel && parcel.capitalItems).forEach(function (i) {
      total += i.payment
      var row = rows.find(function (r) { return r.code === i.code })
      if (!row) {
        row = { code: i.code, name: i.name, paymentRateFormatted: i.paymentRateFormatted, quantity: 0, payment: 0 }
        rows.push(row)
      }
      row.quantity += Number(i.quantity) || 0
      row.payment += i.payment
    })
  })
  rows.forEach(function (r) {
    r.paymentFormatted = formatMoney(r.payment)
    // Total quantity across land parcels, for "£6.34 per metre × 300 m"
    r.quantityFormatted = formatQuantity(getItem(r.code), r.quantity)
  })
  return { rows: rows, total: total, totalFormatted: formatMoney(total), hasItems: rows.length > 0 }
}

module.exports = {
  SESSION_KEY: SESSION_KEY,
  getCatalogue: getCatalogue,
  getGroups: getGroups,
  getItem: getItem,
  getInterestedCodes: getInterestedCodes,
  setInterestedCodes: setInterestedCodes,
  hasMadeChoice: hasMadeChoice,
  buildParcelItem: buildParcelItem,
  validateParcelCapitalItems: validateParcelCapitalItems,
  normaliseParcelItems: normaliseParcelItems,
  summariseParcel: summariseParcel,
  summariseApplication: summariseApplication,
  formatMoney: formatMoney
}
