//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Add your routes here

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



