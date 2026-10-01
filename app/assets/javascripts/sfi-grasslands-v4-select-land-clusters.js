// Loaded by sfi-grasslands-v4 select-land-clusters.
// Land parcels are spread across several sites. When zoomed out, nearby parcels are grouped
// into numbered clusters. Selecting a number zooms in to show the parcels in that group.
(function (window, document) {
  var PARCEL_SOURCE = 'cluster-page-parcels'
  var POINT_SOURCE = 'cluster-page-points'
  var LAYERS = {
    fill: 'cluster-page-parcel-fill',
    line: 'cluster-page-parcel-line',
    label: 'cluster-page-parcel-label',
    dot: 'cluster-page-parcel-dot',
    cluster: 'cluster-page-cluster',
    count: 'cluster-page-cluster-count'
  }
  // Above this zoom every parcel is shown on its own (zooming to a site goes past it)
  var CLUSTER_MAX_ZOOM = 11
  var LABEL_MIN_ZOOM = 14
  var CLUSTER_RADIUS_PX = 50
  var FIT_PADDING_PX = 60
  var COLOURS = {
    parcelFill: '#f1deb8',
    parcelBorder: '#8a5a44',
    selectedFill: '#ffdd00',
    darkBorder: '#0b0c0c',
    cluster: '#1d70b8'
  }
  var FONT = ['Open Sans Regular', 'Arial Unicode MS Regular']

  var data = readData()
  var parcels = data.parcels || []
  var parcelsById = {}
  var sitesById = {}
  parcels.forEach(function (parcel) { parcelsById[parcel.id] = parcel })
  ;(data.sites || []).forEach(function (site) { sitesById[site.id] = site })

  var rawMap = null
  var interactiveMap = null
  var defaultView = null
  var selectedParcelId = null

  function readData () {
    var el = document.getElementById('clustered-parcels-data')
    try {
      return JSON.parse(el ? el.textContent : '{}') || {}
    } catch (error) {
      return {}
    }
  }

  function boundsOf (list) {
    var minLng = Infinity
    var minLat = Infinity
    var maxLng = -Infinity
    var maxLat = -Infinity
    list.forEach(function (parcel) {
      parcel.ring.forEach(function (point) {
        minLng = Math.min(minLng, point[0])
        maxLng = Math.max(maxLng, point[0])
        minLat = Math.min(minLat, point[1])
        maxLat = Math.max(maxLat, point[1])
      })
    })
    return [[minLng, minLat], [maxLng, maxLat]]
  }

  function fitTo (list, options) {
    if (!rawMap || !list.length) {
      return
    }
    rawMap.fitBounds(boundsOf(list), Object.assign({ padding: FIT_PADDING_PX, maxZoom: 16 }, options))
  }

  function parcelPolygons () {
    return {
      type: 'FeatureCollection',
      features: parcels.map(function (parcel) {
        return {
          type: 'Feature',
          properties: { id: parcel.id, reference: parcel.reference },
          geometry: { type: 'Polygon', coordinates: [parcel.ring] }
        }
      })
    }
  }

  // MapLibre can only cluster points, so each parcel also has a centre point
  function parcelPoints () {
    return {
      type: 'FeatureCollection',
      features: parcels.map(function (parcel) {
        return {
          type: 'Feature',
          properties: { id: parcel.id },
          geometry: { type: 'Point', coordinates: parcel.centroid }
        }
      })
    }
  }

  function addLayers (map) {
    map.addSource(PARCEL_SOURCE, { type: 'geojson', data: parcelPolygons(), promoteId: 'id' })
    map.addSource(POINT_SOURCE, {
      type: 'geojson',
      data: parcelPoints(),
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS_PX
    })

    var isSelected = ['boolean', ['feature-state', 'selected'], false]

    map.addLayer({
      id: LAYERS.fill,
      type: 'fill',
      source: PARCEL_SOURCE,
      paint: {
        'fill-color': ['case', isSelected, COLOURS.selectedFill, COLOURS.parcelFill],
        'fill-opacity': ['case', isSelected, 1, 0.8]
      }
    })
    map.addLayer({
      id: LAYERS.line,
      type: 'line',
      source: PARCEL_SOURCE,
      paint: {
        'line-color': ['case', isSelected, COLOURS.darkBorder, COLOURS.parcelBorder],
        'line-width': ['case', isSelected, 3, 1.5]
      }
    })
    map.addLayer({
      id: LAYERS.label,
      type: 'symbol',
      source: PARCEL_SOURCE,
      minzoom: LABEL_MIN_ZOOM,
      layout: { 'text-field': ['get', 'reference'], 'text-size': 12, 'text-font': FONT },
      paint: { 'text-color': '#0b0c0c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
    })

    // A lone parcel is too small to see when zoomed out, so mark it with a dot
    map.addLayer({
      id: LAYERS.dot,
      type: 'circle',
      source: POINT_SOURCE,
      filter: ['!', ['has', 'point_count']],
      maxzoom: CLUSTER_MAX_ZOOM + 1,
      paint: {
        'circle-color': COLOURS.parcelBorder,
        'circle-radius': 5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    })
    map.addLayer({
      id: LAYERS.cluster,
      type: 'circle',
      source: POINT_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': COLOURS.cluster,
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3
      }
    })
    map.addLayer({
      id: LAYERS.count,
      type: 'symbol',
      source: POINT_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 15,
        'text-font': FONT,
        'text-allow-overlap': true
      },
      paint: { 'text-color': '#ffffff' }
    })
  }

  function zoomToCluster (clusterFeature) {
    var source = rawMap.getSource(POINT_SOURCE)
    var clusterId = clusterFeature.properties.cluster_id
    Promise.resolve(source.getClusterLeaves(clusterId, Infinity, 0)).then(function (leaves) {
      var list = (leaves || []).map(function (leaf) {
        return parcelsById[leaf.properties.id]
      }).filter(Boolean)
      fitTo(list)
    }).catch(function () {
      rawMap.easeTo({ center: clusterFeature.geometry.coordinates, zoom: rawMap.getZoom() + 2 })
    })
  }

  function selectParcel (parcelId) {
    if (selectedParcelId) {
      rawMap.setFeatureState({ source: PARCEL_SOURCE, id: selectedParcelId }, { selected: false })
    }
    selectedParcelId = parcelId
    rawMap.setFeatureState({ source: PARCEL_SOURCE, id: parcelId }, { selected: true })
    showSelectedParcel(parcelsById[parcelId])
  }

  function showSelectedParcel (parcel) {
    var details = document.getElementById('selected-parcel-details')
    var empty = document.getElementById('selected-parcel-empty')
    if (!details || !parcel) {
      return
    }
    var site = sitesById[parcel.siteId]
    var values = {
      reference: parcel.reference,
      site: site ? site.name : '',
      landCover: parcel.landCover,
      area: parcel.areaHa.toFixed(4) + ' ha'
    }
    Object.keys(values).forEach(function (field) {
      var el = details.querySelector('[data-field="' + field + '"]')
      if (el) {
        el.textContent = values[field]
      }
    })
    details.hidden = false
    if (empty) {
      empty.hidden = true
    }
  }

  function bindMapEvents (map) {
    map.on('click', LAYERS.cluster, function (event) {
      if (event.features && event.features.length) {
        zoomToCluster(event.features[0])
      }
    })

    map.on('click', LAYERS.dot, function (event) {
      var parcel = event.features && parcelsById[event.features[0].properties.id]
      if (parcel) {
        fitTo([parcel])
      }
    })

    map.on('click', LAYERS.fill, function (event) {
      // Clusters sit on top of parcels — a cluster click shouldn't also select a parcel
      var onTop = map.queryRenderedFeatures(event.point, { layers: [LAYERS.cluster, LAYERS.dot] })
      if (onTop.length || !event.features || !event.features.length) {
        return
      }
      selectParcel(event.features[0].properties.id)
    })

    ;[LAYERS.cluster, LAYERS.dot, LAYERS.fill].forEach(function (layerId) {
      map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = '' })
    })

    map.on('moveend', updateResetButton)
  }

  function isAwayFromDefaultView () {
    if (!rawMap || !defaultView) {
      return false
    }
    var center = rawMap.getCenter()
    return Math.abs(center.lng - defaultView.center.lng) > 0.002 ||
      Math.abs(center.lat - defaultView.center.lat) > 0.002 ||
      Math.abs(rawMap.getZoom() - defaultView.zoom) > 0.12
  }

  function updateResetButton () {
    if (interactiveMap && window.sfiGrasslandsV4MapResetButton) {
      window.sfiGrasslandsV4MapResetButton.setVisible(interactiveMap, isAwayFromDefaultView())
    }
  }

  function showAllParcels () {
    fitTo(parcels)
  }

  function bindSiteButtons () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-site-id]'), function (button) {
      button.addEventListener('click', function () {
        var siteId = button.getAttribute('data-site-id')
        fitTo(parcels.filter(function (parcel) { return parcel.siteId === siteId }))
      })
    })
  }

  function whenStyleLoaded (map, callback) {
    if (map.isStyleLoaded()) {
      callback()
    } else {
      map.once('load', callback)
    }
  }

  function init () {
    if (!window.defra || !document.getElementById('map') || !parcels.length) {
      return
    }

    var allBounds = boundsOf(parcels)
    interactiveMap = new window.defra.InteractiveMap('map', {
      behaviour: 'inline',
      mapProvider: window.defra.maplibreProvider(),
      mapLabel: 'Map of your land parcels',
      center: [(allBounds[0][0] + allBounds[1][0]) / 2, (allBounds[0][1] + allBounds[1][1]) / 2],
      zoom: 11,
      minZoom: 6,
      maxZoom: 19,
      containerHeight: '560px',
      enableZoomControls: true,
      mapStyle: {
        url: 'https://tiles.openfreemap.org/styles/liberty',
        attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
        backgroundColor: '#f5f5f0'
      },
      plugins: [window.defra.scaleBarPlugin({ units: 'metric' })]
    })

    interactiveMap.on('app:ready', function () {
      interactiveMap.toggleButtonState('mapControls', 'expanded', true)
      if (window.sfiGrasslandsV4MapResetButton) {
        window.sfiGrasslandsV4MapResetButton.add(interactiveMap, showAllParcels)
      }
    })

    interactiveMap.on('map:ready', function (event) {
      if (!event || !event.map) {
        return
      }
      rawMap = event.map
      // Page scrolls normally over the map; zoom with +/- or pinch
      if (rawMap.scrollZoom) {
        rawMap.scrollZoom.disable()
      }

      whenStyleLoaded(rawMap, function () {
        addLayers(rawMap)
        bindMapEvents(rawMap)
        rawMap.fitBounds(allBounds, { padding: FIT_PADDING_PX, duration: 0 })
        defaultView = { center: rawMap.getCenter(), zoom: rawMap.getZoom() }
        updateResetButton()
      })
    })

    window.addEventListener('resize', function () {
      if (rawMap) {
        rawMap.resize()
      }
    })

    bindSiteButtons()
  }

  init()
})(window, document)
