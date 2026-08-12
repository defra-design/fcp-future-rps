//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const https = require('https')
const actionCodeNames = require('./data/sfi24-codes-names.json')
const sessionDataDefaults = require('./data/session-data-defaults')
const grasslandsV2Tasks = require('./grasslands-v2-tasks')
const grasslandsV2LandActions = require('./grasslands-v2-land-actions')
const grasslandsV2Consent = require('./grasslands-v2-consent')

const grasslandsV2PreviousTasks = require('./grasslands-v2-previous-tasks')
const grasslandsV2PreviousLandActions = require('./grasslands-v2-previous-land-actions')
const grasslandsV2PreviousConsent = require('./grasslands-v2-previous-consent')

const sfiGrasslandsV2Tasks = require('./sfi-grasslands-v2-tasks')
const sfiGrasslandsV2LandActions = require('./sfi-grasslands-v2-land-actions')
const sfiGrasslandsV2Consent = require('./sfi-grasslands-v2-consent')

const {
  areActionsCompatible,
  findIncompatibilities,
  normaliseActionCode,
  resolveYear
} = require('./compatibility-matrix')

const actionNameByCode = actionCodeNames.reduce(function (lookup, entry) {
  var code = normaliseActionCode(entry.code)
  if (code) {
    lookup[code] = entry.name
  }
  return lookup
}, {})

// Add custom Nunjucks filter for parsing JSON
govukPrototypeKit.views.addFilter('fromJson', function(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return {};
  }
})

// Add custom Nunjucks filter for formatting numbers to 2 decimal places
govukPrototypeKit.views.addFilter('formatCurrency', function(num) {
  return parseFloat(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
})

function getSafeReturnUrl (returnUrl) {
  if (typeof returnUrl !== 'string') {
    return '/'
  }

  var trimmedReturnUrl = returnUrl.trim()

  if (!trimmedReturnUrl.startsWith('/') || trimmedReturnUrl.startsWith('//')) {
    return '/'
  }

  if (trimmedReturnUrl.startsWith('/manage-prototype') || trimmedReturnUrl.startsWith('/clear-session-data')) {
    return '/'
  }

  return trimmedReturnUrl
}

function clearSessionDataAndRedirect (req, res) {
  req.session.data = Object.assign({}, sessionDataDefaults)

  var returnUrl = getSafeReturnUrl(req.query.returnUrl || req.get('Referer') || '/')
  res.redirect(returnUrl)
}

router.get('/clear-session-data', clearSessionDataAndRedirect)
router.post('/clear-session-data', clearSessionDataAndRedirect)

// Add your routes here
router.post('/remove-3169', function (req, res) {
  var removeParcel = req.session.data['removeParcel']
  if (removeParcel == "yes"){
    res.redirect('/v1-amend-application/application-amend-2')
  } else {
    res.redirect('/v1-amend-application/application-amend-1')
  }
})
router.post('/v2-remove-3169', function (req, res) {
  var removeParcel = req.session.data['removeParcel']
  if (removeParcel == "yes"){
    res.redirect('/v2-amend-application/basket-removed')
  } else {
    res.redirect('/v2-amend-application/basket-initial')
  }
})

// Mock RPA data for demo purposes (SBI: 999999999)
function getMockRPAData() {
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": "lower-field",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-1.2540, 51.7498],
            [-1.2510, 51.7498],
            [-1.2508, 51.7490],
            [-1.2512, 51.7485],
            [-1.2538, 51.7483],
            [-1.2541, 51.7488],
            [-1.2540, 51.7498]
          ]]
        },
        "properties": {
          "SBI": 999999999,
          "ID": 1001,
          "SHEET_ID": "SP0301",
          "PARCEL_ID": "0001",
          "PARCEL_NAME": "Bottom Meadow",
          "AREA_HA": 120.3451,
          "LFA_CODE": "DA",
          "LAND_USE": "Permanent grassland",
          "DESCRIPTION": "Lower Field"
        }
      },
      {
        "type": "Feature",
        "id": "upper-field",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-1.2541, 51.7510],
            [-1.2520, 51.7510],
            [-1.2518, 51.7505],
            [-1.2510, 51.7498],
            [-1.2540, 51.7498],
            [-1.2542, 51.7503],
            [-1.2541, 51.7510]
          ]]
        },
        "properties": {
          "SBI": 999999999,
          "ID": 1002,
          "SHEET_ID": "SP0102",
          "PARCEL_ID": "0002",
          "PARCEL_NAME": "Hilltop Acre",
          "AREA_HA": 5.2341,
          "LFA_CODE": "SDA",
          "LAND_USE": "Arable land",
          "DESCRIPTION": "Upper Field"
        }
      },
      {
        "type": "Feature",
        "id": "woods-view",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-1.2542, 51.7522],
            [-1.2512, 51.7522],
            [-1.2510, 51.7517],
            [-1.2520, 51.7510],
            [-1.2541, 51.7510],
            [-1.2543, 51.7515],
            [-1.2542, 51.7522]
          ]]
        },
        "properties": {
          "SBI": 999999999,
          "ID": 1003,
          "SHEET_ID": "SP0203",
          "PARCEL_ID": "0003",
          "PARCEL_NAME": "Oak Grove",
          "AREA_HA": 12.8765,
          "LFA_CODE": "DA",
          "LAND_USE": "Woodland",
          "DESCRIPTION": "Woods View"
        }
      },
      {
        "type": "Feature",
        "id": "long-meadow",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-1.2538, 51.7483],
            [-1.2512, 51.7485],
            [-1.2509, 51.7478],
            [-1.2513, 51.7471],
            [-1.2537, 51.7468],
            [-1.2540, 51.7475],
            [-1.2538, 51.7483]
          ]]
        },
        "properties": {
          "SBI": 999999999,
          "ID": 1004,
          "SHEET_ID": "SP0404",
          "PARCEL_ID": "0004",
          "PARCEL_NAME": "Sheep Pasture",
          "AREA_HA": 8.4521,
          "LFA_CODE": "SDA",
          "LAND_USE": "Permanent grassland",
          "DESCRIPTION": "Long Meadow"
        }
      },
      {
        "type": "Feature",
        "id": "river-pasture",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-1.2510, 51.7498],
            [-1.2518, 51.7505],
            [-1.2485, 51.7505],
            [-1.2482, 51.7497],
            [-1.2485, 51.7490],
            [-1.2508, 51.7490],
            [-1.2510, 51.7498]
          ]]
        },
        "properties": {
          "SBI": 999999999,
          "ID": 1005,
          "SHEET_ID": "SP0505",
          "PARCEL_ID": "0005",
          "PARCEL_NAME": "Riverside Grazing",
          "AREA_HA": 15.3267,
          "LFA_CODE": "DA",
          "LAND_USE": "Permanent grassland",
          "DESCRIPTION": "River Pasture"
        }
      }
    ]
  };
}

// RPA API proxy endpoint to bypass CORS
router.get('/api/rpa-proxy', async function (req, res) {
  const sbi = req.query.sbi;
  
  if (!sbi) {
    return res.status(400).json({ error: 'SBI parameter is required' });
  }
  
  // Return mock data for demo SBI
  if (sbi === '999999999') {
    console.log('Returning mock data for demo SBI:', sbi);
    return res.json(getMockRPAData());
  }
  
  try {
    // Correct RPA API WFS endpoint format
    const apiUrl = `https://environment.data.gov.uk/data-services/RPA/LandParcels/wfs?version=2.0.0&request=GetFeature&typeNames=RPA:LandParcels&cql_filter=SBI=${sbi}&srsname=EPSG:4326&outputFormat=application/json`;
    
    console.log('Proxying RPA API request for SBI:', sbi);
    console.log('URL:', apiUrl);
    
    // Use Node's built-in https module
    https.get(apiUrl, (apiResponse) => {
      let data = '';
      
      apiResponse.on('data', (chunk) => {
        data += chunk;
      });
      
      apiResponse.on('end', () => {
        console.log('RPA API response status:', apiResponse.statusCode);
        
        if (apiResponse.statusCode !== 200) {
          return res.status(apiResponse.statusCode).json({ 
            error: `RPA API returned ${apiResponse.statusCode}: ${apiResponse.statusMessage}` 
          });
        }
        
        try {
          const jsonData = JSON.parse(data);
          console.log('RPA API returned', jsonData.features?.length || 0, 'parcels');
          res.json(jsonData);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          res.status(500).json({ error: 'Invalid JSON response from RPA API' });
        }
      });
    }).on('error', (error) => {
      console.error('RPA API proxy error:', error);
      res.status(500).json({ error: error.message });
    });
    
  } catch (error) {
    console.error('RPA API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
})

router.post('/saveReturn-answer', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var saveReturnAnswer = req.session.data['saveReturn-answer']
  // Check whether the variable matches a condition
  if (saveReturnAnswer == "dashboard"){
    // Send user to next page
    res.redirect('/mvp/mvp-dashboard')
  } else {
    // Send user to ineligible page
    res.redirect('mvp/signed-out')
  }
})

router.post('/land-details-answer', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var landDetailsAnswer = req.session.data['land-details-answer']
  // Check whether the variable matches a condition
  if (landDetailsAnswer == "yes"){
    // Send user to next page
    res.redirect('/v1/management-control')
  } else {
    // Send user to ineligible page
    res.redirect('/v1/update-land-details')
  }
})

router.post('/land-details-answer2', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var landDetailsAnswer = req.session.data['land-details-answer2']
  // Check whether the variable matches a condition
  if (landDetailsAnswer == "yes"){
    // Send user to next page
    res.redirect('/v2/management-control')
  } else {
    // Send user to ineligible page
    res.redirect('/v2/update-land-details')
  }
})

router.post('/land-details-answer3', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var landDetailsAnswer = req.session.data['land-details-answer3']
  // Check whether the variable matches a condition
  if (landDetailsAnswer == "yes"){
    // Send user to next page
    res.redirect('/mvp/management-control')
  } else {
    // Send user to ineligible page
    res.redirect('/mvp/update-land-details')
  }
})

router.post('/land-details-answer4', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var landDetailsAnswer = req.session.data['land-details-answer4']
  // Check whether the variable matches a condition
  if (landDetailsAnswer == "yes"){
    // Send user to next page
    res.redirect('/day1-locked/check-land-details')
  } else {
    // Send user to ineligible page
    res.redirect('/day1-locked/update-land-details')
  }
})

router.post('/new-or-existing-answer', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var NeworExistingsAnswer = req.session.data['new-or-existing-answer']
  // Check whether the variable matches a condition
  if (NeworExistingsAnswer == "new"){
    // Send user to next page
    res.redirect('/v1/new-agreement')
  } else {
    // Send user to ineligible page
    res.redirect('/v1/existing-agreement')
  }
})

router.post('/new-or-existing-answer2', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var NeworExistingsAnswer = req.session.data['new-or-existing-answer2']
  // Check whether the variable matches a condition
  if (NeworExistingsAnswer == "new"){
    // Send user to next page
    res.redirect('/v2/new-agreement')
  } else {
    // Send user to ineligible page
    res.redirect('/v2/existing-agreement')
  }
})

router.post('/management-answer', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['management-answer']
  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/v1/select-land')
  } else {
    // Send user to ineligible page
    res.redirect('/v1/ineligible')
  }
})

router.post('/management-answer2', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['management-answer2']
  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/v2/select-land')
  } else {
    // Send user to ineligible page
    res.redirect('/v2/ineligible')
  }
})

router.post('/management-answer3', function (req, res) {
  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['management-answer3']
  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/mvp/hefer')
  } else {
    // Send user to ineligible page
    res.redirect('/mvp/ineligible')
  }
})

router.post('/hefer-answer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['hefer-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/experiment/sssi')

  } else {
    // Send user to ineligible page
    res.redirect('/experiment/ineligible')
  }

})

router.post('/hefer-answer3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['hefer-answer3']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/mvp/sssi')

  } else {
    // Send user to ineligible page
    res.redirect('/mvp/ineligible')
  }

})

router.post('/sssi-answer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['sssi-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/experiment/ite')

  } else {
    // Send user to ineligible page
    res.redirect('/experiment/ineligible')
  }

})

router.post('/sssi-answer3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['sssi-answer3']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/mvp/ite')

  } else {
    // Send user to ineligible page
    res.redirect('/mvp/ineligible')
  }

})

router.post('/ite-answer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['ite-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/experiment/public-body')

  } else {
    // Send user to ineligible page
    res.redirect('/experiment/ineligible')
  }

})

router.post('/ite-answer3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['ite-answer3']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/mvp/public-body')

  } else {
    // Send user to ineligible page
    res.redirect('/mvp/ineligible')
  }

})

router.post('/public-body-answer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['public-body-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/experiment/eligible')

  } else {
    // Send user to ineligible page
    res.redirect('/experiment/ineligible')
  }

})

router.post('/public-body-answer3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['public-body-answer3']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/mvp/eligible')

  } else {
    // Send user to ineligible page
    res.redirect('/mvp/ineligible')
  }

})


// Post-day 1 SSSI POC routes //

router.post('/select-land', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var sssiNeededAnswer = req.session.data['select-land']

  // Check whether the variable matches a condition
  if (sssiNeededAnswer == "needed"){
    // Send user to next page
    res.redirect('/day1-sssi/select-base-action-sssi')

  } else {
    // Send user to ineligible page
    res.redirect('/day1-sssi/select-base-action')
  }

})

// END Post-day 1 SSSI POC routes //


// Post-day 1 HEFER POC routes //

router.post('/select-land-hefer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var heferNeededAnswer = req.session.data['select-land-hefer']

  // Check whether the variable matches a condition
  if (heferNeededAnswer == "needed"){
    // Send user to next page
    res.redirect('/day1-hefer/select-base-action-hefer')

  } else {
    // Send user to ineligible page
    res.redirect('/day1-hefer/select-base-action')
  }

})

// END Post-day 1 HEFER POC routes //


// Post-day 1 HEFER and SSSI routes //

router.post('/select-land-sssi-hefer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var hefersssiNeededAnswer = req.session.data['select-land-sssi-hefer']

  // Check whether the variable matches a condition
  if (hefersssiNeededAnswer == "needed"){
    // Send user to next page
    res.redirect('/day1-sssi-hefer/select-base-action-sssi-hefer')

  } else {
    // Send user to ineligible page
    res.redirect('/day1-sssi-hefer/select-base-action')
  }

})

// END Post-day 1 HEFER POC routes //


// Start Post-day 1 more actions mutual exclusivity logic //

function getSelectedActionsForCompatibility(body) {
  function getKnownMatrixActionCode(value) {
    var code = normaliseActionCode(value)
    return MATRIX_PAGE_ACTION_CODES.includes(code) ? code : ''
  }

  return {
    livestockGrazing: getKnownMatrixActionCode(body.livestockGrazing),
    shepherding: getKnownMatrixActionCode(body.shepherding),
    wildlife: getKnownMatrixActionCode(body.wildlife),
    cmor1: getKnownMatrixActionCode(body.cmor1)
  }
}

const CSAM3_AVAILABLE_AREA = 3.5125

function parseHectaresInput(value) {
  if (value === undefined || value === null) {
    return null
  }

  var cleaned = String(value).trim().replace(/,/g, '')
  if (!cleaned) {
    return null
  }

  var parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function getCsam3QuantityError(selectedActions, quantityInput) {
  if (selectedActions.wildlife !== 'CSAM3') {
    return null
  }

  var quantity = parseHectaresInput(quantityInput)
  if (quantity === null) {
    return 'Enter how much land you want to use for Herbal leys: CSAM3, in hectares'
  }

  if (quantity > CSAM3_AVAILABLE_AREA) {
    return 'The amount of land for Herbal leys: (CSAM3) must be the same as or less than the available area'
  }

  return null
}

const MATRIX_PAGE_ACTION_CODES = [
  'CMOR1',
  'UPL1',
  'UPL2',
  'UPL3',
  'UPL8',
  'UPL10',
  'CLIG3',
  'CSAM3'
]

const ALL_ACTIONS_HINT_GROUP_CODES = [
  'UPL1',
  'UPL2',
  'UPL3',
  'UPL7',
  'UPL8',
  'UPL9',
  'UPL10',
  'CLIG3',
  'CSAM3'
]

const ALL_KNOWN_ACTION_CODES = Object.keys(actionNameByCode)

function getCompatibilityYearFromSession(sessionData) {
  return resolveYear(Number(sessionData.compatibilityYear))
}

function buildMatrixClientConfig(actionCodes, year) {
  var uniqueCodes = Array.from(new Set((actionCodes || []).map(normaliseActionCode).filter(Boolean)))
  var incompatibleByCode = {}
  var displayNameByCode = {}

  uniqueCodes.forEach(function (code) {
    incompatibleByCode[code] = []
    displayNameByCode[code] = getActionDisplayName(code)
  })

  for (var i = 0; i < uniqueCodes.length; i++) {
    for (var j = i + 1; j < uniqueCodes.length; j++) {
      var leftCode = uniqueCodes[i]
      var rightCode = uniqueCodes[j]

      if (!areActionsCompatible(leftCode, rightCode, year)) {
        incompatibleByCode[leftCode].push(rightCode)
        incompatibleByCode[rightCode].push(leftCode)
      }
    }
  }

  return {
    incompatibleByCode: incompatibleByCode,
    displayNameByCode: displayNameByCode
  }
}

function getMatrixPageViewData(req, extraData) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var matrixClientConfig = buildMatrixClientConfig(MATRIX_PAGE_ACTION_CODES, compatibilityYear)

  return Object.assign({
    compatibilityYear: compatibilityYear,
    compatibilityClientConfig: JSON.stringify(matrixClientConfig),
    data: Object.assign({}, req.session.data)
  }, extraData || {})
}

function isUplAction(actionCode) {
  return /^UPL\d+$/i.test(normaliseActionCode(actionCode))
}

function isWildlifeCompatibilityAction(actionCode) {
  var code = normaliseActionCode(actionCode)
  return code === 'CLIG3' || code === 'CSAM3'
}

function getExistingAllActionsCompatibilityCodes(sessionData) {
  var sessionCodes = []

  if (Array.isArray(sessionData.existingParcelActionCodes)) {
    sessionCodes = sessionData.existingParcelActionCodes
  }

  var knownCodes = [
    sessionData.cmor1,
    sessionData.livestockGrazing,
    sessionData.shepherding,
    sessionData.wildlife
  ]

  return Array.from(new Set(sessionCodes.concat(knownCodes).map(normaliseActionCode).filter(Boolean)))
}

function getSelectedAllActionsByGroup(body) {
  return Object.keys(body || {})
    .filter(function (key) {
      return key.indexOf('selectedAction_') === 0
    })
    .reduce(function (selectedByGroup, key) {
      var groupName = key.replace('selectedAction_', '')
      var actionCode = normaliseActionCode(body[key])

      if (groupName && actionCode) {
        selectedByGroup[groupName] = actionCode
      }

      return selectedByGroup
    }, {})
}

