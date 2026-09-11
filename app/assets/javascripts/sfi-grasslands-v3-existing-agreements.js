(function (window) {
  // Previous / existing agreements on each parcel (prototype data).
  // Shown on select-actions in a GOV.UK details table (Scheme, Action, Quantity, Expires).
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
        // SO3757 3194 — SFI 2024 agreement (3 years from Oct 2024)
        scheme: 'Sustainable Farming Incentive 2024',
        shortScheme: 'SFI 2024',
        endDate: '30 September 2027',
        actions: [
          {
            code: 'CSAM3',
            name: 'Herbal leys',
            ha: 6.45
          },
          {
            code: 'CNUM2',
            name: 'Legumes on improved grassland',
            ha: 3.2
          }
        ]
      },
      {
        // Earlier SFI 2023 agreement still running on part of the parcel
        scheme: 'Sustainable Farming Incentive 2023',
        shortScheme: 'SFI 2023',
        endDate: '31 October 2026',
        actions: [{
          code: 'CIGL1',
          name: 'Take grassland field corners or blocks out of management',
          ha: 0.48
        }]
      }
    ],
    'church-field': [
      {
        // SO3757 3190 — mixed SFI + Countryside Stewardship on SSSI/HEFER land
        scheme: 'Sustainable Farming Incentive 2024',
        shortScheme: 'SFI 2024',
        endDate: '30 September 2027',
        actions: [
          {
            code: 'CSAM3',
            name: 'Herbal leys',
            ha: 4.5
          },
          {
            code: 'CIPM2',
            name: 'Flower-rich grass margins, blocks or in-field strips',
            ha: 0.85
          }
        ]
      },
      {
        scheme: 'Countryside Stewardship Mid Tier',
        shortScheme: 'CS Mid Tier',
        endDate: '31 December 2027',
        actions: [{
          code: 'GS2',
          name: 'Permanent grassland with very low inputs (outside SDAs)',
          ha: 2.15
        }]
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
    'far-meadow': [
      {
        // SO3757 3193 — larger temporary grassland parcel
        scheme: 'Sustainable Farming Incentive 2024',
        shortScheme: 'SFI 2024',
        endDate: '30 September 2027',
        actions: [
          {
            code: 'CSAM3',
            name: 'Herbal leys',
            ha: 8.75
          },
          {
            code: 'CNUM2',
            name: 'Legumes on improved grassland',
            ha: 5.4
          },
          {
            code: 'CIPM2',
            name: 'Flower-rich grass margins, blocks or in-field strips',
            ha: 1.25
          }
        ]
      },
      {
        scheme: 'Sustainable Farming Incentive 2023',
        shortScheme: 'SFI 2023',
        endDate: '31 October 2026',
        actions: [{
          code: 'CIGL1',
          name: 'Take grassland field corners or blocks out of management',
          ha: 0.62
        }]
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
        shortScheme: agreement.shortScheme || '',
        endDate: agreement.endDate || '',
        availableArea: agreement.availableArea || '',
        actions: (agreement.actions || []).map(normaliseAction)
      }
    }).filter(function (agreement) {
      return agreement.actions.length > 0
    })
  }

  function countExistingAgreements (parcelId) {
    return getAgreements(parcelId).length
  }

  function getExistingAgreementActions (parcelId) {
    var actions = []
    getAgreements(parcelId).forEach(function (agreement) {
      agreement.actions.forEach(function (action) {
        actions.push(Object.assign({}, action, {
          scheme: agreement.scheme,
          shortScheme: agreement.shortScheme,
          endDate: agreement.endDate
        }))
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
    var base = formatExistingActionLabel(action)
    var schemeShort = action.shortScheme || ''
    if (base && schemeShort) {
      return base + ' – ' + schemeShort
    }
    if (action.code && action.name) {
      return action.code + ' – ' + action.name
    }
    return base
  }

  function getPreviousAgreementDeductions (parcelId) {
    return getExistingAgreementActions(parcelId).filter(function (action) {
      return action.ha != null && action.ha > 0
    })
  }

  function getDeductionsForAction (parcelId, actionCode) {
    var code = String(actionCode || '').toUpperCase()
    return getPreviousAgreementDeductions(parcelId).filter(function (action) {
      return String(action.code || '').toUpperCase() === code
    })
  }

  function getPreviousAgreementTotalHa (parcelId) {
    return getPreviousAgreementDeductions(parcelId).reduce(function (sum, action) {
      return Math.round((sum + Number(action.ha)) * 10000) / 10000
    }, 0)
  }

  window.SfiGrasslandsV3ExistingAgreements = {
    get: getExistingAgreementActions,
    getAgreements: getAgreements,
    count: countExistingAgreements,
    countActions: countExistingAgreementActions,
    formatLabel: formatExistingActionLabel,
    formatDeductionLabel: formatDeductionLabel,
    getDeductions: getPreviousAgreementDeductions,
    getDeductionsForAction: getDeductionsForAction,
    getTotalHa: getPreviousAgreementTotalHa
  }
})(window)
