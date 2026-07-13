(function (window) {
  // Same previous-agreement actions as the prototype accordion content.
  // Used so land selection and action compatibility can reference them without
  // repeating full agreement details across pages.
  var EXISTING_AGREEMENT_ACTIONS = {
    'woods-view': [
      { code: 'CSAM2', name: 'Multi-species winter cover crop' }
    ],
    'long-meadow': [
      { code: 'CNUM2', name: 'Legumes on improved grassland' }
    ],
    'willow-grove': [
      { code: 'AHW7', name: 'Enhanced overwinter stubble' }
    ],
    'valley-pasture': [
      { code: 'AHW7', name: 'Enhanced overwinter stubble' }
    ],
    'gate-pasture': [
      { code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land' }
    ],
    'chalk-field': [
      { code: 'CSAM2', name: 'Multi-species winter cover crop' }
    ],
    'spring-pasture': [
      { code: 'SOH1', name: 'Assess soil, produce soil management plan, test soil organic matter' }
    ],
    'brook-field': [
      { code: 'CSAM3', name: 'Herbal leys' }
    ],
    'valley-bottom': [
      { code: 'CIGL1', name: 'Take grassland field corners or blocks out of management' },
      { code: 'BFS1', name: 'Winter bird food on arable land' }
    ],
    'upper-slope': [
      { code: 'CSAM3', name: 'Herbal leys' }
    ],
    'lane-meadow': [
      { code: 'AHW3', name: 'Beetle banks' }
    ],
    'stone-bridge': [
      { code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land' }
    ],
    'far-meadow': [
      { code: 'CAHL1', name: 'Low input grassland' },
      { code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land' }
    ]
  }

  function getExistingAgreementActions (parcelId) {
    var key = String(parcelId || '').trim()
    var actions = EXISTING_AGREEMENT_ACTIONS[key] || []
    return actions.map(function (action) {
      return {
        code: action.code,
        name: action.name
      }
    })
  }

  function countExistingAgreementActions (parcelId) {
    return getExistingAgreementActions(parcelId).length
  }

  function formatExistingActionLabel (action) {
    if (!action) {
      return ''
    }
    if (action.name && action.code) {
      return action.name + ' (' + action.code + ')'
    }
    return action.name || action.code || ''
  }

  window.GrasslandsV2ExistingAgreements = {
    get: getExistingAgreementActions,
    count: countExistingAgreementActions,
    formatLabel: formatExistingActionLabel
  }
})(window)