function buildAllActionsCompatibilityHints(selectedActionsByGroup, conflicts) {
  var hintsByGroup = {}
  if (!conflicts || !conflicts.length) {
    return hintsByGroup
  }

  Object.keys(selectedActionsByGroup || {}).forEach(function (groupName) {
    var focalCode = selectedActionsByGroup[groupName]
    if (!focalCode) {
      return
    }

    var firstConflict = conflicts.find(function (conflict) {
      return conflict.actionCodeA === focalCode || conflict.actionCodeB === focalCode
    })

    if (!firstConflict) {
      return
    }

    var otherCode = firstConflict.actionCodeA === focalCode
      ? firstConflict.actionCodeB
      : firstConflict.actionCodeA

    hintsByGroup[groupName] = 'Selected action ' + getActionDisplayName(otherCode) + ' is incompatible with ' + getActionDisplayName(focalCode) + ' on this parcel.'
  })

  return hintsByGroup
}

function getActionAnchorId(actionCode) {
  var code = normaliseActionCode(actionCode)
  if (!code) {
    return 'action-agf2'
  }

  return 'action-' + code.toLowerCase()
}

function getSelectedAllActionsFromBody(body) {
  return Object.values(getSelectedAllActionsByGroup(body)).filter(Boolean)
}

function getAllActionsPageViewData(req, extraData) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var matrixClientConfig = buildMatrixClientConfig(ALL_KNOWN_ACTION_CODES, compatibilityYear)

  return Object.assign({
    compatibilityClientConfig: JSON.stringify(matrixClientConfig),
    data: Object.assign({}, req.session.data),
    compatibilityHintsByGroup: {}
  }, extraData || {})
}

const ACTIONS_SUMMARY_DEFAULTS = {
  AHW4: { quantity: 2, unit: 'plots', payment: 1011.56 },
  CHRW2: { quantity: 320.0404, unit: 'm', payment: 166.49 },
  CIGL2: { quantity: 16.0309, unit: 'ha', payment: 344.62 },
  GRH12: { quantity: 16.0156, unit: 'ha', payment: 10432.96 }
}

const ACTIONS_SUMMARY_RATE_BY_CODE = {
  AGF1: 248,
  AGF2: 385,
  BND1: 27,
  BND2: 11,
  CHRW2: 13,
  CAHL4: 515,
  CIGL3: 235,
  BFS1: 707,
  BFS6: 742,
  AHW3: 764,
  AHW5: 765,
  AHW6: 58,
  AHW7: 589,
  AHW8: 596,
  AHW9: 1072,
  AHW10: 354,
  AHW11: 660,
  CAHL1: 739,
  CAHL2: 648,
  CAHL3: 590,
  CIGL1: 333,
  CIGL2: 515,
  CLIG3: 151,
  HEF6: 55,
  CIPM2: 798,
  CIPM3: 55,
  CIPM4: 45,
  UPL1: 35,
  UPL2: 89,
  UPL3: 111,
  UPL5: 18,
  UPL6: 23,
  UPL8: 74,
  UPL10: 102,
  CNUM2: 102,
  CNUM3: 532,
  OFC1: 187,
  OFC2: 96,
  OFC3: 298,
  OFC4: 874,
  OFC5: 1920,
  OFM1: 20,
  OFM2: 41,
  OFM3: 97,
  OFM4: 132,
  OFM5: 707,
  OFM6: 1920,
  PRF1: 27,
  PRF2: 43,
  PRF4: 150,
  CSAM2: 129,
  CSAM3: 224,
  SOH1: 73,
  SOH3: 163,
  SCR1: 588,
  SCR2: 350,
  SPM3: 146,
  SPM5: 11,
  WBD3: 765,
  WBD4: 489,
  WBD2: 4,
  WBD6: 115,
  WBD7: 115,
  GRH1: 121,
  GRH7: 157,
  GRH8: 187,
  GRH10: 28
}

const ACTIONS_SUMMARY_LINEAR_CODES = {
  BND1: true,
  BND2: true,
  CHRW1: true,
  CHRW2: true,
  CHRW3: true,
  WBD2: true
}

const ACTIONS_SUMMARY_PER_100M_RATE_CODES = {
  BND1: true,
  BND2: true,
  CHRW2: true,
  WBD2: true
}

function parseNumberInput(value) {
  if (value === undefined || value === null) {
    return null
  }

  var parsed = Number(String(value).trim().replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getSessionActionQuantity(sessionData, code, fallbackQuantity) {
  var key = 'quantity-' + code.toLowerCase()
  var parsed = parseNumberInput(sessionData[key])
  return parsed === null ? fallbackQuantity : parsed
}

function getSessionActionPayment(sessionData, code, fallbackPayment) {
  var key = 'payment-' + code.toLowerCase()
  var parsed = parseNumberInput(sessionData[key])
  return parsed === null ? fallbackPayment : parsed
}

function formatQuantityForDisplay(quantity, unit) {
  if (!Number.isFinite(quantity)) {
    return ''
  }

  var quantityText = Number.isInteger(quantity)
    ? quantity.toLocaleString('en-GB')
    : quantity.toFixed(4)

  return quantityText + ' ' + unit
}

function isLinearActionCode(code) {
  return Boolean(ACTIONS_SUMMARY_LINEAR_CODES[code])
}

function calculateFallbackActionPayment(code, quantity, unit) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0
  }

  var rate = ACTIONS_SUMMARY_RATE_BY_CODE[code]
  if (!Number.isFinite(rate)) {
    return 0
  }

  if (unit === 'm' && ACTIONS_SUMMARY_PER_100M_RATE_CODES[code]) {
    return (quantity / 100) * rate
  }

  return quantity * rate
}

function parseParcelSelectionsData(rawValue) {
  if (!rawValue) {
    return null
  }

  if (typeof rawValue === 'object') {
    return rawValue
  }

  if (typeof rawValue !== 'string') {
    return null
  }

  try {
    return JSON.parse(rawValue)
  } catch (error) {
    try {
      return JSON.parse(rawValue.replace(/'/g, '"'))
    } catch (innerError) {
      return null
    }
  }
}

function buildActionsSummaryFromParcelSelectionsData(rawParcelSelectionsData) {
  var parcelSelections = parseParcelSelectionsData(rawParcelSelectionsData)
  if (!parcelSelections || typeof parcelSelections !== 'object') {
    return { rows: [], total: 0 }
  }

  var rowsByCode = {}

  Object.keys(parcelSelections).forEach(function (parcelId) {
    var parcel = parcelSelections[parcelId] || {}
    var actions = Array.isArray(parcel.actions) ? parcel.actions : []

    actions.forEach(function (action) {
      var code = normaliseActionCode(action && action.code)
      if (!code) {
        return
      }

      if (!rowsByCode[code]) {
        var actionName = (action && action.name) || actionNameByCode[code] || code
        rowsByCode[code] = {
          code: code,
          label: code + ': ' + actionName,
          quantityValue: 0,
          unit: (action && action.unit) || (isLinearActionCode(code) ? 'm' : 'ha'),
          payment: 0
        }
      }

      var quantity = parseNumberInput(action && action.quantity)
      if (quantity !== null) {
        rowsByCode[code].quantityValue += quantity

        var storedPayment = parseNumberInput(action && action.annualPayment)
        if (storedPayment !== null) {
          rowsByCode[code].payment += storedPayment
        } else {
          rowsByCode[code].payment += calculateFallbackActionPayment(code, quantity, rowsByCode[code].unit)
        }
      }
    })
  })

  var rows = Object.values(rowsByCode).map(function (row) {
    return {
      code: row.code,
      label: row.label,
      quantity: formatQuantityForDisplay(row.quantityValue, row.unit),
      payment: row.payment
    }
  })

  var total = rows.reduce(function (sum, row) {
    return sum + (Number.isFinite(row.payment) ? row.payment : 0)
  }, 0)

  return {
    rows: rows,
    total: total
  }
}

function buildActionsSummaryFromSession(sessionData) {
  var parcelSummary = buildActionsSummaryFromParcelSelectionsData(sessionData.parcelSelectionsData)
  if (parcelSummary.rows.length > 0) {
    return parcelSummary
  }

  var selectedCodes = Array.isArray(sessionData.selectedActions)
    ? sessionData.selectedActions.map(normaliseActionCode).filter(Boolean)
    : []

  if (!selectedCodes.length) {
    return parcelSummary
  }

  var uniqueCodes = Array.from(new Set(selectedCodes))

  var rows = uniqueCodes.map(function (code) {
    var defaults = ACTIONS_SUMMARY_DEFAULTS[code] || { quantity: 0, unit: 'ha', payment: 0 }
    var quantity = getSessionActionQuantity(sessionData, code, defaults.quantity)
    var payment = getSessionActionPayment(sessionData, code, defaults.payment)
    var actionName = actionNameByCode[code] || code

    return {
      code: code,
      label: code + ': ' + actionName,
      quantity: formatQuantityForDisplay(quantity, defaults.unit),
      payment: payment
    }
  })

  var total = rows.reduce(function (sum, row) {
    return sum + (Number.isFinite(row.payment) ? row.payment : 0)
  }, 0)

  return {
    rows: rows,
    total: total
  }
}

router.get('/day1-more-actions2/check-your-answers', function (req, res) {
  var actionsSummary = buildActionsSummaryFromSession(req.session.data || {})

  res.render('day1-more-actions2/check-your-answers', {
    data: Object.assign({}, req.session.data),
    actionsSummaryRows: actionsSummary.rows,
    actionsSummaryTotal: actionsSummary.total
  })
})

router.get('/v2-maps-actions-scaling/check-your-answers', function (req, res) {
  var actionsSummary = buildActionsSummaryFromSession(req.session.data || {})

  res.render('v2-maps-actions-scaling/check-your-answers', {
    data: Object.assign({}, req.session.data),
    actionsSummaryRows: actionsSummary.rows,
    actionsSummaryTotal: actionsSummary.total
  })
})

router.post('/v2-maps-actions-scaling/check-your-answers', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  res.redirect('/v2-maps-actions-scaling/check-your-answers')
})

router.get('/grasslands/check-your-answers', function (req, res) {
  var actionsSummary = buildActionsSummaryFromSession(req.session.data || {})

  res.render('grasslands/check-your-answers', {
    data: Object.assign({}, req.session.data),
    actionsSummaryRows: actionsSummary.rows,
    actionsSummaryTotal: actionsSummary.total
  })
})

router.post('/grasslands/check-your-answers', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  res.redirect('/grasslands/check-your-answers')
})

function getGrasslandsV2PreviousSessionData (req) {
  return req.session.data || {}
}


function buildGrasslandsV2PreviousActionsSummaryFromSession (req) {
  var data = getGrasslandsV2PreviousSessionData(req)
  return buildActionsSummaryFromSession(Object.assign({}, data, {
    parcelSelectionsData: data.previousParcelSelectionsData
  }))
}


// Keep in sync with app/assets/javascripts/grasslands-v2-mvp-actions.js
const GRASSLANDS_V2_PREVIOUS_MVP_ACTION_CODES = [
  'CLIG3',
  'GRH7',
  'GRH8',
  'GRH10',
  'CSAM3',
  'CHRW2',
  'WBD2',
  'HEF1',
  'CNUM2',
  'CIGL2',
  'CIGL1',
  'WBD1',
  'SCR2',
  'BND1',
  'BND2',
  'GRH12'
]

function getGrasslandsV2PreviousCompatibilityLocals (req) {
  var compatibilityYear = getCompatibilityYearFromSession(getGrasslandsV2PreviousSessionData(req))

  return {
    compatibilityYear: compatibilityYear,
    compatibilityClientConfig: JSON.stringify(
      buildMatrixClientConfig(GRASSLANDS_V2_PREVIOUS_MVP_ACTION_CODES, compatibilityYear)
    )
  }
}

function clearGrasslandsV2PreviousApplicationData (req) {
  var existingData = getGrasslandsV2PreviousSessionData(req)
  var preservedBusinessContext = {}

  if (existingData.agileSFD) {
    preservedBusinessContext.agileSFD = existingData.agileSFD
  }

  if (existingData.valleySFD) {
    preservedBusinessContext.valleySFD = existingData.valleySFD
  }

  req.session.data = Object.assign({}, sessionDataDefaults, preservedBusinessContext)
}

router.get('/grasslands-v1-archive/before-you-start', function (req, res) {
  clearGrasslandsV2PreviousApplicationData(req)

  res.render('grasslands-v1-archive/before-you-start', {
    data: getGrasslandsV2PreviousSessionData(req)
  })
})

router.get('/grasslands-v1-archive/task-list', function (req, res) {
  setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
  grasslandsV2PreviousTasks.ensureTasks(req)

  var actionsSummary = buildGrasslandsV2PreviousActionsSummaryFromSession(req)
  grasslandsV2PreviousTasks.syncFromSessionAnswers(req, {
    hasSelectedLand: (actionsSummary.rows && actionsSummary.rows.length > 0) ||
      grasslandsV2PreviousLandActions.hasSavedLandAndActions(req)
  })

  var taskListPage = grasslandsV2PreviousTasks.getTaskListPageData(req)

  res.render('grasslands-v1-archive/task-list', Object.assign({
    data: getGrasslandsV2PreviousSessionData(req)
  }, taskListPage))
})

function setEligibilityReturnTo (req, returnTo) {
  if (returnTo === 'check-your-answers') {
    req.session.data = req.session.data || {}
    req.session.data.grasslandsV2PreviousEligibilityReturnTo = returnTo
  }
}

function getEligibilityReturnTo (req, bodyReturnTo) {
  if (bodyReturnTo) {
    return bodyReturnTo
  }

  return getGrasslandsV2PreviousSessionData(req).grasslandsV2PreviousEligibilityReturnTo || ''
}

function clearGrasslandsV2PreviousEligibilityReturnTo (req) {
  if (req.session.data) {
    delete req.session.data.grasslandsV2PreviousEligibilityReturnTo
  }
}

function setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow (req, enabled) {
  req.session.data = req.session.data || {}
  if (enabled) {
    req.session.data.grasslandsV2PreviousCheckBeforeYouStartLinearFlow = true
  } else {
    delete req.session.data.grasslandsV2PreviousCheckBeforeYouStartLinearFlow
  }
}

function isGrasslandsV2PreviousCheckBeforeYouStartLinearFlow (req) {
  return Boolean(getGrasslandsV2PreviousSessionData(req).grasslandsV2PreviousCheckBeforeYouStartLinearFlow)
}

function getGrasslandsV2PreviousNextCheckBeforeYouStartPath (req) {
  grasslandsV2PreviousTasks.syncFromSessionAnswers(req, {})
  var states = grasslandsV2PreviousTasks.getResolvedTaskStates(req)

  if (states.checkLandDetails.key !== grasslandsV2PreviousTasks.STATUS.COMPLETED) {
    return '/grasslands-v1-archive/check-land-details'
  }

  if (states.confirmEligible.key !== grasslandsV2PreviousTasks.STATUS.COMPLETED) {
    return '/grasslands-v1-archive/management-control'
  }

  return '/grasslands-v1-archive/task-list'
}

function renderGrasslandsV2PreviousEligibilityPage (req, res, view, options) {
  var opts = options || {}

  if (req.query.from === 'check-your-answers') {
    setEligibilityReturnTo(req, 'check-your-answers')
  }

  var returnTo = opts.returnTo || req.query.from || req.body.returnTo || getEligibilityReturnTo(req)

  res.render(view, {
    data: getGrasslandsV2PreviousSessionData(req),
    returnTo: returnTo,
    eligibilityError: opts.eligibilityError || false,
    eligibilityErrorMessage: opts.eligibilityErrorMessage || '',
    eligibilityErrorFieldId: opts.eligibilityErrorFieldId || ''
  })
}

function saveGrasslandsV2PreviousAnswer (req, fieldName, value) {
  req.session.data = req.session.data || {}
  req.session.data[fieldName] = value
}

router.get('/grasslands-v1-archive/check-business-details', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.checkBusinessDetails)
  if (req.query.from !== 'check-your-answers') {
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, true)
  }
  renderGrasslandsV2PreviousEligibilityPage(req, res, 'grasslands-v1-archive/check-business-details')
})

router.get('/grasslands-v1-archive/update-business-details', function (req, res) {
  res.render('grasslands-v1-archive/update-business-details', {
    data: getGrasslandsV2PreviousSessionData(req)
  })
})

router.get('/grasslands-v1-archive/check-land-details', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.checkLandDetails)
  if (req.query.from !== 'check-your-answers') {
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, true)
  }
  renderGrasslandsV2PreviousEligibilityPage(req, res, 'grasslands-v1-archive/check-land-details')
})

router.get('/grasslands-v1-archive/confirm-eligibility-details', function (req, res) {
  // Alias kept; task list now uses management control directly
  var query = req.query.from ? ('?from=' + encodeURIComponent(req.query.from)) : ''
  res.redirect('/grasslands-v1-archive/management-control' + query)
})

router.get('/grasslands-v1-archive/management-control', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.confirmEligible)
  renderGrasslandsV2PreviousEligibilityPage(req, res, 'grasslands-v1-archive/management-control')
})

router.get('/grasslands-v1-archive/hefer', function (req, res) {
  // Temporarily removed from the eligibility journey
  res.redirect('/grasslands-v1-archive/task-list')
})

router.get('/grasslands-v1-archive/sssi', function (req, res) {
  // Temporarily removed from the eligibility journey
  res.redirect('/grasslands-v1-archive/task-list')
})

router.get('/grasslands-v1-archive/eligible', function (req, res) {
  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.confirmEligible)
  res.render('grasslands-v1-archive/eligible', {
    data: getGrasslandsV2PreviousSessionData(req)
  })
})

router.get('/grasslands-v1-archive/select-land-map-fluid-find', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
  res.render('grasslands-v1-archive/select-land-map-fluid-find', Object.assign({
    data: getGrasslandsV2PreviousSessionData(req)
  }, getGrasslandsV2PreviousCompatibilityLocals(req)))
})

router.get('/grasslands-v1-archive/select-land', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)

  if (req.query.addAnother === '1' || req.query.addAnother === 'true') {
    grasslandsV2PreviousLandActions.commitDraftToApplication(req)
    if (grasslandsV2PreviousLandActions.hasSavedLandAndActions(req)) {
      grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
    }
  }

  res.render('grasslands-v1-archive/select-land', Object.assign({
    data: getGrasslandsV2PreviousSessionData(req),
    draftParcel: grasslandsV2PreviousLandActions.getDraftParcel(req),
    applicationParcels: grasslandsV2PreviousLandActions.getApplicationParcels(req)
  }, getGrasslandsV2PreviousCompatibilityLocals(req)))
})

