(function (window) {
  // Same previous-agreement actions as the prototype accordion content.
  // Optional `ha` is used by AAC to itemise deductions in the area breakdown.
  var EXISTING_AGREEMENT_ACTIONS = {
    'woods-view': [
      { code: 'CSAM2', name: 'Multi-species winter cover crop' }
    ],
    'long-meadow': [
      { code: 'CNUM2', name: 'Legumes on improved grassland', ha: 1 }
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
    'gate-field': [
      { code: 'CSAM3', name: 'Herbal leys', ha: 1 }
    ],
    'chalk-field': [
      { code: 'CSAM2', name: 'Multi-species winter cover crop' }
    ],
    'spring-pasture': [
      { code: 'SOH1', name: 'Assess soil, produce soil management plan, test soil organic matter' }
    ],
    'brook-field': [
      { code: 'CSAM3', name: 'Herbal leys', ha: 1.5 }
    ],
    'valley-bottom': [
      { code: 'CIGL1', name: 'Take grassland field corners or blocks out of management', ha: 1 },
      { code: 'BFS1', name: 'Winter bird food on arable land', ha: 1 }
    ],
    'upper-slope': [
      { code: 'CSAM3', name: 'Herbal leys', ha: 1.5 }
    ],
    'lane-meadow': [
      { code: 'AHW3', name: 'Beetle banks' }
    ],
    'stone-bridge': [
      { code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land' }
    ],
    'far-meadow': [
      { code: 'CSAM3', name: 'Herbal leys', ha: 1.2 },
      { code: 'CIGL1', name: 'Grassland field corners', ha: 0.8 }
    ]
  }

  function getExistingAgreementActions (parcelId) {
    var key = String(parcelId || '').trim()
    var actions = EXISTING_AGREEMENT_ACTIONS[key] || []
    return actions.map(function (action) {
      var ha = Number(action.ha)
      return {
        code: action.code,
        name: action.name,
        ha: Number.isFinite(ha) && ha > 0 ? ha : null
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

  function formatDeductionLabel (action) {
    if (!action) {
      return ''
    }
    if (action.code && action.name) {
      return action.code + ' – ' + action.name
    }
    return formatExistingActionLabel(action)
  }

  function getPreviousAgreementDeductions (parcelId) {
    return getExistingAgreementActions(parcelId).filter(function (action) {
      return action.ha != null && action.ha > 0
    })
  }

  function getPreviousAgreementTotalHa (parcelId) {
    return getPreviousAgreementDeductions(parcelId).reduce(function (sum, action) {
      return Math.round((sum + Number(action.ha)) * 10000) / 10000
    }, 0)
  }

  window.GrasslandsV2ExistingAgreements = {
    get: getExistingAgreementActions,
    count: countExistingAgreementActions,
    formatLabel: formatExistingActionLabel,
    formatDeductionLabel: formatDeductionLabel,
    getDeductions: getPreviousAgreementDeductions,
    getTotalHa: getPreviousAgreementTotalHa
  }
})(window)
