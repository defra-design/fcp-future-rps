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
  // The box the total error is shown against: the one just edited, not every box in the sum
  // (19 November 2026, user asked)
  var lastEditedCode = null
  // Codes whose quantity is currently showing an error. Set by showQuantityErrors() before the
  // hints are worked out, because an entry that cannot be saved must not eat anyone else's area.
  var codesInError = {}

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

  // A quantity only counts against the pool if it could actually be saved (19 November 2026,
  // user spotted it): a number over the CLIG3 area is rejected, so counting it drove the
  // available hint to "0.0000 hectares available" and locked the other supplement, while the
  // field beside it said the number was not allowed. Letters, 0 and blanks are ignored the
  // same way. A set of individually valid numbers that overshoot together DOES still count:
  // each one could be saved, and the total message explains the rest.
  function usableQuantity (code) {
    var input = quantityInput(code)
    if (!input) {
      return 0
    }
    var raw = String(input.value).replace(/,/g, '').trim()
    if (!raw) {
      return 0
    }
    var value = Number(raw)
    if (!Number.isFinite(value) || value <= 0 || value > clig3Ha + 0.00005) {
      return 0
    }
    // Rejected for any other reason too - over what is left after the others (19 November 2026,
    // user spotted it): GRH7 showed "29.5500 hectares available" while holding 29.8900 and no
    // error, because GRH8's rejected 12 was still counted against it.
    if (codesInError[code]) {
      return 0
    }
    return value
  }

  // What the actions with a box have taken between them
  function partTotal (exceptCode) {
    var total = 0
    checkboxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      if (isWholeRemaining(box) || code === exceptCode || !box.checked) {
        return
      }
      total += usableQuantity(code)
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
    // Errors first: the hints below depend on which entries are rejected
    showQuantityErrors()
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
      // ALWAYS "X hectares available" (19 November 2026, user asked), where X is the area left
      // in the CLIG3 pool: the same sentence and the same number on every supplement that draws
      // on it, whatever is entered. Entries that cannot be saved are not counted (usableQuantity),
      // so a rejected number never reduces it.
      if (hint) {
        hint.textContent = format(remaining) + ' hectares available'
      }
    })

    lockSupplements(remaining)
  }

  // Two reasons a supplement can be locked, both shown the same way as the actions page: a
  // greyed-out checkbox with a line under the label saying why. A TICKED SUPPLEMENT IS NEVER
  // LOCKED, so there is always a way back out of whichever state you are in.
  //
  //  1. incompatible - GRH10 is the lenient grazing supplement and GRH7/GRH8 are the haymaking
  //     ones, so the land is managed one way or the other (19 November 2026)
  //  2. area-full    - GRH7 and GRH8 share the CLIG3 area and have used it between them
  //
  // The message says what to deselect, not just that the box is unavailable: a disabled control
  // that does not tell you how to get back is the thing that made the CLIG3 lock on the actions
  // page need a sentence of explanation.
  var LOCK_HINT_STYLE = 'display: block; font-size: 16px; color: #505a5f; font-weight: normal; margin-top: 5px;'

  function listCodes (codes) {
    if (codes.length < 2) {
      return codes[0] || ''
    }
    return codes.slice(0, -1).join(', ') + ' and ' + codes[codes.length - 1]
  }

  // "Not compatible with GRH7 and GRH8" states the rule, naming the whole other side whether or
  // not it is ticked (19 November 2026, user's wording). It carried a second sentence saying
  // which supplement to deselect; the user removed it - the ticked boxes are right there and the
  // line above the list already says you can have one side or the other.
  function incompatibleText (otherSideCodes) {
    return 'Not compatible with ' + listCodes(otherSideCodes) + '.'
  }

  function lockReasonFor (box, state) {
    if (box.checked) {
      return null
    }
    if (isExclusive(box) && state.haymakingTicked.length) {
      return {
        reason: 'incompatible',
        text: incompatibleText(state.haymakingCodes)
      }
    }
    if (!isExclusive(box) && state.exclusiveTicked.length) {
      return {
        reason: 'incompatible',
        text: incompatibleText(state.exclusiveCodes)
      }
    }
    if (state.noAreaLeft && !isWholeRemaining(box)) {
      return { reason: 'area-full', text: 'All available area on land parcel used' }
    }
    return null
  }

  // Inline errors on the quantity boxes (19 November 2026, user asked). The page already
  // recalculates the available area as you type, so it also says when the numbers cannot work
  // instead of letting you find out on submit. The wording matches applyClig3Supplements in
  // sfi-grasslands-dev-ready-land-actions.js exactly, so the inline message and the one after
  // a failed submit are the same sentence.
  //
  // FIELD-LEVEL ONLY, NO ERROR SUMMARY: the summary belongs to a submit, and one appearing and
  // disappearing at the top of the page while you type moves the content under your cursor.
  // An EMPTY box is never an inline error either - that is a submit-time message, not something
  // to say to someone who has just ticked a box.
  function quantityFormGroup (input) {
    var group = input.closest ? input.closest('.govuk-form-group') : null
    return group || (input.parentNode && input.parentNode.parentNode)
  }

  function setFieldError (code, message) {
    var input = quantityInput(code)
    if (!input) {
      return
    }
    var group = quantityFormGroup(input)
    var errorId = input.id + '-error'
    var existing = document.getElementById(errorId)

    if (!message) {
      if (group) {
        group.classList.remove('govuk-form-group--error')
      }
      input.classList.remove('govuk-input--error')
      input.removeAttribute('aria-invalid')
      if (existing) {
        existing.parentNode.removeChild(existing)
      }
      return
    }

    if (group) {
      group.classList.add('govuk-form-group--error')
    }
    input.classList.add('govuk-input--error')
    input.setAttribute('aria-invalid', 'true')

    var paragraph = existing
    if (!paragraph) {
      paragraph = document.createElement('p')
      paragraph.className = 'govuk-error-message'
      paragraph.id = errorId
      var wrapper = input.closest ? input.closest('.govuk-input__wrapper') : null
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.insertBefore(paragraph, wrapper)
      } else if (group) {
        group.appendChild(paragraph)
      }
    }
    paragraph.innerHTML = '<span class="govuk-visually-hidden">Error:</span> '
    paragraph.appendChild(document.createTextNode(message))

    var describedBy = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
    if (describedBy.indexOf(errorId) === -1) {
      describedBy.push(errorId)
      input.setAttribute('aria-describedby', describedBy.join(' '))
    }
  }

  // One message per box, in the order the server applies them: the field's own problem first,
  // then the shared one about the total.
  function showQuantityErrors () {
    var partBoxes = checkboxes.filter(function (box) {
      return !isWholeRemaining(box) && box.checked && quantityInput(box.getAttribute('data-supplement'))
    })
    var ownError = {}
    var total = 0
    var anyOwnError = false

    partBoxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      var raw = String(quantityInput(code).value).replace(/,/g, '').trim()
      if (!raw) {
        ownError[code] = null
        return
      }
      var value = Number(raw)
      if (!Number.isFinite(value) || value <= 0) {
        ownError[code] = 'Quantity for ' + code + ' must be a number greater than 0'
        anyOwnError = true
        return
      }
      if (value > clig3Ha + 0.00005) {
        ownError[code] = 'Enter a number that is not higher than ' + clig3Ha.toFixed(4) + ' hectares'
        anyOwnError = true
        return
      }
      ownError[code] = null
      total += value
    })

    var overTotal = !anyOwnError && round4(total) > clig3Ha + 0.00005

    // The same sentence as a single box over the parcel (19 November 2026, user asked), with
    // the headroom LEFT FOR THIS BOX once the other ticked supplements are taken off - the
    // number they have to get under. It used to state the sum and the CLIG3 area and leave the
    // reader to work out the difference.
    function headroomMessage (code) {
      var headroom = Math.max(0, round4(clig3Ha - partTotal(code)))
      return 'Enter a number that is not higher than ' + headroom.toFixed(4) + ' hectares'
    }

    // The total belongs to the whole group, but saying it twice reads as two problems and
    // doubles the page height. It goes on the box just edited: the number the reader is
    // holding in their head, and the one they will change to fix it.
    var tickedPartCodes = partBoxes.map(function (box) { return box.getAttribute('data-supplement') })
    var totalErrorCode = null
    if (overTotal) {
      totalErrorCode = tickedPartCodes.indexOf(lastEditedCode) !== -1
        ? lastEditedCode
        : tickedPartCodes[tickedPartCodes.length - 1]
    }

    codesInError = {}
    checkboxes.forEach(function (box) {
      var code = box.getAttribute('data-supplement')
      if (!quantityInput(code)) {
        return
      }
      if (!box.checked) {
        setFieldError(code, null)
        return
      }
      var message = ownError[code] || (code === totalErrorCode ? headroomMessage(code) : null)
      if (message) {
        codesInError[code] = true
      }
      setFieldError(code, message)
    })
  }

  function lockSupplements (remaining) {
    var anyPartTicked = checkboxes.some(function (box) {
      return !isWholeRemaining(box) && box.checked
    })
    function codesWhere (test) {
      return checkboxes.filter(test).map(function (box) { return box.getAttribute('data-supplement') })
    }
    var state = {
      exclusiveCodes: codesWhere(isExclusive),
      exclusiveTicked: codesWhere(function (box) { return isExclusive(box) && box.checked }),
      haymakingCodes: codesWhere(function (box) { return !isExclusive(box) }),
      haymakingTicked: codesWhere(function (box) { return !isExclusive(box) && box.checked }),
      noAreaLeft: anyPartTicked && remaining <= 0
    }

    checkboxes.forEach(function (box) {
      var label = form.querySelector('label[for="' + box.id + '"]')
      var existingHint = label && label.querySelector('.supplement-lock-hint')
      var lock = lockReasonFor(box, state)

      if (lock) {
        box.disabled = true
        box.setAttribute('data-disabled-reason', lock.reason)
        box.setAttribute('aria-disabled', 'true')
        if (label) {
          var note = existingHint || document.createElement('span')
          note.className = 'supplement-lock-hint'
          note.setAttribute('style', LOCK_HINT_STYLE)
          note.textContent = lock.text
          if (!existingHint) {
            label.appendChild(note)
          }
        }
        return
      }

      if (box.disabled) {
        box.disabled = false
      }
      box.removeAttribute('data-disabled-reason')
      box.removeAttribute('aria-disabled')
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

  function isExclusive (box) {
    return box.getAttribute('data-supplement-exclusive') === 'true'
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
      input.addEventListener('input', function () {
        lastEditedCode = code
        scheduleAfterTyping(code)
      })
    }
  })

  apply()
}())
