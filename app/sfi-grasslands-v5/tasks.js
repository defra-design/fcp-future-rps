/**
 * Modular task definitions and session helpers for the grasslands-v2 task list.
 * Mirrors SFI task list behaviour: Cannot start yet / Incomplete / Completed,
 * with Not started → In progress → Completed for early "check before you start" tasks.
 */

var TASK_IDS = {
  beforeYouStart: 'beforeYouStart',
  checkBusinessDetails: 'checkBusinessDetails',
  checkLandDetails: 'checkLandDetails',
  confirmEligible: 'confirmEligible',
  selectActions: 'selectActions',
  selectCapitalItems: 'selectCapitalItems',
  selectLand: 'selectLand',
  // "Check what you've added to your land parcels" (task list of 4 November 2026)
  reviewLand: 'reviewLand',
  checkAnswers: 'checkAnswers',
  submitApplication: 'submitApplication'
}

var STATUS = {
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  INCOMPLETE: 'incomplete',
  COMPLETED: 'completed',
  CANNOT_START: 'cannot-start-yet'
}

var DEFAULT_TASKS = {
  beforeYouStart: STATUS.NOT_STARTED,
  checkBusinessDetails: STATUS.NOT_STARTED,
  checkLandDetails: STATUS.NOT_STARTED,
  confirmEligible: STATUS.NOT_STARTED,
  selectActions: STATUS.NOT_STARTED,
  selectCapitalItems: STATUS.NOT_STARTED,
  selectLand: STATUS.NOT_STARTED,
  reviewLand: STATUS.NOT_STARTED,
  checkAnswers: STATUS.NOT_STARTED,
  submitApplication: STATUS.NOT_STARTED
}

var SELECT_ACTIONS_HREF = '/sfi-grasslands-v5/select-revenue-actions'
var SELECT_LAND_HREF = '/sfi-grasslands-v5/select-parcels'
var SELECT_CAPITAL_ITEMS_HREF = '/sfi-grasslands-v5/select-capital-items'
var REVIEW_LAND_HREF = '/sfi-grasslands-v5/confirm-land-and-actions'
var REVIEW_SUBMIT_HREF = '/sfi-grasslands-v5/check-your-answers'

var IN_PROGRESS_TASKS = [
  TASK_IDS.beforeYouStart,
  TASK_IDS.checkBusinessDetails,
  TASK_IDS.checkLandDetails,
  TASK_IDS.confirmEligible
]

function getSessionData (req) {
  req.session.data = req.session.data || {}
  return req.session.data
}

function ensureTasks (req) {
  var data = getSessionData(req)

  if (!data.sfiGrasslandsV5Tasks || typeof data.sfiGrasslandsV5Tasks !== 'object') {
    data.sfiGrasslandsV5Tasks = Object.assign({}, DEFAULT_TASKS)
  } else {
    Object.keys(DEFAULT_TASKS).forEach(function (taskId) {
      if (!data.sfiGrasslandsV5Tasks[taskId]) {
        data.sfiGrasslandsV5Tasks[taskId] = DEFAULT_TASKS[taskId]
      }
      // Migrate older in-progress values for non-early check tasks to Incomplete
      if (
        IN_PROGRESS_TASKS.indexOf(taskId) === -1 &&
        data.sfiGrasslandsV5Tasks[taskId] === STATUS.IN_PROGRESS
      ) {
        data.sfiGrasslandsV5Tasks[taskId] = STATUS.INCOMPLETE
      }
    })
    // Opening management control used to store Incomplete; treat that as In progress
    if (data.sfiGrasslandsV5Tasks.confirmEligible === STATUS.INCOMPLETE) {
      data.sfiGrasslandsV5Tasks.confirmEligible = STATUS.IN_PROGRESS
    }
  }

  return data.sfiGrasslandsV5Tasks
}

function getStoredStatus (req, taskId) {
  var tasks = ensureTasks(req)
  return tasks[taskId] || STATUS.NOT_STARTED
}

function setTaskStatus (req, taskId, status) {
  var tasks = ensureTasks(req)
  tasks[taskId] = status
  return tasks
}

function isCompleted (req, taskId) {
  return getStoredStatus(req, taskId) === STATUS.COMPLETED
}

