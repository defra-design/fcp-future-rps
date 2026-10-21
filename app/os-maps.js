// OS Maps API basemap for the prototype maps (instead of OpenFreeMap).
//
// - The key stays on the server: set LAND_MAPS_API_KEY (or OS_MAPS_API_KEY) in .env locally,
//   or as a Heroku config var. Without a key the maps keep using OpenFreeMap.
// - Tiles come through this server (/os-maps/tiles/...), which adds the key, so it is
//   never sent to the browser.
// - /os-maps/style.json is a MapLibre style with the OS raster tiles and OpenFreeMap fonts
//   (the parcel labels use those fonts).
var https = require('https')

var LAYERS = ['Outdoor_3857', 'Light_3857', 'Road_3857']
var DEFAULT_LAYER = 'Outdoor_3857'
// Zoom 17-20 are OS premium tiles (403 on this key's plan), so the map stretches zoom 16 tiles
// when closer in. Set OS_MAPS_MAX_ZOOM=20 if the key's project includes premium data.
function maxZoom () {
  var value = Number(process.env.OS_MAPS_MAX_ZOOM)
  return Number.isInteger(value) && value >= 7 && value <= 20 ? value : 16
}
var GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

function apiKey () {
  return process.env.LAND_MAPS_API_KEY || process.env.OS_MAPS_API_KEY || ''
}

function isEnabled () {
  return Boolean(apiKey())
}

function attribution () {
  return 'Contains OS data © Crown copyright and database rights ' + new Date().getFullYear()
}

// Lets every page know whether to use OS Maps (window.SFI_OS_MAPS in the layouts)
function middleware (req, res, next) {
  res.locals.osMapsEnabled = isEnabled()
  next()
}

// Aerial photography for the "Satellite" map style (no key needed)
function satelliteStyle () {
  return {
    version: 8,
    name: 'Satellite',
    glyphs: GLYPHS,
    sources: {
      photo: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Tiles © Esri'
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#1b2a1b' } },
      { id: 'photo', type: 'raster', source: 'photo' }
    ]
  }
}

function handleStyle (req, res) {
  if (req.query.layer === 'satellite') {
    res.set('Cache-Control', 'no-cache')
    return res.json(satelliteStyle())
  }
  if (!isEnabled()) {
    return res.status(404).json({ error: 'OS Maps API key not set' })
  }
  // Tile URLs must be full addresses, and the server can sit behind a proxy,
  // so the page sends the address it is on
  var origin = String(req.query.origin || '')
  if (!/^https?:\/\/[a-z0-9.:-]+$/i.test(origin)) {
    return res.status(400).json({ error: 'origin is needed' })
  }
  var layer = LAYERS.indexOf(req.query.layer) !== -1 ? req.query.layer : DEFAULT_LAYER
  res.set('Cache-Control', 'no-cache')
  res.json({
    version: 8,
    name: 'OS Maps ' + layer.replace('_3857', ''),
    glyphs: GLYPHS,
    sources: {
      os: {
        type: 'raster',
        tiles: [origin + '/os-maps/tiles/' + layer + '/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 7,
        maxzoom: maxZoom(),
        attribution: attribution()
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f5f5f0' } },
      { id: 'os', type: 'raster', source: 'os' }
    ]
  })
}

function handleTile (req, res) {
  var key = apiKey()
  var layer = req.params.layer
  var z = Number(req.params.z)
  var x = Number(req.params.x)
  var y = Number(req.params.y)
  if (!key || LAYERS.indexOf(layer) === -1 || ![z, x, y].every(Number.isInteger) || z < 0 || z > maxZoom()) {
    return res.status(404).end()
  }
  var url = 'https://api.os.uk/maps/raster/v1/zxy/' + layer + '/' + z + '/' + x + '/' + y + '.png'
  var upstream = https.get(url, { headers: { key: key } }, function (response) {
    res.status(response.statusCode)
    res.set('Content-Type', response.headers['content-type'] || 'image/png')
    if (response.statusCode === 200) {
      res.set('Cache-Control', 'public, max-age=86400')
    }
    response.pipe(res)
  })
  upstream.on('error', function () {
    if (!res.headersSent) {
      res.status(502).end()
    }
  })
  upstream.setTimeout(20000, function () {
    upstream.destroy()
  })
}

// Postcode lookup for the set-up page's address picker (OS Places API, same key).
// Returns { addresses: [{ label, lines }] }, or { error } with OS's status code.
function titleCase (text) {
  return String(text || '').toLowerCase().replace(/(^|[\s\-'/(])([a-z])/g, function (m, p, c) { return p + c.toUpperCase() })
}

function addressLines (dpa) {
  var first = [dpa.SUB_BUILDING_NAME, dpa.BUILDING_NAME, dpa.ORGANISATION_NAME && !dpa.BUILDING_NAME && !dpa.BUILDING_NUMBER ? dpa.ORGANISATION_NAME : '']
    .filter(Boolean).map(titleCase)
  var street = [dpa.BUILDING_NUMBER, titleCase(dpa.DEPENDENT_THOROUGHFARE_NAME || dpa.THOROUGHFARE_NAME)].filter(Boolean).join(' ')
  return first.concat([street, titleCase(dpa.DEPENDENT_LOCALITY), titleCase(dpa.POST_TOWN), dpa.POSTCODE])
    .filter(Boolean)
}

function handlePlaces (req, res) {
  var key = apiKey()
  var postcode = String(req.query.postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  res.set('Cache-Control', 'no-store')
  if (!key) {
    return res.status(404).json({ error: 'OS key not set' })
  }
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(postcode)) {
    return res.status(400).json({ error: 'Enter a real postcode' })
  }
  var url = 'https://api.os.uk/search/places/v1/postcode?dataset=DPA&maxresults=100&postcode=' + encodeURIComponent(postcode)
  var upstream = https.get(url, { headers: { key: key } }, function (response) {
    var body = ''
    response.setEncoding('utf8')
    response.on('data', function (chunk) { body += chunk })
    response.on('end', function () {
      if (response.statusCode !== 200) {
        return res.status(response.statusCode).json({ error: 'OS Places returned ' + response.statusCode })
      }
      var json
      try { json = JSON.parse(body) } catch (e) { return res.status(502).json({ error: 'Bad response from OS Places' }) }
      var addresses = (json.results || []).map(function (r) {
        var lines = addressLines(r.DPA || {})
        return { label: lines.join(', '), lines: lines }
      })
      res.json({ addresses: addresses })
    })
  })
  upstream.on('error', function () {
    if (!res.headersSent) { res.status(502).json({ error: 'Could not reach OS Places' }) }
  })
  upstream.setTimeout(15000, function () { upstream.destroy() })
}

module.exports = {
  isEnabled: isEnabled,
  attribution: attribution,
  middleware: middleware,
  handleStyle: handleStyle,
  handleTile: handleTile,
  handlePlaces: handlePlaces
}

