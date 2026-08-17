/**
 * Prototype consent / HEFER hints for sfi-grasslands-v2 (confirm, CYA, notices).
 * Keep in sync with PROTECTED_LAND_RULES / PARCEL_SSSI_HEFER_FLAGS in
 * app/assets/javascripts/sfi-grasslands-v2-aac.js
 *
 * Only show “Requires…” when the action is eligible but needs consent / HEFER —
 * not when the land is ineligible for that action.
 */

var PARCEL_CONSENT_FLAGS = {
  'far-meadow': { sssi: false, hefer: true }, // SO3757 3193
  'gate-field': { sssi: true, hefer: true } // SO3757 3194
}

// sssi: ineligible | consent_required | not_applicable
// hefer: ineligible | hefer_required | not_applicable
var PROTECTED_LAND_RULES = {
  CSAM3: { sssi: 'ineligible', hefer: 'ineligible' },
  CNUM2: { sssi: 'consent_required', hefer: 'ineligible' },
  CLIG3: { sssi: 'consent_required', hefer: 'hefer_required' },
  GRH12: { sssi: 'consent_required', hefer: 'hefer_required' },
  CIGL1: { sssi: 'consent_required', hefer: 'ineligible' },
  CIGL2: { sssi: 'consent_required', hefer: 'hefer_required' },
  BND1: { sssi: 'consent_required', hefer: 'hefer_required' },
  BND2: { sssi: 'consent_required', hefer: 'hefer_required' },
  WBD2: { sssi: 'ineligible', hefer: 'hefer_required' },
  CHRW2: { sssi: 'consent_required', hefer: 'hefer_required' },
  WBD1: { sssi: 'ineligible', hefer: 'hefer_required' },
  HEF1: { sssi: 'not_applicable', hefer: 'hefer_required' }
}

function getProtectedLandRules (actionCode) {
  return PROTECTED_LAND_RULES[String(actionCode || '').toUpperCase()] || null
}

function getRequirementFlags (parcelId, actionCode) {
  var parcelFlags = PARCEL_CONSENT_FLAGS[parcelId]
  var rules = getProtectedLandRules(actionCode)

  if (!parcelFlags || !rules) {
    return { sssi: false, hefer: false }
  }

  return {
    sssi: Boolean(parcelFlags.sssi && rules.sssi === 'consent_required'),
    hefer: Boolean(parcelFlags.hefer && rules.hefer === 'hefer_required')
  }
}

function getActionConsentHint (parcelId, actionCode) {
  var requirements = getRequirementFlags(parcelId, actionCode)
  var requiresSssi = requirements.sssi
  var requiresHefer = requirements.hefer

  if (requiresSssi && requiresHefer) {
    return 'Requires SSSI consent and an SFI HEFER'
  }
  if (requiresSssi) {
    return 'Requires SSSI consent'
  }
  if (requiresHefer) {
    return 'Requires an SFI HEFER'
  }

  return null
}

function getConsentRequirementsForParcels (parcels) {
  var requiresSssi = false
  var requiresHefer = false

  ;(parcels || []).forEach(function (parcel) {
    if (!parcel || !parcel.parcelId) {
      return
    }

    ;(parcel.actions || []).forEach(function (action) {
      var requirements = getRequirementFlags(parcel.parcelId, action && action.code)
      if (requirements.sssi) {
        requiresSssi = true
      }
      if (requirements.hefer) {
        requiresHefer = true
      }
    })
  })

  var interruptionType = null
  if (requiresSssi && requiresHefer) {
    interruptionType = 'sssi-hefer'
  } else if (requiresSssi) {
    interruptionType = 'sssi'
  } else if (requiresHefer) {
    interruptionType = 'hefer'
  }

  return {
    requiresSssi: requiresSssi,
    requiresHefer: requiresHefer,
    requiresConsent: requiresSssi || requiresHefer,
    interruptionType: interruptionType
  }
}

/**
 * Declaration bullet on confirm-and-submit.
 * Only shown when at least one selected action needs SSSI consent and/or a HEFER.
 */
function getSubmitDeclarationConsentLine (requiresSssi, requiresHefer) {
  if (requiresSssi && requiresHefer) {
    return 'you will get consent for SSSI actions and request a HEFER where required'
  }
  if (requiresSssi) {
    return 'you will get consent for SSSI actions where required'
  }
  if (requiresHefer) {
    return 'you will request a HEFER where required'
  }
  return null
}

module.exports = {
  PARCEL_CONSENT_FLAGS: PARCEL_CONSENT_FLAGS,
  PROTECTED_LAND_RULES: PROTECTED_LAND_RULES,
  // Kept for older callers that still expect the boolean map shape
  ACTION_CONSENT_REQUIREMENTS: Object.keys(PROTECTED_LAND_RULES).reduce(function (map, code) {
    var rules = PROTECTED_LAND_RULES[code]
    map[code] = {
      sssi: rules.sssi === 'consent_required',
      hefer: rules.hefer === 'hefer_required'
    }
    return map
  }, {}),
  getActionConsentHint: getActionConsentHint,
  getConsentRequirementsForParcels: getConsentRequirementsForParcels,
  getSubmitDeclarationConsentLine: getSubmitDeclarationConsentLine,
  getRequirementFlags: getRequirementFlags
}
