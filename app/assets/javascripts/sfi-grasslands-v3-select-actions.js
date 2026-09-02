/**
 * sfi-grasslands-v3: Select actions page
 *
 * Map, parcel selection, action checkboxes, quantities, and save.
 * Loaded only from app/views/sfi-grasslands-v3/select-actions.html.
 */
function toMapLibreLatLng(latLng) {
  return [latLng[1], latLng[0]];
}

function toClosedMapLibreRing(latLngs) {
  var ring = latLngs.map(toMapLibreLatLng);
  if (ring.length === 0) {
    return ring;
  }

  var first = ring[0];
  var last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return ring;
}

function createBoundsFromLatLngs(latLngs) {
  var minLat = Infinity;
  var maxLat = -Infinity;
  var minLng = Infinity;
  var maxLng = -Infinity;

  latLngs.forEach(function(latLng) {
    minLat = Math.min(minLat, latLng[0]);
    maxLat = Math.max(maxLat, latLng[0]);
    minLng = Math.min(minLng, latLng[1]);
    maxLng = Math.max(maxLng, latLng[1]);
  });

  return {
    getCenter: function() {
      return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
    },
    toMapLibreBounds: function() {
      return [[minLng, minLat], [maxLng, maxLat]];
    }
  };
}

function resetMapToAllParcelsView() {
  suppressParcelSelectionFor(350);
  closeAllParcelPopups();

  if (!rawMap) {
    return;
  }

  if (defaultMapView) {
    rawMap.easeTo({
      center: [defaultMapView.lng, defaultMapView.lat],
      zoom: defaultMapView.zoom
    });
    return;
  }

  map.setView(ALL_FARMS_MAP_CENTER, ALL_FARMS_MAP_ZOOM);
}

function normalizePadding(padding) {
  if (!padding) {
    return 0;
  }
  if (Array.isArray(padding)) {
    return Math.max(padding[0] || 0, padding[1] || 0);
  }
  return padding;
}

var rawMap = null;
var defaultMapView = null;
var mapReadyCallbacks = [];

var ALL_FARMS_MAP_CENTER = [51.9497679, -0.7448892];
var ALL_FARMS_MAP_ZOOM = 13.9865053;

// Capture before InteractiveMap rewrites the URL query string
var fromCheckYourAnswersParam = new URLSearchParams(window.location.search).get('from') === 'check-your-answers';
if (fromCheckYourAnswersParam) {
  sessionStorage.setItem('editingFromCheckYourAnswers', 'true');
} else if (document.referrer.indexOf('check-your-answers') === -1) {
  sessionStorage.removeItem('editingFromCheckYourAnswers');
}

function clearMapViewQueryParams() {
  try {
    var url = new URL(window.location.href);
    var changed = false;

    ['map:center', 'map:zoom'].forEach(function(param) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });

    if (changed) {
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch (error) {
    // Ignore URL parsing issues in older browsers.
  }
}

function establishDefaultMapView() {
  defaultMapView = {
    lat: ALL_FARMS_MAP_CENTER[0],
    lng: ALL_FARMS_MAP_CENTER[1],
    zoom: ALL_FARMS_MAP_ZOOM
  };
}

function isMapAwayFromDefaultView() {
  if (!rawMap || !defaultMapView) {
    return false;
  }

  var center = rawMap.getCenter();
  var zoom = rawMap.getZoom();
  var latDiff = Math.abs(center.lat - defaultMapView.lat);
  var lngDiff = Math.abs(center.lng - defaultMapView.lng);
  var zoomDiff = Math.abs(zoom - defaultMapView.zoom);

  return latDiff > 0.0015 || lngDiff > 0.0015 || zoomDiff > 0.12;
}

function updateResetMapViewButtonVisibility() {
  var button = document.getElementById('reset-map-view-button');
  if (!button) {
    return;
  }

  button.hidden = !isMapAwayFromDefaultView();
}

function onMapReady(callback) {
  if (rawMap) {
    callback(rawMap);
  } else {
    mapReadyCallbacks.push(callback);
  }
}

function onMapStyleReady(callback) {
  onMapReady(function(mapInstance) {
    var called = false;

    function runCallback() {
      if (called) {
        return;
      }
      if (!mapInstance.isStyleLoaded()) {
        return;
      }

      called = true;
      mapInstance.off('styledata', runCallback);
      mapInstance.off('idle', runCallback);
      callback(mapInstance);
    }

    mapInstance.on('styledata', runCallback);
    mapInstance.on('idle', runCallback);
    mapInstance.once('load', runCallback);
    runCallback();
  });
}

var mapHeight = Math.max(window.innerHeight - 260, 380);

clearMapViewQueryParams();

var interactiveMap = new defra.InteractiveMap('map', {
  behaviour: 'inline',
  mapProvider: defra.maplibreProvider(),
  mapLabel: 'Land parcel map for action selection',
  center: [ALL_FARMS_MAP_CENTER[1], ALL_FARMS_MAP_CENTER[0]],
  zoom: ALL_FARMS_MAP_ZOOM,
  minZoom: 6,
  maxZoom: 19,
  containerHeight: mapHeight + 'px',
  enableZoomControls: true,
  mapStyle: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
    backgroundColor: '#f5f5f0'
  },
  plugins: [
    defra.scaleBarPlugin({ units: 'metric' })
  ]
});

interactiveMap.on('map:ready', function(event) {
  if (!event || !event.map) {
    return;
  }

  rawMap = event.map;
  mapReadyCallbacks.splice(0).forEach(function(callback) {
    callback(rawMap);
  });

  establishDefaultMapView();
  rawMap.on('moveend', updateResetMapViewButtonVisibility);
  rawMap.once('idle', function() {
    if (isMapAwayFromDefaultView()) {
      resetMapToAllParcelsView();
      return;
    }

    updateResetMapViewButtonVisibility();
  });
});

window.addEventListener('resize', function() {
  if (rawMap) {
    rawMap.resize();
  }
});

var map = {
  setView: function(latLng, zoom) {
    if (!rawMap) {
      return;
    }
    rawMap.easeTo({ center: toMapLibreLatLng(latLng), zoom: zoom });
  },
  panTo: function(latLng) {
    if (!rawMap) {
      return;
    }
    rawMap.easeTo({ center: toMapLibreLatLng(latLng) });
  },
  fitBounds: function(bounds, options) {
    if (!rawMap || !bounds || typeof bounds.toMapLibreBounds !== 'function') {
      return;
    }
    var mlBounds = bounds.toMapLibreBounds();
    if (
      !mlBounds ||
      !mlBounds[0] ||
      !mlBounds[1] ||
      !Number.isFinite(mlBounds[0][0]) ||
      !Number.isFinite(mlBounds[0][1]) ||
      !Number.isFinite(mlBounds[1][0]) ||
      !Number.isFinite(mlBounds[1][1])
    ) {
      return;
    }
    try {
      rawMap.fitBounds(mlBounds, {
        padding: normalizePadding(options && options.padding),
        maxZoom: options && options.maxZoom
      });
    } catch (error) {
      console.warn('Map fitBounds failed', error);
    }
  },
  getZoom: function() {
    return rawMap ? rawMap.getZoom() : 8;
  }
};

// Store polygon references
var parcelPolygons = {};
var currentSelectedParcel = null;
var pendingParcelRestoreTimeout = null;
var pendingActionFocusCode = null;
var suppressParcelSelectionUntil = 0;

function suppressParcelSelectionFor(milliseconds) {
  suppressParcelSelectionUntil = Date.now() + Math.max(0, Number(milliseconds) || 0);
}

var FARM_VIEW_CONFIG = {
  'blackberry': { label: 'Blackberry Farm', panelId: 'blackberry-farm-info', center: [51.9525, -0.7520], zoom: 15, parcelListId: 'buckinghamshire-parcels' }
};

var farmMapMarkers = [];

function clearFarmMapMarkers() {
  farmMapMarkers.forEach(function(farmMarker) {
    farmMarker.marker.remove();
  });
  farmMapMarkers = [];
}

function setFarmMapMarkerVisibility(activeFarmKey) {
  farmMapMarkers.forEach(function(farmMarker) {
    if (!farmMarker.element) {
      return;
    }

    farmMarker.element.style.display = activeFarmKey && farmMarker.farmKey === activeFarmKey ? 'none' : '';
  });
}

function renderFarmMapMarkers() {
  if (!rawMap) {
    return;
  }

  clearFarmMapMarkers();

  Object.keys(FARM_VIEW_CONFIG).forEach(function(farmKey) {
    var farmConfig = FARM_VIEW_CONFIG[farmKey];
    var markerElement = document.createElement('a');
    markerElement.href = '#';
    markerElement.className = 'farm-map-tooltip farm-focus-link';
    markerElement.setAttribute('data-farm-key', farmKey);
    markerElement.textContent = farmConfig.label || farmKey;
    markerElement.setAttribute('aria-label', 'Focus map on ' + (farmConfig.label || farmKey));

    var marker = new maplibregl.Marker({
      element: markerElement,
      anchor: 'bottom'
    })
      .setLngLat(toMapLibreLatLng(farmConfig.center))
      .addTo(rawMap);

    farmMapMarkers.push({
      farmKey: farmKey,
      marker: marker,
      element: markerElement
    });
  });

  setFarmMapMarkerVisibility(null);
}

onMapReady(function() {
  renderFarmMapMarkers();
});

var LOCATION_TO_PARCEL_LIST_ID = {
  buckinghamshire: 'buckinghamshire-parcels'
};

var LOCATION_TO_EXISTING_ACTIONS_ID = {
  buckinghamshire: 'blackberry-existing-actions'
};

// Parcel data with polygon coordinates matching actual field boundaries
var parcelData = {
  'lower-field': {
    name: 'Lower Field',
    osRef: 'SP 476 432',
    numParcels: 20,
    totalArea: '120.3451',
    availableArea: '120.3451',
    numActions: 0,
    location: 'oxfordshire',
    landCover: 'Temporary grass',
    coords: [
      [51.7643, -1.2395],
      [51.7643, -1.2365],
      [51.7635, -1.2363],
      [51.7630, -1.2367],
      [51.7628, -1.2393],
      [51.7633, -1.2396]
    ],
    actions: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2'],
    color: '#8FBC8F'
  },
  'upper-field': {
    name: 'Upper Field',
    osRef: 'SP 478 434',
    numParcels: 15,
    totalArea: '5.2341',
    availableArea: '5.2341',
    numActions: 0,
    location: 'oxfordshire',
    landCover: 'Permanent grassland',
    coords: [
      [51.7655, -1.2396],
      [51.7655, -1.2375],
      [51.7650, -1.2373],
      [51.7643, -1.2365],
      [51.7643, -1.2395],
      [51.7648, -1.2397]
    ],
    actions: ['CNUM3', 'CAHL1', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1'],
    color: '#DEB887'
  },
  'woods-view': {
    name: 'Woods View',
    osRef: 'SP 480 436',
    numParcels: 8,
    totalArea: '12.8765',
    availableArea: '7.5000',
    numActions: 1,
    location: 'oxfordshire',
    landCover: 'Bog',
    coords: [
      [51.7667, -1.2397],
      [51.7667, -1.2367],
      [51.7662, -1.2365],
      [51.7655, -1.2375],
      [51.7655, -1.2396],
      [51.7660, -1.2398]
    ],
    actions: ['CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'SOH1', 'CIGL1', 'AHW3', 'CNUM3'],
    color: '#228B22'
  },
  'long-meadow': {
    name: 'Long Meadow',
    osRef: 'SP 474 430',
    numParcels: 12,
    totalArea: '8.4521',
    availableArea: '4.4521',
    numActions: 1,
    location: 'oxfordshire',
    landCover: 'Other arable crops',
    coords: [
      [51.7628, -1.2393],
      [51.7630, -1.2367],
      [51.7623, -1.2364],
      [51.7616, -1.2368],
      [51.7613, -1.2392],
      [51.7620, -1.2395]
    ],
    actions: ['CNUM2', 'CIGL1', 'CSAM3', 'CAHL1', 'BFS1', 'AHW7', 'CIPM2', 'SOH1', 'PRF1'],
    color: '#90EE90'
  },
  'river-pasture': {
    name: 'River Pasture',
    osRef: 'SP 482 432',
    numParcels: 18,
    totalArea: '15.3267',
    availableArea: '15.3267',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7643, -1.2365],
      [51.7650, -1.2373],
      [51.7650, -1.2340],
      [51.7642, -1.2337],
      [51.7635, -1.2340],
      [51.7635, -1.2363]
    ],
    actions: ['BFS1', 'CAHL1', 'CAHL2', 'CIPM2', 'CNUM2', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1'],
    color: '#87CEEB'
  },
  'top-barn-field': {
    name: 'Top Barn Field',
    osRef: 'SP 484 434',
    numParcels: 10,
    totalArea: '6.7894',
    availableArea: '6.7894',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7655, -1.2375],
      [51.7662, -1.2365],
      [51.7662, -1.2340],
      [51.7655, -1.2337],
      [51.7650, -1.2340],
      [51.7650, -1.2373]
    ],
    actions: ['CNUM3', 'SOH1', 'PRF1', 'CSAM2', 'CAHL2', 'BFS1', 'CIPM2', 'CIGL1', 'AHW3', 'CSAM3'],
    color: '#F4A460'
  },
  'oak-tree-field': {
    name: 'Oak Tree Field',
    osRef: 'SP 486 436',
    numParcels: 14,
    totalArea: '11.2483',
    availableArea: '11.2483',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7667, -1.2397],
      [51.7673, -1.2395],
      [51.7675, -1.2367],
      [51.7669, -1.2365],
      [51.7667, -1.2367]
    ],
    actions: ['CNUM3', 'CIPM2', 'AHW7', 'CAHL1', 'BFS1', 'SOH1', 'CIGL1', 'CNUM2', 'AHW3', 'CSAM3'],
    color: '#6B8E23'
  },
  'south-slope': {
    name: 'South Slope',
    osRef: 'SP 472 428',
    numParcels: 11,
    totalArea: '9.6721',
    availableArea: '9.6721',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7613, -1.2392],
      [51.7616, -1.2368],
      [51.7608, -1.2365],
      [51.7601, -1.2369],
      [51.7600, -1.2390],
      [51.7605, -1.2393]
    ],
    actions: ['SOH1', 'PRF1', 'CNUM3', 'AHW3', 'CAHL2', 'CSAM2', 'BFS1', 'CIPM2'],
    color: '#DAA520'
  },
  'mill-field': {
    name: 'Mill Field',
    osRef: 'SP 488 431',
    numParcels: 9,
    totalArea: '7.1358',
    availableArea: '7.1358',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7642, -1.2337],
      [51.7650, -1.2340],
      [51.7655, -1.2337],
      [51.7655, -1.2320],
      [51.7645, -1.2318],
      [51.7638, -1.2323]
    ],
    actions: ['CSAM2', 'CNUM2', 'BFS1', 'AHW7', 'CIPM2', 'SOH1', 'CAHL1', 'CIGL1', 'CSAM3'],
    color: '#BC8F8F'
  },
  'spring-field': {
    name: 'Spring Field',
    osRef: 'SP 475 438',
    numParcels: 8,
    totalArea: '8.9234',
    availableArea: '8.9234',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7600, -1.2390],
      [51.7600, -1.2369],
      [51.7593, -1.2366],
      [51.7586, -1.2370],
      [51.7585, -1.2388],
      [51.7592, -1.2391]
    ],
    actions: ['CNUM3', 'CAHL1', 'BFS1', 'CIPM2'],
    color: '#98FB98'
  },
  'hollow-meadow': {
    name: 'Hollow Meadow',
    osRef: 'SP 473 436',
    numParcels: 12,
    totalArea: '14.5678',
    availableArea: '14.5678',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7585, -1.2388],
      [51.7586, -1.2370],
      [51.7579, -1.2367],
      [51.7572, -1.2371],
      [51.7571, -1.2386],
      [51.7578, -1.2389]
    ],
    actions: ['CSAM2', 'BFS1', 'AHW7', 'CAHL2', 'SOH1'],
    color: '#90EE90'
  },
  'brook-pasture': {
    name: 'Brook Pasture',
    osRef: 'SP 479 440',
    numParcels: 6,
    totalArea: '6.3421',
    availableArea: '6.3421',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7593, -1.2366],
      [51.7600, -1.2369],
      [51.7605, -1.2364],
      [51.7605, -1.2347],
      [51.7598, -1.2344],
      [51.7591, -1.2348]
    ],
    actions: ['CNUM2', 'CIGL1', 'CAHL1', 'PRF1'],
    color: '#87CEEB'
  },
  'willow-grove': {
    name: 'Willow Grove',
    osRef: 'SP 471 434',
    numParcels: 10,
    totalArea: '11.7654',
    availableArea: '11.7654',
    numActions: 1,
    location: 'oxfordshire',
    coords: [
      [51.7571, -1.2386],
      [51.7572, -1.2371],
      [51.7565, -1.2368],
      [51.7558, -1.2372],
      [51.7557, -1.2384],
      [51.7564, -1.2387]
    ],
    actions: ['AHW3', 'CAHL1', 'CSAM3', 'BFS1', 'CIPM2'],
    color: '#DEB887'
  },
  'boundary-meadow': {
    name: 'Boundary Meadow',
    osRef: 'SP 485 442',
    numParcels: 9,
    totalArea: '9.8765',
    availableArea: '9.8765',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7605, -1.2347],
      [51.7605, -1.2364],
      [51.7613, -1.2367],
      [51.7618, -1.2362],
      [51.7618, -1.2345],
      [51.7611, -1.2342]
    ],
    actions: ['CNUM3', 'SOH1', 'CAHL2', 'CSAM2', 'BFS1'],
    color: '#F4A460'
  },
  'valley-pasture': {
    name: 'Valley Pasture',
    osRef: 'SP 469 444',
    numParcels: 11,
    totalArea: '13.2341',
    availableArea: '13.2341',
    numActions: 1,
    location: 'oxfordshire',
    coords: [
      [51.7618, -1.2345],
      [51.7618, -1.2362],
      [51.7625, -1.2365],
      [51.7630, -1.2360],
      [51.7630, -1.2343],
      [51.7623, -1.2340]
    ],
    actions: ['BFS1', 'CAHL1', 'CIGL1', 'CSAM2', 'AHW7'],
    color: '#228B22'
  },
  'back-field': {
    name: 'Back Field',
    osRef: 'SP 491 446',
    numParcels: 7,
    totalArea: '7.4521',
    availableArea: '7.4521',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7557, -1.2384],
      [51.7558, -1.2372],
      [51.7551, -1.2369],
      [51.7544, -1.2373],
      [51.7543, -1.2382],
      [51.7550, -1.2385]
    ],
    actions: ['CNUM3', 'CAHL2', 'BFS1', 'SOH1'],
    color: '#DAA520'
  },
  'lane-close': {
    name: 'Lane Close',
    osRef: 'SP 467 432',
    numParcels: 5,
    totalArea: '4.8945',
    availableArea: '4.8945',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7565, -1.2368],
      [51.7572, -1.2371],
      [51.7579, -1.2367],
      [51.7579, -1.2352],
      [51.7572, -1.2349],
      [51.7565, -1.2353]
    ],
    actions: ['CAHL1', 'PRF1', 'CNUM3'],
    color: '#F0E68C'
  },
  'gate-pasture': {
    name: 'Gate Pasture',
    osRef: 'SP 493 440',
    numParcels: 10,
    totalArea: '12.1098',
    availableArea: '12.1098',
    numActions: 1,
    location: 'oxfordshire',
    coords: [
      [51.7598, -1.2344],
      [51.7605, -1.2347],
      [51.7611, -1.2342],
      [51.7611, -1.2325],
      [51.7604, -1.2322],
      [51.7596, -1.2327]
    ],
    actions: ['BFS1', 'CSAM2', 'CAHL2', 'CIGL1', 'SOH1'],
    color: '#B0C4DE'
  },
  'orchard-field': {
    name: 'Orchard Field',
    osRef: 'SP 465 430',
    numParcels: 6,
    totalArea: '6.7654',
    availableArea: '6.7654',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7543, -1.2382],
      [51.7544, -1.2373],
      [51.7537, -1.2370],
      [51.7530, -1.2374],
      [51.7529, -1.2380],
      [51.7536, -1.2383]
    ],
    actions: ['CNUM2', 'AHW3', 'CAHL1', 'CIPM2'],
    color: '#DDA0DD'
  },
  'church-meadow': {
    name: 'Church Meadow',
    osRef: 'SP 495 438',
    numParcels: 8,
    totalArea: '9.5432',
    availableArea: '9.5432',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7611, -1.2325],
      [51.7611, -1.2342],
      [51.7618, -1.2345],
      [51.7623, -1.2340],
      [51.7623, -1.2323],
      [51.7616, -1.2320]
    ],
    actions: ['CAHL2', 'BFS1', 'SOH1', 'CSAM2'],
    color: '#F08080'
  },
  'new-pasture': {
    name: 'New Pasture',
    osRef: 'SP 463 433',
    numParcels: 7,
    totalArea: '8.2341',
    availableArea: '8.2341',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7551, -1.2369],
      [51.7558, -1.2372],
      [51.7565, -1.2368],
      [51.7565, -1.2353],
      [51.7558, -1.2350],
      [51.7551, -1.2354]
    ],
    actions: ['CNUM3', 'CIPM2', 'CAHL1', 'AHW7'],
    color: '#9ACD32'
  },
  'chalk-field': {
    name: 'Chalk Field',
    osRef: 'SP 497 436',
    numParcels: 10,
    totalArea: '11.4521',
    availableArea: '11.4521',
    numActions: 1,
    location: 'oxfordshire',
    coords: [
      [51.7623, -1.2323],
      [51.7623, -1.2340],
      [51.7630, -1.2343],
      [51.7635, -1.2338],
      [51.7635, -1.2321],
      [51.7628, -1.2318]
    ],
    actions: ['CSAM2', 'BFS1', 'CAHL1', 'CIGL1', 'CNUM2'],
    color: '#FFE4B5'
  },
  'elm-grove': {
    name: 'Elm Grove',
    osRef: 'SP 461 431',
    numParcels: 5,
    totalArea: '5.9876',
    availableArea: '5.9876',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7537, -1.2370],
      [51.7544, -1.2373],
      [51.7551, -1.2369],
      [51.7551, -1.2354],
      [51.7544, -1.2351],
      [51.7537, -1.2355]
    ],
    actions: ['AHW3', 'CAHL1', 'PRF1'],
    color: '#FFDAB9'
  },
  'pond-meadow': {
    name: 'Pond Meadow',
    osRef: 'SP 499 434',
    numParcels: 7,
    totalArea: '7.6543',
    availableArea: '7.6543',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7604, -1.2322],
      [51.7611, -1.2325],
      [51.7616, -1.2320],
      [51.7616, -1.2305],
      [51.7609, -1.2302],
      [51.7602, -1.2307]
    ],
    actions: ['BFS1', 'CIPM2', 'CAHL2', 'SOH1'],
    color: '#E0FFFF'
  },
  'corner-close': {
    name: 'Corner Close',
    osRef: 'SP 459 429',
    numParcels: 6,
    totalArea: '6.1234',
    availableArea: '6.1234',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7529, -1.2380],
      [51.7530, -1.2374],
      [51.7523, -1.2371],
      [51.7516, -1.2375],
      [51.7515, -1.2378],
      [51.7522, -1.2381]
    ],
    actions: ['CIPM2', 'CAHL1', 'CNUM2'],
    color: '#7FFFD4'
  },
  'far-pasture': {
    name: 'Far Pasture',
    osRef: 'SP 501 432',
    numParcels: 8,
    totalArea: '9.3421',
    availableArea: '9.3421',
    numActions: 0,
    location: 'oxfordshire',
    coords: [
      [51.7616, -1.2305],
      [51.7616, -1.2320],
      [51.7623, -1.2323],
      [51.7628, -1.2318],
      [51.7628, -1.2303],
      [51.7621, -1.2300]
    ],
    actions: ['BFS1', 'CAHL2', 'CSAM2', 'SOH1', 'CIGL1'],
    color: '#BC8F8F'
  },
  // Blackberry Farm parcels (approximately 50 miles east)
  'north-field-bucks': {
    name: 'North Field',
    osRef: 'SP 892 524',
    numParcels: 18,
    totalArea: '95.4231',
    availableArea: '95.4231',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9520, -0.7577],
      [51.9520, -0.7547],
      [51.9512, -0.7545],
      [51.9507, -0.7549],
      [51.9505, -0.7575],
      [51.9510, -0.7578]
    ],
    actions: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2'],
    color: '#8FBC8F'
  },
  'eastern-meadow': {
    name: 'Eastern Meadow',
    osRef: 'SP 895 526',
    numParcels: 12,
    totalArea: '78.5624',
    availableArea: '78.5624',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9532, -0.7578],
      [51.9532, -0.7548],
      [51.9527, -0.7546],
      [51.9520, -0.7547],
      [51.9520, -0.7577],
      [51.9525, -0.7579]
    ],
    actions: ['CNUM3', 'CAHL1', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1'],
    color: '#DEB887'
  },
  'spring-pasture': {
    name: 'Spring Pasture',
    osRef: 'SP 898 528',
    numParcels: 10,
    totalArea: '64.3215',
    availableArea: '44.3215',
    numActions: 1,
    location: 'buckinghamshire',
    coords: [
      [51.9544, -0.7579],
      [51.9544, -0.7549],
      [51.9539, -0.7547],
      [51.9532, -0.7548],
      [51.9532, -0.7578],
      [51.9537, -0.7580]
    ],
    actions: ['CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'SOH1', 'CIGL1', 'AHW3', 'CNUM3'],
    color: '#228B22'
  },
  'brook-field': {
    name: 'Brook Field',
    osRef: 'SP 890 519',
    numParcels: 14,
    totalArea: '52.7841',
    availableArea: '32.7841',
    numActions: 1,
    location: 'buckinghamshire',
    coords: [
      [51.9505, -0.7575],
      [51.9507, -0.7549],
      [51.9500, -0.7546],
      [51.9493, -0.7550],
      [51.9490, -0.7574],
      [51.9497, -0.7577]
    ],
    actions: ['CNUM2', 'CIGL1', 'CSAM3', 'CAHL1', 'BFS1', 'AHW7', 'CIPM2', 'SOH1', 'PRF1'],
    color: '#90EE90'
  },
  'valley-bottom': {
    name: 'Valley Bottom',
    osRef: 'SP 893 526',
    numParcels: 16,
    totalArea: '88.9423',
    availableArea: '60.9423',
    numActions: 2,
    location: 'buckinghamshire',
    coords: [
      [51.9520, -0.7547],
      [51.9527, -0.7546],
      [51.9527, -0.7513],
      [51.9519, -0.7510],
      [51.9512, -0.7513],
      [51.9512, -0.7545]
    ],
    actions: ['BFS1', 'CAHL1', 'CAHL2', 'CIPM2', 'CNUM2', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1'],
    color: '#87CEEB'
  },
  'corner-paddock': {
    name: 'Corner Paddock',
    osRef: 'SP 901 521',
    numParcels: 4,
    totalArea: '18.5673',
    availableArea: '18.5673',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9500, -0.7546],
      [51.9507, -0.7549],
      [51.9512, -0.7545],
      [51.9512, -0.7513],
      [51.9505, -0.7510],
      [51.9498, -0.7514]
    ],
    actions: ['CIGL1', 'CNUM2', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CSAM3', 'PRF1'],
    color: '#98FB98'
  },
  'chalk-slope': {
    name: 'Chalk Slope',
    osRef: 'SP 887 518',
    numParcels: 9,
    totalArea: '55.3287',
    availableArea: '55.3287',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9490, -0.7574],
      [51.9493, -0.7550],
      [51.9485, -0.7547],
      [51.9478, -0.7551],
      [51.9477, -0.7572],
      [51.9482, -0.7575]
    ],
    actions: ['SOH1', 'PRF1', 'CNUM3', 'AHW3', 'CAHL2', 'CSAM2', 'BFS1', 'CIPM2'],
    color: '#DAA520'
  },
  'woodland-edge': {
    name: 'Woodland Edge',
    osRef: 'SP 904 524',
    numParcels: 5,
    totalArea: '28.4516',
    availableArea: '28.4516',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9498, -0.7514],
      [51.9505, -0.7510],
      [51.9512, -0.7513],
      [51.9512, -0.7500],
      [51.9505, -0.7497],
      [51.9498, -0.7500]
    ],
    actions: ['CNUM3', 'CSAM3', 'PRF1', 'AHW3', 'CIPM2', 'BFS1', 'CAHL1'],
    color: '#D2B48C'
  },
  'river-meadow': {
    name: 'River Meadow',
    osRef: 'SP 883 517',
    numParcels: 11,
    totalArea: '67.3421',
    availableArea: '67.3421',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9477, -0.7572],
      [51.9477, -0.7552],
      [51.9470, -0.7549],
      [51.9463, -0.7553],
      [51.9461, -0.7570],
      [51.9468, -0.7573]
    ],
    actions: ['CAHL1', 'BFS1', 'CIPM2', 'CNUM2', 'AHW7'],
    color: '#98FB98'
  },
  'barn-field': {
    name: 'Barn Field',
    osRef: 'SP 888 523',
    numParcels: 9,
    totalArea: '45.2187',
    availableArea: '45.2187',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9477, -0.7552],
      [51.9485, -0.7548],
      [51.9488, -0.7525],
      [51.9481, -0.7522],
      [51.9473, -0.7526],
      [51.9470, -0.7549]
    ],
    actions: ['CNUM3', 'CAHL2', 'CSAM2', 'SOH1'],
    color: '#F0E68C'
  },
  'oak-grove': {
    name: 'Oak Grove',
    osRef: 'SP 881 515',
    numParcels: 6,
    totalArea: '32.6543',
    availableArea: '32.6543',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9461, -0.7570],
      [51.9463, -0.7553],
      [51.9456, -0.7550],
      [51.9449, -0.7554],
      [51.9447, -0.7568],
      [51.9454, -0.7571]
    ],
    actions: ['AHW3', 'CIGL1', 'CAHL1', 'PRF1', 'BFS1'],
    color: '#B0C4DE'
  },
  'lower-pasture': {
    name: 'Lower Pasture',
    osRef: 'SP 900 529',
    numParcels: 13,
    totalArea: '71.8932',
    availableArea: '71.8932',
    numActions: 1,
    location: 'buckinghamshire',
    coords: [
      [51.9544, -0.7549],
      [51.9539, -0.7547],
      [51.9532, -0.7548],
      [51.9527, -0.7546],
      [51.9527, -0.7513],
      [51.9544, -0.7516]
    ],
    actions: ['BFS1', 'CNUM2', 'CIPM2', 'CSAM3', 'CAHL1', 'AHW7'],
    color: '#9ACD32'
  },
  'mill-meadow': {
    name: 'Mill Meadow',
    osRef: 'SP 902 527',
    numParcels: 10,
    totalArea: '58.4521',
    availableArea: '58.4521',
    numActions: 2,
    location: 'buckinghamshire',
    coords: [
      [51.9544, -0.7516],
      [51.9527, -0.7513],
      [51.9519, -0.7510],
      [51.9515, -0.7495],
      [51.9522, -0.7490],
      [51.9544, -0.7493]
    ],
    actions: ['CAHL2', 'CSAM2', 'BFS1', 'CIPM2', 'SOH1', 'CIGL1'],
    color: '#FFE4B5'
  },
  'church-field': {
    name: 'Church Field',
    osRef: 'SP 879 520',
    numParcels: 8,
    totalArea: '36.9876',
    availableArea: '36.9876',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9463, -0.7553],
      [51.9470, -0.7549],
      [51.9473, -0.7526],
      [51.9466, -0.7523],
      [51.9459, -0.7527],
      [51.9456, -0.7550]
    ],
    actions: ['CSAM2', 'BFS1', 'CIPM2', 'SOH1', 'CAHL2'],
    color: '#F08080'
  },
  'pond-close': {
    name: 'Pond Close',
    osRef: 'SP 897 532',
    numParcels: 5,
    totalArea: '29.3214',
    availableArea: '29.3214',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9447, -0.7568],
      [51.9449, -0.7554],
      [51.9442, -0.7551],
      [51.9435, -0.7555],
      [51.9433, -0.7566],
      [51.9440, -0.7569]
    ],
    actions: ['AHW3', 'CAHL1', 'PRF1', 'CNUM2'],
    color: '#87CEEB'
  },
  'upper-slope': {
    name: 'Upper Slope',
    osRef: 'SP 899 533',
    numParcels: 10,
    totalArea: '54.6789',
    availableArea: '54.6789',
    numActions: 1,
    location: 'buckinghamshire',
    coords: [
      [51.9556, -0.7580],
      [51.9556, -0.7550],
      [51.9549, -0.7548],
      [51.9544, -0.7549],
      [51.9544, -0.7579],
      [51.9551, -0.7581]
    ],
    actions: ['CNUM3', 'BFS1', 'CIPM2', 'CAHL1', 'CSAM3'],
    color: '#FFDAB9'
  },
  'boundary-field': {
    name: 'Boundary Field',
    osRef: 'SP 895 530',
    numParcels: 9,
    totalArea: '48.5432',
    availableArea: '48.5432',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9544, -0.7579],
      [51.9544, -0.7549],
      [51.9539, -0.7547],
      [51.9532, -0.7548],
      [51.9532, -0.7578],
      [51.9537, -0.7580]
    ],
    actions: ['CAHL2', 'CSAM2', 'AHW7', 'SOH1', 'CIGL1'],
    color: '#E0FFFF'
  },
  'lane-meadow': {
    name: 'Lane Meadow',
    osRef: 'SP 893 527',
    numParcels: 11,
    totalArea: '62.1098',
    availableArea: '62.1098',
    numActions: 1,
    location: 'buckinghamshire',
    coords: [
      [51.9532, -0.7578],
      [51.9532, -0.7548],
      [51.9527, -0.7546],
      [51.9520, -0.7547],
      [51.9520, -0.7577],
      [51.9525, -0.7579]
    ],
    actions: ['CNUM2', 'BFS1', 'CIPM2', 'CAHL1', 'AHW3', 'PRF1'],
    color: '#ADFF2F'
  },
  'ash-copse': {
    name: 'Ash Copse',
    osRef: 'SP 905 525',
    numParcels: 7,
    totalArea: '38.7654',
    availableArea: '38.7654',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9544, -0.7493],
      [51.9556, -0.7494],
      [51.9558, -0.7475],
      [51.9550, -0.7472],
      [51.9544, -0.7475],
      [51.9542, -0.7485]
    ],
    actions: ['CNUM3', 'CSAM3', 'AHW3', 'CAHL1'],
    color: '#D2691E'
  },
  'home-paddock': {
    name: 'Home Paddock',
    osRef: 'SP 891 522',
    numParcels: 6,
    totalArea: '33.4521',
    availableArea: '33.4521',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9498, -0.7500],
      [51.9505, -0.7497],
      [51.9512, -0.7500],
      [51.9512, -0.7485],
      [51.9505, -0.7482],
      [51.9498, -0.7485]
    ],
    actions: ['CIPM2', 'BFS1', 'CAHL2', 'SOH1'],
    color: '#FFC0CB'
  },
  'gate-field': {
    name: 'Gate Field',
    osRef: 'SP 901 528',
    numParcels: 8,
    totalArea: '44.8800',
    availableArea: '39.8100',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9556, -0.7550],
      [51.9549, -0.7548],
      [51.9544, -0.7549],
      [51.9544, -0.7516],
      [51.9551, -0.7514],
      [51.9556, -0.7517]
    ],
    actions: ['CNUM2', 'CSAM2', 'CAHL1', 'AHW7', 'CIGL1'],
    color: '#CD853F'
  },
  'beech-wood': {
    name: 'Beech Wood',
    osRef: 'SP 907 524',
    numParcels: 7,
    totalArea: '39.8765',
    availableArea: '39.8765',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9558, -0.7475],
      [51.9565, -0.7477],
      [51.9567, -0.7460],
      [51.9560, -0.7458],
      [51.9553, -0.7460],
      [51.9550, -0.7472]
    ],
    actions: ['CNUM3', 'AHW3', 'CAHL1', 'CSAM3'],
    color: '#556B2F'
  },
  'orchard-plot': {
    name: 'Orchard Plot',
    osRef: 'SP 875 519',
    numParcels: 6,
    totalArea: '35.4321',
    availableArea: '35.4321',
    numActions: 0,
    location: 'buckinghamshire',
    coords: [
      [51.9449, -0.7554],
      [51.9456, -0.7550],
      [51.9459, -0.7527],
      [51.9452, -0.7524],
      [51.9445, -0.7528],
      [51.9442, -0.7551]
    ],
    actions: ['CIPM2', 'CAHL1', 'SOH1', 'PRF1'],
    color: '#FFB6C1'
  },
  'new-ground': {
    name: 'New Ground',
    osRef: 'SP 903 526',
    numParcels: 9,
    totalArea: '49.7654',
    availableArea: '49.7654',
    numActions: 1,
    location: 'buckinghamshire',
    coords: [
      [51.9556, -0.7517],
      [51.9551, -0.7514],
      [51.9544, -0.7516],
      [51.9544, -0.7493],
      [51.9551, -0.7491],
      [51.9556, -0.7494]
    ],
    actions: ['CNUM2', 'BFS1', 'CSAM2', 'CIPM2', 'CAHL2'],
    color: '#F5DEB3'
  },
  'far-meadow': {
    name: 'Far Meadow',
    osRef: 'SP 909 531',
    numParcels: 10,
    totalArea: '56.3200',
    availableArea: '56.3200',
    numActions: 2,
    location: 'buckinghamshire',
    coords: [
      [51.9433, -0.7566],
      [51.9435, -0.7555],
      [51.9428, -0.7552],
      [51.9421, -0.7556],
      [51.9419, -0.7564],
      [51.9426, -0.7567]
    ],
    actions: ['CAHL1', 'BFS1', 'AHW7', 'CIPM2', 'CSAM3', 'SOH1'],
    color: '#DA70D6'
  }
};

