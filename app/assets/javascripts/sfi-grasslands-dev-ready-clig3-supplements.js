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
    checkboxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      var hint = form.querySelector('[data-available-hint="' + code + '"]')
      // Available to this supplement: the CLIG3 area minus what the others have taken
      var available = Math.max(0, round4(clig3Ha - partTotal(code)))
      if (hint) {
        hint.textContent = format(available) + ' hectares available'
      }
      if (isWholeRemaining(box)) {
        var amount = form.querySelector('[data-remaining-amount="' + code + '"]')
        if (amount) {
          amount.textContent = format(available)
        }
      }
    })
  }

  function scheduleUpdate (code) {
    window.clearTimeout(updateTimer)
    if (code) {
      showUpdating(code)
    }
    updateTimer = window.setTimeout(apply, UPDATE_DELAY_MS)
  }

  checkboxes.forEach(function (box) {
    var code = box.getAttribute('data-supplement')
    box.addEventListener('change', function () {
      // Unticking frees up its area straight away
      if (!box.checked) {
        var input = quantityInput(code)
        if (input) {
          input.value = ''
        }
      }
      scheduleUpdate(box.checked ? code : null)
    })
    var input = quantityInput(code)
    if (input) {
      input.addEventListener('input', function () { scheduleUpdate(code) })
    }
  })

  apply()
}())
