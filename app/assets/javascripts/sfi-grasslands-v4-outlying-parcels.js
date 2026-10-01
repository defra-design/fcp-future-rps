// Loaded by sfi-grasslands-v4/select-land and select-actions, and required by the
// server land details modules. Agile Farm land a few miles from the main holding,
// so the zoomed-out Select land map shows separate clusters.
(function (root) {
  var SITES = [
    { id: 'hill-farm', name: 'Hill Farm' },
    { id: 'brook-end', name: 'Brook End' },
    { id: 'wood-lane', name: 'Wood Lane' }
  ]

  // coords are [lat, lng] to match the rest of the v4 parcel data
  var PARCELS = {
    'hilltop-field': {
      name: 'Hilltop Field',
      siteId: 'hill-farm',
      osRef: 'SP 905 355',
      totalArea: '6.1654',
      availableArea: '6.1654',
      landCover: 'Permanent grassland',
      coords: [[51.98531, -0.79095], [51.98526, -0.7896], [51.98494, -0.7884], [51.98485, -0.78661], [51.98398, -0.78678], [51.98315, -0.78703], [51.98314, -0.78869], [51.98309, -0.7909], [51.98396, -0.79093], [51.98443, -0.79098]]
    },
    'windmill-ground': {
      name: 'Windmill Ground',
      siteId: 'hill-farm',
      osRef: 'SP 908 355',
      totalArea: '6.3837',
      availableArea: '6.3837',
      landCover: ['Temporary grass', 'Pond'],
      coords: [[51.98485, -0.78661], [51.98471, -0.78459], [51.98455, -0.78296], [51.98468, -0.78157], [51.98358, -0.78225], [51.98265, -0.78299], [51.98297, -0.78527], [51.98315, -0.78703], [51.98398, -0.78678]]
    },
    'long-furlong': {
      name: 'Long Furlong',
      siteId: 'hill-farm',
      osRef: 'SP 912 355',
      totalArea: '6.2558',
      availableArea: '6.2558',
      landCover: 'Other arable crops',
      coords: [[51.98468, -0.78157], [51.9847, -0.78051], [51.98459, -0.77885], [51.98447, -0.77787], [51.98372, -0.77787], [51.98328, -0.77812], [51.98266, -0.77812], [51.98275, -0.78064], [51.98265, -0.78299], [51.98358, -0.78225]]
    },
    'spinney-field': {
      name: 'Spinney Field',
      siteId: 'hill-farm',
      osRef: 'SP 906 352',
      totalArea: '13.5563',
      availableArea: '13.5563',
      landCover: ['Permanent grassland', 'Scrub - ungrazeable'],
      coords: [[51.98309, -0.7909], [51.98314, -0.78869], [51.98315, -0.78703], [51.98297, -0.78527], [51.98265, -0.78299], [51.98152, -0.78272], [51.98066, -0.78265], [51.98064, -0.78416], [51.98083, -0.78547], [51.98104, -0.78739], [51.98102, -0.78897], [51.98102, -0.79013], [51.98101, -0.79134], [51.98181, -0.79114], [51.98255, -0.79122]]
    },
    'top-pasture': {
      name: 'Top Pasture',
      siteId: 'hill-farm',
      osRef: 'SP 910 352',
      totalArea: '7.3109',
      availableArea: '7.3109',
      landCover: 'Permanent grassland',
      coords: [[51.98265, -0.78299], [51.98275, -0.78064], [51.98266, -0.77812], [51.98187, -0.77814], [51.98106, -0.77859], [51.98025, -0.77863], [51.98049, -0.77966], [51.98066, -0.78148], [51.98066, -0.78265], [51.98152, -0.78272]]
    },
    'brook-end-meadow': {
      name: 'Brook End Meadow',
      siteId: 'brook-end',
      osRef: 'SP 872 224',
      totalArea: '7.4416',
      availableArea: '7.4416',
      landCover: ['Permanent grassland', 'Pond'],
      coords: [[51.89155, -0.76162], [51.89133, -0.76003], [51.89105, -0.75895], [51.89088, -0.75758], [51.88971, -0.75834], [51.88853, -0.75896], [51.88871, -0.76037], [51.88898, -0.76147], [51.88903, -0.76245], [51.88977, -0.76244], [51.89077, -0.76177]]
    },
    'willow-bank': {
      name: 'Willow Bank',
      siteId: 'brook-end',
      osRef: 'SP 875 224',
      totalArea: '8.9725',
      availableArea: '8.9725',
      landCover: 'Temporary grass',
      coords: [[51.89088, -0.75758], [51.8906, -0.75619], [51.89042, -0.75491], [51.89026, -0.75389], [51.88891, -0.75383], [51.88758, -0.75362], [51.88772, -0.75513], [51.88836, -0.75743], [51.88853, -0.75896], [51.88971, -0.75834]]
    },
    'ford-field': {
      name: 'Ford Field',
      siteId: 'brook-end',
      osRef: 'SP 878 224',
      totalArea: '8.3207',
      availableArea: '8.3207',
      landCover: 'Land lying fallow',
      coords: [[51.89026, -0.75389], [51.88999, -0.75226], [51.88983, -0.7507], [51.88969, -0.74946], [51.88898, -0.74993], [51.88797, -0.74991], [51.88682, -0.75026], [51.88697, -0.75132], [51.88727, -0.75243], [51.88758, -0.75362], [51.88891, -0.75383]]
    },
    'wood-lane-field': {
      name: 'Wood Lane Field',
      siteId: 'wood-lane',
      osRef: 'SP 811 286',
      totalArea: '8.5812',
      availableArea: '8.5812',
      landCover: 'Permanent grassland',
      coords: [[51.95966, -0.85808], [51.96011, -0.85674], [51.96052, -0.85566], [51.96101, -0.85405], [51.96012, -0.85339], [51.9594, -0.853], [51.95868, -0.8523], [51.95801, -0.85443], [51.95741, -0.8562], [51.95802, -0.85675], [51.95891, -0.85729]]
    },
    'coppice-close': {
      name: 'Coppice Close',
      siteId: 'wood-lane',
      osRef: 'SP 811 283',
      totalArea: '8.6669',
      availableArea: '8.6669',
      landCover: ['Temporary grass', 'Scrub - ungrazeable'],
      coords: [[51.95741, -0.8562], [51.95801, -0.85443], [51.95868, -0.8523], [51.95808, -0.85138], [51.95733, -0.85096], [51.9567, -0.85004], [51.95605, -0.85156], [51.95579, -0.85305], [51.95528, -0.85423], [51.95596, -0.85472], [51.95658, -0.85566]]
    }
  }

  // Copies the parcels into a page's parcelData using the same shape as the main farm parcels
  function addTo (parcelData) {
    Object.keys(PARCELS).forEach(function (id) {
      var parcel = JSON.parse(JSON.stringify(PARCELS[id]))
      parcel.location = 'buckinghamshire'
      parcel.numParcels = 1
      parcel.numActions = 0
      parcel.actions = []
      parcel.color = '#90EE90'
      parcelData[id] = parcel
    })
    return parcelData
  }

  var api = {
    sites: SITES,
    parcels: PARCELS,
    addTo: addTo
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
  root.SfiGrasslandsV4OutlyingParcels = api
})(typeof window !== 'undefined' ? window : globalThis)