function markInProgress (req, taskId) {
  if (isCompleted(req, taskId)) {
    return STATUS.COMPLETED
  }
  if (IN_PROGRESS_TASKS.indexOf(taskId) !== -1) {
    return setTaskStatus(req, taskId, STATUS.IN_PROGRESS)[taskId]
  }
  return setTaskStatus(req, taskId, STATUS.INCOMPLETE)[taskId]
}

function markIncomplete (req, taskId) {
  if (isCompleted(req, taskId)) {
    return STATUS.COMPLETED
  }
  return setTaskStatus(req, taskId, STATUS.INCOMPLETE)[taskId]
}

function markCompleted (req, taskId) {
  return setTaskStatus(req, taskId, STATUS.COMPLETED)[taskId]
}

function statusViewCannotStart () {
  return {
    text: 'Cannot start yet',
    classes: 'govuk-task-list__status--cannot-start-yet'
  }
}

function statusViewIncomplete () {
  return {
    tag: {
      text: 'Incomplete',
      classes: 'govuk-tag--blue'
    }
  }
}

function statusViewCompleted () {
  return { text: 'Completed' }
}

function statusViewNotStarted () {
  return {
    tag: {
      text: 'Not started',
      classes: 'govuk-tag--grey'
    }
  }
}

function statusViewInProgress () {
  return {
    tag: {
      text: 'In progress',
      classes: 'govuk-tag--light-blue'
    }
  }
}

function buildTaskItem (options) {
  var item = {
    title: { text: options.title },
    status: options.status
  }

  if (options.href) {
    item.href = options.href
  }

  return item
}

/**
 * Keep statuses aligned with answers already in session.
 */
function syncFromSessionAnswers (req, options) {
  var data = getSessionData(req)
  var tasks = ensureTasks(req)
  var hasSelectedLand = options && options.hasSelectedLand

  if (data['land-eligible-answer'] !== 'yes') {
    // Page removed from v4 — keep the task completed so later tasks unlock
    data['land-eligible-answer'] = 'yes'
  }
  tasks.beforeYouStart = STATUS.COMPLETED

  if (data['business-details-answer'] === 'yes') {
    tasks.checkBusinessDetails = STATUS.COMPLETED
  } else if (data['business-details-answer'] === 'no' && tasks.checkBusinessDetails !== STATUS.COMPLETED) {
    tasks.checkBusinessDetails = STATUS.IN_PROGRESS
  }

  if (data['land-details-answer'] === 'yes') {
    tasks.checkLandDetails = STATUS.COMPLETED
  } else if (data['land-details-answer'] === 'no' && tasks.checkLandDetails !== STATUS.COMPLETED) {
    tasks.checkLandDetails = STATUS.IN_PROGRESS
  }

  if (data['management-answer-v2'] === 'yes') {
    tasks.confirmEligible = STATUS.COMPLETED
  } else if (data['management-answer-v2'] === 'no' && tasks.confirmEligible !== STATUS.COMPLETED) {
    tasks.confirmEligible = STATUS.IN_PROGRESS
  }

  var interestedActions = data.sfiV5InterestedActions
  if ((Array.isArray(interestedActions) && interestedActions.length) || hasSelectedLand) {
    tasks.selectActions = STATUS.COMPLETED
  }

  // Capital items are optional: answering the page (even with none) completes the task
  if (Object.prototype.hasOwnProperty.call(data, 'sfiV5InterestedCapitalItems')) {
    tasks.selectCapitalItems = STATUS.COMPLETED
  }

  if (hasSelectedLand && tasks.selectLand !== STATUS.COMPLETED) {
    tasks.selectLand = STATUS.COMPLETED
  }

  // Sessions from before the review task existed: already past the review, so it is done
  if (tasks.checkAnswers === STATUS.COMPLETED || tasks.submitApplication === STATUS.COMPLETED ||
    data.sfiGrasslandsV5ApplicationSubmitted) {
    tasks.reviewLand = STATUS.COMPLETED
  }

  return tasks
}

