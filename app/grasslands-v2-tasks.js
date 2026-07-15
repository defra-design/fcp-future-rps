/**
 * Modular task definitions and session helpers for the grasslands-v2 task list.
 * Mirrors SFI task list behaviour: Cannot start yet / Incomplete / Completed,
 * with Not started → In progress → Completed for early "check before you start" tasks.
 */

var TASK_IDS = {
  checkBusinessDetails: 'checkBusinessDetails',
  checkLandDetails: 'checkLandDetails',
  confirmEligible: 'confirmEligible',
  selectLand: 'selectLand',
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
  checkBusinessDetails: STATUS.NOT_STARTED,
  checkLandDetails: STATUS.NOT_STARTED,
  confirmEligible: STATUS.NOT_STARTED,
  selectLand: STATUS.NOT_STARTED,
  checkAnswers: STATUS.NOT_STARTED,
  submitApplication: STATUS.NOT_STARTED
}

var SELECT_LAND_HREF = '/grasslands-v2/select-land'

var IN_PROGRESS_TASKS = [
  TASK_IDS.checkBusinessDetails,
  TASK_IDS.checkLandDetails
]

function getSessionData (req) {
  req.session.data = req.session.data || {}
  return req.session.data
}

function ensureTasks (req) {
  var data = getSessionData(req)

  if (!data.grasslandsV2Tasks || typeof data.grasslandsV2Tasks !== 'object') {
    data.grasslandsV2Tasks = Object.assign({}, DEFAULT_TASKS)
  } else {
    Object.keys(DEFAULT_TASKS).forEach(function (taskId) {
      if (!data.grasslandsV2Tasks[taskId]) {
        data.grasslandsV2Tasks[taskId] = DEFAULT_TASKS[taskId]
      }
      // Migrate older in-progress values for non-early check tasks to Incomplete
      if (
        IN_PROGRESS_TASKS.indexOf(taskId) === -1 &&
        data.grasslandsV2Tasks[taskId] === STATUS.IN_PROGRESS
      ) {
        data.grasslandsV2Tasks[taskId] = STATUS.INCOMPLETE
      }
    })
  }

  return data.grasslandsV2Tasks
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
  } else if (data['management-answer-v2']) {
    if (tasks.confirmEligible !== STATUS.COMPLETED) {
      tasks.confirmEligible = STATUS.INCOMPLETE
    }
  }

  if (hasSelectedLand && tasks.selectLand !== STATUS.COMPLETED) {
    tasks.selectLand = STATUS.COMPLETED
  }

  return tasks
}

function resolveCheckTask (stored, completed, href) {
  if (completed) {
    return {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: href
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
  var checkAnswersStored = getStoredStatus(req, TASK_IDS.checkAnswers)
  var submitStored = getStoredStatus(req, TASK_IDS.submitApplication)

  var businessCompleted = businessStored === STATUS.COMPLETED
  var landDetailsCompleted = landDetailsStored === STATUS.COMPLETED
  var eligibleCompleted = eligibleStored === STATUS.COMPLETED
  var section1Complete = businessCompleted && landDetailsCompleted && eligibleCompleted
  var selectLandCompleted = selectLandStored === STATUS.COMPLETED
  var checkAnswersCompleted = checkAnswersStored === STATUS.COMPLETED
  var submitCompleted = submitStored === STATUS.COMPLETED

  // 1a. Business details — always available
  var checkBusinessDetails = resolveCheckTask(
    businessStored,
    businessCompleted,
    '/grasslands-v2/check-business-details'
  )

  // 1b. Land details — locked until business details completed
  var checkLandDetails
  if (!businessCompleted) {
    checkLandDetails = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else {
    checkLandDetails = resolveCheckTask(
      landDetailsStored,
      landDetailsCompleted,
      '/grasslands-v2/check-land-details'
    )
  }

  // 1c. Eligibility — locked until land details completed
  var confirmEligible
  if (!landDetailsCompleted) {
    confirmEligible = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (eligibleCompleted) {
    confirmEligible = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: '/grasslands-v2/management-control'
    }
  } else {
    confirmEligible = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: '/grasslands-v2/management-control'
    }
  }

  // 2. Select land — locked until section 1 complete
  var selectLand
  if (!section1Complete) {
    selectLand = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (selectLandCompleted) {
    selectLand = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: '/grasslands-v2/confirm-land-and-actions'
    }
  } else {
    selectLand = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: SELECT_LAND_HREF
    }
  }

  // 3a. Check answers — locked until land selected
  var checkAnswers
  if (!selectLandCompleted) {
    checkAnswers = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (checkAnswersCompleted) {
    checkAnswers = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: '/grasslands-v2/check-your-answers'
    }
  } else {
    checkAnswers = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: '/grasslands-v2/check-your-answers'
    }
  }

  // 3b. Submit — locked until check answers completed
  var submitApplication
  if (!checkAnswersCompleted) {
    submitApplication = {
      key: STATUS.CANNOT_START,
      status: statusViewCannotStart(),
      href: null
    }
  } else if (submitCompleted) {
    submitApplication = {
      key: STATUS.COMPLETED,
      status: statusViewCompleted(),
      href: '/grasslands-v2/submit-application'
    }
  } else {
    submitApplication = {
      key: STATUS.INCOMPLETE,
      status: statusViewIncomplete(),
      href: '/grasslands-v2/submit-application'
    }
  }

  var section2Complete = selectLandCompleted
  var section3Complete = checkAnswersCompleted && submitCompleted

  var completedSections = 0
  if (section1Complete) completedSections += 1
  if (section2Complete) completedSections += 1
  if (section3Complete) completedSections += 1

  return {
    checkBusinessDetails: checkBusinessDetails,
    checkLandDetails: checkLandDetails,
    confirmEligible: confirmEligible,
    selectLand: selectLand,
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
    section2Items: [
      buildTaskItem({
        title: 'Select the land and the actions you want to apply for',
        href: states.selectLand.href,
        status: states.selectLand.status
      })
    ],
    section3Items: [
      buildTaskItem({
        title: 'Check your answers',
        href: states.checkAnswers.href,
        status: states.checkAnswers.status
      }),
      buildTaskItem({
        title: 'Submit your application',
        href: states.submitApplication.href,
        status: states.submitApplication.status
      })
    ]
  }
}

// Kept for older route calls that still expect view status maps
function getTaskStatusesForView (req) {
  var states = getResolvedTaskStates(req)
  return {
    checkBusinessDetails: states.checkBusinessDetails.status,
    checkLandDetails: states.checkLandDetails.status,
    confirmEligible: states.confirmEligible.status,
    selectLand: states.selectLand.status,
    checkAnswers: states.checkAnswers.status,
    submitApplication: states.submitApplication.status
  }
}

module.exports = {
  TASK_IDS: TASK_IDS,
  STATUS: STATUS,
  DEFAULT_TASKS: DEFAULT_TASKS,
  SELECT_LAND_HREF: SELECT_LAND_HREF,
  ensureTasks: ensureTasks,
  getStoredStatus: getStoredStatus,
  setTaskStatus: setTaskStatus,
  markInProgress: markInProgress,
  markIncomplete: markIncomplete,
  markCompleted: markCompleted,
  syncFromSessionAnswers: syncFromSessionAnswers,
  getResolvedTaskStates: getResolvedTaskStates,
  getTaskListPageData: getTaskListPageData,
  getTaskStatusesForView: getTaskStatusesForView
}
