/**
 * sfi-grasslands-v3: persist footer feature toggles (session + shareable URL)
 * across all pages that use the grasslands-v3 header layout.
 */
(function (window, document) {
  var TOGGLES = [
    {
      id: 'show-all-mvp-actions',
      storageKey: 'sfiGrasslandsV3ShowAllMvpActions',
      queryParam: 'allActions',
      defaultOn: false
    },
    {
      id: 'show-previous-agreements',
      storageKey: 'sfiGrasslandsV3ShowPreviousAgreements',
      queryParam: 'previousAgreements',
      defaultOn: true
    },
    {
      id: 'show-action-deductions',
      storageKey: 'sfiGrasslandsV3ShowActionDeductions',
      queryParam: 'actionDeductions',
      defaultOn: true
    }
  ]

  function findToggle (queryParam) {
    for (var i = 0; i < TOGGLES.length; i++) {
      if (TOGGLES[i].queryParam === queryParam) {
        return TOGGLES[i]
      }
    }
    return null
  }

  function getQueryFlag (paramName) {
    try {
      return new URL(window.location.href).searchParams.get(paramName) === '1'
    } catch (error) {
      return false
    }
  }

  function getSessionFlag (storageKey) {
    try {
      return window.sessionStorage.getItem(storageKey) === '1'
    } catch (error) {
      return false
    }
  }

  function getSessionFlagRaw (storageKey) {
    try {
      return window.sessionStorage.getItem(storageKey)
    } catch (error) {
      return null
    }
  }

  function setSessionFlag (storageKey, enabled) {
    try {
      // Persist explicit off as '0' so defaultOn toggles stay off after the user disables them
      window.sessionStorage.setItem(storageKey, enabled ? '1' : '0')
    } catch (error) {
      // Ignore storage errors in private browsing.
    }
  }

  function resolveToggleEnabled (toggle) {
    if (!toggle) {
      return false
    }
    if (getQueryFlag(toggle.queryParam)) {
      return true
    }
    var raw = getSessionFlagRaw(toggle.storageKey)
    if (raw === '1') {
      return true
    }
    if (raw === '0') {
      return false
    }
    return Boolean(toggle.defaultOn)
  }

  function isToggleEnabled (queryParam) {
    var toggle = findToggle(queryParam)
    if (!toggle) {
      return false
    }
    var input = document.getElementById(toggle.id)
    if (input) {
      return Boolean(input.checked)
    }
    return resolveToggleEnabled(toggle)
  }

  function syncQueryParams () {
    try {
      var url = new URL(window.location.href)
      var changed = false

      function setOrClear (paramName, enabled) {
        if (enabled) {
          if (url.searchParams.get(paramName) !== '1') {
            url.searchParams.set(paramName, '1')
            changed = true
          }
        } else if (url.searchParams.has(paramName)) {
          url.searchParams.delete(paramName)
          changed = true
        }
      }

      // Drop removed toggles from share links
      setOrClear('apiDelay', false)
      setOrClear('cnum2Unavailable', false)
      setOrClear('aacDebug', false)
      setOrClear('aac', false)

      TOGGLES.forEach(function (toggle) {
        var input = document.getElementById(toggle.id)
        var enabled = input
          ? Boolean(input.checked)
          : resolveToggleEnabled(toggle)
        setOrClear(toggle.queryParam, enabled)
      })

      if (changed) {
        window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      }
    } catch (error) {
      // Ignore URL parsing issues in older browsers.
    }
  }

  function init () {
    var details = document.getElementById('prototype-toggles')
    if (!details) {
      return
    }

    TOGGLES.forEach(function (toggle) {
      var input = document.getElementById(toggle.id)
      if (!input) {
        return
      }

      // Query / session / defaultOn — shared links still win via ?param=1
      var enabled = resolveToggleEnabled(toggle)
      input.checked = enabled
      setSessionFlag(toggle.storageKey, enabled)

      input.addEventListener('change', function () {
        var isOn = Boolean(input.checked)
        setSessionFlag(toggle.storageKey, isOn)
        syncQueryParams()
      })
    })

    syncQueryParams()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.SfiGrasslandsV3FeatureToggles = {
    syncQueryParams: syncQueryParams,
    getSessionFlag: getSessionFlag,
    setSessionFlag: setSessionFlag,
    getQueryFlag: getQueryFlag,
    isToggleEnabled: isToggleEnabled,
    resolveToggleEnabled: function (queryParam) {
      return resolveToggleEnabled(findToggle(queryParam))
    }
  }
})(window, document)