router.post('/grasslands-v1-archive/select-land', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)

  if (!req.body.selectedParcelId) {
    return res.redirect('/grasslands-v1-archive/select-land')
  }

  var previousDraft = grasslandsV2PreviousLandActions.getDraftParcel(req)
  var previousParcelId = previousDraft && previousDraft.parcelId
  grasslandsV2PreviousLandActions.saveDraftParcelFromBody(req, req.body)

  // Only clear draft actions when the parcel changes
  if (previousParcelId !== req.body.selectedParcelId) {
    grasslandsV2PreviousLandActions.setDraftActions(req, [])
  }

  res.redirect('/grasslands-v1-archive/select-actions')
})

router.get('/grasslands-v1-archive/select-actions', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)

  var draftParcel = grasslandsV2PreviousLandActions.getDraftParcel(req)
  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/grasslands-v1-archive/select-land')
  }

  var sessionData = getGrasslandsV2PreviousSessionData(req)
  var focusActionCode = sessionData.focusActionCode || null
  if (sessionData.focusActionCode) {
    delete sessionData.focusActionCode
  }

  res.render('grasslands-v1-archive/select-actions', Object.assign({
    data: sessionData,
    draftParcel: draftParcel,
    draftActions: grasslandsV2PreviousLandActions.getDraftActions(req),
    applicationParcels: grasslandsV2PreviousLandActions.getApplicationParcels(req),
    focusActionCode: focusActionCode,
    returnToCheckYourAnswers: Boolean(sessionData.returnToCheckYourAnswers)
  }, getGrasslandsV2PreviousCompatibilityLocals(req)))
})

router.post('/grasslands-v1-archive/select-actions', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)

  var draftParcel = grasslandsV2PreviousLandActions.getDraftParcel(req)
  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/grasslands-v1-archive/select-land')
  }

  var draftActions = grasslandsV2PreviousLandActions.getDraftActions(req)
  if (req.body.draftLandActions) {
    draftActions = typeof req.body.draftLandActions === 'string'
      ? (function () {
        try {
          return JSON.parse(req.body.draftLandActions)
        } catch (error) {
          return []
        }
      })()
      : req.body.draftLandActions
  }

  if (!Array.isArray(draftActions) || draftActions.length === 0) {
    return res.render('grasslands-v1-archive/select-actions', Object.assign({
      data: getGrasslandsV2PreviousSessionData(req),
      draftParcel: draftParcel,
      draftActions: [],
      applicationParcels: grasslandsV2PreviousLandActions.getApplicationParcels(req),
      actionsError: true,
      actionsErrorMessage: 'Select at least one action'
    }, getGrasslandsV2PreviousCompatibilityLocals(req)))
  }

  grasslandsV2PreviousLandActions.setDraftActions(req, draftActions)

  res.redirect('/grasslands-v1-archive/confirm-land-and-actions')
})

router.get('/grasslands-v1-archive/consent-interruption', function (req, res) {
  var sessionData = getGrasslandsV2PreviousSessionData(req)
  var previewType = req.query.preview
  var allowedPreviewTypes = ['sssi', 'hefer', 'sssi-hefer']

  if (previewType && allowedPreviewTypes.indexOf(previewType) !== -1) {
    return res.render('grasslands-v1-archive/consent-interruption', {
      data: sessionData,
      interruptionType: previewType,
      requiresSssi: previewType === 'sssi' || previewType === 'sssi-hefer',
      requiresHefer: previewType === 'hefer' || previewType === 'sssi-hefer'
    })
  }

  var consent = grasslandsV2PreviousConsent.getConsentRequirementsForParcels(
    grasslandsV2PreviousLandActions.buildBasketParcels(req)
  )

  if (!consent.requiresConsent) {
    return res.redirect(sessionData.afterConsentRedirect || '/grasslands-v1-archive/confirm-land-and-actions')
  }

  res.render('grasslands-v1-archive/consent-interruption', {
    data: sessionData,
    interruptionType: consent.interruptionType,
    requiresSssi: consent.requiresSssi,
    requiresHefer: consent.requiresHefer
  })
})

router.post('/grasslands-v1-archive/consent-interruption', function (req, res) {
  var sessionData = getGrasslandsV2PreviousSessionData(req)
  var redirectTo = sessionData.afterConsentRedirect || '/grasslands-v1-archive/task-list'
  delete sessionData.afterConsentRedirect
  res.redirect(redirectTo)
})

router.get('/grasslands-v1-archive/confirm-land-and-actions', function (req, res) {
  var basketParcels = grasslandsV2PreviousLandActions.buildBasketParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      actions: (parcel.actions || []).map(function (action) {
        return Object.assign({}, action, {
          consentHint: grasslandsV2PreviousConsent.getActionConsentHint(parcel.parcelId, action.code)
        })
      })
    })
  })
  var basketSummary = grasslandsV2PreviousLandActions.summariseBasket(basketParcels)
  var sessionData = getGrasslandsV2PreviousSessionData(req)
  var flashMessage = sessionData.confirmLandFlash || null

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  delete sessionData.confirmLandFlash

  if (!basketSummary.isEmpty) {
    grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
  }

  res.render('grasslands-v1-archive/confirm-land-and-actions', {
    data: sessionData,
    basketParcels: basketParcels,
    basketSummary: basketSummary,
    flashMessage: flashMessage
  })
})

router.post('/grasslands-v1-archive/confirm-land-and-actions', function (req, res) {
  var action = req.body && req.body.confirmAction
  var sessionData = getGrasslandsV2PreviousSessionData(req)

  grasslandsV2PreviousLandActions.commitDraftToApplication(req)

  if (grasslandsV2PreviousLandActions.hasSavedLandAndActions(req)) {
    grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
  } else if (
    grasslandsV2PreviousLandActions.getDraftParcel(req) ||
    grasslandsV2PreviousLandActions.buildBasketParcels(req).length
  ) {
    grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
  } else {
    grasslandsV2PreviousTasks.setTaskStatus(
      req,
      grasslandsV2PreviousTasks.TASK_IDS.selectLand,
      grasslandsV2PreviousTasks.STATUS.NOT_STARTED
    )
  }

  if (action === 'addAnother') {
    // Keep returnToCheckYourAnswers so after adding they still return to CYA
    if (req.body.from === 'check-your-answers') {
      sessionData.returnToCheckYourAnswers = true
    }
    return res.redirect('/grasslands-v1-archive/select-land?addAnother=1')
  }

  var consent = grasslandsV2PreviousConsent.getConsentRequirementsForParcels(
    grasslandsV2PreviousLandActions.buildBasketParcels(req)
  )
  var goingToCya = action === 'returnToCya' ||
    req.body.from === 'check-your-answers' ||
    sessionData.returnToCheckYourAnswers

  if (consent.requiresConsent) {
    if (goingToCya) {
      delete sessionData.returnToCheckYourAnswers
      sessionData.afterConsentRedirect = '/grasslands-v1-archive/check-your-answers'
    } else {
      sessionData.afterConsentRedirect = '/grasslands-v1-archive/task-list'
    }
    return res.redirect('/grasslands-v1-archive/consent-interruption')
  }

  if (goingToCya) {
    delete sessionData.returnToCheckYourAnswers
    return res.redirect('/grasslands-v1-archive/check-your-answers')
  }

  res.redirect('/grasslands-v1-archive/task-list')
})

router.get('/grasslands-v1-archive/confirm-land-and-actions/change/:parcelId', function (req, res) {
  var parcelId = req.params.parcelId
  var sessionData = getGrasslandsV2PreviousSessionData(req)
  var loaded = grasslandsV2PreviousLandActions.loadParcelIntoDraftForEdit(req, parcelId)

  if (!loaded) {
    var draftParcel = grasslandsV2PreviousLandActions.getDraftParcel(req)
    if (!draftParcel || draftParcel.parcelId !== parcelId) {
      return res.redirect('/grasslands-v1-archive/confirm-land-and-actions')
    }
  }

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  if (req.query.actionCode) {
    sessionData.focusActionCode = String(req.query.actionCode).toUpperCase()
  }

  res.redirect('/grasslands-v1-archive/select-actions')
})

router.get('/grasslands-v1-archive/remove-parcel-actions/:parcelId', function (req, res) {
  var parcel = grasslandsV2PreviousLandActions.findBasketParcel(req, req.params.parcelId)

  if (!parcel) {
    return res.redirect('/grasslands-v1-archive/confirm-land-and-actions')
  }

  res.render('grasslands-v1-archive/remove-parcel-actions', {
    data: getGrasslandsV2PreviousSessionData(req),
    parcel: parcel
  })
})

router.post('/grasslands-v1-archive/remove-parcel-actions/:parcelId', function (req, res) {
  var parcelId = req.params.parcelId
  var parcel = grasslandsV2PreviousLandActions.findBasketParcel(req, parcelId)
  var parcelLabel = parcel
    ? (grasslandsV2PreviousLandActions.getParcelDisplayReference(parcel) || 'This land parcel')
    : 'This land parcel'

  if (req.body && req.body.confirmRemove === 'yes') {
    grasslandsV2PreviousLandActions.removeParcelFromBasket(req, parcelId)

    if (grasslandsV2PreviousLandActions.hasSavedLandAndActions(req) ||
        (grasslandsV2PreviousLandActions.getDraftActions(req) || []).length > 0) {
      grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
    } else {
      grasslandsV2PreviousTasks.setTaskStatus(
        req,
        grasslandsV2PreviousTasks.TASK_IDS.selectLand,
        grasslandsV2PreviousTasks.STATUS.NOT_STARTED
      )
    }

    req.session.data = req.session.data || {}
    req.session.data.confirmLandFlash = parcelLabel + ' and its actions have been removed.'
  }

  res.redirect('/grasslands-v1-archive/confirm-land-and-actions')
})

router.get('/grasslands-v1-archive/submit-application', function (req, res) {
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.submitApplication)
  res.render('grasslands-v1-archive/submit-application', {
    data: getGrasslandsV2PreviousSessionData(req)
  })
})

router.post('/grasslands-v1-archive/submit-application', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.checkAnswers)
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.submitApplication)
  res.render('grasslands-v1-archive/submit-application', {
    data: getGrasslandsV2PreviousSessionData(req)
  })
})

function getGrasslandsV2PreviousConfirmationNotices (req) {
  var consent = grasslandsV2PreviousConsent.getConsentRequirementsForParcels(
    grasslandsV2PreviousLandActions.buildBasketParcels(req)
  )

  return {
    showHeferNotice: consent.requiresHefer,
    showSssiNotice: consent.requiresSssi
  }
}

function formatGrasslandsV2PreviousSubmittedAt (date) {
  var submittedAt = date instanceof Date ? date : new Date(date)
  if (isNaN(submittedAt.getTime())) {
    submittedAt = new Date()
  }

  var datePart = submittedAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  var timePart = submittedAt
    .toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .toLowerCase()
    .replace(' ', '')

  return datePart + ' at ' + timePart
}

function recordGrasslandsV2PreviousApplicationSubmitted (req) {
  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.submitApplication)
  req.session.data = req.session.data || {}
  req.session.data.grasslandsV2PreviousApplicationSubmitted = true
  req.session.data.grasslandsV2PreviousApplicationInProgress = false
  if (!req.session.data.grasslandsV2PreviousApplicationSubmittedAt) {
    req.session.data.grasslandsV2PreviousApplicationSubmittedAt = new Date().toISOString()
  }
}

router.get('/grasslands-v1-archive/confirmation', function (req, res) {
  recordGrasslandsV2PreviousApplicationSubmitted(req)
  var notices = getGrasslandsV2PreviousConfirmationNotices(req)
  res.render('grasslands-v1-archive/confirmation', {
    data: getGrasslandsV2PreviousSessionData(req),
    showHeferNotice: notices.showHeferNotice,
    showSssiNotice: notices.showSssiNotice
  })
})

function getGrasslandsV2PreviousReviewApplicationData (req) {
  var basketParcels = grasslandsV2PreviousLandActions.buildBasketParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      landCover: parcel.landCover || parcel.landCoverLabel || 'Permanent grassland',
      actions: (parcel.actions || []).map(function (action) {
        return Object.assign({}, action)
      })
    })
  })
  var basketSummary = grasslandsV2PreviousLandActions.summariseBasket(basketParcels)

  if (!basketSummary.isEmpty) {
    return {
      reviewParcels: basketParcels,
      reviewSummary: basketSummary,
      usedMockData: false
    }
  }

  // Prototype fallback when nothing has been saved in this session
  var mockParcels = [
    {
      parcelId: 'far-meadow',
      heading: 'Land parcel SO3757 3193',
      parcelReference: 'SO3757 3193',
      totalAreaFormatted: '12.4500 hectares',
      landCover: 'Permanent grassland',
      yearlyPaymentFormatted: '£2,012.70',
      actions: [
        {
          code: 'CLIG3',
          name: 'Manage grassland with very low nutrient inputs',
          valueDisplay: '8.2000 ha (£1,238.20)'
        },
        {
          code: 'GRH7',
          name: 'Haymaking supplement',
          valueDisplay: '4.2500 ha (£667.25)'
        }
      ]
    },
    {
      parcelId: 'pond-close',
      heading: 'Land parcel SO3757 3203',
      parcelReference: 'SO3757 3203',
      totalAreaFormatted: '29.3214 hectares',
      landCover: 'Temporary grass',
      yearlyPaymentFormatted: '£3,145.60',
      actions: [
        {
          code: 'CNUM2',
          name: 'Legumes on improved grassland',
          valueDisplay: '10.0000 ha (£1,020.00)'
        },
        {
          code: 'CSAM3',
          name: 'Herbal leys',
          valueDisplay: '9.4900 ha (£2,125.60)'
        }
      ]
    }
  ]

  return {
    reviewParcels: mockParcels,
    reviewSummary: {
      totalYearlyPaymentFormatted: '£5,158.30',
      isEmpty: false
    },
    usedMockData: true
  }
}

router.get('/grasslands-v1-archive/view-application', function (req, res) {
  var review = getGrasslandsV2PreviousReviewApplicationData(req)
  var fromLanding = req.query.from === 'landing'
  var sessionData = getGrasslandsV2PreviousSessionData(req)
  var submittedAt = sessionData.grasslandsV2PreviousApplicationSubmittedAt || new Date().toISOString()

  res.render('grasslands-v1-archive/view-application', {
    data: sessionData,
    reviewParcels: review.reviewParcels,
    reviewSummary: review.reviewSummary,
    applicationReference: 'HDJ2123F',
    applicationSubmittedAtFormatted: formatGrasslandsV2PreviousSubmittedAt(submittedAt),
    backHref: fromLanding
      ? '/grasslands-v1-archive/singlefrontdoor/landing/landing'
      : '/grasslands-v1-archive/confirmation',
    backButtonText: fromLanding
      ? 'Back to Farm and Land Service'
      : 'Back to confirmation'
  })
})

router.get('/grasslands-v1-archive/contact-us', function (req, res) {
  var backHref = '/grasslands-v1-archive/task-list'
  var referer = req.get('Referrer') || req.get('Referer') || ''

  try {
    var refererUrl = new URL(referer, 'http://localhost:3000')
    if (refererUrl.pathname.indexOf('/grasslands-v1-archive/') === 0 &&
        refererUrl.pathname.indexOf('/grasslands-v1-archive/contact-us') !== 0) {
      backHref = refererUrl.pathname + refererUrl.search
    }
  } catch (error) {
    // Keep default back link
  }

  res.render('grasslands-v1-archive/contact-us', {
    data: getGrasslandsV2PreviousSessionData(req),
    backHref: backHref,
    serviceName: 'Apply for a grasslands agreement',
    serviceUrl: '/grasslands-v1-archive/task-list'
  })
})
router.post('/grasslands-v1-archive/confirmation', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  recordGrasslandsV2PreviousApplicationSubmitted(req)
  var notices = getGrasslandsV2PreviousConfirmationNotices(req)
  res.render('grasslands-v1-archive/confirmation', {
    data: getGrasslandsV2PreviousSessionData(req),
    showHeferNotice: notices.showHeferNotice,
    showSssiNotice: notices.showSssiNotice
  })
})

router.post('/grasslands-v1-archive/management-control-answer', function (req, res) {
  var managementControlAnswer = req.body['management-answer-v2']
  var returnTo = getEligibilityReturnTo(req, req.body.returnTo)

  if (!managementControlAnswer) {
    var referer = req.get('Referer') || ''
    var managementView = referer.indexOf('/management-control') !== -1
      ? 'grasslands-v1-archive/management-control'
      : 'grasslands-v1-archive/confirm-eligibility-details'

    return renderGrasslandsV2PreviousEligibilityPage(req, res, managementView, {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if you will have the required management control of the land in this application',
      eligibilityErrorFieldId: 'management-answer-v2-error'
    })
  }

  saveGrasslandsV2PreviousAnswer(req, 'management-answer-v2', managementControlAnswer)

  if (managementControlAnswer === 'no') {
    clearGrasslandsV2PreviousEligibilityReturnTo(req)
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
    grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.confirmEligible)
    return res.redirect('/grasslands-v1-archive/ineligible')
  }

  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.confirmEligible)

  if (returnTo === 'check-your-answers') {
    clearGrasslandsV2PreviousEligibilityReturnTo(req)
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/grasslands-v1-archive/check-your-answers')
  }

  clearGrasslandsV2PreviousEligibilityReturnTo(req)
  setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
  res.redirect('/grasslands-v1-archive/task-list')
})

router.post('/grasslands-v1-archive/hefer-answer', function (req, res) {
  // HEFER step temporarily removed from grasslands-v2 journey
  return res.redirect('/grasslands-v1-archive/task-list')
})

router.post('/grasslands-v1-archive/sssi-answer', function (req, res) {
  // SSSI step temporarily removed from grasslands-v2 journey
  return res.redirect('/grasslands-v1-archive/task-list')
})

router.post('/grasslands-v1-archive/check-business-details-answer', function (req, res) {
  var businessDetailsAnswer = req.body['business-details-answer']
  var returnTo = getEligibilityReturnTo(req, req.body.returnTo)

  if (!businessDetailsAnswer) {
    return renderGrasslandsV2PreviousEligibilityPage(req, res, 'grasslands-v1-archive/check-business-details', {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if these details are correct',
      eligibilityErrorFieldId: 'business-details-answer-error'
    })
  }

  saveGrasslandsV2PreviousAnswer(req, 'business-details-answer', businessDetailsAnswer)

  if (businessDetailsAnswer === 'no') {
    clearGrasslandsV2PreviousEligibilityReturnTo(req)
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
    grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.checkBusinessDetails)
    req.session.data = req.session.data || {}
    req.session.data.grasslandsV2PreviousApplicationInProgress = true
    return res.redirect('/grasslands-v1-archive/singlefrontdoor/landing/landing')
  }

  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.checkBusinessDetails)

  if (returnTo === 'check-your-answers') {
    clearGrasslandsV2PreviousEligibilityReturnTo(req)
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/grasslands-v1-archive/check-your-answers')
  }

  setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, true)
  res.redirect(getGrasslandsV2PreviousNextCheckBeforeYouStartPath(req))
})

