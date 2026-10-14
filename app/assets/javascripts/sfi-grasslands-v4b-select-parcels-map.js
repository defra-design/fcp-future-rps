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

  function openParcel (parcelId) {
    window.location.href = PAGE_URL + '?parcel=' + encodeURIComponent(parcelId) + '#selected-parcel'
  }

  function addParcelLayers (map) {
    map.addSource('v4b-parcels', { type: 'geojson', data: toFeatureCollection(), promoteId: 'parcelId' })

    map.addLayer({
      id: 'v4b-parcels-fill',
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
    }

    map.on('mousemove', 'v4b-parcels-fill', function (event) {
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
        labelLayerId: 'v4b-parcels-label'
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
      var camera = map.cameraForBounds(bounds, { padding: ALL_PADDING, maxZoom: 14 })
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
      openParcel(event.parcelId)
    }
  })

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
    if (selected && selected.coords && selected.coords.length) {
      map.fitBounds(getBounds(selected.coords), { padding: 80, maxZoom: 16, duration: 0 })
    } else {
      var saved = readSavedView()
      if (saved) {
        map.jumpTo({ center: [saved.lng, saved.lat], zoom: saved.zoom })
      } else if (defaultView) {
        map.jumpTo({ center: [defaultView.lng, defaultView.lat], zoom: defaultView.zoom })
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
