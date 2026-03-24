//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const https = require('https')
const actionCodeNames = require('./data/sfi24-codes-names.json')
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
  return {
    livestockGrazing: normaliseActionCode(body.livestockGrazing),
    shepherding: normaliseActionCode(body.shepherding),
    wildlife: normaliseActionCode(body.wildlife),
    cmor1: normaliseActionCode(body.cmor1)
  }
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



