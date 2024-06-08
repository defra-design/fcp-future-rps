//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Add your routes here
router.post('/land-details-answer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var landDetailsAnswer = req.session.data['land-details-answer']

  // Check whether the variable matches a condition
  if (landDetailsAnswer == "yes"){
    // Send user to next page
    res.redirect('/experiment/tasklist-2')

  } else {
    // Send user to ineligible page
    res.redirect('/experiment/update-land-details')
  }

})

router.post('/management-answer', function (req, res) {

  // Make a variable and give it the value from 'how-many-balls'
  var managementControlAnswer = req.session.data['management-answer']

  // Check whether the variable matches a condition
  if (managementControlAnswer == "yes"){
    // Send user to next page
    res.redirect('/experiment/hefer')

  } else {
    // Send user to ineligible page
    res.redirect('/experiment/ineligible')
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


