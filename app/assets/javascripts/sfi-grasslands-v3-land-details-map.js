/* Loaded by sfi-grasslands-v3/land-details.html and land-details-parcel.html
   Shows Agile Farm parcels on OpenFreeMap liberty (same basemap as select-land). */

(function () {
  // Match select-land available parcel colours
  var FILL = '#F1DEB8'
  var BORDER = '#6B4423'
  var FILL_SELECTED = '#FFDD00'
  var BORDER_SELECTED = '#0b0c0c'
  var SOURCE_ID = 'land-parcels'
  // OpenFreeMap liberty ships Noto Sans — Open Sans glyphs are not in the style
  // and adding a symbol layer with a missing font can leave the GeoJSON source
  // with data but zero tiles (invisible parcels).
  var LABEL_FONT = ['Noto Sans Regular']

  function readJson (id) {
    var el = document.getElementById(id)
    if (!el) {
      return null
    }
    try {
      return JSON.parse(el.textContent)
    } catch (error) {
      return null
    }
  }

  function toLngLatRing (coords) {
    if (!Array.isArray(coords) || !coords.length) {
      return null
    }
    var ring = []
    for (var i = 0; i < coords.length; i++) {
      var point = coords[i]
      if (!point || point.length < 2) {
        continue
      }
      // Stored as [lat, lng] in select-land / land-details data
      var lng = Number(point[1])
      var lat = Number(point[0])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue
      }
      ring.push([lng, lat])
    }
    if (ring.length < 3) {
      return null
    }
    var first = ring[0]
    var last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]])
    }
    return ring
  }

  function escapeHtml (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function buildGeoJson (parcels) {
    var features = []
    ;(parcels || []).forEach(function (parcel) {
      var ring = toLngLatRing(parcel.coords)
      if (!ring) {
        return
      }
      features.push({
        type: 'Feature',
        properties: {
          parcelId: String(parcel.id || ''),
          displayName: String(parcel.parcelReference || parcel.id || ''),
          href: String(parcel.href || ''),
          landCoverSummary: String(parcel.landCoverSummary || ''),
          totalAreaLabel: String(parcel.totalAreaLabel || ''),
          availableActionsCount: String(parcel.availableActionsCount != null ? parcel.availableActionsCount : ''),
          selected: parcel.selected ? 'yes' : 'no'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring]
        }
      })
    })
    return { type: 'FeatureCollection', features: features }
  }

  function buildPopupHtml (properties) {
    var props = properties || {}
    return (
      '<h3>' + escapeHtml(props.displayName) + '</h3>' +
      '<p>Land covers: ' + escapeHtml(props.landCoverSummary || '—') + '</p>' +
      '<p>Total area: ' + escapeHtml(props.totalAreaLabel || '—') + '</p>' +
      '<p>Available actions: ' + escapeHtml(props.availableActionsCount || '0') + '</p>'
    )
  }

  function boundsFromGeoJson (geojson) {
    var bounds = new maplibregl.LngLatBounds()
    geojson.features.forEach(function (feature) {
      feature.geometry.coordinates[0].forEach(function (coord) {
        bounds.extend(coord)
      })
    })
    return bounds
  }

  function addParcelLayers (map, geojson) {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson
      })
    } else {
      map.getSource(SOURCE_ID).setData(geojson)
    }

    if (!map.getLayer('land-parcels-fill')) {
      map.addLayer({
        id: 'land-parcels-fill',
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': [
            'match',
            ['get', 'selected'],
            'yes', FILL_SELECTED,
            FILL
          ],
          'fill-opacity': 0.92
        }
      })
    }

    if (!map.getLayer('land-parcels-outline')) {
      map.addLayer({
        id: 'land-parcels-outline',
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': [
            'match',
            ['get', 'selected'],
            'yes', BORDER_SELECTED,
            BORDER
          ],
          'line-width': [
            'match',
            ['get', 'selected'],
            'yes', 3,
            2.5
          ]
        }
      })
    }

    if (!map.getLayer('land-parcels-label')) {
      map.addLayer({
        id: 'land-parcels-label',
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'displayName'],
          'text-size': 11,
          'text-font': LABEL_FONT,
          'text-optional': true
        },
        paint: {
          'text-color': '#0b0c0c',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.25
        }
      })
    }
  }

  function init () {
    var payload = readJson('land-details-map-data')
    var mapEl = document.getElementById('land-details-map')
    if (!payload || !mapEl || typeof maplibregl === 'undefined') {
      return
    }

    var geojson = buildGeoJson(payload.parcels)
    if (!geojson.features.length) {
      return
    }

    if (!mapEl.style.minHeight) {
      mapEl.style.minHeight = '420px'
    }

    var map = new maplibregl.Map({
      container: mapEl,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-0.752, 51.9525],
      zoom: 13.5,
      minZoom: 6,
      maxZoom: 19,
      attributionControl: true
    })

    window.__landDetailsMap = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    if (map.scrollZoom && typeof map.scrollZoom.disable === 'function') {
      map.scrollZoom.disable()
    }

    var didFitBounds = false

    function fitOnce () {
      if (didFitBounds) {
        return
      }
      var bounds = boundsFromGeoJson(geojson)
      if (bounds.isEmpty()) {
        return
      }
      map.fitBounds(bounds, {
        padding: 56,
        maxZoom: 15.5,
        duration: 0
      })
      didFitBounds = true
    }

    function paint () {
      if (!map.isStyleLoaded()) {
        return
      }
      try {
        map.resize()
        addParcelLayers(map, geojson)
        fitOnce()
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('Land details map: failed to paint parcels', error)
        }
      }
    }

    map.on('error', function (event) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Land details map error', event && event.error)
      }
    })

    map.on('load', paint)
    map.on('style.load', paint)

    map.on('mouseenter', 'land-parcels-fill', function () {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'land-parcels-fill', function () {
      map.getCanvas().style.cursor = ''
      closePopup()
    })

    var hoverPopup = null
    var hoveredParcelId = null

    function closePopup () {
      if (hoverPopup) {
        hoverPopup.remove()
        hoverPopup = null
      }
      hoveredParcelId = null
    }

    function showPopup (feature, lngLat) {
      var props = feature && feature.properties
      if (!props) {
        return
      }

      var parcelId = props.parcelId
      if (hoverPopup && hoveredParcelId === parcelId) {
        hoverPopup.setLngLat(lngLat)
        return
      }

      closePopup()
      hoveredParcelId = parcelId
      hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        maxWidth: '180px',
        className: 'app-land-details-parcel-popup'
      })
        .setLngLat(lngLat)
        .setHTML(buildPopupHtml(props))
        .addTo(map)
    }

    map.on('mousemove', 'land-parcels-fill', function (event) {
      var feature = event.features && event.features[0]
      if (!feature) {
        return
      }
      showPopup(feature, event.lngLat)
    })

    map.on('mousemove', 'land-parcels-label', function (event) {
      var feature = event.features && event.features[0]
      if (!feature) {
        return
      }
      showPopup(feature, event.lngLat)
    })

    map.on('mouseleave', 'land-parcels-label', function () {
      closePopup()
    })

    var didScrollToPanel = false

    function scrollToSelectedPanel () {
      var panel = document.getElementById('selected-land-parcel')
      if (!panel || didScrollToPanel) {
        return
      }

      var heading = panel.querySelector('h2')
      var target = heading || panel
      var top = target.getBoundingClientRect().top + window.pageYOffset - 20

      didScrollToPanel = true

      // Strip the hash so the browser does not keep re-snapping to the panel
      // when the map resizes or tiles finish loading.
      if (window.location.hash === '#selected-land-parcel') {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        )
      }

      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto'
      }

      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: top, left: 0, behavior: 'smooth' })
      } else {
        window.scrollTo(0, top)
      }
    }

    function goToParcel (event) {
      var feature = event.features && event.features[0]
      var href = feature && feature.properties && feature.properties.href
      if (!href) {
        return
      }

      closePopup()

      var link = document.createElement('a')
      link.href = href
      var targetPath = link.pathname
      var currentPath = window.location.pathname

      // Already on this parcel page — just scroll to the info panel
      if (targetPath === currentPath) {
        didScrollToPanel = false
        scrollToSelectedPanel()
        return
      }

      window.location.href = href
    }

    map.on('click', 'land-parcels-fill', goToParcel)
    map.on('click', 'land-parcels-label', goToParcel)

    // Arrive with #selected-land-parcel: wait for the map, then ease down once.
    // Avoid native hash jump (instant + fights user scroll when the map reflows).
    if (window.location.hash === '#selected-land-parcel') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual'
      }
      window.scrollTo(0, 0)

      var pendingHashScroll = true

      function runHashScroll () {
        if (!pendingHashScroll) {
          return
        }
        pendingHashScroll = false
        scrollToSelectedPanel()
      }

      map.once('idle', function () {
        window.setTimeout(runHashScroll, 200)
      })
      // Fallback if idle never fires
      window.setTimeout(runHashScroll, 2000)
    }

    window.addEventListener('resize', function () {
      map.resize()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
