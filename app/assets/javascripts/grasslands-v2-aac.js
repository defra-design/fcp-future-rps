/**
 * grasslands-v2: Available Area Calculation (AAC) exploration
 *
 * Prototype only. Driven by the "Use Available Area Calculation (AAC)" toggle.
 * When enabled, action availability is explained through remaining eligible area
 * rather than binary compatibility alone.
 */
(function (window) {
  var DEFAULT_DELAY_MS = 2500

  var state = {
    enabled: false,
    debug: false,
    busy: false,
    timerId: null,
    requestId: 0,
    parcelId: null,
    parcel: null,
    actions: [],
    selections: {},
    incompatibleByCode: {},
    onBusyChange: null,
    onAfterRecalculate: null,
    getContinueButton: null
  }

  // Illustrative Gate Field profile from the AAC exploration brief (4 ha total).
  // Other parcels fall back to a simpler profile derived from parcel data.
  var GATE_FIELD_PROFILE = {
    totalHa: 4,
    landCovers: [
      { name: 'Permanent grassland', ha: 3 },
      { name: 'Scrub', ha: 1 }
    ],
    restrictions: {
      sssiHa: 1,
      historicFeature: true,
      scrubPresent: true,
      // Already committed in a previous agreement (e.g. herbal leys)
      previousAgreementHa: 1
    }
  }

  // Illustrative ha already used by previous agreements (when not on the Gate Field profile).
  var PREVIOUS_AGREEMENT_HA_BY_PARCEL = {
    'far-meadow': 2, // CSAM3 1.2 ha + CIGL1 0.8 ha in previous SFI agreements
    'brook-field': 1.5,
    'long-meadow': 1,
    'upper-slope': 1.5,
    'valley-bottom': 2
  }

  function roundHa (value) {
    return Math.round(Math.max(0, value) * 100) / 100
  }

  function formatHa (value) {
    var rounded = roundHa(value)
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  }

  function getActionMeta (code) {
    var catalog = (window.SFI_SCHEME_2026 && window.SFI_SCHEME_2026.actions) || []
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].code === code) {
        return catalog[i]
      }
    }
    return { code: code, name: code, rateText: '' }
  }

  function getMvpCodes () {
    if (window.GRASSLANDS_V2_MVP_ACTIONS && Array.isArray(window.GRASSLANDS_V2_MVP_ACTIONS.codes)) {
      return window.GRASSLANDS_V2_MVP_ACTIONS.codes.slice()
    }
    return []
  }

  function getParcelAreaBreakdown (parcelId, parcel) {
    var profile = getParcelProfile(parcelId, parcel)
    var totalHa = profile.totalHa
    // Prefer the real parcel total when present so the card matches “Total area”
    var parcelTotal = Number(parcel && (parcel.totalArea || parcel.availableArea))
    if (Number.isFinite(parcelTotal) && parcelTotal > 0) {
      totalHa = roundHa(parcelTotal)
    }

    var covers = (profile.landCovers || []).slice()
    if (!covers.length) {
      covers = [{ name: 'Eligible land', ha: totalHa }]
    }

    // Scale illustrative cover shares to the displayed parcel total
    var profileTotal = covers.reduce(function (sum, cover) {
      return sum + Number(cover.ha || 0)
    }, 0)
    if (profileTotal > 0 && Math.abs(profileTotal - totalHa) > 0.001) {
      var scaled = []
      var allocated = 0
      covers.forEach(function (cover, index) {
        if (index === covers.length - 1) {
          scaled.push({
            name: cover.name,
            ha: roundHa(totalHa - allocated)
          })
          return
        }
        var share = roundHa((Number(cover.ha || 0) / profileTotal) * totalHa)
        allocated = roundHa(allocated + share)
        scaled.push({ name: cover.name, ha: share })
      })
      covers = scaled
    } else {
      covers = covers.map(function (cover) {
        return { name: cover.name, ha: roundHa(cover.ha) }
      })
    }

    // Scale restriction areas with the same ratio used for land covers
    var restrictionScale = 1
    if (profile.totalHa > 0 && Math.abs(profile.totalHa - totalHa) > 0.001) {
      restrictionScale = totalHa / profile.totalHa
    }

    var restrictions = []
    if (parcelId === 'gate-field') {
      // Clear fixed deductions for the Gate Field AAC exploration story
      restrictions.push({
        label: 'SSSI restrictions',
        ha: totalHa > 10 ? 4 : 1
      })
      restrictions.push({
        label: 'Historic features / an SFI HEFER may apply to some actions',
        ha: null
      })
      restrictions.push({
        label: 'Herbal leys (CSAM3) already included in a previous agreement',
        ha: totalHa > 10 ? 2 : 1
      })
    } else {
      if (profile.restrictions && profile.restrictions.sssiHa > 0) {
        restrictions.push({
          label: 'SSSI restrictions',
          ha: roundHa(profile.restrictions.sssiHa * restrictionScale)
        })
      }
      if (profile.restrictions && profile.restrictions.historicFeature) {
        restrictions.push({
          label: 'Historic features / an SFI HEFER may apply to some actions',
          ha: null
        })
      } else if (parcelId === 'far-meadow') {
        restrictions.push({
          label: 'An SFI HEFER may apply to some actions',
          ha: null
        })
      }

      var previousAgreementHa = 0
      if (
        window.GrasslandsV2ExistingAgreements &&
        typeof window.GrasslandsV2ExistingAgreements.getTotalHa === 'function'
      ) {
        previousAgreementHa = roundHa(window.GrasslandsV2ExistingAgreements.getTotalHa(parcelId) || 0)
      }
      if (previousAgreementHa <= 0 && profile.restrictions && profile.restrictions.previousAgreementHa > 0) {
        previousAgreementHa = roundHa(profile.restrictions.previousAgreementHa)
      } else if (previousAgreementHa <= 0 && PREVIOUS_AGREEMENT_HA_BY_PARCEL[parcelId]) {
        previousAgreementHa = roundHa(PREVIOUS_AGREEMENT_HA_BY_PARCEL[parcelId])
      } else if (
        previousAgreementHa <= 0 &&
        window.GrasslandsV2ExistingAgreements &&
        typeof window.GrasslandsV2ExistingAgreements.count === 'function' &&
        window.GrasslandsV2ExistingAgreements.count(parcelId) > 0
      ) {
        previousAgreementHa = roundHa(Math.min(1.5 * window.GrasslandsV2ExistingAgreements.count(parcelId), totalHa * 0.2))
      }

      if (previousAgreementHa > 0) {
        restrictions.push({
          label: 'Already included in a previous agreement',
          ha: previousAgreementHa
        })
      }
    }

    var previousAgreementTotal = 0
    var deductedHa = 0
    restrictions.forEach(function (item) {
      if (/previous agreement/i.test(item.label) && item.ha != null) {
        previousAgreementTotal = Number(item.ha) || 0
      }
      if (item.ha != null && Number.isFinite(Number(item.ha)) && Number(item.ha) > 0) {
        deductedHa = roundHa(deductedHa + Number(item.ha))
      }
    })

    var availableHa = Math.max(0, roundHa(totalHa - deductedHa))

    return {
      totalHa: totalHa,
      availableHa: availableHa,
      landCovers: covers,
      restrictions: restrictions,
      previousAgreementHa: previousAgreementTotal
    }
  }

  // Convert parcel available hectares into an illustrative eligible length (metres).
  // Match select-actions getLinearAvailableMetres: square-equivalent perimeter.
  function metresFromAvailableHa (availableHa) {
    var ha = Number(availableHa)
    if (!Number.isFinite(ha) || ha <= 0) {
      return 0
    }
    return Math.max(50, Math.round(4 * Math.sqrt(ha * 10000)))
  }

  function squareMetresFromAvailableHa (availableHa) {
    var ha = Number(availableHa)
    if (!Number.isFinite(ha) || ha <= 0) {
      return 0
    }
    return Math.max(50, Math.round(ha * 25))
  }

  function getWorkingProfile (parcelId, parcel) {
    var breakdown = getParcelAreaBreakdown(parcelId, parcel)
    var profile = getParcelProfile(parcelId, parcel)
    var totalHa = breakdown.totalHa
    var availableHa = breakdown.availableHa

    // Align land-cover shares to the same total hectares shown in the UI
    var covers = (breakdown.landCovers && breakdown.landCovers.length)
      ? breakdown.landCovers.slice()
      : (profile.landCovers || []).slice()

    return {
      totalHa: totalHa,
      availableHa: availableHa,
      landCovers: covers,
      restrictions: Object.assign({}, profile.restrictions, {
        previousAgreementHa: breakdown.previousAgreementHa || 0
      })
    }
  }

  function getParcelProfile (parcelId, parcel) {
    if (parcelId === 'gate-field') {
      return {
        totalHa: GATE_FIELD_PROFILE.totalHa,
        landCovers: GATE_FIELD_PROFILE.landCovers.slice(),
        restrictions: Object.assign({}, GATE_FIELD_PROFILE.restrictions)
      }
    }

    var totalHa = Number(parcel && (parcel.totalArea || parcel.availableArea))
    if (!Number.isFinite(totalHa) || totalHa <= 0) {
      totalHa = 4
    }

    var covers = []
    if (parcel && Array.isArray(parcel.landCover)) {
      parcel.landCover.forEach(function (name, index, list) {
        covers.push({
          name: name,
          ha: roundHa(totalHa / list.length)
        })
      })
    } else if (parcel && typeof parcel.landCover === 'string') {
      covers.push({ name: parcel.landCover, ha: roundHa(totalHa) })
    } else {
      covers.push({ name: 'Permanent grassland', ha: roundHa(totalHa) })
    }

    return {
      totalHa: roundHa(totalHa),
      landCovers: covers,
      restrictions: {
        sssiHa: 0,
        historicFeature: false,
        scrubPresent: covers.some(function (cover) {
          return /scrub/i.test(cover.name)
        }),
        previousAgreementHa: PREVIOUS_AGREEMENT_HA_BY_PARCEL[parcelId]
          ? roundHa(PREVIOUS_AGREEMENT_HA_BY_PARCEL[parcelId])
          : 0
      }
    }
  }

  function findLandCoverHa (profile, matcher) {
    var total = 0
    profile.landCovers.forEach(function (cover) {
      if (matcher(cover.name)) {
        total += cover.ha
      }
    })
    return roundHa(total)
  }

  function buildBaseCalculation (code, profile) {
    var grasslandHa = findLandCoverHa(profile, function (name) {
      return /permanent grassland|temporary grass/i.test(name)
    })
    var arableHa = findLandCoverHa(profile, function (name) {
      return /arable|fallow|leguminous|perennial/i.test(name)
    })
    var scrubHa = findLandCoverHa(profile, function (name) {
      return /scrub/i.test(name)
    })

    var eligibleLand = []
    var exclusions = []
    var unit = 'ha'
    var baseEligible = 0
    var absoluteBlock = null

    switch (code) {
      case 'CLIG3':
      case 'CIGL1':
      case 'CIGL2':
      case 'CNUM2':
      case 'CSAM3':
      case 'GRH7':
      case 'GRH8':
      case 'GRH10':
      case 'GRH12':
        baseEligible = grasslandHa
        if (grasslandHa > 0) {
          eligibleLand.push({ label: 'Eligible permanent grassland', ha: grasslandHa })
        }
        // Narrative exclusion: SSSI land is outside the eligible grassland total
        // (do not subtract again from grasslandHa — that already excludes SSSI).
        if (profile.restrictions.sssiHa > 0 && grasslandHa > 0 &&
            (code === 'GRH7' || code === 'GRH8' || code === 'GRH10' || code === 'GRH12' || code === 'CLIG3' || code === 'CIGL1' || code === 'CIGL2')) {
          exclusions.push({
            label: 'Excluded because of SSSI restrictions',
            ha: Math.min(profile.restrictions.sssiHa, profile.totalHa)
          })
        }
        if (code === 'CNUM2' || code === 'CSAM3') {
          // Habitat / HEFER-style reduction for the Gate Field story (e.g. 3 ha → 2 ha)
          var habitatCut = Math.min(1, baseEligible)
          if (habitatCut > 0 && profile.restrictions.historicFeature) {
            exclusions.push({ label: 'Additional habitat requirements reduce the available area', ha: habitatCut })
            baseEligible = roundHa(baseEligible - habitatCut)
          }
        }
        if (profile.restrictions.previousAgreementHa > 0 && baseEligible > 0) {
          var previousCut = Math.min(profile.restrictions.previousAgreementHa, baseEligible)
          exclusions.push({
            label: 'Already included in a previous agreement',
            ha: previousCut
          })
          baseEligible = roundHa(baseEligible - previousCut)
        }
        if (profile.availableHa != null) {
          baseEligible = roundHa(Math.min(baseEligible, profile.availableHa))
        }
        break

      case 'SCR2':
        baseEligible = scrubHa > 0 ? scrubHa : (profile.restrictions.scrubPresent ? 1 : 0)
        if (profile.availableHa != null) {
          baseEligible = roundHa(Math.min(baseEligible, profile.availableHa))
        }
        if (baseEligible > 0) {
          eligibleLand.push({ label: 'Eligible scrub and open habitat', ha: baseEligible })
        }
        break

      case 'BND1':
      case 'BND2':
      case 'CHRW2':
      case 'WBD2':
        unit = 'm'
        // Reflect parcel available hectares, but keep the action measurement in metres
        baseEligible = metresFromAvailableHa(profile.availableHa != null ? profile.availableHa : profile.totalHa)
        eligibleLand.push({ label: 'Estimated eligible length from available area', ha: baseEligible, unit: 'm' })
        break

      case 'WBD1':
        // Official guidance: available area is not applicable — enter number of ponds.
        // Do not invent an available pond count (users treat it as a known maximum).
        unit = 'pond'
        baseEligible = Number.POSITIVE_INFINITY
        break

      case 'HEF1':
        unit = 'm²'
        if (profile.restrictions.historicFeature) {
          baseEligible = squareMetresFromAvailableHa(profile.availableHa != null ? profile.availableHa : profile.totalHa)
          eligibleLand.push({ label: 'Traditional building footprint', ha: baseEligible, unit: 'm²' })
        } else {
          baseEligible = 0
          absoluteBlock = 'No traditional farm building is recorded on this parcel.'
        }
        break

      default:
        baseEligible = roundHa(grasslandHa + arableHa)
        if (profile.availableHa != null) {
          baseEligible = roundHa(Math.min(baseEligible, profile.availableHa))
        }
        if (baseEligible > 0) {
          eligibleLand.push({ label: 'Eligible land on this parcel', ha: baseEligible })
        }
        break
    }

    if (unit !== 'pond' && !absoluteBlock && baseEligible <= 0 && eligibleLand.length === 0) {
      absoluteBlock = 'No eligible land remains for this action.'
    }

    return {
      code: code,
      unit: unit,
      baseEligible: unit === 'pond' ? baseEligible : roundHa(baseEligible),
      eligibleLand: eligibleLand,
      exclusions: exclusions,
      absoluteBlock: absoluteBlock
    }
  }

  function getSelectedQuantity (code) {
    var raw = state.selections[code]
    var value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : 0
  }

  function getHardIncompatibilities (code) {
    return state.incompatibleByCode[code] || []
  }

  function findHardConflict (code) {
    // AAC: hard conflicts only apply once a quantity has been entered,
    // not when the checkbox alone is ticked.
    var selectedCodes = Object.keys(state.selections).filter(function (selectedCode) {
      return getSelectedQuantity(selectedCode) > 0
    })
    var incompatibles = getHardIncompatibilities(code)
    for (var i = 0; i < selectedCodes.length; i++) {
      var selectedCode = selectedCodes[i]
      if (selectedCode === code) {
        continue
      }
      if (incompatibles.indexOf(selectedCode) !== -1) {
        return selectedCode
      }
      var reverse = getHardIncompatibilities(selectedCode)
      if (reverse.indexOf(code) !== -1) {
        return selectedCode
      }
    }
    return null
  }

  // Supplements sit on a base action (SUPBAS) — they do not consume exclusive land.
  var SUPPLEMENT_BASE_BY_CODE = {
    GRH7: 'CLIG3',
    GRH8: 'CLIG3',
    GRH10: 'CLIG3'
  }

  function isSupplementAction (code) {
    return Object.prototype.hasOwnProperty.call(SUPPLEMENT_BASE_BY_CODE, String(code || '').toUpperCase())
  }

  function getSupplementBaseCode (code) {
    return SUPPLEMENT_BASE_BY_CODE[String(code || '').toUpperCase()] || null
  }

  function actionsShareStackingLand (codeA, codeB) {
    var a = String(codeA || '').toUpperCase()
    var b = String(codeB || '').toUpperCase()
    if (!a || !b || a === b) {
      return false
    }
    return getSupplementBaseCode(a) === b || getSupplementBaseCode(b) === a
  }

  function getUsedByOtherUnitActions (code, unit) {
    var used = 0
    Object.keys(state.selections).forEach(function (selectedCode) {
      if (selectedCode === code) {
        return
      }
      // Supplements stack on their base — neither side should reduce the other's exclusive pool.
      if (isSupplementAction(selectedCode) || actionsShareStackingLand(code, selectedCode)) {
        return
      }
      var quantity = getSelectedQuantity(selectedCode)
      if (!quantity) {
        return
      }
      var meta = buildBaseCalculation(selectedCode, getWorkingProfile(state.parcelId, state.parcel))
      if (meta.unit === unit) {
        used += quantity
      }
    })
    if (unit === 'ha') {
      return roundHa(used)
    }
    return Math.max(0, Math.round(used * 100) / 100)
  }

  function recalculate () {
    var profile = getWorkingProfile(state.parcelId, state.parcel)
    var results = []
    var haUsedBySelections = 0

    state.actions.forEach(function (code) {
      var base = buildBaseCalculation(code, profile)
      var meta = getActionMeta(code)
      var selectedQuantity = getSelectedQuantity(code)
      var hardConflict = findHardConflict(code)
      var usedByOthers = getUsedByOtherUnitActions(code, base.unit)
      var available = base.baseEligible
      var allocationNote = null

      // Shared pool by unit: ha actions share hectares; metre actions share length; etc.
      // Pond count is user-declared — no shared available pool.
      // Supplements stack on their base and do not compete for exclusive hectares.
      if (base.unit === 'pond') {
        available = Number.POSITIVE_INFINITY
        usedByOthers = 0
        allocationNote = null
      } else {
        available = Math.max(0, base.baseEligible - usedByOthers)
        if (base.unit === 'ha') {
          available = roundHa(available)
        } else {
          available = Math.max(0, Math.round(available))
        }

        // Cap supplement quantity by the base action already entered on this parcel.
        var supplementBaseCode = getSupplementBaseCode(code)
        if (supplementBaseCode) {
          var baseQuantity = getSelectedQuantity(supplementBaseCode)
          if (baseQuantity > 0) {
            available = roundHa(Math.min(available, baseQuantity))
            allocationNote = {
              label: 'Limited to the area of ' + supplementBaseCode + ' on this parcel',
              ha: available,
              unit: 'ha'
            }
          }
        }

        if (!allocationNote && usedByOthers > 0) {
          allocationNote = {
            label: 'Used by your other selected actions',
            ha: base.unit === 'ha' ? Math.min(usedByOthers, base.baseEligible) : usedByOthers,
            unit: base.unit
          }
        }
      }

      // Show remaining capacity after this action’s own entered quantity
      var remainingForInput = available
      if (base.unit === 'pond') {
        remainingForInput = Number.POSITIVE_INFINITY
      } else if (selectedQuantity > 0) {
        remainingForInput = Math.max(0, available - selectedQuantity)
        if (base.unit === 'ha') {
          remainingForInput = roundHa(remainingForInput)
        } else {
          remainingForInput = Math.max(0, Math.round(remainingForInput))
        }
      }

      // Supplements stack on base land — do not double-count hectares used on the parcel.
      if (base.unit === 'ha' && selectedQuantity > 0 && !isSupplementAction(code)) {
        haUsedBySelections = roundHa(haUsedBySelections + selectedQuantity)
      }

      var status = 'available'
      var statusText = 'Available for this action'
      var summaryReason = ''

      if (hardConflict) {
        status = 'unavailable'
        statusText = 'Unavailable'
        summaryReason = 'This action cannot be used with ' + hardConflict + ' on the same land parcel.'
        remainingForInput = 0
      } else if (base.absoluteBlock) {
        status = 'unavailable'
        statusText = 'Unavailable'
        summaryReason = base.absoluteBlock
        remainingForInput = 0
      } else if (base.unit === 'pond') {
        status = 'available'
        statusText = 'Available for this action'
        summaryReason = selectedQuantity > 0
          ? 'You have entered ' + formatQuantity(selectedQuantity, base.unit) + '.'
          : 'Enter the number of eligible ponds on this parcel.'
      } else if (remainingForInput <= 0 && selectedQuantity <= 0) {
        status = 'unavailable'
        statusText = 'Unavailable'
        if (usedByOthers > 0) {
          summaryReason = base.unit === 'm'
            ? 'No metres are left for this action. They are already being used by your other selected actions.'
            : base.unit === 'm²'
              ? 'No square metres are left for this action. They are already being used by your other selected actions.'
              : 'No land is left for this action. The remaining eligible land is being used by your other selected actions.'
        } else {
          summaryReason = 'No eligible area remains for this action.'
        }
      } else if (selectedQuantity > 0) {
        status = 'available'
        statusText = 'Available for this action'
        summaryReason = remainingForInput > 0
          ? 'You have entered ' + formatQuantity(selectedQuantity, base.unit) + '. Up to ' + formatQuantity(remainingForInput, base.unit) + ' remaining.'
          : 'You have used the available area for this action.'
      } else {
        summaryReason = 'This action can use up to ' + formatQuantity(remainingForInput, base.unit) + '.'
      }

      results.push({
        code: code,
        name: meta.name,
        rateText: meta.rateText || '',
        unit: base.unit,
        status: status,
        statusText: statusText,
        available: remainingForInput,
        // Max this action can take before its own entry (shared pool minus others)
        maxAvailable: available,
        selectedQuantity: selectedQuantity,
        summaryReason: summaryReason,
        eligibleLand: base.eligibleLand,
        exclusions: base.exclusions,
        allocationNote: allocationNote,
        hardConflict: hardConflict,
        baseEligible: base.baseEligible,
        profileTotalHa: profile.totalHa,
        profileAvailableHa: profile.availableHa,
        debugLines: buildDebugLines(base, allocationNote, remainingForInput)
      })
    })

    return {
      profile: profile,
      availableHaRemaining: Math.max(0, roundHa(profile.availableHa - haUsedBySelections)),
      actions: results
    }
  }

  function formatQuantity (value, unit) {
    if (unit === 'm') {
      var metres = Math.round(value)
      var metresLabel = metres === 1 ? ' metre' : ' metres'
      return metres.toLocaleString('en-GB') + metresLabel
    }
    if (unit === 'm²') {
      var sq = Math.round(value)
      var sqLabel = sq === 1 ? ' square metre' : ' square metres'
      return sq.toLocaleString('en-GB') + sqLabel
    }
    if (unit === 'pond') {
      var ponds = Math.round(value)
      return ponds === 1 ? '1 pond' : ponds.toLocaleString('en-GB') + ' ponds'
    }
    var ha = formatHa(value)
    var singular = Number(ha) === 1 || ha === '1' || ha === '1.0'
    return ha + (singular ? ' hectare' : ' hectares')
  }

  function formatInputSuffix (unit) {
    if (unit === 'm²') {
      return 'm²'
    }
    return unit
  }

  function buildDebugLines (base, allocationNote, available) {
    var lines = []
    base.eligibleLand.forEach(function (item) {
      lines.push((item.label || 'Eligible') + '  ' + formatHa(item.ha) + ' ' + (item.unit || 'ha'))
    })
    base.exclusions.forEach(function (item) {
      lines.push((item.label || 'Excluded') + '  -' + formatHa(item.ha) + ' ha')
    })
    if (allocationNote) {
      var noteAmount = allocationNote.unit === 'm' || allocationNote.unit === 'm²' || allocationNote.unit === 'pond'
        ? formatQuantity(allocationNote.ha, allocationNote.unit)
        : (formatHa(allocationNote.ha) + ' ha')
      lines.push(allocationNote.label + '  -' + noteAmount)
    }
    lines.push('Available  ' + formatHa(available) + ' ' + (base.unit || 'ha'))
    return lines
  }

  function getCheckboxesContainer () {
    return document.getElementById('actions-checkboxes-container')
  }

  function getContinueButton () {
    if (typeof state.getContinueButton === 'function') {
      return state.getContinueButton()
    }
    return document.getElementById('continue-button')
  }

  function escapeHtml (value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function getActionCheckbox (code) {
    return document.querySelector('input[name="actions"][value="' + code + '"]')
  }

  function getActionItem (code) {
    var checkbox = getActionCheckbox(code)
    return checkbox ? checkbox.closest('.govuk-checkboxes__item') : null
  }

  function getActionConditional (code) {
    return document.getElementById('conditional-' + String(code || '').toLowerCase())
  }

  function getActionQuantityInput (code) {
    return document.getElementById('quantity-' + String(code || '').toLowerCase())
  }

  function getActionHint (code) {
    var conditional = getActionConditional(code)
    if (!conditional) {
      return null
    }
    return conditional.querySelector('.govuk-hint.govuk-checkboxes__hint')
  }

  function setBusy (isBusy, editedCode) {
    state.busy = Boolean(isBusy)
    var continueButton = getContinueButton()
    var container = getCheckboxesContainer()

    if (continueButton) {
      continueButton.disabled = state.busy
    }

    // Banner status is unused — busy feedback is the inline message on the edited action only.

    // Clear any previous inline updating message
    Array.prototype.forEach.call(document.querySelectorAll('[data-aac-updating]'), function (el) {
      el.remove()
    })

    if (container) {
      container.setAttribute('aria-busy', state.busy ? 'true' : 'false')
      Array.prototype.forEach.call(
        container.querySelectorAll('input[name="actions"], input[id^="quantity-"]'),
        function (el) {
          var code = ''
          if (el.name === 'actions') {
            code = el.value
          } else if (el.id && el.id.indexOf('quantity-') === 0) {
            code = el.id.replace('quantity-', '').toUpperCase()
          }
          var isEdited = editedCode && code === editedCode
          if (state.busy && !isEdited) {
            el.disabled = true
          } else if (!state.busy) {
            // Leave AAC-disabled actions alone — render() re-applies availability
            if (el.name === 'actions' && el.getAttribute('data-disabled-reason') === 'aac') {
              return
            }
            if (el.id && el.id.indexOf('quantity-') === 0) {
              var parent = getActionCheckbox(code)
              if (parent && parent.getAttribute('data-disabled-reason') === 'aac') {
                return
              }
            }
            el.disabled = false
          }
        }
      )

      // Show a clear updating message on the action being edited (not a stray spinner in the label)
      if (state.busy && editedCode) {
        var conditional = getActionConditional(editedCode)
        var hint = getActionHint(editedCode)
        if (conditional && !conditional.querySelector('[data-aac-updating]')) {
          var updating = document.createElement('div')
          updating.className = 'app-aac-updating'
          updating.setAttribute('data-aac-updating', '')
          updating.setAttribute('role', 'status')
          updating.setAttribute('aria-live', 'polite')
          updating.innerHTML =
            '<span class="actions-compatibility-status__spinner" aria-hidden="true"></span>' +
            '<p class="govuk-body-s govuk-!-margin-bottom-0">Updating available land for this action…</p>'
          if (hint && hint.parentNode) {
            hint.parentNode.insertBefore(updating, hint.nextSibling)
          } else {
            conditional.insertBefore(updating, conditional.firstChild)
          }
        }
      }
    }

    if (typeof state.onBusyChange === 'function') {
      state.onBusyChange(state.busy)
    }
  }

  function humaniseExclusion (label) {
    var text = String(label || '')
    if (/sssi/i.test(text)) {
      return 'because of SSSI restrictions'
    }
    if (/previous agreement/i.test(text)) {
      return 'because it is already included in a previous agreement'
    }
    if (/habitat|hefer|historic/i.test(text)) {
      return 'because of additional habitat requirements'
    }
    if (/woodland/i.test(text)) {
      return 'because of woodland on this parcel'
    }
    if (/used by your other/i.test(text)) {
      return 'because it is already being used by your other selected actions'
    }
    return 'because ' + text.charAt(0).toLowerCase() + text.slice(1)
  }

  function formatAvailableHint (available, unit) {
    // Pond count is user-declared — never show an available quantity
    if (unit === 'pond') {
      return ''
    }
    var amount = Number(available)
    if (unit === 'm') {
      var metres = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
      return metres.toLocaleString('en-GB') + ' metres available'
    }
    if (unit === 'm²') {
      var sq = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
      return sq.toLocaleString('en-GB') + ' square metres available'
    }
    var ha = Number.isFinite(amount) ? Math.max(0, amount) : 0
    return ha.toFixed(4) + ' hectares available'
  }

  function buildUnavailableReason (action) {
    if (action.hardConflict) {
      return 'This action cannot be used with ' + action.hardConflict + ' on the same land parcel.'
    }
    // Stacking / base-cap notes are not "area full" — only genuine exclusive-pool use.
    if (
      action.allocationNote &&
      /Used by your other selected actions/i.test(action.allocationNote.label || '')
    ) {
      return 'All available area on land parcel used'
    }
    if (/already being used by your other/i.test(action.summaryReason || '')) {
      return 'All available area on land parcel used'
    }
    return action.summaryReason || 'All available area on land parcel used'
  }

  function buildHintText (action) {
    // Match default (AAC off) quantity copy: "X metres available" / "X.XXXX hectares available"
    // Pond actions intentionally have no available-quantity hint.
    // Use maxAvailable (capacity before this action's own entry), not remaining after it —
    // otherwise entering the full amount wrongly reads as "0 available".
    if (!action || action.unit === 'pond') {
      return ''
    }
    var amount = action.status === 'unavailable' ? 0 : action.maxAvailable
    return formatAvailableHint(amount, action.unit)
  }

  function clearAacExtras (conditional) {
    if (!conditional) {
      return
    }
    Array.prototype.forEach.call(conditional.querySelectorAll('[data-aac-extra]'), function (el) {
      el.remove()
    })
  }

  function clearAacDisable (checkbox, item) {
    if (!checkbox) {
      return
    }
    // When AAC says an action is available, clear matrix / area locks left over
    // from the non-AAC path (common on first load before AAC fully owns the UI).
    var disabledReason = checkbox.getAttribute('data-disabled-reason')
    if (
      disabledReason === 'aac' ||
      disabledReason === 'compatibility' ||
      disabledReason === 'area-full'
    ) {
      checkbox.disabled = false
      checkbox.removeAttribute('disabled')
      checkbox.removeAttribute('aria-disabled')
      checkbox.removeAttribute('data-disabled-reason')
    }
    if (item) {
      item.removeAttribute('data-aac-hidden')
      item.style.display = ''
      item.classList.remove('sfi-compatibility-disabled')
      item.style.opacity = ''
      var label = item.querySelector('.govuk-checkboxes__label')
      if (label) {
        Array.prototype.forEach.call(
          label.querySelectorAll('.aac-unavailable-hint, .compatibility-hint, .sfi-compatibility-option-hint, .area-full-hint'),
          function (el) {
            el.remove()
          }
        )
      }
    }
  }

  function applyDebug (conditional, action) {
    clearAacExtras(conditional)
    if (!state.debug || !conditional) {
      return
    }
    var pre = document.createElement('pre')
    pre.className = 'app-aac-debug'
    pre.setAttribute('data-aac-extra', 'debug')
    pre.setAttribute('aria-label', 'Calculation debug')
    pre.textContent = action.debugLines.join('\n')
    conditional.appendChild(pre)
  }

  function syncSelectionsFromDom () {
    state.selections = {}
    Array.prototype.forEach.call(document.querySelectorAll('input[name="actions"]:checked'), function (checkbox) {
      var code = checkbox.value
      var quantityInput = getActionQuantityInput(code)
      var raw = quantityInput ? String(quantityInput.value || '').trim() : ''
      // Accept pasted en-GB values such as "1,071"
      var normalised = raw.replace(/,/g, '').replace(/\s/g, '')
      var value = Number(normalised)
      if (Number.isFinite(value) && value > 0) {
        state.selections[code] = value
      }
      // Checked with no quantity: do not treat as a committed selection for
      // hard conflicts or shared-area deductions (AAC). Compatibility mode
      // (AAC off) still greys on checkbox via its own matrix path.
    })
  }

  function applyToCheckboxes (calculation) {
    if (!state.enabled) {
      return calculation
    }

    var byCode = {}
    ;(calculation.actions || []).forEach(function (action) {
      byCode[action.code] = action
    })

    Array.prototype.forEach.call(document.querySelectorAll('input[name="actions"]'), function (checkbox) {
      var code = checkbox.value
      var item = checkbox.closest('.govuk-checkboxes__item')
      var conditional = getActionConditional(code)
      var hint = getActionHint(code)
      var quantityInput = getActionQuantityInput(code)
      var label = item && item.querySelector('.govuk-checkboxes__label')
      var action = byCode[code]
      var selected = checkbox.checked

      if (!item) {
        return
      }

      // Actions outside the AAC set keep their existing parcel / land-cover visibility
      if (!action) {
        clearAacDisable(checkbox, item)
        clearAacExtras(conditional)
        return
      }

      // Do not override land-cover filtering — only disable when area is 0 / policy conflict.
      // Keep an action enabled only if the user has entered a quantity on it (so they can reduce it).
      // A bare tick with no quantity and no remaining land should grey out / uncheck.
      var shouldDisable = action.status === 'unavailable' && !(selected && action.selectedQuantity > 0)

      if (label) {
        Array.prototype.forEach.call(label.querySelectorAll('.aac-unavailable-hint'), function (el) {
          el.remove()
        })
      }

      if (shouldDisable) {
        checkbox.checked = false
        checkbox.disabled = true
        checkbox.setAttribute('disabled', 'disabled')
        checkbox.setAttribute('aria-disabled', 'true')
        checkbox.setAttribute('data-disabled-reason', 'aac')
        checkbox.setAttribute('aria-expanded', 'false')
        if (item) {
          item.classList.add('sfi-compatibility-disabled')
        }
        if (conditional) {
          conditional.classList.add('govuk-checkboxes__conditional--hidden')
        }
        if (quantityInput) {
          quantityInput.value = ''
          quantityInput.disabled = true
        }
        if (hint) {
          hint.textContent = buildHintText(action)
          if (action.unit === 'pond') {
            hint.hidden = true
          } else {
            hint.hidden = false
          }
        }
        if (label) {
          var unavailableHint = document.createElement('span')
          unavailableHint.className = 'aac-unavailable-hint'
          unavailableHint.style.display = 'block'
          unavailableHint.style.fontSize = '16px'
          unavailableHint.style.color = '#505a5f'
          unavailableHint.style.fontWeight = 'normal'
          unavailableHint.style.marginTop = '5px'
          unavailableHint.textContent = buildUnavailableReason(action)
          label.appendChild(unavailableHint)
        }
        clearAacExtras(conditional)
        return
      }

      clearAacDisable(checkbox, item)
      if (quantityInput && !state.busy) {
        quantityInput.disabled = false
      }

      if (hint) {
        hint.textContent = buildHintText(action)
        if (action.unit === 'pond') {
          hint.hidden = true
        } else {
          hint.hidden = false
        }
      }

      applyDebug(conditional, action)
    })

    return calculation
  }

  function clearAacVisibility () {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="actions"]'), function (checkbox) {
      var item = checkbox.closest('.govuk-checkboxes__item')
      var conditional = getActionConditional(checkbox.value)
      var quantityInput = getActionQuantityInput(checkbox.value)
      clearAacDisable(checkbox, item)
      if (quantityInput && checkbox.getAttribute('data-disabled-reason') !== 'previous-agreement-area') {
        quantityInput.disabled = false
      }
      clearAacExtras(conditional)
    })
    Array.prototype.forEach.call(document.querySelectorAll('[data-aac-spinner], [data-aac-updating]'), function (el) {
      el.remove()
    })
  }

  function render () {
    if (!state.enabled || !state.parcelId) {
      return null
    }
    syncSelectionsFromDom()
    var calculation = recalculate()
    applyToCheckboxes(calculation)
    return calculation
  }

  function runUpdate (editedCode) {
    if (!state.enabled) {
      return Promise.resolve(null)
    }

    if (state.timerId !== null) {
      window.clearTimeout(state.timerId)
      state.timerId = null
    }
    state.requestId += 1
    var requestId = state.requestId

    syncSelectionsFromDom()
    setBusy(true, editedCode)

    return new Promise(function (resolve) {
      state.timerId = window.setTimeout(function () {
        state.timerId = null
        if (requestId !== state.requestId) {
          resolve(null)
          return
        }
        setBusy(false, null)
        var calculation = render()
        if (typeof state.onAfterRecalculate === 'function') {
          state.onAfterRecalculate(calculation)
        }
        resolve(calculation)
      }, DEFAULT_DELAY_MS)
    })
  }

  function setEnabled (enabled) {
    state.enabled = Boolean(enabled)
    if (!state.enabled) {
      if (state.timerId !== null) {
        window.clearTimeout(state.timerId)
        state.timerId = null
      }
      setBusy(false, null)
      clearAacVisibility()
      return state.enabled
    }
    if (state.parcelId) {
      render()
    }
    return state.enabled
  }

  function setDebug (enabled) {
    state.debug = Boolean(enabled)
    if (state.enabled && state.parcelId) {
      render()
    }
    return state.debug
  }

  function setParcel (parcelId, parcel, actionCodes, options) {
    options = options || {}
    var nextParcelId = parcelId || null
    var parcelChanged = state.parcelId !== nextParcelId

    state.parcelId = nextParcelId
    state.parcel = parcel || null
    state.actions = Array.isArray(actionCodes) && actionCodes.length
      ? actionCodes.slice()
      : getMvpCodes()

    if (parcelChanged || options.resetSelections) {
      state.selections = {}
    }

    if (state.enabled && state.parcelId) {
      render()
    } else if (!state.enabled) {
      clearAacVisibility()
    }
  }

  function setSelections (selections) {
    state.selections = {}
    if (selections && typeof selections === 'object') {
      Object.keys(selections).forEach(function (code) {
        var value = Number(selections[code])
        if (Number.isFinite(value) && value > 0) {
          state.selections[code] = value
        }
      })
    }
    if (state.enabled && state.parcelId) {
      // Mirror into checkboxes if present, then apply visibility
      Object.keys(state.selections).forEach(function (code) {
        var checkbox = getActionCheckbox(code)
        var quantityInput = getActionQuantityInput(code)
        var conditional = getActionConditional(code)
        if (checkbox) {
          checkbox.checked = true
          checkbox.setAttribute('aria-expanded', 'true')
        }
        if (quantityInput) {
          quantityInput.value = String(state.selections[code])
        }
        if (conditional) {
          conditional.classList.remove('govuk-checkboxes__conditional--hidden')
        }
      })
      render()
    }
  }

  function getSelectionsForSave () {
    syncSelectionsFromDom()
    var calculation = recalculate()
    return calculation.actions
      .filter(function (action) {
        return action.selectedQuantity > 0
      })
      .map(function (action) {
        return {
          code: action.code,
          name: action.name,
          quantity: String(action.selectedQuantity),
          unit: action.unit
        }
      })
  }

  function init (options) {
    options = options || {}
    if (typeof options.enabled === 'boolean') {
      state.enabled = options.enabled
    }
    if (typeof options.debug === 'boolean') {
      state.debug = options.debug
    }
    if (options.incompatibleByCode) {
      state.incompatibleByCode = options.incompatibleByCode
    }
    if (typeof options.onBusyChange === 'function') {
      state.onBusyChange = options.onBusyChange
    }
    if (typeof options.onAfterRecalculate === 'function') {
      state.onAfterRecalculate = options.onAfterRecalculate
    }
    if (typeof options.getContinueButton === 'function') {
      state.getContinueButton = options.getContinueButton
    }
    if (!state.enabled) {
      clearAacVisibility()
    }
    return api
  }

  var api = {
    init: init,
    setEnabled: setEnabled,
    setDebug: setDebug,
    setParcel: setParcel,
    setSelections: setSelections,
    render: render,
    recalculate: recalculate,
    runUpdate: runUpdate,
    syncSelectionsFromDom: syncSelectionsFromDom,
    applyToCheckboxes: applyToCheckboxes,
    getSelectionsForSave: getSelectionsForSave,
    getParcelAreaBreakdown: getParcelAreaBreakdown,
    isEnabled: function () {
      return state.enabled
    },
    isBusy: function () {
      return state.busy
    },
    isDebugEnabled: function () {
      return state.debug
    }
  }

  window.GrasslandsV2Aac = api
})(window)
