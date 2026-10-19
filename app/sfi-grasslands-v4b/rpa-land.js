// Prototype tool: load a real farm's land from the Rural Payments Agency (RPA) Land API
// (https://environment.data.gov.uk/rpa/api-doc/) by SBI, so the map and actions can be
// tested on real land parcels instead of the Agile Farm test parcels.
//
// - The SBI box is in the footer's prototype tools (layouts/sfi-grasslands-v4b-header.html).
// - The land is kept in this browser session only (req.session.data.v4bRpaLand), never in the
//   repo. "Clear data" or "Use the Agile Farm test land" puts the test parcels back.
// - Every v4b module that reads parcels uses parcelsFor(defaults), which returns the loaded
//   farm's parcels for the current request, or the test parcels when none are loaded.
var https = require('https')
var AsyncLocalStorage = require('async_hooks').AsyncLocalStorage
var sessionDataDefaults = require('../data/session-data-defaults')

var API_BASE = 'https://environment.data.gov.uk/data-services/RPA/'
var SESSION_KEY = 'v4bRpaLand'
var MESSAGE_KEY = 'v4bRpaLandMessage'
var ID_PREFIX = 'rpa-'
var MAX_FEATURES = 2000
var TIMEOUT_MS = 30000

var context = new AsyncLocalStorage()

// Demo configuration (/sfi-grasslands-v4b/demo-configuration): the business shown in the prototype
var DEFAULT_BUSINESS_NAME = 'Agile Farm Ltd'
var DEFAULT_SBI = '123456789'
var BUSINESS_NAME_KEY = 'v4bDemoBusinessName'
var SBI_KEY = 'v4bDemoSbi'
var ADDRESS_KEY = 'v4bDemoAddress'
var DEFAULT_ADDRESS = 'Canal Walk, Newbury, Berkshire'
var DEFAULT_POSTCODE = 'RG14 1AA'

function getSessionData (req) {
  req.session.data = req.session.data || {}
  return req.session.data
}

function getLoadedLand (req) {
  var land = req && req.session && req.session.data ? req.session.data[SESSION_KEY] : null
  return land && land.parcels && Object.keys(land.parcels).length ? land : null
}

// Runs the rest of the request with the loaded land (or null) as its context
function middleware (req, res, next) {
  var land = getLoadedLand(req)
  var data = req.session && req.session.data ? req.session.data : {}
  res.locals.v4bRpaLand = land
    ? { sbi: land.sbi, parcelCount: land.parcelCount, loadedAt: land.loadedAt, hedgeCount: land.hedgeCount }
    : null
  // Used by the account bar and the business details pages instead of fixed text
  res.locals.v4bBusinessName = data[BUSINESS_NAME_KEY] || DEFAULT_BUSINESS_NAME
  res.locals.v4bSbi = data[SBI_KEY] || DEFAULT_SBI
  // null means the pages keep their usual Agile Farm address
  res.locals.v4bAddressLines = data[ADDRESS_KEY] ? String(data[ADDRESS_KEY]).split('\n') : null
  if (data[MESSAGE_KEY]) {
    res.locals.v4bRpaLandMessage = data[MESSAGE_KEY]
    delete data[MESSAGE_KEY]
  }
  context.run(land, next)
}

function current () {
  return context.getStore() || null
}

function isLoaded () {
  return Boolean(current())
}

// A stand-in for the parcels-by-id object each module used to build from the test data.
// Reading a key or listing keys goes to the loaded farm when there is one.
function parcelsFor (defaults) {
  function source () {
    var land = current()
    return land ? land.parcels : defaults
  }
  return new Proxy({}, {
    get: function (target, key) {
      return source()[key]
    },
    has: function (target, key) {
      return Object.prototype.hasOwnProperty.call(source(), key)
    },
    ownKeys: function () {
      return Object.keys(source())
    },
    getOwnPropertyDescriptor: function (target, key) {
      var parcels = source()
      if (!Object.prototype.hasOwnProperty.call(parcels, key)) {
        return undefined
      }
      return { value: parcels[key], enumerable: true, configurable: true, writable: false }
    }
  })
}

