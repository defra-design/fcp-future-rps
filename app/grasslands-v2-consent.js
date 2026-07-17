/**
 * Prototype consent rules for grasslands-v2.
 * Keep in sync with ACTION_CONSENT_REQUIREMENTS / PARCEL_CONSENT_FLAGS
 * in app/views/grasslands-v2/select-actions.html
 */

var PARCEL_CONSENT_FLAGS = {
  'gate-field': { sssi: true, hefer: true },
  'far-meadow': { sssi: false, hefer: true }
}

var ACTION_CONSENT_REQUIREMENTS = {
  // SSSI only
  GRH7: { sssi: true, hefer: false },
  GRH8: { sssi: true, hefer: false },
  GRH10: { sssi: true, hefer: false },
  // HEFER only
  CSAM3: { sssi: false, hefer: true },
  CNUM2: { sssi: false, hefer: true },
  // Both
  CLIG3: { sssi: true, hefer: true },
  GRH12: { sssi: true, hefer: true }
}

function getActionConsentHint (parcelId, actionCode) {
  var parcelFlags = PARCEL_CONSENT_FLAGS[parcelId]
  var code = String(actionCode || '').toUpperCase()
  var actionReqs = ACTION_CONSENT_REQUIREMENTS[code]

  if (!parcelFlags || !actionReqs) {
    return null
  }

  var requiresSssi = Boolean(parcelFlags.sssi && actionReqs.sssi)
  var requiresHefer = Boolean(parcelFlags.hefer && actionReqs.hefer)

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

    var parcelFlags = PARCEL_CONSENT_FLAGS[parcel.parcelId]
    if (!parcelFlags) {
      return
    }

    ;(parcel.actions || []).forEach(function (action) {
      var code = String((action && action.code) || '').toUpperCase()
      var actionReqs = ACTION_CONSENT_REQUIREMENTS[code]
      if (!actionReqs) {
        return
      }

      if (parcelFlags.sssi && actionReqs.sssi) {
        requiresSssi = true
      }
      if (parcelFlags.hefer && actionReqs.hefer) {
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

module.exports = {
  PARCEL_CONSENT_FLAGS: PARCEL_CONSENT_FLAGS,
  ACTION_CONSENT_REQUIREMENTS: ACTION_CONSENT_REQUIREMENTS,
  getActionConsentHint: getActionConsentHint,
  getConsentRequirementsForParcels: getConsentRequirementsForParcels
}