router.post('/grasslands-v1-archive/check-land-details-answer', function (req, res) {
  var landDetailsAnswer = req.body['land-details-answer']
  var returnTo = getEligibilityReturnTo(req, req.body.returnTo)

  if (!landDetailsAnswer) {
    return renderGrasslandsV2PreviousEligibilityPage(req, res, 'grasslands-v1-archive/check-land-details', {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if your digital maps show the correct land details',
      eligibilityErrorFieldId: 'land-details-answer-error'
    })
  }

  saveGrasslandsV2PreviousAnswer(req, 'land-details-answer', landDetailsAnswer)

  if (landDetailsAnswer === 'no') {
    clearGrasslandsV2PreviousEligibilityReturnTo(req)
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
    grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.checkLandDetails)
    return res.redirect('/grasslands-v1-archive/update-land-details')
  }

  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.checkLandDetails)

  if (returnTo === 'check-your-answers') {
    clearGrasslandsV2PreviousEligibilityReturnTo(req)
    setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/grasslands-v1-archive/check-your-answers')
  }

  setGrasslandsV2PreviousCheckBeforeYouStartLinearFlow(req, true)
  res.redirect(getGrasslandsV2PreviousNextCheckBeforeYouStartPath(req))
})

router.get('/grasslands-v1-archive/check-your-answers', function (req, res) {
  grasslandsV2PreviousLandActions.syncParcelSelectionsData(req)
  var actionsSummary = buildGrasslandsV2PreviousActionsSummaryFromSession(req)
  var basketParcels = grasslandsV2PreviousLandActions.buildBasketParcels(req)
  var consentHintsByParcel = {}

  basketParcels.forEach(function (parcel) {
    if (!parcel || !parcel.parcelId) {
      return
    }

    var hints = {}
    ;(parcel.actions || []).forEach(function (action) {
      var hint = grasslandsV2PreviousConsent.getActionConsentHint(parcel.parcelId, action.code)
      if (hint) {
        hints[action.code] = hint
      }
    })

    if (Object.keys(hints).length > 0) {
      consentHintsByParcel[parcel.parcelId] = hints
    }
  })

  if (actionsSummary.rows && actionsSummary.rows.length > 0) {
    grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
  }

  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.checkAnswers)

  res.render('grasslands-v1-archive/check-your-answers', {
    data: Object.assign({}, req.session.data),
    actionsSummaryRows: actionsSummary.rows,
    actionsSummaryTotal: actionsSummary.total,
    consentHintsByParcel: consentHintsByParcel
  })
})

router.post('/grasslands-v1-archive/check-your-answers', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  grasslandsV2PreviousTasks.markCompleted(req, grasslandsV2PreviousTasks.TASK_IDS.selectLand)
  grasslandsV2PreviousTasks.markInProgress(req, grasslandsV2PreviousTasks.TASK_IDS.checkAnswers)
  res.redirect('/grasslands-v1-archive/check-your-answers')
})


// --- Legacy grasslands-v2-previous URLs → grasslands-v1-archive ---
router.use('/grasslands-v2-previous', function (req, res) {
  var target = '/grasslands-v1-archive' + (req.url || '/')
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(target)
  }
  return res.redirect(307, target)
})

// --- grasslands-v2 (SFI Grasslands Version 1 — merged from Concept V2; archive at grasslands-v1-archive) ---

function getGrasslandsV2SessionData (req) {
  return req.session.data || {}
}


function buildGrasslandsV2ActionsSummaryFromSession (req) {
  var data = getGrasslandsV2SessionData(req)
  return buildActionsSummaryFromSession(Object.assign({}, data, {
    parcelSelectionsData: data.parcelSelectionsData
  }))
}


// Keep in sync with app/assets/javascripts/grasslands-v2-mvp-actions.js
const GRASSLANDS_V2_MVP_ACTION_CODES = [
  'CLIG3',
  'GRH7',
  'GRH8',
  'GRH10',
  'CSAM3',
  'CHRW2',
  'WBD2',
  'HEF1',
  'CNUM2',
  'CIGL2',
  'CIGL1',
  'WBD1',
  'SCR2',
  'BND1',
  'BND2',
  'GRH12'
]

function getGrasslandsV2CompatibilityLocals (req) {
  var compatibilityYear = getCompatibilityYearFromSession(getGrasslandsV2SessionData(req))

  return {
    compatibilityYear: compatibilityYear,
    compatibilityClientConfig: JSON.stringify(
      buildMatrixClientConfig(GRASSLANDS_V2_MVP_ACTION_CODES, compatibilityYear)
    )
  }
}

function clearGrasslandsV2ApplicationData (req) {
  var existingData = getGrasslandsV2SessionData(req)
  var preservedBusinessContext = {}

  if (existingData.agileSFD) {
    preservedBusinessContext.agileSFD = existingData.agileSFD
  }

  if (existingData.valleySFD) {
    preservedBusinessContext.valleySFD = existingData.valleySFD
  }

  req.session.data = Object.assign({}, sessionDataDefaults, preservedBusinessContext)
}

router.get('/grasslands-v2/before-you-start', function (req, res) {
  clearGrasslandsV2ApplicationData(req)

  res.render('grasslands-v2/before-you-start', {
    data: getGrasslandsV2SessionData(req)
  })
})

router.get('/grasslands-v2/task-list', function (req, res) {
  setCheckBeforeYouStartLinearFlow(req, false)
  grasslandsV2Tasks.ensureTasks(req)

  var actionsSummary = buildGrasslandsV2ActionsSummaryFromSession(req)
  grasslandsV2Tasks.syncFromSessionAnswers(req, {
    hasSelectedLand: (actionsSummary.rows && actionsSummary.rows.length > 0) ||
      grasslandsV2LandActions.hasSavedLandAndActions(req)
  })

  var taskListPage = grasslandsV2Tasks.getTaskListPageData(req)

  res.render('grasslands-v2/task-list', Object.assign({
    data: getGrasslandsV2SessionData(req)
  }, taskListPage))
})

function setSfiEligibilityReturnTo (req, returnTo) {
  if (returnTo === 'check-your-answers') {
    req.session.data = req.session.data || {}
    req.session.data.eligibilityReturnTo = returnTo
  }
}

function getSfiEligibilityReturnTo (req, bodyReturnTo) {
  if (bodyReturnTo) {
    return bodyReturnTo
  }

  return getGrasslandsV2SessionData(req).eligibilityReturnTo || ''
}

function clearEligibilityReturnTo (req) {
  if (req.session.data) {
    delete req.session.data.eligibilityReturnTo
  }
}

function setCheckBeforeYouStartLinearFlow (req, enabled) {
  req.session.data = req.session.data || {}
  if (enabled) {
    req.session.data.checkBeforeYouStartLinearFlow = true
  } else {
    delete req.session.data.checkBeforeYouStartLinearFlow
  }
}

function isCheckBeforeYouStartLinearFlow (req) {
  return Boolean(getGrasslandsV2SessionData(req).checkBeforeYouStartLinearFlow)
}

function getNextCheckBeforeYouStartPath (req) {
  grasslandsV2Tasks.syncFromSessionAnswers(req, {})
  var states = grasslandsV2Tasks.getResolvedTaskStates(req)

  if (states.checkLandDetails.key !== grasslandsV2Tasks.STATUS.COMPLETED) {
    return '/grasslands-v2/check-land-details'
  }

  if (states.confirmEligible.key !== grasslandsV2Tasks.STATUS.COMPLETED) {
    return '/grasslands-v2/management-control'
  }

  return '/grasslands-v2/task-list'
}

function renderGrasslandsV2EligibilityPage (req, res, view, options) {
  var opts = options || {}

  if (req.query.from === 'check-your-answers') {
    setSfiEligibilityReturnTo(req, 'check-your-answers')
  }

  var returnTo = opts.returnTo || req.query.from || req.body.returnTo || getSfiEligibilityReturnTo(req)

  res.render(view, {
    data: getGrasslandsV2SessionData(req),
    returnTo: returnTo,
    eligibilityError: opts.eligibilityError || false,
    eligibilityErrorMessage: opts.eligibilityErrorMessage || '',
    eligibilityErrorFieldId: opts.eligibilityErrorFieldId || ''
  })
}

function saveGrasslandsV2Answer (req, fieldName, value) {
  req.session.data = req.session.data || {}
  req.session.data[fieldName] = value
}

router.get('/grasslands-v2/check-business-details', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.checkBusinessDetails)
  if (req.query.from !== 'check-your-answers') {
    setCheckBeforeYouStartLinearFlow(req, true)
  }
  renderGrasslandsV2EligibilityPage(req, res, 'grasslands-v2/check-business-details')
})

router.get('/grasslands-v2/update-business-details', function (req, res) {
  res.render('grasslands-v2/update-business-details', {
    data: getGrasslandsV2SessionData(req)
  })
})

router.get('/grasslands-v2/check-land-details', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.checkLandDetails)
  if (req.query.from !== 'check-your-answers') {
    setCheckBeforeYouStartLinearFlow(req, true)
  }
  renderGrasslandsV2EligibilityPage(req, res, 'grasslands-v2/check-land-details')
})

router.get('/grasslands-v2/confirm-eligibility-details', function (req, res) {
  // Alias kept; task list now uses management control directly
  var query = req.query.from ? ('?from=' + encodeURIComponent(req.query.from)) : ''
  res.redirect('/grasslands-v2/management-control' + query)
})

router.get('/grasslands-v2/management-control', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.confirmEligible)
  renderGrasslandsV2EligibilityPage(req, res, 'grasslands-v2/management-control')
})

router.get('/grasslands-v2/hefer', function (req, res) {
  // Temporarily removed from the eligibility journey
  res.redirect('/grasslands-v2/task-list')
})

router.get('/grasslands-v2/sssi', function (req, res) {
  // Temporarily removed from the eligibility journey
  res.redirect('/grasslands-v2/task-list')
})

router.get('/grasslands-v2/eligible', function (req, res) {
  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.confirmEligible)
  res.render('grasslands-v2/eligible', {
    data: getGrasslandsV2SessionData(req)
  })
})

router.get('/grasslands-v2/select-land-map-fluid-find', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)
  res.render('grasslands-v2/select-land-map-fluid-find', Object.assign({
    data: getGrasslandsV2SessionData(req)
  }, getGrasslandsV2CompatibilityLocals(req)))
})

router.get('/grasslands-v2/select-land', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)

  if (req.query.addAnother === '1' || req.query.addAnother === 'true') {
    grasslandsV2LandActions.commitDraftToApplication(req)
    if (grasslandsV2LandActions.hasSavedLandAndActions(req)) {
      grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.selectLand)
    }
  }

  res.render('grasslands-v2/select-land', Object.assign({
    data: getGrasslandsV2SessionData(req),
    draftParcel: grasslandsV2LandActions.getDraftParcel(req),
    applicationParcels: grasslandsV2LandActions.getApplicationParcels(req)
  }, getGrasslandsV2CompatibilityLocals(req)))
})

router.post('/grasslands-v2/select-land', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)

  if (!req.body.selectedParcelId) {
    return res.redirect('/grasslands-v2/select-land')
  }

  var previousDraft = grasslandsV2LandActions.getDraftParcel(req)
  var previousParcelId = previousDraft && previousDraft.parcelId
  grasslandsV2LandActions.saveDraftParcelFromBody(req, req.body)

  // Only clear draft actions when the parcel changes
  if (previousParcelId !== req.body.selectedParcelId) {
    grasslandsV2LandActions.setDraftActions(req, [])
  }

  res.redirect('/grasslands-v2/select-actions')
})

router.get('/grasslands-v2/select-actions', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)

  var draftParcel = grasslandsV2LandActions.getDraftParcel(req)
  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/grasslands-v2/select-land')
  }

  var sessionData = getGrasslandsV2SessionData(req)
  var focusActionCode = sessionData.focusActionCode || null
  if (sessionData.focusActionCode) {
    delete sessionData.focusActionCode
  }

  res.render('grasslands-v2/select-actions', Object.assign({
    data: sessionData,
    draftParcel: draftParcel,
    draftActions: grasslandsV2LandActions.getDraftActions(req),
    applicationParcels: grasslandsV2LandActions.getApplicationParcels(req),
    focusActionCode: focusActionCode,
    returnToCheckYourAnswers: Boolean(sessionData.returnToCheckYourAnswers)
  }, getGrasslandsV2CompatibilityLocals(req)))
})

router.post('/grasslands-v2/select-actions', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)

  var draftParcel = grasslandsV2LandActions.getDraftParcel(req)
  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/grasslands-v2/select-land')
  }

  var draftActions = grasslandsV2LandActions.getDraftActions(req)
  if (req.body.draftLandActions) {
    draftActions = typeof req.body.draftLandActions === 'string'
      ? (function () {
        try {
          return JSON.parse(req.body.draftLandActions)
        } catch (error) {
          return []
        }
      })()
      : req.body.draftLandActions
  }

  if (!Array.isArray(draftActions) || draftActions.length === 0) {
    return res.render('grasslands-v2/select-actions', Object.assign({
      data: getGrasslandsV2SessionData(req),
      draftParcel: draftParcel,
      draftActions: [],
      applicationParcels: grasslandsV2LandActions.getApplicationParcels(req),
      actionsError: true,
      actionsErrorMessage: 'Select at least one action'
    }, getGrasslandsV2CompatibilityLocals(req)))
  }

  grasslandsV2LandActions.setDraftActions(req, draftActions)

  res.redirect('/grasslands-v2/confirm-land-and-actions')
})

router.get('/grasslands-v2/consent-interruption', function (req, res) {
  var sessionData = getGrasslandsV2SessionData(req)
  var previewType = req.query.preview
  var allowedPreviewTypes = ['sssi', 'hefer', 'sssi-hefer']

  if (previewType && allowedPreviewTypes.indexOf(previewType) !== -1) {
    return res.render('grasslands-v2/consent-interruption', {
      data: sessionData,
      interruptionType: previewType,
      requiresSssi: previewType === 'sssi' || previewType === 'sssi-hefer',
      requiresHefer: previewType === 'hefer' || previewType === 'sssi-hefer'
    })
  }

  var consent = grasslandsV2Consent.getConsentRequirementsForParcels(
    grasslandsV2LandActions.buildBasketParcels(req)
  )

  if (!consent.requiresConsent) {
    return res.redirect(sessionData.afterConsentRedirect || '/grasslands-v2/confirm-land-and-actions')
  }

  res.render('grasslands-v2/consent-interruption', {
    data: sessionData,
    interruptionType: consent.interruptionType,
    requiresSssi: consent.requiresSssi,
    requiresHefer: consent.requiresHefer
  })
})

router.post('/grasslands-v2/consent-interruption', function (req, res) {
  var sessionData = getGrasslandsV2SessionData(req)
  var redirectTo = sessionData.afterConsentRedirect || '/grasslands-v2/task-list'
  delete sessionData.afterConsentRedirect
  res.redirect(redirectTo)
})

router.get('/grasslands-v2/confirm-land-and-actions', function (req, res) {
  var basketParcels = grasslandsV2LandActions.buildBasketParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      actions: (parcel.actions || []).map(function (action) {
        return Object.assign({}, action, {
          consentHint: grasslandsV2Consent.getActionConsentHint(parcel.parcelId, action.code)
        })
      })
    })
  })
  var basketSummary = grasslandsV2LandActions.summariseBasket(basketParcels)
  var sessionData = getGrasslandsV2SessionData(req)
  var flashMessage = sessionData.confirmLandFlash || null

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  delete sessionData.confirmLandFlash

  if (!basketSummary.isEmpty) {
    grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)
  }

  res.render('grasslands-v2/confirm-land-and-actions', {
    data: sessionData,
    basketParcels: basketParcels,
    basketSummary: basketSummary,
    flashMessage: flashMessage
  })
})

router.post('/grasslands-v2/confirm-land-and-actions', function (req, res) {
  var action = req.body && req.body.confirmAction
  var sessionData = getGrasslandsV2SessionData(req)

  grasslandsV2LandActions.commitDraftToApplication(req)

  if (grasslandsV2LandActions.hasSavedLandAndActions(req)) {
    grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.selectLand)
  } else if (
    grasslandsV2LandActions.getDraftParcel(req) ||
    grasslandsV2LandActions.buildBasketParcels(req).length
  ) {
    grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)
  } else {
    grasslandsV2Tasks.setTaskStatus(
      req,
      grasslandsV2Tasks.TASK_IDS.selectLand,
      grasslandsV2Tasks.STATUS.NOT_STARTED
    )
  }

  if (action === 'addAnother') {
    // Keep returnToCheckYourAnswers so after adding they still return to CYA
    if (req.body.from === 'check-your-answers') {
      sessionData.returnToCheckYourAnswers = true
    }
    return res.redirect('/grasslands-v2/select-land?addAnother=1')
  }

  var consent = grasslandsV2Consent.getConsentRequirementsForParcels(
    grasslandsV2LandActions.buildBasketParcels(req)
  )
  var goingToCya = action === 'returnToCya' ||
    req.body.from === 'check-your-answers' ||
    sessionData.returnToCheckYourAnswers

  if (consent.requiresConsent) {
    if (goingToCya) {
      delete sessionData.returnToCheckYourAnswers
      sessionData.afterConsentRedirect = '/grasslands-v2/check-your-answers'
    } else {
      sessionData.afterConsentRedirect = '/grasslands-v2/task-list'
    }
    return res.redirect('/grasslands-v2/consent-interruption')
  }

  if (goingToCya) {
    delete sessionData.returnToCheckYourAnswers
    return res.redirect('/grasslands-v2/check-your-answers')
  }

  res.redirect('/grasslands-v2/task-list')
})

router.get('/grasslands-v2/confirm-land-and-actions/change/:parcelId', function (req, res) {
  var parcelId = req.params.parcelId
  var sessionData = getGrasslandsV2SessionData(req)
  var loaded = grasslandsV2LandActions.loadParcelIntoDraftForEdit(req, parcelId)

  if (!loaded) {
    var draftParcel = grasslandsV2LandActions.getDraftParcel(req)
    if (!draftParcel || draftParcel.parcelId !== parcelId) {
      return res.redirect('/grasslands-v2/confirm-land-and-actions')
    }
  }

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  if (req.query.actionCode) {
    sessionData.focusActionCode = String(req.query.actionCode).toUpperCase()
  }

  res.redirect('/grasslands-v2/select-actions')
})