function buildUrl (dataset, typeName, sbi) {
  var params = [
    'version=2.0.0',
    'request=GetFeature',
    'typeNames=RPA:' + typeName,
    'cql_filter=' + encodeURIComponent('SBI=' + sbi),
    'srsname=EPSG:4326',
    'outputFormat=application/json',
    'count=' + MAX_FEATURES
  ]
  return API_BASE + dataset + '/wfs/?' + params.join('&')
}

function getJson (url) {
  return new Promise(function (resolve, reject) {
    var request = https.get(url, { headers: { Accept: 'application/json' } }, function (response) {
      var chunks = []
      response.on('data', function (chunk) { chunks.push(chunk) })
      response.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8')
        var body = null
        try {
          body = JSON.parse(text)
        } catch (error) {
          body = null
        }
        if (response.statusCode >= 400 || !body) {
          var message = body && body.error ? String(body.error).trim() : 'The RPA Land API returned ' + response.statusCode
          var failure = new Error(message)
          failure.statusCode = response.statusCode
          return reject(failure)
        }
        resolve(body)
      })
    })
    request.on('error', reject)
    request.setTimeout(TIMEOUT_MS, function () {
      request.destroy(new Error('The RPA Land API did not respond in time'))
    })
  })
}

function prop (properties, name) {
  if (!properties) {
    return undefined
  }
  if (properties[name] !== undefined) {
    return properties[name]
  }
  var lower = name.toLowerCase()
  var key = Object.keys(properties).find(function (k) { return k.toLowerCase() === lower })
  return key ? properties[key] : undefined
}

function parcelKey (sheetId, parcelId) {
  return String(sheetId || '').trim().toUpperCase() + ' ' + String(parcelId || '').trim()
}

function ringArea (ring) {
  var sum = 0
  for (var i = 0; i < ring.length; i++) {
    var a = ring[i]
    var b = ring[(i + 1) % ring.length]
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(sum / 2)
}

// Our parcels use [lat, lng] pairs. GeoJSON is [lng, lat], but some WFS servers send
// EPSG:4326 as [lat, lng], so check which way round the numbers are (England: lat 49-56).
function toLatLngRing (ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return null
  }
  var latFirst = Math.abs(Number(ring[0][0])) > 40
  var coords = ring.map(function (point) {
    var lat = latFirst ? point[0] : point[1]
    var lng = latFirst ? point[1] : point[0]
    return [Math.round(Number(lat) * 1e6) / 1e6, Math.round(Number(lng) * 1e6) / 1e6]
  })
  var first = coords[0]
  var last = coords[coords.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) {
    coords.pop()
  }
  return coords.length >= 3 ? coords : null
}

// The outer ring of the polygon (or of the biggest part of a multipolygon)
function outerRing (geometry) {
  if (!geometry) {
    return null
  }
  if (geometry.type === 'Polygon') {
    return toLatLngRing(geometry.coordinates[0])
  }
  if (geometry.type === 'MultiPolygon') {
    var biggest = null
    var biggestArea = -1
    geometry.coordinates.forEach(function (polygon) {
      var area = ringArea(polygon[0] || [])
      if (area > biggestArea) {
        biggestArea = area
        biggest = polygon[0]
      }
    })
    return toLatLngRing(biggest)
  }
  return null
}