var BASE_LAYOUT_CENTERS = {
  oxfordshire: [51.7650, -1.2375],
  buckinghamshire: [51.9525, -0.7520]
};

function cloneFarmParcels(config) {
  var sourceCenter = BASE_LAYOUT_CENTERS[config.sourceLocation];
  if (!sourceCenter) {
    return;
  }

  var latOffset = config.center[0] - sourceCenter[0];
  var lngOffset = config.center[1] - sourceCenter[1];

  var sourceParcelIds = Object.keys(parcelData).filter(function(parcelId) {
    return parcelData[parcelId].location === config.sourceLocation;
  });

  sourceParcelIds.forEach(function(sourceParcelId) {
    var sourceParcel = parcelData[sourceParcelId];
    var clonedParcel = JSON.parse(JSON.stringify(sourceParcel));
    var clonedParcelId = config.idPrefix + '-' + sourceParcelId;

    clonedParcel.location = config.location;
    clonedParcel.name = config.parcelNamePrefix + ' ' + sourceParcel.name;
    clonedParcel.numActions = 0;
    clonedParcel.coords = sourceParcel.coords.map(function(point) {
      return [
        Number((point[0] + latOffset).toFixed(4)),
        Number((point[1] + lngOffset).toFixed(4))
      ];
    });

    parcelData[clonedParcelId] = clonedParcel;
  });
}

Object.keys(parcelData).forEach(function(parcelId) {
  if (parcelData[parcelId].location !== 'buckinghamshire') {
    delete parcelData[parcelId];
  }
});

if (window.SfiGrasslandsV3ParcelReference &&
    typeof window.SfiGrasslandsV3ParcelReference.applyToParcelData === 'function') {
  window.SfiGrasslandsV3ParcelReference.applyToParcelData(parcelData);
}


var ACTION_CATALOG =
  window.SFI_SCHEME_2026 && Array.isArray(window.SFI_SCHEME_2026.actions)
    ? window.SFI_SCHEME_2026.actions.slice()
    : [];

if (window.SFI_GRASSLANDS_V2_MVP_ACTIONS && typeof window.SFI_GRASSLANDS_V2_MVP_ACTIONS.filterCatalog === 'function') {
  ACTION_CATALOG = window.SFI_GRASSLANDS_V2_MVP_ACTIONS.filterCatalog(ACTION_CATALOG);
}

var ACTION_GUIDANCE_URL_OVERRIDES =
  window.SFI_SCHEME_2026 && window.SFI_SCHEME_2026.guidanceUrlOverrides
    ? window.SFI_SCHEME_2026.guidanceUrlOverrides
    : {
        AGF1: 'https://www.gov.uk/find-funding-for-land-or-farms/cagf4-manage-very-low-density-in-field-agroforestry-on-more-sensitive-land'
      };

function slugifyGuidanceValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getActionGuidanceUrl(action) {
  if (window.SFI_SCHEME_2026 && typeof window.SFI_SCHEME_2026.getActionGuidanceUrl === 'function') {
    return window.SFI_SCHEME_2026.getActionGuidanceUrl(action, ACTION_GUIDANCE_URL_OVERRIDES);
  }

  var code = (action && action.code ? String(action.code) : '').toUpperCase();
  if (!code) {
    return 'https://www.gov.uk/find-funding-for-land-or-farms';
  }

  if (ACTION_GUIDANCE_URL_OVERRIDES[code]) {
    return ACTION_GUIDANCE_URL_OVERRIDES[code];
  }

  var nameSlug = slugifyGuidanceValue(action && action.name ? action.name : '');
  if (!nameSlug) {
    return 'https://www.gov.uk/find-funding-for-land-or-farms';
  }

  return 'https://www.gov.uk/find-funding-for-land-or-farms/' + code.toLowerCase() + '-' + nameSlug;
}

function formatPaymentRatePlainEnglish(rateText) {
  if (typeof rateText !== 'string' || !rateText.trim()) {
    return '';
  }

  var text = rateText.trim();
  var amountMatch = text.match(/£\s*[\d,]+(?:\.\d+)?/);
  var amount = amountMatch ? amountMatch[0].replace(/\s+/g, '') : null;
  var lower = text.toLowerCase();
  var sideNote = '';

  if (/\(one side\)/i.test(text)) {
    sideNote = ' (one side)';
  } else if (/\(both sides\)/i.test(text)) {
    sideNote = ' (both sides)';
  }

  if (!amount) {
    return text;
  }

  if (lower.indexOf('/pond') !== -1) {
    return amount + ' per pond each year';
  }

  if (lower.indexOf('/ha') !== -1) {
    return amount + ' per hectare each year';
  }

  if (lower.indexOf('/100m') !== -1) {
    return amount + ' per 100 metres' + sideNote + ' each year';
  }

  if (lower.indexOf('/m') !== -1 && lower.indexOf('/100m') === -1 && lower.indexOf('sq m') === -1) {
    return amount + ' per metre' + sideNote + ' each year';
  }

  if (lower.indexOf('/plot') !== -1) {
    return amount + ' per plot each year';
  }

  if (lower.indexOf('/t') !== -1) {
    return amount + ' per tonne each year';
  }

  if (lower.indexOf('sq m') !== -1 || lower.indexOf('/sq m') !== -1) {
    return amount + ' per square metre each year';
  }

  return text;
}

function extractHaRateValue(rateText) {
  if (typeof rateText !== 'string' || rateText.toLowerCase().indexOf('/ha') === -1) {
    return null;
  }

  var cleaned = rateText.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

function extractRateAmount(rateText) {
  if (typeof rateText !== 'string') {
    return null;
  }

  var cleaned = rateText.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

var paymentRates = ACTION_CATALOG.reduce(function(lookup, action) {
  var amount = extractHaRateValue(action.rateText);
  if (amount !== null) {
    lookup[action.code] = amount;
  }
  return lookup;
}, {});

var actionRateTextByCode = ACTION_CATALOG.reduce(function(lookup, action) {
  lookup[action.code] = action.rateText;
  return lookup;
}, {});

function calculateActionYearlyPayment(actionCode, quantity) {
  var normalizedCode = String(actionCode || '').toUpperCase();
  var numericQuantity = Number(quantity);
  var rateText = actionRateTextByCode[normalizedCode] || '';
  var rateAmount = extractRateAmount(rateText);
  var lowerRateText = String(rateText).toLowerCase();

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0 || rateAmount === null) {
    return null;
  }

  if (lowerRateText.indexOf('/pond') !== -1) {
    return numericQuantity * rateAmount;
  }

  if (lowerRateText.indexOf('/ha') !== -1) {
    return numericQuantity * rateAmount;
  }

  if (lowerRateText.indexOf('/100m') !== -1) {
    return (numericQuantity / 100) * rateAmount;
  }

  // HEF1 is £/sq m; other metre actions may be £/m
  if (
    lowerRateText.indexOf('sq m') !== -1 ||
    lowerRateText.indexOf('/m') !== -1
  ) {
    return numericQuantity * rateAmount;
  }

  return null;
}

var actionNameByCode = ACTION_CATALOG.reduce(function(lookup, action) {
  lookup[action.code] = action.name;
  return lookup;
}, {});

var defaultActionOrderByCode = ACTION_CATALOG.reduce(function(lookup, action, index) {
  lookup[action.code] = index;
  return lookup;
}, {});

// SFI 2026 frequently used ranking mapped to this page's action codes.
var frequentlyUsedPriority = [
  'CIPM4',
  'CLIG3',
  'CIPM2',
  'CIPM3',
  'CAHL1',
  'CAHL2',
  'CAHL4',
  'CIGL3',
  'CNUM2',
  'CHRW2',
  'CSAM3'
];

var frequentlyUsedRankByCode = frequentlyUsedPriority.reduce(function(lookup, code, index) {
  lookup[code] = index;
  return lookup;
}, {});

// Object to store all parcel selections
var parcelSelections = {};
var currentAvailableActions = [];
// Prototype feature toggle: CNUM2 has 0 ha left (used by a previous agreement)
var greyOutCnum2Enabled = false;
// Prototype feature toggle: show every MVP action, ignoring land cover / feature gates
var showAllMvpActionsEnabled = false;
var LINEAR_ACTION_CODES = {
  BND1: true,
  BND2: true,
  CHRW1: true,
  CHRW2: true,
  CHRW3: true,
  WBD2: true
};

var SQUARE_METRE_ACTION_CODES = {
  HEF1: true
};

// WBD1 is paid per pond — users enter a count, not a length or area.
// Do not show an "X ponds available" hint or validate against parcel hectares.
var POND_ACTION_CODES = {
  WBD1: true
};

function getQuantityUnitForAction(actionCode) {
  var normalizedCode = String(actionCode || '').toUpperCase();
  if (POND_ACTION_CODES[normalizedCode]) {
    return 'pond';
  }
  if (SQUARE_METRE_ACTION_CODES[normalizedCode]) {
    return 'm²';
  }
  return LINEAR_ACTION_CODES[normalizedCode] ? 'm' : 'ha';
}

function getQuantitySuffixForAction(actionCode) {
  var unit = getQuantityUnitForAction(actionCode);
  return unit === 'pond' ? 'ponds' : unit;
}

function isPondUnit(unit) {
  return unit === 'pond' || unit === 'ponds';
}

function formatPondCount(count) {
  var n = Math.max(0, Math.round(Number(count) || 0));
  return n === 1 ? '1 pond' : n.toLocaleString('en-GB') + ' ponds';
}

// CLIG3 always takes all remaining available hectares — no quantity input
function isWholeRemainingAreaAction(actionCode) {
  return String(actionCode || '').toUpperCase() === 'CLIG3';
}

// Supplements that stack on CLIG3 (compatibility SUPBAS) — shown nested under the base
var CLIG3_SUPPLEMENT_CODES = {
  GRH7: true,
  GRH8: true,
  GRH10: true
};

function isClig3Supplement(actionCode) {
  return !!CLIG3_SUPPLEMENT_CODES[String(actionCode || '').toUpperCase()];
}

function getClig3SupplementActions() {
  return ACTION_CATALOG.filter(function(action) {
    return isClig3Supplement(action.code);
  });
}

function getClig3AppliedQuantityHa() {
  var $clig3Qty = $('#quantity-clig3');
  if (!$clig3Qty.length) {
    return 0;
  }
  var parsed = parseQuantityInput($clig3Qty.val());
  return parsed.valid ? parsed.value : 0;
}

function syncClig3SupplementQuantitiesFromBase() {
  var appliedHa = getClig3AppliedQuantityHa();
  var selected = document.querySelector('input[name="clig3-supplement"]:checked');
  var selectedCode = selected ? String(selected.value || '').toUpperCase() : '';

  getClig3SupplementActions().forEach(function(action) {
    var code = String(action.code || '').toUpperCase();
    var quantityInput = document.getElementById('quantity-' + code.toLowerCase());
    if (!quantityInput) {
      return;
    }
    if (selectedCode === code && appliedHa > 0) {
      quantityInput.value = appliedHa.toFixed(4);
    } else {
      quantityInput.value = '';
    }
  });
}

function getClig3AppliedAreaHintText(appliedHa) {
  var amount = Number(appliedHa);
  var formatted = Number.isFinite(amount)
    ? Math.max(0, amount).toFixed(4)
    : '0.0000';
  return 'Applied to ' + formatted + ' hectares';
}

function mirrorClig3SupplementAvailableHints() {
  var appliedHa = getClig3AppliedQuantityHa();
  var text = getClig3AppliedAreaHintText(appliedHa);

  getClig3SupplementActions().forEach(function(action) {
    var hintEl = getActionAvailableHintEl(action.code);
    if (!hintEl) {
      return;
    }
    hintEl.textContent = text;
    hintEl.hidden = false;
  });
}

function clearClig3SupplementSelections() {
  getClig3SupplementActions().forEach(function(action) {
    var codeLower = String(action.code || '').toLowerCase();
    var checkbox = document.getElementById('action-' + codeLower);
    var quantityInput = document.getElementById('quantity-' + codeLower);
    if (checkbox) {
      checkbox.checked = false;
      checkbox.setAttribute('aria-expanded', 'false');
    }
    if (quantityInput) {
      quantityInput.value = '';
    }
  });
  var noneRadio = document.getElementById('clig3-supplement-none');
  if (noneRadio) {
    noneRadio.checked = true;
  }
}

function syncClig3SupplementCheckboxesFromRadios() {
  var selected = document.querySelector('input[name="clig3-supplement"]:checked');
  var selectedCode = selected ? String(selected.value || '').toUpperCase() : '';

  getClig3SupplementActions().forEach(function(action) {
    var code = String(action.code || '').toUpperCase();
    var codeLower = code.toLowerCase();
    var checkbox = document.getElementById('action-' + codeLower);
    var isSelected = selectedCode === code;

    if (checkbox) {
      checkbox.checked = isSelected;
      checkbox.setAttribute('aria-expanded', isSelected ? 'true' : 'false');
    }
  });
  syncClig3SupplementQuantitiesFromBase();
  mirrorClig3SupplementAvailableHints();
}

function syncClig3SupplementRadiosFromCheckboxes() {
  var selectedCode = '';
  getClig3SupplementActions().forEach(function(action) {
    var checkbox = document.getElementById('action-' + String(action.code || '').toLowerCase());
    if (checkbox && checkbox.checked) {
      selectedCode = String(action.code || '').toUpperCase();
    }
  });

  var radioId = selectedCode
    ? 'clig3-supplement-' + selectedCode.toLowerCase()
    : 'clig3-supplement-none';
  var radio = document.getElementById(radioId);
  if (radio) {
    radio.checked = true;
  }
  syncClig3SupplementCheckboxesFromRadios();
}

function getClig3AvailableHintAmount() {
  var $clig3 = $('input[name="actions"][value="CLIG3"]');
  if ($clig3.length && $clig3.is(':checked')) {
    return 0;
  }
  return getWholeRemainingAreaHa('CLIG3');
}

function getWholeRemainingAreaHa(actionCode) {
  var code = String(actionCode || '').toUpperCase();
  if (!isWholeRemainingAreaAction(code)) {
    return 0;
  }

  if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled() &&
      typeof window.SfiGrasslandsV3Aac.recalculate === 'function') {
    window.SfiGrasslandsV3Aac.syncSelectionsFromDom();
    // Exclude this action's own quantity so "remaining" is the pool it can take
    var quantityInput = document.getElementById('quantity-' + code.toLowerCase());
    var previousValue = quantityInput ? quantityInput.value : '';
    if (quantityInput) {
      quantityInput.value = '';
    }
    window.SfiGrasslandsV3Aac.syncSelectionsFromDom();
    var calculation = window.SfiGrasslandsV3Aac.recalculate();
    if (quantityInput) {
      quantityInput.value = previousValue;
    }
    var match = (calculation.actions || []).filter(function(action) {
      return action.code === code;
    })[0];
    if (!match) {
      return 0;
    }
    // Prefer the pool CLIG3 can take (maxAvailable), not "remaining after itself" (often 0)
    var pool = Number(match.maxAvailable);
    if (!Number.isFinite(pool) || pool <= 0) {
      pool = Number(match.available);
    }
    return Number.isFinite(pool) ? Math.max(0, pool) : 0;
  }

  if (!currentSelectedParcel || !parcelData[currentSelectedParcel]) {
    return 0;
  }
  var parcel = parcelData[currentSelectedParcel];
  var totalAreaHa = parseFloat(parcel.availableArea);
  if (!Number.isFinite(totalAreaHa)) {
    return 0;
  }
  var totals = calculateParcelQuantityTotals();
  // totals.ha includes CLIG3 if already set — subtract it back
  var clig3Value = 0;
  var $clig3Qty = $('#quantity-clig3');
  if ($clig3Qty.length) {
    var parsed = parseQuantityInput($clig3Qty.val());
    if (parsed.valid) {
      clig3Value = parsed.value;
    }
  }
  return Math.max(0, Math.round((totalAreaHa - (totals.ha - clig3Value)) * 10000) / 10000);
}

function syncWholeRemainingAreaAction(actionCode) {
  var code = String(actionCode || '').toUpperCase();
  if (!isWholeRemainingAreaAction(code)) {
    return;
  }

  var codeLower = code.toLowerCase();
  var $checkbox = $('input[name="actions"][value="' + code + '"]');
  var $quantityInput = $('#quantity-' + codeLower);
  var amountEl = document.getElementById('whole-remaining-amount-' + codeLower);
  if (!$checkbox.length || !$quantityInput.length) {
    return;
  }

  if (!$checkbox.is(':checked')) {
    $quantityInput.val('');
    if (amountEl) {
      amountEl.textContent = '0.0000';
    }
    return;
  }

  var remainingHa = getWholeRemainingAreaHa(code);
  $quantityInput.val(remainingHa.toFixed(4));
  if (amountEl) {
    amountEl.textContent = remainingHa.toFixed(4);
  }
}

function syncAllWholeRemainingAreaActions() {
  ['CLIG3'].forEach(function(code) {
    syncWholeRemainingAreaAction(code);
  });
  syncClig3SupplementQuantitiesFromBase();
  mirrorClig3SupplementAvailableHints();
}

function isMetreBasedUnit(unit) {
  return unit === 'm' || unit === 'm²';
}

function getAvailableHintText(actionCode, availableAmount) {
  var unit = getQuantityUnitForAction(actionCode);
  var numericAmount = Number(availableAmount);
  // Pond count is user-declared — never show an available quantity
  if (isPondUnit(unit)) {
    return '';
  }
  // HEF1 building area has no reliable AAC — user enters what they want
  if (unit === 'm²') {
    return '';
  }
  if (isMetreBasedUnit(unit)) {
    var metresValue = Number.isFinite(numericAmount)
      ? Math.max(0, Math.round(numericAmount)).toLocaleString('en-GB')
      : '0';
    return metresValue + ' metres available';
  }

  if (Number.isFinite(numericAmount)) {
    return numericAmount.toFixed(4) + ' hectares available';
  }

  return availableAmount + ' hectares available';
}

function getActionAvailableHintEl(actionCode) {
  return document.getElementById('action-available-hint-' + String(actionCode || '').toLowerCase());
}

function setActionAvailableHint(actionCode, availableAmount) {
  var hintEl = getActionAvailableHintEl(actionCode);
  if (!hintEl) {
    return;
  }
  var unit = getQuantityUnitForAction(actionCode);
  if (isPondUnit(unit) || unit === 'm²') {
    hintEl.textContent = '';
    hintEl.hidden = true;
    return;
  }
  // When AAC is on it owns this hint.
  if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
    return;
  }
  var text = getAvailableHintText(actionCode, availableAmount);
  hintEl.textContent = text;
  hintEl.hidden = !text;
}

function createActionAvailableHint(actionCode) {
  var codeLower = String(actionCode || '').toLowerCase();
  var availableHint = document.createElement('span');
  availableHint.className = 'app-action-available-hint';
  availableHint.id = 'action-available-hint-' + codeLower;
  availableHint.setAttribute('data-action-available-hint', String(actionCode || '').toUpperCase());
  if (isPondUnit(getQuantityUnitForAction(actionCode)) || getQuantityUnitForAction(actionCode) === 'm²') {
    availableHint.hidden = true;
  } else if (isWholeRemainingAreaAction(actionCode)) {
    // CLIG3: show the pool it will take (not a misleading 0.0000 placeholder)
    availableHint.textContent = getAvailableHintText(
      actionCode,
      getWholeRemainingAreaHa(actionCode)
    );
  } else {
    availableHint.textContent = getAvailableHintText(
      actionCode,
      getQuantityUnitForAction(actionCode) === 'ha' ? '0.0000' : 0
    );
  }
  return availableHint;
}

function createClig3FullAreaHint(actionCode) {
  var codeLower = String(actionCode || '').toLowerCase();
  var hint = document.createElement('span');
  hint.className = 'app-action-full-area-hint';
  hint.id = 'action-full-area-hint-' + codeLower;
  hint.textContent = 'This action will use all the available area on this land parcel.';
  return hint;
}

function getLinearAvailableMetres(parcel) {
  var areaHa = Number(parcel && parcel.availableArea);
  if (!Number.isFinite(areaHa) || areaHa <= 0) {
    return 0;
  }

  // Estimate boundary length from area using a square-equivalent perimeter.
  var areaSqM = areaHa * 10000;
  return 4 * Math.sqrt(areaSqM);
}