router.get('/grasslands-v2/remove-parcel-actions/:parcelId', function (req, res) {
  var parcel = grasslandsV2LandActions.findBasketParcel(req, req.params.parcelId)

  if (!parcel) {
    return res.redirect('/grasslands-v2/confirm-land-and-actions')
  }

  res.render('grasslands-v2/remove-parcel-actions', {
    data: getGrasslandsV2SessionData(req),
    parcel: parcel
  })
})

router.post('/grasslands-v2/remove-parcel-actions/:parcelId', function (req, res) {
  var parcelId = req.params.parcelId
  var parcel = grasslandsV2LandActions.findBasketParcel(req, parcelId)
  var parcelLabel = parcel
    ? (grasslandsV2LandActions.getParcelDisplayReference(parcel) || 'This land parcel')
    : 'This land parcel'

  if (req.body && req.body.confirmRemove === 'yes') {
    grasslandsV2LandActions.removeParcelFromBasket(req, parcelId)

    if (grasslandsV2LandActions.hasSavedLandAndActions(req) ||
        (grasslandsV2LandActions.getDraftActions(req) || []).length > 0) {
      grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.selectLand)
    } else {
      grasslandsV2Tasks.setTaskStatus(
        req,
        grasslandsV2Tasks.TASK_IDS.selectLand,
        grasslandsV2Tasks.STATUS.NOT_STARTED
      )
    }

    req.session.data = req.session.data || {}
    req.session.data.confirmLandFlash = parcelLabel + ' and its actions have been removed.'
  }

  res.redirect('/grasslands-v2/confirm-land-and-actions')
})

router.get('/grasslands-v2/submit-application', function (req, res) {
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.submitApplication)
  res.render('grasslands-v2/submit-application', {
    data: getGrasslandsV2SessionData(req)
  })
})

router.post('/grasslands-v2/submit-application', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.checkAnswers)
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.submitApplication)
  res.render('grasslands-v2/submit-application', {
    data: getGrasslandsV2SessionData(req)
  })
})

function getGrasslandsV2ConfirmationNotices (req) {
  var consent = grasslandsV2Consent.getConsentRequirementsForParcels(
    grasslandsV2LandActions.buildBasketParcels(req)
  )

  return {
    showHeferNotice: consent.requiresHefer,
    showSssiNotice: consent.requiresSssi
  }
}

function formatGrasslandsV2SubmittedAt (date) {
  var submittedAt = date instanceof Date ? date : new Date(date)
  if (isNaN(submittedAt.getTime())) {
    submittedAt = new Date()
  }

  var datePart = submittedAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  var timePart = submittedAt
    .toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .toLowerCase()
    .replace(' ', '')

  return datePart + ' at ' + timePart
}

function recordGrasslandsV2ApplicationSubmitted (req) {
  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.submitApplication)
  req.session.data = req.session.data || {}
  req.session.data.grasslandsV2ApplicationSubmitted = true
  req.session.data.grasslandsV2ApplicationInProgress = false
  if (!req.session.data.grasslandsV2ApplicationSubmittedAt) {
    req.session.data.grasslandsV2ApplicationSubmittedAt = new Date().toISOString()
  }
}

router.get('/grasslands-v2/confirmation', function (req, res) {
  recordGrasslandsV2ApplicationSubmitted(req)
  var notices = getGrasslandsV2ConfirmationNotices(req)
  res.render('grasslands-v2/confirmation', {
    data: getGrasslandsV2SessionData(req),
    showHeferNotice: notices.showHeferNotice,
    showSssiNotice: notices.showSssiNotice
  })
})

function getGrasslandsV2ReviewApplicationData (req) {
  var basketParcels = grasslandsV2LandActions.buildBasketParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      landCover: parcel.landCover || parcel.landCoverLabel || 'Permanent grassland',
      actions: (parcel.actions || []).map(function (action) {
        return Object.assign({}, action)
      })
    })
  })
  var basketSummary = grasslandsV2LandActions.summariseBasket(basketParcels)

  if (!basketSummary.isEmpty) {
    return {
      reviewParcels: basketParcels,
      reviewSummary: basketSummary,
      usedMockData: false
    }
  }

  // Prototype fallback when nothing has been saved in this session
  var mockParcels = [
    {
      parcelId: 'far-meadow',
      heading: 'Land parcel SO3757 3193',
      parcelReference: 'SO3757 3193',
      totalAreaFormatted: '12.4500 ha',
      areaUsedFormatted: '8.2000 ha',
      availableLeftFormatted: '4.2500 ha',
      landCover: 'Permanent grassland',
      yearlyPaymentFormatted: '£2,012.70',
      actions: [
        {
          code: 'CLIG3',
          name: 'Manage grassland with very low nutrient inputs',
          valueDisplay: '8.2000 ha (£1,238.20)'
        },
        {
          code: 'GRH7',
          name: 'Haymaking supplement',
          valueDisplay: '4.2500 ha (£667.25)'
        }
      ]
    },
    {
      parcelId: 'pond-close',
      heading: 'Land parcel SO3757 3203',
      parcelReference: 'SO3757 3203',
      totalAreaFormatted: '29.3214 ha',
      areaUsedFormatted: '19.4900 ha',
      availableLeftFormatted: '9.8314 ha',
      landCover: 'Temporary grass',
      yearlyPaymentFormatted: '£3,145.60',
      actions: [
        {
          code: 'CNUM2',
          name: 'Legumes on improved grassland',
          valueDisplay: '10.0000 ha (£1,020.00)'
        },
        {
          code: 'CSAM3',
          name: 'Herbal leys',
          valueDisplay: '9.4900 ha (£2,125.60)'
        }
      ]
    }
  ]

  return {
    reviewParcels: mockParcels,
    reviewSummary: {
      totalYearlyPaymentFormatted: '£5,158.30',
      isEmpty: false
    },
    usedMockData: true
  }
}

router.get('/grasslands-v2/view-application', function (req, res) {
  var review = getGrasslandsV2ReviewApplicationData(req)
  var fromLanding = req.query.from === 'landing'
  var sessionData = getGrasslandsV2SessionData(req)
  var submittedAt = sessionData.grasslandsV2ApplicationSubmittedAt || new Date().toISOString()

  res.render('grasslands-v2/view-application', {
    data: sessionData,
    reviewParcels: review.reviewParcels,
    reviewSummary: review.reviewSummary,
    applicationReference: 'HDJ2123F',
    applicationSubmittedAtFormatted: formatGrasslandsV2SubmittedAt(submittedAt),
    backHref: fromLanding
      ? '/grasslands-v2/singlefrontdoor/landing/landing'
      : '/grasslands-v2/confirmation',
    backButtonText: fromLanding
      ? 'Back to Farm and Land Service'
      : 'Back to confirmation'
  })
})

router.get('/grasslands-v2/contact-us', function (req, res) {
  var backHref = '/grasslands-v2/task-list'
  var referer = req.get('Referrer') || req.get('Referer') || ''

  try {
    var refererUrl = new URL(referer, 'http://localhost:3000')
    if (refererUrl.pathname.indexOf('/grasslands-v2/') === 0 &&
        refererUrl.pathname.indexOf('/grasslands-v2/contact-us') !== 0) {
      backHref = refererUrl.pathname + refererUrl.search
    }
  } catch (error) {
    // Keep default back link
  }

  res.render('grasslands-v2/contact-us', {
    data: getGrasslandsV2SessionData(req),
    backHref: backHref,
    serviceName: 'Apply for a grasslands agreement',
    serviceUrl: '/grasslands-v2/task-list'
  })
})
router.post('/grasslands-v2/confirmation', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  recordGrasslandsV2ApplicationSubmitted(req)
  var notices = getGrasslandsV2ConfirmationNotices(req)
  res.render('grasslands-v2/confirmation', {
    data: getGrasslandsV2SessionData(req),
    showHeferNotice: notices.showHeferNotice,
    showSssiNotice: notices.showSssiNotice
  })
})

router.post('/grasslands-v2/management-control-answer', function (req, res) {
  var managementControlAnswer = req.body['management-answer-v2']
  var returnTo = getSfiEligibilityReturnTo(req, req.body.returnTo)

  if (!managementControlAnswer) {
    var referer = req.get('Referer') || ''
    var managementView = referer.indexOf('/management-control') !== -1
      ? 'grasslands-v2/management-control'
      : 'grasslands-v2/confirm-eligibility-details'

    return renderGrasslandsV2EligibilityPage(req, res, managementView, {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if you will have the required management control of the land in this application',
      eligibilityErrorFieldId: 'management-answer-v2-error'
    })
  }

  saveGrasslandsV2Answer(req, 'management-answer-v2', managementControlAnswer)

  if (managementControlAnswer === 'no') {
    clearEligibilityReturnTo(req)
    setCheckBeforeYouStartLinearFlow(req, false)
    grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.confirmEligible)
    return res.redirect('/grasslands-v2/ineligible')
  }

  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.confirmEligible)

  if (returnTo === 'check-your-answers') {
    clearEligibilityReturnTo(req)
    setCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/grasslands-v2/check-your-answers')
  }

  clearEligibilityReturnTo(req)
  setCheckBeforeYouStartLinearFlow(req, false)
  res.redirect('/grasslands-v2/task-list')
})

router.post('/grasslands-v2/hefer-answer', function (req, res) {
  // HEFER step temporarily removed from grasslands-v2 journey
  return res.redirect('/grasslands-v2/task-list')
})

router.post('/grasslands-v2/sssi-answer', function (req, res) {
  // SSSI step temporarily removed from grasslands-v2 journey
  return res.redirect('/grasslands-v2/task-list')
})

router.post('/grasslands-v2/check-business-details-answer', function (req, res) {
  var businessDetailsAnswer = req.body['business-details-answer']
  var returnTo = getSfiEligibilityReturnTo(req, req.body.returnTo)

  if (!businessDetailsAnswer) {
    return renderGrasslandsV2EligibilityPage(req, res, 'grasslands-v2/check-business-details', {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if these details are correct',
      eligibilityErrorFieldId: 'business-details-answer-error'
    })
  }

  saveGrasslandsV2Answer(req, 'business-details-answer', businessDetailsAnswer)

  if (businessDetailsAnswer === 'no') {
    clearEligibilityReturnTo(req)
    setCheckBeforeYouStartLinearFlow(req, false)
    grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.checkBusinessDetails)
    req.session.data = req.session.data || {}
    req.session.data.grasslandsV2ApplicationInProgress = true
    return res.redirect('/grasslands-v2/singlefrontdoor/landing/landing')
  }

  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.checkBusinessDetails)

  if (returnTo === 'check-your-answers') {
    clearEligibilityReturnTo(req)
    setCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/grasslands-v2/check-your-answers')
  }

  setCheckBeforeYouStartLinearFlow(req, true)
  res.redirect(getNextCheckBeforeYouStartPath(req))
})

router.post('/grasslands-v2/check-land-details-answer', function (req, res) {
  var landDetailsAnswer = req.body['land-details-answer']
  var returnTo = getSfiEligibilityReturnTo(req, req.body.returnTo)

  if (!landDetailsAnswer) {
    return renderGrasslandsV2EligibilityPage(req, res, 'grasslands-v2/check-land-details', {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if your digital maps show the correct land details',
      eligibilityErrorFieldId: 'land-details-answer-error'
    })
  }

  saveGrasslandsV2Answer(req, 'land-details-answer', landDetailsAnswer)

  if (landDetailsAnswer === 'no') {
    clearEligibilityReturnTo(req)
    setCheckBeforeYouStartLinearFlow(req, false)
    grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.checkLandDetails)
    return res.redirect('/grasslands-v2/update-land-details')
  }

  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.checkLandDetails)

  if (returnTo === 'check-your-answers') {
    clearEligibilityReturnTo(req)
    setCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/grasslands-v2/check-your-answers')
  }

  setCheckBeforeYouStartLinearFlow(req, true)
  res.redirect(getNextCheckBeforeYouStartPath(req))
})

router.get('/grasslands-v2/check-your-answers', function (req, res) {
  grasslandsV2LandActions.syncParcelSelectionsData(req)
  var actionsSummary = buildGrasslandsV2ActionsSummaryFromSession(req)
  var basketParcels = grasslandsV2LandActions.buildBasketParcels(req)
  var basketSummary = grasslandsV2LandActions.summariseBasket(basketParcels)
  var consentHintsByParcel = {}

  basketParcels.forEach(function (parcel) {
    if (!parcel || !parcel.parcelId) {
      return
    }

    var hints = {}
    ;(parcel.actions || []).forEach(function (action) {
      var hint = grasslandsV2Consent.getActionConsentHint(parcel.parcelId, action.code)
      if (hint) {
        hints[action.code] = hint
        action.consentHint = hint
      }
    })

    if (Object.keys(hints).length > 0) {
      consentHintsByParcel[parcel.parcelId] = hints
    }
  })

  if (actionsSummary.rows && actionsSummary.rows.length > 0) {
    grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.selectLand)
  }

  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.checkAnswers)

  res.render('grasslands-v2/check-your-answers', {
    data: Object.assign({}, req.session.data),
    actionsSummaryRows: actionsSummary.rows,
    actionsSummaryTotal: actionsSummary.total,
    consentHintsByParcel: consentHintsByParcel,
    basketParcels: basketParcels,
    basketSummary: basketSummary
  })
})

router.post('/grasslands-v2/check-your-answers', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  grasslandsV2Tasks.markCompleted(req, grasslandsV2Tasks.TASK_IDS.selectLand)
  grasslandsV2Tasks.markInProgress(req, grasslandsV2Tasks.TASK_IDS.checkAnswers)
  res.redirect('/grasslands-v2/check-your-answers')
})


// --- sfi-grasslands-v2 (AAC always on) ---

function getSfiGrasslandsV2SessionData (req) {
  return req.session.data || {}
}


function buildSfiActionsSummaryFromSession (req) {
  var data = getSfiGrasslandsV2SessionData(req)
  return buildActionsSummaryFromSession(Object.assign({}, data, {
    parcelSelectionsData: data.sfiParcelSelectionsData
  }))
}


// Keep in sync with app/assets/javascripts/sfi-grasslands-v2-mvp-actions.js
const SFI_GRASSLANDS_V2_MVP_ACTION_CODES = [
  'CLIG3',
  'GRH7',
  'GRH8',
  'GRH10',
  'CSAM3',
  'CHRW2',
  'WBD2',
  'HEF1',
  'CNUM2',
  'CIGL2',
  'CIGL1',
  'WBD1',
  'SCR2',
  'BND1',
  'BND2',
  'GRH12'
]

function getSfiGrasslandsV2CompatibilityLocals (req) {
  var compatibilityYear = getCompatibilityYearFromSession(getSfiGrasslandsV2SessionData(req))

  return {
    compatibilityYear: compatibilityYear,
    compatibilityClientConfig: JSON.stringify(
      buildMatrixClientConfig(SFI_GRASSLANDS_V2_MVP_ACTION_CODES, compatibilityYear)
    )
  }
}

function clearSfiGrasslandsV2ApplicationData (req) {
  var existingData = getSfiGrasslandsV2SessionData(req)
  var preservedBusinessContext = {}

  if (existingData.agileSFD) {
    preservedBusinessContext.agileSFD = existingData.agileSFD
  }

  if (existingData.valleySFD) {
    preservedBusinessContext.valleySFD = existingData.valleySFD
  }

  req.session.data = Object.assign({}, sessionDataDefaults, preservedBusinessContext)
}

router.get('/sfi-grasslands-v2/before-you-start', function (req, res) {
  clearSfiGrasslandsV2ApplicationData(req)

  res.render('sfi-grasslands-v2/before-you-start', {
    data: getSfiGrasslandsV2SessionData(req)
  })
})

router.get('/sfi-grasslands-v2/task-list', function (req, res) {
  setSfiCheckBeforeYouStartLinearFlow(req, false)
  sfiGrasslandsV2Tasks.ensureTasks(req)

  var actionsSummary = buildSfiActionsSummaryFromSession(req)
  sfiGrasslandsV2Tasks.syncFromSessionAnswers(req, {
    hasSelectedLand: (actionsSummary.rows && actionsSummary.rows.length > 0) ||
      sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)
  })

  var taskListPage = sfiGrasslandsV2Tasks.getTaskListPageData(req)

  res.render('sfi-grasslands-v2/task-list', Object.assign({
    data: getSfiGrasslandsV2SessionData(req)
  }, taskListPage))
})

function setSfiEligibilityReturnTo (req, returnTo) {
  if (returnTo === 'check-your-answers') {
    req.session.data = req.session.data || {}
    req.session.data.sfiEligibilityReturnTo = returnTo
  }
}

function getSfiEligibilityReturnTo (req, bodyReturnTo) {
  if (bodyReturnTo) {
    return bodyReturnTo
  }

  return getSfiGrasslandsV2SessionData(req).sfiEligibilityReturnTo || ''
}

function clearSfiEligibilityReturnTo (req) {
  if (req.session.data) {
    delete req.session.data.sfiEligibilityReturnTo
  }
}

function setSfiCheckBeforeYouStartLinearFlow (req, enabled) {
  req.session.data = req.session.data || {}
  if (enabled) {
    req.session.data.sfiCheckBeforeYouStartLinearFlow = true
  } else {
    delete req.session.data.sfiCheckBeforeYouStartLinearFlow
  }
}

function isSfiCheckBeforeYouStartLinearFlow (req) {
  return Boolean(getSfiGrasslandsV2SessionData(req).sfiCheckBeforeYouStartLinearFlow)
}

function getSfiNextCheckBeforeYouStartPath (req) {
  sfiGrasslandsV2Tasks.syncFromSessionAnswers(req, {})
  var states = sfiGrasslandsV2Tasks.getResolvedTaskStates(req)

  if (states.checkLandDetails.key !== sfiGrasslandsV2Tasks.STATUS.COMPLETED) {
    return '/sfi-grasslands-v2/check-land-details'
  }

  if (states.confirmEligible.key !== sfiGrasslandsV2Tasks.STATUS.COMPLETED) {
    return '/sfi-grasslands-v2/management-control'
  }

  return '/sfi-grasslands-v2/task-list'
}

function renderSfiGrasslandsV2EligibilityPage (req, res, view, options) {
  var opts = options || {}

  if (req.query.from === 'check-your-answers') {
    setSfiEligibilityReturnTo(req, 'check-your-answers')
  }

  var returnTo = opts.returnTo || req.query.from || req.body.returnTo || getSfiEligibilityReturnTo(req)

  res.render(view, {
    data: getSfiGrasslandsV2SessionData(req),
    returnTo: returnTo,
    eligibilityError: opts.eligibilityError || false,
    eligibilityErrorMessage: opts.eligibilityErrorMessage || '',
    eligibilityErrorFieldId: opts.eligibilityErrorFieldId || ''
  })
}