function resolveCheckTask (stored, completed, href, previousCompleted) {
  if (completed) {
    return {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: href
    }
  }
  // Must finish earlier Check before you start tasks first
  if (previousCompleted === false) {
    return {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  }
  if (stored === STATUS.IN_PROGRESS) {
    return {
      key: STATUS.IN_PROGRESS,
      status: statusViewInProgress(),
      href: href
    }
  }
  return {
    key: STATUS.NOT_STARTED,
    status: statusViewNotStarted(),
    href: href
  }
}

function getResolvedTaskStates (req) {
  var businessStored = getStoredStatus(req, TASK_IDS.checkBusinessDetails)
  var landDetailsStored = getStoredStatus(req, TASK_IDS.checkLandDetails)
  var eligibleStored = getStoredStatus(req, TASK_IDS.confirmEligible)
  var selectLandStored = getStoredStatus(req, TASK_IDS.selectLand)
  var reviewLandStored = getStoredStatus(req, TASK_IDS.reviewLand)
  var checkAnswersStored = getStoredStatus(req, TASK_IDS.checkAnswers)
  var submitStored = getStoredStatus(req, TASK_IDS.submitApplication)

  // beforeYouStart page removed from v4 — treat as complete so Check your details is first
  var beforeYouStartCompleted = true
  var businessCompleted = businessStored === STATUS.COMPLETED
  var landDetailsCompleted = landDetailsStored === STATUS.COMPLETED
  var eligibleCompleted = eligibleStored === STATUS.COMPLETED
  var section1Complete = businessCompleted && landDetailsCompleted && eligibleCompleted
  var selectActionsCompleted = getStoredStatus(req, TASK_IDS.selectActions) === STATUS.COMPLETED
  var selectLandCompleted = selectLandStored === STATUS.COMPLETED
  var reviewLandCompleted = selectLandCompleted && reviewLandStored === STATUS.COMPLETED
  var checkAnswersCompleted = checkAnswersStored === STATUS.COMPLETED
  var submitCompleted = submitStored === STATUS.COMPLETED

  // Kept for status maps / redirects; not shown on the task list
  var beforeYouStart = resolveCheckTask(
    STATUS.COMPLETED,
    beforeYouStartCompleted,
    '/sfi-grasslands-v5/check-business-details',
    true
  )

  var checkBusinessDetails = resolveCheckTask(
    businessStored,
    businessCompleted,
    '/sfi-grasslands-v5/check-business-details',
    true
  )

  var checkLandDetails = resolveCheckTask(
    landDetailsStored,
    landDetailsCompleted,
    '/sfi-grasslands-v5/check-land-details',
    businessCompleted
  )

  var confirmEligible = resolveCheckTask(
    eligibleStored,
    eligibleCompleted,
    '/sfi-grasslands-v5/management-control',
    landDetailsCompleted
  )

  // 2a. Select actions — locked until section 1 complete
  var selectActions
  if (!section1Complete) {
    selectActions = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (selectActionsCompleted) {
    selectActions = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: SELECT_ACTIONS_HREF
    }
  } else {
    selectActions = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: SELECT_ACTIONS_HREF
    }
  }

  // 2b. Select capital items (optional) — locked until actions have been selected
  var selectCapitalItemsCompleted = getStoredStatus(req, TASK_IDS.selectCapitalItems) === STATUS.COMPLETED
  var selectCapitalItems
  if (!section1Complete || !selectActionsCompleted) {
    selectCapitalItems = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (selectCapitalItemsCompleted) {
    selectCapitalItems = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: SELECT_CAPITAL_ITEMS_HREF
    }
  } else {
    selectCapitalItems = {
      key: STATUS.NOT_STARTED,
      status: statusViewNotStarted(),
      href: SELECT_CAPITAL_ITEMS_HREF
    }
  }

  // 2c. Select land — locked until actions have been selected (capital items are optional)
  var selectLand
  if (!section1Complete || !selectActionsCompleted) {
    selectLand = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (selectLandCompleted) {
    selectLand = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: SELECT_LAND_HREF
    }
  } else {
    selectLand = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: SELECT_LAND_HREF
    }
  }

  // 2d. Check what you've added to your land parcels — locked until land has been added
  var reviewLand
  if (!selectLandCompleted) {
    reviewLand = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (reviewLandCompleted) {
    reviewLand = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: REVIEW_LAND_HREF
    }
  } else {
    reviewLand = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: REVIEW_LAND_HREF
    }
  }

  // 3. Review and submit your application (one page since 4 November 2026: check your
  // answers, the declaration and submit) — locked until the land parcels have been checked
  var checkAnswers
  if (!reviewLandCompleted) {
    checkAnswers = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (submitCompleted) {
    checkAnswers = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: REVIEW_SUBMIT_HREF
    }
  } else {
    checkAnswers = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: REVIEW_SUBMIT_HREF
    }
  }
  // Kept for older callers: the submit step is now the same page
  var submitApplication = checkAnswers

  var section2Complete = selectActionsCompleted && selectLandCompleted && reviewLandCompleted
  var section3Complete = submitCompleted

  var completedSections = 0
  if (section1Complete) completedSections += 1
  if (section2Complete) completedSections += 1
  if (section3Complete) completedSections += 1

  return {
    beforeYouStart: beforeYouStart,
    checkBusinessDetails: checkBusinessDetails,
    checkLandDetails: checkLandDetails,
    confirmEligible: confirmEligible,
    selectActions: selectActions,
    selectCapitalItems: selectCapitalItems,
    selectLand: selectLand,
    reviewLand: reviewLand,
    checkAnswers: checkAnswers,
    submitApplication: submitApplication,
    section1Complete: section1Complete,
    section2Complete: section2Complete,
    section3Complete: section3Complete,
    completedSections: completedSections,
    totalSections: 3,
    applicationComplete: completedSections === 3
  }
}

