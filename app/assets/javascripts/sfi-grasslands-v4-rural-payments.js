// Recreated Rural Payments service — loaded by layouts/sfi-grasslands-v4-rural-payments.html
// on every Rural Payments page. Stops placeholder links jumping, and on land-summary and
// parcel-details draws parcels on a MapLibre map with Photo / Map / Hedges controls.

(function () {
  'use strict'

  var PHOTO_STYLE = {
    version: 8,
    sources: {
      photo: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Tiles &copy; Esri'
      }
    },
    layers: [{ id: 'photo', type: 'raster', source: 'photo' }]
  }
  var MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

  var PARCEL_COLOUR = '#0000ff'
  var SELECTED_COLOUR = '#7f00b2'
  var HEDGE_COLOUR = '#00703c'

  function readMapData () {
    var element = document.getElementById('rural-payments-map-data')
    if (!element) {
      return null
    }
    try {
      return JSON.parse(element.textContent)
    } catch (error) {
      return null
    }
  }

  // Parcel coords are stored as [lat, lng]; MapLibre wants [lng, lat]
  function toLngLatRing (coords) {
    var ring = (coords || []).filter(function (point) {
      return point && point.length >= 2
    }).map(function (point) {
      return [Number(point[1]), Number(point[0])]
    })
    if (ring.length < 3) {
      return null
    }
    var first = ring[0]
    var last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push(first.slice())
    }
    return ring
  }

  function buildParcelGeoJson (parcels) {
    var features = []
    parcels.forEach(function (parcel) {
      var ring = toLngLatRing(parcel.coords)
      if (!ring) {
        return
      }
      features.push({
        type: 'Feature',
        properties: {
          href: parcel.href,
          selected: Boolean(parcel.selected)
        },
        geometry: { type: 'Polygon', coordinates: [ring] }
      })
    })
    return { type: 'FeatureCollection', features: features }
  }

  // Illustrative only: treat every other parcel edge as a hedge
  function buildHedgeGeoJson (parcelGeoJson) {
    var features = []
    parcelGeoJson.features.forEach(function (feature) {
      var ring = feature.geometry.coordinates[0]
      for (var i = 0; i < ring.length - 1; i += 2) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [ring[i], ring[i + 1]] }
        })
      }
    })
    return { type: 'FeatureCollection', features: features }
  }

  function getBounds (features) {
    var bounds = new window.maplibregl.LngLatBounds()
    features.forEach(function (feature) {
      feature.geometry.coordinates[0].forEach(function (coord) {
        bounds.extend(coord)
      })
    })
    return bounds
  }

  function initMap () {
    var container = document.getElementById('rural-payments-map')
    var data = readMapData()
    if (!container || !data || !window.maplibregl) {
      return
    }

    var parcelGeoJson = buildParcelGeoJson(data.parcels || [])
    var hedgeGeoJson = buildHedgeGeoJson(parcelGeoJson)
    var selectedFeatures = parcelGeoJson.features.filter(function (feature) {
      return feature.properties.selected
    })
    var fitFeatures = selectedFeatures.length ? selectedFeatures : parcelGeoJson.features
    var showHedges = false

    var map = new window.maplibregl.Map({
      container: container,
      style: PHOTO_STYLE,
      bounds: fitFeatures.length ? getBounds(fitFeatures) : undefined,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true }
    })

    map.scrollZoom.disable()
    map.addControl(new window.maplibregl.FullscreenControl(), 'top-left')
    map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.addControl(new window.maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Custom layers are lost when the style changes, so add them on every style load
    function addParcelLayers () {
      if (map.getSource('parcels')) {
        return
      }
      map.addSource('parcels', { type: 'geojson', data: parcelGeoJson })
      map.addSource('hedges', { type: 'geojson', data: hedgeGeoJson })

      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels',
        paint: { 'fill-color': PARCEL_COLOUR, 'fill-opacity': 0.01 }
      })
      map.addLayer({
        id: 'parcels-outline',
        type: 'line',
        source: 'parcels',
        layout: { 'line-sort-key': ['case', ['get', 'selected'], 1, 0] },
        paint: {
          'line-color': ['case', ['get', 'selected'], SELECTED_COLOUR, PARCEL_COLOUR],
          'line-width': 2
        }
      })
      map.addLayer({
        id: 'hedges',
        type: 'line',
        source: 'hedges',
        layout: { visibility: showHedges ? 'visible' : 'none' },
        paint: { 'line-color': HEDGE_COLOUR, 'line-width': 4 }
      })
    }

    map.on('style.load', addParcelLayers)

    // On the land summary, clicking a parcel opens its details (the table links do the same)
    if (!selectedFeatures.length) {
      map.on('click', 'parcels-fill', function (event) {
        var feature = event.features && event.features[0]
        if (feature && feature.properties.href) {
          window.location.href = feature.properties.href
        }
      })
      map.on('mouseenter', 'parcels-fill', function () {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'parcels-fill', function () {
        map.getCanvas().style.cursor = ''
      })
    }

    document.querySelectorAll('[data-rps-basemap]').forEach(function (button) {
      button.addEventListener('click', function () {
        var basemap = button.getAttribute('data-rps-basemap')
        if (button.getAttribute('aria-pressed') === 'true') {
          return
        }
        document.querySelectorAll('[data-rps-basemap]').forEach(function (other) {
          other.setAttribute('aria-pressed', String(other === button))
        })
        map.setStyle(basemap === 'map' ? MAP_STYLE : PHOTO_STYLE)
      })
    })

    var hedgesButton = document.querySelector('[data-rps-hedges]')
    if (hedgesButton) {
      hedgesButton.addEventListener('click', function () {
        showHedges = !showHedges
        hedgesButton.setAttribute('aria-pressed', String(showHedges))
        if (map.getLayer('hedges')) {
          map.setLayoutProperty('hedges', 'visibility', showHedges ? 'visible' : 'none')
        }
      })
    }
  }

  // Placeholder links (href="#") are out of scope for testing, so they do nothing
  function disablePlaceholderLinks () {
    document.addEventListener('click', function (event) {
      if (event.target.closest('a[href="#"]')) {
        event.preventDefault()
      }
    })
  }

  // Without JS (or <dialog> support) the Sign out link just signs out
  function initSignOutDialog () {
    var link = document.querySelector('[data-rps-sign-out]')
    var dialog = document.getElementById('rps-sign-out-dialog')
    if (!link || !dialog || typeof dialog.showModal !== 'function') {
      return
    }
    link.addEventListener('click', function (event) {
      event.preventDefault()
      dialog.showModal()
    })
    // Clicking the grey backdrop closes the dialog, like pressing No
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        dialog.close()
      }
    })
  }

  disablePlaceholderLinks()
  initSignOutDialog()
  initMap()
})()
