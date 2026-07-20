/**
 * grasslands-v2: action checkbox compatibility loading + rebuild
 *
 * Prototype only. The setTimeout in simulateApiCall() stands in for a real
 * compatibility API. Replace that function with fetch()/XHR later, keeping the
 * same showLoading → lock → reset → calculate → apply → unlock flow.
 */
(function (window) {
  var DEFAULT_DELAY_MS = 2500

  var state = {
    busy: false,
    suspended: false,
    timerId: null,
    requestId: 0,
    delayMs: DEFAULT_DELAY_MS,
    checkboxSelector: 'input[name="actions"]',
    continueButtonId: 'continue-button',
    statusId: 'actions-compatibility-status',
    fieldsetSelector: '#actions-form-group fieldset',
    areActionsIncompatible: null,
    getActionCode: null,
    getActionName: null,
    findExistingAgreementConflict: null,
    onAfterApply: null
  }

  function getCheckboxes () {
    return Array.prototype.slice.call(
      document.querySelectorAll(state.checkboxSelector)
    )
  }

  function getContinueButton () {
    return document.getElementById(state.continueButtonId)
  }

  function getStatusEl () {
    return document.getElementById(state.statusId)
  }

  function getFieldset () {
    return document.querySelector(state.fieldsetSelector)
  }

  function showLoading () {
    var statusEl = getStatusEl()
    var fieldset = getFieldset()
    if (statusEl) {
      statusEl.hidden = false
    }
    if (fieldset) {
      fieldset.setAttribute('aria-busy', 'true')
    }
  }

  function hideLoading () {
    var statusEl = getStatusEl()
    var fieldset = getFieldset()
    if (statusEl) {
      statusEl.hidden = true
    }
    if (fieldset) {
      fieldset.setAttribute('aria-busy', 'false')
    }
  }

  function lockInteraction () {
    state.busy = true
    var continueButton = getContinueButton()
    if (continueButton) {
      continueButton.disabled = true
    }

    getCheckboxes().forEach(function (checkbox) {
      var item = checkbox.closest('.govuk-checkboxes__item')
      checkbox.disabled = true
      if (item) {
        item.classList.add('actions-api-loading-disabled')
      }
    })
  }

  function unlockInteraction () {
    state.busy = false
    var continueButton = getContinueButton()
    if (continueButton) {
      continueButton.disabled = false
    }

    getCheckboxes().forEach(function (checkbox) {
      var item = checkbox.closest('.govuk-checkboxes__item')
      if (item) {
        item.classList.remove('actions-api-loading-disabled')
      }
      // Checked actions must stay interactive so the user can deselect them.
      // Incompatible unchecked actions stay disabled from applyCompatibility().
      if (checkbox.checked) {
        checkbox.disabled = false
      }
    })
  }

  /**
   * Wipe every previous compatibility / temporary disable before rebuilding.
   * Do not incrementally patch the previous screen state.
   */
  function resetCompatibilityState () {
    getCheckboxes().forEach(function (checkbox) {
      var item = checkbox.closest('.govuk-checkboxes__item')
      var code = state.getActionCode
        ? state.getActionCode(checkbox)
        : (checkbox.value || '')
      var compatibilityHintId = 'compatibility-hint-' + String(code || '').toLowerCase()

      checkbox.disabled = false
      checkbox.removeAttribute('disabled')
      checkbox.removeAttribute('aria-disabled')
      checkbox.removeAttribute('data-disabled-reason')

      if (item) {
        item.classList.remove(
          'actions-api-loading-disabled',
          'sfi-compatibility-disabled'
        )
        item.style.opacity = ''

        Array.prototype.slice.call(
          item.querySelectorAll('.compatibility-hint, .sfi-compatibility-option-hint, .area-full-hint')
        ).forEach(function (hint) {
          if (hint.parentNode) {
            hint.parentNode.removeChild(hint)
          }
        })
      }

      var describedBy = (checkbox.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(function (id) {
          return id && id !== compatibilityHintId
        })

      if (describedBy.length) {
        checkbox.setAttribute('aria-describedby', describedBy.join(' '))
      } else {
        checkbox.removeAttribute('aria-describedby')
      }
    })
  }

  function getSelectedActions () {
    return getCheckboxes()
      .filter(function (checkbox) {
        return checkbox.checked
      })
      .map(function (checkbox) {
        return state.getActionCode
          ? state.getActionCode(checkbox)
          : String(checkbox.value || '').toUpperCase()
      })
      .filter(Boolean)
  }

  /**
   * Build a fresh incompatibility map from the currently checked actions only
   * (plus optional existing-agreement conflicts supplied by the page).
   *
   * result[code] = { code, name, fromExistingAgreement }
   */
  function calculateCompatibility (selectedActions) {
    var result = {}
    var selected = selectedActions || []

    getCheckboxes().forEach(function (checkbox) {
      if (checkbox.checked) {
        return
      }

      var candidateCode = state.getActionCode
        ? state.getActionCode(checkbox)
        : String(checkbox.value || '').toUpperCase()

      if (!candidateCode) {
        return
      }

      var conflict = null
      var fromExistingAgreement = false

      // Existing-agreement conflicts only apply while the user has a selection.
      // With nothing selected, every action must be available again.
      if (
        selected.length &&
        typeof state.findExistingAgreementConflict === 'function'
      ) {
        conflict = state.findExistingAgreementConflict(candidateCode)
        if (conflict) {
          fromExistingAgreement = true
        }
      }

      if (!conflict && selected.length) {
        for (var i = 0; i < selected.length; i++) {
          var selectedCode = selected[i]
          if (
            state.areActionsIncompatible &&
            state.areActionsIncompatible(selectedCode, candidateCode)
          ) {
            conflict = {
              code: selectedCode,
              name: state.getActionName
                ? state.getActionName(selectedCode)
                : selectedCode
            }
            break
          }
        }
      }

      if (conflict) {
        result[candidateCode] = {
          code: conflict.code || conflict,
          name: conflict.name || (state.getActionName
            ? state.getActionName(conflict.code || conflict)
            : String(conflict.code || conflict)),
          fromExistingAgreement: fromExistingAgreement
        }
      }
    })

    return result
  }

  function applyCompatibility (result) {
    result = result || {}

    getCheckboxes().forEach(function (checkbox) {
      // Never disable an already-selected action — user must be able to deselect.
      if (checkbox.checked) {
        checkbox.disabled = false
        return
      }

      var candidateCode = state.getActionCode
        ? state.getActionCode(checkbox)
        : String(checkbox.value || '').toUpperCase()
      var conflict = result[candidateCode]

      if (!conflict) {
        checkbox.disabled = false
        return
      }

      var item = checkbox.closest('.govuk-checkboxes__item')
      var codeLower = String(candidateCode || '').toLowerCase()
      var compatibilityHintId = 'compatibility-hint-' + codeLower
      var hint = item && item.querySelector('.govuk-checkboxes__hint')
      var label = item && item.querySelector('.govuk-checkboxes__label')
      var hintText

      if (conflict.fromExistingAgreement) {
        hintText = conflict.name && conflict.code
          ? ('Not compatible with ' + conflict.name + ' (' + conflict.code + ') already on this parcel.')
          : 'Not compatible with an existing agreement already on this parcel.'
      } else {
        hintText = conflict.name
          ? ('Not compatible with the selected action: ' + conflict.name + ' (' + conflict.code + ').')
          : ('Not compatible with ' + conflict.code + '.')
      }

      checkbox.disabled = true
      checkbox.setAttribute('data-disabled-reason', 'compatibility')
      checkbox.setAttribute('aria-disabled', 'true')

      if (item) {
        item.classList.add('sfi-compatibility-disabled')
      }

      if (item && !item.querySelector('.compatibility-hint')) {
        var hintHtml = document.createElement('span')
        hintHtml.className = 'compatibility-hint sfi-compatibility-option-hint'
        hintHtml.id = compatibilityHintId
        hintHtml.textContent = hintText
        if (hint) {
          hint.appendChild(hintHtml)
        } else if (label) {
          label.appendChild(hintHtml)
        }
      }

      var describedBy = (checkbox.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(Boolean)
      if (describedBy.indexOf(compatibilityHintId) === -1) {
        describedBy.push(compatibilityHintId)
        checkbox.setAttribute('aria-describedby', describedBy.join(' '))
      }
    })
  }

  /**
   * Prototype stand-in for the compatibility API.
   * Replace the setTimeout with a real request, e.g.:
   *
   *   return fetch('/api/actions/compatibility', { method: 'POST', body: ... })
   *     .then(function (response) { return response.json() })
   */
  function simulateApiCall (delayMs) {
    var requestId = state.requestId
    return new Promise(function (resolve) {
      state.timerId = window.setTimeout(function () {
        state.timerId = null
        if (requestId === state.requestId) {
          resolve()
        }
      }, delayMs)
    })
  }

  function cancelPendingRequest () {
    if (state.timerId !== null) {
      window.clearTimeout(state.timerId)
      state.timerId = null
    }
    state.requestId += 1
  }

  /**
   * Core flow: lock → wait → full reset → recalculate from checked actions → unlock.
   */
  function updateCompatibility (changedCheckbox) {
    if (state.suspended) {
      resetCompatibilityState()
      applyCompatibility(calculateCompatibility(getSelectedActions()))
      if (typeof state.onAfterApply === 'function') {
        state.onAfterApply()
      }
      return Promise.resolve()
    }

    // Cancel any in-flight simulated request before starting a new one.
    cancelPendingRequest()
    var requestId = state.requestId

    showLoading()
    lockInteraction()

    return simulateApiCall(state.delayMs).then(function () {
      if (requestId !== state.requestId) {
        return
      }

      // Always rebuild from a clean slate using currently checked boxes only.
      resetCompatibilityState()

      var selectedActions = getSelectedActions()
      var result = calculateCompatibility(selectedActions)

      applyCompatibility(result)

      if (typeof state.onAfterApply === 'function') {
        state.onAfterApply()
      }

      unlockInteraction()
      hideLoading()

      if (changedCheckbox && typeof changedCheckbox.focus === 'function') {
        try {
          changedCheckbox.focus()
        } catch (error) {
          // Ignore focus errors if the element was removed.
        }
      }
    })
  }

  function setSuspended (isSuspended) {
    state.suspended = Boolean(isSuspended)
    if (state.suspended) {
      cancelPendingRequest()
      hideLoading()
      // Leave checkbox disabled state to the suspended caller (restore / parcel change).
      state.busy = false
      var continueButton = getContinueButton()
      if (continueButton) {
        continueButton.disabled = false
      }
      getCheckboxes().forEach(function (checkbox) {
        var item = checkbox.closest('.govuk-checkboxes__item')
        if (item) {
          item.classList.remove('actions-api-loading-disabled')
        }
      })
    }
  }

  function reset () {
    cancelPendingRequest()
    hideLoading()
    state.busy = false
    var continueButton = getContinueButton()
    if (continueButton) {
      continueButton.disabled = false
    }
    getCheckboxes().forEach(function (checkbox) {
      var item = checkbox.closest('.govuk-checkboxes__item')
      if (item) {
        item.classList.remove('actions-api-loading-disabled')
      }
    })
  }

  function init (options) {
    options = options || {}

    if (options.checkboxSelector) {
      state.checkboxSelector = options.checkboxSelector
    }
    if (options.continueButtonId) {
      state.continueButtonId = options.continueButtonId
    }
    if (options.statusId) {
      state.statusId = options.statusId
    }
    if (options.fieldsetSelector) {
      state.fieldsetSelector = options.fieldsetSelector
    }
    if (Number.isFinite(options.delayMs)) {
      state.delayMs = options.delayMs
    }
    if (typeof options.areActionsIncompatible === 'function') {
      state.areActionsIncompatible = options.areActionsIncompatible
    }
    if (typeof options.getActionCode === 'function') {
      state.getActionCode = options.getActionCode
    }
    if (typeof options.getActionName === 'function') {
      state.getActionName = options.getActionName
    }
    if (typeof options.findExistingAgreementConflict === 'function') {
      state.findExistingAgreementConflict = options.findExistingAgreementConflict
    }
    if (typeof options.onAfterApply === 'function') {
      state.onAfterApply = options.onAfterApply
    }

    return api
  }

  var api = {
    init: init,
    updateCompatibility: updateCompatibility,
    showLoading: showLoading,
    hideLoading: hideLoading,
    lockInteraction: lockInteraction,
    unlockInteraction: unlockInteraction,
    resetCompatibilityState: resetCompatibilityState,
    getSelectedActions: getSelectedActions,
    calculateCompatibility: calculateCompatibility,
    applyCompatibility: applyCompatibility,
    setSuspended: setSuspended,
    reset: reset,
    isBusy: function () {
      return state.busy
    },
    // Kept for older call sites during the transition
    runAfterCompatibilityCheck: function (onComplete) {
      updateCompatibility(null).then(function () {
        if (typeof onComplete === 'function') {
          onComplete()
        }
      })
    }
  }

  window.GrasslandsV2ActionsCompatibilityLoading = api
})(window)
