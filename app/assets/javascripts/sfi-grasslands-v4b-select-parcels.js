// Select land parcels (actions first) — loaded by app/views/sfi-grasslands-v4b/select-parcels.html
// Uses SfiGrasslandsV4bAac for available amounts and the same compatibility
// matrix as v4a. Draws the results into the server-rendered action blocks.
(function () {
  'use strict'

  // Run again each time a parcel is swapped in: remove the last run's listeners and timers first
  if (typeof window.__v4bSelectParcelsTeardown === 'function') {
    window.__v4bSelectParcelsTeardown()
    window.__v4bSelectParcelsTeardown = null
  }

  var aac = window.SfiGrasslandsV4bAac
  var config = readJson('v4b-parcel-json')
  if (!aac || !config || !config.parcelId) {
    return
  }

  var SUPPLEMENT_BASE = 'CLIG3'

  // How CLIG3 (which takes all the remaining land) treats other land actions:
  //   true  - CLIG3 gives way: other land actions stay available, and CLIG3 gets smaller
  //           when one is added (idea 6)
  //   false - as in v4a: other land actions go to 0 and are unavailable until CLIG3 is
  //           deselected (idea 5 explains this in the CLIG3 panel)
  var CLIG3_GIVES_WAY = false
  var WHOLE_AREA_NOTE = CLIG3_GIVES_WAY
    ? 'It gets smaller if you add other land actions to this land parcel.'
    : 'Other land actions on this land parcel are now unavailable. To add one, deselect CLIG3 first.'
  // Same pause as v3 before AAC recalculates available land
  var DEBOUNCE_MS = 1600
  var metaByCode = {}
  var codes = []
  config.actions.forEach(function (action) {
    metaByCode[action.code] = action
    codes.push(action.code)
  })

  var debounceTimer = null
  var lastEditedCode = null

  function readJson (id) {
    var el = document.getElementById(id)
    if (!el) {
      return null
    }
    try {
      return JSON.parse(el.textContent || 'null')
    } catch (error) {
      return null
    }
  }

  function getBlock (code) {
    return document.getElementById('v4b-action-' + code)
  }

  function getInput (code) {
    return document.getElementById('v4bQuantity-' + code)
  }

  function getCheckbox (code) {
    return document.getElementById('v4bSelected-' + code)
  }

  function getConditional (code) {
    return document.getElementById('v4b-conditional-' + code)
  }

  // Ticked, and for a supplement its base action is ticked too
  function isTicked (code) {
    var checkbox = getCheckbox(code)
    if (!checkbox || !checkbox.checked) {
      return false
    }
    var meta = metaByCode[code]
    if (meta && meta.supplementOf && metaByCode[meta.supplementOf]) {
      return isTicked(meta.supplementOf)
    }
    return true
  }

  function parseQuantity (value) {
    var number = Number(String(value || '').replace(/,/g, '').replace(/\s/g, '').trim())
    return Number.isFinite(number) && number > 0 ? number : 0
  }

  function formatAmount (value, unit) {
    if (unit === 'ha') {
      return Number(value).toFixed(4) + ' hectares'
    }
    var whole = Math.round(Number(value))
    var labels = { m: ['metre', 'metres'], 'm²': ['square metre', 'square metres'], pond: ['pond', 'ponds'] }
    var label = labels[unit] || [unit, unit]
    return whole.toLocaleString('en-GB') + ' ' + (whole === 1 ? label[0] : label[1])
  }

  function formatMoney (value) {
    return '£' + Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function yearlyPayment (meta, quantity) {
    var amount = meta.unit === 'm' ? (quantity / 100) * meta.rate : quantity * meta.rate
    return Math.round(amount * 100) / 100
  }

  // includeWholeArea false leaves out CLIG3 (and its supplements), so other actions
  // are worked out as if CLIG3 were not there: CLIG3 only takes what they leave
  function readSelections (includeWholeArea) {
    var selections = {}
    codes.forEach(function (code) {
      var input = getInput(code)
      var meta = metaByCode[code]
      // Ticking alone takes no land. Only a ticked action with a quantity counts.
      if (!input || !isTicked(code) || isExcludedFromPool(code)) {
        return
      }
      if (includeWholeArea === false && meta &&
          (meta.wholeRemainingArea || (meta.supplementOf && metaByCode[meta.supplementOf] && metaByCode[meta.supplementOf].wholeRemainingArea))) {
        return
      }
      var quantity = parseQuantity(input.value)
      if (quantity > 0) {
        selections[code] = quantity
      }
    })
    return selections
  }

  var excludedFromPool = {}

  function isExcludedFromPool (code) {
    return Boolean(excludedFromPool[code])
  }

  function normaliseQuantity (raw) {
    return String(raw || '').replace(/,/g, '').replace(/\s/g, '').trim()
  }

  function formatErrorMessage (unit) {
    if (unit === 'pond') {
      return 'Enter number of ponds – for example, 2'
    }
    if (unit === 'm') {
      return 'Enter number of metres, rounded down to the nearest metre – for example, 234'
    }
    if (unit === 'm²') {
      return 'Enter number of square metres, rounded down to the nearest whole number – for example, 234'
    }
    return 'Enter number of hectares, up to 4 decimal places – for example, 12.3456'
  }

  function overLimitMessage (unit) {
    if (unit === 'm') {
      return 'Enter a number that is not higher than the available metres'
    }
    if (unit === 'm²') {
      return 'Enter a number that is not higher than the available square metres'
    }
    return 'Enter a number that is not higher than the available hectares'
  }

  // Letters or 0 — show straight away, as in v3. Incomplete numbers wait for the pause.
  function isClearlyInvalid (raw) {
    var value = normaliseQuantity(raw)
    if (!value) {
      return false
    }
    if (/[^\d.]/.test(value)) {
      return true
    }
    var number = Number(value)
    return Number.isFinite(number) && number <= 0
  }

  function getFormatError (code, raw) {
    var meta = metaByCode[code]
    var value = normaliseQuantity(raw)
    if (!meta || !value) {
      return null
    }
    if (meta.unit === 'ha') {
      if (!/^\d+\.\d{4}$/.test(value) || Number(value) <= 0) {
        return formatErrorMessage(meta.unit)
      }
      return null
    }
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      return formatErrorMessage(meta.unit)
    }
    return null
  }

  function describeExclusion (exclusion) {
    var amount = formatAmount(exclusion.amount, exclusion.unit || 'ha')
    if (exclusion.featureKey === 'landCover') {
      return amount + ' is ' + exclusion.label.toLowerCase() + ', which is not eligible for this action'
    }
    return amount + ' is excluded because of ' + exclusion.label + (exclusion.detail ? ' (' + exclusion.detail + ')' : '')
  }

  function setFieldError (code, message) {
    var input = getInput(code)
    if (!input) {
      return
    }
    var group = input.closest('.govuk-form-group')
    var errorId = input.id + '-client-error'
    var existing = document.getElementById(errorId)

    if (!message) {
      if (existing) {
        existing.remove()
        if (!group.querySelector('.govuk-error-message')) {
          group.classList.remove('govuk-form-group--error')
          input.classList.remove('govuk-input--error')
        }
        removeDescribedBy(input, errorId)
      }
      return
    }

    // Replace any error from the last submit so only one message shows
    Array.prototype.forEach.call(group.querySelectorAll('.govuk-error-message:not([data-v4b-client-error])'), function (serverError) {
      removeDescribedBy(input, serverError.id)
      serverError.remove()
    })

    if (!existing) {
      existing = document.createElement('p')
      existing.id = errorId
      existing.className = 'govuk-error-message'
      existing.setAttribute('data-v4b-client-error', '')
      var label = group.querySelector('label') || group.querySelector('.govuk-label')
      if (label) {
        label.insertAdjacentElement('afterend', existing)
      } else {
        group.insertBefore(existing, group.firstChild)
      }
      addDescribedBy(input, errorId)
    }
    existing.innerHTML = '<span class="govuk-visually-hidden">Error:</span> ' + escapeHtml(message)
    group.classList.add('govuk-form-group--error')
    input.classList.add('govuk-input--error')
  }

  function addDescribedBy (input, id) {
    var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
    if (ids.indexOf(id) === -1) {
      ids.push(id)
    }
    input.setAttribute('aria-describedby', ids.join(' '))
  }

  function removeDescribedBy (input, id) {
    var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (value) {
      return value && value !== id
    })
    input.setAttribute('aria-describedby', ids.join(' '))
  }

  function escapeHtml (text) {
    var div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function getQuantityError (result, meta, selections) {
    var input = getInput(result.code)
    var raw = input ? input.value : ''
    var checkingThisField = result.code === lastEditedCode

    if (checkingThisField) {
      var formatError = getFormatError(result.code, raw)
      if (formatError) {
        return formatError
      }
    }

    var quantity = parseQuantity(raw)
    if (!(quantity > 0) || meta.unit === 'pond') {
      return null
    }

    // A figure that is too high does not take land, so compare it with what is left for others
    if (checkingThisField && Number.isFinite(result.maxAvailable) && quantity > result.maxAvailable + 0.00005) {
      var message = overLimitMessage(result.unit)
      if (result.limitedAreaCapped) {
        message += '. CIGL1 and CIGL2 together can only use 25% of your total farm area'
      }
      return message
    }

    if (isExcludedFromPool(result.code)) {
      return null
    }
    if (result.hardConflict) {
      return result.code + ' cannot be used with ' + result.hardConflict + ' on the same land parcel. Remove one of them.'
    }
    if (meta.supplementOf && !selections[meta.supplementOf]) {
      return 'Enter a quantity for ' + meta.supplementOf + ' to add ' + result.code
    }
    return null
  }

  function renderAction (result, selections, resultsByCode) {
    var code = result.code
    var meta = metaByCode[code]
    var block = getBlock(code)
    var input = getInput(code)
    if (!meta || !block || !input) {
      return 0
    }

    var availableEl = block.querySelector('[data-v4b-available]')
    var paymentEl = block.querySelector('[data-v4b-payment]')
    var reasonEl = block.querySelector('[data-v4b-reason]')
    var exclusionsEl = block.querySelector('[data-v4b-exclusions]')
    var maxEl = block.querySelector('[data-v4b-max]')
    var unavailableEl = block.querySelector('[data-v4b-unavailable]')

    var needsBase = meta.supplementOf && !metaByCode[meta.supplementOf]
    // Ponds are never limited by the AAC, so other actions cannot use them up
    var unavailable = needsBase || (meta.unit !== 'pond' && result.status === 'unavailable' && result.selectedQuantity <= 0)
    // Only explain when something limits the action; the available amount covers the rest
    var reason = ''
    if (needsBase) {
      reason = 'Select ' + meta.supplementOf + ' to use this supplement.'
    } else if (result.hardConflict) {
      reason = result.summaryReason
    } else if (unavailable) {
      reason = result.summaryReason
    }

    // Ponds are counted by the farmer, not by the AAC, so there is no available amount to show (as in v4a)
    availableEl.hidden = meta.unit === 'pond'
    if (meta.unit === 'pond') {
      availableEl.textContent = ''
    } else if (meta.wholeRemainingArea && Number.isFinite(wholeAreaPool[code])) {
      // CLIG3 takes all the land left, so show that amount rather than 0 once it is ticked
      availableEl.textContent = formatAmount(wholeAreaPool[code], result.unit) + ' available'
    } else if (unavailable && !needsBase && Number.isFinite(result.available)) {
      // Land used up by other actions (CLIG3 takes all that is left): show 0, as in v4a
      availableEl.textContent = formatAmount(Math.max(0, result.available), result.unit) + ' available'
    } else if (unavailable) {
      availableEl.textContent = 'Not available on this parcel'
    } else if (!Number.isFinite(result.available)) {
      availableEl.textContent = 'Enter the number of eligible ponds'
    } else if (meta.fullBaseArea) {
      availableEl.textContent = 'Covers all the ' + meta.supplementOf + ' area on this land parcel'
    } else if (meta.supplementOf && Number.isFinite(wholeAreaPool[meta.supplementOf])) {
      // GRH7 and GRH8 sit on the CLIG3 land: what is left after the quantity in this box
      var ownQuantity = selections[code] || 0
      availableEl.textContent = formatAmount(
        Math.max(0, Math.round((wholeAreaPool[meta.supplementOf] - ownQuantity) * 10000) / 10000),
        result.unit
      ) + ' available'
    } else if (meta.supplementOf && resultsByCode[meta.supplementOf]) {
      // Same land left as the base action. The supplement sits on that land.
      var baseRemaining = resultsByCode[meta.supplementOf].available
      availableEl.textContent = formatAmount(
        Number.isFinite(baseRemaining) ? baseRemaining : result.available,
        result.unit
      ) + ' available'
    } else {
      // Remaining after the quantity in this box, same as version 4a
      availableEl.textContent = formatAmount(result.available, result.unit) + ' available'
    }
    reasonEl.textContent = reason
    reasonEl.hidden = !reason

    // v4b does not list land exclusions (HEFER, SSSI, land cover) under each action
    var exclusions = []
    exclusionsEl.innerHTML = exclusions.map(function (exclusion) {
      return '<li>' + escapeHtml(describeExclusion(exclusion)) + '</li>'
    }).join('')
    exclusionsEl.hidden = exclusions.length === 0

    block.classList.toggle('app-v4b-action--unavailable', unavailable)
    // Keep a ticked or filled action editable so a conflict can be cleared
    var checkbox = getCheckbox(code)
    if (checkbox && document.activeElement !== checkbox) {
      checkbox.disabled = unavailable && !checkbox.checked
    }
    if (document.activeElement !== input) {
      input.disabled = unavailable && !input.value.trim()
    }
    unavailableEl.value = unavailable ? 'true' : ''
    maxEl.value = Number.isFinite(result.maxAvailable)
      ? (result.unit === 'ha' ? Number(result.maxAvailable).toFixed(4) : String(Math.round(result.maxAvailable)))
      : ''

    setFieldError(code, getQuantityError(result, meta, selections))

    var payment = result.selectedQuantity > 0 ? yearlyPayment(meta, result.selectedQuantity) : 0
    if (paymentEl) {
      paymentEl.textContent = formatMoney(payment) + ' a year'
    }
    return payment
  }

  // Ruled out by the parcel itself, before anything is entered. Actions that only become
  // unavailable because of the user's entries stay visible so they can fix them.
  function findNotAvailableOnParcel () {
    aac.setSelections({})
    var notAvailable = {}
    aac.recalculate().actions.forEach(function (result) {
      var meta = metaByCode[result.code]
      if (!meta) {
        return
      }
      var needsBase = meta.supplementOf && !metaByCode[meta.supplementOf]
      if (needsBase || result.status === 'unavailable') {
        notAvailable[result.code] = true
      }
    })
    return notAvailable
  }

  function hideNotAvailable (notAvailable) {
    codes.forEach(function (code) {
      var block = getBlock(code)
      var checkbox = getCheckbox(code)
      if (block) {
        block.hidden = Boolean(notAvailable[code]) && !(checkbox && checkbox.checked)
      }
    })
    // Hide a group with nothing left in it, and drop the line above its first action
    Array.prototype.forEach.call(document.querySelectorAll('[data-v4b-group]'), function (group) {
      var blocks = Array.prototype.filter.call(group.children, function (child) {
        return child.hasAttribute('data-v4b-action')
      })
      var firstVisible = null
      blocks.forEach(function (block) {
        block.classList.remove('app-v4b-action--first-visible')
        if (!block.hidden && !firstVisible) {
          firstVisible = block
        }
      })
      if (firstVisible) {
        firstVisible.classList.add('app-v4b-action--first-visible')
      }
      group.hidden = !firstVisible
    })
  }

  function clearUpdatingMessage () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-v4b-updating]'), function (el) {
      el.remove()
    })
    setBusy(false)
  }

  // As in v4a: while the AAC is updating, lock the other actions and the buttons
  function setBusy (isBusy, editedCode) {
    var container = document.getElementById('v4b-actions-checkboxes')
    if (container) {
      container.setAttribute('aria-busy', isBusy ? 'true' : 'false')
    }
    Array.prototype.forEach.call(document.querySelectorAll('button[name="v4bIntent"]'), function (button) {
      button.disabled = isBusy
    })
    codes.forEach(function (code) {
      [getCheckbox(code), getInput(code)].forEach(function (el) {
        if (!el) {
          return
        }
        if (isBusy && code !== editedCode && !el.disabled) {
          el.disabled = true
          el.setAttribute('data-v4b-busy', '')
        } else if (!isBusy && el.hasAttribute('data-v4b-busy')) {
          el.disabled = false
          el.removeAttribute('data-v4b-busy')
        }
      })
    })
  }

  function showUpdatingMessage (code) {
    clearUpdatingMessage()
    var messages = getBlock(code) && getBlock(code).querySelector('.app-v4b-action__messages')
    if (!messages) {
      return
    }
    var updating = document.createElement('div')
    updating.className = 'app-aac-updating govuk-!-margin-bottom-2'
    updating.setAttribute('data-v4b-updating', '')
    updating.setAttribute('role', 'status')
    updating.setAttribute('aria-live', 'polite')
    updating.innerHTML =
      '<span class="actions-compatibility-status__spinner" aria-hidden="true"></span>' +
      '<p class="govuk-body-s govuk-!-margin-bottom-0">Updating available land for this action…</p>'
    messages.insertBefore(updating, messages.firstChild)
    setBusy(true, code)
  }

  // GRH10 has no box of its own: it always covers the quantity entered for CLIG3
  function syncFullAreaSupplements () {
    codes.forEach(function (code) {
      var meta = metaByCode[code]
      if (!meta || !meta.fullBaseArea) {
        return
      }
      var input = getInput(code)
      var baseInput = getInput(meta.supplementOf)
      var textEl = document.querySelector('[data-v4b-follow-amount="' + code + '"]')
      var baseRaw = baseInput ? normaliseQuantity(baseInput.value) : ''
      var baseValid = baseRaw &&
        isTicked(meta.supplementOf) &&
        !isExcludedFromPool(meta.supplementOf) &&
        !getFormatError(meta.supplementOf, baseRaw)
      if (input) {
        input.value = baseValid && isTicked(code) ? baseRaw : ''
      }
      if (textEl) {
        textEl.innerHTML = baseValid
          ? escapeHtml(Number(baseRaw).toFixed(4)) + ' hectares'
          : 'Select ' + escapeHtml(meta.supplementOf) + ' first'
      }
    })
  }

  var wholeAreaPool = {}

  function isWholeAreaGroup (code) {
    var meta = metaByCode[code]
    if (!meta) {
      return false
    }
    if (meta.wholeRemainingArea) {
      return true
    }
    return Boolean(meta.supplementOf && metaByCode[meta.supplementOf] && metaByCode[meta.supplementOf].wholeRemainingArea)
  }

  // CLIG3 has no box: it takes all the eligible land the other actions leave when it is ticked
  function syncWholeAreaActions (resultsWithoutWholeArea) {
    wholeAreaPool = {}
    resultsWithoutWholeArea.forEach(function (result) {
      var meta = metaByCode[result.code]
      if (!meta || !meta.wholeRemainingArea) {
        return
      }
      var pool = Number(result.maxAvailable)
      if (!Number.isFinite(pool)) {
        pool = Number(result.available)
      }
      pool = Number.isFinite(pool) ? Math.max(0, Math.round(pool * 10000) / 10000) : 0
      wholeAreaPool[result.code] = pool

      var input = getInput(result.code)
      var textEl = document.querySelector('[data-v4b-whole-amount="' + result.code + '"]')
      var ticked = isTicked(result.code)
      if (input) {
        input.value = ticked && pool > 0 ? pool.toFixed(4) : ''
      }
      if (textEl) {
        textEl.innerHTML = pool > 0
          ? pool.toFixed(4) + ' hectares'
          : 'There is no eligible land left for ' + escapeHtml(result.code) + ' on this land parcel'
      }
    })
  }

  function update () {
    clearUpdatingMessage()
    var notAvailable = findNotAvailableOnParcel()

    // 1. Everything except CLIG3 and its supplements
    var selectionsWithout = readSelections(false)
    aac.setSelections(selectionsWithout)
    var withoutWholeArea = aac.recalculate().actions
    syncWholeAreaActions(withoutWholeArea)
    syncFullAreaSupplements()

    // 2. With CLIG3 filled in, for CLIG3 and its supplements
    var selections = readSelections(true)
    aac.setSelections(selections)
    var withWholeArea = aac.recalculate().actions

    // CLIG3 and its supplements always come from the run that includes CLIG3.
    // Other actions come from the run without it when CLIG3 gives way (they ignore it),
    // or from the run with it as in v4a (they show 0 and become unavailable).
    var resultsByCode = {}
    ;(CLIG3_GIVES_WAY ? withoutWholeArea : withWholeArea).forEach(function (result) {
      resultsByCode[result.code] = result
    })
    withWholeArea.forEach(function (result) {
      if (isWholeAreaGroup(result.code)) {
        resultsByCode[result.code] = result
      }
    })
    Array.prototype.forEach.call(document.querySelectorAll('[data-v4b-whole-note]'), function (el) {
      el.textContent = WHOLE_AREA_NOTE
    })
    Object.keys(resultsByCode).forEach(function (code) {
      renderAction(resultsByCode[code], selections, resultsByCode)
    })
    hideNotAvailable(notAvailable)
  }

  // A value over the available amount is an error straight away and does not reduce other actions
  function excludeIfOverLimit (code) {
    var input = getInput(code)
    var meta = metaByCode[code]
    if (!input || !meta || meta.unit === 'pond') {
      excludedFromPool[code] = false
      return false
    }
    excludedFromPool[code] = false
    var quantity = parseQuantity(input.value)
    if (!(quantity > 0)) {
      return false
    }
    var selections = readSelections(CLIG3_GIVES_WAY ? isWholeAreaGroup(code) : true)
    aac.setSelections(selections)
    var result = null
    aac.recalculate().actions.forEach(function (action) {
      if (action.code === code) {
        result = action
      }
    })
    if (result && Number.isFinite(result.maxAvailable) && quantity > result.maxAvailable + 0.00005) {
      excludedFromPool[code] = true
      return true
    }
    return false
  }

  function finishEdit (code) {
    var input = getInput(code)
    if (!input || lastEditedCode !== code) {
      return
    }
    var formatError = getFormatError(code, input.value)
    if (formatError) {
      excludedFromPool[code] = true
      update()
      return
    }
    if (!normaliseQuantity(input.value)) {
      excludedFromPool[code] = false
      update()
      return
    }
    if (excludeIfOverLimit(code)) {
      update()
      return
    }
    // Ponds do not use the AAC, so there is nothing to wait for
    if (metaByCode[code] && metaByCode[code].unit === 'pond') {
      update()
      return
    }
    showUpdatingMessage(code)
    debounceTimer = window.setTimeout(update, 2500)
  }

  function scheduleUpdate (code) {
    lastEditedCode = code
    var input = getInput(code)
    window.clearTimeout(debounceTimer)
    clearUpdatingMessage()
    if (!input) {
      return
    }
    if (isClearlyInvalid(input.value)) {
      excludedFromPool[code] = true
      setFieldError(code, formatErrorMessage(metaByCode[code] && metaByCode[code].unit))
      update()
      lastEditedCode = code
      return
    }
    excludedFromPool[code] = false
    setFieldError(code, null)
    debounceTimer = window.setTimeout(function () {
      finishEdit(code)
    }, DEBOUNCE_MS)
  }

  aac.init({
    enabled: false,
    debug: false,
    // Same as v3: only the CLIG3 supplements cannot be used together.
    // Other actions share the remaining eligible area.
    incompatibleByCode: {
      GRH7: ['GRH8', 'GRH10'],
      GRH8: ['GRH7', 'GRH10'],
      GRH10: ['GRH7', 'GRH8']
    },
    previousAgreementIncompatibleByCode: config.previousAgreementIncompatibleByCode || {}
  })
  aac.setParcel(config.parcelId, {
    totalArea: config.totalArea,
    availableArea: config.availableArea,
    landCover: config.landCover
  }, codes, { resetSelections: true })

  function setRevealed (code, revealed) {
    var checkbox = getCheckbox(code)
    var conditional = getConditional(code)
    if (checkbox) {
      checkbox.checked = revealed
      checkbox.setAttribute('aria-expanded', revealed ? 'true' : 'false')
    }
    if (conditional) {
      conditional.classList.toggle('govuk-checkboxes__conditional--hidden', !revealed)
    }
  }

  // Unticking clears the quantity, so its land goes back to the other actions
  function clearAction (code) {
    var input = getInput(code)
    if (input) {
      input.value = ''
    }
    excludedFromPool[code] = false
    setFieldError(code, null)
  }

  function onTickChange (code) {
    var checkbox = getCheckbox(code)
    if (!checkbox) {
      return
    }
    if (checkbox.checked) {
      var meta = metaByCode[code]
      // CLIG3 and GRH10 fill in straight away, with no "Updating available land" pause
      if (meta && (meta.wholeRemainingArea || meta.fullBaseArea)) {
        update()
      }
      return
    }
    window.clearTimeout(debounceTimer)
    clearUpdatingMessage()
    clearAction(code)
    // Supplements sit inside CLIG3, so they go when CLIG3 is unticked
    if (code === SUPPLEMENT_BASE) {
      codes.forEach(function (other) {
        if (metaByCode[other].supplementOf === SUPPLEMENT_BASE) {
          setRevealed(other, false)
          clearAction(other)
        }
      })
    }
    update()
  }

  function onDocumentChange (event) {
    if (event.target.matches('[data-v4b-select]')) {
      onTickChange(event.target.getAttribute('data-v4b-select'))
    }
    // Prototype toggles (existing agreements, deductions) change the numbers
    if (event.target.closest('#prototype-toggles')) {
      update()
    }
  }

  function onDocumentInput (event) {
    if (event.target.matches('[data-v4b-quantity]')) {
      scheduleUpdate(event.target.getAttribute('data-v4b-quantity'))
    }
  }

  document.addEventListener('change', onDocumentChange)
  document.addEventListener('input', onDocumentInput)

  window.__v4bSelectParcelsTeardown = function () {
    document.removeEventListener('change', onDocumentChange)
    document.removeEventListener('input', onDocumentInput)
    window.clearTimeout(debounceTimer)
  }

  function focusFromHash () {
    var hash = window.location.hash
    if (hash !== '#selected-parcel' && !/^#v4b-action-/.test(hash)) {
      return
    }
    var target = document.querySelector(hash)
    var code = target && target.getAttribute('data-v4b-action')
    // From a Change link, go to the quantity if the action is ticked, otherwise its checkbox
    var focusTarget = code
      ? (isTicked(code) ? getInput(code) : getCheckbox(code))
      : null
    if (focusTarget && focusTarget.disabled) {
      focusTarget = null
    }
    if (focusTarget && hash !== '#selected-parcel') {
      focusTarget.focus()
    } else if (target) {
      target.focus()
    }
  }

  // Feature toggles set their session flags on DOMContentLoaded, so wait for them
  function start () {
    update()
    focusFromHash()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
