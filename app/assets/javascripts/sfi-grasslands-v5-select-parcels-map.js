// Select land parcels map — loaded by app/views/sfi-grasslands-v5/select-parcels.html
// Draws every parcel; clicking one opens it below the map (same link as the parcel list).
(function () {
  'use strict'

  var container = document.getElementById('v5-parcel-map')
  var dataEl = document.getElementById('v5-map-parcels-json')
  if (!container || !dataEl || !window.defra || typeof window.defra.InteractiveMap !== 'function') {
    return
  }

  var parcels = []
  try {
    parcels = JSON.parse(dataEl.textContent || '[]')
  } catch (error) {
    return
  }

  var PAGE_URL = '/sfi-grasslands-v5/select-parcels'
  // "test" for the Agile Farm test land, or the SBI of a real farm loaded from the
  // footer's prototype tools (app/sfi-grasslands-v5/rpa-land.js)
  // Styles and Key on tablet and desktop: top left of the map (back at the top, 3 November 2026,
  // as the find box is above the map now). The selected parcel's panel opens just under them;
  // "View all land parcels" sits bottom left on its own
  // In the right column with the map's own controls button, laid out as one row in the page CSS
  var BOTTOM_LEFT_BUTTON = { slot: 'right-top', showLabel: true, order: 1 }
  var KEY_BUTTON = { slot: 'right-top', showLabel: true, order: 2 }

  var LAND_SOURCE = dataEl.getAttribute('data-land-source') || 'test'
  // Home farm — outlying parcels are reached from the list
  var FARM_CENTER = { lng: -0.7448892, lat: 51.9497679 }
  var FARM_ZOOM = 13
  // Zoom rules match v4a (sfi-grasslands-v4a/select-land.html):
  // the all-parcels view never goes closer than the farm overview,
  var ALL_FARMS_MAP_ZOOM = 13.9865053
  // The starting (and "View all land parcels") view is never further out than this
  var START_MIN_ZOOM = 11.2
  // a selected parcel is shown no closer than 15, with room round it,
  var PARCEL_VIEW_MAX_ZOOM = 15
  var PARCEL_VIEW_PADDING_PX = 80
  // and below 13 parcels sit in clusters, so selecting one zooms in to it
  var PARCEL_VIEW_MIN_ZOOM = 13
  var ZOOM_TO_PARCEL_KEY = 'v5ZoomToParcel'
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
  // Each farm keeps its own saved map view
  var SAVED_VIEW_KEY = 'sfiGrasslandsV5SelectParcelsMapView' + (LAND_SOURCE === 'test' ? '' : ':' + LAND_SOURCE)
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
  var SHOW_HOVER_TOOLTIP = false

  function escapeHtml (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }

  // Same content and layout as v4a, without the available actions count
  // The OS map sheet, as shown on the cluster circles (for example SO3 from SO3757 3195)
  function sheetReference (parcel) {
    var match = String(parcel && parcel.parcelReference || '').replace(/\s+/g, '').toUpperCase().match(/^([A-Z]{2})(\d)/)
    return match ? match[1] + match[2] : ''
  }

  function popupHtml (parcel) {
    var sheet = sheetReference(parcel)
    return (sheet ? '<p class="app-v5-map-popup__caption">OS sheet reference ' + escapeHtml(sheet) + '</p>' : '') +
      '<h3 class="app-v5-map-popup__title">' + escapeHtml(parcel.parcelReference) + '</h3>' +
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

  // The selected parcel's popup stays open and has a link down to its actions (below the
  // map, often off screen). Other parcels' popups only show on hover. (21 October 2026)
  var hoverPopupKey = null
  // Below this zoom the parcels are hidden behind the group circles
  var PARCELS_MIN_ZOOM = 12

  function selectedPopupLinkHtml (parcel) {
    return '<p class="app-v5-map-popup__action"><a class="govuk-link app-v5-map-popup__link" href="#selected-parcel">' +
      (parcel.added ? 'Change actions for this parcel' : 'Select actions for this parcel') +
      '</a></p>'
  }

  function removeHoverPopup () {
    if (hoverPopup) {
      hoverPopup.remove()
      hoverPopup = null
    }
    hoverPopupKey = null
  }

  // The selected parcel's details: a map panel in the top-left corner with a close
  // button (like the interactive map "marker with panel" example), not a popup on the
  // parcel. On phones it opens as a drawer. (29 October 2026)
  var PARCEL_PANEL_ID = 'v5ParcelPanel'
  var mapAppReady = false
  var parcelPanelKey = null
  var parcelPanelClosedKey = null

  function parcelPanelHtml (parcel) {
    return '<dl class="app-v5-parcel-panel">' +
      '<div class="app-v5-parcel-panel__row"><dt>Land covers</dt><dd>' + escapeHtml(parcel.landCoverSummary || '-') + '</dd></div>' +
      '<div class="app-v5-parcel-panel__row"><dt>Total area</dt><dd>' + escapeHtml(parcel.totalAreaShort || '-') + '</dd></div>' +
      '</dl>' +
      '<p class="govuk-body app-v5-parcel-panel__action"><a class="govuk-link app-v5-map-popup__link" href="#selected-parcel">' +
      (parcel.added ? 'Change actions for this parcel' : 'Select actions for this parcel') +
      '</a></p>'
  }

  function updateParcelPanel () {
    if (!mapAppReady) {
      return
    }
    var parcel = selected && parcelData[selected.parcelId]
    var key = parcel ? parcel.parcelId + (parcel.added ? ':added' : '') : null
    if (key === parcelPanelKey) {
      return
    }
    if (parcelPanelKey) {
      interactiveMap.removePanel(PARCEL_PANEL_ID)
    }
    parcelPanelKey = key
    if (!parcel || key === parcelPanelClosedKey) {
      return
    }
    interactiveMap.addPanel(PARCEL_PANEL_ID, {
      label: parcel.parcelReference,
      html: parcelPanelHtml(parcel),
      focus: false,
      mobile: { slot: 'drawer', dismissible: true },
      tablet: { slot: 'left-top', dismissible: true, width: '220px' },
      desktop: { slot: 'left-top', dismissible: true, width: '220px' }
    })
    interactiveMap.showPanel(PARCEL_PANEL_ID, { focus: false })
  }


  // parcelId: the parcel under the mouse or keyboard, or null for none. With none, the
  // selected parcel's details show in the map panel (if there is one).
  function showHoverPopup (map, parcelId) {
    var pinned = !parcelId || Boolean(selected && parcelId === selected.parcelId)
    var id = parcelId || (selected && selected.parcelId)
    var parcel = id && parcelData[id]
    if (pinned) {
      removeHoverPopup()
      updateParcelPanel()
      return
    }
    // No hover tooltip (removed 3 November 2026): hovering only highlights the parcel, and
    // the map's own label shows its reference. The keyboard status message still reads it out.
    // The popup code below is kept in case it comes back.
    if (SHOW_HOVER_TOOLTIP !== true) {
      removeHoverPopup()
      return
    }
    if (!parcel || !parcel.coords || !window.maplibregl || !window.maplibregl.Popup ||
        (pinned && map.getZoom() < PARCELS_MIN_ZOOM)) {
      removeHoverPopup()
      return
    }
    var key = id + (pinned ? ':selected:' + (parcel.added ? 'added' : '') : '')
    if (hoverPopup && hoverPopupKey === key) {
      return
    }
    var bounds = getBounds(parcel.coords)
    var centre = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
    removeHoverPopup()
    hoverPopupKey = key
    hoverPopup = new window.maplibregl.Popup({
      anchor: popupAnchor(map, centre),
      offset: 12,
      closeButton: false,
      closeOnClick: false,
      // MapLibre focuses the first link in a popup when it opens, which would take focus
      // from the search box or map. Leave focus where the user is.
      focusAfterOpen: false,
      maxWidth: '260px',
      className: 'app-v5-map-popup' + (pinned ? ' app-v5-map-popup--selected' : '')
    })
      .setLngLat(centre)
      .setHTML(popupHtml(parcel) + (pinned ? selectedPopupLinkHtml(parcel) : ''))
      .addTo(map)
    // A hover popup is for mouse users only; the keyboard status message says the same.
    // The selected parcel's popup has a link, so it stays readable and clickable.
    var element = hoverPopup.getElement()
    if (element && !pinned) {
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
    parcelPanelClosedKey = null
    var map = rawMap
    if (!map) {
      return
    }
    var source = map.getSource('v5-parcels')
    if (source) {
      source.setData(toFeatureCollection())
    }
    // Show the newly selected parcel's popup, with its link to the actions
    showHoverPopup(map, null)
    if (selected && selected.coords && selected.coords.length) {
      var bounds = getBounds(selected.coords)
      if (opts.zoom || map.getZoom() < PARCEL_VIEW_MIN_ZOOM) {
        // A smooth flight to the parcel (a search can cross the whole farm)
        map.fitBounds(bounds, { padding: PARCEL_VIEW_PADDING_PX, maxZoom: PARCEL_VIEW_MAX_ZOOM, duration: 1200 })
      } else {
        map.easeTo({ center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2] })
      }
    }
  }

  window.SfiGrasslandsV5SelectParcelsMap = { highlight: highlightParcel }

  // Take the user down to "Select actions for this land parcel" (the parcel's actions,
  // below the map) and move focus there for keyboard and screen reader users
  function goToSelectedParcel () {
    var target = document.getElementById('selected-parcel')
    if (!target) {
      return
    }
    var top = target.getBoundingClientRect().top + window.pageYOffset - 15
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.focus({ preventScroll: true })
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  // The link in the selected parcel's popup
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('.app-v5-map-popup__link')
    if (!link) {
      return
    }
    event.preventDefault()
    goToSelectedParcel()
  })

  // Swap the parcel's actions in under the map, without reloading the page.
  // If that is not possible, fall back to loading the page for that parcel.
  function openParcel (parcelId, options) {
    if (selected && selected.parcelId === parcelId) {
      return
    }
    var swap = window.SfiGrasslandsV5ParcelSwap
    if (swap && typeof swap.load === 'function') {
      // The search flag is only for a page reload; no reload happens here
      try {
        window.sessionStorage.removeItem(ZOOM_TO_PARCEL_KEY)
      } catch (error) {}
      highlightParcel(parcelId, options)
      return swap.load(parcelId).catch(function () {
        window.location.href = PAGE_URL + '?parcel=' + encodeURIComponent(parcelId)
      })
    }
    try {
      window.sessionStorage.setItem('v5ScrollToParcel', String(window.scrollY || 0))
    } catch (error) {}
    window.location.href = PAGE_URL + '?parcel=' + encodeURIComponent(parcelId)
  }

  function addParcelLayers (map) {
    map.addSource('v5-parcels', { type: 'geojson', data: toFeatureCollection(), promoteId: 'parcelId' })

    map.addLayer({
      id: 'v5-parcels-fill',
      // Hidden while the cluster circles show (zoom 11 and below), so land is only shown once
      minzoom: 12,
      type: 'fill',
      source: 'v5-parcels',
      // Draw the selected parcel on top, so a neighbouring shape that overlaps it
      // cannot cover its yellow
      layout: {
        'fill-sort-key': ['case', ['==', ['get', 'status'], 'selected'], 1, 0]
      },
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
      id: 'v5-parcels-line',
      // Hidden while the cluster circles show (zoom 11 and below), so land is only shown once
      minzoom: 12,
      type: 'line',
      source: 'v5-parcels',
      layout: {
        'line-sort-key': ['case', ['==', ['get', 'status'], 'selected'], 1, 0]
      },
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
      id: 'v5-parcels-label',
      type: 'symbol',
      source: 'v5-parcels',
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
        map.setFeatureState({ source: 'v5-parcels', id: hoveredId }, { hover: false })
      }
      hoveredId = parcelId
      if (hoveredId) {
        map.setFeatureState({ source: 'v5-parcels', id: hoveredId }, { hover: true })
      }
      map.getCanvas().style.cursor = hoveredId ? 'pointer' : ''
      showHoverPopup(map, hoveredId)
    }

    map.on('mousemove', 'v5-parcels-fill', function (event) {
      // Over an OS map sheet group: that group has its own popup
      if (window.SfiGrasslandsV5SelectLandMapClusters &&
          window.SfiGrasslandsV5SelectLandMapClusters.isClusterAt(map, event.point)) {
        setHover(null)
        return
      }
      var feature = event.features && event.features[0]
      setHover(feature ? feature.properties.parcelId : null)
    })
    map.on('mouseleave', 'v5-parcels-fill', function () {
      setHover(null)
    })
    // The selected parcel's popup hides while the group circles show, and comes back after
    map.on('zoomend', function () {
      if (!hoveredId) {
        showHoverPopup(map, null)
      }
    })
    // After the map flies to a parcel (search, or a parcel near the edge), place the
    // selected parcel's popup again, so it opens on the side with room and stays in view
    map.on('moveend', function () {
      if (!hoveredId && hoverPopupKey && hoverPopupKey.indexOf(':selected:') !== -1) {
        removeHoverPopup()
        showHoverPopup(map, null)
      }
    })
    // A parcel already selected when the page loads (for example after saving)
    map.once('idle', function () {
      if (!hoveredId) {
        showHoverPopup(map, null)
      }
    })
    map.on('click', 'v5-parcels-fill', function (event) {
      if (window.SfiGrasslandsV5SelectLandMapClusters &&
          window.SfiGrasslandsV5SelectLandMapClusters.isClusterAt(map, event.point)) {
        return
      }
      var feature = event.features && event.features[0]
      if (feature && feature.properties.status !== 'selected') {
        openParcel(feature.properties.parcelId)
      }
    })

    if (window.SfiGrasslandsV5SelectLandMapClusters) {
      window.SfiGrasslandsV5SelectLandMapClusters.attach(map, {
        parcelData: parcelData,
        labelLayerId: 'v5-parcels-label',
        // Hovering a cluster shows what is in it
        hoverSummary: true,
        // A cluster of land in two places splits into them before zooming to fit
        splitClusters: true,
        // Selecting a group zooms in at least this far, so the fields are big enough to pick
        clusterMinZoom: 14,
        // Wide enough that land close together stays in one circle
        clusterRadius: 80,
        // OS map sheet (for example SO3) under the circle, when the whole circle is on one sheet
        showSheet: true
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
    var status = document.getElementById('v5-map-status')
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
    if (!parcelData[parcelId] || !map.getSource('v5-parcels')) {
      return
    }
    if (keyboardParcelId && keyboardParcelId !== parcelId) {
      map.setFeatureState({ source: 'v5-parcels', id: keyboardParcelId }, { keyboard: false })
    }
    keyboardParcelId = parcelId
    map.setFeatureState({ source: 'v5-parcels', id: parcelId }, { keyboard: true })
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
    var field = document.getElementById('v5-map-field')
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
        map.setFeatureState({ source: 'v5-parcels', id: keyboardParcelId }, { keyboard: false })
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
  // v5: "Find a land parcel" sits above the map (canvas J06), so the map has no search box of its own
  var externalFind = document.getElementById('v5-find-form')
  if (!externalFind && window.sfiGrasslandsV5ParcelSearch && window.defra.searchPlugin) {
    // "Enter parcel reference (for example SO3757 3185 or 3185)", the brackets in smaller
    // text (addHint): a full reference and its last 4 digits.
    // Agile Farm uses SO3757 3185; a real farm (demo set-up) uses its own first reference,
    // so the example always matches a parcel that can be found
    var searchReferences = Object.keys(parcelData).map(function (parcelId) {
      return parcelData[parcelId].parcelReference || ''
    }).filter(function (reference) {
      return /\s\d{4}$/.test(reference)
    }).sort(function (a, b) {
      return a.localeCompare(b, 'en-GB', { numeric: true })
    })
    var searchExample = searchReferences.indexOf('SO3757 3185') !== -1 ? 'SO3757 3185' : searchReferences[0]
    var searchHint = searchExample
      ? '(for example ' + searchExample + ' or ' + searchExample.slice(-4) + ')'
      : ''
    window.sfiGrasslandsV5ParcelSearch.addHint('v5-parcel-map', { lead: 'Enter parcel reference', example: searchHint })
    mapPlugins.push(window.sfiGrasslandsV5ParcelSearch.createPlugin({
      placeholder: 'Enter parcel reference' + (searchHint ? ' ' + searchHint : ''),
      getParcels: function () { return parcelData },
      formatReference: function (parcel) { return parcel.parcelReference || parcel.parcelId },
      // Search is the main control, so it takes the top of the map on its own.
      // Styles and Key sit bottom left (BOTTOM_LEFT_BUTTON below)
      // Width is set in the page CSS from the map's own width (container query), so it
      // follows the map when the window changes. Measuring here gave a tiny box when the
      // map wasn't laid out yet
      width: '520px'
    }))
  }

  // A real farm starts over its own land, not over Agile Farm
  if (LAND_SOURCE !== 'test') {
    var landCoords = []
    parcels.forEach(function (parcel) {
      ;(parcel.coords || []).forEach(function (latLng) { landCoords.push(latLng) })
    })
    if (landCoords.length) {
      var landBounds = getBounds(landCoords)
      FARM_CENTER = {
        lng: (landBounds[0][0] + landBounds[1][0]) / 2,
        lat: (landBounds[0][1] + landBounds[1][1]) / 2
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Map styles: Default, Satellite and Light (the "Styles" button). OS Maps when the
  // server has a key (app/os-maps.js), otherwise OpenFreeMap. Satellite is Esri imagery.
  // ---------------------------------------------------------------------------
  function tileAt (lat, lng, zoom) {
    var n = Math.pow(2, zoom)
    var rad = lat * Math.PI / 180
    return {
      x: Math.floor((lng + 180) / 360 * n),
      y: Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n),
      z: zoom
    }
  }

  function buildMapStyles () {
    var origin = window.location.origin
    var styleUrl = function (layer) {
      return origin + '/os-maps/style.json?origin=' + encodeURIComponent(origin) + '&layer=' + layer
    }
    // Previews: the same spot for every farm. Central Newbury (river, roads and buildings)
    // shows the difference between the styles. Farmland looked almost blank in all three.
    var thumb = tileAt(51.4007, -1.3236, 16)
    var osThumb = function (layer) {
      return origin + '/os-maps/tiles/' + layer + '/' + thumb.z + '/' + thumb.x + '/' + thumb.y + '.png'
    }
    var osMaps = Boolean(window.SFI_OS_MAPS)
    var osAttribution = window.sfiMapAttribution ? window.sfiMapAttribution('') : ''
    return [
      {
        id: 'default',
        label: 'Default',
        url: osMaps ? styleUrl('Outdoor_3857') : 'https://tiles.openfreemap.org/styles/liberty',
        attribution: osMaps ? osAttribution : 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
        backgroundColor: '#f5f5f0',
        thumbnail: osMaps ? osThumb('Outdoor_3857') : undefined
      },
      {
        id: 'satellite',
        label: 'Satellite',
        url: styleUrl('satellite'),
        attribution: 'Tiles © Esri',
        backgroundColor: '#1b2a1b',
        mapColorScheme: 'dark',
        thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' +
          thumb.z + '/' + thumb.y + '/' + thumb.x
      },
      {
        id: 'light',
        label: 'Light',
        url: osMaps ? styleUrl('Light_3857') : 'https://tiles.openfreemap.org/styles/positron',
        attribution: osMaps ? osAttribution : 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
        backgroundColor: '#ffffff',
        thumbnail: osMaps ? osThumb('Light_3857') : undefined
      }
    ]
  }

  if (window.defra.mapStylesPlugin) {
    mapPlugins.push(window.defra.mapStylesPlugin({
      mapStyles: buildMapStyles(),
      // Bottom left, beside Key, so the search box can be wider (phones keep the icon top left)
      manifest: {
        buttons: [{
          id: 'mapStyles',
          mobile: { slot: 'top-left', showLabel: false },
          tablet: BOTTOM_LEFT_BUTTON,
          desktop: BOTTOM_LEFT_BUTTON
        }],
        panels: [{
          id: 'mapStyles',
          mobile: { slot: 'drawer', modal: true, dismissible: true },
          tablet: { slot: 'right-top', modal: true, width: '400px', dismissible: true },
          desktop: { slot: 'right-top', modal: true, width: '400px', dismissible: true }
        }]
      }
    }))
    // The map sits inside the page's form, and the Styles panel's buttons have no type,
    // so they would submit the form. Make them plain buttons before the click goes through.
    container.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('.im-c-map-styles__button')
      if (button && !button.hasAttribute('type')) {
        button.setAttribute('type', 'button')
      }
    }, true)
  }

  var interactiveMap = new window.defra.InteractiveMap('v5-parcel-map', {
    behaviour: 'inline',
    mapProvider: window.defra.maplibreProvider(),
    mapLabel: 'Map of your land parcels. Use the arrow keys and Enter to select one.',
    center: [FARM_CENTER.lng, FARM_CENTER.lat],
    zoom: FARM_ZOOM,
    minZoom: 6,
    maxZoom: 19,
    // The map is about 630px wide in its column. Treat that as tablet, not phone, so the
    // Styles and Key buttons show their labels and the Key opens beside the map
    maxMobileWidth: 500,
    // Close to the window's height (at least 480px), so on smaller laptop screens the
    // fields aren't tiny. Was innerHeight - 260, min 380, which felt small in Edge
    // Smaller (3 November 2026): 520px, as in the design, or less on short screens (at least 400px).
    // Was the window height minus 140px
    containerHeight: Math.max(Math.min(window.innerHeight - 140, 520), 400) + 'px',
    enableZoomControls: true,
    mapStyle: {
      // OS Maps when the server has a key (app/os-maps.js), otherwise OpenFreeMap
      url: window.sfiMapStyle ? window.sfiMapStyle('https://tiles.openfreemap.org/styles/liberty') : 'https://tiles.openfreemap.org/styles/liberty',
      attribution: window.sfiMapAttribution ? window.sfiMapAttribution('OpenFreeMap © OpenMapTiles Data from OpenStreetMap') : 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
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

  // Share of parcels (by their middle point) inside the map at this centre and zoom
  function shareOfLandInView (map, center, zoom) {
    var container = map.getContainer()
    var halfWidth = (container.clientWidth - ALL_PADDING.left - ALL_PADDING.right) / 2
    var halfHeight = (container.clientHeight - ALL_PADDING.top - ALL_PADDING.bottom) / 2
    var worldSize = 512 * Math.pow(2, zoom)
    var toPixels = function (lng, lat) {
      var sin = Math.sin(lat * Math.PI / 180)
      return {
        x: (lng + 180) / 360 * worldSize,
        y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize
      }
    }
    var middle = toPixels(center.lng, center.lat)
    var total = 0
    var inView = 0
    parcels.forEach(function (parcel) {
      if (!parcel.coords || !parcel.coords.length) {
        return
      }
      var bounds = getBounds(parcel.coords)
      var point = toPixels((bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2)
      total += 1
      if (Math.abs(point.x - middle.x) <= halfWidth && Math.abs(point.y - middle.y) <= halfHeight) {
        inView += 1
      }
    })
    return total ? inView / total : 1
  }

  function establishDefaultView (map) {
    var bounds = allParcelBounds()
    if (bounds && typeof map.cameraForBounds === 'function') {
      var camera = map.cameraForBounds(bounds, { padding: ALL_PADDING, maxZoom: ALL_FARMS_MAP_ZOOM })
      if (camera && camera.center && Number.isFinite(camera.zoom)) {
        var center = Array.isArray(camera.center)
          ? { lng: camera.center[0], lat: camera.center[1] }
          : camera.center
        // Fitting every parcel can zoom out so far that all the land becomes one cluster
        // ("34"). Start no further out than the level where each area of land has its own
        // circle (25, 5, 3 and 1 on this farm), centred on all the land.
        // On a narrow (phone) map that level would push most of the land off screen,
        // so there the view still fits everything.
        var wideMap = map.getContainer().clientWidth >= 500
        var zoom = wideMap ? Math.max(camera.zoom, START_MIN_ZOOM) : camera.zoom
        // Some farms have land miles apart (106172811 has 3 parcels 25km from the rest).
        // Then the middle of all the land can be empty fields, and zooming in to the
        // minimum level would show no parcels or circles at all. If that closer view
        // would hide much of the land, fit all of it instead, so every area shows a circle.
        if (zoom > camera.zoom && shareOfLandInView(map, center, zoom) < 0.9) {
          zoom = camera.zoom
        }
        defaultView = { lat: center.lat, lng: center.lng, zoom: zoom }
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
    if (window.sfiGrasslandsV5MapResetButton) {
      window.sfiGrasslandsV5MapResetButton.setVisible(interactiveMap, isAwayFromDefault(map))
    }
  }

  interactiveMap.on('app:ready', function () {
    // Map controls (arrows) start closed: only zoom shows until the controls button is used (design, 3 November 2026)
    if (window.sfiGrasslandsV5MapResetButton) {
      // Bottom left on its own (Styles and Key are top left)
      window.sfiGrasslandsV5MapResetButton.add(interactiveMap, function () {
        if (rawMap) {
          showAllParcels(rawMap)
        }
      }, { slot: 'bottom-left', order: 10 })
    }
  })

  interactiveMap.on('search:match', function (event) {
    if (event && event.type === 'parcel' && event.parcelId) {
      // As in v4a, a parcel found by search is always zoomed to
      try {
        window.sessionStorage.setItem(ZOOM_TO_PARCEL_KEY, '1')
      } catch (error) {}
      var parcelId = event.parcelId
      // Closing the search changes the map padding straight after this event, which stops
      // any movement already started. Wait for that, then fly to the parcel and select it.
      window.setTimeout(function () {
        if (selected && selected.parcelId === parcelId) {
          // Already open: just fly back to it
          highlightParcel(parcelId, { zoom: true })
          return
        }
        openParcel(parcelId, { zoom: true })
      }, 150)
    }
  })

  // ---------------------------------------------------------------------------
  // Zooming with the scroll wheel or trackpad without trapping the page (MapLibre's
  // "cooperative gestures"): a plain scroll moves the page, Cmd (Mac) or Ctrl + scroll
  // zooms the map, and on touch screens two fingers move the map. MapLibre's pop-up
  // explaining this shows once per visit; the hint under the map is always there.
  // ---------------------------------------------------------------------------
  var GESTURE_HINT_KEY = 'v5MapGestureHintSeen'

  function getDevice () {
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
    if (touch) {
      return 'touch'
    }
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
    return /mac/i.test(platform) ? 'mac' : 'other'
  }

  function gestureHintSeen () {
    try {
      return window.sessionStorage.getItem(GESTURE_HINT_KEY) === '1'
    } catch (error) {
      return false
    }
  }

  // The hint on the map, in words for this device. Set straight away, before the map loads.
  function setZoomHintText () {
    var device = getDevice()
    var hint = document.getElementById('v5-map-zoom-hint')
    if (hint) {
      hint.textContent = device === 'touch'
        ? 'Use two fingers to move or zoom'
        : (device === 'mac' ? 'Hold the ⌘ command key and scroll to zoom' : 'Hold the Ctrl key and scroll to zoom')
    }
  }
  setZoomHintText()

  function setUpZoomGestures (map) {
    if (!map.cooperativeGestures || !map.scrollZoom) {
      if (map.scrollZoom) {
        map.scrollZoom.disable()
      }
      return
    }
    // Our wording for the pop-up (it is set when cooperative gestures are switched on)
    var strings = {
      'CooperativeGesturesHandler.WindowsHelpText': 'Hold the Ctrl key and scroll to zoom the map',
      'CooperativeGesturesHandler.MacHelpText': 'Hold the ⌘ command key and scroll to zoom the map',
      'CooperativeGesturesHandler.MobileHelpText': 'Use two fingers to move the map'
    }
    if (typeof map.setLocale === 'function') {
      map.setLocale(strings)
    } else {
      map._locale = Object.assign({}, map._locale || {}, strings)
    }
    map.scrollZoom.enable()
    map.cooperativeGestures.enable()

    var container = map.getContainer()
    if (gestureHintSeen()) {
      container.classList.add('app-v5-gesture-hint-seen')
      return
    }
    map.on('cooperativegestureprevented', function () {
      if (container.classList.contains('app-v5-gesture-hint-seen')) {
        return
      }
      try {
        window.sessionStorage.setItem(GESTURE_HINT_KEY, '1')
      } catch (error) {}
      // Let this first one show and fade, then hide it for the rest of the visit
      window.setTimeout(function () {
        container.classList.add('app-v5-gesture-hint-seen')
      }, 1600)
    })
  }

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

  // Changing the map style (Styles button) replaces the whole MapLibre style, which would
  // drop the parcels. Carry our sources and layers (land parcels and the cluster circles)
  // over to the new style, so their click and hover handlers keep working.
  var OWN_SOURCES = ['v5-parcels', 'parcel-cluster-points']

  function keepParcelLayersOnStyleChange (map) {
    var setStyle = map.setStyle.bind(map)
    map.setStyle = function (style, options) {
      return setStyle(style, Object.assign({}, options, {
        transformStyle: function (previous, next) {
          if (!previous) {
            return next
          }
          var sources = Object.assign({}, next.sources)
          OWN_SOURCES.forEach(function (id) {
            if (previous.sources && previous.sources[id]) {
              sources[id] = previous.sources[id]
            }
          })
          var ownLayers = (previous.layers || []).filter(function (layer) {
            return OWN_SOURCES.indexOf(layer.source) !== -1
          })
          return Object.assign({}, next, {
            // Our labels need fonts, so keep a glyphs address if the new style has none
            glyphs: next.glyphs || previous.glyphs || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
            sources: sources,
            layers: (next.layers || []).concat(ownLayers)
          })
        }
      }))
    }
  }

  // ---------------------------------------------------------------------------
  // Key: a "Key" button and panel, styled like the map's own panels.
  // ---------------------------------------------------------------------------
  var KEY_ICON = '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>'

  function keyPanelHtml () {
    var items = [
      ['available', 'Available'],
      ['added', 'Actions added'],
      ['unavailable', 'No actions available']
    ]
    // A subheading so the colours read as land parcel states (not land cover),
    // and so more groups can be added later
    return '<h3 class="app-v5-map-key-panel__heading">Land parcels</h3>' +
      '<ul class="govuk-list app-v5-map-key-panel">' + items.map(function (item) {
        return '<li class="app-v5-map-key-panel__item"><span class="app-v5-map__swatch app-v5-map__swatch--' + item[0] + '"></span>' + item[1] + '</li>'
      }).join('') +
      // The blue circles seen when zoomed out
      '<li class="app-v5-map-key-panel__item"><span class="app-v5-map-key-panel__cluster" aria-hidden="true">3</span>Group of land parcels (select to zoom in)</li>' +
      '</ul>'
  }

  function addKey () {
    // Closed when the page loads; the Key button opens it (changed 20 October 2026)
    interactiveMap.addPanel('v5KeyPanel', {
      label: 'Key',
      html: keyPanelHtml(),
      focus: false,
      mobile: { slot: 'drawer', modal: true, open: false },
      tablet: { slot: 'right-top', width: '260px', open: false },
      desktop: { slot: 'right-top', width: '280px', open: false }
    })
    interactiveMap.addButton('v5Key', {
      label: 'Key',
      panelId: 'v5KeyPanel',
      iconSvgContent: KEY_ICON,
      mobile: { slot: 'top-left', showLabel: true },
      tablet: KEY_BUTTON,
      desktop: KEY_BUTTON
    })
    // The key under the map is only for when JavaScript is off
    var staticKey = document.querySelector('[data-v5-static-key]')
    if (staticKey) {
      staticKey.style.display = 'none'
    }
  }

  interactiveMap.on('app:ready', addKey)

  // The selected parcel's map panel (see updateParcelPanel)
  interactiveMap.on('app:ready', function () {
    mapAppReady = true
    updateParcelPanel()
  })
  interactiveMap.on('app:panelclosed', function (event) {
    // Closed by the user: stays closed for this parcel until another one is picked
    if (event && event.panelId === PARCEL_PANEL_ID) {
      parcelPanelClosedKey = parcelPanelKey
    }
  })

  // "Added land parcels" links (map view): open the parcel as a click on the map does
  // (the map zooms to it, no page reload, which could bring back the list view),
  // then go down to its actions
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('.app-v5-saved-summary a[href*="select-parcels?parcel="], .app-v5-parcel-rows a[data-v5-parcel-link]')
    var form = document.getElementById('v5-select-parcels-form')
    if (!link || (form && form.classList.contains('app-v5-is-list'))) {
      return
    }
    var parcelId = new URL(link.href, window.location.href).searchParams.get('parcel')
    if (!parcelId || !parcelData[parcelId]) {
      return
    }
    event.preventDefault()
    // From the land parcels list beside the map: stay where you are. The map moves to
    // the parcel and its actions update below; screen readers are told where they are.
    var fromList = Boolean(link.closest('.app-v5-parcel-rows'))
    var opened = (selected && selected.parcelId === parcelId)
      ? Promise.resolve()
      : openParcel(parcelId, { zoom: true })
    Promise.resolve(opened).then(function () {
      if (!fromList) {
        goToSelectedParcel()
        return
      }
      var newLink = document.querySelector('.app-v5-parcel-rows a[data-v5-parcel-link="' + parcelId + '"]')
      if (newLink) {
        newLink.focus({ preventScroll: true })
      }
    })
  })

  // "Find a land parcel" typeahead: suggestions as you type (like the map's place search),
  // matching anywhere in the reference, matched part in bold. Up and Down move, Enter picks,
  // Escape closes. Picking one opens the parcel in place. (29 October 2026)
  function initFindTypeahead () {
    var input = document.getElementById('v5-find')
    var row = input && input.closest('.app-v5-find__row')
    if (!input || !row) {
      return
    }
    var MAX = 8
    var listId = 'v5-find-suggestions'
    var list = document.createElement('ul')
    list.id = listId
    list.className = 'app-v5-find__suggestions'
    list.setAttribute('role', 'listbox')
    list.setAttribute('aria-label', 'Matching land parcels')
    list.hidden = true
    row.appendChild(list)
    var status = document.createElement('div')
    status.className = 'govuk-visually-hidden'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    row.appendChild(status)

    input.setAttribute('role', 'combobox')
    input.setAttribute('aria-autocomplete', 'list')
    input.setAttribute('aria-controls', listId)
    input.setAttribute('aria-expanded', 'false')

    var matches = []
    var active = -1

    function compactRef (value) {
      return String(value || '').replace(/\s+/g, '').toUpperCase()
    }

    // Bold the typed part, keeping the reference's own spaces
    function highlight (ref, key) {
      var plain = String(ref)
      var map = []
      for (var i = 0; i < plain.length; i++) {
        if (!/\s/.test(plain[i])) { map.push(i) }
      }
      var at = compactRef(plain).indexOf(key)
      if (at === -1 || !key) {
        return escapeHtml(plain)
      }
      var start = map[at]
      var end = map[at + key.length - 1] + 1
      return escapeHtml(plain.slice(0, start)) + '<strong>' + escapeHtml(plain.slice(start, end)) + '</strong>' + escapeHtml(plain.slice(end))
    }

    function close () {
      list.hidden = true
      list.innerHTML = ''
      matches = []
      active = -1
      input.setAttribute('aria-expanded', 'false')
      input.removeAttribute('aria-activedescendant')
    }

    function setActive (index) {
      active = index
      Array.prototype.forEach.call(list.children, function (item, i) {
        var on = i === index
        item.classList.toggle('app-v5-find__suggestion--active', on)
        item.setAttribute('aria-selected', on ? 'true' : 'false')
        if (on) {
          input.setAttribute('aria-activedescendant', item.id)
          item.scrollIntoView({ block: 'nearest' })
        }
      })
      if (index < 0) {
        input.removeAttribute('aria-activedescendant')
      }
    }

    function render () {
      var key = compactRef(input.value)
      if (!key) {
        close()
        status.textContent = ''
        return
      }
      matches = Object.keys(parcelData).map(function (id) { return parcelData[id] }).filter(function (parcel) {
        return compactRef(parcel.parcelReference).indexOf(key) !== -1
      }).sort(function (a, b) {
        // References ending with what was typed first (people often type the last 4 digits)
        var aEnd = compactRef(a.parcelReference).slice(-key.length) === key ? 0 : 1
        var bEnd = compactRef(b.parcelReference).slice(-key.length) === key ? 0 : 1
        return aEnd - bEnd || String(a.parcelReference).localeCompare(String(b.parcelReference), 'en-GB', { numeric: true })
      })
      var total = matches.length
      matches = matches.slice(0, MAX)
      list.innerHTML = ''
      matches.forEach(function (parcel, i) {
        var item = document.createElement('li')
        item.id = listId + '-' + i
        item.className = 'app-v5-find__suggestion'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', 'false')
        item.innerHTML = '<span class="app-v5-find__suggestion-ref">' + highlight(parcel.parcelReference, key) + '</span>' +
          '<span class="app-v5-find__suggestion-meta">' + escapeHtml(parcel.totalAreaShort || '') + '</span>'
        item.addEventListener('mousedown', function (event) {
          // Keep focus in the box until the pick is made
          event.preventDefault()
        })
        item.addEventListener('click', function () { pick(i) })
        list.appendChild(item)
      })
      if (!matches.length) {
        list.innerHTML = '<li class="app-v5-find__suggestion app-v5-find__suggestion--none" aria-disabled="true">No land parcels match</li>'
      }
      list.hidden = false
      input.setAttribute('aria-expanded', 'true')
      active = -1
      status.textContent = total
        ? total + (total === 1 ? ' land parcel matches' : ' land parcels match') + '. Use the up and down arrows to choose one.'
        : 'No land parcels match'
    }

    function pick (index) {
      var parcel = matches[index]
      if (!parcel) {
        return
      }
      input.value = parcel.parcelReference
      close()
      var opened = (selected && selected.parcelId === parcel.parcelId)
        ? Promise.resolve()
        : openParcel(parcel.parcelId, { zoom: true })
      Promise.resolve(opened).then(function () {
        status.textContent = 'Land parcel ' + parcel.parcelReference + ' selected. Its actions are below the map.'
      })
    }

    input.addEventListener('input', render)
    input.addEventListener('focus', function () {
      if (input.value) { render() }
    })
    input.addEventListener('blur', function () {
      window.setTimeout(close, 150)
    })
    input.addEventListener('keydown', function (event) {
      if (list.hidden || !matches.length) {
        if (event.key === 'Escape') { close() }
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive(active < matches.length - 1 ? active + 1 : 0)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive(active > 0 ? active - 1 : matches.length - 1)
      } else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault()
        pick(active)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    })
  }

  // The suggestions dropdown is off (3 November 2026): typing filters the list instead
  // (sfi-grasslands-v5-parcel-filter.js). initFindTypeahead is kept in case it comes back.
  if (externalFind && window.SFI_V5_FIND_TYPEAHEAD) {
    initFindTypeahead()
  }

  // "Find a land parcel" above the map: open the parcel in place, as a click on the map does.
  // Anything not found is left to the server, which shows the error.
  if (externalFind) {
    externalFind.addEventListener('submit', function (event) {
      var input = document.getElementById('v5-find')
      var key = String(input && input.value || '').replace(/\s+/g, '').toUpperCase()
      if (!key) {
        return
      }
      var matches = Object.keys(parcelData).filter(function (parcelId) {
        var ref = String(parcelData[parcelId].parcelReference || '').replace(/\s+/g, '').toUpperCase()
        return ref === key || (key.length === 4 && ref.slice(-4) === key)
      })
      if (matches.length !== 1) {
        return
      }
      event.preventDefault()
      var parcelId = matches[0]
      var opened = (selected && selected.parcelId === parcelId)
        ? Promise.resolve()
        : openParcel(parcelId, { zoom: true })
      Promise.resolve(opened).then(function () {
        var status = document.getElementById('v5-map-status')
        if (status) {
          status.textContent = 'Found land parcel ' + parcelData[parcelId].parcelReference + '. Its actions are below the map.'
        }
      })
    })
  }

  // Close the Key when the user clicks or taps anywhere else (as the search box does).
  // The Key button itself still toggles it.
  var keyOpen = false
  interactiveMap.on('app:panelopened', function (event) {
    if (event && event.panelId === 'v5KeyPanel') { keyOpen = true }
  })
  interactiveMap.on('app:panelclosed', function (event) {
    if (event && event.panelId === 'v5KeyPanel') { keyOpen = false }
  })
  document.addEventListener('pointerdown', function (event) {
    if (!keyOpen) {
      return
    }
    var panel = container.querySelector('[id$="-panel-v5-key-panel"]')
    var keyButton = container.querySelector('button[aria-controls$="-panel-v5-key-panel"]')
    if ((panel && panel.contains(event.target)) || (keyButton && keyButton.contains(event.target))) {
      return
    }
    interactiveMap.hidePanel('v5KeyPanel')
    keyOpen = false
  }, true)

  interactiveMap.on('map:ready', function (event) {
    var map = event && event.map
    if (!map) {
      return
    }
    rawMap = map
    // For checking the map from the browser console (prototype only)
    window.sfiGrasslandsV5ParcelMap = map

    keepParcelLayersOnStyleChange(map)

    // The search plugin jumps straight to a result with no animation. Skip that jump:
    // search:match then opens the parcel, and highlightParcel moves the map there smoothly.
    var fitBounds = map.fitBounds
    map.fitBounds = function (bounds, options) {
      if (window.sfiGrasslandsV5ParcelSearch && window.sfiGrasslandsV5ParcelSearch.isResultBounds &&
          window.sfiGrasslandsV5ParcelSearch.isResultBounds(bounds)) {
        return map
      }
      return fitBounds.call(map, bounds, options)
    }

    // Arrow keys move between parcels instead of panning.
    setUpZoomGestures(map)
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