function saveSfiGrasslandsV2Answer (req, fieldName, value) {
  req.session.data = req.session.data || {}
  req.session.data[fieldName] = value
}

router.get('/sfi-grasslands-v2/check-business-details', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.checkBusinessDetails)
  if (req.query.from !== 'check-your-answers') {
    setSfiCheckBeforeYouStartLinearFlow(req, true)
  }
  renderSfiGrasslandsV2EligibilityPage(req, res, 'sfi-grasslands-v2/check-business-details')
})

router.get('/sfi-grasslands-v2/update-business-details', function (req, res) {
  res.render('sfi-grasslands-v2/update-business-details', {
    data: getSfiGrasslandsV2SessionData(req)
  })
})

router.get('/sfi-grasslands-v2/check-land-details', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.checkLandDetails)
  if (req.query.from !== 'check-your-answers') {
    setSfiCheckBeforeYouStartLinearFlow(req, true)
  }
  renderSfiGrasslandsV2EligibilityPage(req, res, 'sfi-grasslands-v2/check-land-details')
})

router.get('/sfi-grasslands-v2/confirm-eligibility-details', function (req, res) {
  // Alias kept; task list now uses management control directly
  var query = req.query.from ? ('?from=' + encodeURIComponent(req.query.from)) : ''
  res.redirect('/sfi-grasslands-v2/management-control' + query)
})

router.get('/sfi-grasslands-v2/management-control', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.confirmEligible)
  renderSfiGrasslandsV2EligibilityPage(req, res, 'sfi-grasslands-v2/management-control')
})

router.get('/sfi-grasslands-v2/hefer', function (req, res) {
  // Temporarily removed from the eligibility journey
  res.redirect('/sfi-grasslands-v2/task-list')
})

router.get('/sfi-grasslands-v2/sssi', function (req, res) {
  // Temporarily removed from the eligibility journey
  res.redirect('/sfi-grasslands-v2/task-list')
})

router.get('/sfi-grasslands-v2/eligible', function (req, res) {
  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.confirmEligible)
  res.render('sfi-grasslands-v2/eligible', {
    data: getSfiGrasslandsV2SessionData(req)
  })
})

router.get('/sfi-grasslands-v2/select-land-map-fluid-find', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
  res.render('sfi-grasslands-v2/select-land-map-fluid-find', Object.assign({
    data: getSfiGrasslandsV2SessionData(req)
  }, getSfiGrasslandsV2CompatibilityLocals(req)))
})

router.get('/sfi-grasslands-v2/select-land', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)

  if (req.query.addAnother === '1' || req.query.addAnother === 'true') {
    sfiGrasslandsV2LandActions.commitDraftToApplication(req)
    if (sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)) {
      sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
    }
  }

  res.render('sfi-grasslands-v2/select-land', Object.assign({
    data: getSfiGrasslandsV2SessionData(req),
    draftParcel: sfiGrasslandsV2LandActions.getDraftParcel(req),
    applicationParcels: sfiGrasslandsV2LandActions.getApplicationParcels(req),
    showCancelToLandAndActions: sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)
  }, getSfiGrasslandsV2CompatibilityLocals(req)))
})

router.get('/sfi-grasslands-v2/cancel-land-actions-draft', function (req, res) {
  sfiGrasslandsV2LandActions.clearDraft(req)
  if (sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)) {
    return res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
  }
  res.redirect('/sfi-grasslands-v2/select-land')
})

router.post('/sfi-grasslands-v2/select-land', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)

  if (!req.body.selectedParcelId) {
    return res.redirect('/sfi-grasslands-v2/select-land')
  }

  var previousDraft = sfiGrasslandsV2LandActions.getDraftParcel(req)
  var previousParcelId = previousDraft && previousDraft.parcelId
  sfiGrasslandsV2LandActions.saveDraftParcelFromBody(req, req.body)

  // Only clear draft actions when the parcel changes
  if (previousParcelId !== req.body.selectedParcelId) {
    sfiGrasslandsV2LandActions.setDraftActions(req, [])
    sfiGrasslandsV2LandActions.clearClig3SupplementsComplete(req)
  }

  res.redirect('/sfi-grasslands-v2/select-actions')
})

router.get('/sfi-grasslands-v2/select-actions', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)

  var draftParcel = sfiGrasslandsV2LandActions.getDraftParcel(req)
  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/sfi-grasslands-v2/select-land')
  }

  var sessionData = getSfiGrasslandsV2SessionData(req)
  var focusActionCode = sessionData.focusActionCode || null
  if (sessionData.focusActionCode) {
    delete sessionData.focusActionCode
  }

  res.render('sfi-grasslands-v2/select-actions', Object.assign({
    data: sessionData,
    draftParcel: draftParcel,
    draftActions: sfiGrasslandsV2LandActions.getDraftActions(req),
    applicationParcels: sfiGrasslandsV2LandActions.getApplicationParcels(req),
    focusActionCode: focusActionCode,
    returnToCheckYourAnswers: Boolean(sessionData.returnToCheckYourAnswers),
    showCancelToLandAndActions: sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)
  }, getSfiGrasslandsV2CompatibilityLocals(req)))
})

router.post('/sfi-grasslands-v2/select-actions', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)

  var draftParcel = sfiGrasslandsV2LandActions.getDraftParcel(req)
  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/sfi-grasslands-v2/select-land')
  }

  var draftActions = sfiGrasslandsV2LandActions.getDraftActions(req)
  if (req.body.draftLandActions) {
    draftActions = typeof req.body.draftLandActions === 'string'
      ? (function () {
        try {
          return JSON.parse(req.body.draftLandActions)
        } catch (error) {
          return []
        }
      })()
      : req.body.draftLandActions
  }

  if (!Array.isArray(draftActions) || draftActions.length === 0) {
    return res.render('sfi-grasslands-v2/select-actions', Object.assign({
      data: getSfiGrasslandsV2SessionData(req),
      draftParcel: draftParcel,
      draftActions: [],
      applicationParcels: sfiGrasslandsV2LandActions.getApplicationParcels(req),
      actionsError: true,
      actionsErrorMessage: 'Select at least one action'
    }, getSfiGrasslandsV2CompatibilityLocals(req)))
  }

  var previousDraftActions = sfiGrasslandsV2LandActions.getDraftActions(req)
  var previousSupplement = sfiGrasslandsV2LandActions.getSelectedClig3SupplementCode(previousDraftActions)
  var previousSupplementQuantity = sfiGrasslandsV2LandActions.getSelectedClig3SupplementQuantity(previousDraftActions)
  // Posted actions no longer include nested supplements — drop any stale ones
  // unless CLIG3 is still selected (then the supplements page re-applies).
  var cleanedActions = sfiGrasslandsV2LandActions.stripClig3Supplements(draftActions)

  if (!sfiGrasslandsV2LandActions.draftHasClig3(cleanedActions)) {
    sfiGrasslandsV2LandActions.clearClig3SupplementsComplete(req)
    sfiGrasslandsV2LandActions.setDraftActions(req, cleanedActions)
    return res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
  }

  // Keep any previously chosen supplement so the next page can pre-select it
  if (previousSupplement) {
    var restored = sfiGrasslandsV2LandActions.applyClig3SupplementSelection(
      cleanedActions,
      previousSupplement,
      previousSupplementQuantity
    )
    cleanedActions = restored.actions
  }
  sfiGrasslandsV2LandActions.setDraftActions(req, cleanedActions)

  // Only show supplements again when CLIG3 was added or its quantity changed
  if (sfiGrasslandsV2LandActions.shouldShowClig3Supplements(req, cleanedActions)) {
    return res.redirect('/sfi-grasslands-v2/clig3-supplements')
  }

  res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
})

router.get('/sfi-grasslands-v2/clig3-supplements', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)

  var draftParcel = sfiGrasslandsV2LandActions.getDraftParcel(req)
  var draftActions = sfiGrasslandsV2LandActions.getDraftActions(req)
  var sessionData = getSfiGrasslandsV2SessionData(req)

  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/sfi-grasslands-v2/select-land')
  }

  if (!sfiGrasslandsV2LandActions.draftHasClig3(draftActions)) {
    sfiGrasslandsV2LandActions.setDraftActions(
      req,
      sfiGrasslandsV2LandActions.stripClig3Supplements(draftActions)
    )
    return res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
  }

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  var clig3Ha = sfiGrasslandsV2LandActions.getClig3AppliedQuantity(draftActions)
  var directEdit = Boolean(sessionData.clig3SupplementsDirectEdit)
  var backHref = '/sfi-grasslands-v2/select-actions'
  if (directEdit && sessionData.returnToCheckYourAnswers) {
    backHref = '/sfi-grasslands-v2/check-your-answers'
  } else if (directEdit) {
    backHref = '/sfi-grasslands-v2/confirm-land-and-actions'
  }

  res.render('sfi-grasslands-v2/clig3-supplements', {
    data: sessionData,
    draftParcel: draftParcel,
    draftActions: draftActions,
    supplementOptions: sfiGrasslandsV2LandActions.getClig3SupplementOptions(clig3Ha),
    selectedSupplementCode: sfiGrasslandsV2LandActions.getSelectedClig3SupplementCode(draftActions),
    selectedSupplementQuantity: sfiGrasslandsV2LandActions.getSelectedClig3SupplementQuantity(draftActions),
    clig3AreaFormatted: sfiGrasslandsV2LandActions.formatHectares(clig3Ha),
    backHref: backHref,
    quantityError: null,
    showCancelToLandAndActions: sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)
  })
})

router.post('/sfi-grasslands-v2/clig3-supplements', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)

  var draftParcel = sfiGrasslandsV2LandActions.getDraftParcel(req)
  var draftActions = sfiGrasslandsV2LandActions.getDraftActions(req)
  var sessionData = getSfiGrasslandsV2SessionData(req)

  if (!draftParcel || !draftParcel.parcelId) {
    return res.redirect('/sfi-grasslands-v2/select-land')
  }

  if (!sfiGrasslandsV2LandActions.draftHasClig3(draftActions)) {
    sfiGrasslandsV2LandActions.setDraftActions(
      req,
      sfiGrasslandsV2LandActions.stripClig3Supplements(draftActions)
    )
    delete sessionData.clig3SupplementsDirectEdit
    return res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
  }

  var rawSupplement = req.body ? req.body.clig3Supplement : undefined
  if (rawSupplement === undefined || rawSupplement === null) {
    var clig3HaMissing = sfiGrasslandsV2LandActions.getClig3AppliedQuantity(draftActions)
    var directEditMissing = Boolean(sessionData.clig3SupplementsDirectEdit)
    var backHrefMissing = '/sfi-grasslands-v2/select-actions'
    if (directEditMissing && sessionData.returnToCheckYourAnswers) {
      backHrefMissing = '/sfi-grasslands-v2/check-your-answers'
    } else if (directEditMissing) {
      backHrefMissing = '/sfi-grasslands-v2/confirm-land-and-actions'
    }

    return res.render('sfi-grasslands-v2/clig3-supplements', {
      data: sessionData,
      draftParcel: draftParcel,
      draftActions: draftActions,
      supplementOptions: sfiGrasslandsV2LandActions.getClig3SupplementOptions(clig3HaMissing),
      selectedSupplementCode: '',
      selectedSupplementQuantity: '',
      clig3AreaFormatted: sfiGrasslandsV2LandActions.formatHectares(clig3HaMissing),
      backHref: backHrefMissing,
      quantityError: {
        fieldId: 'clig3-supplement-none',
        text: 'Select a supplement or choose no supplement'
      },
      showCancelToLandAndActions: sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)
    })
  }

  var supplementCode = String(rawSupplement || '').toUpperCase()
  if (supplementCode === 'NONE') {
    supplementCode = ''
  }
  var quantityField = supplementCode
    ? 'quantity-' + supplementCode.toLowerCase()
    : ''
  var quantityRaw = quantityField && req.body ? req.body[quantityField] : ''

  var applied = sfiGrasslandsV2LandActions.applyClig3SupplementSelection(
    draftActions,
    supplementCode,
    quantityRaw
  )

  if (applied.error) {
    var clig3HaError = sfiGrasslandsV2LandActions.getClig3AppliedQuantity(draftActions)
    var directEditError = Boolean(sessionData.clig3SupplementsDirectEdit)
    var backHrefError = '/sfi-grasslands-v2/select-actions'
    if (directEditError && sessionData.returnToCheckYourAnswers) {
      backHrefError = '/sfi-grasslands-v2/check-your-answers'
    } else if (directEditError) {
      backHrefError = '/sfi-grasslands-v2/confirm-land-and-actions'
    }

    return res.render('sfi-grasslands-v2/clig3-supplements', {
      data: sessionData,
      draftParcel: draftParcel,
      draftActions: draftActions,
      supplementOptions: sfiGrasslandsV2LandActions.getClig3SupplementOptions(clig3HaError),
      selectedSupplementCode: supplementCode,
      selectedSupplementQuantity: quantityRaw,
      clig3AreaFormatted: sfiGrasslandsV2LandActions.formatHectares(clig3HaError),
      backHref: backHrefError,
      quantityError: applied.error,
      showCancelToLandAndActions: sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)
    })
  }

  sfiGrasslandsV2LandActions.setDraftActions(req, applied.actions)

  if (req.body && req.body.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  sfiGrasslandsV2LandActions.markClig3SupplementsComplete(req, applied.actions)
  delete sessionData.clig3SupplementsDirectEdit
  res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
})

router.get('/sfi-grasslands-v2/consent-interruption', function (req, res) {
  var sessionData = getSfiGrasslandsV2SessionData(req)
  var previewType = req.query.preview
  var allowedPreviewTypes = ['sssi', 'hefer', 'sssi-hefer']

  if (previewType && allowedPreviewTypes.indexOf(previewType) !== -1) {
    return res.render('sfi-grasslands-v2/consent-interruption', {
      data: sessionData,
      interruptionType: previewType,
      requiresSssi: previewType === 'sssi' || previewType === 'sssi-hefer',
      requiresHefer: previewType === 'hefer' || previewType === 'sssi-hefer'
    })
  }

  var consent = sfiGrasslandsV2Consent.getConsentRequirementsForParcels(
    sfiGrasslandsV2LandActions.buildBasketParcels(req)
  )

  if (!consent.requiresConsent) {
    return res.redirect(sessionData.afterConsentRedirect || '/sfi-grasslands-v2/confirm-land-and-actions')
  }

  res.render('sfi-grasslands-v2/consent-interruption', {
    data: sessionData,
    interruptionType: consent.interruptionType,
    requiresSssi: consent.requiresSssi,
    requiresHefer: consent.requiresHefer
  })
})

router.post('/sfi-grasslands-v2/consent-interruption', function (req, res) {
  var sessionData = getSfiGrasslandsV2SessionData(req)
  var redirectTo = sessionData.afterConsentRedirect || '/sfi-grasslands-v2/task-list'
  delete sessionData.afterConsentRedirect
  res.redirect(redirectTo)
})

router.get('/sfi-grasslands-v2/confirm-land-and-actions', function (req, res) {
  var basketParcels = sfiGrasslandsV2LandActions.buildBasketParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      actions: (parcel.actions || []).map(function (action) {
        return Object.assign({}, action, {
          consentHint: sfiGrasslandsV2Consent.getActionConsentHint(parcel.parcelId, action.code)
        })
      })
    })
  })
  var basketSummary = sfiGrasslandsV2LandActions.summariseBasket(basketParcels)
  var sessionData = getSfiGrasslandsV2SessionData(req)
  var flashMessage = sessionData.confirmLandFlash || null

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  delete sessionData.confirmLandFlash

  if (!basketSummary.isEmpty) {
    sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
  }

  res.render('sfi-grasslands-v2/confirm-land-and-actions', {
    data: sessionData,
    basketParcels: basketParcels,
    basketSummary: basketSummary,
    flashMessage: flashMessage,
    draftHasClig3: sfiGrasslandsV2LandActions.draftHasClig3(
      sfiGrasslandsV2LandActions.getDraftActions(req)
    )
  })
})

router.post('/sfi-grasslands-v2/confirm-land-and-actions', function (req, res) {
  var action = req.body && req.body.confirmAction
  var sessionData = getSfiGrasslandsV2SessionData(req)

  sfiGrasslandsV2LandActions.commitDraftToApplication(req)

  if (sfiGrasslandsV2LandActions.hasSavedLandAndActions(req)) {
    sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
  } else if (
    sfiGrasslandsV2LandActions.getDraftParcel(req) ||
    sfiGrasslandsV2LandActions.buildBasketParcels(req).length
  ) {
    sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
  } else {
    sfiGrasslandsV2Tasks.setTaskStatus(
      req,
      sfiGrasslandsV2Tasks.TASK_IDS.selectLand,
      sfiGrasslandsV2Tasks.STATUS.NOT_STARTED
    )
  }

  if (action === 'addAnother') {
    // Keep returnToCheckYourAnswers so after adding they still return to CYA
    if (req.body.from === 'check-your-answers') {
      sessionData.returnToCheckYourAnswers = true
    }
    return res.redirect('/sfi-grasslands-v2/select-land?addAnother=1')
  }

  var consent = sfiGrasslandsV2Consent.getConsentRequirementsForParcels(
    sfiGrasslandsV2LandActions.buildBasketParcels(req)
  )
  var goingToCya = action === 'returnToCya' ||
    req.body.from === 'check-your-answers' ||
    sessionData.returnToCheckYourAnswers

  if (consent.requiresConsent) {
    if (goingToCya) {
      delete sessionData.returnToCheckYourAnswers
      sessionData.afterConsentRedirect = '/sfi-grasslands-v2/check-your-answers'
    } else {
      sessionData.afterConsentRedirect = '/sfi-grasslands-v2/task-list'
    }
    return res.redirect('/sfi-grasslands-v2/consent-interruption')
  }

  if (goingToCya) {
    delete sessionData.returnToCheckYourAnswers
    return res.redirect('/sfi-grasslands-v2/check-your-answers')
  }

  res.redirect('/sfi-grasslands-v2/task-list')
})

router.get('/sfi-grasslands-v2/confirm-land-and-actions/change/:parcelId', function (req, res) {
  var parcelId = req.params.parcelId
  var sessionData = getSfiGrasslandsV2SessionData(req)
  var loaded = sfiGrasslandsV2LandActions.loadParcelIntoDraftForEdit(req, parcelId)

  if (!loaded) {
    var draftParcel = sfiGrasslandsV2LandActions.getDraftParcel(req)
    if (!draftParcel || draftParcel.parcelId !== parcelId) {
      return res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
    }
  }

  if (req.query.from === 'check-your-answers') {
    sessionData.returnToCheckYourAnswers = true
  }

  if (req.query.actionCode) {
    sessionData.focusActionCode = String(req.query.actionCode).toUpperCase()
  }

  var actionCode = sessionData.focusActionCode || ''
  if (sfiGrasslandsV2LandActions.isClig3SupplementAction(actionCode)) {
    sessionData.clig3SupplementsDirectEdit = true
    return res.redirect('/sfi-grasslands-v2/clig3-supplements' +
      (req.query.from === 'check-your-answers' ? '?from=check-your-answers' : ''))
  }

  res.redirect('/sfi-grasslands-v2/select-actions')
})

