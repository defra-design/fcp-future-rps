// Loaded by sfi-grasslands-v4b/select-land. When the map is zoomed out, groups parcels
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
  // Matches the page's closest parcel view, so a lone parcel isn't filled edge to edge
  var SINGLE_PARCEL_MAX_ZOOM = 15

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
          // OS map sheet, so a cluster can show it when all its parcels share one
          properties: { parcelId: parcelId, sheet: getSheetReference(parcelData[parcelId]) || '' },
          geometry: { type: 'Point', coordinates: getCentroid(parcelData[parcelId].coords) }
        }
      })
    }
  }

  // ---------------------------------------------------------------------------
  // OS map sheet: the letters and first number of the parcel reference, as in the
  // earlier prototypes ("SO3757 3209" is on sheet SO3).
  // ---------------------------------------------------------------------------
  function getSheetReference (parcel) {
    var match = String(parcel && parcel.parcelReference || '').replace(/\s+/g, '').toUpperCase().match(/^([A-Z]{2})(\d)/)
    return match ? match[1] + match[2] : null
  }

  function formatHectares (value) {
    return Number(value || 0).toLocaleString('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' ha'
  }

  // Summary of the parcels in a cluster, in the same style as the parcel popup.
  // The OS sheet reference is only shown when every parcel in it is on the same sheet.
  function summaryPopupHtml (parcelIds, parcelData) {
    var sheets = {}
    var available = 0
    var area = 0
    parcelIds.forEach(function (parcelId) {
      var parcel = parcelData[parcelId]
      if (!parcel) {
        return
      }
      sheets[getSheetReference(parcel) || '?'] = true
      if (!parcel.unavailable) {
        available += 1
        area += Number(parcel.totalArea) || 0
      }
    })
    var sheetKeys = Object.keys(sheets)
    // One sheet: the same small line as the parcel popup. Several: a count instead.
    var title = sheetKeys.length === 1 && sheetKeys[0] !== '?'
      ? '<p class="app-v4b-map-popup__caption">OS sheet reference ' + sheetKeys[0] + '</p>'
      : '<h3 class="app-v4b-map-popup__title">' + parcelIds.length + (parcelIds.length === 1 ? ' land parcel' : ' land parcels') + '</h3>'
    return title +
      '<p>Available land parcels: ' + available + '</p>' +
      '<p>Total area: ' + formatHectares(area) + '</p>'
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

  // select-parcels: a cluster that holds land in more than one place splits into
  // those places first, instead of zooming out far enough to show them all at once
  function zoomToClusterOrSplit (map, parcelData, clusterFeature, minZoom) {
    var source = map.getSource(POINT_SOURCE_ID)
    var clusterId = clusterFeature.properties.cluster_id
    Promise.resolve(source.getClusterExpansionZoom(clusterId)).then(function (expansionZoom) {
      if (Number.isFinite(expansionZoom) && expansionZoom <= CLUSTER_MAX_ZOOM) {
        map.easeTo({ center: clusterFeature.geometry.coordinates, zoom: expansionZoom })
        return
      }
      zoomToCluster(map, parcelData, clusterFeature, minZoom)
    }).catch(function () {
      zoomToCluster(map, parcelData, clusterFeature, minZoom)
    })
  }

  // minZoom (optional): fitting a long or spread-out group can stop so far out that the
  // fields are tiny. Then zoom in to minZoom on the middle of the group instead.
  function zoomToCluster (map, parcelData, clusterFeature, minZoom) {
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
      var camera = minZoom && typeof map.cameraForBounds === 'function'
        ? map.cameraForBounds(bounds, { padding: FIT_PADDING_PX, maxZoom: 16 })
        : null
      if (camera && Number.isFinite(camera.zoom) && camera.zoom < minZoom) {
        map.easeTo({
          center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
          zoom: minZoom
        })
        return
      }
      map.fitBounds(bounds, { padding: FIT_PADDING_PX, maxZoom: 16 })
    }).catch(function () {
      map.easeTo({ center: clusterFeature.geometry.coordinates, zoom: CLUSTER_MAX_ZOOM + 2 })
    })
  }

  function zoomToParcel (map, parcelData, pointFeature) {
    var bounds = getBounds([pointFeature.properties.parcelId], parcelData)
    if (bounds) {
      map.fitBounds(bounds, { padding: FIT_PADDING_PX, maxZoom: SINGLE_PARCEL_MAX_ZOOM })
    } else {
      map.easeTo({ center: pointFeature.geometry.coordinates, zoom: CLUSTER_MAX_ZOOM + 2 })
    }
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
      // Larger on select-parcels, so circles never overlap (a "2" sat on top of a "23")
      clusterRadius: opts.clusterRadius || CLUSTER_RADIUS_PX,
      // The cluster's OS map sheet: the shared one, or '' when its parcels are on more than one
      clusterProperties: {
        sheet: [
          ['case', ['==', ['accumulated'], ['get', 'sheet']], ['accumulated'], ''],
          ['get', 'sheet']
        ]
      }
    })

    // select-parcels (showSheet): the sheet reference in small text under the circle,
    // only when every parcel in the circle is on that sheet
    var hasSheet = ['all', Boolean(opts.showSheet), ['!=', ['coalesce', ['get', 'sheet'], ''], '']]
    var countText = ['coalesce', ['get', 'point_count_abbreviated'], '1']

    // A parcel on its own isn't grouped into a cluster, so it has no point_count. It still
    // gets a "1" bubble while clusters show, or it would be too small to see.
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'circle',
      source: POINT_SOURCE_ID,
      maxzoom: CLUSTER_MAX_ZOOM + 1,
      paint: {
        'circle-color': '#1d70b8',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-radius': ['step', ['coalesce', ['get', 'point_count'], 1], 16, 5, 20, 20, 26]
      }
    })

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: POINT_SOURCE_ID,
      maxzoom: CLUSTER_MAX_ZOOM + 1,
      layout: {
        'text-field': countText,
        'text-font': ['Noto Sans Bold'],
        'text-size': 14,
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#ffffff'
      }
    })

    if (opts.showSheet) {
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID + '-sheet',
        type: 'symbol',
        source: POINT_SOURCE_ID,
        maxzoom: CLUSTER_MAX_ZOOM + 1,
        filter: hasSheet,
        layout: {
          'text-field': ['get', 'sheet'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'top',
          // Just below the circle, whatever its size
          'text-offset': ['step', ['coalesce', ['get', 'point_count'], 1],
            ['literal', [0, 1.75]], 5, ['literal', [0, 2.1]], 20, ['literal', [0, 2.6]]],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#0b0c0c',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      })
    }

    if (opts.labelLayerId && map.getLayer(opts.labelLayerId)) {
      map.setLayerZoomRange(opts.labelLayerId, LABEL_MIN_ZOOM, 24)
    }

    map.on('click', CLUSTER_LAYER_ID, function (event) {
      var feature = event.features && event.features[0]
      if (!feature) {
        return
      }
      if (feature.properties.cluster && opts.splitClusters) {
        zoomToClusterOrSplit(map, parcelData, feature, opts.clusterMinZoom)
      } else if (feature.properties.cluster) {
        zoomToCluster(map, parcelData, feature, opts.clusterMinZoom)
      } else {
        zoomToParcel(map, parcelData, feature)
      }
    })

    map.on('mouseenter', CLUSTER_LAYER_ID, function () {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', CLUSTER_LAYER_ID, function () {
      map.getCanvas().style.cursor = ''
    })

    if (opts.hoverSummary) {
      attachHoverSummary(map, parcelData)
    }
  }

  // select-parcels only: hovering a cluster shows what is in it
  function attachHoverSummary (map, parcelData) {
    var popup = null
    var hoveredKey = null
    var requestId = 0

    function closePopup () {
      requestId++
      hoveredKey = null
      if (popup) {
        popup.remove()
        popup = null
      }
    }

    function openPopup (feature, parcelIds) {
      if (!window.maplibregl || !window.maplibregl.Popup) {
        return
      }
      if (popup) {
        popup.remove()
      }
      var coords = feature.geometry.coordinates
      popup = new window.maplibregl.Popup({
        anchor: map.project(coords).y < 140 ? 'top' : 'bottom',
        offset: 30,
        closeButton: false,
        closeOnClick: false,
        maxWidth: '216px',
        className: 'app-v4b-map-popup'
      })
        .setLngLat(coords)
        .setHTML(summaryPopupHtml(parcelIds, parcelData))
        .addTo(map)
      var element = popup.getElement()
      if (element) {
        element.setAttribute('aria-hidden', 'true')
      }
    }

    map.on('mousemove', CLUSTER_LAYER_ID, function (event) {
      var feature = event.features && event.features[0]
      if (!feature) {
        return
      }
      var key = feature.properties.cluster
        ? 'cluster-' + feature.properties.cluster_id
        : 'parcel-' + feature.properties.parcelId
      if (key === hoveredKey) {
        return
      }
      closePopup()
      hoveredKey = key
      if (!feature.properties.cluster) {
        openPopup(feature, [feature.properties.parcelId])
        return
      }
      var thisRequest = requestId
      Promise.resolve(map.getSource(POINT_SOURCE_ID).getClusterLeaves(feature.properties.cluster_id, Infinity, 0))
        .then(function (leaves) {
          if (thisRequest !== requestId) {
            return
          }
          openPopup(feature, (leaves || []).map(function (leaf) { return leaf.properties.parcelId }))
        })
        .catch(function () {})
    })

    map.on('mouseleave', CLUSTER_LAYER_ID, closePopup)
    map.on('click', CLUSTER_LAYER_ID, closePopup)
    map.on('movestart', closePopup)
  }

  // Lets the page skip parcel hover and click when the pointer is over a cluster
  function isClusterAt (map, point) {
    if (!map || !point || !map.getLayer(CLUSTER_LAYER_ID)) {
      return false
    }
    return map.queryRenderedFeatures(point, { layers: [CLUSTER_LAYER_ID] }).length > 0
  }

  window.SfiGrasslandsV4bSelectLandMapClusters = {
    attach: attach,
    isClusterAt: isClusterAt
  }
})()