function toNumber (value) {
  var number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalise (sbi, parcelsCollection, coversCollection, hedgesCollection) {
  var coversByParcel = {}
  ;((coversCollection && coversCollection.features) || []).forEach(function (feature) {
    var p = feature.properties || {}
    var key = parcelKey(prop(p, 'SHEET_ID'), prop(p, 'PARCEL_ID'))
    var name = String(prop(p, 'DESCRIPTION') || '').trim() ||
      ('Land cover ' + String(prop(p, 'LAND_COVER_CLASS_CODE') || '').trim())
    var area = toNumber(prop(p, 'AREA_HA')) || (toNumber(prop(p, 'SHAPE_AREA')) || 0) / 10000
    coversByParcel[key] = coversByParcel[key] || {}
    coversByParcel[key][name] = (coversByParcel[key][name] || 0) + area
  })

  var hedgesByParcel = {}
  var hedgeCount = 0
  ;((hedgesCollection && hedgesCollection.features) || []).forEach(function (feature) {
    var p = feature.properties || {}
    var key = parcelKey(prop(p, 'REF_PARCEL_SHEET_ID'), prop(p, 'REF_PARCEL_PARCEL_ID'))
    var length = toNumber(prop(p, 'LENGTH')) || toNumber(prop(p, 'SHAPE_LENGTH')) || 0
    hedgesByParcel[key] = (hedgesByParcel[key] || 0) + length
    hedgeCount++
  })

  var parcels = {}
  ;((parcelsCollection && parcelsCollection.features) || []).forEach(function (feature) {
    var p = feature.properties || {}
    var sheetId = String(prop(p, 'SHEET_ID') || '').trim().toUpperCase()
    var landParcelId = String(prop(p, 'PARCEL_ID') || '').trim()
    var coords = outerRing(feature.geometry)
    if (!sheetId || !landParcelId || !coords) {
      return
    }
    var key = parcelKey(sheetId, landParcelId)
    var id = ID_PREFIX + sheetId + '-' + landParcelId
    var areaHa = toNumber(prop(p, 'AREA_HA'))
    if (areaHa == null) {
      areaHa = (toNumber(prop(p, 'SHAPE_AREA')) || 0) / 10000
    }
    var covers = coversByParcel[key] || {}
    var coverNames = Object.keys(covers).sort(function (a, b) { return covers[b] - covers[a] })
    var perimeter = toNumber(prop(p, 'SHAPE_PERIMETER'))
    parcels[id] = {
      id: id,
      name: key,
      parcelReference: key,
      sheetId: sheetId,
      landParcelId: landParcelId,
      totalArea: areaHa.toFixed(4),
      availableArea: areaHa.toFixed(4),
      landCover: coverNames.length ? coverNames : ['Land cover not known'],
      landCoverAreas: coverNames.map(function (name) {
        return { name: name, ha: Math.round(covers[name] * 10000) / 10000 }
      }),
      coords: coords,
      perimeterMetres: perimeter != null ? Math.round(perimeter) : null,
      hedgeMetres: hedgesByParcel[key] ? Math.round(hedgesByParcel[key]) : 0,
      actions: [],
      location: 'rpa'
    }
  })

  return {
    sbi: String(sbi),
    loadedAt: new Date().toISOString(),
    parcelCount: Object.keys(parcels).length,
    hedgeCount: hedgeCount,
    parcels: parcels
  }
}

// The same SBI is often loaded twice in a row (Check SBI, then Continue), so keep it for 10 minutes
var LOAD_CACHE_MS = 10 * 60 * 1000
var loadCache = {}

function load (sbi) {
  var cached = loadCache[sbi]
  if (cached && Date.now() - cached.at < LOAD_CACHE_MS) {
    return Promise.resolve(Object.assign({}, cached.land, { loadedAt: new Date().toISOString() }))
  }
  return loadFromApi(sbi).then(function (land) {
    loadCache[sbi] = { at: Date.now(), land: land }
    return land
  })
}

function loadFromApi (sbi) {
  return Promise.all([
    getJson(buildUrl('LandParcels', 'LandParcels', sbi)),
    getJson(buildUrl('LandCovers', 'LandCovers', sbi)).catch(function () { return null }),
    getJson(buildUrl('HedgeControl', 'HedgeControl', sbi)).catch(function () { return null })
  ]).then(function (results) {
    return normalise(sbi, results[0], results[1], results[2])
  })
}

function setMessage (req, message) {
  getSessionData(req)[MESSAGE_KEY] = message
}

// Only go back to a v4b page, without the map position (the new land is somewhere else)
function safeReturnTo (value) {
  var fallback = '/sfi-grasslands-v4b/select-parcels'
  if (typeof value !== 'string' || value.indexOf('/sfi-grasslands-v4b') !== 0 || value.indexOf('//') !== -1) {
    return fallback
  }
  var parts = value.split('?')
  if (parts.length < 2) {
    return parts[0]
  }
  var kept = parts[1].split('&').filter(function (pair) {
    var name = decodeURIComponent(pair.split('=')[0] || '')
    return name && name !== 'parcel' && name.indexOf('v4b-parcel-map') !== 0 && name.indexOf('map:') === -1
  })
  return parts[0] + (kept.length ? '?' + kept.join('&') : '')
}

// Land parcels saved on the application belong to the old land, so start the land again
function resetApplicationLand (req) {
  var data = getSessionData(req)
  ;[
    'sfiApplicationParcels',
    'sfiDraftLandParcel',
    'sfiDraftLandActions',
    'sfiDraftParcelId',
    'sfiParcelSelectionsData',
    'parcelSelectionsData',
    'clig3SupplementsCompleteParcelId',
    'clig3SupplementsCompleteQuantity',
    'clig3SupplementsChoice',
    'v4bListLastParcel',
    'v4bFromReview',
    'confirmLandFlash'
  ].forEach(function (key) {
    delete data[key]
  })
}

function handlePost (req, res) {
  var data = getSessionData(req)
  var body = req.body || {}
  var returnTo = safeReturnTo(body.v4bRpaReturnTo)
  var sbi = String(body.v4bRpaSbi || '').replace(/\s+/g, '')
  delete data.v4bRpaSbi
  delete data.v4bRpaReturnTo
  delete data.v4bRpaIntent

  if (body.v4bRpaIntent === 'clear') {
    delete data[SESSION_KEY]
    delete data[SBI_KEY]
    resetApplicationLand(req)
    setMessage(req, { type: 'success', text: 'Showing the Agile Farm test land again.' })
    return res.redirect(returnTo)
  }

  if (!/^\d{9}$/.test(sbi)) {
    setMessage(req, { type: 'error', text: 'Enter a 9-digit SBI, like 123456789', value: sbi })
    return res.redirect(returnTo)
  }

  load(sbi).then(function (land) {
    if (!land.parcelCount) {
      setMessage(req, { type: 'error', text: 'No land parcels were found for SBI ' + sbi, value: sbi })
      return res.redirect(returnTo)
    }
    data[SESSION_KEY] = land
    data[SBI_KEY] = sbi
    resetApplicationLand(req)
    setMessage(req, {
      type: 'success',
      text: 'Loaded ' + land.parcelCount + ' land parcel' + (land.parcelCount === 1 ? '' : 's') + ' for SBI ' + sbi + '.'
    })
    res.redirect(returnTo)
  }).catch(function (error) {
    var text = /invalid sbi/i.test(error.message)
      ? 'The RPA did not recognise SBI ' + sbi
      : 'Could not load land for SBI ' + sbi + ': ' + error.message
    setMessage(req, { type: 'error', text: text, value: sbi })
    res.redirect(returnTo)
  })
}

// ---------------------------------------------------------------------------
// Demo configuration page: business name and SBI, then the task list
// ---------------------------------------------------------------------------
var DEMO_VIEW = 'sfi-grasslands-v4b/demo-configuration'
var DEMO_NEXT = '/sfi-grasslands-v4b/task-list'

function fieldError (errors, field) {
  return (errors || []).find(function (error) { return error.field === field }) || null
}

function renderDemoConfiguration (req, res, options) {
  var opts = options || {}
  var data = getSessionData(req)
  var land = getLoadedLand(req)
  var errors = opts.errors || []
  res.status(errors.length ? 400 : 200).render(DEMO_VIEW, {
    defaultBusinessName: DEFAULT_BUSINESS_NAME,
    defaultSbi: DEFAULT_SBI,
    defaultAddress: DEFAULT_ADDRESS,
    defaultPostcode: DEFAULT_POSTCODE,
    addressValue: opts.addressLines ? opts.addressLines.join('\n') : (data[ADDRESS_KEY] || ''),
    businessNameValue: opts.businessName != null ? opts.businessName : (data[BUSINESS_NAME_KEY] || ''),
    sbiValue: opts.sbi != null ? opts.sbi : (land ? land.sbi : ''),
    participantLink: opts.participantLink || null,
    participantLinkSummary: opts.participantLinkSummary || null,
    current: {
      businessName: data[BUSINESS_NAME_KEY] || DEFAULT_BUSINESS_NAME,
      address: data[ADDRESS_KEY] ? String(data[ADDRESS_KEY]).split('\n').join(', ') : DEFAULT_ADDRESS + ', ' + DEFAULT_POSTCODE,
      sbi: data[SBI_KEY] || DEFAULT_SBI,
      land: land
        ? land.parcelCount + ' land parcel' + (land.parcelCount === 1 ? '' : 's') + ' from the Rural Payments Agency'
        : 'Agile Farm test land',
      isDefault: !data[BUSINESS_NAME_KEY] && !data[ADDRESS_KEY] && !land
    },
    errors: errors,
    sbiError: fieldError(errors, 'sbi')
  })
}

function handleDemoConfigurationGet (req, res) {
  renderDemoConfiguration(req, res)
}

// The address box: one part per line. A pasted one-line address is split at the commas.
function parseAddress (value) {
  var text = String(value || '').trim()
  if (!text) {
    return []
  }
  var parts = /\n/.test(text) ? text.split(/\r?\n/) : text.split(',')
  return parts.map(function (part) { return part.trim().replace(/,$/, '') }).filter(Boolean).slice(0, 8)
}

function readDemoInputs (body) {
  return {
    businessName: String(body.v4bDemoBusinessNameInput || '').trim(),
    sbi: String(body.v4bDemoSbiInput || '').replace(/\s+/g, ''),
    addressLines: parseAddress(body.v4bDemoAddressInput)
  }
}

// Checks the SBI and loads its land. Resolves with the land (null for the test land),
// or rejects with a message to show against the SBI field.
function loadDemoLand (sbi) {
  if (!sbi) {
    return Promise.resolve(null)
  }
  if (!/^\d{9}$/.test(sbi)) {
    return Promise.reject(new Error('SBI must be 9 numbers, like ' + DEFAULT_SBI))
  }
  return load(sbi).then(function (land) {
    if (!land.parcelCount) {
      throw new Error('No land parcels were found for SBI ' + sbi)
    }
    return land
  }, function (error) {
    throw new Error(/invalid sbi/i.test(error.message)
      ? 'The Rural Payments Agency did not recognise SBI ' + sbi
      : 'Land for SBI ' + sbi + ' could not be loaded: ' + error.message)
  })
}

// Resolves with { addressLines, land } or rejects with a list of field errors
function checkDemoConfiguration (config) {
  return loadDemoLand(config.sbi).then(function (land) {
    return { addressLines: config.addressLines, land: land }
  }, function (error) {
    var failure = new Error(error.message)
    failure.fieldErrors = [{ field: 'sbi', href: '#v4b-demo-sbi', text: error.message }]
    throw failure
  })
}

function applyDemoConfiguration (req, config, addressLines, land) {
  var data = getSessionData(req)
  if (config.businessName) {
    data[BUSINESS_NAME_KEY] = config.businessName
  } else {
    delete data[BUSINESS_NAME_KEY]
  }
  if (addressLines && addressLines.length) {
    data[ADDRESS_KEY] = addressLines.join('\n')
  } else {
    delete data[ADDRESS_KEY]
  }
  if (land) {
    data[SESSION_KEY] = land
    data[SBI_KEY] = config.sbi
  } else {
    delete data[SESSION_KEY]
    delete data[SBI_KEY]
  }
  resetApplicationLand(req)
}

// Participant links: the settings go in one "d" value so the link stays short.
// This only tidies the link. Anyone with it can read the settings, so treat it like the SBI itself.
function encodeDemoLink (config, addressLines) {
  var json = JSON.stringify({
    n: config.businessName || '',
    a: (addressLines || []).join('\n'),
    s: config.sbi || ''
  })
  return Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeDemoLink (value) {
  try {
    var text = Buffer.from(String(value || '').slice(0, 4000).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    var parsed = JSON.parse(text)
    return {
      businessName: String(parsed.n || '').trim().slice(0, 200),
      addressLines: String(parsed.a || '').split('\n').map(function (line) { return line.trim().slice(0, 200) }).filter(Boolean).slice(0, 6),
      sbi: String(parsed.s || '').replace(/\s+/g, '')
    }
  } catch (error) {
    return null
  }
}

function handleDemoConfigurationPost (req, res) {
  var data = getSessionData(req)
  var body = req.body || {}
  var config = readDemoInputs(body)
  var makeLink = body.v4bDemoIntent === 'link'
  ;['v4bDemoBusinessNameInput', 'v4bDemoSbiInput', 'v4bDemoAddressInput', 'v4bDemoIntent'].forEach(function (key) {
    delete data[key]
  })

  checkDemoConfiguration(config).then(function (result) {
    if (makeLink) {
      // Checked, but the researcher's own session stays as it is
      var land = result.land
      return renderDemoConfiguration(req, res, Object.assign({}, config, {
        // A path: the page adds the address the researcher is using (the server can sit behind a proxy)
        participantLink: '/sfi-grasslands-v4b/demo-start?d=' + encodeDemoLink(config, result.addressLines),
        participantLinkSummary: (config.businessName || DEFAULT_BUSINESS_NAME) +
          ', ' + (result.addressLines ? result.addressLines.join(', ') : DEFAULT_ADDRESS) +
          ', SBI ' + (config.sbi || DEFAULT_SBI) +
          (land ? ' (' + land.parcelCount + ' land parcel' + (land.parcelCount === 1 ? '' : 's') + ')' : ' (Agile Farm test land)')
      }))
    }
    applyDemoConfiguration(req, config, result.addressLines, result.land)
    res.redirect(DEMO_NEXT)
  }).catch(function (error) {
    renderDemoConfiguration(req, res, Object.assign({}, config, {
      errors: error.fieldErrors || [{ field: 'sbi', href: '#v4b-demo-sbi', text: error.message }]
    }))
  })
}

// ---------------------------------------------------------------------------
// "Check SBI" on the set-up page (JSON for the page's script)
// ---------------------------------------------------------------------------

function handleSbiCheck (req, res) {
  var sbi = String(req.query.sbi || '').replace(/\s+/g, '')
  if (!sbi) {
    return res.json({ found: false, message: 'No SBI entered: the Agile Farm test land will be used' })
  }
  loadDemoLand(sbi).then(function (land) {
    var totalHa = Object.keys(land.parcels).reduce(function (sum, id) {
      return sum + (Number(land.parcels[id].totalArea) || 0)
    }, 0)
    res.json({
      found: true,
      message: 'Found ' + land.parcelCount + ' land parcel' + (land.parcelCount === 1 ? '' : 's') +
        ' (' + totalHa.toFixed(2) + ' ha) for SBI ' + sbi
    })
  }).catch(function (error) {
    res.status(400).json({ found: false, message: error.message })
  })
}

// "Reset to defaults": Agile Farm, its address and the test land
function handleDemoReset (req, res) {
  applyDemoConfiguration(req, {}, null, null)
  res.redirect('/sfi-grasslands-v4b/demo-configuration')
}

// The participant's link: start a fresh session with the researcher's settings, then the task list
function handleDemoStart (req, res) {
  var config = decodeDemoLink(req.query.d)
  if (!config) {
    return res.redirect('/sfi-grasslands-v4b/demo-configuration')
  }
  loadDemoLand(config.sbi).then(function (land) {
    // Same as "Clear data": a fresh session for the participant
    req.session.data = Object.assign({}, sessionDataDefaults)
    applyDemoConfiguration(req, config, config.addressLines, land)
    res.redirect(DEMO_NEXT)
  }).catch(function (error) {
    renderDemoConfiguration(req, res, Object.assign({}, config, {
      errors: [{ field: 'sbi', href: '#v4b-demo-sbi', text: error.message }]
    }))
  })
}

module.exports = {
  handleSbiCheck: handleSbiCheck,
  handleDemoReset: handleDemoReset,
  handleDemoStart: handleDemoStart,
  handleDemoConfigurationGet: handleDemoConfigurationGet,
  handleDemoConfigurationPost: handleDemoConfigurationPost,
  SESSION_KEY: SESSION_KEY,
  middleware: middleware,
  isLoaded: isLoaded,
  current: current,
  parcelsFor: parcelsFor,
  normalise: normalise,
  load: load,
  safeReturnTo: safeReturnTo,
  handlePost: handlePost
}
