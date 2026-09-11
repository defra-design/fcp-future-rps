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
          'text-optional': true,
          'text-allow-overlap': false,
          'text-padding': 2
        },
        paint: {
          'text-color': '#0b0c0c',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.25
        }
      })
    } else if (map.getFilter('land-parcels-label')) {
      map.setFilter('land-parcels-label', null)
    }
  }

  function boundsForSelected (geojson) {
    var selected = (geojson.features || []).filter(function (feature) {
      return feature.properties && feature.properties.selected === 'yes'
    })
    if (!selected.length) {
      return boundsFromGeoJson(geojson)
    }
    return boundsFromGeoJson({ type: 'FeatureCollection', features: selected })
  }

  function createMap (mapEl, payload, options) {
    var opts = options || {}
    var isMini = Boolean(opts.mini)
    var geojson = buildGeoJson(payload.parcels)
    if (!geojson.features.length) {
      return null
    }

    if (!isMini && !mapEl.style.minHeight) {
      mapEl.style.minHeight = '420px'
    }

    var map = new maplibregl.Map({
      container: mapEl,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-0.752, 51.9525],
      zoom: isMini ? 14 : 13.5,
      minZoom: 6,
      maxZoom: 19,
      attributionControl: true
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    if (!isMini) {
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    }

    if (map.scrollZoom && typeof map.scrollZoom.disable === 'function') {
      map.scrollZoom.disable()
    }

    var didFitBounds = false

    function fitOnce () {
      if (didFitBounds) {
        return
      }
      // Fit all parcels so every parcel is visible and clickable on the mini map.
      var bounds = boundsFromGeoJson(geojson)
      if (bounds.isEmpty()) {
        return
      }
      map.fitBounds(bounds, {
        padding: isMini ? 28 : 56,
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

    window.addEventListener('resize', function () {
      map.resize()
    })

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
        maxWidth: '216px',
        offset: 12,
        closeButton: false,
        closeOnClick: false,
        className: 'parcel-popup-selectable'
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

    if (isMini) {
      function selectFromMiniMap (event) {
        var feature = event.features && event.features[0]
        var parcelId = feature && feature.properties && feature.properties.parcelId
        if (!parcelId) {
          return
        }
        closePopup()
        if (typeof opts.onParcelSelect === 'function') {
          opts.onParcelSelect(parcelId, feature.properties)
          return
        }
        if (feature.properties.href) {
          window.location.href = feature.properties.href
        }
      }
      map.on('click', 'land-parcels-fill', selectFromMiniMap)
      map.on('click', 'land-parcels-label', selectFromMiniMap)
      return map
    }

    var didScrollToPanel = false

    function scrollToSelectedPanel () {
      var panel = document.getElementById('selected-land-parcel')
      if (!panel || didScrollToPanel) {
        return
      }

      var heading = panel.querySelector('h2')
      var target = heading || panel
      // Force layout before measuring (map/fonts can still be settling).
      void panel.offsetHeight
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

      window.scrollTo(0, top)
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

    // Arrive with #selected-land-parcel: scroll to the panel straight away.
    // Do not wait for map idle — that left users stuck at the top for seconds.
    if (window.location.hash === '#selected-land-parcel') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual'
      }

      scrollToSelectedPanel()

      // Map paint can nudge layout; nudge once more after idle if we already scrolled.
      map.once('idle', function () {
        didScrollToPanel = false
        scrollToSelectedPanel()
      })
    }

    return map
  }

  function createAccordionMiniMapApi (payload) {
    var accordion = document.getElementById('land-details-parcel-accordion')
    var parcels = payload.parcels || []
    var map = null

    function setSelectedParcel (parcelId) {
      if (!map) {
        return
      }
      var nextParcels = parcels.map(function (parcel) {
        return Object.assign({}, parcel, {
          selected: parcelId != null && String(parcel.id) === String(parcelId)
        })
      })
      var geojson = buildGeoJson(nextParcels)
      var source = map.getSource(SOURCE_ID)
      if (source && typeof source.setData === 'function') {
        source.setData(geojson)
      }
    }

    function setAccordionSelected (parcelId) {
      if (!accordion) {
        return
      }
      var id = parcelId != null ? String(parcelId) : null
      accordion.querySelectorAll('.govuk-accordion__section').forEach(function (section) {
        var isSelected = id && section.getAttribute('data-parcel-id') === id
        section.classList.toggle('app-land-details-parcel-list__section--selected', Boolean(isSelected))
      })
    }

    function clearHoverHighlight () {
      var expanded = accordion && accordion.querySelector('.govuk-accordion__section--expanded')
      var parcelId = expanded && expanded.getAttribute('data-parcel-id')
      setSelectedParcel(parcelId || null)
    }

    function setSectionExpanded (section, expanded) {
      if (!section) {
        return
      }
      var button = section.querySelector('.govuk-accordion__section-button')
      var content = section.querySelector('.govuk-accordion__section-content')
      var showHideText = section.querySelector('.govuk-accordion__section-toggle-text')
      var showHideIcon = section.querySelector('.govuk-accordion-nav__chevron')
      if (!button || !content) {
        return
      }

      button.setAttribute('aria-expanded', expanded ? 'true' : 'false')
      if (expanded) {
        section.classList.add('govuk-accordion__section--expanded')
        content.removeAttribute('hidden')
        if (showHideText) {
          showHideText.textContent = 'Hide'
        }
        if (showHideIcon) {
          showHideIcon.classList.remove('govuk-accordion-nav__chevron--down')
        }
      } else {
        section.classList.remove('govuk-accordion__section--expanded')
        content.setAttribute('hidden', 'until-found')
        if (showHideText) {
          showHideText.textContent = 'Show'
        }
        if (showHideIcon) {
          showHideIcon.classList.add('govuk-accordion-nav__chevron--down')
        }
      }
    }

    function isStackedListLayout () {
      // Match CSS stacking breakpoint (narrow tablet and below)
      var stacked = Boolean(
        window.matchMedia &&
        window.matchMedia('(max-width: 48.0625em)').matches
      )
      if (!stacked) {
        return false
      }
      return Boolean(
        document.querySelector('.app-land-details-layout--list') ||
        document.querySelector('.app-land-details-layout--v2')
      )
    }

    function isV2Layout () {
      return Boolean(document.querySelector('.app-land-details-layout--v2'))
    }

    function listPanelCanScroll (listPanel) {
      if (!listPanel) {
        return false
      }
      var style = window.getComputedStyle(listPanel)
      if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') {
        return false
      }
      return listPanel.scrollHeight > listPanel.clientHeight + 1
    }

    function resizeMiniMapSoon () {
      window.setTimeout(function () {
        if (map && typeof map.resize === 'function') {
          map.resize()
        }
      }, 50)
    }

    function scrollOpenedSectionIntoView (section) {
      if (!section) {
        return
      }
      window.requestAnimationFrame(function () {
        // v2 desktop: map is sticky on the right — pin the opened section to the top
        if (isV2Layout() && !isStackedListLayout()) {
          var offset = 16
          var top = section.getBoundingClientRect().top + window.pageYOffset - offset
          window.scrollTo(0, Math.max(0, top))
          resizeMiniMapSoon()
          return
        }

        // Stacked mobile (v1 or v2): sit the section just under the sticky map
        var mapAside = document.querySelector(
          '.app-land-details-layout--list .app-land-details-summary, .app-land-details-layout--v2 .app-land-details-summary'
        )
        if (mapAside && window.getComputedStyle(mapAside).position === 'sticky') {
          var mapBottom = mapAside.getBoundingClientRect().bottom
          var sectionTop = section.getBoundingClientRect().top
          var delta = sectionTop - mapBottom - 8
          if (Math.abs(delta) > 1) {
            window.scrollBy(0, delta)
          }
        } else {
          section.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' })
        }
        resizeMiniMapSoon()
      })
    }

    function closeOtherSections (keepSection) {
      // v2 allows multiple sections open at once (standard GOV.UK accordion)
      if (!accordion || isV2Layout()) {
        return
      }
      accordion.querySelectorAll('.govuk-accordion__section--expanded').forEach(function (section) {
        if (section !== keepSection) {
          setSectionExpanded(section, false)
        }
      })
    }

    function openAccordionSection (parcelId) {
      if (!accordion) {
        return
      }
      var section = null
      var id = String(parcelId)
      try {
        section = accordion.querySelector('[data-parcel-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]')
      } catch (error) {
        section = accordion.querySelector('[data-parcel-id="' + id.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]')
      }
      if (!section) {
        return
      }
      closeOtherSections(section)
      setSectionExpanded(section, true)

      var listPanel = document.querySelector('.app-land-details-list-panel')
      if (listPanelCanScroll(listPanel) && listPanel.contains(section) && !isV2Layout()) {
        // v1 desktop: scroll inside the list column — keep the map in place
        var panelTop = listPanel.getBoundingClientRect().top
        var sectionTop = section.getBoundingClientRect().top
        listPanel.scrollTop += (sectionTop - panelTop) - 8
      } else {
        // Includes map clicks on v2 (list accordion clicks do not call this)
        scrollOpenedSectionIntoView(section)
      }
    }

    function selectParcel (parcelId) {
      openAccordionSection(parcelId)
      setSelectedParcel(parcelId)
      setAccordionSelected(parcelId)
    }

    function syncFromExpandedSections () {
      var expanded = accordion && accordion.querySelector('.govuk-accordion__section--expanded')
      var parcelId = expanded && expanded.getAttribute('data-parcel-id')
      if (parcelId) {
        setSelectedParcel(parcelId)
        setAccordionSelected(parcelId)
      } else {
        setSelectedParcel(null)
        setAccordionSelected(null)
      }
    }

    if (accordion) {
      var hoveredAccordionParcelId = null

      accordion.addEventListener('click', function (event) {
        var header = event.target.closest && event.target.closest('.govuk-accordion__section-header')
        var section = header && header.closest('.govuk-accordion__section')
        window.setTimeout(function () {
          if (section && section.classList.contains('govuk-accordion__section--expanded')) {
            closeOtherSections(section)
            var parcelId = section.getAttribute('data-parcel-id')
            setSelectedParcel(parcelId)
            setAccordionSelected(parcelId)
            if (isStackedListLayout() && !isV2Layout()) {
              scrollOpenedSectionIntoView(section)
            }
          } else {
            syncFromExpandedSections()
          }
        }, 0)
      })

      // Hovering a list row highlights the matching parcel on the map
      accordion.addEventListener('mouseover', function (event) {
        var section = event.target.closest && event.target.closest('.govuk-accordion__section')
        if (!section || !accordion.contains(section)) {
          return
        }
        var parcelId = section.getAttribute('data-parcel-id')
        if (!parcelId || parcelId === hoveredAccordionParcelId) {
          return
        }
        hoveredAccordionParcelId = parcelId
        setSelectedParcel(parcelId)
      })

      accordion.addEventListener('mouseleave', function () {
        hoveredAccordionParcelId = null
        clearHoverHighlight()
      })
    }

    return {
      bindMap: function (miniMap) {
        map = miniMap
        window.setTimeout(syncFromExpandedSections, 100)
      },
      selectParcel: selectParcel
    }
  }

  function init () {
    var payload = readJson('land-details-map-data')
    if (!payload || typeof maplibregl === 'undefined') {
      return
    }

    var fullMapEl = document.getElementById('land-details-map')
    var miniMapEl = document.getElementById('land-details-mini-map')

    if (fullMapEl) {
      window.__landDetailsMap = createMap(fullMapEl, payload, { mini: false })
    }

    if (miniMapEl) {
      var accordionApi = createAccordionMiniMapApi(payload)
      window.__landDetailsMiniMap = createMap(miniMapEl, payload, {
        mini: true,
        onParcelSelect: function (parcelId) {
          accordionApi.selectParcel(parcelId)
        }
      })
      accordionApi.bindMap(window.__landDetailsMiniMap)
      // List layout uses a fixed-height panel — resize once the map has a real size
      window.setTimeout(function () {
        if (window.__landDetailsMiniMap && typeof window.__landDetailsMiniMap.resize === 'function') {
          window.__landDetailsMiniMap.resize()
        }
      }, 50)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
