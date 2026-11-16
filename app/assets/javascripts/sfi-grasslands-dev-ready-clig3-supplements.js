/**
 * dev-ready: "Add a supplement to CLIG3 (optional)" (12 November 2026)
 *
 * GRH7 and GRH8 take part of the CLIG3 area on the land parcel and share it between them,
 * each with its own quantity box. GRH10 is not part of that pool: it always covers the whole
 * CLIG3 area (12 November 2026), so it neither takes area from the other two nor is limited
 * by them.
 *
 * Prototype only: the setTimeout stands in for a real availability API, matching the
 * "updating" pattern on the actions page (showUpdating -> recalculate -> apply).
 */
(function () {
  // Matches the actions page: wait 1600ms after the last keystroke, then show the spinner
  // while the (simulated) availability call runs.
  var QUANTITY_DEBOUNCE_MS = 1600
  var UPDATE_DELAY_MS = 700

  var form = document.querySelector('[data-clig3-supplements-form]')
  if (!form) {
    return
  }

  var clig3Ha = Number(form.getAttribute('data-clig3-area'))
  if (!Number.isFinite(clig3Ha)) {
    clig3Ha = 0
  }

  var checkboxes = Array.prototype.slice.call(form.querySelectorAll('[data-supplement]'))
  var updateTimer = null
  var debounceTimer = null

  function round4 (value) {
    return Math.round(Number(value) * 10000) / 10000
  }

  function format (value) {
    return round4(Math.max(0, value)).toFixed(4)
  }

  function quantityInput (code) {
    return form.querySelector('[data-supplement-quantity="' + code + '"]')
  }

  function isTicked (code) {
    var box = form.querySelector('[data-supplement="' + code + '"]')
    return Boolean(box && box.checked)
  }

  function isWholeRemaining (box) {
    return box.getAttribute('data-whole-remaining-area') === 'true'
  }

  // What the actions with a box have taken between them
  function partTotal (exceptCode) {
    var total = 0
    checkboxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      if (isWholeRemaining(box) || code === exceptCode || !box.checked) {
        return
      }
      var input = quantityInput(code)
      var value = input ? Number(String(input.value).replace(/,/g, '').trim()) : 0
      if (Number.isFinite(value) && value > 0) {
        total += value
      }
    })
    return round4(total)
  }

  function showUpdating (code) {
    var messages = form.querySelector('[data-supplement-messages="' + code + '"]')
    if (!messages || messages.querySelector('[data-supplement-updating]')) {
      return
    }
    var updating = document.createElement('div')
    updating.className = 'app-aac-updating govuk-!-margin-bottom-2'
    updating.setAttribute('data-supplement-updating', '')
    updating.setAttribute('role', 'status')
    updating.setAttribute('aria-live', 'polite')
    updating.innerHTML =
      '<span class="actions-compatibility-status__spinner" aria-hidden="true"></span>' +
      '<p class="govuk-body-s govuk-!-margin-bottom-0">Updating available area for this supplement…</p>'
    messages.appendChild(updating)
  }

  function clearUpdating () {
    Array.prototype.slice.call(form.querySelectorAll('[data-supplement-updating]'))
      .forEach(function (el) { el.parentNode.removeChild(el) })
  }

  function apply () {
    clearUpdating()
    // What is left of the CLIG3 area for GRH7 and GRH8 once every entered quantity is taken
    // off, including the field's own — the same as the available hints on the actions page
    var remaining = Math.max(0, round4(clig3Ha - partTotal(null)))

    checkboxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      var hint = form.querySelector('[data-available-hint="' + code + '"]')
      // GRH10 always covers the whole CLIG3 area, whatever the others have taken
      if (isWholeRemaining(box)) {
        var amount = form.querySelector('[data-remaining-amount="' + code + '"]')
        if (amount) {
          amount.textContent = format(clig3Ha)
        }
        if (hint) {
          hint.textContent = box.checked
            ? 'Applied to ' + format(clig3Ha) + ' hectares'
            : format(clig3Ha) + ' hectares available'
        }
        return
      }
      if (hint) {
        hint.textContent = format(remaining) + ' hectares available'
      }
    })

    lockFullSupplements(remaining)
  }

  // Same as the actions page: when GRH7 and GRH8 have used the CLIG3 area between them, the
  // one you have not ticked is disabled and says why, rather than letting you tick it and
  // fail on save. A ticked supplement always stays interactive so you can free the area up
  // again, and GRH10 is never locked because it does not draw on that area.
  function lockFullSupplements (remaining) {
    var anyPartTicked = checkboxes.some(function (box) {
      return !isWholeRemaining(box) && box.checked
    })
    var noAreaLeft = anyPartTicked && remaining <= 0

    checkboxes.forEach(function (box) {
      var label = form.querySelector('label[for="' + box.id + '"]')
      var existingHint = label && label.querySelector('.area-full-hint')

      if (noAreaLeft && !box.checked && !isWholeRemaining(box)) {
        box.disabled = true
        box.setAttribute('data-disabled-reason', 'area-full')
        box.setAttribute('aria-disabled', 'true')
        if (label && !existingHint) {
          var note = document.createElement('span')
          note.className = 'area-full-hint'
          note.setAttribute('style', 'display: block; font-size: 16px; color: #505a5f; font-weight: normal; margin-top: 5px;')
          note.textContent = 'All available area on land parcel used'
          label.appendChild(note)
        }
        return
      }

      if (box.getAttribute('data-disabled-reason') === 'area-full' || box.disabled) {
        box.disabled = false
        box.removeAttribute('data-disabled-reason')
        box.removeAttribute('aria-disabled')
      }
      if (existingHint) {
        existingHint.parentNode.removeChild(existingHint)
      }
    })
  }

  // The spinner is only for a change that moves area between the supplements. Ticking an empty
  // box takes nothing, so it updates straight away with no spinner (12 November 2026).
  function runUpdate (spinnerCode) {
    window.clearTimeout(updateTimer)
    if (!spinnerCode) {
      apply()
      return
    }
    showUpdating(spinnerCode)
    updateTimer = window.setTimeout(apply, UPDATE_DELAY_MS)
  }

  // While typing: wait after the last keystroke, then run the update (spinner + simulated API),
  // the same as the quantity boxes on the actions page
  function scheduleAfterTyping (code) {
    window.clearTimeout(debounceTimer)
    window.clearTimeout(updateTimer)
    clearUpdating()
    debounceTimer = window.setTimeout(function () {
      runUpdate(code)
    }, QUANTITY_DEBOUNCE_MS)
  }

  checkboxes.forEach(function (box) {
    var code = box.getAttribute('data-supplement')
    box.addEventListener('change', function () {
      var input = quantityInput(code)
      var hadQuantity = Boolean(input && Number(String(input.value).replace(/,/g, '').trim()) > 0)
      // Unticking gives its area back to the others
      if (!box.checked && input) {
        input.value = ''
      }
      window.clearTimeout(debounceTimer)
      runUpdate(hadQuantity ? code : null)
    })
    var input = quantityInput(code)
    if (input) {
      input.addEventListener('input', function () { scheduleAfterTyping(code) })
    }
  })

  apply()
}())
