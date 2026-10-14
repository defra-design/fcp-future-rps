// Select land parcels (actions first) — loaded by app/views/sfi-grasslands-v4b/select-parcels.html
// Uses SfiGrasslandsV4bAac for available amounts and the same compatibility
// matrix as v4a. Draws the results into the server-rendered action blocks.
(function () {
  'use strict'

  var aac = window.SfiGrasslandsV4bAac
  var config = readJson('v4b-parcel-json')
  if (!aac || !config || !config.parcelId) {
    return
  }

  var SUPPLEMENT_BASE = 'CLIG3'
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

  function readSelections () {
    var selections = {}
    codes.forEach(function (code) {
      var input = getInput(code)
      if (!input || isExcludedFromPool(code)) {
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
    var unavailable = needsBase || (result.status === 'unavailable' && result.selectedQuantity <= 0)
    // Only explain when something limits the action; the available amount covers the rest
    var reason = ''
    if (needsBase) {
      reason = 'Select ' + meta.supplementOf + ' to use this supplement.'
    } else if (result.hardConflict) {
      reason = result.summaryReason
    } else if (unavailable) {
      reason = result.summaryReason
    } else if (result.allocationNote && result.allocationNote.label) {
      reason = result.allocationNote.label + '.'
    }

    if (unavailable) {
      availableEl.textContent = 'Not available on this parcel'
    } else if (!Number.isFinite(result.available)) {
      availableEl.textContent = 'Enter the number of eligible ponds'
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

    var exclusions = (result.exclusions || []).filter(function (exclusion) {
      return Number(exclusion.amount) > 0 && exclusion.featureKey !== 'existingAgreement'
    })
    exclusionsEl.innerHTML = exclusions.map(function (exclusion) {
      return '<li>' + escapeHtml(describeExclusion(exclusion)) + '</li>'
    }).join('')
    exclusionsEl.hidden = exclusions.length === 0

    block.classList.toggle('app-v4b-action--unavailable', unavailable)
    // Keep a filled field editable so a conflict or unavailable action can be cleared
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
      var input = getInput(code)
      if (block) {
        block.hidden = Boolean(notAvailable[code]) && !(input && input.value.trim())
      }
    })
  }

  function clearUpdatingMessage () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-v4b-updating]'), function (el) {
      el.remove()
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
  }

  function update () {
    clearUpdatingMessage()
    var notAvailable = findNotAvailableOnParcel()
    var selections = readSelections()
    aac.setSelections(selections)
    var calculation = aac.recalculate()
    var resultsByCode = {}
    calculation.actions.forEach(function (result) {
      resultsByCode[result.code] = result
    })
    calculation.actions.forEach(function (result) {
      renderAction(result, selections, resultsByCode)
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
    var selections = readSelections()
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

  document.addEventListener('input', function (event) {
    if (event.target.matches('[data-v4b-quantity]')) {
      scheduleUpdate(event.target.getAttribute('data-v4b-quantity'))
    }
  })

  // Prototype toggles (existing agreements, deductions) change the numbers
  document.addEventListener('change', function (event) {
    if (event.target.closest('#prototype-toggles')) {
      update()
    }
  })

  function focusFromHash () {
    var hash = window.location.hash
    if (hash !== '#selected-parcel' && !/^#v4b-action-/.test(hash)) {
      return
    }
    var target = document.querySelector(hash)
    var focusTarget = target && target.querySelector('input:not([type="hidden"]):not([disabled])')
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
