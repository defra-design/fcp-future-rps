// Select land for your actions (v4b) — loaded by app/views/sfi-grasslands-v4b/select-parcels.html
// After saving a parcel the page returns to #parcels-list. On mobile that card is hidden
// beside the map, so move to the copy shown below the actions instead.
(function () {
  'use strict'

  var MOBILE = '(max-width: 40.0525em)'

  function goToMobileList () {
    if (window.location.hash !== '#parcels-list' || !window.matchMedia(MOBILE).matches) {
      return
    }
    var target = document.getElementById('parcels-list-mobile')
    if (target) {
      target.scrollIntoView()
      target.focus({ preventScroll: true })
    }
  }

  // After a parcel is picked on the map the page reloads. Open it where the map was,
  // without scrolling to the actions.
  function keepMapInView () {
    var from = null
    try {
      from = window.sessionStorage.getItem('v4bScrollToParcel')
      window.sessionStorage.removeItem('v4bScrollToParcel')
    } catch (error) {}
    if (from !== null) {
      window.scrollTo(0, Number(from) || 0)
    }
    // Tell screen reader users where the actions are
    var selectedLine = document.querySelector('[data-v4b-selected-reference]')
    var status = document.getElementById('v4b-map-status')
    if (selectedLine && status && from !== null) {
      window.setTimeout(function () {
        status.textContent = 'Selected land parcel ' + selectedLine.getAttribute('data-v4b-selected-reference') +
          '. Its actions are below the map.'
      }, 300)
    }
  }

  function start () {
    goToMobileList()
    keepMapInView()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
