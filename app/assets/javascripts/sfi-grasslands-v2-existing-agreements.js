(function (window) {
  // Previous / existing agreements on each parcel (prototype data).
  // Shown on select-actions in a GOV.UK summary list (same pattern as selected land parcel).
  var EXISTING_AGREEMENTS = {
    'woods-view': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '1 August 2027',
        availableArea: '7.5000 hectares',
        actions: [{ code: 'CSAM2', name: 'Multi-species winter cover crop' }]
      }
    ],
    'long-meadow': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '15 September 2028',
        availableArea: '4.4521 hectares',
        actions: [{ code: 'CNUM2', name: 'Legumes on improved grassland', ha: 1 }]
      }
    ],
    'willow-grove': [
      {
        scheme: 'Countryside Stewardship Higher Tier',
        endDate: '30 June 2027',
        availableArea: '11.7654 hectares',
        actions: [{ code: 'AHW7', name: 'Enhanced overwinter stubble' }]
      }
    ],
    'valley-pasture': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '1 October 2026',
        availableArea: '13.2341 hectares',
        actions: [{ code: 'AHW7', name: 'Enhanced overwinter stubble' }]
      }
    ],
    'gate-pasture': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '15 December 2027',
        availableArea: '12.1098 hectares',
        actions: [{ code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land' }]
      }
    ],
    'gate-field': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '30 September 2027',
        availableArea: '10.0000 hectares',
        actions: [{ code: 'CSAM3', name: 'Herbal leys', ha: 1 }]
      }
    ],
    'chalk-field': [
      {
        scheme: 'Countryside Stewardship Higher Tier',
        endDate: '28 February 2028',
        availableArea: '11.4521 hectares',
        actions: [{ code: 'CSAM2', name: 'Multi-species winter cover crop' }]
      }
    ],
    'spring-pasture': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '1 November 2026',
        availableArea: '44.3215 hectares',
        actions: [{ code: 'SOH1', name: 'Assess soil, produce soil management plan, test soil organic matter' }]
      }
    ],
    'brook-field': [
      {
        scheme: 'Countryside Stewardship Higher Tier',
        endDate: '28 February 2027',
        availableArea: '32.7841 hectares',
        actions: [{ code: 'CSAM3', name: 'Herbal leys', ha: 1.5 }]
      }
    ],
    'valley-bottom': [
      {
        scheme: 'Countryside Stewardship Higher Tier',
        endDate: '31 March 2028',
        availableArea: '18.0000 hectares',
        actions: [
          { code: 'CIGL1', name: 'Take grassland field corners or blocks out of management', ha: 1 },
          { code: 'BFS1', name: 'Winter bird food on arable land', ha: 1 }
        ]
      }
    ],
    'upper-slope': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '30 June 2027',
        availableArea: '22.0000 hectares',
        actions: [{ code: 'CSAM3', name: 'Herbal leys', ha: 1.5 }]
      }
    ],
    'lane-meadow': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '1 August 2027',
        availableArea: '9.5000 hectares',
        actions: [{ code: 'AHW3', name: 'Beetle banks' }]
      }
    ],
    'stone-bridge': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '31 May 2027',
        availableArea: '51.2341 hectares',
        actions: [{ code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land' }]
      }
    ],
    'far-meadow': [
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '30 September 2027',
        availableArea: '56.3210 hectares',
        actions: [{ code: 'CSAM3', name: 'Herbal leys', ha: 1.2 }]
      },
      {
        scheme: 'Sustainable Farming Incentive',
        endDate: '1 November 2026',
        availableArea: '56.3210 hectares',
        actions: [{ code: 'CIGL1', name: 'Grassland field corners', ha: 0.8 }]
      }
    ]
  }

  function normaliseAction (action) {
    var ha = Number(action && action.ha)
    return {
      code: action.code,
      name: action.name,
      ha: Number.isFinite(ha) && ha > 0 ? ha : null
    }
  }

  function getAgreements (parcelId) {
    var key = String(parcelId || '').trim()
    var agreements = EXISTING_AGREEMENTS[key] || []
    return agreements.map(function (agreement) {
      return {
        scheme: agreement.scheme || '',
        endDate: agreement.endDate || '',
        availableArea: agreement.availableArea || '',
        actions: (agreement.actions || []).map(normaliseAction)
      }
    }).filter(function (agreement) {
      return agreement.actions.length > 0
    })
  }

  function getExistingAgreementActions (parcelId) {
    var actions = []
    getAgreements(parcelId).forEach(function (agreement) {
      agreement.actions.forEach(function (action) {
        actions.push(action)
      })
    })
    return actions
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

  window.SfiGrasslandsV2ExistingAgreements = {
    get: getExistingAgreementActions,
    getAgreements: getAgreements,
    count: countExistingAgreementActions,
    formatLabel: formatExistingActionLabel,
    formatDeductionLabel: formatDeductionLabel,
    getDeductions: getPreviousAgreementDeductions,
    getTotalHa: getPreviousAgreementTotalHa
  }
})(window)
