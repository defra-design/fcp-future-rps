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

  // ---------------------------------------------------------------------------
  // Swap in another parcel's actions without reloading the page.
  // The server still builds the panel: fetch the page for that parcel and take
  // its #v4b-parcel-area and JSON config, then run the page script again.
  // ---------------------------------------------------------------------------
  var PAGE_URL = '/sfi-grasslands-v4b/select-parcels'
  var PARCEL_SCRIPT_SRC = '/public/javascripts/sfi-grasslands-v4b-select-parcels.js'
  var loadingId = 0

  function parcelUrl (parcelId) {
    var params = []
    if (parcelId) {
      params.push('parcel=' + encodeURIComponent(parcelId))
    }
    if (currentView() === 'list') {
      params.push('view=list')
    }
    return PAGE_URL + (params.length ? '?' + params.join('&') : '')
  }

  // ---------------------------------------------------------------------------
  // Map or list view. The list is the accessible way to choose land without the map.
  // ---------------------------------------------------------------------------
  var VIEW_KEY = 'v4bParcelView'

  function currentView () {
    var list = document.getElementById('v4b-parcel-list')
    return list && !list.classList.contains('app-v4b-hidden') ? 'list' : 'map'
  }

  function setView (view, options) {
    var opts = options || {}
    var list = document.getElementById('v4b-parcel-list')
    var map = document.querySelector('.app-v4b-map')
    if (!list || !map) {
      return
    }
    list.classList.toggle('app-v4b-hidden', view !== 'list')
    map.classList.toggle('app-v4b-hidden', view === 'list')
    Array.prototype.forEach.call(document.querySelectorAll('[data-v4b-view]'), function (link) {
      // Show the link to the other view
      link.classList.toggle('app-v4b-hidden', link.getAttribute('data-v4b-view') === view)
    })
    try {
      window.sessionStorage.setItem(VIEW_KEY, view)
    } catch (error) {}
    try {
      var url = new URL(window.location.href)
      if (view === 'list') {
        url.searchParams.set('view', 'list')
      } else {
        url.searchParams.delete('view')
      }
      window.history.replaceState(window.history.state, '', url.pathname + url.search)
    } catch (error) {}
    applyState()
    if (view === 'map') {
      // The map was hidden, so let it measure its size again
      window.dispatchEvent(new Event('resize'))
    }
    if (opts.focus) {
      var focusTarget = view === 'list'
        ? list.querySelector('.govuk-radios__input')
        : document.getElementById('v4b-map-field')
      if (focusTarget) {
        if (!focusTarget.hasAttribute('tabindex')) {
          focusTarget.setAttribute('tabindex', '-1')
        }
        focusTarget.focus()
      }
    }
  }

  // In the list view a parcel is its own step: the list, view links and Continue
  // are hidden, and Back returns to the list
  function applyState () {
    var form = document.getElementById('v4b-select-parcels-form')
    var isList = currentView() === 'list'
    var isStep = isList && !!document.getElementById('selected-parcel')
    if (form) {
      form.classList.toggle('app-v4b-is-list', isList)
      form.classList.toggle('app-v4b-is-list-step', isStep)
    }
    var field = document.querySelector('[data-v4b-view-field]')
    if (field) {
      field.value = isList ? 'list' : 'map'
    }
    var back = document.querySelector('[data-v4b-back-link]')
    if (back) {
      back.setAttribute('href', isStep ? PAGE_URL + '?view=list' : back.getAttribute('data-v4b-back-link'))
    }
  }

  document.addEventListener('click', function (event) {
    var viewLink = event.target.closest && event.target.closest('[data-v4b-view]')
    if (viewLink) {
      event.preventDefault()
      var view = viewLink.getAttribute('data-v4b-view')
      if (view === 'list' && document.getElementById('selected-parcel')) {
        // Asked for the list, so show the list rather than this parcel's step
        try {
          window.sessionStorage.setItem(VIEW_KEY, 'list')
        } catch (error) {}
        window.location.href = PAGE_URL + '?view=list'
        return
      }
      setView(view, { focus: true })
    }
  })

  function copyJson (fromDoc, id) {
    var from = fromDoc.getElementById(id)
    var to = document.getElementById(id)
    if (from && to) {
      to.textContent = from.textContent
    }
  }

  // GOV.UK's checkbox script only wires up the panel that was there on page load,
  // so open and close the quantity panels in swapped-in content here
  function syncReveal (input) {
    var targetId = input.getAttribute('data-aria-controls') || input.getAttribute('aria-controls')
    var target = targetId && document.getElementById(targetId)
    if (!target) {
      return
    }
    input.setAttribute('aria-controls', targetId)
    input.setAttribute('aria-expanded', input.checked ? 'true' : 'false')
    target.classList.toggle('govuk-checkboxes__conditional--hidden', !input.checked)
  }

  document.addEventListener('click', function (event) {
    var input = event.target.closest && event.target.closest('[data-v4b-swapped] .govuk-checkboxes__input')
    if (input) {
      syncReveal(input)
    }
  })

  function runParcelScript () {
    var script = document.createElement('script')
    script.src = PARCEL_SCRIPT_SRC
    script.setAttribute('data-v4b-parcel-script', '')
    document.body.appendChild(script)
  }

  function announce (reference) {
    var status = document.getElementById('v4b-map-status')
    if (status && reference) {
      status.textContent = ''
      window.setTimeout(function () {
        status.textContent = 'Selected land parcel ' + reference + '. Its actions are below the map.'
      }, 100)
    }
  }

  function loadParcel (parcelId, options) {
    var opts = options || {}
    var area = document.getElementById('v4b-parcel-area')
    if (!area || !window.fetch || !window.DOMParser) {
      return Promise.reject(new Error('Swap not supported'))
    }
    var requestId = ++loadingId
    return window.fetch(parcelUrl(parcelId), { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load parcel')
        }
        return response.text()
      })
      .then(function (html) {
        if (requestId !== loadingId) {
          return
        }
        var doc = new window.DOMParser().parseFromString(html, 'text/html')
        var newArea = doc.getElementById('v4b-parcel-area')
        if (!newArea) {
          throw new Error('No parcel area in response')
        }
        // A banner or error from the last save no longer applies
        Array.prototype.forEach.call(
          document.querySelectorAll('.govuk-notification-banner, .govuk-error-summary'),
          function (el) { el.remove() }
        )
        copyJson(doc, 'v4b-parcel-json')
        copyJson(doc, 'limited-area-json')
        if (window.SfiGrasslandsV4bLimitedArea && window.SfiGrasslandsV4bLimitedArea.refreshConfig) {
          window.SfiGrasslandsV4bLimitedArea.refreshConfig()
        }
        area.innerHTML = newArea.innerHTML
        area.setAttribute('data-v4b-swapped', '')
        Array.prototype.forEach.call(area.querySelectorAll('.govuk-checkboxes__input'), syncReveal)
        if (!opts.fromHistory) {
          window.history.pushState({ v4bParcel: parcelId }, '', parcelUrl(parcelId))
        }
        runParcelScript()
        applyState()
        // Only one green button: once a parcel is showing, its Save button is the main one
        var continueButton = document.querySelector('button[name="v4bIntent"][value="continue"]')
        if (continueButton) {
          continueButton.classList.toggle('govuk-button--secondary', !!document.getElementById('selected-parcel'))
        }
        var panel = document.getElementById('selected-parcel')
        announce(panel && panel.getAttribute('data-v4b-selected-reference'))
      })
  }

  // Back and Forward between parcels
  window.addEventListener('popstate', function () {
    var parcelId = new URLSearchParams(window.location.search).get('parcel')
    if (!parcelId) {
      window.location.reload()
      return
    }
    loadParcel(parcelId, { fromHistory: true }).then(function () {
      if (window.SfiGrasslandsV4bSelectParcelsMap) {
        window.SfiGrasslandsV4bSelectParcelsMap.highlight(parcelId)
      }
    }).catch(function () {
      window.location.reload()
    })
  })

  window.SfiGrasslandsV4bParcelSwap = { load: loadParcel }

  function start () {
    // Come back to the view the user chose last time
    var params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'list') {
      setView('list')
    } else {
      var saved = null
      try {
        saved = window.sessionStorage.getItem(VIEW_KEY)
      } catch (error) {}
      if (saved === 'list') {
        setView('list')
      }
    }
    applyState()
    goToMobileList()
    keepMapInView()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
