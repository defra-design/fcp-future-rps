//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const https = require('https')

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