function getTaskListPageData (req) {
  var states = getResolvedTaskStates(req)

  return {
    completedSections: states.completedSections,
    totalSections: states.totalSections,
    applicationComplete: states.applicationComplete,
    section1Items: [
      buildTaskItem({
        title: 'Check your details',
        href: states.checkBusinessDetails.href,
        status: states.checkBusinessDetails.status
      }),
      buildTaskItem({
        title: 'Confirm your land details are up to date',
        href: states.checkLandDetails.href,
        status: states.checkLandDetails.status
      }),
      buildTaskItem({
        title: 'Confirm management control of the land',
        href: states.confirmEligible.href,
        status: states.confirmEligible.status
      })
    ],
    // Task names from the design of 4 November 2026
    section2Items: [
      buildTaskItem({
        title: 'Select your actions',
        href: states.selectActions.href,
        status: states.selectActions.status
      }),
      buildTaskItem({
        title: 'Select your capital items',
        href: states.selectCapitalItems.href,
        status: states.selectCapitalItems.status
      }),
      buildTaskItem({
        title: 'Add actions and capital items to your land parcels',
        href: states.selectLand.href,
        status: states.selectLand.status
      }),
      buildTaskItem({
        title: 'Check what you’ve added to your land parcels',
        href: states.reviewLand.href,
        status: states.reviewLand.status
      })
    ],
    section3Items: [
      buildTaskItem({
        title: 'Review and submit your application',
        href: states.checkAnswers.href,
        status: states.checkAnswers.status
      })
    ]
  }
}

// Kept for older route calls that still expect view status maps
function getTaskStatusesForView (req) {
  var states = getResolvedTaskStates(req)
  return {
    beforeYouStart: states.beforeYouStart.status,
    checkBusinessDetails: states.checkBusinessDetails.status,
    checkLandDetails: states.checkLandDetails.status,
    confirmEligible: states.confirmEligible.status,
    selectActions: states.selectActions.status,
    selectCapitalItems: states.selectCapitalItems.status,
    selectLand: states.selectLand.status,
    reviewLand: states.reviewLand.status,
    checkAnswers: states.checkAnswers.status,
    submitApplication: states.submitApplication.status
  }
}

function isApplicationStarted (req) {
  var tasks = ensureTasks(req)
  return Object.keys(DEFAULT_TASKS).some(function (taskId) {
    var status = tasks[taskId]
    return status && status !== STATUS.NOT_STARTED && status !== STATUS.CANNOT_START
  })
}

module.exports = {
  TASK_IDS: TASK_IDS,
  STATUS: STATUS,
  DEFAULT_TASKS: DEFAULT_TASKS,
  SELECT_ACTIONS_HREF: SELECT_ACTIONS_HREF,
  SELECT_LAND_HREF: SELECT_LAND_HREF,
  SELECT_CAPITAL_ITEMS_HREF: SELECT_CAPITAL_ITEMS_HREF,
  ensureTasks: ensureTasks,
  getStoredStatus: getStoredStatus,
  setTaskStatus: setTaskStatus,
  markInProgress: markInProgress,
  markIncomplete: markIncomplete,
  markCompleted: markCompleted,
  syncFromSessionAnswers: syncFromSessionAnswers,
  getResolvedTaskStates: getResolvedTaskStates,
  getTaskListPageData: getTaskListPageData,
  getTaskStatusesForView: getTaskStatusesForView,
  isApplicationStarted: isApplicationStarted
}