function getBuildingSquareMetresAvailable(parcel) {
  var areaHa = Number(parcel && parcel.availableArea);
  if (!Number.isFinite(areaHa) || areaHa <= 0) {
    return 0;
  }

  // Prototype: modest traditional building footprint for HEF1.
  return Math.max(50, Math.round(areaHa * 25));
}

function parseQuantityInput(rawValue) {
  var trimmed = String(rawValue || '').trim();

  if (!trimmed) {
    return { valid: false, reason: 'empty' };
  }

  // Allow pasted en-GB values like "1,071" or "1 071" (thousand separators)
  var normalised = trimmed.replace(/,/g, '').replace(/\s/g, '');

  if (!/^\d+(\.\d{1,4})?$/.test(normalised)) {
    return { valid: false, reason: 'format' };
  }

  var value = parseFloat(normalised);

  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, reason: 'zero' };
  }

  return { valid: true, value: value };
}

function hasClearlyInvalidQuantityInput(rawValue) {
  var trimmed = String(rawValue || '').trim();

  if (!trimmed) {
    return false;
  }

  // Commas/spaces are allowed as thousand separators; anything else is clearly invalid
  var withoutSeparators = trimmed.replace(/,/g, '').replace(/\s/g, '');
  if (/[^\d.]/.test(withoutSeparators)) {
    return true;
  }

  var parsed = parseQuantityInput(trimmed);
  return !parsed.valid && parsed.reason === 'zero';
}

function getFormatErrorMessage(unit, reason) {
  if (reason === 'zero') {
    return 'Enter a number greater than 0';
  }

  if (reason === 'whole') {
    return 'Enter a whole number of ponds, for example 1 or 2';
  }

  if (isPondUnit(unit)) {
    return 'Enter a number of ponds, for example 1 or 2';
  }

  if (unit === 'm') {
    return 'Enter a number of metres, for example 100 or 250';
  }

  if (unit === 'm²') {
    return 'Enter a number of square metres, for example 50 or 120';
  }

  return 'Enter a number of hectares, for example 12.5 or 100';
}

function getQuantityCheckbox($quantityInput) {
  var codeLower = ($quantityInput.attr('id') || '').replace('quantity-', '');
  return $('input[name="actions"][value="' + codeLower.toUpperCase() + '"]');
}

function getQuantityErrorsStore($quantityInput) {
  var store = $quantityInput.data('quantityErrors');

  if (!store) {
    store = { format: null, overLimit: null };
    $quantityInput.data('quantityErrors', store);
  }

  return store;
}

function refreshQuantityFieldDisplay($quantityInput) {
  var errors = getQuantityErrorsStore($quantityInput);
  var priority = ['format', 'overLimit'];
  var message = null;

  for (var i = 0; i < priority.length; i++) {
    if (errors[priority[i]]) {
      message = errors[priority[i]];
      break;
    }
  }

  var $formGroup = $quantityInput.closest('.govuk-form-group');
  $formGroup.find('.govuk-error-message').remove();

  if (message) {
    $formGroup.addClass('govuk-form-group--error');
    $quantityInput.addClass('govuk-input--error');
    $formGroup.find('label').first().after(
      '<p class="govuk-error-message" id="error-' + $quantityInput.attr('id') + '"><span class="govuk-visually-hidden">Error:</span> ' + message + '</p>'
    );
  } else {
    $formGroup.removeClass('govuk-form-group--error');
    $quantityInput.removeClass('govuk-input--error');
  }
}

function clearQuantityFieldValidation($quantityInput) {
  $quantityInput.removeData('quantityErrors');
  $quantityInput.removeData('blurred');

  var $formGroup = $quantityInput.closest('.govuk-form-group');
  $formGroup.removeClass('govuk-form-group--error');
  $quantityInput.removeClass('govuk-input--error');
  $formGroup.find('.govuk-error-message').remove();
}

function hideQuantityErrorSummary() {
  var $summary = $('#quantity-error-summary');
  $summary.prop('hidden', true).attr('aria-hidden', 'true');
  $('#quantity-error-summary-list').empty();
}

function showQuantityErrorSummary(summaryErrors) {
  var $list = $('#quantity-error-summary-list');
  $list.empty();

  summaryErrors.forEach(function(item) {
    $list.append(
      '<li><a href="#' + item.fieldId + '">' + item.linkText + '</a></li>'
    );
  });

  var $summary = $('#quantity-error-summary');
  $summary.prop('hidden', false).attr('aria-hidden', 'false');
  $summary[0].focus();
}

function updateQuantityFormatErrors($quantityInput) {
  var $checkbox = getQuantityCheckbox($quantityInput);
  var errors = getQuantityErrorsStore($quantityInput);
  errors.format = null;

  if (!$checkbox.is(':checked')) {
    refreshQuantityFieldDisplay($quantityInput);
    return;
  }

  var unit = $quantityInput.siblings('.govuk-input__suffix').text();
  var parsed = parseQuantityInput($quantityInput.val());

  if (!parsed.valid && parsed.reason !== 'empty') {
    errors.format = getFormatErrorMessage(unit, parsed.reason);
  } else if (parsed.valid && isPondUnit(unit) && !Number.isInteger(parsed.value)) {
    errors.format = getFormatErrorMessage(unit, 'whole');
  }

  refreshQuantityFieldDisplay($quantityInput);
}

function calculateParcelQuantityTotals() {
  var totals = { ha: 0, m: 0, m2: 0, pond: 0 };

  $('input[name="actions"]:checked').each(function() {
    var actionCode = ($(this).val() || '').toString();
    // Stacked supplements use the base action's land — exclude from exclusive ha used
    if (isClig3Supplement(actionCode)) {
      return;
    }
    var $quantityInput = $('#quantity-' + actionCode.toLowerCase());

    if (!$quantityInput.length) {
      return;
    }

    var unit = getQuantityUnitForAction(actionCode);
    var parsed = parseQuantityInput($quantityInput.val());

    if (!parsed.valid) {
      return;
    }

    if (unit === 'ha') {
      totals.ha += parsed.value;
    } else if (unit === 'm') {
      totals.m += parsed.value;
    } else if (unit === 'm²') {
      totals.m2 += parsed.value;
    } else if (unit === 'pond') {
      totals.pond += parsed.value;
    }
  });

  return totals;
}

