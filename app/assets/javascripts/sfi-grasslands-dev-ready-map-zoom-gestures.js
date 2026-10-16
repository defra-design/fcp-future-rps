// Loaded by sfi-grasslands-dev-ready/select-land.html
// Zooming with the scroll wheel or trackpad without trapping the page (MapLibre's
// "cooperative gestures"), as on v4b select-parcels:
// - a plain scroll over the map moves the page
// - ⌘ command (Mac) or Ctrl + scroll zooms the map
// - on touch screens, two fingers move the map
// MapLibre's pop-up explaining this shows once per visit. The panel under the map
// (#map-zoom-hint) is always there, in words for the device.
(function () {
  'use strict'

  var SEEN_KEY = 'sfiGrasslandsDevReadyMapGestureHintSeen'
  var HINT_ID = 'map-zoom-hint'

  function getDevice () {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return 'touch'
    }
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
    return /mac/i.test(platform) ? 'mac' : 'other'
  }

  function setHintText () {
    var hint = document.getElementById(HINT_ID)
    if (!hint) {
      return
    }
    var device = getDevice()
    hint.textContent = device === 'touch'
      ? 'Use two fingers to move or zoom'
      : (device === 'mac' ? 'Hold the ⌘ command key and scroll to zoom' : 'Hold the Ctrl key and scroll to zoom')
  }

  function seen () {
    try {
      return window.sessionStorage.getItem(SEEN_KEY) === '1'
    } catch (error) {
      return false
    }
  }

  // Call with the MapLibre map once it is ready
  function setUp (map) {
    if (!map) {
      return
    }
    if (!map.cooperativeGestures || !map.scrollZoom) {
      if (map.scrollZoom) {
        map.scrollZoom.disable()
      }
      return
    }
    var strings = {
      'CooperativeGesturesHandler.WindowsHelpText': 'Hold the Ctrl key and scroll to zoom the map',
      'CooperativeGesturesHandler.MacHelpText': 'Hold the ⌘ command key and scroll to zoom the map',
      'CooperativeGesturesHandler.MobileHelpText': 'Use two fingers to move the map'
    }
    if (typeof map.setLocale === 'function') {
      map.setLocale(strings)
    } else {
      map._locale = Object.assign({}, map._locale || {}, strings)
    }
    map.scrollZoom.enable()
    map.cooperativeGestures.enable()

    var container = map.getContainer()
    if (seen()) {
      container.classList.add('app-gesture-hint-seen')
      return
    }
    map.on('cooperativegestureprevented', function () {
      if (container.classList.contains('app-gesture-hint-seen')) {
        return
      }
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1')
      } catch (error) {}
      // Let this first one show and fade, then hide it for the rest of the visit
      window.setTimeout(function () {
        container.classList.add('app-gesture-hint-seen')
      }, 1600)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setHintText)
  } else {
    setHintText()
  }

  window.SfiGrasslandsDevReadyMapZoomGestures = { setUp: setUp }
})()
