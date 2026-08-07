/**
 * grasslands-v2: persist footer feature toggles (session + shareable URL)
 * across all pages that use the grasslands-v2 header layout.
 */
(function (window, document) {
  var CURRENT_PREFIX = '/grasslands-v2'
  var PREVIOUS_PREFIX = '/grasslands-v1-archive'
  var JOURNEY_TOGGLE_ID = 'use-original-version-1'
  var JOURNEY_STORAGE_KEY = 'grasslandsV2UseOriginalVersion1'
  var JOURNEY_QUERY_PARAM = 'originalV1'

  var TOGGLES = [
    {
      id: 'show-all-mvp-actions',
      storageKey: 'grasslandsV2ShowAllMvpActions',
      queryParam: 'allActions'
    },
    {
      id: 'show-previous-agreements',
      storageKey: 'grasslandsV2ShowPreviousAgreements',
      queryParam: 'previousAgreements'
    },
    {
      id: JOURNEY_TOGGLE_ID,
      storageKey: JOURNEY_STORAGE_KEY,
      queryParam: JOURNEY_QUERY_PARAM,
      journeySwitch: true
    }
  ]

  function isPreviousJourneyPath () {
    return window.location.pathname.indexOf(PREVIOUS_PREFIX) === 0
  }

  function isCurrentJourneyPath () {
    if (isPreviousJourneyPath()) {
      return false
    }
    return window.location.pathname === CURRENT_PREFIX ||
      window.location.pathname.indexOf(CURRENT_PREFIX + '/') === 0
  }

  function isGrasslandsJourneyPath () {
    return isCurrentJourneyPath() || isPreviousJourneyPath()
  }

  function withJourneyQuery (path, useOriginal) {
    try {
      var url = new URL(path, window.location.origin)
      if (useOriginal) {
        url.searchParams.set(JOURNEY_QUERY_PARAM, '1')
      } else {
        url.searchParams.delete(JOURNEY_QUERY_PARAM)
      }
      return url.pathname + url.search + url.hash
    } catch (error) {
      return path
    }
  }

  function buildJourneyUrl (useOriginal) {
    var pathname = window.location.pathname
    var nextPath

    if (useOriginal) {
      if (isPreviousJourneyPath()) {
        return null
      }
      if (isCurrentJourneyPath()) {
        nextPath = pathname.replace(CURRENT_PREFIX, PREVIOUS_PREFIX)
      } else {
        nextPath = PREVIOUS_PREFIX + '/index'
      }
    } else {
      if (!isPreviousJourneyPath()) {
        return null
      }
      nextPath = pathname.replace(PREVIOUS_PREFIX, CURRENT_PREFIX)
    }

    return withJourneyQuery(nextPath, useOriginal)
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

      setOrClear('apiDelay', false)
      setOrClear('cnum2Unavailable', false)
      setOrClear('aacDebug', false)
      setOrClear('aac', false)

      TOGGLES.forEach(function (toggle) {
        if (toggle.journeySwitch) {
          return
        }
        var input = document.getElementById(toggle.id)
        var enabled = input
          ? Boolean(input.checked)
          : (getQueryFlag(toggle.queryParam) || getSessionFlag(toggle.storageKey))
        setOrClear(toggle.queryParam, enabled)
      })

      // Reflect current path only — do not force navigation from the query string
      setOrClear(JOURNEY_QUERY_PARAM, isPreviousJourneyPath())

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

      if (toggle.journeySwitch) {
        if (!isGrasslandsJourneyPath()) {
          return
        }

        // Checkbox mirrors the path you are on — never auto-redirect on load
        input.checked = isPreviousJourneyPath()
        setSessionFlag(toggle.storageKey, isPreviousJourneyPath())

        input.addEventListener('change', function () {
          var isOn = Boolean(input.checked)
          setSessionFlag(toggle.storageKey, isOn)
          var target = buildJourneyUrl(isOn)
          if (target) {
            window.location.href = target
            return
          }
          syncQueryParams()
        })
        return
      }

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
