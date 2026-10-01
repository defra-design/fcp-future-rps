// Loaded by sfi-grasslands-v4 select-land, select-land-map-fluid-find and select-actions.
// Creates a Defra interactive map search plugin that finds land parcels by parcel ID.
(function (root) {
  var MAX_RESULTS = 8;
  // The plugin fits the map tightly to a result's bounds, so widen them on every side
  // (as a share of the parcel's size) to keep the neighbouring parcels in view
  var RESULT_BOUNDS_MARGIN = 0.6;

  function compact(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(char) {
      return '&#' + char.charCodeAt(0) + ';';
    });
  }

  // Parcel coords are [lat, lng]; the map wants [lng, lat].
  function getBounds(coords) {
    var lats = coords.map(function(point) { return point[0]; });
    var lngs = coords.map(function(point) { return point[1]; });
    return [Math.min.apply(null, lngs), Math.min.apply(null, lats), Math.max.apply(null, lngs), Math.max.apply(null, lats)];
  }

  function widenBounds(bounds, margin) {
    var padLng = (bounds[2] - bounds[0]) * margin;
    var padLat = (bounds[3] - bounds[1]) * margin;
    return [bounds[0] - padLng, bounds[1] - padLat, bounds[2] + padLng, bounds[3] + padLat];
  }

  function markMatch(reference, query) {
    var start = reference.toUpperCase().indexOf(query.trim().toUpperCase());
    if (start === -1) {
      return '<mark>' + escapeHtml(reference) + '</mark>';
    }
    var end = start + query.trim().length;
    return escapeHtml(reference.slice(0, start)) +
      '<mark>' + escapeHtml(reference.slice(start, end)) + '</mark>' +
      escapeHtml(reference.slice(end));
  }

  function findParcels(query, parcels, formatReference) {
    var needle = compact(query);

    return Object.keys(parcels)
      .map(function(parcelId) {
        var parcel = parcels[parcelId];
        var reference = formatReference(Object.assign({ id: parcelId, parcelId: parcelId }, parcel)) || parcelId;
        return { parcelId: parcelId, parcel: parcel, reference: reference };
      })
      .filter(function(item) {
        return item.parcel && item.parcel.coords && compact(item.reference).indexOf(needle) !== -1;
      })
      .sort(function(a, b) {
        return a.reference.localeCompare(b.reference, 'en-GB', { numeric: true });
      })
      .slice(0, MAX_RESULTS)
      .map(function(item) {
        var bounds = getBounds(item.parcel.coords);
        return {
          id: item.parcelId,
          parcelId: item.parcelId,
          text: item.reference,
          marked: markMatch(item.reference, query),
          point: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
          bounds: widenBounds(bounds, RESULT_BOUNDS_MARGIN),
          type: 'parcel'
        };
      });
  }

  function createPlugin(options) {
    return root.defra.searchPlugin({
      placeholder: 'Search by land parcel',
      width: '300px',
      showMarker: false,
      noResultsMessage: 'No matching land parcels',
      customDatasets: [{
        name: 'parcel',
        // The plugin always fetches its results, so the matches are passed in as a data: URL.
        buildRequest: function(query) {
          var results = findParcels(query, options.getParcels() || {}, options.formatReference);
          return {
            url: 'data:application/json,' + encodeURIComponent(JSON.stringify(results)),
            options: { method: 'GET' }
          };
        },
        parseResults: function(json) {
          return json;
        }
      }]
    });
  }

  // After a key press the plugin hides its results when the input loses focus, and pressing
  // the mouse on a result takes focus away before the click lands. Keeping focus on the
  // input until the click fires lets the result be chosen.
  document.addEventListener('mousedown', function(event) {
    if (event.target.closest && event.target.closest('.im-c-search-suggestions__item')) {
      event.preventDefault();
    }
  }, true);

  root.sfiGrasslandsV4ParcelSearch = { createPlugin: createPlugin };
})(window);
