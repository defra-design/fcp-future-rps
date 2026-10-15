// Select land parcels map — loaded by app/views/sfi-grasslands-v4b/select-parcels.html
// Draws every parcel; clicking one opens it below the map (same link as the parcel list).
(function () {
  'use strict'

  var container = document.getElementById('v4b-parcel-map')
  var dataEl = document.getElementById('v4b-map-parcels-json')
  if (!container || !dataEl || !window.defra || typeof window.defra.InteractiveMap !== 'function') {
    return
  }

  var parcels = []
  try {
    parcels = JSON.parse(dataEl.textContent || '[]')
  } catch (error) {
    return
  }

  var PAGE_URL = '/sfi-grasslands-v4b/select-parcels'
  // Home farm — outlying parcels are reached from the list
  var FARM_CENTER = { lng: -0.7448892, lat: 51.9497679 }
  var FARM_ZOOM = 13
  // Zoom rules match v4a (sfi-grasslands-v4a/select-land.html):
  // the all-parcels view never goes closer than the farm overview,
  var ALL_FARMS_MAP_ZOOM = 13.9865053
  // a selected parcel is shown no closer than 15, with room round it,
  var PARCEL_VIEW_MAX_ZOOM = 15
  var PARCEL_VIEW_PADDING_PX = 80
  // and below 13 parcels sit in clusters, so selecting one zooms in to it
  var PARCEL_VIEW_MIN_ZOOM = 13
  var ZOOM_TO_PARCEL_KEY = 'v4bZoomToParcel'
  var COLOURS = {
    availableFill: '#F1DEB8',
    availableBorder: '#8A5A44',
    selectedFill: '#FFDD00',
    addedFill: '#CFE4DC',
    addedBorder: '#083D29',
    unavailableFill: '#E5E6E7',
    unavailableBorder: '#505A5F',
    darkBorder: '#0b0c0c'
  }

  var selected = parcels.filter(function (parcel) { return parcel.selected })[0] || null
  var parcelData = {}
  parcels.forEach(function (parcel) {
    parcelData[parcel.parcelId] = parcel
  })
  var SAVED_VIEW_KEY = 'sfiGrasslandsV4bSelectParcelsMapView'
  var keyboardParcelId = null

  function toRing (coords) {
    var ring = coords.map(function (latLng) { return [latLng[1], latLng[0]] })
    var first = ring[0]
    var last = ring[ring.length - 1]
    if (first && (first[0] !== last[0] || first[1] !== last[1])) {
      ring.push([first[0], first[1]])
    }
    return ring
  }

  function toFeatureCollection () {
    return {
      type: 'FeatureCollection',
      features: parcels
        .filter(function (parcel) { return Array.isArray(parcel.coords) && parcel.coords.length > 2 })
        .map(function (parcel) {
          return {
            type: 'Feature',
            properties: {
              parcelId: parcel.parcelId,
              label: parcel.parcelReference,
              status: parcel.selected
                ? 'selected'
                : (parcel.added ? 'added' : (parcel.unavailable ? 'unavailable' : 'available'))
            },
            geometry: { type: 'Polygon', coordinates: [toRing(parcel.coords)] }
          }
        })
    }
  }

  function getBounds (coords) {
    var lngs = coords.map(function (latLng) { return latLng[1] })
    var lats = coords.map(function (latLng) { return latLng[0] })
    return [[Math.min.apply(null, lngs), Math.min.apply(null, lats)], [Math.max.apply(null, lngs), Math.max.apply(null, lats)]]
  }

  // ---------------------------------------------------------------------------
  // Hover popup, as in v4a: land parcel reference, land cover and total area
  // ---------------------------------------------------------------------------
  var hoverPopup = null

  function escapeHtml (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }

  // Same content and layout as v4a, without the available actions count
  function popupHtml (parcel) {
    return '<h3 class="app-v4b-map-popup__title">' + escapeHtml(parcel.parcelReference) + '</h3>' +
      '<p>Land covers: ' + escapeHtml(parcel.landCoverSummary || '-') + '</p>' +
      '<p>Total area: ' + escapeHtml(parcel.totalAreaShort || '-') + '</p>'
  }

  // Keep the popup inside the map near its edges (same idea as v4a)
  function popupAnchor (map, lngLat) {
    var point = map.project(lngLat)
    var box = map.getContainer()
    var width = box.clientWidth
    var height = box.clientHeight
    // Show the popup below the parcel when there is no room above it
    var vertical = point.y < 140 || point.y > height ? 'top' : 'bottom'
    var horizontal = point.x < 110 ? '-left' : (point.x > width - 110 ? '-right' : '')
    return vertical + horizontal
  }

  function showHoverPopup (map, parcelId) {
    var parcel = parcelId && parcelData[parcelId]
    if (!parcel || !parcel.coords || !window.maplibregl || !window.maplibregl.Popup) {
      if (hoverPopup) {
        hoverPopup.remove()
        hoverPopup = null
      }
      return
    }
    var bounds = getBounds(parcel.coords)
    var centre = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
    if (hoverPopup) {
      hoverPopup.remove()
    }
    hoverPopup = new window.maplibregl.Popup({
      anchor: popupAnchor(map, centre),
      offset: 12,
      closeButton: false,
      closeOnClick: false,
      maxWidth: '216px',
      className: 'app-v4b-map-popup'
    })
      .setLngLat(centre)
      .setHTML(popupHtml(parcel))
      .addTo(map)
    // The popup is for mouse users only; the keyboard status message says the same
    var element = hoverPopup.getElement()
    if (element) {
      element.setAttribute('aria-hidden', 'true')
    }
  }

  // Highlight a parcel and move the map to it, following the v4a zoom rules:
  // zoom when asked (search) or when zoomed out below 13, otherwise pan and keep the zoom
  function highlightParcel (parcelId, options) {
    var opts = options || {}
    parcels.forEach(function (parcel) {
      parcel.selected = parcel.parcelId === parcelId
    })
    selected = parcelData[parcelId] || null
    var map = rawMap
    if (!map) {
      return
    }
    var source = map.getSource('v4b-parcels')
    if (source) {
      source.setData(toFeatureCollection())
    }
    if (selected && selected.coords && selected.coords.length) {
      var bounds = getBounds(selected.coords)
      if (opts.zoom || map.getZoom() < PARCEL_VIEW_MIN_ZOOM) {
        map.fitBounds(bounds, { padding: PARCEL_VIEW_PADDING_PX, maxZoom: PARCEL_VIEW_MAX_ZOOM })
      } else {
        map.easeTo({ center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2] })
      }
    }
  }

  window.SfiGrasslandsV4bSelectParcelsMap = { highlight: highlightParcel }

  // Swap the parcel's actions in under the map, without reloading the page.
  // If that is not possible, fall back to loading the page for that parcel.
  function openParcel (parcelId, options) {
    if (selected && selected.parcelId === parcelId) {
      return
    }
    var swap = window.SfiGrasslandsV4bParcelSwap
    if (swap && typeof swap.load === 'function') {
      // The search flag is only for a page reload; no reload happens here
      try {
        window.sessionStorage.removeItem(ZOOM_TO_PARCEL_KEY)
      } catch (error) {}
      highlightParcel(parcelId, options)
      swap.load(parcelId).catch(function () {
        window.location.href = PAGE_URL + '?parcel=' + encodeURIComponent(parcelId)
      })
      return
    }
    try {
      window.sessionStorage.setItem('v4bScrollToParcel', String(window.scrollY || 0))
    } catch (error) {}
    window.location.href = PAGE_URL + '?parcel=' + encodeURIComponent(parcelId)
  }

  function addParcelLayers (map) {
    map.addSource('v4b-parcels', { type: 'geojson', data: toFeatureCollection(), promoteId: 'parcelId' })

    map.addLayer({
      id: 'v4b-parcels-fill',
      // Hidden while the cluster circles show (zoom 11 and below), so land is only shown once
      minzoom: 12,
      type: 'fill',
      source: 'v4b-parcels',
      paint: {
        'fill-color': ['match', ['get', 'status'],
          'selected', COLOURS.selectedFill,
          'added', COLOURS.addedFill,
          'unavailable', COLOURS.unavailableFill,
          COLOURS.availableFill],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.85]
      }
    })

    map.addLayer({
      id: 'v4b-parcels-line',
      // Hidden while the cluster circles show (zoom 11 and below), so land is only shown once
      minzoom: 12,
      type: 'line',
      source: 'v4b-parcels',
      paint: {
        'line-color': ['case',
          ['==', ['get', 'status'], 'selected'], COLOURS.darkBorder,
          ['boolean', ['feature-state', 'keyboard'], false], COLOURS.darkBorder,
          ['boolean', ['feature-state', 'hover'], false], COLOURS.darkBorder,
          ['==', ['get', 'status'], 'added'], COLOURS.addedBorder,
          ['==', ['get', 'status'], 'unavailable'], COLOURS.unavailableBorder,
          COLOURS.availableBorder],
        'line-width': ['case',
          ['==', ['get', 'status'], 'selected'], 4,
          ['boolean', ['feature-state', 'keyboard'], false], 3,
          ['boolean', ['feature-state', 'hover'], false], 3,
          2]
      }
    })

    map.addLayer({
      id: 'v4b-parcels-label',
      type: 'symbol',
      source: 'v4b-parcels',
      minzoom: 13,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 16, 13],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
      },
      paint: {
        'text-color': '#0b0c0c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    })

    var hoveredId = null
    function setHover (parcelId) {
      if (hoveredId === parcelId) {
        return
      }
      if (hoveredId) {
        map.setFeatureState({ source: 'v4b-parcels', id: hoveredId }, { hover: false })
      }
      hoveredId = parcelId
      if (hoveredId) {
        map.setFeatureState({ source: 'v4b-parcels', id: hoveredId }, { hover: true })
      }
      map.getCanvas().style.cursor = hoveredId ? 'pointer' : ''
      showHoverPopup(map, hoveredId)
    }

    map.on('mousemove', 'v4b-parcels-fill', function (event) {
      // Over an OS map sheet group: that group has its own popup
      if (window.SfiGrasslandsV4bSelectLandMapClusters &&
          window.SfiGrasslandsV4bSelectLandMapClusters.isClusterAt(map, event.point)) {
        setHover(null)
        return
      }
      var feature = event.features && event.features[0]
      setHover(feature ? feature.properties.parcelId : null)
    })
    map.on('mouseleave', 'v4b-parcels-fill', function () {
      setHover(null)
    })
    map.on('click', 'v4b-parcels-fill', function (event) {
      if (window.SfiGrasslandsV4bSelectLandMapClusters &&
          window.SfiGrasslandsV4bSelectLandMapClusters.isClusterAt(map, event.point)) {
        return
      }
      var feature = event.features && event.features[0]
      if (feature && feature.properties.status !== 'selected') {
        openParcel(feature.properties.parcelId)
      }
    })

    if (window.SfiGrasslandsV4bSelectLandMapClusters) {
      window.SfiGrasslandsV4bSelectLandMapClusters.attach(map, {
        parcelData: parcelData,
        labelLayerId: 'v4b-parcels-label',
        // Hovering a cluster shows what is in it
        hoverSummary: true,
        // A cluster of land in two places splits into them before zooming to fit
        splitClusters: true,
        // Wide enough that land close together stays in one circle
        clusterRadius: 80
      })
    }

    initKeyboard(map)
  }

  function parcelOrder () {
    return parcels.slice().sort(function (a, b) {
      return String(a.parcelReference).localeCompare(String(b.parcelReference), 'en-GB', { numeric: true })
    }).map(function (parcel) { return parcel.parcelId })
  }

  function announceParcel (parcelId) {
    var status = document.getElementById('v4b-map-status')
    var parcel = parcelData[parcelId]
    if (!status || !parcel) {
      return
    }
    var order = parcelOrder()
    var index = order.indexOf(parcelId)
    var position = index >= 0 ? ' Parcel ' + (index + 1) + ' of ' + order.length + '.' : ''
    var unavailable = parcel.unavailable ? ' No actions available.' : ''
    status.textContent = ''
    window.setTimeout(function () {
      status.textContent = (parcel.selected ? 'Selected land parcel: ' : 'Land parcel: ') +
        parcel.parcelReference + '.' + position + unavailable
    }, 50)
  }

  function setKeyboardParcel (map, parcelId, skipPan) {
    if (!parcelData[parcelId] || !map.getSource('v4b-parcels')) {
      return
    }
    if (keyboardParcelId && keyboardParcelId !== parcelId) {
      map.setFeatureState({ source: 'v4b-parcels', id: keyboardParcelId }, { keyboard: false })
    }
    keyboardParcelId = parcelId
    map.setFeatureState({ source: 'v4b-parcels', id: parcelId }, { keyboard: true })
    if (!skipPan && parcelData[parcelId].coords) {
      var bounds = getBounds(parcelData[parcelId].coords)
      map.easeTo({
        center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
      })
      // Show the same popup as on hover once the map has moved
      map.once('moveend', function () {
        if (keyboardParcelId === parcelId) {
          showHoverPopup(map, parcelId)
        }
      })
    } else {
      showHoverPopup(map, parcelId)
    }
    announceParcel(parcelId)
  }

  function moveKeyboardParcel (map, delta) {
    var order = parcelOrder()
    if (!order.length) {
      return
    }
    var current = keyboardParcelId ? order.indexOf(keyboardParcelId) : -1
    if (current < 0 && selected) {
      current = order.indexOf(selected.parcelId)
    }
    var next = current < 0
      ? (delta >= 0 ? 0 : order.length - 1)
      : (current + delta + order.length) % order.length
    setKeyboardParcel(map, order[next])
  }

  function initKeyboard (map) {
    var field = document.getElementById('v4b-map-field')
    if (!field || field.getAttribute('data-keyboard-nav') === 'true') {
      return
    }
    field.setAttribute('data-keyboard-nav', 'true')

    field.addEventListener('focus', function () {
      var startId = keyboardParcelId || (selected && selected.parcelId) || parcelOrder()[0]
      if (startId) {
        setKeyboardParcel(map, startId, true)
      }
    })

    field.addEventListener('blur', function (event) {
      if (event.relatedTarget && field.contains(event.relatedTarget)) {
        return
      }
      if (keyboardParcelId) {
        map.setFeatureState({ source: 'v4b-parcels', id: keyboardParcelId }, { keyboard: false })
      }
      keyboardParcelId = null
      showHoverPopup(map, null)
    })

    field.addEventListener('keydown', function (event) {
      if (event.target !== field && event.target.closest &&
          event.target.closest('input, textarea, select, button, a, [role="listbox"]')) {
        return
      }
      var key = event.key
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        event.preventDefault()
        moveKeyboardParcel(map, 1)
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        event.preventDefault()
        moveKeyboardParcel(map, -1)
      } else if (key === 'Home') {
        event.preventDefault()
        var first = parcelOrder()[0]
        if (first) {
          setKeyboardParcel(map, first)
        }
      } else if (key === 'End') {
        event.preventDefault()
        var order = parcelOrder()
        if (order.length) {
          setKeyboardParcel(map, order[order.length - 1])
        }
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault()
        var parcelId = keyboardParcelId || (selected && selected.parcelId)
        if (parcelId && !(selected && selected.parcelId === parcelId)) {
          openParcel(parcelId)
        }
      }
    })
  }

  function whenStyleLoaded (map, callback) {
    if (map.isStyleLoaded()) {
      callback()
      return
    }
    var done = false
    function run () {
      if (done || !map.isStyleLoaded()) {
        return
      }
      done = true
      callback()
    }
    map.on('styledata', run)
    map.once('idle', run)
  }

  var mapPlugins = []
  if (window.defra.scaleBarPlugin) {
    mapPlugins.push(window.defra.scaleBarPlugin({ units: 'metric' }))
  }
  if (window.sfiGrasslandsV4bParcelSearch && window.defra.searchPlugin) {
    mapPlugins.push(window.sfiGrasslandsV4bParcelSearch.createPlugin({
      getParcels: function () { return parcelData },
      formatReference: function (parcel) { return parcel.parcelReference || parcel.parcelId }
    }))
  }

  var interactiveMap = new window.defra.InteractiveMap('v4b-parcel-map', {
    behaviour: 'inline',
    mapProvider: window.defra.maplibreProvider(),
    mapLabel: 'Map of your land parcels. Search by parcel reference, or use the arrow keys and Enter to select one.',
    center: [FARM_CENTER.lng, FARM_CENTER.lat],
    zoom: FARM_ZOOM,
    minZoom: 6,
    maxZoom: 19,
    containerHeight: Math.max(window.innerHeight - 260, 380) + 'px',
    enableZoomControls: true,
    mapStyle: {
      url: 'https://tiles.openfreemap.org/styles/liberty',
      attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      backgroundColor: '#f5f5f0'
    },
    plugins: mapPlugins
  })

  var defaultView = null
  var rawMap = null
  var ALL_PADDING = { top: 40, right: 140, bottom: 40, left: 40 }

  function allParcelBounds () {
    var coords = []
    parcels.forEach(function (parcel) {
      ;(parcel.coords || []).forEach(function (latLng) {
        coords.push(latLng)
      })
    })
    return coords.length ? getBounds(coords) : null
  }

  function establishDefaultView (map) {
    var bounds = allParcelBounds()
    if (bounds && typeof map.cameraForBounds === 'function') {
      var camera = map.cameraForBounds(bounds, { padding: ALL_PADDING, maxZoom: ALL_FARMS_MAP_ZOOM })
      if (camera && camera.center && Number.isFinite(camera.zoom)) {
        var center = Array.isArray(camera.center)
          ? { lng: camera.center[0], lat: camera.center[1] }
          : camera.center
        defaultView = { lat: center.lat, lng: center.lng, zoom: camera.zoom }
        return
      }
    }
    defaultView = { lat: FARM_CENTER.lat, lng: FARM_CENTER.lng, zoom: FARM_ZOOM }
  }

  function showAllParcels (map) {
    if (!defaultView) {
      establishDefaultView(map)
    }
    map.easeTo({ center: [defaultView.lng, defaultView.lat], zoom: defaultView.zoom })
  }

  function readSavedView () {
    try {
      var view = JSON.parse(window.sessionStorage.getItem(SAVED_VIEW_KEY))
      if (view && Number.isFinite(view.lat) && Number.isFinite(view.lng) && Number.isFinite(view.zoom)) {
        return view
      }
    } catch (error) {
      return null
    }
    return null
  }

  function saveView (map) {
    var center = map.getCenter()
    try {
      window.sessionStorage.setItem(SAVED_VIEW_KEY, JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom()
      }))
    } catch (error) {
      // The map still works if storage is unavailable
    }
  }

  function isAwayFromDefault (map) {
    if (!defaultView) {
      return false
    }
    var center = map.getCenter()
    return Math.abs(center.lat - defaultView.lat) > 0.0015 ||
      Math.abs(center.lng - defaultView.lng) > 0.0015 ||
      Math.abs(map.getZoom() - defaultView.zoom) > 0.12
  }

  function updateResetButton (map) {
    if (window.sfiGrasslandsV4bMapResetButton) {
      window.sfiGrasslandsV4bMapResetButton.setVisible(interactiveMap, isAwayFromDefault(map))
    }
  }

  interactiveMap.on('app:ready', function () {
    interactiveMap.toggleButtonState('mapControls', 'expanded', true)
    if (window.sfiGrasslandsV4bMapResetButton) {
      window.sfiGrasslandsV4bMapResetButton.add(interactiveMap, function () {
        if (rawMap) {
          showAllParcels(rawMap)
        }
      })
    }
  })

  interactiveMap.on('search:match', function (event) {
    if (event && event.type === 'parcel' && event.parcelId) {
      // As in v4a, a parcel found by search is always zoomed to
      try {
        window.sessionStorage.setItem(ZOOM_TO_PARCEL_KEY, '1')
      } catch (error) {}
      openParcel(event.parcelId, { zoom: true })
    }
  })

  function takeZoomToParcelFlag () {
    try {
      var flag = window.sessionStorage.getItem(ZOOM_TO_PARCEL_KEY) === '1'
      window.sessionStorage.removeItem(ZOOM_TO_PARCEL_KEY)
      return flag
    } catch (error) {
      return false
    }
  }

  // The page reloads for each parcel, so start from where the map was left and then move,
  // as v4a does without a reload:
  // - zoom to the parcel on the first selection, after a search, or when zoomed out below 13
  // - otherwise pan to it and keep the zoom, so moving between parcels feels steady
  function showSelectedParcel (map, saved) {
    var bounds = getBounds(selected.coords)
    var center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
    var forceZoom = takeZoomToParcelFlag()
    if (!saved) {
      map.fitBounds(bounds, { padding: PARCEL_VIEW_PADDING_PX, maxZoom: PARCEL_VIEW_MAX_ZOOM, duration: 0 })
      return
    }
    map.jumpTo({ center: [saved.lng, saved.lat], zoom: saved.zoom })
    if (forceZoom || saved.zoom < PARCEL_VIEW_MIN_ZOOM) {
      map.fitBounds(bounds, { padding: PARCEL_VIEW_PADDING_PX, maxZoom: PARCEL_VIEW_MAX_ZOOM })
    } else {
      map.easeTo({ center: center })
    }
  }

  interactiveMap.on('map:ready', function (event) {
    var map = event && event.map
    if (!map) {
      return
    }
    rawMap = map

    // Let the page scroll when the wheel passes over the map; +/- and drag still work.
    // Arrow keys move between parcels instead of panning.
    if (map.scrollZoom) {
      map.scrollZoom.disable()
    }
    if (map.keyboard) {
      map.keyboard.disable()
    }

    establishDefaultView(map)
    var saved = readSavedView()
    if (selected && selected.coords && selected.coords.length) {
      showSelectedParcel(map, saved)
    } else {
      // As in v4a: once land has been added, come back to where the user was working.
      // Before that, show every parcel.
      var hasAddedLand = parcels.some(function (parcel) { return parcel.added })
      var start = (hasAddedLand && saved) || defaultView
      if (start) {
        map.jumpTo({ center: [start.lng, start.lat], zoom: start.zoom })
      }
    }

    whenStyleLoaded(map, function () {
      addParcelLayers(map)
    })

    map.on('moveend', function () {
      saveView(map)
      updateResetButton(map)
    })
    map.once('idle', function () {
      updateResetButton(map)
    })

    window.addEventListener('resize', function () {
      map.resize()
    })
  })
})()
