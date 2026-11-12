/**
 * dev-ready: "Add a supplement to CLIG3 (optional)" (12 November 2026)
 *
 * The three supplements share the CLIG3 area on the land parcel. GRH7 and GRH8 take part of
 * it and have their own quantity box; GRH10 takes whatever is left, the same way CLIG3 takes
 * the remaining eligible area on the actions page.
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
    // What is left of the CLIG3 area once every entered quantity is taken off, including the
    // field's own — the same as the available hints on the actions page (12 November 2026)
    var remaining = Math.max(0, round4(clig3Ha - partTotal(null)))
    // A ticked whole-remaining supplement (GRH10) has taken that remainder, so there is
    // nothing left for the others. Its own hint shows what it is applied to, the wording the
    // actions page uses for the supplements.
    var wholeTicked = checkboxes.some(function (box) {
      return isWholeRemaining(box) && box.checked
    })

    checkboxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      var hint = form.querySelector('[data-available-hint="' + code + '"]')
      if (isWholeRemaining(box)) {
        var amount = form.querySelector('[data-remaining-amount="' + code + '"]')
        if (amount) {
          amount.textContent = format(remaining)
        }
        if (hint) {
          hint.textContent = box.checked
            ? 'Applied to ' + format(remaining) + ' hectares'
            : format(remaining) + ' hectares available'
        }
        return
      }
      if (hint) {
        hint.textContent = format(wholeTicked ? 0 : remaining) + ' hectares available'
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
