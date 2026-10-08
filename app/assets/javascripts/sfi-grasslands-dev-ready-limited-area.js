// Loaded by sfi-grasslands-dev-ready select-actions.
// Limited-area actions (CIGL1 and CIGL2) share one allowance: 25% of the farm's total area,
// minus what is already in existing agreements and elsewhere in this application.
(function (window) {
  var LIMITED_AREA_CODES = ['CIGL1', 'CIGL2']
  var LIMIT_SHARE = 0.25

  function readConfig () {
    var el = document.getElementById('limited-area-json')
    if (!el) {
      return {}
    }
    try {
      return JSON.parse(el.textContent) || {}
    } catch (error) {
      return {}
    }
  }

  var config = readConfig()

  function roundHa4 (value) {
    return Math.round(value * 10000) / 10000
  }

  function toHa (value) {
    var number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : 0
  }

  function isLimitedCode (code) {
    return LIMITED_AREA_CODES.indexOf(String(code || '').toUpperCase()) !== -1
  }

  function isEnabled () {
    return toHa(config.farmTotalHa) > 0
  }

  function getExistingAgreementsHa () {
    var agreements = window.SfiGrasslandsDevReadyExistingAgreements
    if (!agreements || typeof agreements.getAll !== 'function') {
      return 0
    }
    return roundHa4(agreements.getAll().reduce(function (sum, action) {
      return isLimitedCode(action.code) ? sum + toHa(action.ha) : sum
    }, 0))
  }

  function getOtherParcelsHa (currentParcelId) {
    return roundHa4((config.applicationParcels || []).reduce(function (sum, parcel) {
      if (!parcel || parcel.parcelId === currentParcelId) {
        return sum
      }
      return (parcel.actions || []).reduce(function (parcelSum, action) {
        return isLimitedCode(action.code) ? parcelSum + toHa(action.quantity) : parcelSum
      }, sum)
    }, 0))
  }

  function getThisParcelHa (selections) {
    return roundHa4(LIMITED_AREA_CODES.reduce(function (sum, code) {
      return sum + toHa(selections && selections[code])
    }, 0))
  }

  function getSummary (currentParcelId, selections) {
    var farmTotalHa = toHa(config.farmTotalHa)
    var limitHa = roundHa4(farmTotalHa * LIMIT_SHARE)
    var existingHa = getExistingAgreementsHa()
    var otherParcelsHa = getOtherParcelsHa(currentParcelId)
    var thisParcelHa = getThisParcelHa(selections)
    var usedHa = roundHa4(existingHa + otherParcelsHa + thisParcelHa)

    return {
      farmTotalHa: farmTotalHa,
      limitHa: limitHa,
      existingHa: existingHa,
      otherParcelsHa: otherParcelsHa,
      thisParcelHa: thisParcelHa,
      usedHa: usedHa,
      remainingHa: Math.max(0, roundHa4(limitHa - usedHa))
    }
  }

  // Most this action can take before its own entry, so it matches AAC's maxAvailable.
  function getMaxForAction (code, currentParcelId, selections) {
    var summary = getSummary(currentParcelId, selections)
    var ownHa = toHa(selections && selections[String(code || '').toUpperCase()])
    return Math.max(0, roundHa4(summary.limitHa - (summary.usedHa - ownHa)))
  }

  window.SfiGrasslandsDevReadyLimitedArea = {
    codes: LIMITED_AREA_CODES.slice(),
    isEnabled: isEnabled,
    isLimitedCode: isLimitedCode,
    getSummary: getSummary,
    getMaxForAction: getMaxForAction
  }
})(window)