function getExistingAgreementFieldValue(sourceDl, labelText) {
  if (!sourceDl) {
    return '';
  }
  var rows = sourceDl.querySelectorAll('.govuk-summary-list__row');
  for (var i = 0; i < rows.length; i++) {
    var key = rows[i].querySelector('.govuk-summary-list__key');
    var value = rows[i].querySelector('.govuk-summary-list__value');
    if (!key || !value) {
      continue;
    }
    if ((key.textContent || '').trim() === labelText) {
      return (value.textContent || '').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function getExistingAgreementActionLabels(sourceDl) {
  if (!sourceDl) {
    return [];
  }

  var labels = [];
  sourceDl.querySelectorAll('ul.govuk-list li').forEach(function(item) {
    var text = (item.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) {
      labels.push(text);
    }
  });
  return labels;
}

function appendPreviousAgreementSummaryRow(listEl, keyText, valueText) {
  var row = document.createElement('div');
  row.className = 'govuk-summary-list__row';

  var key = document.createElement('dt');
  key.className = 'govuk-summary-list__key';
  key.textContent = keyText;

  var value = document.createElement('dd');
  value.className = 'govuk-summary-list__value';
  value.textContent = valueText;

  row.appendChild(key);
  row.appendChild(value);
  listEl.appendChild(row);
}

function formatPreviousAgreementsCountSummary(agreementCount) {
  if (agreementCount === 1) {
    return '1 previous agreement';
  }
  return agreementCount + ' previous agreements';
}

function formatPreviousAgreementsDetailsLabel(agreementCount) {
  return 'View ' + agreementCount + ' previous agreement actions';
}

function isActionCodeOnThisPage(code) {
  var normalized = String(code || '').toUpperCase();
  if (!normalized) {
    return false;
  }
  var mvpSet = window.SFI_GRASSLANDS_V2_MVP_ACTIONS && window.SFI_GRASSLANDS_V2_MVP_ACTIONS.codeSet;
  if (mvpSet) {
    return Boolean(mvpSet[normalized]);
  }
  return Boolean(document.querySelector(
    '#actions-checkboxes-container input[name="actions"][value="' + normalized + '"]'
  ));
}

function extractCodeFromPreviousAgreementLabel(label) {
  var match = String(label || '').match(/\(([A-Z][A-Z0-9]*)\)\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

function filterPreviousAgreementLabelsToPageActions(labels) {
  return (labels || []).filter(function(label) {
    var code = extractCodeFromPreviousAgreementLabel(label);
    return code && isActionCodeOnThisPage(code);
  });
}

function updatePreviousAgreementsSummary(parcelId) {
  // Prototype: previous-agreement actions UI removed from this journey
  return;
  var sectionEl = document.getElementById('previous-agreements-section');
  var summaryEl = document.getElementById('previous-agreements-summary');
  var summaryTextEl = document.getElementById('previous-agreements-summary-text');
  var detailsEl = document.getElementById('previous-agreements-details');
  var detailEl = document.getElementById('previous-agreements-detail');
  if (!sectionEl || !summaryEl || !detailsEl || !detailEl) {
    return;
  }

  detailEl.innerHTML = '';
  detailsEl.removeAttribute('open');
  detailsEl.hidden = true;
  sectionEl.hidden = true;
  if (summaryTextEl) {
    summaryTextEl.textContent = 'View previous agreement actions';
  }

  var agreements = [];
  var sourceHeading = document.getElementById('existing-' + parcelId);
  if (sourceHeading) {
    var sourceEl = sourceHeading.nextElementSibling;
    while (sourceEl && sourceEl.tagName === 'DL') {
      agreements.push({
        scheme: getExistingAgreementFieldValue(sourceEl, 'Scheme'),
        endDate: getExistingAgreementFieldValue(sourceEl, 'Agreement end date') ||
          getExistingAgreementFieldValue(sourceEl, 'End date'),
        availableArea: getExistingAgreementFieldValue(sourceEl, 'Available area'),
        actionLabels: getExistingAgreementActionLabels(sourceEl)
      });
      sourceEl = sourceEl.nextElementSibling;
    }
  }

  // Fallback to shared existing-agreements data if accordion markup is missing
  if (!agreements.length && window.SfiGrasslandsV3ExistingAgreements) {
    var fallbackActions = window.SfiGrasslandsV3ExistingAgreements.get(parcelId) || [];
    if (fallbackActions.length) {
      agreements.push({
        scheme: '',
        endDate: '',
        availableArea: '',
        actionLabels: fallbackActions.map(function(action) {
          return window.SfiGrasslandsV3ExistingAgreements.formatLabel(action);
        })
      });
    }
  }

  // Only keep previous-agreement actions that also appear in this page’s action list
  agreements = agreements.map(function(agreement) {
    return {
      scheme: agreement.scheme,
      endDate: agreement.endDate,
      availableArea: agreement.availableArea,
      actionLabels: filterPreviousAgreementLabelsToPageActions(agreement.actionLabels)
    };
  }).filter(function(agreement) {
    return agreement.actionLabels && agreement.actionLabels.length > 0;
  });

  if (!agreements.length) {
    return;
  }

  summaryEl.textContent = formatPreviousAgreementsCountSummary(agreements.length);
  if (summaryTextEl) {
    summaryTextEl.textContent = formatPreviousAgreementsDetailsLabel(agreements.length);
  }
  sectionEl.hidden = false;

  agreements.forEach(function(agreement, index) {
    var list = document.createElement('dl');
    list.className = 'govuk-summary-list';
    if (index > 0) {
      list.className += ' govuk-!-margin-top-4';
    }

    if (agreement.scheme) {
      appendPreviousAgreementSummaryRow(list, 'Scheme', agreement.scheme);
    }
    if (agreement.endDate) {
      appendPreviousAgreementSummaryRow(list, 'Agreement end date', agreement.endDate);
    }
    if (agreement.availableArea) {
      appendPreviousAgreementSummaryRow(list, 'Available area', agreement.availableArea);
    }

    var actionsRow = document.createElement('div');
    actionsRow.className = 'govuk-summary-list__row';

    var actionsKey = document.createElement('dt');
    actionsKey.className = 'govuk-summary-list__key';
    actionsKey.textContent = 'Existing actions';

    var actionsValue = document.createElement('dd');
    actionsValue.className = 'govuk-summary-list__value';

    var actionsList = document.createElement('ul');
    actionsList.className = 'govuk-list';
    agreement.actionLabels.forEach(function(label) {
      var item = document.createElement('li');
      item.textContent = label;
      actionsList.appendChild(item);
    });

    actionsValue.appendChild(actionsList);
    actionsRow.appendChild(actionsKey);
    actionsRow.appendChild(actionsValue);
    list.appendChild(actionsRow);
    detailEl.appendChild(list);
  });

  detailsEl.hidden = false;
}

function resetActionSelectionUiState() {
  $('input[name="actions"]').each(function() {
    var $input = $(this);
    var $item = $input.closest('.govuk-checkboxes__item');
    var actionCode = ($input.val() || '').toString().toLowerCase();
    var $quantityInput = $('#quantity-' + actionCode);
    var $conditional = $('#conditional-' + actionCode);

    $input.prop('checked', false);
    $input.prop('disabled', false);
    $input.attr('aria-expanded', 'false');
    $input.removeAttr('data-disabled-reason');

    $item.css('opacity', '1').removeClass('sfi-compatibility-disabled');
    $item.find('.compatibility-hint, .area-full-hint, .sfi-compatibility-option-hint').remove();

    if ($quantityInput.length) {
      clearQuantityFieldValidation($quantityInput);
      $quantityInput.val('');
    }

    if ($conditional.length) {
      $conditional.addClass('govuk-checkboxes__conditional--hidden');
    }
  });
}

var GOV_AREAS_BY_CODE = {
  'AGF1': ['Agroforestry', 'Trees'],
  'AGF2': ['Agroforestry', 'Trees'],
  'AHW10': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'AHW11': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'AHW2': ['Pollinators', 'Wildlife'],
  'AHW3': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'AHW4': ['Pollinators', 'Wildlife'],
  'AHW5': ['Pollinators', 'Wildlife'],
  'AHW6': ['Pollinators', 'Wildlife'],
  'AHW7': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'AHW8': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'AHW9': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'BFS1': ['Flood prevention', 'Integrated pest management', 'Pollinators', 'Water availability and storage', 'Water quality', 'Wildlife'],
  'BFS6': ['Integrated pest management', 'Pollinators', 'Water quality', 'Wildlife'],
  'BND1': ['Field boundaries'],
  'BND2': ['Field boundaries', 'Flood prevention'],
  'CAHL1': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'CAHL2': ['Horticulture', 'Pollinators', 'Wildlife'],
  'CAHL3': ['Horticulture', 'Integrated pest management', 'Pollinators', 'Wildlife'],
  'CAHL4': ['Flood prevention', 'Horticulture', 'Integrated pest management', 'Pollinators', 'Water quality', 'Wildlife'],
  'CHRW2': ['Field boundaries'],
  'CIGL1': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'CIGL2': ['Pollinators', 'Wildlife'],
  'CIGL3': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'CIPM2': ['Horticulture', 'Integrated pest management', 'Pollinators', 'Wildlife'],
  'CIPM3': ['Horticulture', 'Integrated pest management', 'Pollinators', 'Wildlife'],
  'CIPM4': ['Horticulture', 'Integrated pest management', 'Pollinators', 'Water quality', 'Wildlife'],
  'CLIG3': ['Soil health', 'Water quality'],
  'CNUM2': ['Integrated pest management', 'Nutrient management', 'Water quality'],
  'CNUM3': ['Nutrient management'],
  'CSAM2': ['Horticulture', 'Soil health', 'Water quality'],
  'CSAM3': ['Nutrient management', 'Soil health', 'Water quality'],
  'GRH12': ['Pollinators', 'Wildlife'],
  'GRH10': ['Pollinators', 'Wildlife'],
  'GRH7': ['Pollinators', 'Wildlife'],
  'GRH8': ['Pollinators', 'Wildlife'],
  'HEF6': ['Historic and archaeological features'],
  'OFC1': ['Organic'],
  'OFC2': ['Organic'],
  'OFC3': ['Organic'],
  'OFC4': ['Horticulture', 'Organic'],
  'OFC5': ['Organic'],
  'OFM1': ['Organic'],
  'OFM2': ['Organic'],
  'OFM3': ['Organic'],
  'OFM4': ['Organic'],
  'OFM5': ['Horticulture', 'Organic'],
  'OFM6': ['Horticulture', 'Organic'],
  'PRF1': ['Horticulture', 'Nutrient management', 'Precision farming, equipment and machinery', 'Water quality'],
  'PRF2': ['Horticulture', 'Integrated pest management', 'Precision farming, equipment and machinery', 'Water quality'],
  'PRF4': ['Integrated pest management', 'Precision farming, equipment and machinery'],
  'SCR1': ['Flood prevention', 'Integrated pest management', 'Pollinators', 'Wildlife'],
  'SCR2': ['Integrated pest management', 'Pollinators', 'Wildlife'],
  'SOH1': ['Soil health', 'Water quality'],
  'SOH3': ['Soil health', 'Water quality'],
  'SPM3': ['Livestock management', 'Pollinators', 'Wildlife'],
  'SPM5': ['Livestock management', 'Pollinators', 'Wildlife'],
  'UPL1': ['Livestock management', 'Water quality'],
  'UPL10': ['Flood prevention', 'Livestock management'],
  'UPL2': ['Livestock management', 'Water quality'],
  'UPL3': ['Flood prevention', 'Livestock management', 'Water quality'],
  'UPL5': ['Flood prevention', 'Livestock management'],
  'UPL6': ['Flood prevention', 'Livestock management'],
  'UPL8': ['Flood prevention', 'Livestock management'],
  'WBD1': ['Horticulture', 'Water availability and storage', 'Water quality'],
  'WBD2': ['Water quality'],
  'WBD3': ['Integrated pest management', 'Water quality'],
  'WBD4': ['Water quality'],
  'WBD6': ['Livestock management', 'Water quality'],
  'WBD7': ['Water availability and storage', 'Water quality']
};

var LEGACY_THEME_TO_AREA = {
  'Agroforestry': 'Agroforestry',
  'Boundary Features': 'Field boundaries',
  'Buffer Strips': 'Buffer strips',
  'Farmland Wildlife - Arable/Horticultural': 'Wildlife',
  'Farmland Wildlife - Grassland': 'Wildlife',
  'Heritage': 'Historic and archaeological features',
  'Integrated Pest Management': 'Integrated pest management',
  'Moorland': 'Vegetation control',
  'Nutrient Management': 'Nutrient management',
  'Organic': 'Organic',
  'Precision Farming': 'Precision farming, equipment and machinery',
  'Soil Health': 'Soil health',
  'Species Recovery/Management': 'Species recovery and management',
  'Waterbodies': 'Water quality'
};

var GOV_AREAS_FILTER_ORDER = [
  'Access',
  'Agroforestry',
  'Biodiversity',
  'Buffer strips',
  'Field boundaries',
  'Flood prevention',
  'Historic and archaeological features',
  'Horticulture',
  'Integrated pest management',
  'Livestock management',
  'Nutrient management',
  'Orchards',
  'Organic',
  'Peat',
  'Pollinators',
  'Precision farming, equipment and machinery',
  'Soil health',
  'Species recovery and management',
  'Trees',
  'Vegetation control',
  'Water availability and storage',
  'Water quality',
  'Wildlife'
];

var actionAreasByCode = ACTION_CATALOG.reduce(function(lookup, action) {
  if (GOV_AREAS_BY_CODE[action.code]) {
    lookup[action.code] = GOV_AREAS_BY_CODE[action.code].slice();
  } else {
    var fallbackArea = LEGACY_THEME_TO_AREA[action.theme];
    lookup[action.code] = fallbackArea ? [fallbackArea] : [];
  }
  return lookup;
}, {});

function toAreaFilterId(label) {
  return 'areas-filter-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getAreaOfInterestCounts(actionCodes) {
  var counts = {};

  (actionCodes || []).forEach(function(code) {
    (actionAreasByCode[code] || []).forEach(function(area) {
      counts[area] = (counts[area] || 0) + 1;
    });
  });

  return counts;
}

function updateAreasOfInterestFilterCounts(actionCodes) {
  var container = document.getElementById('areas-of-interest-filters');
  if (!container) {
    return;
  }

  var counts = getAreaOfInterestCounts(actionCodes);

  container.querySelectorAll('input[data-theme-filter]').forEach(function(input) {
    var label = container.querySelector('label[for="' + input.id + '"]');
    var item = input.closest('.govuk-checkboxes__item');
    if (!label || !item) {
      return;
    }

    var area = input.value;
    var count = counts[area] || 0;

    if (count === 0) {
      item.style.display = 'none';
      input.checked = false;
      return;
    }

    item.style.display = '';
    label.textContent = area + ' (' + count + ')';
  });
}

function renderAreasOfInterestFilters() {
  var container = document.getElementById('areas-of-interest-filters');
  if (!container) {
    return;
  }

  var availableLookup = {};
  Object.keys(actionAreasByCode).forEach(function(code) {
    (actionAreasByCode[code] || []).forEach(function(area) {
      availableLookup[area] = true;
    });
  });

  var availableAreas = GOV_AREAS_FILTER_ORDER.filter(function(area) {
    return Boolean(availableLookup[area]);
  });

  var html = availableAreas.map(function(area) {
    var inputId = toAreaFilterId(area);
    return '<div class="govuk-checkboxes__item" style="display: none;">' +
      '<input class="govuk-checkboxes__input" id="' + inputId + '" type="checkbox" value="' + area + '" data-theme-filter>' +
      '<label class="govuk-label govuk-checkboxes__label" for="' + inputId + '">' + area + '</label>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
}

var LAND_COVER_ELIGIBLE_ACTIONS = {
  'Bog': ['OFM3', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Boulders': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Cliffs': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Crops under water': ['OFC4', 'OFM5'],
  'Drain/ditch/dyke': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8', 'WBD2'],
  'Fen marsh & swamp': ['OFM3', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Gallop': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Heaps': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Heath land and bracken - ungrazeable': ['OFM3', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Land lying fallow': ['AGF1', 'AHW10', 'AHW11', 'AHW2', 'AHW3', 'AHW4', 'AHW8', 'AHW9', 'BFS1', 'BFS6', 'BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIPM2', 'CIPM3', 'CNUM3', 'CSAM2', 'CSAM3', 'OFC3', 'OFM4', 'PRF1', 'PRF2', 'PRF4', 'SCR1', 'SCR2', 'SOH1', 'SOH3', 'WBD2', 'WBD3', 'WBD4'],
  'Leguminous and nitrogen fixing crops': ['AGF1', 'AHW10', 'AHW11', 'AHW2', 'AHW3', 'AHW4', 'AHW5', 'AHW8', 'AHW9', 'BFS1', 'BFS6', 'BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIPM2', 'CIPM3', 'CIPM4', 'CNUM3', 'CSAM2', 'CSAM3', 'OFC3', 'OFM1', 'OFM4', 'PRF1', 'PRF2', 'PRF4', 'SOH1', 'SOH3', 'WBD2', 'WBD3', 'WBD4'],
  'Non-agricultural area': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - bracken': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - manmade': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - mixed': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - natural': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - rock': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - scrub': ['BFS6', 'OFM3', 'SCR1', 'SCR2', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Notional - water': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Nurseries': ['BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIPM2', 'CIPM3', 'CIPM4', 'CNUM3', 'CSAM2', 'OFC5', 'OFM6', 'PRF2', 'WBD2'],
  'Other arable crops': ['AGF1', 'AHW10', 'AHW11', 'AHW2', 'AHW3', 'AHW4', 'AHW5', 'AHW6', 'AHW7', 'AHW8', 'AHW9', 'BFS1', 'BFS6', 'BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIPM2', 'CIPM3', 'CIPM4', 'CNUM3', 'CSAM2', 'CSAM3', 'OFC3', 'OFC4', 'OFM4', 'OFM5', 'PRF1', 'PRF2', 'PRF4', 'SCR1', 'SOH1', 'SOH3', 'WBD2', 'WBD3', 'WBD4'],
  'Perennial crops': ['AGF1', 'BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIPM2', 'CIPM3', 'CIPM4', 'CNUM3', 'CSAM2', 'OFC5', 'OFM6', 'PRF1', 'PRF2', 'SOH1', 'SOH3', 'WBD2'],
  'Permanent grassland': ['AGF1', 'BFS6', 'BND1', 'BND2', 'CHRW2', 'CIGL1', 'CIGL2', 'CIGL3', 'CLIG3', 'CNUM2', 'CSAM3', 'GRH7', 'GRH8', 'GRH10', 'GRH12', 'HEF1', 'HEF6', 'OFC1', 'OFC2', 'OFC3', 'OFC4', 'OFM1', 'OFM2', 'OFM3', 'PRF1', 'PRF2', 'SCR2', 'SPM3', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8', 'WBD2', 'WBD6', 'WBD7'],
  'Pond': ['OFM3', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8', 'WBD1', 'WBD2'],
  'Rivers and Streams type 2': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Rivers and Streams type 3': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Rocky outcrop': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Scree': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Scrub - ungrazeable': ['BFS6', 'OFM3', 'SCR1', 'SCR2', 'SPM5', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Shingle': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8'],
  'Short rotation coppice': ['BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIPM2', 'CIPM3', 'CIPM4', 'CNUM3', 'CSAM2', 'OFC5', 'OFM6', 'PRF2', 'WBD2'],
  'Temporary grass': ['AGF1', 'AHW10', 'AHW11', 'AHW2', 'AHW3', 'AHW8', 'AHW9', 'BFS1', 'BFS6', 'BND1', 'BND2', 'CAHL1', 'CAHL2', 'CAHL3', 'CAHL4', 'CHRW2', 'CIGL1', 'CIGL2', 'CIGL3', 'CLIG3', 'CIPM2', 'CIPM3', 'CNUM2', 'CNUM3', 'CSAM2', 'CSAM3', 'GRH7', 'GRH8', 'GRH10', 'GRH12', 'OFC3', 'OFC4', 'OFM4', 'OFM5', 'PRF1', 'PRF2', 'SCR1', 'SCR2', 'SOH1', 'SPM3', 'WBD2', 'WBD3', 'WBD4', 'WBD6'],
  'Track - natural surface': ['OFM3', 'UPL1', 'UPL10', 'UPL2', 'UPL3', 'UPL8']
};

var PARCEL_LAND_COVERS = {
  'lower-field': 'Temporary grass',
  'upper-field': 'Permanent grassland',
  'woods-view': 'Bog',
  'long-meadow': 'Other arable crops',
  'river-pasture': 'Rivers and Streams type 3',
  'top-barn-field': 'Other arable crops',
  'oak-tree-field': 'Permanent grassland',
  'south-slope': 'Temporary grass',
  'mill-field': 'Temporary grass',
  'spring-field': 'Leguminous and nitrogen fixing crops',
  'hollow-meadow': 'Scrub - ungrazeable',
  'brook-pasture': 'Permanent grassland',
  'willow-grove': 'Notional - scrub',
  'boundary-meadow': 'Non-agricultural area',
  'valley-pasture': 'Temporary grass',
  'back-field': 'Land lying fallow',
  'lane-close': 'Rocky outcrop',
  'gate-pasture': 'Temporary grass',
  'orchard-field': 'Perennial crops',
  'church-meadow': 'Permanent grassland',
  'new-pasture': 'Land lying fallow',
  'chalk-field': 'Other arable crops',
  'elm-grove': 'Perennial crops',
  'pond-meadow': 'Pond',
  'corner-close': 'Notional - mixed',
  'far-pasture': 'Permanent grassland',
  'north-field-bucks': 'Other arable crops',
  'eastern-meadow': 'Temporary grass',
  'spring-pasture': 'Leguminous and nitrogen fixing crops',
  'brook-field': 'Rivers and Streams type 2',
  'valley-bottom': 'Permanent grassland',
  'corner-paddock': 'Temporary grass',
  'chalk-slope': 'Land lying fallow',
  'woodland-edge': 'Notional - scrub',
  'river-meadow': 'Rivers and Streams type 3',
  'barn-field': 'Other arable crops',
  'oak-grove': 'Perennial crops',
  'lower-pasture': 'Permanent grassland',
  'mill-meadow': 'Temporary grass',
  // SO3757 3190 — multi-cover so all 16 MVP actions can appear (grassland, scrub, pond/ditch, historic)
  'church-field': ['Permanent grassland', 'Scrub - ungrazeable', 'Pond'],
  'pond-close': 'Pond',
  'upper-slope': 'Land lying fallow',
  'boundary-field': 'Non-agricultural area',
  'lane-meadow': 'Temporary grass',
  'ash-copse': 'Scrub - ungrazeable',
  'home-paddock': 'Notional - mixed',
  'gate-field': ['Permanent grassland', 'Scrub', 'Pond'],
  'beech-wood': 'Notional - natural',
  'orchard-plot': 'Perennial crops',
  'new-ground': 'Land lying fallow',
  'far-meadow': ['Temporary grass', 'Pond']
};

var GENERATED_FARM_LAND_COVER_PROFILES = {
  cedarshire: ['Other arable crops', 'Land lying fallow', 'Leguminous and nitrogen fixing crops', 'Perennial crops', 'Temporary grass'],
  fenlandshire: ['Bog', 'Pond', 'Rivers and Streams type 3', 'Scrub - ungrazeable', 'Notional - scrub', 'Non-agricultural area', 'Rocky outcrop'],
  ridgewayshire: ['Permanent grassland', 'Temporary grass', 'Track - natural surface', 'Notional - natural', 'Rivers and Streams type 2']
};

Object.keys(GENERATED_FARM_LAND_COVER_PROFILES).forEach(function(locationKey) {
  var profile = GENERATED_FARM_LAND_COVER_PROFILES[locationKey];
  var parcelIdsForLocation = Object.keys(parcelData).filter(function(parcelId) {
    return parcelData[parcelId].location === locationKey;
  }).sort();

  parcelIdsForLocation.forEach(function(parcelId, index) {
    PARCEL_LAND_COVERS[parcelId] = profile[index % profile.length];
  });
});

var DEFAULT_LAND_COVER = 'Permanent grassland';

function getParcelLandCovers(landCoverValue) {
  if (Array.isArray(landCoverValue)) {
    return landCoverValue.filter(Boolean);
  }

  if (typeof landCoverValue === 'string' && landCoverValue) {
    return [landCoverValue];
  }

  return [DEFAULT_LAND_COVER];
}

function formatLandCoverDisplay(landCoverValue) {
  var landCovers = getParcelLandCovers(landCoverValue);
  return landCovers.join(', ');
}

function formatHaFourDecimals(value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0.0000';
  }
  return numeric.toFixed(4);
}

function renderLandCoverSummary(el, covers) {
  if (!el) {
    return;
  }

  var list = Array.isArray(covers) ? covers.filter(function(cover) {
    return cover && cover.name;
  }) : [];

  el.textContent = '';

  if (!list.length) {
    el.textContent = '—';
    return;
  }

  if (list.length === 1) {
    el.textContent = list[0].name;
    return;
  }

  list.forEach(function(cover, index) {
    if (index > 0) {
      el.appendChild(document.createElement('br'));
    }
    var ha = cover.ha;
    var line = cover.name;
    if (ha != null && Number.isFinite(Number(ha))) {
      line += ' - ' + formatHaFourDecimals(ha) + ' ha';
    }
    el.appendChild(document.createTextNode(line));
  });
}

function formatParcelReference(parcel) {
  if (window.SfiGrasslandsV3ParcelReference && typeof window.SfiGrasslandsV3ParcelReference.format === 'function') {
    return window.SfiGrasslandsV3ParcelReference.format(parcel)
  }
  if (!parcel) {
    return ''
  }
  return parcel.parcelReference || parcel.osRef || parcel.name || ''
}

var ACTION_FEATURE_REQUIREMENTS = {
  AHW2: ['hasArableLand'],
  AHW4: ['hasArableLand'],
  BND1: ['hasBoundaryFeature'],
  BND2: ['hasBoundaryFeature'],
  CHRW2: ['hasBoundaryFeature', 'hasHedgerow'],
  CIGL1: ['hasGrasslandHabitat'],
  CIGL2: ['hasGrasslandHabitat'],
  CLIG3: ['hasGrasslandHabitat'],
  HEF1: ['hasHistoricAsset'],
  SCR1: ['hasScrubMosaic'],
  SCR2: ['hasScrubMosaic'],
  SPM3: ['hasGrazedHabitat'],
  SPM5: ['hasExtensiveHabitat'],
  WBD1: ['hasPond'],
  WBD2: ['hasDitch']
}; 

var HISTORIC_ASSET_PARCELS = {
  'top-barn-field': true,
  'barn-field': true,
  'church-meadow': true,
  'church-field': true,
  'mill-field': true,
  'mill-meadow': true,
  // SO3757 3193 / 3194 — allow HEF1 so HEFER-required can be tested
  'far-meadow': true,
  'gate-field': true
};

var ARABLE_LAND_COVERS = {
  'Other arable crops': true,
  'Leguminous and nitrogen fixing crops': true,
  'Land lying fallow': true,
  'Temporary grass': true
};

var GRASSLAND_LAND_COVERS = {
  'Permanent grassland': true,
  'Temporary grass': true
};

var EXTENSIVE_HABITAT_LAND_COVERS = {
  'Bog': true,
  'Fen marsh & swamp': true,
  'Heath land and bracken - ungrazeable': true,
  'Notional - scrub': true,
  'Scrub - ungrazeable': true,
  'Permanent grassland': true
};

function getParcelFeatureFlags(parcelId, parcel) {
  var landCovers = getParcelLandCovers(parcel.landCover);
  var parcelName = (parcel.name || '').toLowerCase();

  var hasBoundaryFeature = landCovers.some(function(landCover) {
    return !{
    'Bog': true,
    'Boulders': true,
    'Cliffs': true,
    'Crops under water': true,
    'Heaps': true,
    'Notional - water': true,
    'Pond': true,
    'Rivers and Streams type 2': true,
    'Rivers and Streams type 3': true,
    'Scree': true,
    'Shingle': true
  }[landCover];
  });

  var hasHedgerow = hasBoundaryFeature && landCovers.some(function(landCover) {
    return !!{
      'Land lying fallow': true,
      'Leguminous and nitrogen fixing crops': true,
      'Other arable crops': true,
      'Perennial crops': true,
      'Permanent grassland': true,
      'Short rotation coppice': true,
      'Temporary grass': true
    }[landCover];
  });

  var hasDitch = landCovers.some(function(landCover) {
    return !!{
      'Drain/ditch/dyke': true,
      'Fen marsh & swamp': true,
      'Pond': true,
      'Rivers and Streams type 2': true,
      'Rivers and Streams type 3': true
    }[landCover];
  }) || /brook|river|pond|stone bridge/.test(parcelName);

  var hasPond = landCovers.indexOf('Pond') !== -1 || /pond/.test(parcelName);
  var hasGrasslandHabitat = landCovers.some(function(landCover) {
    return !!GRASSLAND_LAND_COVERS[landCover];
  });
  var hasArableLand = landCovers.some(function(landCover) {
    return !!ARABLE_LAND_COVERS[landCover];
  });
  var hasScrubMosaic = landCovers.some(function(landCover) {
    return !!{
      'Bog': true,
      'Notional - scrub': true,
      'Scrub - ungrazeable': true,
      'Heath land and bracken - ungrazeable': true,
      'Land lying fallow': true
    }[landCover];
  });
  var hasGrazedHabitat = landCovers.some(function(landCover) {
    return !!{
      'Permanent grassland': true,
      'Temporary grass': true,
      'Bog': true
    }[landCover];
  });
  var hasExtensiveHabitat = landCovers.some(function(landCover) {
    return !!EXTENSIVE_HABITAT_LAND_COVERS[landCover];
  });

  return {
    hasArableLand: hasArableLand,
    hasBoundaryFeature: hasBoundaryFeature,
    hasDitch: hasDitch,
    hasExtensiveHabitat: hasExtensiveHabitat,
    hasGrasslandHabitat: hasGrasslandHabitat,
    hasGrazedHabitat: hasGrazedHabitat,
    hasHedgerow: hasHedgerow,
    hasHistoricAsset: !!HISTORIC_ASSET_PARCELS[parcelId],
    hasPond: hasPond,
    hasScrubMosaic: hasScrubMosaic
  };
}

function supportsActionFeatureRequirements(actionCode, features) {
  var requirements = ACTION_FEATURE_REQUIREMENTS[actionCode] || [];
  return requirements.every(function(featureKey) {
    return !!features[featureKey];
  });
}

var actionCodesInCatalog = ACTION_CATALOG.reduce(function(lookup, action) {
  lookup[action.code] = true;
  return lookup;
}, {});

function getEligibleActionsForLandCover(landCover) {
  var eligibleByCode = {};

  getParcelLandCovers(landCover).forEach(function(cover) {
    var codes = LAND_COVER_ELIGIBLE_ACTIONS[cover] || [];
    codes.forEach(function(code) {
      if (actionCodesInCatalog[code]) {
        eligibleByCode[code] = true;
      }
    });
  });

  return Object.keys(eligibleByCode);
}

Object.keys(parcelData).forEach(function(parcelId) {
  var assignedLandCover = PARCEL_LAND_COVERS[parcelId];
  if (assignedLandCover) {
    parcelData[parcelId].landCover = assignedLandCover;
  }

  if (!parcelData[parcelId].landCover) {
    parcelData[parcelId].landCover = DEFAULT_LAND_COVER;
  }

  var parcelFeatures = getParcelFeatureFlags(parcelId, parcelData[parcelId]);
  parcelData[parcelId].actions = getEligibleActionsForLandCover(parcelData[parcelId].landCover).filter(function(code) {
    return supportsActionFeatureRequirements(code, parcelFeatures);
  });
});

var compatibilityConfig = {
  incompatibleByCode: {
    CNUM3: ['CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    CAHL1: ['CNUM3', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    CAHL2: ['CNUM3', 'CAHL1', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'CIGL1', 'AHW3', 'CSAM3', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    CSAM2: ['CNUM3', 'CAHL1', 'CAHL2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'CIGL1', 'AHW3', 'CSAM3', 'CHRW3', 'WBD3', 'GRH12'],
    BFS1: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    AHW7: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'CIPM2', 'CNUM2', 'CIGL1', 'AHW3', 'CSAM3', 'CHRW3', 'WBD3', 'GRH12'],
    CIPM2: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    CNUM2: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    SOH1: ['CNUM3', 'CAHL1', 'BFS1', 'CIPM2', 'CNUM2', 'CIGL1', 'AHW3', 'CSAM3', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    CIGL1: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    AHW3: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    // CLIG3 and CSAM3 share remaining grassland area — not hard-incompatible
    CSAM3: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CHRW3', 'WBD3', 'AHW5', 'GRH12'],
    PRF1: ['CNUM3', 'CAHL1', 'BFS1', 'CIPM2', 'CIGL1', 'AHW3', 'CHRW3', 'WBD3', 'GRH12'],
    CHRW3: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'WBD3', 'AHW5', 'GRH12'],
    WBD3: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'AHW5', 'GRH12'],
    AHW5: ['CNUM3', 'CAHL1', 'CAHL2', 'BFS1', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'CHRW3', 'WBD3', 'GRH12'],
    GRH12: ['CNUM3', 'CAHL1', 'CAHL2', 'CSAM2', 'BFS1', 'AHW7', 'CIPM2', 'CNUM2', 'SOH1', 'CIGL1', 'AHW3', 'CSAM3', 'PRF1', 'CHRW3', 'WBD3', 'AHW5']
  }
};

var matrixCompatibilityConfig = null;
var compatibilityConfigElement = document.getElementById('compatibility-client-config');
if (compatibilityConfigElement) {
  try {
    matrixCompatibilityConfig = JSON.parse(compatibilityConfigElement.textContent || '{}');
  } catch (error) {
    matrixCompatibilityConfig = null;
  }
}
if (matrixCompatibilityConfig && matrixCompatibilityConfig.incompatibleByCode) {
  compatibilityConfig = matrixCompatibilityConfig;
}

var mvpActionCodeSet = ACTION_CATALOG.reduce(function(lookup, action) {
  lookup[action.code] = true;
  return lookup;
}, {});

compatibilityConfig.incompatibleByCode = Object.keys(compatibilityConfig.incompatibleByCode).reduce(function(filtered, code) {
  if (!mvpActionCodeSet[code]) {
    return filtered;
  }

  filtered[code] = (compatibilityConfig.incompatibleByCode[code] || []).filter(function(incompatibleCode) {
    return mvpActionCodeSet[incompatibleCode];
  });
  return filtered;
}, {});

// Canonical total/available for user-testing OS refs (session draft must not override).
var PROTOTYPE_PARCEL_AREAS = {
  'gate-field': { totalArea: '44.8800', availableArea: '39.8100' }, // SO3757 3194
  'far-meadow': { totalArea: '56.3200', availableArea: '56.3200' } // SO3757 3193
};

function applyPrototypeParcelAreas(parcelId) {
  var areas = PROTOTYPE_PARCEL_AREAS[parcelId];
  if (!areas || !parcelData[parcelId]) {
    return;
  }
  parcelData[parcelId].totalArea = areas.totalArea;
  parcelData[parcelId].availableArea = areas.availableArea;
}

// Prototype: which constraints the parcel has (SO3757 3193 / 3194 for user testing).
// Action-level ineligibility deducts area; consent / HEFER-required does not.
var PARCEL_CONSENT_FLAGS = {
  'gate-field': { sssi: true, hefer: true }, // SO3757 3194
  'far-meadow': { sssi: false, hefer: true } // SO3757 3193
};

var SSSI_CONSENT_GUIDANCE_HREF = 'https://www.gov.uk/government/publications/sustainable-farming-incentive-2026-sfi26/sfi26-scheme-rules-and-guidance#sssi-consent';
var HEFER_GUIDANCE_HREF = 'https://www.gov.uk/government/publications/sustainable-farming-incentive-2026-sfi26/sfi26-scheme-rules-and-guidance#how-to-request-an-sfi-hefer';

function createConsentGuidanceLink(href, text) {
  var link = document.createElement('a');
  link.className = 'govuk-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.appendChild(document.createTextNode(text));
  var hidden = document.createElement('span');
  hidden.className = 'govuk-visually-hidden';
  hidden.textContent = ' (opens in new tab)';
  link.appendChild(hidden);
  return link;
}

function setEligibleParcelNote(el, hasSssi, hasHefer) {
  el.textContent = '';
  if (!hasSssi && !hasHefer) {
    return;
  }

  el.appendChild(document.createTextNode('Some actions require '));
  if (hasSssi) {
    el.appendChild(createConsentGuidanceLink(SSSI_CONSENT_GUIDANCE_HREF, 'SSSI consent'));
  }
  if (hasSssi && hasHefer) {
    el.appendChild(document.createTextNode(' or an '));
  }
  if (hasHefer) {
    el.appendChild(createConsentGuidanceLink(HEFER_GUIDANCE_HREF, 'HEFER'));
  }
  el.appendChild(document.createTextNode('. We’ll tell you what you need for each action.'));
}

function getPreviousAgreementsForParcel(parcelId) {
  if (!parcelId || !window.SfiGrasslandsV3ExistingAgreements) {
    return [];
  }
  if (typeof window.SfiGrasslandsV3ExistingAgreements.getAgreements === 'function') {
    return window.SfiGrasslandsV3ExistingAgreements.getAgreements(parcelId) || [];
  }
  if (typeof window.SfiGrasslandsV3ExistingAgreements.get === 'function') {
    var flatActions = window.SfiGrasslandsV3ExistingAgreements.get(parcelId) || [];
    if (flatActions.length) {
      return [{
        scheme: 'Sustainable Farming Incentive',
        endDate: '',
        availableArea: '',
        actions: flatActions
      }];
    }
  }
  return [];
}

function updateAacActionsIntro() {
  var notes = document.getElementById('aac-actions-intro-protected-notes');
  var eligibleNote = document.getElementById('aac-actions-intro-eligible-note');
  var sssiFactor = document.getElementById('aac-actions-intro-sssi-factor');
  var heferFactor = document.getElementById('aac-actions-intro-hefer-factor');
  var ineligibleFactor = document.getElementById('aac-actions-intro-ineligible-factor');
  if (!notes && !sssiFactor && !heferFactor && !ineligibleFactor) {
    return;
  }

  var parcelId = currentSelectedParcel || getCurrentDraftParcelId();
  var flags = PARCEL_CONSENT_FLAGS[parcelId] || {};
  var hasSssi = Boolean(flags.sssi);
  var hasHefer = Boolean(flags.hefer);
  var hasProtectedLand = hasSssi || hasHefer;

  if (sssiFactor) {
    sssiFactor.hidden = !hasSssi;
  }
  if (heferFactor) {
    heferFactor.hidden = !hasHefer;
  }
  if (ineligibleFactor) {
    ineligibleFactor.hidden = hasProtectedLand;
  }
  if (notes) {
    notes.hidden = !hasProtectedLand;
  }
  if (eligibleNote) {
    if (hasProtectedLand) {
      setEligibleParcelNote(eligibleNote, hasSssi, hasHefer);
    } else {
      eligibleNote.textContent = '';
    }
  }
}

// Eligible-with-requirement only. Ineligible / not_applicable come from PROTECTED_LAND_RULES in AAC.
// Prefer the shared AAC table so deduction and consent stay in sync.
function getProtectedLandRulesFallback(actionCode) {
  var fallback = {
    CSAM3: { sssi: 'ineligible', hefer: 'ineligible' },
    CNUM2: { sssi: 'consent_required', hefer: 'ineligible' },
    CLIG3: { sssi: 'consent_required', hefer: 'hefer_required' },
    GRH12: { sssi: 'consent_required', hefer: 'hefer_required' },
    CIGL1: { sssi: 'consent_required', hefer: 'ineligible' },
    CIGL2: { sssi: 'consent_required', hefer: 'hefer_required' },
    BND1: { sssi: 'consent_required', hefer: 'hefer_required' },
    BND2: { sssi: 'consent_required', hefer: 'hefer_required' },
    WBD2: { sssi: 'ineligible', hefer: 'hefer_required' },
    CHRW2: { sssi: 'consent_required', hefer: 'hefer_required' },
    WBD1: { sssi: 'ineligible', hefer: 'hefer_required' },
    HEF1: { sssi: 'not_applicable', hefer: 'hefer_required' }
  };
  return fallback[String(actionCode || '').toUpperCase()] || null;
}

function getCurrentDraftParcelId() {
  try {
    var draftParcelEl = document.getElementById('draft-parcel-json');
    var draftParcel = draftParcelEl ? JSON.parse(draftParcelEl.textContent) : null;
    return draftParcel && draftParcel.parcelId ? draftParcel.parcelId : null;
  } catch (error) {
    return null;
  }
}

function getActionConsentFlags(actionCode, parcelIdOverride) {
  var parcelId = parcelIdOverride || currentSelectedParcel || getCurrentDraftParcelId();
  if (window.SfiGrasslandsV3ProtectedLand &&
      typeof window.SfiGrasslandsV3ProtectedLand.getRequirementFlags === 'function') {
    return window.SfiGrasslandsV3ProtectedLand.getRequirementFlags(actionCode, parcelId);
  }

  var parcelFlags = PARCEL_CONSENT_FLAGS[parcelId] || { sssi: false, hefer: false };
  var rules = getProtectedLandRulesFallback(actionCode);
  if (!rules) {
    return { sssi: false, hefer: false };
  }

  return {
    sssi: Boolean(parcelFlags.sssi && rules.sssi === 'consent_required'),
    hefer: Boolean(parcelFlags.hefer && rules.hefer === 'hefer_required')
  };
}

function getActionConsentHintLines(actionCode, parcelIdOverride) {
  var flags = getActionConsentFlags(actionCode, parcelIdOverride);
  if (flags.sssi && flags.hefer) {
    return ['SSSI consent and HEFER required'];
  }
  if (flags.sssi) {
    return ['SSSI consent required'];
  }
  if (flags.hefer) {
    return ['HEFER required'];
  }
  return [];
}

function getActionConsentHintText(actionCode, parcelIdOverride) {
  var lines = getActionConsentHintLines(actionCode, parcelIdOverride);
  return lines.length ? lines.join(' ') : null;
}

function buildActionConsentHint(actionCode, hintId) {
  var lines = getActionConsentHintLines(actionCode);
  if (!lines.length) {
    return null;
  }

  var hint = document.createElement('span');
  hint.className = 'app-action-consent-hint';
  hint.id = hintId;
  lines.forEach(function(line) {
    var row = document.createElement('span');
    row.className = 'app-action-consent-hint__line';
    row.textContent = line;
    hint.appendChild(row);
  });
  return hint;
}

function createActionCheckboxElements(action) {
  var codeLower = action.code.toLowerCase();
  var hintId = 'action-hint-' + codeLower;
  var consentHintId = 'action-consent-hint-' + codeLower;

  var item = document.createElement('div');
  item.className = 'govuk-checkboxes__item';

  var input = document.createElement('input');
  input.className = 'govuk-checkboxes__input';
  input.id = 'action-' + codeLower;
  input.name = 'actions';
  input.type = 'checkbox';
  input.value = action.code;
  input.setAttribute('data-aria-controls', 'conditional-' + codeLower);

  var label = document.createElement('label');
  label.className = 'govuk-label govuk-checkboxes__label';
  label.setAttribute('for', 'action-' + codeLower);
  label.appendChild(document.createTextNode(action.name + ': ' + action.code + ' - '));

  var guidanceLink = document.createElement('a');
  guidanceLink.className = 'govuk-link app-action-guidance-link';
  guidanceLink.href = getActionGuidanceUrl(action);
  guidanceLink.target = '_blank';
  guidanceLink.rel = 'noopener noreferrer';
  guidanceLink.textContent = 'read guidance';
  guidanceLink.setAttribute('aria-label', 'Read guidance for ' + action.name + ': ' + action.code + ' (opens in new tab)');
  guidanceLink.addEventListener('click', function(event) {
    event.stopPropagation();
  });
  label.appendChild(guidanceLink);

  var consentHint = buildActionConsentHint(action.code, consentHintId);
  var describedBy = hintId;
  if (consentHint) {
    label.appendChild(consentHint);
    describedBy += ' ' + consentHintId;
  }

  var hint = document.createElement('span');
  hint.className = 'app-action-hint';
  hint.id = hintId;
  hint.textContent = 'Payment rate per year: ' + (action.rateText || '');
  label.appendChild(hint);

  var availableHint = createActionAvailableHint(action.code);
  var availableHintId = availableHint.id;
  label.appendChild(availableHint);
  describedBy += ' ' + availableHintId;
  // Outside the conditional so people see it before they select CLIG3
  if (isWholeRemainingAreaAction(action.code)) {
    var fullAreaHint = createClig3FullAreaHint(action.code);
    label.appendChild(fullAreaHint);
    describedBy += ' ' + fullAreaHint.id;
  }
  // Nested supplements already sit under a “supplements for CLIG3” legend —
  // no need to repeat the relationship on every label.
  input.setAttribute('aria-describedby', describedBy);

  item.appendChild(input);
  item.appendChild(label);

  var conditional = document.createElement('div');
  conditional.className = 'govuk-checkboxes__conditional govuk-checkboxes__conditional--hidden';
  conditional.id = 'conditional-' + codeLower;

  if (isWholeRemainingAreaAction(action.code)) {
    conditional.setAttribute('data-whole-remaining-area', 'true');

    var formGroup = document.createElement('div');
    formGroup.className = 'govuk-form-group govuk-!-margin-bottom-0';

    var qtyLabel = document.createElement('p');
    qtyLabel.className = 'govuk-label govuk-!-margin-bottom-1';
    qtyLabel.id = 'whole-remaining-label-' + codeLower;
    qtyLabel.textContent = 'Quantity';

    var amountText = document.createElement('p');
    amountText.className = 'govuk-body govuk-!-margin-bottom-1';
    amountText.id = 'whole-remaining-summary-' + codeLower;
    amountText.setAttribute('aria-labelledby', qtyLabel.id);
    amountText.innerHTML =
      '<strong><span class="app-whole-remaining-amount" id="whole-remaining-amount-' + codeLower + '">0.0000</span> hectares</strong>';

    var supplementHint = document.createElement('p');
    supplementHint.className = 'govuk-hint govuk-!-margin-bottom-0';
    supplementHint.id = 'whole-remaining-supplement-hint-' + codeLower;
    supplementHint.textContent = 'You can add a supplement to CLIG3 on the next page.';

    amountText.setAttribute('aria-describedby', supplementHint.id);

    var hiddenQty = document.createElement('input');
    hiddenQty.type = 'hidden';
    hiddenQty.id = 'quantity-' + codeLower;
    hiddenQty.name = 'quantity-' + codeLower;
    hiddenQty.value = '';
    hiddenQty.setAttribute('data-whole-remaining-quantity', 'true');

    formGroup.appendChild(qtyLabel);
    formGroup.appendChild(amountText);
    formGroup.appendChild(supplementHint);
    formGroup.appendChild(hiddenQty);
    conditional.appendChild(formGroup);
    return { item: item, conditional: conditional };
  }

  var quantityFormGroup = document.createElement('div');
  quantityFormGroup.className = 'govuk-form-group';

  var quantityLabel = document.createElement('label');
  quantityLabel.className = 'govuk-label';
  quantityLabel.setAttribute('for', 'quantity-' + codeLower);
  quantityLabel.textContent = isPondUnit(getQuantityUnitForAction(action.code))
    ? 'Number of ponds'
    : 'Quantity';

  var wrapper = document.createElement('div');
  wrapper.className = 'govuk-input__wrapper';

  var qtyInput = document.createElement('input');
  qtyInput.className = 'govuk-input govuk-input--width-5';
  qtyInput.id = 'quantity-' + codeLower;
  qtyInput.name = 'quantity-' + codeLower;
  qtyInput.type = 'text';
  qtyInput.inputMode = isPondUnit(getQuantityUnitForAction(action.code)) ? 'numeric' : 'decimal';
  qtyInput.spellcheck = false;

  var suffix = document.createElement('div');
  suffix.className = 'govuk-input__suffix';
  suffix.setAttribute('aria-hidden', 'true');
  suffix.textContent = getQuantitySuffixForAction(action.code);

  wrapper.appendChild(qtyInput);
  wrapper.appendChild(suffix);
  quantityFormGroup.appendChild(quantityLabel);
  quantityFormGroup.appendChild(wrapper);
  conditional.appendChild(quantityFormGroup);

  return { item: item, conditional: conditional };
}

function appendClig3Supplements(clig3Conditional) {
  var supplements = getClig3SupplementActions();
  if (!clig3Conditional || !supplements.length) {
    return;
  }

  var wrap = document.createElement('div');
  wrap.className = 'app-clig3-supplements';
  wrap.setAttribute('data-clig3-supplements', 'true');

  var fieldset = document.createElement('fieldset');
  fieldset.className = 'govuk-fieldset';

  var legend = document.createElement('legend');
  legend.className = 'govuk-fieldset__legend govuk-fieldset__legend--s';
  legend.textContent = 'Do you want to add a supplement?';

  var groupHint = document.createElement('div');
  groupHint.className = 'govuk-hint';
  groupHint.id = 'clig3-supplement-hint';
  groupHint.textContent = 'You can add one supplement to the same land as CLIG3.';

  var radios = document.createElement('div');
  radios.className = 'govuk-radios';
  radios.setAttribute('data-module', 'govuk-radios');
  radios.setAttribute('aria-describedby', 'clig3-supplement-hint');

  // Hidden action checkboxes so save / AAC keep using input[name="actions"]
  var hiddenActions = document.createElement('div');
  hiddenActions.className = 'app-clig3-supplement-actions';
  hiddenActions.setAttribute('aria-hidden', 'true');

  supplements.forEach(function(action) {
    var codeLower = action.code.toLowerCase();
    var hintId = 'action-hint-' + codeLower;

    var hiddenItem = document.createElement('div');
    hiddenItem.className = 'govuk-checkboxes__item';
    var hiddenCheckbox = document.createElement('input');
    hiddenCheckbox.className = 'govuk-checkboxes__input';
    hiddenCheckbox.type = 'checkbox';
    hiddenCheckbox.name = 'actions';
    hiddenCheckbox.id = 'action-' + codeLower;
    hiddenCheckbox.value = action.code;
    hiddenCheckbox.tabIndex = -1;
    var hiddenLabel = document.createElement('label');
    hiddenLabel.className = 'govuk-label govuk-checkboxes__label';
    hiddenLabel.setAttribute('for', 'action-' + codeLower);
    hiddenLabel.textContent = action.code;
    hiddenItem.appendChild(hiddenCheckbox);
    hiddenItem.appendChild(hiddenLabel);
    hiddenActions.appendChild(hiddenItem);

    var item = document.createElement('div');
    item.className = 'govuk-radios__item';

    var radio = document.createElement('input');
    radio.className = 'govuk-radios__input';
    radio.type = 'radio';
    radio.name = 'clig3-supplement';
    radio.id = 'clig3-supplement-' + codeLower;
    radio.value = action.code;

    var label = document.createElement('label');
    label.className = 'govuk-label govuk-radios__label';
    label.setAttribute('for', 'clig3-supplement-' + codeLower);
    label.appendChild(document.createTextNode(action.name + ': ' + action.code + ' - '));

    var guidanceLink = document.createElement('a');
    guidanceLink.className = 'govuk-link app-action-guidance-link';
    guidanceLink.href = getActionGuidanceUrl(action);
    guidanceLink.target = '_blank';
    guidanceLink.rel = 'noopener noreferrer';
    guidanceLink.textContent = 'read guidance';
    guidanceLink.setAttribute('aria-label', 'Read guidance for ' + action.name + ': ' + action.code + ' (opens in new tab)');
    guidanceLink.addEventListener('click', function(event) {
      event.stopPropagation();
    });
    label.appendChild(guidanceLink);

    var hint = document.createElement('span');
    hint.className = 'app-action-hint';
    hint.id = hintId;
    hint.style.display = 'block';
    hint.style.fontWeight = 'normal';
    hint.style.color = '#505a5f';
    hint.style.marginTop = '5px';
    hint.textContent = 'Payment rate per year: ' + (action.rateText || '');
    label.appendChild(hint);

    var availableHint = createActionAvailableHint(action.code);
    availableHint.textContent = getClig3AppliedAreaHintText(0);
    availableHint.hidden = false;
    label.appendChild(availableHint);

    radio.setAttribute('aria-describedby', hintId + ' ' + availableHint.id);
    item.appendChild(radio);
    item.appendChild(label);
    radios.appendChild(item);

    // Quantity mirrors CLIG3 applied area — no user input
    var qtyInput = document.createElement('input');
    qtyInput.type = 'hidden';
    qtyInput.id = 'quantity-' + codeLower;
    qtyInput.name = 'quantity-' + codeLower;
    qtyInput.value = '';
    qtyInput.setAttribute('data-clig3-supplement-quantity', 'true');
    hiddenActions.appendChild(qtyInput);
  });

  var noneItem = document.createElement('div');
  noneItem.className = 'govuk-radios__item';
  var noneRadio = document.createElement('input');
  noneRadio.className = 'govuk-radios__input';
  noneRadio.type = 'radio';
  noneRadio.name = 'clig3-supplement';
  noneRadio.id = 'clig3-supplement-none';
  noneRadio.value = '';
  noneRadio.checked = true;
  var noneLabel = document.createElement('label');
  noneLabel.className = 'govuk-label govuk-radios__label';
  noneLabel.setAttribute('for', 'clig3-supplement-none');
  noneLabel.textContent = 'No supplement';
  noneItem.appendChild(noneRadio);
  noneItem.appendChild(noneLabel);

  radios.appendChild(noneItem);

  radios.addEventListener('change', function(event) {
    if (!event.target || event.target.name !== 'clig3-supplement') {
      return;
    }
    syncClig3SupplementCheckboxesFromRadios();
    var selectedCode = String(event.target.value || '').toUpperCase();
    var $trigger = selectedCode
      ? $('input[name="actions"][value="' + selectedCode + '"]')
      : $('#action-clig3');
    if ($trigger.length) {
      $trigger.trigger('change');
    } else if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      window.SfiGrasslandsV3Aac.render();
    }
  });

  fieldset.appendChild(legend);
  fieldset.appendChild(groupHint);
  fieldset.appendChild(radios);
  wrap.appendChild(fieldset);
  wrap.appendChild(hiddenActions);
  clig3Conditional.appendChild(wrap);
}

function renderActionCheckboxes() {
  var container = document.getElementById('actions-checkboxes-container');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  ACTION_CATALOG.forEach(function(action) {
    // Supplements are nested under CLIG3 — do not list them as peers
    if (isClig3Supplement(action.code)) {
      return;
    }

    var parts = createActionCheckboxElements(action);
    container.appendChild(parts.item);

    if (isWholeRemainingAreaAction(action.code)) {
      // CLIG3 supplements are collected on a separate page after Save and continue
    }

    container.appendChild(parts.conditional);
  });
}

renderActionCheckboxes();

// Default style for parcels
function defaultStyle(feature) {
  return {
    fillColor: feature.properties.color,
    weight: 2,
    opacity: 1,
    color: '#0b0c0c',
    fillOpacity: 0.5
  };
}

// Highlight style
function highlightStyle(feature) {
  return {
    fillColor: feature.properties.color,
    weight: 4,
    opacity: 1,
    color: '#ffdd00',
    fillOpacity: 0.7
  };
}

// Selected style
function selectedStyle(feature) {
  return {
    fillColor: feature.properties.color,
    weight: 1,
    opacity: 1,
    color: '#00703c',
    fillOpacity: 1
  };
}

var PARCEL_SOURCE_ID = 'parcels-source';
var PARCEL_FILL_LAYER_ID = 'parcels-fill';
var PARCEL_LINE_LAYER_ID = 'parcels-line';
var PARCEL_LABEL_LAYER_ID = 'parcels-labels';
var parcelFeatureCollection = { type: 'FeatureCollection', features: [] };
var parcelLayerEventsBound = false;
var hoveredParcelId = null;

function getParcelIdFromMapEvent(event) {
  if (!event || !event.features || event.features.length === 0) {
    return null;
  }

  var feature = event.features[0];
  return feature.id || (feature.properties && feature.properties.parcelId) || null;
}

function applyParcelVisualState(parcelId, selected, hover) {
  if (!rawMap || !rawMap.getSource(PARCEL_SOURCE_ID)) {
    return;
  }

  rawMap.setFeatureState(
    { source: PARCEL_SOURCE_ID, id: parcelId },
    { selected: !!selected, hover: !!hover }
  );
}

function ensureSharedParcelLayers(mapInstance) {
  var existingSource = mapInstance.getSource(PARCEL_SOURCE_ID);
  if (existingSource) {
    existingSource.setData(parcelFeatureCollection);
  } else {
    mapInstance.addSource(PARCEL_SOURCE_ID, {
      type: 'geojson',
      data: parcelFeatureCollection
    });
  }

  if (!mapInstance.getLayer(PARCEL_FILL_LAYER_ID)) {
    mapInstance.addLayer({
      id: PARCEL_FILL_LAYER_ID,
      type: 'fill',
      source: PARCEL_SOURCE_ID,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1,
          ['boolean', ['feature-state', 'hover'], false], 0.7,
          0.5
        ]
      }
    });
  }

  if (!mapInstance.getLayer(PARCEL_LINE_LAYER_ID)) {
    mapInstance.addLayer({
      id: PARCEL_LINE_LAYER_ID,
      type: 'line',
      source: PARCEL_SOURCE_ID,
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#00703c',
          ['boolean', ['feature-state', 'hover'], false], '#ffdd00',
          '#0b0c0c'
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1,
          ['boolean', ['feature-state', 'hover'], false], 4,
          2
        ],
        'line-opacity': 1
      }
    });
  }

  if (!mapInstance.getLayer(PARCEL_LABEL_LAYER_ID)) {
    mapInstance.addLayer({
      id: PARCEL_LABEL_LAYER_ID,
      type: 'symbol',
      source: PARCEL_SOURCE_ID,
      layout: {
        'text-field': ['get', 'displayName'],
        'text-size': 11,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
      },
      paint: {
        'text-color': '#0b0c0c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1
      }
    });
  }

  if (parcelLayerEventsBound) {
    return;
  }

  function clearHover() {
    if (!hoveredParcelId) {
      return;
    }

    var hoveredPolygon = parcelPolygons[hoveredParcelId];
    if (hoveredPolygon && hoveredPolygon._eventHandlers.mouseout) {
      hoveredPolygon._eventHandlers.mouseout.call(hoveredPolygon, { target: hoveredPolygon });
    }

    hoveredParcelId = null;
  }

  function handleHover(event) {
    var parcelId = getParcelIdFromMapEvent(event);
    if (!parcelId || parcelId === hoveredParcelId) {
      return;
    }

    clearHover();

    hoveredParcelId = parcelId;
    mapInstance.getCanvas().style.cursor = 'pointer';

    var polygon = parcelPolygons[parcelId];
    if (polygon && polygon._eventHandlers.mouseover) {
      polygon._eventHandlers.mouseover.call(polygon, { target: polygon });
    }
  }

  function handleClick(event) {
    var parcelId = getParcelIdFromMapEvent(event);
    if (!parcelId) {
      return;
    }

    var polygon = parcelPolygons[parcelId];
    if (polygon && polygon._eventHandlers.click) {
      polygon._eventHandlers.click.call(polygon, { target: polygon });
    }
  }

  mapInstance.on('mousemove', PARCEL_FILL_LAYER_ID, handleHover);
  mapInstance.on('mousemove', PARCEL_LABEL_LAYER_ID, handleHover);
  mapInstance.on('click', PARCEL_FILL_LAYER_ID, handleClick);
  mapInstance.on('click', PARCEL_LABEL_LAYER_ID, handleClick);

  mapInstance.on('mouseleave', PARCEL_FILL_LAYER_ID, function() {
    mapInstance.getCanvas().style.cursor = '';
    clearHover();
  });

  mapInstance.on('mouseleave', PARCEL_LABEL_LAYER_ID, function() {
    mapInstance.getCanvas().style.cursor = '';
    clearHover();
  });

  parcelLayerEventsBound = true;
}

function getParcelPopupAnchor(mapInstance, lngLat) {
  if (!mapInstance || !lngLat || typeof mapInstance.project !== 'function') {
    return 'bottom';
  }

  var point = mapInstance.project(lngLat);
  var container = mapInstance.getContainer();
  var width = container ? container.clientWidth : 0;
  var height = container ? container.clientHeight : 0;

  if (!width || !height) {
    return 'bottom';
  }

  // Leave room for popups near map edges.
  var edgePadX = 130;
  var edgePadY = 180;
  var nearTop = point.y < edgePadY;
  var nearBottom = point.y > (height - edgePadY);
  var nearLeft = point.x < edgePadX;
  var nearRight = point.x > (width - edgePadX);

  if (nearTop && nearLeft) {
    return 'top-left';
  }
  if (nearTop && nearRight) {
    return 'top-right';
  }
  if (nearTop) {
    return 'top';
  }
  if (nearBottom && nearLeft) {
    return 'bottom-left';
  }
  if (nearBottom && nearRight) {
    return 'bottom-right';
  }
  if (nearBottom) {
    return 'bottom';
  }
  if (nearLeft) {
    return 'left';
  }
  if (nearRight) {
    return 'right';
  }

  return 'bottom';
}

function formatAvailableActionsCountLabel(count) {
  var n = Math.max(0, Math.round(Number(count) || 0));
  return 'Available actions: ' + n;
}

function getParcelAvailableActionsCount(parcelId, data) {
  var parcel = (data && data.actions) ? data : parcelData[parcelId];
  if (parcel && Array.isArray(parcel.actions)) {
    return parcel.actions.length;
  }
  return 0;
}

function buildParcelPopupContent(parcelId, data) {
  return '<h3>' + formatParcelReference(Object.assign({ id: parcelId, parcelId: parcelId }, data)) + '</h3>' +
    '<p>Land covers: ' + formatLandCoverDisplay(data.landCover) + '</p>' +
    '<p>' + formatAvailableActionsCountLabel(getParcelAvailableActionsCount(parcelId, data)) + '</p>';
}

function createParcelOverlay(parcelId, data) {
  var bounds = createBoundsFromLatLngs(data.coords);
  var popup = null;
  var popupCloseTimer = null;
  var eventHandlers = {};
  var visualState = { selected: false, hover: false };

  var popupContent = buildParcelPopupContent(parcelId, data);

  parcelFeatureCollection.features.push({
    id: parcelId,
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [toClosedMapLibreRing(data.coords)]
    },
    properties: {
      parcelId: parcelId,
      name: data.name,
      displayName: formatParcelReference(data),
      color: data.color
    }
  });

  function applyStyle(nextStyle) {
    var selected = !!(nextStyle && nextStyle.color === '#00703c');
    var hover = !!(nextStyle && nextStyle.color === '#ffdd00' && !selected);
    visualState.selected = selected;
    visualState.hover = hover;
    applyParcelVisualState(parcelId, selected, hover);
  }

  function cancelPopupClose() {
    if (popupCloseTimer) {
      clearTimeout(popupCloseTimer);
      popupCloseTimer = null;
    }
  }

  function schedulePopupClose() {
    cancelPopupClose();
    popupCloseTimer = setTimeout(function() {
      if (!popup) {
        return;
      }
      popup.remove();
      popup = null;
    }, 220);
  }

  return {
    feature: {
      type: 'Feature',
      properties: {
        parcelId: parcelId,
        name: data.name,
        displayName: formatParcelReference(data),
        color: data.color
      }
    },
    _eventHandlers: eventHandlers,
    _syncVisualState: function() {
      applyParcelVisualState(parcelId, visualState.selected, visualState.hover);
    },
    setStyle: function(nextStyle) {
      applyStyle(nextStyle);
    },
    bindPopup: function(content) {
      popupContent = content;
      return this;
    },
    openPopup: function() {
      cancelPopupClose();
      if (!rawMap) {
        return;
      }
      if (popup) {
        popup.remove();
      }
      var popupLngLat = toMapLibreLatLng(bounds.getCenter());
      popup = new maplibregl.Popup({
        maxWidth: '216px',
        anchor: getParcelPopupAnchor(rawMap, popupLngLat),
        offset: 12,
        closeButton: true,
        closeOnClick: false,
        className: 'parcel-popup-selectable'
      })
        .setLngLat(popupLngLat)
        .setHTML(popupContent)
        .addTo(rawMap);

      var popupElement = popup.getElement();
      if (popupElement) {
        popupElement.addEventListener('mouseenter', cancelPopupClose);
        popupElement.addEventListener('mouseleave', schedulePopupClose);
      }
    },
    closePopupWithDelay: function() {
      schedulePopupClose();
    },
    closePopup: function() {
      cancelPopupClose();
      if (!popup) {
        return;
      }
      popup.remove();
      popup = null;
    },
    on: function(eventName, handler) {
      eventHandlers[eventName] = handler;
      return this;
    },
    getBounds: function() {
      return bounds;
    }
  };
}

// Create virtual overlays for each parcel, then draw them via one shared map source/layers.
function closeAllParcelPopups(exceptParcelId) {
  Object.keys(parcelPolygons).forEach(function(parcelId) {
    if (exceptParcelId && parcelId === exceptParcelId) {
      return;
    }

    var polygon = parcelPolygons[parcelId];
    if (polygon && typeof polygon.closePopup === 'function') {
      polygon.closePopup();
    }
  });
}

Object.keys(parcelData).forEach(function(parcelId) {
  var data = parcelData[parcelId];
  var polygon = createParcelOverlay(parcelId, data);
  parcelPolygons[parcelId] = polygon;

  polygon.bindPopup(buildParcelPopupContent(parcelId, data));

  polygon.on('mouseover', function() {
    if (currentSelectedParcel !== parcelId) {
      this.setStyle(highlightStyle(this.feature));
    }
  });

  polygon.on('mouseout', function() {
    if (currentSelectedParcel !== parcelId) {
      this.setStyle(defaultStyle(this.feature));
    }
  });

  polygon.on('click', function() {
    if (Date.now() < suppressParcelSelectionUntil) {
      return;
    }

    closeAllParcelPopups(parcelId);
    this.openPopup();
    selectParcel(parcelId);
    if (currentSelectedParcel === null) {
      map.setView(this.getBounds().getCenter(), 14);
    } else {
      map.panTo(this.getBounds().getCenter());
    }
  });
});

onMapStyleReady(function(mapInstance) {
  ensureSharedParcelLayers(mapInstance);

  Object.keys(parcelPolygons).forEach(function(parcelId) {
    var polygon = parcelPolygons[parcelId];
    if (polygon && polygon._syncVisualState) {
      polygon._syncVisualState();
    }
  });
});

// Function to restore parcel state from saved selections
var isRestoringActionSelections = false;

function restoreParcelState(parcelId) {
  if (currentSelectedParcel !== parcelId) {
    return;
  }

  console.log('Restoring parcel state for:', parcelId);

  resetActionSelectionUiState();
  
  // Get saved selections for this parcel
  var savedSelections = parcelSelections[parcelId];
  if (!savedSelections || !savedSelections.actions) {
    console.log('No saved selections found');
    return;
  }
  
  console.log('Restoring actions:', savedSelections.actions);

  // Skip the fake compatibility API while restoring saved checkbox state
  if (window.SfiGrasslandsV3ActionsCompatibilityLoading) {
    window.SfiGrasslandsV3ActionsCompatibilityLoading.setSuspended(true);
  }

  isRestoringActionSelections = true;
  try {
    // Restore each saved action without firing change handlers (avoids AAC “Updating…”
    // and GOV.UK checkbox desync that makes uncheck take two clicks).
    savedSelections.actions.forEach(function(action) {
      if (isClig3Supplement(action.code)) {
        return;
      }
      console.log('Restoring action:', action.code, 'quantity:', action.quantity);

      var $checkbox = $('input[name="actions"][value="' + action.code + '"]');
      if ($checkbox.length > 0) {
        $checkbox.prop('checked', true);
        $checkbox.attr('aria-expanded', 'true');

        var conditionalId = 'conditional-' + action.code.toLowerCase();
        var $conditional = $('#' + conditionalId);
        if ($conditional.length > 0) {
          $conditional
            .removeClass('govuk-checkboxes__conditional--hidden')
            .removeClass('govuk-radios__conditional--hidden');
        }

        if (action.quantity) {
          var $quantityInput = $('#quantity-' + action.code.toLowerCase());
          if ($quantityInput.length > 0) {
            $quantityInput.val(action.quantity);
          }
        }
      } else {
        console.log('Checkbox not found for:', action.code);
      }
    });
  } finally {
    isRestoringActionSelections = false;
    if (window.SfiGrasslandsV3ActionsCompatibilityLoading) {
      // Keep suspended if AAC mode is on — AAC owns availability while enabled
      if (!(window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled())) {
        window.SfiGrasslandsV3ActionsCompatibilityLoading.setSuspended(false);
      }
    }
    syncClig3SupplementRadiosFromCheckboxes();
    // AAC first so CLIG3 quantity sync can read the real available pool
    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      window.SfiGrasslandsV3Aac.render();
    }
    syncAllWholeRemainingAreaActions();
  }

  var hasQueuedActionFocus = Boolean(pendingActionFocusCode);

  // Scroll to the actions section only when no specific action focus is queued.
  // When Change linked to an action, wait until after AAC restore to focus quantity.
  var $actionsSection = $('#actions-section');
  if ($actionsSection.length > 0 && !hasQueuedActionFocus) {
    $('html, body').animate({
      scrollTop: $actionsSection.offset().top - 20
    }, 500);
  }
}

// Function to select a parcel
function selectParcel(parcelId) {
  applyPrototypeParcelAreas(parcelId);
  var parcel = parcelData[parcelId];
  if (!parcel) return;

  if (pendingParcelRestoreTimeout) {
    clearTimeout(pendingParcelRestoreTimeout);
    pendingParcelRestoreTimeout = null;
  }

  // Track if this is the first selection
  var isFirstSelection = (currentSelectedParcel === null);

  // Reset previous selection
  if (currentSelectedParcel && parcelPolygons[currentSelectedParcel]) {
    parcelPolygons[currentSelectedParcel].setStyle(defaultStyle(parcelPolygons[currentSelectedParcel].feature));
  }

  // Set new selection
  currentSelectedParcel = parcelId;
  if (parcelPolygons[parcelId]) {
    parcelPolygons[parcelId].setStyle(selectedStyle(parcelPolygons[parcelId].feature));
  }

  // Update UI
  // Determine a user-friendly OS ref to show in the heading. Prefer any full ID included
  // in the parcel list links (e.g. "North Field - BO4521 2843"); fall back to `parcel.osRef`.
  var osRefDisplay = parcel.osRef || '';
  try {
    var links = document.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
      var onclickAttr = links[i].getAttribute('onclick');
      if (onclickAttr && onclickAttr.indexOf("selectParcelById('" + parcelId + "')") !== -1) {
        var txt = links[i].textContent.trim();
        // Expect text like "Name - OSREF"; take the part after the last ' - '
        var dashIndex = txt.lastIndexOf(' - ');
        if (dashIndex !== -1) {
          osRefDisplay = txt.substring(dashIndex + 3).trim();
        }
        break;
      }
    }
  } catch (e) {
    // ignore and fall back to parcel.osRef
  }

  document.getElementById('page-heading').textContent = 'Select actions for this land parcel';
  document.getElementById('select-parcel-text').style.display = 'block';
  document.getElementById('choose-parcel-text').style.display = 'none';
  document.getElementById('selected-parcel-text').style.display = 'none';
  var osRefEl = document.getElementById('os-ref');
  if (osRefEl) {
    osRefEl.textContent = formatParcelReference(Object.assign({ id: parcelId, parcelId: parcelId }, parcel));
  }
  var totalAreaEl = document.getElementById('total-area');
  if (totalAreaEl) {
    totalAreaEl.textContent = parcel.totalArea;
  }
  var availableAreaEl = document.getElementById('available-area');
  if (availableAreaEl) {
    availableAreaEl.textContent = parcel.availableArea;
  }
  var landCoverEl = document.getElementById('land-cover');
  if (landCoverEl) {
    landCoverEl.textContent = getParcelLandCovers(parcel.landCover).join(', ') || '-';
  }
  document.getElementById('actions-heading').textContent = 'Available actions';
  updateAacActionsIntro();

  // Keep the left panel visible and only hide the farm summary tables.
  // This allows parcel-info-container (now in the same left panel) to be shown.
  document.getElementById('os-map-references').style.display = 'block';
  Array.prototype.forEach.call(document.querySelectorAll('.farm-info-panel'), function(panel) {
    panel.style.display = 'none';
  });

  // Show the parcels and actions summary section
  document.getElementById('parcels-actions-summary-section').style.display = 'block';

  // Show the parcel info table
  var parcelInfoContainer = document.getElementById('parcel-info-container');
  if (parcelInfoContainer) {
    parcelInfoContainer.style.display = 'block';
  }
  var backToFarmLinkContainer = document.getElementById('back-to-farm-link-container');
  if (backToFarmLinkContainer) {
    backToFarmLinkContainer.style.display = 'block';
  }

  // Show the actions section
  document.getElementById('actions-section').style.display = 'block';

  // Show left-column action tools (search and theme filters)
  document.getElementById('action-tools-panel').style.display = 'block';

  // Show the parcels list section
  var selectedParcelListId = LOCATION_TO_PARCEL_LIST_ID[parcel.location];
  var parcelListSection = document.getElementById('parcels-list-section');
  Object.keys(LOCATION_TO_PARCEL_LIST_ID).forEach(function(locationKey) {
    var listId = LOCATION_TO_PARCEL_LIST_ID[locationKey];
    var listEl = document.getElementById(listId);
    if (listEl) {
      listEl.style.display = listId === selectedParcelListId ? 'block' : 'none';
    }
  });
  if (parcelListSection) {
    parcelListSection.style.display = selectedParcelListId ? 'block' : 'none';
  }

  var selectedExistingActionsId = LOCATION_TO_EXISTING_ACTIONS_ID[parcel.location];
  Object.keys(LOCATION_TO_EXISTING_ACTIONS_ID).forEach(function(locationKey) {
    var actionsId = LOCATION_TO_EXISTING_ACTIONS_ID[locationKey];
    var actionsEl = document.getElementById(actionsId);
    if (actionsEl) {
      actionsEl.style.display = actionsId === selectedExistingActionsId ? 'block' : 'none';
    }
  });

  // Update actions list
  updateActionsList(getParcelAvailableActions(parcel));
  syncAacForCurrentParcel();
  updatePreviousAgreementsSummary(parcelId);

  // If there is no saved state to restore, still move focus to the queued action.
  if (pendingActionFocusCode && !(parcelSelections[parcelId] && parcelSelections[parcelId].actions && parcelSelections[parcelId].actions.length > 0)) {
    consumeQueuedActionFocus(120);
  }
  
  // Restore parcel state if it has saved actions
  if (parcelSelections[parcelId] && parcelSelections[parcelId].actions && parcelSelections[parcelId].actions.length > 0) {
    pendingParcelRestoreTimeout = setTimeout(function() {
      if (currentSelectedParcel !== parcelId) {
        return;
      }

      restoreParcelState(parcelId);
      pendingParcelRestoreTimeout = null;
    }, 200);
  }

  // Pan map to parcel - maintain zoom if switching between parcels
  if (parcelPolygons[parcelId]) {
    if (isFirstSelection) {
      // First selection, fit bounds
      map.fitBounds(parcelPolygons[parcelId].getBounds(), {padding: [50, 50]});
    } else {
      // Switching parcels, just pan to center maintaining zoom
      map.panTo(parcelPolygons[parcelId].getBounds().getCenter());
    }
  }
}

// Function to select parcel from list
function selectParcelById(parcelId, options) {
  options = options || {};
  selectParcel(parcelId);
  // Only zoom if no parcel is currently selected, otherwise just pan
  if (parcelPolygons[parcelId]) {
    if (currentSelectedParcel === null) {
      map.setView(parcelPolygons[parcelId].getBounds().getCenter(), 14);
    } else {
      map.panTo(parcelPolygons[parcelId].getBounds().getCenter());
    }
    // Open the popup for the selected parcel
    closeAllParcelPopups(parcelId);
    parcelPolygons[parcelId].openPopup();
  }
  // When Change linked to a specific action, keep the viewport on that input.
  if (!options.skipMapScroll && !pendingActionFocusCode) {
    document.getElementById('map').scrollIntoView({behavior: 'smooth', block: 'center'});
  }
}

function getSelectedThemes() {
  return Array.prototype.slice.call(document.querySelectorAll('input[data-theme-filter]:checked')).map(function(input) {
    return input.value;
  });
}

function getSelectedSortOption() {
  var selectedOption = document.querySelector('input[name="actions-sort-option"]:checked');
  return selectedOption ? selectedOption.value : 'alpha-asc';
}

function formatCurrencyGBP(amount) {
  var numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return '£0.00';
  }

  return '£' + numericAmount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function compareByActionName(codeA, codeB) {
  var nameA = (actionNameByCode[codeA] || codeA).toLowerCase();
  var nameB = (actionNameByCode[codeB] || codeB).toLowerCase();

  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }
  return 0;
}

