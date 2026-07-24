/**
 * grasslands-v2: persist footer feature toggles (session + shareable URL)
 * across all pages that use the grasslands-v2 header layout.
 */
(function (window, document) {
  var TOGGLES = [
    {
      id: 'show-all-mvp-actions',
      storageKey: 'grasslandsV2ShowAllMvpActions',
      queryParam: 'allActions'
    },
    {
      id: 'use-aac',
      storageKey: 'grasslandsV2UseAac',
      queryParam: 'aac'
    }
  ]

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

  function setSessionFlag (storageKey, enabled) {
    try {
      if (enabled) {
        window.sessionStorage.setItem(storageKey, '1')
      } else {
        window.sessionStorage.removeItem(storageKey)
      }
    } catch (error) {
      // Ignore storage errors in private browsing.
    }
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

      TOGGLES.forEach(function (toggle) {
        var input = document.getElementById(toggle.id)
        var enabled = input
          ? Boolean(input.checked)
          : (getQueryFlag(toggle.queryParam) || getSessionFlag(toggle.storageKey))
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

      // Query wins so shared links open with the intended state
      var enabled = getQueryFlag(toggle.queryParam) || getSessionFlag(toggle.storageKey)
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

  window.GrasslandsV2FeatureToggles = {
    syncQueryParams: syncQueryParams,
    getSessionFlag: getSessionFlag,
    setSessionFlag: setSessionFlag,
    getQueryFlag: getQueryFlag
  }
})(window, document)
