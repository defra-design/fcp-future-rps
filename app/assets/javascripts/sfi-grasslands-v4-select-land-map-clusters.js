// Loaded by sfi-grasslands-v4/select-land. When the map is zoomed out, groups parcels
// into numbered clusters. Selecting a cluster zooms in to fit the parcels inside it.
(function () {
  var POINT_SOURCE_ID = 'parcel-cluster-points'
  var CLUSTER_LAYER_ID = 'parcel-clusters'
  var CLUSTER_COUNT_LAYER_ID = 'parcel-cluster-count'

  // Clusters show at zoom 11 and below, when fields are too small to pick out.
  // Labels wait until zoom 13 because they overlap each other before then.
  var CLUSTER_MAX_ZOOM = 11
  var LABEL_MIN_ZOOM = 13
  var CLUSTER_RADIUS_PX = 50
  // The map already insets its view for the search and "View all" buttons, so only a
  // little is added here, plus extra on the right to clear the zoom and pan controls
  var FIT_PADDING_PX = { top: 10, right: 60, bottom: 10, left: 20 }

  // parcelData coords are [lat, lng]; MapLibre wants [lng, lat]
  function getCentroid (coords) {
    var sumLng = 0
    var sumLat = 0
    coords.forEach(function (point) {
      sumLat += point[0]
      sumLng += point[1]
    })
    return [sumLng / coords.length, sumLat / coords.length]
  }

  function buildPointCollection (parcelData) {
    return {
      type: 'FeatureCollection',
      features: Object.keys(parcelData).filter(function (parcelId) {
        var coords = parcelData[parcelId].coords
        return Array.isArray(coords) && coords.length
      }).map(function (parcelId) {
        return {
          type: 'Feature',
          properties: { parcelId: parcelId },
          geometry: { type: 'Point', coordinates: getCentroid(parcelData[parcelId].coords) }
        }
      })
    }
  }

  function getBounds (parcelIds, parcelData) {
    var minLng = Infinity
    var minLat = Infinity
    var maxLng = -Infinity
    var maxLat = -Infinity
    parcelIds.forEach(function (parcelId) {
      var parcel = parcelData[parcelId]
      if (!parcel || !Array.isArray(parcel.coords)) {
        return
      }
      parcel.coords.forEach(function (point) {
        minLat = Math.min(minLat, point[0])
        maxLat = Math.max(maxLat, point[0])
        minLng = Math.min(minLng, point[1])
        maxLng = Math.max(maxLng, point[1])
      })
    })
    if (!Number.isFinite(minLng)) {
      return null
    }
    return [[minLng, minLat], [maxLng, maxLat]]
  }

  function zoomToCluster (map, parcelData, clusterFeature) {
    var source = map.getSource(POINT_SOURCE_ID)
    var clusterId = clusterFeature.properties.cluster_id

    Promise.resolve(source.getClusterLeaves(clusterId, Infinity, 0)).then(function (leaves) {
      var parcelIds = (leaves || []).map(function (leaf) {
        return leaf.properties.parcelId
      })
      var bounds = getBounds(parcelIds, parcelData)
      if (!bounds) {
        throw new Error('No parcel bounds for cluster')
      }
      map.fitBounds(bounds, { padding: FIT_PADDING_PX, maxZoom: 16 })
    }).catch(function () {
      map.easeTo({ center: clusterFeature.geometry.coordinates, zoom: CLUSTER_MAX_ZOOM + 2 })
    })
  }

  function attach (map, options) {
    var opts = options || {}
    var parcelData = opts.parcelData || {}

    if (map.getSource(POINT_SOURCE_ID)) {
      return
    }

    map.addSource(POINT_SOURCE_ID, {
      type: 'geojson',
      data: buildPointCollection(parcelData),
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS_PX
    })

    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'circle',
      source: POINT_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#1d70b8',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 20, 26]
      }
    })

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: POINT_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 14,
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#ffffff'
      }
    })

    if (opts.labelLayerId && map.getLayer(opts.labelLayerId)) {
      map.setLayerZoomRange(opts.labelLayerId, LABEL_MIN_ZOOM, 24)
    }

    map.on('click', CLUSTER_LAYER_ID, function (event) {
      var feature = event.features && event.features[0]
      if (feature) {
        zoomToCluster(map, parcelData, feature)
      }
    })

    map.on('mouseenter', CLUSTER_LAYER_ID, function () {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', CLUSTER_LAYER_ID, function () {
      map.getCanvas().style.cursor = ''
    })
  }

  // Lets the page skip parcel hover and click when the pointer is over a cluster
  function isClusterAt (map, point) {
    if (!map || !point || !map.getLayer(CLUSTER_LAYER_ID)) {
      return false
    }
    return map.queryRenderedFeatures(point, { layers: [CLUSTER_LAYER_ID] }).length > 0
  }

  window.SfiGrasslandsV4SelectLandMapClusters = {
    attach: attach,
    isClusterAt: isClusterAt
  }
})()