function compareByDefaultOrder(codeA, codeB) {
  return (defaultActionOrderByCode[codeA] || 0) - (defaultActionOrderByCode[codeB] || 0);
}

function getPaymentSortValue(code, descending) {
  var value = paymentRates[code];
  if (typeof value === 'number') {
    return descending ? -value : value;
  }
  return Number.POSITIVE_INFINITY;
}

function getFrequentlyUsedRank(code) {
  if (Object.prototype.hasOwnProperty.call(frequentlyUsedRankByCode, code)) {
    return frequentlyUsedRankByCode[code];
  }
  return Number.POSITIVE_INFINITY;
}

function sortActionCodes(actionCodes, sortOption) {
  var codes = (actionCodes || []).slice();

  if (sortOption === 'alpha-asc') {
    return codes.sort(function(codeA, codeB) {
      return compareByActionName(codeA, codeB);
    });
  }

  if (sortOption === 'alpha-desc') {
    return codes.sort(function(codeA, codeB) {
      return compareByActionName(codeB, codeA);
    });
  }

  if (sortOption === 'payment-asc' || sortOption === 'payment-desc') {
    var isDesc = sortOption === 'payment-desc';
    return codes.sort(function(codeA, codeB) {
      var valueA = getPaymentSortValue(codeA, isDesc);
      var valueB = getPaymentSortValue(codeB, isDesc);

      if (valueA !== valueB) {
        return valueA - valueB;
      }

      return compareByActionName(codeA, codeB);
    });
  }

  if (sortOption === 'frequently-used') {
    return codes.sort(function(codeA, codeB) {
      var rankA = getFrequentlyUsedRank(codeA);
      var rankB = getFrequentlyUsedRank(codeB);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return compareByActionName(codeA, codeB);
    });
  }

  return codes.sort(compareByDefaultOrder);
}

function getActionListGroups() {
  return [
    {
      id: 'ha',
      heading: 'Grassland actions',
      unit: 'ha'
    },
    {
      id: 'm',
      heading: 'Boundary actions',
      unit: 'm'
    },
    {
      id: 'pond',
      heading: 'Pond actions',
      unit: 'pond'
    },
    {
      id: 'm2',
      heading: 'Building actions',
      unit: 'm²'
    }
  ];
}

function getActionListGroupId(actionCode) {
  var unit = getQuantityUnitForAction(actionCode);
  if (unit === 'm²') {
    return 'm2';
  }
  if (unit === 'pond') {
    return 'pond';
  }
  if (unit === 'm') {
    return 'm';
  }
  return 'ha';
}