router.get('/sfi-grasslands-v2/remove-parcel-actions/:parcelId', function (req, res) {
  var parcel = sfiGrasslandsV2LandActions.findBasketParcel(req, req.params.parcelId)

  if (!parcel) {
    return res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
  }

  res.render('sfi-grasslands-v2/remove-parcel-actions', {
    data: getSfiGrasslandsV2SessionData(req),
    parcel: parcel
  })
})

router.post('/sfi-grasslands-v2/remove-parcel-actions/:parcelId', function (req, res) {
  var parcelId = req.params.parcelId
  var parcel = sfiGrasslandsV2LandActions.findBasketParcel(req, parcelId)
  var parcelLabel = parcel
    ? (sfiGrasslandsV2LandActions.getParcelDisplayReference(parcel) || 'This land parcel')
    : 'This land parcel'

  if (req.body && req.body.confirmRemove === 'yes') {
    sfiGrasslandsV2LandActions.removeParcelFromBasket(req, parcelId)

    if (sfiGrasslandsV2LandActions.hasSavedLandAndActions(req) ||
        (sfiGrasslandsV2LandActions.getDraftActions(req) || []).length > 0) {
      sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
    } else {
      sfiGrasslandsV2Tasks.setTaskStatus(
        req,
        sfiGrasslandsV2Tasks.TASK_IDS.selectLand,
        sfiGrasslandsV2Tasks.STATUS.NOT_STARTED
      )
    }

    req.session.data = req.session.data || {}
    req.session.data.confirmLandFlash = parcelLabel + ' and its actions have been removed.'
  }

  res.redirect('/sfi-grasslands-v2/confirm-land-and-actions')
})

router.get('/sfi-grasslands-v2/submit-application', function (req, res) {
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.submitApplication)
  res.render('sfi-grasslands-v2/submit-application', {
    data: getSfiGrasslandsV2SessionData(req)
  })
})

router.post('/sfi-grasslands-v2/submit-application', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.checkAnswers)
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.submitApplication)
  res.render('sfi-grasslands-v2/submit-application', {
    data: getSfiGrasslandsV2SessionData(req)
  })
})

function getSfiGrasslandsV2ConfirmationNotices (req) {
  var consent = sfiGrasslandsV2Consent.getConsentRequirementsForParcels(
    sfiGrasslandsV2LandActions.buildBasketParcels(req)
  )

  return {
    showHeferNotice: consent.requiresHefer,
    showSssiNotice: consent.requiresSssi
  }
}

function formatSfiGrasslandsV2SubmittedAt (date) {
  var submittedAt = date instanceof Date ? date : new Date(date)
  if (isNaN(submittedAt.getTime())) {
    submittedAt = new Date()
  }

  var datePart = submittedAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  var timePart = submittedAt
    .toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .toLowerCase()
    .replace(' ', '')

  return datePart + ' at ' + timePart
}

function recordSfiGrasslandsV2ApplicationSubmitted (req) {
  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.submitApplication)
  req.session.data = req.session.data || {}
  req.session.data.sfiGrasslandsV2ApplicationSubmitted = true
  req.session.data.sfiGrasslandsV2ApplicationInProgress = false
  if (!req.session.data.sfiGrasslandsV2ApplicationSubmittedAt) {
    req.session.data.sfiGrasslandsV2ApplicationSubmittedAt = new Date().toISOString()
  }
}

router.get('/sfi-grasslands-v2/confirmation', function (req, res) {
  recordSfiGrasslandsV2ApplicationSubmitted(req)
  var notices = getSfiGrasslandsV2ConfirmationNotices(req)
  res.render('sfi-grasslands-v2/confirmation', {
    data: getSfiGrasslandsV2SessionData(req),
    showHeferNotice: notices.showHeferNotice,
    showSssiNotice: notices.showSssiNotice
  })
})

function getSfiGrasslandsV2ReviewApplicationData (req) {
  var basketParcels = sfiGrasslandsV2LandActions.buildBasketParcels(req).map(function (parcel) {
    return Object.assign({}, parcel, {
      landCover: parcel.landCover || parcel.landCoverLabel || 'Permanent grassland',
      actions: (parcel.actions || []).map(function (action) {
        return Object.assign({}, action)
      })
    })
  })
  var basketSummary = sfiGrasslandsV2LandActions.summariseBasket(basketParcels)

  if (!basketSummary.isEmpty) {
    return {
      reviewParcels: basketParcels,
      reviewSummary: basketSummary,
      usedMockData: false
    }
  }

  // Prototype fallback when nothing has been saved in this session
  var mockParcels = [
    {
      parcelId: 'far-meadow',
      heading: 'Land parcel SO3757 3193',
      parcelReference: 'SO3757 3193',
      totalAreaFormatted: '12.4500 ha',
      areaUsedFormatted: '8.2000 ha',
      availableLeftFormatted: '4.2500 ha',
      landCover: 'Permanent grassland',
      yearlyPaymentFormatted: '£2,012.70',
      actions: [
        {
          code: 'CLIG3',
          name: 'Manage grassland with very low nutrient inputs',
          valueDisplay: '8.2000 ha (£1,238.20)'
        },
        {
          code: 'GRH7',
          name: 'Haymaking supplement',
          valueDisplay: '4.2500 ha (£667.25)'
        }
      ]
    },
    {
      parcelId: 'pond-close',
      heading: 'Land parcel SO3757 3203',
      parcelReference: 'SO3757 3203',
      totalAreaFormatted: '29.3214 ha',
      areaUsedFormatted: '19.4900 ha',
      availableLeftFormatted: '9.8314 ha',
      landCover: 'Temporary grass',
      yearlyPaymentFormatted: '£3,145.60',
      actions: [
        {
          code: 'CNUM2',
          name: 'Legumes on improved grassland',
          valueDisplay: '10.0000 ha (£1,020.00)'
        },
        {
          code: 'CSAM3',
          name: 'Herbal leys',
          valueDisplay: '9.4900 ha (£2,125.60)'
        }
      ]
    }
  ]

  return {
    reviewParcels: mockParcels,
    reviewSummary: {
      totalYearlyPaymentFormatted: '£5,158.30',
      isEmpty: false
    },
    usedMockData: true
  }
}

router.get('/sfi-grasslands-v2/view-application', function (req, res) {
  var review = getSfiGrasslandsV2ReviewApplicationData(req)
  var fromLanding = req.query.from === 'landing'
  var sessionData = getSfiGrasslandsV2SessionData(req)
  var submittedAt = sessionData.sfiGrasslandsV2ApplicationSubmittedAt || new Date().toISOString()

  res.render('sfi-grasslands-v2/view-application', {
    data: sessionData,
    reviewParcels: review.reviewParcels,
    reviewSummary: review.reviewSummary,
    applicationReference: 'HDJ2123F',
    applicationSubmittedAtFormatted: formatSfiGrasslandsV2SubmittedAt(submittedAt),
    backHref: fromLanding
      ? '/sfi-grasslands-v2/singlefrontdoor/landing/landing'
      : '/sfi-grasslands-v2/confirmation',
    backButtonText: fromLanding
      ? 'Back to Farm and Land Service'
      : 'Back to confirmation'
  })
})

router.get('/sfi-grasslands-v2/contact-us', function (req, res) {
  var backHref = '/sfi-grasslands-v2/task-list'
  var referer = req.get('Referrer') || req.get('Referer') || ''

  try {
    var refererUrl = new URL(referer, 'http://localhost:3000')
    if (refererUrl.pathname.indexOf('/sfi-grasslands-v2/') === 0 &&
        refererUrl.pathname.indexOf('/sfi-grasslands-v2/contact-us') !== 0) {
      backHref = refererUrl.pathname + refererUrl.search
    }
  } catch (error) {
    // Keep default back link
  }

  res.render('sfi-grasslands-v2/contact-us', {
    data: getSfiGrasslandsV2SessionData(req),
    backHref: backHref,
    serviceName: 'Apply for a grasslands agreement',
    serviceUrl: '/sfi-grasslands-v2/task-list'
  })
})
router.post('/sfi-grasslands-v2/confirmation', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  recordSfiGrasslandsV2ApplicationSubmitted(req)
  var notices = getSfiGrasslandsV2ConfirmationNotices(req)
  res.render('sfi-grasslands-v2/confirmation', {
    data: getSfiGrasslandsV2SessionData(req),
    showHeferNotice: notices.showHeferNotice,
    showSssiNotice: notices.showSssiNotice
  })
})

router.post('/sfi-grasslands-v2/management-control-answer', function (req, res) {
  var managementControlAnswer = req.body['management-answer-v2']
  var returnTo = getSfiEligibilityReturnTo(req, req.body.returnTo)

  if (!managementControlAnswer) {
    var referer = req.get('Referer') || ''
    var managementView = referer.indexOf('/management-control') !== -1
      ? 'sfi-grasslands-v2/management-control'
      : 'sfi-grasslands-v2/confirm-eligibility-details'

    return renderSfiGrasslandsV2EligibilityPage(req, res, managementView, {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if you will have the required management control of the land in this application',
      eligibilityErrorFieldId: 'management-answer-v2-error'
    })
  }

  saveSfiGrasslandsV2Answer(req, 'management-answer-v2', managementControlAnswer)

  if (managementControlAnswer === 'no') {
    clearSfiEligibilityReturnTo(req)
    setSfiCheckBeforeYouStartLinearFlow(req, false)
    sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.confirmEligible)
    return res.redirect('/sfi-grasslands-v2/ineligible')
  }

  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.confirmEligible)

  if (returnTo === 'check-your-answers') {
    clearSfiEligibilityReturnTo(req)
    setSfiCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/sfi-grasslands-v2/check-your-answers')
  }

  clearSfiEligibilityReturnTo(req)
  setSfiCheckBeforeYouStartLinearFlow(req, false)
  res.redirect('/sfi-grasslands-v2/task-list')
})

router.post('/sfi-grasslands-v2/hefer-answer', function (req, res) {
  // HEFER step temporarily removed from grasslands-v2 journey
  return res.redirect('/sfi-grasslands-v2/task-list')
})

router.post('/sfi-grasslands-v2/sssi-answer', function (req, res) {
  // SSSI step temporarily removed from grasslands-v2 journey
  return res.redirect('/sfi-grasslands-v2/task-list')
})

router.post('/sfi-grasslands-v2/check-business-details-answer', function (req, res) {
  var businessDetailsAnswer = req.body['business-details-answer']
  var returnTo = getSfiEligibilityReturnTo(req, req.body.returnTo)

  if (!businessDetailsAnswer) {
    return renderSfiGrasslandsV2EligibilityPage(req, res, 'sfi-grasslands-v2/check-business-details', {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if these details are correct',
      eligibilityErrorFieldId: 'business-details-answer-error'
    })
  }

  saveSfiGrasslandsV2Answer(req, 'business-details-answer', businessDetailsAnswer)

  if (businessDetailsAnswer === 'no') {
    clearSfiEligibilityReturnTo(req)
    setSfiCheckBeforeYouStartLinearFlow(req, false)
    sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.checkBusinessDetails)
    req.session.data = req.session.data || {}
    req.session.data.sfiGrasslandsV2ApplicationInProgress = true
    return res.redirect('/sfi-grasslands-v2/singlefrontdoor/landing/landing')
  }

  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.checkBusinessDetails)

  if (returnTo === 'check-your-answers') {
    clearSfiEligibilityReturnTo(req)
    setSfiCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/sfi-grasslands-v2/check-your-answers')
  }

  setSfiCheckBeforeYouStartLinearFlow(req, true)
  res.redirect(getSfiNextCheckBeforeYouStartPath(req))
})

router.post('/sfi-grasslands-v2/check-land-details-answer', function (req, res) {
  var landDetailsAnswer = req.body['land-details-answer']
  var returnTo = getSfiEligibilityReturnTo(req, req.body.returnTo)

  if (!landDetailsAnswer) {
    return renderSfiGrasslandsV2EligibilityPage(req, res, 'sfi-grasslands-v2/check-land-details', {
      returnTo: returnTo,
      eligibilityError: true,
      eligibilityErrorMessage: 'Select if your digital maps show the correct land details',
      eligibilityErrorFieldId: 'land-details-answer-error'
    })
  }

  saveSfiGrasslandsV2Answer(req, 'land-details-answer', landDetailsAnswer)

  if (landDetailsAnswer === 'no') {
    clearSfiEligibilityReturnTo(req)
    setSfiCheckBeforeYouStartLinearFlow(req, false)
    sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.checkLandDetails)
    return res.redirect('/sfi-grasslands-v2/update-land-details')
  }

  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.checkLandDetails)

  if (returnTo === 'check-your-answers') {
    clearSfiEligibilityReturnTo(req)
    setSfiCheckBeforeYouStartLinearFlow(req, false)
    return res.redirect('/sfi-grasslands-v2/check-your-answers')
  }

  setSfiCheckBeforeYouStartLinearFlow(req, true)
  res.redirect(getSfiNextCheckBeforeYouStartPath(req))
})

router.get('/sfi-grasslands-v2/check-your-answers', function (req, res) {
  sfiGrasslandsV2LandActions.syncParcelSelectionsData(req)
  var actionsSummary = buildSfiActionsSummaryFromSession(req)
  var basketParcels = sfiGrasslandsV2LandActions.buildBasketParcels(req)
  var basketSummary = sfiGrasslandsV2LandActions.summariseBasket(basketParcels)
  var consentHintsByParcel = {}

  basketParcels.forEach(function (parcel) {
    if (!parcel || !parcel.parcelId) {
      return
    }

    var hints = {}
    ;(parcel.actions || []).forEach(function (action) {
      var hint = sfiGrasslandsV2Consent.getActionConsentHint(parcel.parcelId, action.code)
      if (hint) {
        hints[action.code] = hint
        action.consentHint = hint
      }
    })

    if (Object.keys(hints).length > 0) {
      consentHintsByParcel[parcel.parcelId] = hints
    }
  })

  if (actionsSummary.rows && actionsSummary.rows.length > 0) {
    sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
  }

  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.checkAnswers)

  res.render('sfi-grasslands-v2/check-your-answers', {
    data: Object.assign({}, req.session.data),
    actionsSummaryRows: actionsSummary.rows,
    actionsSummaryTotal: actionsSummary.total,
    consentHintsByParcel: consentHintsByParcel,
    basketParcels: basketParcels,
    basketSummary: basketSummary
  })
})

router.post('/sfi-grasslands-v2/check-your-answers', function (req, res) {
  req.session.data = Object.assign(req.session.data || {}, req.body || {})
  sfiGrasslandsV2Tasks.markCompleted(req, sfiGrasslandsV2Tasks.TASK_IDS.selectLand)
  sfiGrasslandsV2Tasks.markInProgress(req, sfiGrasslandsV2Tasks.TASK_IDS.checkAnswers)
  res.redirect('/sfi-grasslands-v2/check-your-answers')
})


router.use(function (req, res, next) {
  var compatibilityYear = getCompatibilityYearFromSession((req.session && req.session.data) || {})
  var matrixClientConfig = buildMatrixClientConfig(ALL_KNOWN_ACTION_CODES, compatibilityYear)

  res.locals.compatibilityYear = compatibilityYear
  res.locals.compatibilityClientConfig = JSON.stringify(matrixClientConfig)
  next()
})

function hasFieldConflict(conflicts, actionCode) {
  if (!actionCode) {
    return false
  }

  return conflicts.some(function (conflict) {
    return conflict.actionCodeA === actionCode || conflict.actionCodeB === actionCode
  })
}

function getActionDisplayName(actionCode) {
  var code = normaliseActionCode(actionCode)
  if (!code) {
    return ''
  }

  var actionName = actionNameByCode[code]
  return actionName ? actionName + ': ' + code : code
}

function getActionErrorDisplayName(actionCode) {
  var code = normaliseActionCode(actionCode)
  if (!code) {
    return ''
  }

  var actionName = actionNameByCode[code]
  if (!actionName) {
    return code
  }

  if (code === 'UPL8' || code === 'UPL10') {
    actionName = actionName.replace(/\s*\([^)]*\)/, '')
  }

  return actionName + ' (' + code + ')'
}

function getConflictForAction(conflicts, actionCode) {
  if (!actionCode) {
    return null
  }

  return conflicts.find(function (conflict) {
    return conflict.actionCodeA === actionCode || conflict.actionCodeB === actionCode
  }) || null
}

function buildFieldErrorMessage(conflict, focalActionCode) {
  if (!conflict || !focalActionCode) {
    return 'You cannot select incompatible actions on this parcel'
  }

  var otherActionCode = conflict.actionCodeA === focalActionCode
    ? conflict.actionCodeB
    : conflict.actionCodeA

  return getActionErrorDisplayName(focalActionCode) + ' is not compatible with ' + getActionErrorDisplayName(otherActionCode)
}

function getConflictFields(selectedActions, conflicts) {
  var livestockConflict = getConflictForAction(conflicts, selectedActions.livestockGrazing)
  var shepherdingConflict = getConflictForAction(conflicts, selectedActions.shepherding)
  var wildlifeConflict = getConflictForAction(conflicts, selectedActions.wildlife)

  return {
    livestockFieldsetError: hasFieldConflict(conflicts, selectedActions.livestockGrazing),
    shepherdingFieldsetError: hasFieldConflict(conflicts, selectedActions.shepherding),
    wildlifeFieldsetError: hasFieldConflict(conflicts, selectedActions.wildlife),
    livestockErrorMessage: buildFieldErrorMessage(livestockConflict, selectedActions.livestockGrazing),
    shepherdingErrorMessage: buildFieldErrorMessage(shepherdingConflict, selectedActions.shepherding),
    wildlifeErrorMessage: buildFieldErrorMessage(wildlifeConflict, selectedActions.wildlife)
  }
}