function clearActionListGroupHeadings(container) {
  if (!container) {
    return;
  }
  Array.prototype.forEach.call(
    container.querySelectorAll('.app-action-list-group-heading, .app-action-list-group-lead-in'),
    function(el) {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  );
}

function updateActionListGroupHeadingVisibility() {
  var container = document.getElementById('actions-checkboxes-container');
  if (!container) {
    return;
  }

  Array.prototype.forEach.call(
    container.querySelectorAll('.app-action-list-group-heading'),
    function(heading) {
      var hasVisibleAction = false;
      var sibling = heading.nextElementSibling;
      while (sibling && !sibling.classList.contains('app-action-list-group-heading')) {
        if (sibling.classList.contains('app-action-list-group-lead-in')) {
          sibling = sibling.nextElementSibling;
          continue;
        }
        if (
          sibling.classList.contains('govuk-checkboxes__item') &&
          sibling.getAttribute('data-available-for-parcel') !== 'false' &&
          !sibling.hidden &&
          sibling.style.display !== 'none'
        ) {
          hasVisibleAction = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      heading.hidden = !hasVisibleAction;
      var leadIn = heading.nextElementSibling;
      if (leadIn && leadIn.classList.contains('app-action-list-group-lead-in')) {
        leadIn.hidden = !hasVisibleAction;
      }
    }
  );
}

function reorderActionOptions(sortedCodes) {
  var container = document.getElementById('actions-checkboxes-container');
  if (!container || !Array.isArray(sortedCodes) || sortedCodes.length === 0) {
    return;
  }

  clearActionListGroupHeadings(container);

  var fragment = document.createDocumentFragment();
  var groups = getActionListGroups();
  var codesByGroup = {};
  groups.forEach(function(group) {
    codesByGroup[group.id] = [];
  });

  sortedCodes.forEach(function(actionCode) {
    // Keep CLIG3 supplements nested under the base action
    if (isClig3Supplement(actionCode)) {
      return;
    }
    var groupId = getActionListGroupId(actionCode);
    if (!codesByGroup[groupId]) {
      codesByGroup[groupId] = [];
    }
    codesByGroup[groupId].push(actionCode);
  });

  function findTopLevelActionItem(actionCode) {
    var item = null;
    Array.prototype.some.call(container.children, function(child) {
      if (!child.classList || !child.classList.contains('govuk-checkboxes__item')) {
        return false;
      }
      var directInput = null;
      Array.prototype.some.call(child.children, function(el) {
        if (el.tagName === 'INPUT' && el.name === 'actions' && el.value === actionCode) {
          directInput = el;
          return true;
        }
        return false;
      });
      if (directInput) {
        item = child;
        return true;
      }
      return false;
    });
    return item;
  }

  groups.forEach(function(group) {
    var codes = codesByGroup[group.id] || [];
    if (!codes.length) {
      return;
    }

    var heading = document.createElement('h3');
    heading.className = 'govuk-heading-s app-action-list-group-heading';
    heading.setAttribute('data-action-group', group.id);
    heading.textContent = group.heading;
    fragment.appendChild(heading);

    if (group.id === 'ha' || group.id === 'm') {
      var leadIn = document.createElement('p');
      leadIn.className = 'govuk-body app-action-list-group-lead-in';
      leadIn.textContent = group.id === 'm'
        ? 'The available length will update as you make your selections.'
        : 'The available area will update as you make your selections.';
      fragment.appendChild(leadIn);
    }

    codes.forEach(function(actionCode) {
      var item = findTopLevelActionItem(actionCode);
      if (!item) {
        return;
      }

      var conditional = item.nextElementSibling;
      fragment.appendChild(item);

      if (conditional && conditional.classList && conditional.classList.contains('govuk-checkboxes__conditional')) {
        fragment.appendChild(conditional);
      }
    });
  });

  container.appendChild(fragment);
}

function applyActionFilters() {
  var sortedCodes = sortActionCodes(currentAvailableActions, 'alpha-asc');
  reorderActionOptions(sortedCodes);

  var availableLookup = {};
  currentAvailableActions.forEach(function(code) {
    availableLookup[code] = true;
  });

  var visibleCount = 0;

  $('#actions-checkboxes-container > .govuk-checkboxes__item input[name="actions"]').each(function() {
    var checkbox = this;
    var $item = $(checkbox).closest('.govuk-checkboxes__item');
    var actionCode = checkbox.value;
    var conditional = $item.next('.govuk-checkboxes__conditional');
    var isAvailableForParcel = Boolean(availableLookup[actionCode]);

    if (isAvailableForParcel) {
      $item.attr('data-available-for-parcel', 'true');
      $item.show();
      $item[0].hidden = false;
      $item[0].style.display = '';
      visibleCount++;
    } else {
      $item.attr('data-available-for-parcel', 'false');
      $item.hide();
      $item[0].hidden = true;
      $item[0].style.display = 'none';
      checkbox.checked = false;
      checkbox.setAttribute('aria-expanded', 'false');
      $('#quantity-' + String(actionCode).toLowerCase()).val('');
      // Hide by id so an orphaned panel cannot sit above group headings
      $('#conditional-' + String(actionCode).toLowerCase())
        .addClass('govuk-checkboxes__conditional--hidden');
      if (conditional.length) {
        conditional.addClass('govuk-checkboxes__conditional--hidden');
      }
    }
  });

  // Safety net: any quantity panel whose action row is missing/hidden must stay closed
  $('#actions-checkboxes-container > .govuk-checkboxes__conditional').each(function() {
    var conditionalEl = this;
    var code = String(conditionalEl.id || '')
      .replace(/^conditional-/i, '')
      .toUpperCase();
    if (!code) {
      return;
    }
    var checkboxEl = document.querySelector(
      '#actions-checkboxes-container > .govuk-checkboxes__item input[name="actions"][value="' + code + '"]'
    );
    var itemEl = checkboxEl && checkboxEl.closest('.govuk-checkboxes__item');
    if (
      !itemEl ||
      itemEl.hidden ||
      itemEl.getAttribute('data-available-for-parcel') === 'false' ||
      itemEl.style.display === 'none'
    ) {
      conditionalEl.classList.add('govuk-checkboxes__conditional--hidden');
    }
  });

  updateActionListGroupHeadingVisibility();

  if (currentSelectedParcel && visibleCount === 0) {
    var noResultsTitle = document.getElementById('no-results-title');
    var noResultsDescription = document.getElementById('no-results-description');
    if (noResultsTitle) {
      noResultsTitle.textContent = 'There are no eligible actions for this parcel.';
    }
    if (noResultsDescription) {
      noResultsDescription.textContent = 'Change the parcel land cover or choose a different parcel to view eligible actions.';
    }
    $('#no-results-message').show();
  } else {
    $('#no-results-message').hide();
  }

  if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
    window.SfiGrasslandsV3Aac.render();
  }
}

function isElementVisible(el) {
  if (!el) {
    return false;
  }
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function scrollElementIntoView(el) {
  if (!el) {
    return;
  }
  // Prefer window scroll — more reliable than scrollIntoView while the page is still settling.
  try {
    var rect = el.getBoundingClientRect();
    var absoluteTop = rect.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
    var targetTop = Math.max(0, absoluteTop - Math.round(window.innerHeight / 3));
    window.scrollTo(0, targetTop);
  } catch (scrollError) {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }
}

function openActionConditional(checkbox, codeLower) {
  if (!checkbox) {
    return null;
  }
  var conditional = document.getElementById('conditional-' + codeLower);
  if (!conditional) {
    return null;
  }
  checkbox.checked = true;
  checkbox.setAttribute('aria-expanded', 'true');
  conditional.classList.remove('govuk-checkboxes__conditional--hidden');
  conditional.classList.remove('govuk-radios__conditional--hidden');
  conditional.style.display = '';
  return conditional;
}

// One attempt: open the action, scroll to quantity if ready. Returns true when done.
function tryFocusActionQuantity(actionCode) {
  var normalizedActionCode = String(actionCode || '').toUpperCase();
  if (!normalizedActionCode) {
    return true;
  }

  var codeLower = normalizedActionCode.toLowerCase();
  var checkbox = document.querySelector('input[name="actions"][value="' + normalizedActionCode + '"]');
  if (!checkbox) {
    return false;
  }

  openActionConditional(checkbox, codeLower);
  var quantityInput = document.getElementById('quantity-' + codeLower);

  if (!quantityInput || quantityInput.type === 'hidden' || !isElementVisible(quantityInput)) {
    return false;
  }

  scrollElementIntoView(quantityInput);
  if (typeof quantityInput.focus === 'function') {
    try {
      quantityInput.focus({ preventScroll: true });
    } catch (error) {
      quantityInput.focus();
    }
  }
  if (typeof quantityInput.select === 'function') {
    try {
      quantityInput.select();
    } catch (selectError) {
      // Ignore select() failures on non-text inputs.
    }
  }
  return true;
}

function focusActionByCode(actionCode, attempt) {
  var normalizedActionCode = String(actionCode || '').toUpperCase();
  if (!normalizedActionCode) {
    return;
  }

  var maxAttempts = 30;
  var currentAttempt = Number.isFinite(attempt) ? attempt : 0;

  if (tryFocusActionQuantity(normalizedActionCode)) {
    if (pendingActionFocusCode === normalizedActionCode) {
      pendingActionFocusCode = null;
    }
    return;
  }

  if (currentAttempt < maxAttempts) {
    setTimeout(function() {
      focusActionByCode(normalizedActionCode, currentAttempt + 1);
    }, 150);
    return;
  }

  // Last resort: bring the checkbox into view if quantity never became ready.
  var checkbox = document.querySelector('input[name="actions"][value="' + normalizedActionCode + '"]');
  if (checkbox) {
    scrollElementIntoView(checkbox);
    if (typeof checkbox.focus === 'function') {
      try {
        checkbox.focus({ preventScroll: true });
      } catch (error) {
        checkbox.focus();
      }
    }
  }
  if (pendingActionFocusCode === normalizedActionCode) {
    pendingActionFocusCode = null;
  }
}

function queueActionFocus(actionCode) {
  var normalizedActionCode = String(actionCode || '').toUpperCase();
  pendingActionFocusCode = normalizedActionCode || null;
}

function consumeQueuedActionFocus(delayMs) {
  if (!pendingActionFocusCode) {
    return;
  }

  var actionCodeToFocus = pendingActionFocusCode;
  setTimeout(function() {
    focusActionByCode(actionCodeToFocus, 0);
  }, Number.isFinite(delayMs) ? delayMs : 0);
}

// Function to update actions list
function getAllMvpActionCodes() {
  if (window.SFI_GRASSLANDS_V2_MVP_ACTIONS && Array.isArray(window.SFI_GRASSLANDS_V2_MVP_ACTIONS.codes)) {
    return window.SFI_GRASSLANDS_V2_MVP_ACTIONS.codes.slice();
  }
  return ACTION_CATALOG.map(function(action) {
    return action.code;
  });
}

function isShowAllMvpActionsToggleOn() {
  return Boolean(showAllMvpActionsEnabled);
}

function getLandCoverEligibleActionCodes(parcel) {
  if (!parcel) {
    return [];
  }

  var parcelId = null;
  Object.keys(parcelData).some(function(id) {
    if (parcelData[id] === parcel) {
      parcelId = id;
      return true;
    }
    return false;
  });

  var landCover = parcel.landCover || DEFAULT_LAND_COVER;
  var features = getParcelFeatureFlags(parcelId || currentSelectedParcel, parcel);
  return getEligibleActionsForLandCover(landCover).filter(function(code) {
    return supportsActionFeatureRequirements(code, features);
  });
}

function getPreviousAgreementActionCodes(parcelId) {
  // Prototype: do not surface or lock actions from existing agreements
  return [];
}

function getParcelAvailableActions(parcel) {
  // Default: land-cover (+ feature) eligible actions only.
  // “Show all 16 MVP actions” is the explicit override.
  if (isShowAllMvpActionsToggleOn()) {
    return getAllMvpActionCodes();
  }
  return getLandCoverEligibleActionCodes(parcel);
}

function refreshAvailableActionsForCurrentParcel() {
  if (!currentSelectedParcel || !parcelData[currentSelectedParcel]) {
    currentAvailableActions = [];
    applyActionFilters();
    syncAacForCurrentParcel();
    return;
  }

  currentAvailableActions = getParcelAvailableActions(parcelData[currentSelectedParcel]);

  // If we leave “show all”, drop selections that are no longer eligible for the parcel
  $('input[name="actions"]').each(function() {
    var $input = $(this);
    var actionCode = $input.val();
    if (currentAvailableActions.indexOf(actionCode) !== -1) {
      return;
    }

    if ($input.is(':checked')) {
      var codeLower = String(actionCode || '').toLowerCase();
      var $quantityInput = $('#quantity-' + codeLower);
      var $conditional = $('#conditional-' + codeLower);
      $input.prop('checked', false);
      $input.attr('aria-expanded', 'false');
      if ($quantityInput.length) {
        clearQuantityFieldValidation($quantityInput);
        $quantityInput.val('');
      }
      if ($conditional.length) {
        $conditional.addClass('govuk-checkboxes__conditional--hidden');
      }
    }
  });

  applyActionFilters();
  syncAacForCurrentParcel();
  if (typeof window.__grasslandsApplyPreviousAgreementGreyOut === 'function') {
    window.__grasslandsApplyPreviousAgreementGreyOut();
  }
}

function syncAacForCurrentParcel() {
  if (!window.SfiGrasslandsV3Aac) {
    return;
  }

  if (!window.SfiGrasslandsV3Aac.isEnabled()) {
    window.SfiGrasslandsV3Aac.setParcel(null, null, []);
    updateAacParcelAreaBreakdown();
    return;
  }

  if (!currentSelectedParcel || !parcelData[currentSelectedParcel]) {
    window.SfiGrasslandsV3Aac.setParcel(null, null, []);
    updateAacParcelAreaBreakdown();
    return;
  }

  // Only calculate for land-cover eligible actions currently shown for this parcel
  var actionCodes = currentAvailableActions.length
    ? currentAvailableActions
    : getParcelAvailableActions(parcelData[currentSelectedParcel]);

  window.SfiGrasslandsV3Aac.setParcel(
    currentSelectedParcel,
    parcelData[currentSelectedParcel],
    actionCodes
  );
  updateAacParcelAreaBreakdown();
}

function formatBreakdownHa(value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return numeric.toFixed(4) + ' ha';
}

function formatBreakdownNumber(value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return numeric.toFixed(4);
}

function isPreviousAgreementsToggleOn() {
  if (window.SfiGrasslandsV3FeatureToggles) {
    return window.SfiGrasslandsV3FeatureToggles.getQueryFlag('previousAgreements') ||
      window.SfiGrasslandsV3FeatureToggles.getSessionFlag('sfiGrasslandsV3ShowPreviousAgreements');
  }
  try {
    if (new URLSearchParams(window.location.search).get('previousAgreements') === '1') {
      return true;
    }
    return window.sessionStorage.getItem('sfiGrasslandsV3ShowPreviousAgreements') === '1';
  } catch (error) {
    return false;
  }
}

function hideAacPreviousAgreementsDetails() {
  var detailsEl = document.getElementById('aac-parcel-area-details');
  var listEl = document.getElementById('aac-parcel-area-breakdown-list');
  var summaryEl = document.getElementById('aac-parcel-area-details-summary');
  if (detailsEl) {
    detailsEl.hidden = true;
    detailsEl.open = false;
  }
  if (listEl) {
    listEl.innerHTML = '';
  }
  if (summaryEl) {
    summaryEl.textContent = 'View existing agreements';
  }
}

function updateAacParcelAreaBreakdown() {
  var container = document.getElementById('aac-parcel-summary');
  var totalEl = document.getElementById('aac-actions-total-area');
  var referenceEl = document.getElementById('aac-parcel-reference');
  var landCoverEl = document.getElementById('aac-parcel-land-cover');
  var detailsEl = document.getElementById('aac-parcel-area-details');
  var listEl = document.getElementById('aac-parcel-area-breakdown-list');
  var bottomPanels = document.querySelector('.app-bottom-panels');
  if (!container) {
    return;
  }

  var aacOn = window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled();
  if (bottomPanels) {
    bottomPanels.classList.toggle('app-bottom-panels--aac', Boolean(aacOn));
  }

  if (!aacOn || !currentSelectedParcel || !parcelData[currentSelectedParcel]) {
    container.hidden = true;
    hideAacPreviousAgreementsDetails();
    updateAacActionsIntro();
    if (totalEl) {
      totalEl.textContent = '—';
    }
    if (referenceEl) {
      referenceEl.textContent = '—';
    }
    if (landCoverEl) {
      landCoverEl.textContent = '—';
    }
    return;
  }

  if (typeof window.SfiGrasslandsV3Aac.getParcelAreaBreakdown !== 'function') {
    container.hidden = true;
    hideAacPreviousAgreementsDetails();
    updateAacActionsIntro();
    return;
  }

  var parcel = parcelData[currentSelectedParcel];
  applyPrototypeParcelAreas(currentSelectedParcel);
  var breakdown = window.SfiGrasslandsV3Aac.getParcelAreaBreakdown(
    currentSelectedParcel,
    parcel
  );

  var parcelReference = formatParcelReference(
    Object.assign({ id: currentSelectedParcel, parcelId: currentSelectedParcel }, parcel)
  );
  if (referenceEl) {
    referenceEl.textContent = parcelReference;
  }
  var changeHiddenEl = document.getElementById('aac-parcel-change-hidden');
  if (changeHiddenEl) {
    changeHiddenEl.textContent = parcelReference
      ? (' land parcel ' + parcelReference)
      : ' land parcel';
  }
  var landCovers = breakdown.landCovers || [];
  if (landCoverEl) {
    if (landCovers.length) {
      renderLandCoverSummary(landCoverEl, landCovers);
    } else {
      var fallbackNames = getParcelLandCovers(parcel.landCover);
      var fallbackTotal = Number(breakdown.totalHa || parcel.totalArea);
      var fallbackCovers = window.SfiGrasslandsV3ParcelReference &&
        typeof window.SfiGrasslandsV3ParcelReference.allocateLandCoverAreas === 'function'
        ? window.SfiGrasslandsV3ParcelReference.allocateLandCoverAreas(fallbackNames, fallbackTotal)
        : fallbackNames.map(function(name) {
          return { name: name, ha: fallbackTotal };
        });
      renderLandCoverSummary(landCoverEl, fallbackCovers);
    }
  }
  if (totalEl) {
    var totalText = formatBreakdownNumber(breakdown.totalHa);
    totalEl.textContent = totalText === '—' ? '—' : (totalText + ' ha');
  }

  container.hidden = false;

  // Existing agreements details (toggle on + parcel has agreements)
  var previousAgreements = getPreviousAgreementsForParcel(currentSelectedParcel);
  var detailsSummaryEl = document.getElementById('aac-parcel-area-details-summary');

  if (detailsEl && listEl) {
    var showPreviousAgreements = isPreviousAgreementsToggleOn();
    var hasPrevious = previousAgreements.length > 0;
    listEl.innerHTML = '';
    if (showPreviousAgreements && hasPrevious) {
      if (detailsSummaryEl) {
        detailsSummaryEl.textContent = 'View existing agreements';
      }
      previousAgreements.forEach(function(agreement, index) {
        var block = document.createElement('div');
        block.className = 'app-existing-agreement' +
          (index < previousAgreements.length - 1 ? ' govuk-!-margin-bottom-6' : '');

        if (agreement.scheme) {
          var heading = document.createElement('h3');
          heading.className = 'govuk-heading-s govuk-!-margin-bottom-2';
          heading.textContent = agreement.scheme;
          block.appendChild(heading);
        }

        var list = document.createElement('dl');
        list.className = 'govuk-summary-list govuk-!-margin-bottom-0';

        if (agreement.endDate) {
          appendPreviousAgreementSummaryRow(list, 'Agreement ends', agreement.endDate);
        }

        var actionLabels = (agreement.actions || []).map(function(action) {
          return window.SfiGrasslandsV3ExistingAgreements &&
            typeof window.SfiGrasslandsV3ExistingAgreements.formatLabel === 'function'
            ? window.SfiGrasslandsV3ExistingAgreements.formatLabel(action)
            : ((action.name || '') + (action.code ? ' (' + action.code + ')' : ''));
        }).filter(Boolean);

        if (actionLabels.length) {
          appendPreviousAgreementSummaryRow(
            list,
            actionLabels.length === 1 ? 'Existing action' : 'Existing actions',
            actionLabels.join(', ')
          );
        }

        var areaHa = null;
        (agreement.actions || []).forEach(function(action) {
          if (action.ha != null && Number.isFinite(Number(action.ha))) {
            areaHa = (areaHa == null ? 0 : areaHa) + Number(action.ha);
          }
        });
        if (areaHa != null) {
          appendPreviousAgreementSummaryRow(
            list,
            'Area',
            (Math.round(areaHa * 10000) / 10000).toFixed(4) + ' ha'
          );
        } else if (agreement.availableArea) {
          appendPreviousAgreementSummaryRow(list, 'Area', agreement.availableArea);
        }

        block.appendChild(list);
        listEl.appendChild(block);
      });
      detailsEl.hidden = false;
      detailsEl.open = false;
    } else {
      hideAacPreviousAgreementsDetails();
    }
  }

  updateAacActionsIntro();
}

function escapeHtmlText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateActionsList(availableActions) {
  currentAvailableActions = Array.isArray(availableActions) ? availableActions.slice() : [];

  resetActionSelectionUiState();
  applyActionFilters();
}

$(document).ready(function(){

  // Initialize parcelSelections from session data if available
  var sessionDataElement = document.getElementById('session-data');
  if (sessionDataElement) {
    try {
      var sessionDataStr = sessionDataElement.textContent;
      var sessionData = JSON.parse(sessionDataStr);
      if (sessionData && typeof sessionData === 'object') {
        parcelSelections = sessionData;
        // Update the summary display on page load
        setTimeout(function() {
          updateApplicationSummary();
          // Show the accordion section
          $('#parcels-actions-summary-section').show();
          enableReturnFromCheckYourAnswersFlow();
        }, 100);
      }
    } catch(e) {
      console.error('Error parsing session data:', e);
    }
  }

  var editFocus = { actionCode: null, fromCheckYourAnswers: false };
  try {
    var editFocusEl = document.getElementById('edit-focus-json');
    if (editFocusEl) {
      editFocus = JSON.parse(editFocusEl.textContent) || editFocus;
    }
  } catch (editFocusErr) {
    console.warn('Could not parse edit focus', editFocusErr);
  }

  var cameFromCheckYourAnswers = editFocus.fromCheckYourAnswers ||
    sessionStorage.getItem('editingFromCheckYourAnswers') === 'true';

  if (cameFromCheckYourAnswers) {
    sessionStorage.setItem('editingFromCheckYourAnswers', 'true');
  }

  function enableReturnFromCheckYourAnswersFlow() {
    if (!cameFromCheckYourAnswers) {
      $('#return-to-cya-link').hide();
      return;
    }

    $('#return-to-cya-link').show();
  }

  $('#return-to-cya-link').on('click', function() {
    sessionStorage.removeItem('editingFromCheckYourAnswers');
  });
  
  // Check if user came from check-your-answers with a specific parcel to edit
  var selectedParcelId = sessionStorage.getItem('selectedParcelId');
  var selectedActionCode = editFocus.actionCode || sessionStorage.getItem('selectedActionCode');

  // Change links redirect with #quantity-code. Read it, then strip the hash so the
  // browser does not try to jump before the quantity field exists in the DOM.
  try {
    var hashMatch = (window.location.hash || '').match(/^#quantity-([a-z0-9]+)$/i);
    if (hashMatch) {
      selectedActionCode = selectedActionCode || String(hashMatch[1]).toUpperCase();
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(
          {},
          '',
          window.location.pathname + window.location.search
        );
      }
    }
  } catch (hashErr) {
    // Ignore hash parsing issues.
  }

  if (selectedActionCode) {
    sessionStorage.removeItem('selectedActionCode');
    queueActionFocus(selectedActionCode);
  }
  if (selectedParcelId) {
    // Clear the stored parcel ID
    sessionStorage.removeItem('selectedParcelId');
    
    // Select the parcel after a short delay to ensure map is ready
    setTimeout(function() {
      selectParcel(selectedParcelId);
      
      // Zoom to the parcel
      if (parcelPolygons[selectedParcelId]) {
        map.fitBounds(parcelPolygons[selectedParcelId].getBounds(), {padding: [50, 50]});
      }

      enableReturnFromCheckYourAnswersFlow();
    }, 500);
  } else if (cameFromCheckYourAnswers) {
    enableReturnFromCheckYourAnswersFlow();
  } else {
    $('#return-to-cya-link').hide();
  }

  // Draft parcel restore runs after feature toggles (including AAC) are wired —
  // see restoreDraftParcelAfterToggles() below. Scheduling it here raced AAC init.


  // Handle click on "Apply actions to this parcel" link in map popups
  $(document).on('click', '.apply-actions-to-parcel-link', function(e) {
    e.preventDefault();
    var parcelId = $(this).attr('data-parcel-id');
    if (!parcelId) {
      return;
    }

    selectParcel(parcelId);

    setTimeout(function() {
      var actionsSection = document.getElementById('actions-section');
      if (actionsSection) {
        actionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  });

  // Handle click on "view existing actions" link (including those in popups)
  $(document).on('click', '#view-existing-actions-link', function(e) {
    e.preventDefault();
    
    // Open the "Parcels with existing actions" accordion section first
    var $existingSection = $('#application-summary-accordion .govuk-accordion__section').eq(1);
    if (!$existingSection.hasClass('govuk-accordion__section--expanded')) {
      $existingSection.find('.govuk-accordion__section-button').click();
    }
    
    // Get the target ID from the link's href
    var targetId = $(this).attr('href');
    
    // Scroll to the specific parcel heading
    setTimeout(function() {
      var targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({behavior: 'smooth', block: 'start'});
      }
    }, 300);
  });

  // Handle click on back-to-top link for smooth scrolling because some farmers, especially older ones, 
  // thought they were on a different page when they got to the accordion section, 
  // so we want them to see the link to return to the top to orient them.
  // We also want them to see themselves being taken back to the top, not just 'appear' there suddenly.
  $(document).on('click', '.back-to-top a', function(e) {
    e.preventDefault();
    var targetId = $(this).attr('href');
    var targetElement = document.querySelector(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  });
  
  // Handle click on Change links in "Actions you've just added" section
  $(document).on('click', '.summary-action-change', function(e) {
    e.preventDefault();
    console.log('Change link clicked');
    var targetParcelId = $(this).attr('data-parcel-id');
    var targetActionCode = $(this).attr('data-action-code');
    console.log('Target parcel ID:', targetParcelId);

    if (targetActionCode) {
      queueActionFocus(targetActionCode);
    }
    
    if (targetParcelId) {
      // Select the parcel
      console.log('Calling selectParcel');
      selectParcel(targetParcelId);
      
      // Wait for the UI to update, then restore the saved state
      setTimeout(function() {
        console.log('Calling restoreParcelState');
        restoreParcelState(targetParcelId);
      }, 250);
    }
  });
  
  // Function to update the application summary
  function updateApplicationSummary() {
    var $summaryContainer = $('#application-summary-list');
    var $emptyMessage = $('#application-summary-empty');
    var $introText = $('#application-summary-intro');
    
    // Clear existing content
    $summaryContainer.empty();
    
    // Check if there are any selections
    var hasSelections = false;
    var grandTotalPayment = 0;
    
    // Iterate through parcel selections
    Object.keys(parcelSelections).forEach(function(parcelId) {
      var parcelSelection = parcelSelections[parcelId];
      
      if (parcelSelection.actions && parcelSelection.actions.length > 0) {
        hasSelections = true;
        
        var parcel = parcelData[parcelId];
        var parcelReference = parcel ? formatParcelReference(parcel) : parcelId;
        
        // Create container for heading and remove link
        var $headingContainer = $('<div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px;"></div>');
        
        // Create H2 heading for parcel name
        var $parcelHeading = $('<h2 class="govuk-heading-s" style="margin: 0;"></h2>').text(parcelReference);
        
        // Create remove link
        var $removeLink = $('<a class="govuk-link" href="#" style="font-size: 19px; line-height: 1.31579;"></a>')
          .text('Remove all actions')
          .attr('data-parcel-id', parcelId)
          .on('click', function(e) {
            e.preventDefault();
            var targetParcelId = $(this).attr('data-parcel-id');
            
            // Remove the parcel from parcelSelections
            delete parcelSelections[targetParcelId];
            
            // Update the summary display
            updateApplicationSummary();
          });
        
        $headingContainer.append($parcelHeading).append($removeLink);
        $summaryContainer.append($headingContainer);
        
        // Create summary list
        var $summaryList = $('<dl class="govuk-summary-list govuk-!-margin-bottom-9"></dl>');
        
        // Add total area row
        var $totalAreaRow = $('<div class="govuk-summary-list__row"></div>');
        var $totalAreaKey = $('<dt class="govuk-summary-list__key"></dt>').text('Total area');
        var $totalAreaValue = $('<dd class="govuk-summary-list__value"></dd>').text(parcel.totalArea + ' ha');
        $totalAreaRow.append($totalAreaKey).append($totalAreaValue);
        $summaryList.append($totalAreaRow);
        
        // Calculate total area used by actions
        // Supplements stack on the base (same land) — do not double-count hectares
        var totalUsedArea = 0;
        parcelSelection.actions.forEach(function(action) {
          if (
            action.quantity &&
            getQuantityUnitForAction(action.code) === 'ha' &&
            !isClig3Supplement(action.code)
          ) {
            totalUsedArea += parseFloat(action.quantity);
          }
        });
        
        // Add area used row
        var $areaUsedRow = $('<div class="govuk-summary-list__row"></div>');
        var $areaUsedKey = $('<dt class="govuk-summary-list__key"></dt>').text('Area used for actions');
        var $areaUsedValue = $('<dd class="govuk-summary-list__value"></dd>').text(totalUsedArea.toFixed(4) + ' ha');
        $areaUsedRow.append($areaUsedKey).append($areaUsedValue);
        $summaryList.append($areaUsedRow);
        
        // Add individual rows for each action with Change link (GOV.UK pattern)
        var totalPayment = 0;
        
        parcelSelection.actions.forEach(function(action) {
          var $actionRow = $('<div class="govuk-summary-list__row"></div>');
          var $actionKey = $('<dt class="govuk-summary-list__key"></dt>');
          $actionKey.append(document.createTextNode(action.name + ' (' + action.code + ')'));
          var consentHintLines = getActionConsentHintLines(action.code, parcelId);
          consentHintLines.forEach(function(line) {
            $actionKey.append(
              $('<div class="govuk-body govuk-!-font-size-16 govuk-!-margin-top-1 govuk-!-margin-bottom-0"></div>')
                .text(line)
            );
          });
          var $actionValue = $('<dd class="govuk-summary-list__value"></dd>');
          
          var payment = null;
          var valueText = '';
          var quantityUnit = getQuantityUnitForAction(action.code);
          var quantityValue = Number(action.quantity);
          
          if (Number.isFinite(quantityValue) && quantityValue > 0) {
            payment = calculateActionYearlyPayment(action.code, quantityValue);

            var quantityDisplay;
            if (isPondUnit(quantityUnit)) {
              quantityDisplay = formatPondCount(quantityValue);
            } else if (isMetreBasedUnit(quantityUnit)) {
              quantityDisplay = Math.round(quantityValue).toLocaleString('en-GB') + ' ' + quantityUnit;
            } else {
              quantityDisplay = quantityValue.toFixed(4) + ' ' + quantityUnit;
            }

            if (payment !== null) {
              totalPayment += payment;
              valueText = quantityDisplay + ' (' + formatCurrencyGBP(payment) + ')';
            } else {
              valueText = quantityDisplay;
            }
          } else if (action.quantity) {
            valueText = String(action.quantity) + ' ' + quantityUnit;
          } else {
            valueText = isPondUnit(quantityUnit) ? 'No ponds entered' : 'No area entered';
          }
          
          $actionValue.text(valueText);
          
          // Add Change link
          var $actionActions = $('<dd class="govuk-summary-list__actions"></dd>');
          var $changeLink = $('<a class="govuk-link summary-action-change" href="#"></a>')
            .text('Change')
            .attr('data-parcel-id', parcelId)
            .attr('data-action-code', action.code);
          
          $actionActions.append($changeLink);
          
          $actionRow.append($actionKey).append($actionValue).append($actionActions);
          $summaryList.append($actionRow);
        });
        
        // Add total payment row if there are payments
        if (totalPayment > 0) {
          var $paymentRow = $('<div class="govuk-summary-list__row"></div>');
          var $paymentKey = $('<dt class="govuk-summary-list__key"></dt>').text('Yearly payment for this parcel');
          var $paymentValue = $('<dd class="govuk-summary-list__value"></dd>').html('<strong>' + formatCurrencyGBP(totalPayment) + '</strong>');
          $paymentRow.append($paymentKey).append($paymentValue);
          $summaryList.append($paymentRow);
          
          // Add to grand total
          grandTotalPayment += totalPayment;
        }
        
        // Append the summary list to the container
        $summaryContainer.append($summaryList);
      }
    });
    
    // Add total payments for all parcels if there are any payments
    if (hasSelections && grandTotalPayment > 0) {
      var $grandTotalList = $('<dl class="govuk-summary-list" style="margin-top: 30px;"></dl>');
      var $grandTotalRow = $('<div class="govuk-summary-list__row"></div>');
      var $grandTotalKey = $('<dt class="govuk-summary-list__key"></dt>').text('Total yearly payment');
      var $grandTotalValue = $('<dd class="govuk-summary-list__value"></dd>').html('<strong>' + formatCurrencyGBP(grandTotalPayment) + '</strong>');
      $grandTotalRow.append($grandTotalKey).append($grandTotalValue);
      $grandTotalList.append($grandTotalRow);
      $summaryContainer.append($grandTotalList);
    }
    
    // Show/hide appropriate elements
    if (hasSelections) {
      $introText.show();
      $summaryContainer.show();
      $emptyMessage.hide();
    } else {
      $introText.hide();
      $summaryContainer.hide();
      $emptyMessage.show();
    }
  }
  
  // Prefer catalog name — supplement checkboxes only label with the code
  function getActionName(actionCode) {
    var code = String(actionCode || '').toUpperCase();
    if (actionNameByCode[code]) {
      return actionNameByCode[code];
    }

    var $checkbox = $('input[value="' + actionCode + '"]');
    var labelText = $checkbox.siblings('.govuk-checkboxes__label').text().trim();

    // Extract just the action name (before the colon and code)
    var parts = labelText.split(':');
    if (parts.length > 1) {
      return parts[0].trim();
    }
    return labelText || code;
  }
  
  // Function to capture current parcel state
  function captureCurrentParcelState() {
    if (!currentSelectedParcel) return;
    
    var actions = [];
    
    // Get all checked actions for current parcel
    $('input[name="actions"]:checked').each(function() {
      var $checkbox = $(this);
      var actionCode = $checkbox.val();
      if (currentAvailableActions.indexOf(actionCode) === -1) {
        return;
      }
      var $item = $checkbox.closest('.govuk-checkboxes__item');
      if (
        $item.attr('data-available-for-parcel') === 'false' ||
        $item.is('[hidden]') ||
        $item.css('display') === 'none'
      ) {
        return;
      }
      var actionName = getActionName(actionCode);
      
      // Get quantity if entered (strip thousand separators like "2,166")
      var $quantityInput = $('#quantity-' + actionCode.toLowerCase());
      var parsed = parseQuantityInput($quantityInput.val());
      var quantity = parsed.valid ? String(parsed.value) : null;
      var quantityUnit = getQuantityUnitForAction(actionCode);
      var annualPayment = parsed.valid
        ? calculateActionYearlyPayment(actionCode, parsed.value)
        : null;
      
      actions.push({
        code: actionCode,
        name: actionName,
        quantity: quantity,
        unit: quantityUnit,
        annualPayment: annualPayment
      });
    });
    
    // Update or create parcel selection
    if (actions.length > 0) {
      parcelSelections[currentSelectedParcel] = {
        parcelId: currentSelectedParcel,
        parcelName: formatParcelReference(Object.assign({ id: currentSelectedParcel, parcelId: currentSelectedParcel }, parcelData[currentSelectedParcel])),
        osRef: formatParcelReference(Object.assign({ id: currentSelectedParcel, parcelId: currentSelectedParcel }, parcelData[currentSelectedParcel])),
        parcelReference: formatParcelReference(Object.assign({ id: currentSelectedParcel, parcelId: currentSelectedParcel }, parcelData[currentSelectedParcel])),
        actions: actions
      };
    } else {
      // Remove parcel if no actions selected
      delete parcelSelections[currentSelectedParcel];
    }
    
    updateApplicationSummary();
  }
  
  // Don't select any parcel by default - let user choose from the map or list
  // Update UI to show no selection
  document.getElementById('actions-heading').textContent = 'Available actions';
  
  // Hide all action checkboxes initially
  applyActionFilters();
  
  // Function to update available quantities based on what's been entered
  function updateAvailableQuantities(options) {
    options = options || {};
    if (!currentSelectedParcel || !parcelData[currentSelectedParcel]) return;

    // AAC mode owns available-area hints and which actions stay visible
    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      syncAllWholeRemainingAreaActions();
      return;
    }

    var parcel = parcelData[currentSelectedParcel];
    var totalAreaHa = parseFloat(parcel.availableArea);
    var totalAreaM = getLinearAvailableMetres(parcel);
    var totalAreaM2 = getBuildingSquareMetresAvailable(parcel);
    var totals = calculateParcelQuantityTotals();
    var remainingHa = Math.max(0, totalAreaHa - totals.ha);
    var remainingM = Math.max(0, totalAreaM - totals.m);
    var remainingM2 = Math.max(0, totalAreaM2 - (totals.m2 || 0));
    var isOverLimitHa = totals.ha > totalAreaHa;
    var isOverLimitM = totals.m > totalAreaM;
    var isOverLimitM2 = (totals.m2 || 0) > totalAreaM2;
    // Pond count is user-declared — do not over-limit against parcel hectares
    var isOverLimit = isOverLimitHa || isOverLimitM || isOverLimitM2;

    // Update label available hints (quantity fields no longer show available copy)
    $('.govuk-checkboxes__conditional').each(function() {
      var $conditional = $(this);
      var $suffix = $conditional.find('.govuk-input__suffix');
      var actionCode = $conditional.attr('id').replace('conditional-', '').toUpperCase();

      if (isCnum2UnavailableToggleOn() && actionCode === 'CNUM2') {
        setActionAvailableHint(actionCode, 0);
        return;
      }

      if (isPondUnit($suffix.text())) {
        setActionAvailableHint(actionCode, null);
        return;
      }

      if ($suffix.text() === 'ha') {
        setActionAvailableHint(actionCode, remainingHa);
      } else if ($suffix.text() === 'm') {
        setActionAvailableHint(actionCode, remainingM);
      } else if ($suffix.text() === 'm²') {
        setActionAvailableHint(actionCode, remainingM2);
      }
    });

    // CLIG3 has no quantity input — show remaining pool until selected, then 0
    setActionAvailableHint('CLIG3', getClig3AvailableHintAmount());
    mirrorClig3SupplementAvailableHints();

    // Tier 1: live over-limit validation
    $('input[id^="quantity-"]').each(function() {
      var $input = $(this);
      var errors = getQuantityErrorsStore($input);
      var $checkbox = getQuantityCheckbox($input);
      errors.overLimit = null;

      if (!$checkbox.is(':checked')) {
        refreshQuantityFieldDisplay($input);
        return;
      }

      var suffix = $input.siblings('.govuk-input__suffix').text();
      var parsed = parseQuantityInput($input.val());

      if (isOverLimit && parsed.valid) {
        if (suffix === 'ha' && isOverLimitHa) {
          errors.overLimit = 'Total area exceeds ' + totalAreaHa + ' available on this parcel';
        } else if (suffix === 'm' && isOverLimitM) {
          errors.overLimit = 'Total metres exceeds ' + Math.max(0, Math.round(totalAreaM)).toLocaleString('en-GB') + ' available on this parcel';
        } else if (suffix === 'm²') {
          // HEF1 has no known available AAC — do not block on a prototype estimate
        }
      }

      refreshQuantityFieldDisplay($input);
    });

    // Check if all available area is used (but not exceeded).
    // Only lock other options while something is still selected.
    var hasCheckedActions = $('input[name="actions"]:checked').length > 0;
    if (hasCheckedActions && remainingHa === 0 && !isOverLimit) {
      // Disable all unchecked, compatible (non-disabled) checkboxes
      $('input[name="actions"]').each(function() {
        var $cb = $(this);
        var $item = $cb.closest('.govuk-checkboxes__item');

        // Only disable if: not checked, visible, and not already disabled due to compatibility
        if (!$cb.is(':checked') && $item.css('display') !== 'none' && !$cb.prop('disabled')) {
          $cb.prop('disabled', true);
          $cb.attr('data-disabled-reason', 'area-full');
          $item.css('opacity', '');

          var $label = $cb.siblings('.govuk-checkboxes__label');
          if (!$label.find('.area-full-hint').length) {
            $label.append('<span class="area-full-hint" style="display: block; font-size: 16px; color: #505a5f; font-weight: normal; margin-top: 5px;">All available area on land parcel used</span>');
          }
        }
      });
    } else {
      // Re-enable checkboxes that were disabled due to area being full
      $('input[name="actions"]').each(function() {
        var $cb = $(this);
        if ($cb.attr('data-disabled-reason') === 'area-full') {
          $cb.prop('disabled', false);
          $cb.removeAttr('data-disabled-reason');

          var $item = $cb.closest('.govuk-checkboxes__item');
          $item.css('opacity', '');
          $cb.siblings('.govuk-checkboxes__label').find('.area-full-hint').remove();
        }
      });
    }

    // Compatibility is rebuilt separately after the simulated API call.
    // Skip here so area-full hints are not wiped by a second full reset.
    if (!options.skipCompatibilityUpdate) {
      updateCompatibilityState();
    }

    syncAllWholeRemainingAreaActions();
  }

  function validateBeforeSave() {
    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled() && window.SfiGrasslandsV3Aac.isBusy()) {
      return false;
    }

    hideQuantityErrorSummary();

    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      // AAC: format (invalid characters) + over-limit against remaining available
      $('input[name="actions"]:checked').each(function() {
        var actionCode = ($(this).val() || '').toString();
        var $quantityInput = $('#quantity-' + actionCode.toLowerCase());
        $quantityInput.data('blurred', true);
        updateQuantityFormatErrors($quantityInput);
      });
      // On Continue, check every quantity — live UI only flags the last edited field
      updateAacQuantityOverLimitErrors({ all: true });
    } else {
      $('input[name="actions"]:checked').each(function() {
        var actionCode = ($(this).val() || '').toString();
        var $quantityInput = $('#quantity-' + actionCode.toLowerCase());
        $quantityInput.data('blurred', true);
        updateQuantityFormatErrors($quantityInput);
      });
      updateAvailableQuantities();
    }

    var summaryErrors = [];

    $('input[name="actions"]:checked').each(function() {
      var actionCode = ($(this).val() || '').toString();
      var $quantityInput = $('#quantity-' + actionCode.toLowerCase());
      var errors = getQuantityErrorsStore($quantityInput);

      if (errors.format || errors.overLimit) {
        summaryErrors.push({
          fieldId: $quantityInput.attr('id'),
          linkText: getActionName(actionCode) + ': ' + actionCode
        });
      }
    });

    if (summaryErrors.length === 0) {
      return true;
    }

    showQuantityErrorSummary(summaryErrors);

    var $summary = $('#quantity-error-summary');
    if ($summary.length) {
      $('html, body').animate({
        scrollTop: $summary.offset().top - 20
      }, 300);
    }

    return false;
  }

  // Tier 1: live over-limit updates; show format errors for clearly invalid input
  // AAC mode: only show format errors for invalid characters (e.g. "d") — not over-limit here.
  // Live available-hint updates are debounced (see scheduleAacQuantityLiveUpdate).
  $(document).on('input', 'input[id^="quantity-"]', function() {
    var $input = $(this);
    var inputEl = this;

    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      if (hasClearlyInvalidQuantityInput($input.val())) {
        clearQuantityAacDebounce();
        updateQuantityFormatErrors($input);
      } else {
        var aacErrors = getQuantityErrorsStore($input);
        aacErrors.format = null;
        refreshQuantityFieldDisplay($input);
        scheduleAacQuantityLiveUpdate(inputEl);
      }
      return;
    }

    if ($input.data('blurred') || hasClearlyInvalidQuantityInput($input.val())) {
      updateQuantityFormatErrors($input);
    } else {
      var errors = getQuantityErrorsStore($input);
      errors.format = null;
      refreshQuantityFieldDisplay($input);
    }

    updateAvailableQuantities();
  });

  // Tier 2: format validation when the user leaves the field (default / non-AAC only)
  $(document).on('blur', 'input[id^="quantity-"]', function() {
    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      return;
    }

    var $input = $(this);
    $input.data('blurred', true);
    updateQuantityFormatErrors($input);
    updateAvailableQuantities();
  });
  
  // Update quantities when parcel changes
  var originalSelectParcel = selectParcel;
  selectParcel = function(parcelId) {
    if (window.SfiGrasslandsV3ActionsCompatibilityLoading) {
      window.SfiGrasslandsV3ActionsCompatibilityLoading.reset();
    }

    hideQuantityErrorSummary();
    resetActionSelectionUiState();

    originalSelectParcel(parcelId);
    
    // Clear all quantity inputs
    $('input[id^="quantity-"]').val('');
    
    // Re-enable all checkboxes and clear all hints when changing parcels
    $('input[name="actions"]').each(function() {
      $(this).prop('disabled', false);
      $(this).removeAttr('data-disabled-reason');
      $(this).closest('.govuk-checkboxes__item').css('opacity', '1').removeClass('sfi-compatibility-disabled');
      $(this).siblings('.govuk-checkboxes__label').find(
        '.compatibility-hint, .area-full-hint, .sfi-compatibility-option-hint, .previous-agreement-area-hint'
      ).remove();
    });
    
    // Reset label available hints when changing parcels (default mode only —
    // AAC owns availability copy when enabled). Quantity fields have no available hint.
    if (parcelData[parcelId] && !(window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled())) {
      var parcel = parcelData[parcelId];
      $('.govuk-checkboxes__conditional').each(function() {
        var $conditional = $(this);
        var $suffix = $conditional.find('.govuk-input__suffix');
        var actionCode = $conditional.attr('id').replace('conditional-', '').toUpperCase();

        if (isCnum2UnavailableToggleOn() && actionCode === 'CNUM2') {
          setActionAvailableHint(actionCode, 0);
        } else if (isPondUnit($suffix.text())) {
          setActionAvailableHint(actionCode, null);
        } else if ($suffix.text() === 'ha') {
          setActionAvailableHint(actionCode, parcel.availableArea);
        } else if ($suffix.text() === 'm') {
          setActionAvailableHint(actionCode, getLinearAvailableMetres(parcel));
        } else if ($suffix.text() === 'm²') {
          setActionAvailableHint(actionCode, getBuildingSquareMetresAvailable(parcel));
        }
      });
      setActionAvailableHint('CLIG3', parcel.availableArea);
    }

    applyActionFilters();

    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      // AAC owns availability — do not re-apply the full compatibility matrix
      if (window.SfiGrasslandsV3ActionsCompatibilityLoading) {
        if (typeof window.SfiGrasslandsV3ActionsCompatibilityLoading.setSuspended === 'function') {
          window.SfiGrasslandsV3ActionsCompatibilityLoading.setSuspended(true);
        }
        if (typeof window.SfiGrasslandsV3ActionsCompatibilityLoading.resetCompatibilityState === 'function') {
          window.SfiGrasslandsV3ActionsCompatibilityLoading.resetCompatibilityState();
        }
      }
      syncAacForCurrentParcel();
    } else {
      updateCompatibilityState();
      updateAvailableQuantities();
    }

    // After AAC / compatibility, lock actions already used in a previous agreement
    applyGreyOutCnum2();
    updatePreviousAgreementsSummary(parcelId);
  };
  

  function buildDraftLandActionsPayload() {
    var actions = [];
    $('input[name="actions"]:checked').each(function() {
      var $checkbox = $(this);
      var actionCode = $checkbox.val();
      // Never save actions that are not eligible for this parcel (e.g. WBD1 on Temporary grass)
      if (currentAvailableActions.indexOf(actionCode) === -1) {
        return;
      }
      var $item = $checkbox.closest('.govuk-checkboxes__item');
      if (
        $item.attr('data-available-for-parcel') === 'false' ||
        $item.is('[hidden]') ||
        $item.css('display') === 'none'
      ) {
        return;
      }
      var actionName = getActionName(actionCode);
      var $quantityInput = $('#quantity-' + actionCode.toLowerCase());
      var quantityUnit = getQuantityUnitForAction(actionCode);
      var paymentRate = paymentRates[String(actionCode || '').toUpperCase()] || null;
      var parsed = parseQuantityInput($quantityInput.val());

      if (!parsed.valid) {
        return;
      }

      var quantity = String(parsed.value);
      var yearlyPayment = calculateActionYearlyPayment(actionCode, parsed.value);

      actions.push({
        code: actionCode,
        name: actionName,
        quantity: quantity,
        unit: quantityUnit,
        paymentRate: paymentRate,
        yearlyPayment: yearlyPayment
      });
    });
    return actions;
  }

  function hideActionsSelectionError() {
    var $summary = $('#actions-selection-error-summary');
    var $formGroup = $('#actions-form-group');
    var $checkboxes = $('#actions-checkboxes-container');
    var $fieldError = $('#actions-selection-error');
    var $fieldset = $formGroup.find('fieldset').first();

    $summary.prop('hidden', true).attr('aria-hidden', 'true');
    $('#actions-selection-error-summary-list').empty();
    $formGroup.removeClass('govuk-form-group--error');
    $checkboxes.removeClass('app-actions-checkboxes--error');
    $fieldError.prop('hidden', true);
    $fieldset.removeAttr('aria-describedby');
  }

  function showActionsSelectionError(message) {
    var errorMessage = message || 'Select at least one action';
    var $summary = $('#actions-selection-error-summary');
    var $list = $('#actions-selection-error-summary-list');
    var $formGroup = $('#actions-form-group');
    var $checkboxes = $('#actions-checkboxes-container');
    var $fieldError = $('#actions-selection-error');
    var $fieldset = $formGroup.find('fieldset').first();

    $list.html(
      '<li><a href="#actions-checkboxes-container">' + errorMessage + '</a></li>'
    );
    $summary.prop('hidden', false).attr('aria-hidden', 'false');
    $formGroup.removeClass('govuk-form-group--error');
    $checkboxes.addClass('app-actions-checkboxes--error');
    $fieldError.html('<span class="govuk-visually-hidden">Error:</span> ' + errorMessage).prop('hidden', false);
    $fieldset.attr('aria-describedby', 'actions-selection-error');

    if ($summary.length) {
      $summary[0].focus();
      $('html, body').animate({
        scrollTop: $summary.offset().top - 20
      }, 300);
    }
  }

  function refreshContinueFromActionSelection() {
    var actions = buildDraftLandActionsPayload();
    if (actions.length > 0) {
      hideActionsSelectionError();
    }
    return actions;
  }

  function getActionCode($input) {
    return (($input.val() || '').toString().trim()).toUpperCase();
  }

  function getSelectedActionCodes() {
    return $('input[name="actions"]:checked').map(function() {
      var code = getActionCode($(this));
      if (currentAvailableActions.indexOf(code) === -1) {
        return null;
      }

      return code;
    }).get().filter(function(code) {
      return Boolean(code);
    });
  }

  function addCompatibilityHint($input, conflictAction, options) {
    var $item = $input.closest('.govuk-checkboxes__item');
    var $hint = $input.siblings('.govuk-checkboxes__hint');
    var codeLower = (getActionCode($input) || '').toLowerCase();
    var compatibilityHintId = 'compatibility-hint-' + codeLower;
    options = options || {};

    if (!$item.find('.compatibility-hint').length) {
      var selectedCode = typeof conflictAction === 'string'
        ? conflictAction
        : (conflictAction && conflictAction.code);
      var selectedName = typeof conflictAction === 'string'
        ? getActionName(conflictAction)
        : (conflictAction && conflictAction.name);
      var hintText;

      if (options.fromExistingAgreement) {
        hintText = selectedName && selectedCode
          ? ('Not compatible with ' + selectedName + ' (' + selectedCode + ') already on this parcel.')
          : 'Not compatible with an existing agreement already on this parcel.';
      } else {
        hintText = selectedName
          ? ('Not compatible with the selected action: ' + selectedName + ' (' + selectedCode + ').')
          : ('Not compatible with ' + selectedCode + '.');
      }

      var hintHtml = '<span class="compatibility-hint sfi-compatibility-option-hint" id="' + compatibilityHintId + '">' + hintText + '</span>';
      if ($hint.length) {
        $hint.append(hintHtml);
      } else {
        $input.siblings('.govuk-checkboxes__label').append(hintHtml);
      }
    }

    var describedBy = ($input.attr('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (describedBy.indexOf(compatibilityHintId) === -1) {
      describedBy.push(compatibilityHintId);
      $input.attr('aria-describedby', describedBy.join(' '));
    }
    $input.attr('aria-disabled', 'true');
    $item.addClass('sfi-compatibility-disabled');
  }

  function actionsAreIncompatible(codeA, codeB) {
    if (!codeA || !codeB) {
      return false;
    }
    // Same action is compatible with itself (matches server matrix rules).
    if (codeA === codeB) {
      return false;
    }
    var incompatibleWithA = compatibilityConfig.incompatibleByCode[codeA] || [];
    var incompatibleWithB = compatibilityConfig.incompatibleByCode[codeB] || [];
    return incompatibleWithA.indexOf(codeB) !== -1 || incompatibleWithB.indexOf(codeA) !== -1;
  }

  function getCurrentParcelIdForCompatibility() {
    if (currentSelectedParcel) {
      return currentSelectedParcel;
    }
    try {
      var draftParcelEl = document.getElementById('draft-parcel-json');
      var draftParcel = draftParcelEl ? JSON.parse(draftParcelEl.textContent) : null;
      return draftParcel && draftParcel.parcelId ? draftParcel.parcelId : null;
    } catch (error) {
      return null;
    }
  }

  function findExistingAgreementConflict(candidateCode) {
    if (!window.SfiGrasslandsV3ExistingAgreements || typeof window.SfiGrasslandsV3ExistingAgreements.get !== 'function') {
      return null;
    }
    var parcelId = getCurrentParcelIdForCompatibility();
    if (!parcelId) {
      return null;
    }
    var existingActions = window.SfiGrasslandsV3ExistingAgreements.get(parcelId);
    for (var i = 0; i < existingActions.length; i++) {
      var existingAction = existingActions[i];
      // Same code already on the parcel is fine — do not block selecting it again
      if (existingAction.code === candidateCode) {
        continue;
      }
      if (actionsAreIncompatible(existingAction.code, candidateCode)) {
        return existingAction;
      }
    }
    return null;
  }

  /**
   * Rebuild compatibility from a clean slate using currently checked actions.
   * Prefer the shared loading helper when available.
   */
  function updateCompatibilityState() {
    var loading = window.SfiGrasslandsV3ActionsCompatibilityLoading;
    if (
      loading &&
      typeof loading.resetCompatibilityState === 'function' &&
      typeof loading.calculateCompatibility === 'function' &&
      typeof loading.applyCompatibility === 'function'
    ) {
      loading.resetCompatibilityState();
      loading.applyCompatibility(
        loading.calculateCompatibility(loading.getSelectedActions())
      );
      applyGreyOutCnum2();
      return;
    }

    // Fallback if the helper script failed to load
    var selectedCodes = getSelectedActionCodes();

    $('input[name="actions"]').each(function() {
      var $input = $(this);
      var $item = $input.closest('.govuk-checkboxes__item');
      $input.prop('disabled', false);
      $input.removeAttr('disabled');
      $input.removeAttr('data-disabled-reason');
      $input.removeAttr('aria-disabled');
      $item.css('opacity', '1').removeClass('sfi-compatibility-disabled actions-api-loading-disabled');
      $item.find('.compatibility-hint, .sfi-compatibility-option-hint, .area-full-hint, .previous-agreement-area-hint').remove();
    });

    if (!selectedCodes.length) {
      applyGreyOutCnum2();
      return;
    }

    $('input[name="actions"]').each(function() {
      var $input = $(this);
      if ($input.is(':checked')) {
        return;
      }

      var candidateCode = getActionCode($input);
      var conflictWithCode = null;
      for (var i = 0; i < selectedCodes.length; i++) {
        var selectedCode = selectedCodes[i];
        if (actionsAreIncompatible(selectedCode, candidateCode)) {
          conflictWithCode = selectedCode;
          break;
        }
      }

      if (conflictWithCode) {
        $input.prop('disabled', true);
        $input.attr('data-disabled-reason', 'compatibility');
        addCompatibilityHint($input, conflictWithCode);
      }
    });

    applyGreyOutCnum2();
  }

  function getFeatureToggleQueryFlag(paramName) {
    try {
      return new URLSearchParams(window.location.search).get(paramName) === '1';
    } catch (error) {
      return false;
    }
  }

  function setSessionFlag(storageKey, enabled) {
    try {
      if (enabled) {
        window.sessionStorage.setItem(storageKey, '1');
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch (error) {
      // Ignore storage errors in private browsing.
    }
  }

  function getSessionFlag(storageKey) {
    try {
      return window.sessionStorage.getItem(storageKey) === '1';
    } catch (error) {
      return false;
    }
  }

  // Keep shareable feature-toggle state in the URL, e.g. ?allActions=1
  // AAC is always on in sfi-grasslands-v3 (not a feature toggle).
  function syncFeatureToggleQueryParams() {
    try {
      var url = new URL(window.location.href);
      var changed = false;
      var allActionsToggle = document.getElementById('show-all-mvp-actions');
      var allActionsOn = allActionsToggle
        ? Boolean(allActionsToggle.checked)
        : getFeatureToggleQueryFlag('allActions');
      var previousAgreementsToggle = document.getElementById('show-previous-agreements');
      var previousAgreementsOn = previousAgreementsToggle
        ? Boolean(previousAgreementsToggle.checked)
        : getFeatureToggleQueryFlag('previousAgreements');
      var actionDeductionsToggle = document.getElementById('show-action-deductions');
      var actionDeductionsOn = actionDeductionsToggle
        ? Boolean(actionDeductionsToggle.checked)
        : getFeatureToggleQueryFlag('actionDeductions');

      function setOrClear(paramName, enabled) {
        if (enabled) {
          if (url.searchParams.get(paramName) !== '1') {
            url.searchParams.set(paramName, '1');
            changed = true;
          }
        } else if (url.searchParams.has(paramName)) {
          url.searchParams.delete(paramName);
          changed = true;
        }
      }

      // Removed toggles — drop stale share links
      setOrClear('apiDelay', false);
      setOrClear('cnum2Unavailable', false);
      setOrClear('aacDebug', false);
      setOrClear('aac', false);
      setOrClear('allActions', allActionsOn);
      setOrClear('previousAgreements', previousAgreementsOn);
      setOrClear('actionDeductions', actionDeductionsOn);

      if (changed) {
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch (error) {
      // Ignore URL parsing issues in older browsers.
    }
  }

  function updateActionsModeIntro(aacEnabled) {
    var pageIntro = document.getElementById('actions-mode-intro');
    var aacIntro = document.getElementById('aac-actions-intro');

    // AAC: hint sits under Available actions. Compatibility: stays under the page H1.
    if (pageIntro) {
      pageIntro.hidden = Boolean(aacEnabled);
    }
    if (aacIntro) {
      aacIntro.hidden = !aacEnabled;
    }
    updateAacActionsIntro();
  }

  function setAacModeEnabled(enabled) {
    if (!window.SfiGrasslandsV3Aac) {
      return;
    }

    window.SfiGrasslandsV3Aac.setEnabled(enabled);
    updateActionsModeIntro(enabled);

    if (window.SfiGrasslandsV3ActionsCompatibilityLoading &&
        typeof window.SfiGrasslandsV3ActionsCompatibilityLoading.setSuspended === 'function') {
      window.SfiGrasslandsV3ActionsCompatibilityLoading.setSuspended(enabled);
    }

    if (enabled) {
      // Re-apply land-cover filtered list when turning AAC on
      refreshAvailableActionsForCurrentParcel();
      syncAacForCurrentParcel();
      updateAacParcelAreaBreakdown();
      applyGreyOutCnum2();
    } else {
      // Avoid re-entering AAC sync while turning AAC off
      if (window.SfiGrasslandsV3Aac) {
        window.SfiGrasslandsV3Aac.setParcel(null, null, []);
      }
      updateAacParcelAreaBreakdown();
      refreshAvailableActionsForCurrentParcel();
      applyGreyOutCnum2();
      updateAvailableQuantities({ skipCompatibilityUpdate: true });
      if (
        window.SfiGrasslandsV3ActionsCompatibilityLoading &&
        typeof window.SfiGrasslandsV3ActionsCompatibilityLoading.updateCompatibility === 'function'
      ) {
        window.SfiGrasslandsV3ActionsCompatibilityLoading.updateCompatibility(null);
      } else {
        updateCompatibilityState();
      }
    }
  }

  function wireAacToggles() {
    if (!window.SfiGrasslandsV3Aac) {
      return;
    }

    // AAC is always enabled in sfi-grasslands-v3
    setSessionFlag('sfiGrasslandsV3UseAac', true);
    setSessionFlag('sfiGrasslandsV3AacDebug', false);

    window.SfiGrasslandsV3Aac.init({
      enabled: true,
      debug: false,
      // AAC exploration: only genuine policy conflicts — not the full matrix.
      // Area sharing is handled by remaining eligible area, not binary disable.
      // CLIG3 and CSAM3 share remaining grassland area (not hard-incompatible).
      incompatibleByCode: {
        GRH7: ['GRH8', 'GRH10'],
        GRH8: ['GRH7', 'GRH10'],
        GRH10: ['GRH7', 'GRH8']
      },
      getContinueButton: function() {
        return document.getElementById('continue-button');
      },
      onAfterRecalculate: function() {
        applyGreyOutCnum2();
        var clig3Before = $('#quantity-clig3').val();
        syncAllWholeRemainingAreaActions();
        if ($('#quantity-clig3').val() !== clig3Before) {
          window.SfiGrasslandsV3Aac.render();
        }
        mirrorClig3SupplementAvailableHints();
        updateAacQuantityOverLimitErrors();
        refreshContinueFromActionSelection();
        captureCurrentParcelState();
      }
    });

    setAacModeEnabled(true);
  }

  function isCnum2UnavailableToggleOn() {
    return false;
  }

  function clearGreyOutCnum2() {
    // Strip previous-agreement locks so they can be re-applied cleanly
    $('.previous-agreement-area-hint').remove();

    $('input[name="actions"]').each(function() {
      var $input = $(this);
      if ($input.attr('data-disabled-reason') !== 'previous-agreement-area') {
        return;
      }

      var $item = $input.closest('.govuk-checkboxes__item');
      $input.prop('disabled', false);
      $input.removeAttr('disabled');
      $input.removeAttr('data-disabled-reason');
      $input.removeAttr('aria-disabled');
      $item.css('opacity', '');
      $item.removeClass('sfi-compatibility-disabled');

      var describedBy = ($input.attr('aria-describedby') || '')
        .split(/\s+/)
        .filter(function(id) {
          return id && id.indexOf('previous-agreement-area-hint-') !== 0;
        });
      if (describedBy.length) {
        $input.attr('aria-describedby', describedBy.join(' '));
      } else {
        $input.removeAttr('aria-describedby');
      }
    });
  }

  function greyOutPreviousAgreementAction(actionCode) {
    var code = String(actionCode || '').toUpperCase();
    if (!code) {
      return;
    }

    var $input = $('input[name="actions"][value="' + code + '"]');
    var $item = $input.closest('.govuk-checkboxes__item');
    if (!$input.length || $item.attr('data-available-for-parcel') === 'false' || $item.is('[hidden]')) {
      return;
    }

    var codeLower = code.toLowerCase();
    var $label = $input.siblings('.govuk-checkboxes__label');
    var $conditional = $('#conditional-' + codeLower);
    var hintId = 'previous-agreement-area-hint-' + codeLower;

    if ($input.is(':checked')) {
      $input.prop('checked', false);
      var $quantityInput = $('#quantity-' + codeLower);
      if ($quantityInput.length) {
        $quantityInput.val('');
        clearQuantityFieldValidation($quantityInput);
      }
      $conditional.addClass('govuk-checkboxes__conditional--hidden');
    }

    $input.prop('disabled', true);
    $input.attr('data-disabled-reason', 'previous-agreement-area');
    $input.attr('aria-disabled', 'true');
    $item.addClass('sfi-compatibility-disabled');
    $item.css('opacity', '');

    if (!$label.find('#' + hintId).length) {
      $label.append(
        '<span class="previous-agreement-area-hint" id="' + hintId + '" style="display: block; font-size: 16px; color: #505a5f; font-weight: normal; margin-top: 5px;">All eligible land for this action is already included in an existing agreement.</span>'
      );
    }

    var describedBy = ($input.attr('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean);
    if (describedBy.indexOf(hintId) === -1) {
      describedBy.push(hintId);
      $input.attr('aria-describedby', describedBy.join(' '));
    }
  }

  function applyGreyOutCnum2() {
    clearGreyOutCnum2();

    // Only grey previous-agreement actions when that feature toggle is on
    if (isPreviousAgreementsToggleOn()) {
      var usedCodes = getPreviousAgreementActionCodes(currentSelectedParcel);
      usedCodes.forEach(function(code) {
        greyOutPreviousAgreementAction(code);
      });
    }

    // Prototype toggle: force CNUM2 unavailable even without parcel previous-agreement data
    greyOutCnum2Enabled = isCnum2UnavailableToggleOn();
    if (!greyOutCnum2Enabled) {
      return;
    }

    greyOutPreviousAgreementAction('CNUM2');
  }

  window.__grasslandsApplyPreviousAgreementGreyOut = applyGreyOutCnum2;

  function wireShowAllMvpActionsToggle() {
    var showAllMvpActionsStorageKey = 'sfiGrasslandsV3ShowAllMvpActions';
    var showAllMvpActionsToggle = document.getElementById('show-all-mvp-actions');
    // URL is the shareable override. Do not revive a stale session flag when the
    // toggle is off — default behaviour must stay land-cover filtered.
    var showAllMvpActionsFromQuery = getFeatureToggleQueryFlag('allActions');

    showAllMvpActionsEnabled = showAllMvpActionsFromQuery;
    setSessionFlag(showAllMvpActionsStorageKey, showAllMvpActionsEnabled);

    if (showAllMvpActionsToggle) {
      showAllMvpActionsToggle.checked = showAllMvpActionsEnabled;
      showAllMvpActionsToggle.addEventListener('change', function() {
        showAllMvpActionsEnabled = Boolean(showAllMvpActionsToggle.checked);
        setSessionFlag(showAllMvpActionsStorageKey, showAllMvpActionsEnabled);
        syncFeatureToggleQueryParams();
        refreshAvailableActionsForCurrentParcel();
        applyGreyOutCnum2();
        updateAvailableQuantities({ skipCompatibilityUpdate: true });
        if (
          window.SfiGrasslandsV3ActionsCompatibilityLoading &&
          typeof window.SfiGrasslandsV3ActionsCompatibilityLoading.updateCompatibility === 'function'
        ) {
          window.SfiGrasslandsV3ActionsCompatibilityLoading.updateCompatibility(null);
        } else {
          updateCompatibilityState();
        }
      });
    }

    // Always re-apply after toggles are wired so draft parcel restore uses
    // the final land-cover filter (not a stale “show all” session state).
    if (currentSelectedParcel) {
      refreshAvailableActionsForCurrentParcel();
    }
  }

  function wireActionDeductionsToggle() {
    var storageKey = 'sfiGrasslandsV3ShowActionDeductions';
    var toggle = document.getElementById('show-action-deductions');
    var enabled = getFeatureToggleQueryFlag('actionDeductions') || getSessionFlag(storageKey);

    setSessionFlag(storageKey, enabled);
    if (toggle) {
      toggle.checked = enabled;
      toggle.addEventListener('change', function() {
        setSessionFlag(storageKey, Boolean(toggle.checked));
        syncFeatureToggleQueryParams();
        if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
          window.SfiGrasslandsV3Aac.render();
        }
      });
    }
  }

  function wirePreviousAgreementsToggle() {
    var storageKey = 'sfiGrasslandsV3ShowPreviousAgreements';
    var toggle = document.getElementById('show-previous-agreements');
    var enabled = getFeatureToggleQueryFlag('previousAgreements') || getSessionFlag(storageKey);

    setSessionFlag(storageKey, enabled);
    if (toggle) {
      toggle.checked = enabled;
      toggle.addEventListener('change', function() {
        var isOn = Boolean(toggle.checked);
        setSessionFlag(storageKey, isOn);
        syncFeatureToggleQueryParams();
        updateAacParcelAreaBreakdown();
        applyGreyOutCnum2();
        if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
          window.SfiGrasslandsV3Aac.render();
        }
        updateAvailableQuantities({ skipCompatibilityUpdate: true });
      });
    }

    updateAacParcelAreaBreakdown();
    applyGreyOutCnum2();
  }

  function wireCnum2UnavailableToggle() {
    greyOutCnum2Enabled = false;
    setSessionFlag('sfiGrasslandsV3GreyOutCnum2', false);
    applyGreyOutCnum2();
  }

  if (window.SfiGrasslandsV3ActionsCompatibilityLoading) {
    // Compatibility updates are immediate — no simulated API delay
    setSessionFlag('sfiGrasslandsV3SimulateCompatibilityApiDelay', false);

    window.SfiGrasslandsV3ActionsCompatibilityLoading.init({
      simulateDelay: false,
      areActionsIncompatible: actionsAreIncompatible,
      getActionCode: function(checkbox) {
        return getActionCode($(checkbox));
      },
      getActionName: getActionName,
      onAfterApply: function() {
        updateAvailableQuantities({ skipCompatibilityUpdate: true });
        applyGreyOutCnum2();
      }
    });
  }

  wireCnum2UnavailableToggle();
  wireShowAllMvpActionsToggle();
  wirePreviousAgreementsToggle();
  wireActionDeductionsToggle();
  wireAacToggles();
  syncFeatureToggleQueryParams();

  // Restore draft after AAC / feature toggles are wired so the first paint
  // uses the same path as flipping the AAC toggle (not the matrix path).
  (function restoreDraftParcelAfterToggles() {
    try {
      var draftParcelEl = document.getElementById('draft-parcel-json');
      var draftParcel = draftParcelEl ? JSON.parse(draftParcelEl.textContent) : null;
      var draftActionsEl = document.getElementById('draft-actions-json');
      var draftActions = draftActionsEl ? JSON.parse(draftActionsEl.textContent) : [];

      if (!draftParcel || !draftParcel.parcelId) {
        return;
      }

      // Keep map/JS parcel areas aligned with the saved draft,
      // except prototype OS refs which have fixed total/available for testing.
      if (parcelData[draftParcel.parcelId]) {
        if (!PROTOTYPE_PARCEL_AREAS[draftParcel.parcelId]) {
          if (draftParcel.totalArea != null && draftParcel.totalArea !== '') {
            parcelData[draftParcel.parcelId].totalArea = String(draftParcel.totalArea);
          }
          if (draftParcel.availableArea != null && draftParcel.availableArea !== '') {
            parcelData[draftParcel.parcelId].availableArea = String(draftParcel.availableArea);
          }
        } else {
          applyPrototypeParcelAreas(draftParcel.parcelId);
        }
        if (draftParcel.landCover != null) {
          parcelData[draftParcel.parcelId].landCover = draftParcel.landCover;
        }
      }

      // Editing removes the parcel from saved selections. Re-seed it here so
      // selectParcel → restoreParcelState can re-check the draft actions.
      if (Array.isArray(draftActions) && draftActions.length) {
        parcelSelections[draftParcel.parcelId] = {
          actions: draftActions.map(function(action) {
            return {
              code: String((action && action.code) || '').toUpperCase(),
              name: action && action.name,
              quantity: action && action.quantity,
              unit: action && action.unit,
              paymentRate: action && action.paymentRate,
              yearlyPayment: action && action.yearlyPayment
            };
          }).filter(function(action) {
            return Boolean(action.code) && !isClig3Supplement(action.code);
          })
        };
      }

      updatePreviousAgreementsSummary(draftParcel.parcelId);
      setTimeout(function() {
        selectParcelById(draftParcel.parcelId, {
          skipMapScroll: Boolean(pendingActionFocusCode)
        });
        document.getElementById('actions-section').style.display = 'block';
        document.getElementById('action-tools-panel').style.display = 'block';

        function finishAacAfterRestore() {
          if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
            syncAacForCurrentParcel();
            updateAacParcelAreaBreakdown();
            applyGreyOutCnum2();
          }
          refreshContinueFromActionSelection();
          // Wait for checkboxes, quantities and AAC to settle, then scroll to the Change target.
          consumeQueuedActionFocus(pendingActionFocusCode ? 450 : 0);
        }

        if (Array.isArray(draftActions) && draftActions.length) {
          setTimeout(function() {
            if (currentSelectedParcel === draftParcel.parcelId) {
              restoreParcelState(draftParcel.parcelId);
            }
            finishAacAfterRestore();
          }, 300);
        } else {
          finishAacAfterRestore();
        }
      }, 50);
    } catch (draftErr) {
      console.warn('Could not restore draft parcel/actions', draftErr);
    }
  })();

  $(document).on('change', 'input[name="actions"]', function() {
    var changedCheckbox = this;
    var actionCode = ($(changedCheckbox).val() || '').toString().toUpperCase();

    if (!$(changedCheckbox).is(':checked')) {
      var actionCodeLower = actionCode.toLowerCase();
      var $quantityInput = $('#quantity-' + actionCodeLower);
      if ($quantityInput.length) {
        $quantityInput.val('');
        clearQuantityFieldValidation($quantityInput);
      }
      if (isWholeRemainingAreaAction(actionCode)) {
        clearClig3SupplementSelections();
        syncWholeRemainingAreaAction(actionCode);
      }
    } else if (isWholeRemainingAreaAction(actionCode)) {
      // Commit all remaining area as soon as the box is ticked
      syncWholeRemainingAreaAction(actionCode);
    }

    // AAC mode: checking a box is instant — only quantity entry simulates the API wait
    // (CLIG3 commits quantity on check, so conflicts update immediately)
    if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) {
      if (
        !isRestoringActionSelections &&
        isWholeRemainingAreaAction(actionCode) &&
        $(changedCheckbox).is(':checked')
      ) {
        window.SfiGrasslandsV3Aac.runUpdate(actionCode);
      } else {
        window.SfiGrasslandsV3Aac.render();
      }
      applyGreyOutCnum2();
      syncAllWholeRemainingAreaActions();
      refreshContinueFromActionSelection();
      return;
    }

    // Prototype: simulated compatibility API, then full rebuild from checked actions
    if (
      window.SfiGrasslandsV3ActionsCompatibilityLoading &&
      typeof window.SfiGrasslandsV3ActionsCompatibilityLoading.updateCompatibility === 'function'
    ) {
      window.SfiGrasslandsV3ActionsCompatibilityLoading.updateCompatibility(changedCheckbox);
      syncAllWholeRemainingAreaActions();
      return;
    }

    updateCompatibilityState();
    updateAvailableQuantities({ skipCompatibilityUpdate: true });
    syncAllWholeRemainingAreaActions();
  });

  // Live over-limit errors only appear on the quantity last edited.
  // Continue still validates every field via { all: true }.
  var lastQuantityEditedActionCode = null;

  function updateAacQuantityOverLimitErrors(options) {
    options = options || {};
    if (!(window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled())) {
      return;
    }

    window.SfiGrasslandsV3Aac.syncSelectionsFromDom();
    var calculation = window.SfiGrasslandsV3Aac.recalculate();
    var byCode = {};
    (calculation.actions || []).forEach(function(action) {
      byCode[action.code] = action;
    });

    var checkAll = options.all === true;
    var onlyCode = checkAll
      ? null
      : (options.actionCode
        ? String(options.actionCode).toUpperCase()
        : (lastQuantityEditedActionCode || null));

    $('input[id^="quantity-"]').each(function() {
      var $input = $(this);
      var actionCode = ($input.attr('id') || '').replace('quantity-', '').toUpperCase();
      var errors = getQuantityErrorsStore($input);

      // Live mode: only the last-edited field can show an over-limit error
      if (onlyCode && actionCode !== onlyCode) {
        if (errors.overLimit) {
          errors.overLimit = null;
          refreshQuantityFieldDisplay($input);
        }
        return;
      }

      if (!checkAll && !onlyCode) {
        return;
      }

      var $checkbox = getQuantityCheckbox($input);
      // Keep format errors (e.g. letter "d"); only manage over-limit here
      errors.overLimit = null;

      if (!$checkbox.is(':checked')) {
        refreshQuantityFieldDisplay($input);
        return;
      }

      // Don't stack over-limit on top of an invalid format
      if (errors.format) {
        refreshQuantityFieldDisplay($input);
        return;
      }

      var action = byCode[actionCode];
      var parsed = parseQuantityInput($input.val());

      if (!action || !parsed.valid) {
        refreshQuantityFieldDisplay($input);
        return;
      }

      // maxAvailable = amount left for this action after other actions' entries
      var maxAllowed = Number(action.maxAvailable);
      if (!Number.isFinite(maxAllowed)) {
        maxAllowed = 0;
      }

      if (parsed.value > maxAllowed + 0.0001) {
        if (action.unit === 'pond') {
          // Pond count is user-declared — do not validate against parcel hectares
          refreshQuantityFieldDisplay($input);
          return;
        } else if (action.unit === 'm') {
          errors.overLimit = 'Enter up to ' +
            Math.max(0, Math.round(maxAllowed)).toLocaleString('en-GB') +
            ' metres';
        } else if (action.unit === 'm²') {
          // HEF1 has no known available AAC — do not cap against an estimate
          refreshQuantityFieldDisplay($input);
          return;
        } else {
          errors.overLimit = 'Enter up to ' + Number(maxAllowed).toFixed(4) + ' hectares';
        }
      }

      refreshQuantityFieldDisplay($input);
    });
  }

  function triggerAacQuantityUpdate(inputEl) {
    if (!(window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled()) || !inputEl) {
      return;
    }

    var inputId = inputEl.id || '';
    var actionCode = inputId.replace('quantity-', '').toUpperCase();
    if (!actionCode) {
      return;
    }

    lastQuantityEditedActionCode = actionCode;

    var $input = $(inputEl);
    $input.data('blurred', true);
    updateQuantityFormatErrors($input);

    var rawValue = String(inputEl.value || '').trim();
    var $checkbox = $('input[name="actions"][value="' + actionCode + '"]');
    if ($checkbox.length && rawValue && !$checkbox.is(':checked')) {
      $checkbox.prop('checked', true);
      $checkbox.attr('aria-expanded', 'true');
      $('#conditional-' + actionCode.toLowerCase()).removeClass('govuk-checkboxes__conditional--hidden');
    }

    // Invalid characters (e.g. "d") — show format error only, skip AAC recalculation
    var errors = getQuantityErrorsStore($input);
    if (errors.format) {
      errors.overLimit = null;
      refreshQuantityFieldDisplay($input);
      refreshContinueFromActionSelection();
      return;
    }

    updateAacQuantityOverLimitErrors({ actionCode: actionCode });

    if (rawValue) {
      // 2.5s simulated API + inline “Updating…” — then refresh shared-pool hints
      window.SfiGrasslandsV3Aac.runUpdate(actionCode);
    } else {
      window.SfiGrasslandsV3Aac.render();
      applyGreyOutCnum2();
      updateAacQuantityOverLimitErrors({ actionCode: actionCode });
      captureCurrentParcelState();
    }
    refreshContinueFromActionSelection();
  }

  // While typing: wait after the last keystroke, then run AAC (spinner + simulated API).
  // Do not also run on blur — only the debounce updates available land.
  var QUANTITY_AAC_DEBOUNCE_MS = 1600;
  var quantityAacDebounceTimer = null;

  function clearQuantityAacDebounce() {
    if (quantityAacDebounceTimer !== null) {
      window.clearTimeout(quantityAacDebounceTimer);
      quantityAacDebounceTimer = null;
    }
  }

  function scheduleAacQuantityLiveUpdate(inputEl) {
    clearQuantityAacDebounce();
    quantityAacDebounceTimer = window.setTimeout(function() {
      quantityAacDebounceTimer = null;
      if (!inputEl || !document.body.contains(inputEl)) {
        return;
      }
      triggerAacQuantityUpdate(inputEl);
    }, QUANTITY_AAC_DEBOUNCE_MS);
  }

  function focusFarmByKey(farmKey) {
    var farmConfig = FARM_VIEW_CONFIG[farmKey];
    if (!farmConfig) {
      return;
    }

    suppressParcelSelectionFor(350);

    if (pendingParcelRestoreTimeout) {
      clearTimeout(pendingParcelRestoreTimeout);
      pendingParcelRestoreTimeout = null;
    }

    closeAllParcelPopups();

    if (currentSelectedParcel && parcelPolygons[currentSelectedParcel]) {
      parcelPolygons[currentSelectedParcel].setStyle(defaultStyle(parcelPolygons[currentSelectedParcel].feature));
    }
    currentSelectedParcel = null;
    updateAacActionsIntro();

    Array.prototype.forEach.call(document.querySelectorAll('.farm-info-panel'), function(panel) {
      panel.style.display = panel.id === farmConfig.panelId ? 'block' : 'none';

      Array.prototype.forEach.call(panel.querySelectorAll('.farm-table-extended-row'), function(row) {
        row.style.display = panel.id === farmConfig.panelId ? 'table-row' : 'none';
      });
    });

    document.getElementById('select-parcel-text').style.display = 'none';
    document.getElementById('choose-parcel-text').style.display = 'block';
    document.getElementById('selected-parcel-text').style.display = 'none';
    document.getElementById('action-instruction').style.display = 'none';
    document.getElementById('parcels-actions-summary-section').style.display = 'block';
    // Keep the actions-page heading — do not swap to the land-selection title
    document.getElementById('page-heading').textContent = 'Select actions for this land parcel';

    var parcelInfoContainer = document.getElementById('parcel-info-container');
    if (parcelInfoContainer) {
      parcelInfoContainer.style.display = 'none';
    }

    // Do not hide #actions-section / tools on this page — farm focus is map-only here

    resetActionSelectionUiState();

    var backToFarmLinkContainer = document.getElementById('back-to-farm-link-container');
    if (backToFarmLinkContainer) {
      backToFarmLinkContainer.style.display = 'block';
    }

    Object.keys(LOCATION_TO_PARCEL_LIST_ID).forEach(function(locationKey) {
      var listId = LOCATION_TO_PARCEL_LIST_ID[locationKey];
      var listEl = document.getElementById(listId);
      if (listEl) {
        listEl.style.display = listId === farmConfig.parcelListId ? 'block' : 'none';
      }
    });

    var parcelListSection = document.getElementById('parcels-list-section');
    if (parcelListSection) {
      parcelListSection.style.display = farmConfig.parcelListId ? 'block' : 'none';
    }

    setFarmMapMarkerVisibility(farmKey);
    map.setView(farmConfig.center, farmConfig.zoom || 15);
  }
  
  // Handle clicks on OS Map Sheet Reference links
  $(document).ready(function() {
    $(document).on('click', '.farm-focus-link', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
      }

      suppressParcelSelectionFor(350);

      var farmKey = $(this).attr('data-farm-key');
      focusFarmByKey(farmKey);
    });
    
    $('#reset-map-view-button').on('click', function(e) {
      e.preventDefault();
      resetMapToAllParcelsView();
    });

    // Click handler for "Back to OS map reference farm selection" link
    $('#back-to-farm-selection-link').on('click', function(e) {
      e.preventDefault();

      if (pendingParcelRestoreTimeout) {
        clearTimeout(pendingParcelRestoreTimeout);
        pendingParcelRestoreTimeout = null;
      }

      setFarmMapMarkerVisibility(null);
      
      // Reset map to initial view showing all farm locations
      map.setView(ALL_FARMS_MAP_CENTER, ALL_FARMS_MAP_ZOOM);
      
      // Show OS map references section
      document.getElementById('os-map-references').style.display = 'block';
      
      // Show all farm information sections again
      Array.prototype.forEach.call(document.querySelectorAll('.farm-info-panel'), function(panel) {
        panel.style.display = 'block';

        Array.prototype.forEach.call(panel.querySelectorAll('.farm-table-extended-row'), function(row) {
          row.style.display = 'none';
        });
      });
      
      // Hide action instruction
      document.getElementById('action-instruction').style.display = 'none';
      
      // Hide parcel info container
      var parcelInfoContainer = document.getElementById('parcel-info-container');
      if (parcelInfoContainer) {
        parcelInfoContainer.style.display = 'none';
      }
      var backToFarmLinkContainer = document.getElementById('back-to-farm-link-container');
      if (backToFarmLinkContainer) {
        backToFarmLinkContainer.style.display = 'none';
      }
      
      // Hide actions section
      document.getElementById('actions-section').style.display = 'none';

      // Hide and reset action tools panel
      document.getElementById('action-tools-panel').style.display = 'none';
      
      // Hide parcels list section
      document.getElementById('parcels-list-section').style.display = 'none';
      
      // Reset page heading
      document.getElementById('page-heading').textContent = 'Select actions for this land parcel';
      document.getElementById('select-parcel-text').style.display = 'block';
      document.getElementById('choose-parcel-text').style.display = 'none';
      document.getElementById('selected-parcel-text').style.display = 'none';
      
      // Reset selected parcel styling
      if (currentSelectedParcel && parcelPolygons[currentSelectedParcel]) {
        parcelPolygons[currentSelectedParcel].setStyle(defaultStyle(parcelPolygons[currentSelectedParcel].feature));
      }
      
      // Clear current selection (but keep data in parcelSelections)
      currentSelectedParcel = null;
      updateAacActionsIntro();

      // Note: All user actions are preserved in parcelSelections object and accordion sections
    });

    // Store parcelSelections in hidden field before form submission
    $(document).on('change input', 'input[name="actions"], input[id^="quantity-"]', function() {
      refreshContinueFromActionSelection();
    });

    $('#continue-form').on('submit', function(e) {
      if (window.SfiGrasslandsV3Aac && window.SfiGrasslandsV3Aac.isEnabled() && window.SfiGrasslandsV3Aac.isBusy()) {
        e.preventDefault();
        return false;
      }

      var draftActionsPayload = buildDraftLandActionsPayload();
      if (!draftActionsPayload.length) {
        e.preventDefault();
        showActionsSelectionError('Select at least one action');
        return false;
      }

      if (!validateBeforeSave()) {
        e.preventDefault();
        return false;
      }

      hideActionsSelectionError();
      captureCurrentParcelState();
      $('#draftLandActions').val(JSON.stringify(draftActionsPayload));
      $('#parcelSelectionsData').val(JSON.stringify(parcelSelections));
      sessionStorage.removeItem('editingFromCheckYourAnswers');
    });

    onMapReady(function() {
      // Only frame the farm on the map. Do not call focusFarmByKey here —
      // it hides #actions-section and overwrites the actions page heading,
      // often after draft parcel restore has already shown the actions list.
      var farmConfig = FARM_VIEW_CONFIG.blackberry;
      if (farmConfig) {
        setFarmMapMarkerVisibility('blackberry');
        if (typeof map !== 'undefined' && map && typeof map.setView === 'function') {
          map.setView(farmConfig.center, farmConfig.zoom || 15);
        }
      }
    });
  });
});