router.post('/day1-more-actions2/select-base-action', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActions = getSelectedActionsForCompatibility(req.body)
  var selectedCodes = Object.values(selectedActions).filter(Boolean)
  var conflicts = findIncompatibilities(selectedCodes, compatibilityYear)

  if (conflicts.length > 0) {
    var fieldErrors = getConflictFields(selectedActions, conflicts)

    req.session.data.wildlife = ''
    req.session.data.livestockGrazing = ''
    req.session.data.shepherding = ''
    req.body.wildlife = ''
    req.body.livestockGrazing = ''
    req.body.shepherding = ''

    return res.status(400).render('day1-more-actions2/select-base-action', {
      mutualExclusionError: true,
      livestockFieldsetError: fieldErrors.livestockFieldsetError,
      shepherdingFieldsetError: fieldErrors.shepherdingFieldsetError,
      wildlifeFieldsetError: fieldErrors.wildlifeFieldsetError,
      livestockErrorMessage: fieldErrors.livestockErrorMessage,
      shepherdingErrorMessage: fieldErrors.shepherdingErrorMessage,
      wildlifeErrorMessage: fieldErrors.wildlifeErrorMessage,
      data: Object.assign({}, req.session.data, {
        wildlife: '',
        livestockGrazing: '',
        shepherding: ''
      })
    })
  }

  var csam3QuantityErrorMessage = getCsam3QuantityError(selectedActions, req.body['quantity-csam3'])
  if (csam3QuantityErrorMessage) {
    return res.status(400).render('day1-more-actions2/select-base-action', {
      csam3QuantityError: true,
      csam3QuantityErrorMessage: csam3QuantityErrorMessage,
      data: Object.assign({}, req.session.data, req.body)
    })
  }

  res.redirect('/day1-more-actions2/add-more-actions')
})

router.post('/day1-more-actions2/select-base-action-consents', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActions = getSelectedActionsForCompatibility(req.body)
  var selectedCodes = Object.values(selectedActions).filter(Boolean)
  var conflicts = findIncompatibilities(selectedCodes, compatibilityYear)

  if (conflicts.length > 0) {
    var fieldErrors = getConflictFields(selectedActions, conflicts)

    req.session.data.wildlife = ''
    req.session.data.livestockGrazing = ''
    req.session.data.shepherding = ''
    req.body.wildlife = ''
    req.body.livestockGrazing = ''
    req.body.shepherding = ''

    return res.status(400).render('day1-more-actions2/select-base-action-consents', {
      mutualExclusionError: true,
      livestockFieldsetError: fieldErrors.livestockFieldsetError,
      shepherdingFieldsetError: fieldErrors.shepherdingFieldsetError,
      wildlifeFieldsetError: fieldErrors.wildlifeFieldsetError,
      livestockErrorMessage: fieldErrors.livestockErrorMessage,
      shepherdingErrorMessage: fieldErrors.shepherdingErrorMessage,
      wildlifeErrorMessage: fieldErrors.wildlifeErrorMessage,
      data: Object.assign({}, req.session.data, {
        wildlife: '',
        livestockGrazing: '',
        shepherding: ''
      })
    })
  }

  res.redirect('/day1-more-actions2/add-more-actions')
})

router.post('/day1-more-actions2/select-base-action-none-option', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActions = getSelectedActionsForCompatibility(req.body)
  var selectedCodes = Object.values(selectedActions).filter(Boolean)
  var conflicts = findIncompatibilities(selectedCodes, compatibilityYear)

  if (conflicts.length > 0) {
    var fieldErrors = getConflictFields(selectedActions, conflicts)

    return res.status(400).render('day1-more-actions2/select-base-action-none-option', {
      mutualExclusionError: true,
      livestockFieldsetError: fieldErrors.livestockFieldsetError,
      shepherdingFieldsetError: fieldErrors.shepherdingFieldsetError,
      wildlifeFieldsetError: fieldErrors.wildlifeFieldsetError,
      livestockErrorMessage: fieldErrors.livestockErrorMessage,
      shepherdingErrorMessage: fieldErrors.shepherdingErrorMessage,
      wildlifeErrorMessage: fieldErrors.wildlifeErrorMessage
    })
  }

  res.redirect('/day1-more-actions2/add-more-actions')
})

router.get('/day1-more-actions2/select-base-action-matrix', function (req, res) {
  res.render('day1-more-actions2/select-base-action-matrix', getMatrixPageViewData(req))
})

router.post('/day1-more-actions2/select-base-action-matrix', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActions = getSelectedActionsForCompatibility(req.body)
  var selectedCodes = Object.values(selectedActions).filter(Boolean)
  var conflicts = findIncompatibilities(selectedCodes, compatibilityYear)

  if (conflicts.length > 0) {
    var fieldErrors = getConflictFields(selectedActions, conflicts)

    return res.status(400).render(
      'day1-more-actions2/select-base-action-matrix',
      getMatrixPageViewData(req, {
        mutualExclusionError: true,
        livestockFieldsetError: fieldErrors.livestockFieldsetError,
        shepherdingFieldsetError: fieldErrors.shepherdingFieldsetError,
        wildlifeFieldsetError: fieldErrors.wildlifeFieldsetError,
        livestockErrorMessage: fieldErrors.livestockErrorMessage,
        shepherdingErrorMessage: fieldErrors.shepherdingErrorMessage,
        wildlifeErrorMessage: fieldErrors.wildlifeErrorMessage,
        data: Object.assign({}, req.session.data, req.body)
      })
    )
  }

  req.session.data = Object.assign(req.session.data, req.body)
  res.redirect('/day1-more-actions2/add-more-actions')
})

router.get('/day1-more-actions2/select-base-all-actions', function (req, res) {
  res.render('day1-more-actions2/select-base-all-actions', getAllActionsPageViewData(req))
})

router.get('/day1-more-actions2/select-base-all-actions2', function (req, res) {
  res.render('day1-more-actions2/select-base-all-actions2', getAllActionsPageViewData(req))
})

router.get('/day1-more-actions2/select-base-all-actions2a', function (req, res) {
  res.render('day1-more-actions2/select-base-all-actions2a', getAllActionsPageViewData(req))
})

router.get('/day1-more-actions2/select-base-all-actions-checkboxes', function (req, res) {
  res.render('day1-more-actions2/select-base-all-actions-checkboxes', getAllActionsPageViewData(req))
})

router.get('/day1-more-actions2/select-base-all-actions-checkboxes-2026', function (req, res) {
  res.render('day1-more-actions2/select-base-all-actions-checkboxes-2026', getAllActionsPageViewData(req))
})

router.post('/day1-more-actions2/select-base-all-actions2', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActionsByGroup = getSelectedAllActionsByGroup(req.body)
  var selectedActionCodes = Object.values(selectedActionsByGroup)
  var existingCodes = getExistingAllActionsCompatibilityCodes(req.session.data)

  if (!selectedActionCodes.length) {
    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions2',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: 'Select at least one action'
      })
    )
  }

  var selectedCodeLookup = new Set(selectedActionCodes)
  var conflicts = findIncompatibilities(existingCodes.concat(selectedActionCodes), compatibilityYear).filter(function (conflict) {
    return selectedCodeLookup.has(conflict.actionCodeA) || selectedCodeLookup.has(conflict.actionCodeB)
  })

  if (conflicts.length > 0) {
    var compatibilityHintsByGroup = buildAllActionsCompatibilityHints(selectedActionsByGroup, conflicts)
    var focalActionCode = selectedCodeLookup.has(conflicts[0].actionCodeA)
      ? conflicts[0].actionCodeA
      : conflicts[0].actionCodeB

    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions2',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: buildFieldErrorMessage(conflicts[0], focalActionCode),
        incompatibilityErrorAnchor: getActionAnchorId(focalActionCode),
        compatibilityHintsByGroup: compatibilityHintsByGroup,
        data: Object.assign({}, req.session.data, req.body)
      })
    )
  }

  req.session.data.selectedActions = selectedActionCodes
  req.session.data = Object.assign(req.session.data, req.body)
  res.redirect('/day1-more-actions2/select-land')
})

router.post('/day1-more-actions2/select-base-all-actions2a', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActionsByGroup = getSelectedAllActionsByGroup(req.body)
  var selectedActionCodes = Object.values(selectedActionsByGroup)
  var existingCodes = getExistingAllActionsCompatibilityCodes(req.session.data)

  if (!selectedActionCodes.length) {
    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions2a',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: 'Select at least one action'
      })
    )
  }

  var selectedCodeLookup = new Set(selectedActionCodes)
  var conflicts = findIncompatibilities(existingCodes.concat(selectedActionCodes), compatibilityYear).filter(function (conflict) {
    return selectedCodeLookup.has(conflict.actionCodeA) || selectedCodeLookup.has(conflict.actionCodeB)
  })

  if (conflicts.length > 0) {
    var compatibilityHintsByGroup = buildAllActionsCompatibilityHints(selectedActionsByGroup, conflicts)
    var focalActionCode = selectedCodeLookup.has(conflicts[0].actionCodeA)
      ? conflicts[0].actionCodeA
      : conflicts[0].actionCodeB

    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions2a',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: buildFieldErrorMessage(conflicts[0], focalActionCode),
        incompatibilityErrorAnchor: getActionAnchorId(focalActionCode),
        compatibilityHintsByGroup: compatibilityHintsByGroup,
        data: Object.assign({}, req.session.data, req.body)
      })
    )
  }

  req.session.data.selectedActions = selectedActionCodes
  req.session.data = Object.assign(req.session.data, req.body)
  res.redirect('/day1-more-actions2/select-land')
})

router.post('/day1-more-actions2/select-base-all-actions-checkboxes', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActionsByGroup = getSelectedAllActionsByGroup(req.body)
  var selectedActionCodes = Object.values(selectedActionsByGroup)
  var existingCodes = getExistingAllActionsCompatibilityCodes(req.session.data)

  if (!selectedActionCodes.length) {
    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions-checkboxes',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: 'Select at least one action'
      })
    )
  }

  var selectedCodeLookup = new Set(selectedActionCodes)
  var conflicts = findIncompatibilities(existingCodes.concat(selectedActionCodes), compatibilityYear).filter(function (conflict) {
    return selectedCodeLookup.has(conflict.actionCodeA) || selectedCodeLookup.has(conflict.actionCodeB)
  })

  if (conflicts.length > 0) {
    var compatibilityHintsByGroup = buildAllActionsCompatibilityHints(selectedActionsByGroup, conflicts)
    var focalActionCode = selectedCodeLookup.has(conflicts[0].actionCodeA)
      ? conflicts[0].actionCodeA
      : conflicts[0].actionCodeB

    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions-checkboxes',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: buildFieldErrorMessage(conflicts[0], focalActionCode),
        incompatibilityErrorAnchor: getActionAnchorId(focalActionCode),
        compatibilityHintsByGroup: compatibilityHintsByGroup,
        data: Object.assign({}, req.session.data, req.body)
      })
    )
  }

  req.session.data.selectedActions = selectedActionCodes
  req.session.data = Object.assign(req.session.data, req.body)
  res.redirect('/day1-more-actions2/select-land')
})

router.post('/day1-more-actions2/select-base-all-actions-checkboxes-2026', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActionsByGroup = getSelectedAllActionsByGroup(req.body)
  var selectedActionCodes = Object.values(selectedActionsByGroup)
  var existingCodes = getExistingAllActionsCompatibilityCodes(req.session.data)

  if (!selectedActionCodes.length) {
    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions-checkboxes-2026',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: 'Select at least one action'
      })
    )
  }

  var selectedCodeLookup = new Set(selectedActionCodes)
  var conflicts = findIncompatibilities(existingCodes.concat(selectedActionCodes), compatibilityYear).filter(function (conflict) {
    return selectedCodeLookup.has(conflict.actionCodeA) || selectedCodeLookup.has(conflict.actionCodeB)
  })

  if (conflicts.length > 0) {
    var compatibilityHintsByGroup = buildAllActionsCompatibilityHints(selectedActionsByGroup, conflicts)
    var focalActionCode = selectedCodeLookup.has(conflicts[0].actionCodeA)
      ? conflicts[0].actionCodeA
      : conflicts[0].actionCodeB

    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions-checkboxes-2026',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: buildFieldErrorMessage(conflicts[0], focalActionCode),
        incompatibilityErrorAnchor: getActionAnchorId(focalActionCode),
        compatibilityHintsByGroup: compatibilityHintsByGroup,
        data: Object.assign({}, req.session.data, req.body)
      })
    )
  }

  req.session.data.selectedActions = selectedActionCodes
  req.session.data = Object.assign(req.session.data, req.body)
  res.redirect('/day1-more-actions2/select-land')
})

router.post('/day1-more-actions2/select-base-all-actions', function (req, res) {
  var compatibilityYear = getCompatibilityYearFromSession(req.session.data)
  var selectedActionsByGroup = getSelectedAllActionsByGroup(req.body)
  var selectedActionCodes = Object.values(selectedActionsByGroup)
  var existingCodes = getExistingAllActionsCompatibilityCodes(req.session.data)

  if (!selectedActionCodes.length) {
    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: 'Select at least one action'
      })
    )
  }

  var selectedCodeLookup = new Set(selectedActionCodes)
  var conflicts = findIncompatibilities(existingCodes.concat(selectedActionCodes), compatibilityYear).filter(function (conflict) {
    return selectedCodeLookup.has(conflict.actionCodeA) || selectedCodeLookup.has(conflict.actionCodeB)
  })

  if (conflicts.length > 0) {
    var compatibilityHintsByGroup = buildAllActionsCompatibilityHints(selectedActionsByGroup, conflicts)
    var focalActionCode = selectedCodeLookup.has(conflicts[0].actionCodeA)
      ? conflicts[0].actionCodeA
      : conflicts[0].actionCodeB

    return res.status(400).render(
      'day1-more-actions2/select-base-all-actions',
      getAllActionsPageViewData(req, {
        mutualExclusionError: true,
        incompatibilityErrorMessage: buildFieldErrorMessage(conflicts[0], focalActionCode),
        incompatibilityErrorAnchor: getActionAnchorId(focalActionCode),
        compatibilityHintsByGroup: compatibilityHintsByGroup,
        data: Object.assign({}, req.session.data, req.body)
      })
    )
  }

  req.session.data.selectedActions = selectedActionCodes
  req.session.data = Object.assign(req.session.data, req.body)
  res.redirect('/day1-more-actions2/select-land')
})

// End Post-day 1 more actions mutual exclusivity logic //



router.post('/add-more-actions', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/v3-apply/select-land')

  } else {
    // Send user to ineligible page
    res.redirect('/v3-apply/submit-application')
  }

})

router.post('/add-more-actions2', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions2']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/v3-apply/select-land2')

  } else {
    // Send user to ineligible page
    res.redirect('/v3-apply/submit-application')
  }

})

router.post('/add-more-actions3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions3']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/day1-locked/select-land2')

  } else {
    // Send user to ineligible page
    res.redirect('/day1-locked/submit-application')
  }

})

router.post('/add-more-actions4', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions4']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/v4-apply/select-base-action-radios2')

  } else {
    // Send user to ineligible page
    res.redirect('/v4-apply/submit-application')
  }

})

router.post('/add-more-actions5', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions5']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/v4-apply/select-base-action-radios3')

  } else {
    // Send user to ineligible page
    res.redirect('/v4-apply/submit-application')
  }

})

router.post('/add-more-actions6', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions6']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/day1-more-actions/select-base-action2')

  } else {
    // Send user to ineligible page
    res.redirect('/day1-more-actions/submit-application')
  }

})

router.post('/add-more-actions-sssi', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions-sssi']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/day1-sssi/select-land2')

  } else {
    // Send user to SSSI interuption card page
    res.redirect('/day1-sssi/sssi-new')
  }

})

router.post('/add-more-actions-sssi-hefer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions-sssi-hefer']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/day1-sssi-hefer/select-land2')

  } else {
    // Send user to SSSI interuption card page
    res.redirect('/day1-sssi-hefer/sssi-hefer')
  }

})




router.post('/add-more-actions-hefer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var addMoreActionsAnswer = req.session.data['add-more-actions-hefer']

  // Check whether the variable matches a condition
  if (addMoreActionsAnswer == "yes"){
    // Send user to next page
    res.redirect('/day1-hefer/select-land2')
  } else {
    // Send user to HEFER interuption card page
    res.redirect('/day1-hefer/hefer-new')
  }

})


router.post('/confirm-delete-all-actions', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-all-actions']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v4-apply/select-base-action-radios')

  } else {
    // Send user to tasklist page
    res.redirect('/v4-apply/add-more-actions')
  }

})

router.post('/confirm-delete-all-actions2', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-all-actions2']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v4-apply/select-base-action-radios')

  } else {
    // Send user to tasklist page
    res.redirect('/v4-apply/add-more-actions2')
  }

})

router.post('/confirm-delete-all-actions3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-all-actions3']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v4-apply/select-base-action-radios')

  } else {
    // Send user to tasklist page
    res.redirect('/v4-apply/add-more-actions3')
  }

})

router.post('/confirm-delete-action', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-action']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v2-apply/add-more-actions2')

  } else {
    // Send user to tasklist page
    res.redirect('/v2-apply/add-more-actions')
  }

})

router.post('/confirm-delete-action2', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-action2']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v4-apply/select-base-action-radios')

  } else {
    // Send user to tasklist page
    res.redirect('/v4-apply/add-more-actions')
  }

})

router.post('/confirm-delete-action3', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-action3']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v4-apply/add-more-actions')

  } else {
    // Send user to tasklist page
    res.redirect('/v4-apply/add-more-actions2')
  }

})

router.post('/confirm-delete-action4', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var confirmDeleteAnswer = req.session.data['confirm-delete-action4']

  // Check whether the variable matches a condition
  if (confirmDeleteAnswer == "yes"){
    // Send user to list page with deleted action
    res.redirect('/v4-apply/add-more-actions2')

  } else {
    // Send user to tasklist page
    res.redirect('/v4-apply/add-more-actions3')
  }

})

router.post('/land-details-answer-ht', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var landDetailsAnswer = req.session.data['land-details-answer']

  // Check whether the variable matches a condition
  if (landDetailsAnswer == "yes"){
    // Send user to next page
    res.redirect('/ht-mvp/tasklist-2')

  } else {
    // Send user to ineligible page
    res.redirect('/ht-mvp/update-land-details')
  }

})

router.post('/management-answer-ht', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['management-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/ht-mvp/hefer')

  } else {
    // Send user to ineligible page
    res.redirect('/ht-mvp/ineligible')
  }

})

router.post('/hefer-answer-ht', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['hefer-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/ht-mvp/sssi')

  } else {
    // Send user to ineligible page
    res.redirect('/ht-mvp/ineligible')
  }

})

router.post('/sssi-answer-ht', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['sssi-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/ht-mvp/ite')

  } else {
    // Send user to ineligible page
    res.redirect('/ht-mvp/ineligible')
  }

})

router.post('/ite-answer-ht', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['ite-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/ht-mvp/public-body')

  } else {
    // Send user to ineligible page
    res.redirect('/ht-mvp/ineligible')
  }

})

router.post('/public-body-answer-ht', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['public-body-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/ht-mvp/eligible')

  } else {
    // Send user to ineligible page
    res.redirect('/ht-mvp/ineligible')
  }

})



