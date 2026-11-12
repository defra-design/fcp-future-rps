// Select land for your actions (v5) — loaded by app/views/sfi-grasslands-v5/select-parcels.html
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
      from = window.sessionStorage.getItem('v5ScrollToParcel')
      window.sessionStorage.removeItem('v5ScrollToParcel')
    } catch (error) {}
    if (from !== null) {
      window.scrollTo(0, Number(from) || 0)
    }
    // Tell screen reader users where the actions are
    var selectedLine = document.querySelector('[data-v5-selected-reference]')
    var status = document.getElementById('v5-map-status')
    if (selectedLine && status && from !== null) {
      window.setTimeout(function () {
        status.textContent = 'Selected land parcel ' + selectedLine.getAttribute('data-v5-selected-reference') +
          '. Its actions are below the map.'
      }, 300)
    }
  }

  // ---------------------------------------------------------------------------
  // Swap in another parcel's actions without reloading the page.
  // The server still builds the panel: fetch the page for that parcel and take
  // its #v5-parcel-area and JSON config, then run the page script again.
  // ---------------------------------------------------------------------------
  var PAGE_URL = '/sfi-grasslands-v5/select-parcels'
  var PARCEL_SCRIPT_SRC = '/public/javascripts/sfi-grasslands-v5-select-parcels.js'
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
  var VIEW_KEY = 'v5ParcelView'

  function currentView () {
    var list = document.getElementById('v5-parcel-list')
    return list && !list.classList.contains('app-v5-hidden') ? 'list' : 'map'
  }

  function setView (view, options) {
    var opts = options || {}
    var list = document.getElementById('v5-parcel-list')
    var map = document.querySelector('.app-v5-map')
    if (!list || !map) {
      return
    }
    list.classList.toggle('app-v5-hidden', view !== 'list')
    map.classList.toggle('app-v5-hidden', view === 'list')
    Array.prototype.forEach.call(document.querySelectorAll('[data-v5-view]'), function (link) {
      // Show the link to the other view
      link.classList.toggle('app-v5-hidden', link.getAttribute('data-v5-view') === view)
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
        : document.getElementById('v5-map-field')
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
    var form = document.getElementById('v5-select-parcels-form')
    var isList = currentView() === 'list'
    var isStep = isList && !!document.getElementById('selected-parcel')
    if (form) {
      form.classList.toggle('app-v5-is-list', isList)
      form.classList.toggle('app-v5-is-list-step', isStep)
    }
    var field = document.querySelector('[data-v5-view-field]')
    if (field) {
      field.value = isList ? 'list' : 'map'
    }
    var back = document.querySelector('[data-v5-back-link]')
    if (back) {
      back.setAttribute('href', isStep ? PAGE_URL + '?view=list' : back.getAttribute('data-v5-back-link'))
    }
  }

  document.addEventListener('click', function (event) {
    var viewLink = event.target.closest && event.target.closest('[data-v5-view]')
    if (viewLink) {
      event.preventDefault()
      var view = viewLink.getAttribute('data-v5-view')
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

  // "Save and continue" whenever there is a land parcel open or actions already added;
  // no button at all before anything has been added (see select-parcels.html)
  function syncContinueButton () {
    var button = document.querySelector('[data-v5-continue]')
    var wrapper = document.querySelector('[data-v5-saved-count]')
    if (!button) {
      return
    }
    var hasParcel = Boolean(document.getElementById('selected-parcel'))
    var savedCount = wrapper ? Number(wrapper.getAttribute('data-v5-saved-count')) || 0 : 0
    // Always "Save and continue" (design, 3 November 2026; confirmed 11 November 2026)
    button.textContent = 'Save and continue'
    // Only once there is something to save or continue with (11 November 2026)
    button.classList.toggle('app-v5-hidden', !hasParcel && savedCount === 0)
  }

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
    var input = event.target.closest && event.target.closest('[data-v5-swapped] .govuk-checkboxes__input')
    if (input) {
      syncReveal(input)
    }
  })

  function runParcelScript () {
    var script = document.createElement('script')
    script.src = PARCEL_SCRIPT_SRC
    script.setAttribute('data-v5-parcel-script', '')
    document.body.appendChild(script)
  }

  function announce (reference) {
    var status = document.getElementById('v5-map-status')
    if (status && reference) {
      status.textContent = ''
      window.setTimeout(function () {
        status.textContent = 'Selected land parcel ' + reference + '. Its actions are below the map.'
      }, 100)
    }
  }

  function loadParcel (parcelId, options) {
    var opts = options || {}
    var area = document.getElementById('v5-parcel-area')
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
        var newArea = doc.getElementById('v5-parcel-area')
        if (!newArea) {
          throw new Error('No parcel area in response')
        }
        // A banner or error from the last save no longer applies
        Array.prototype.forEach.call(
          document.querySelectorAll('.govuk-notification-banner, .govuk-error-summary'),
          function (el) { el.remove() }
        )
        copyJson(doc, 'v5-parcel-json')
        copyJson(doc, 'limited-area-json')
        if (window.SfiGrasslandsV5LimitedArea && window.SfiGrasslandsV5LimitedArea.refreshConfig) {
          window.SfiGrasslandsV5LimitedArea.refreshConfig()
        }
        area.innerHTML = newArea.innerHTML
        area.setAttribute('data-v5-swapped', '')
        // The land parcels list beside the map: highlight the open parcel (on its page)
        var newRows = doc.getElementById('v5-parcel-rows-area')
        var rows = document.getElementById('v5-parcel-rows-area')
        if (newRows && rows) {
          rows.innerHTML = newRows.innerHTML
        }
        Array.prototype.forEach.call(area.querySelectorAll('.govuk-checkboxes__input'), syncReveal)
        if (!opts.fromHistory) {
          window.history.pushState({ v5Parcel: parcelId }, '', parcelUrl(parcelId))
        }
        runParcelScript()
        applyState()
        syncContinueButton()
        var panel = document.getElementById('selected-parcel')
        announce(panel && panel.getAttribute('data-v5-selected-reference'))
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
      if (window.SfiGrasslandsV5SelectParcelsMap) {
        window.SfiGrasslandsV5SelectParcelsMap.highlight(parcelId)
      }
    }).catch(function () {
      window.location.reload()
    })
  })

  // Land parcels list pages: change the list in place, without reloading or jumping
  document.addEventListener('click', function (event) {
    var pageLink = event.target.closest && event.target.closest('.app-v5-parcel-rows__pages a')
    var rows = document.getElementById('v5-parcel-rows-area')
    if (!pageLink || !rows || !window.fetch || !window.DOMParser) {
      return
    }
    event.preventDefault()
    window.fetch(pageLink.href.split('#')[0], { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load page')
        }
        return response.text()
      })
      .then(function (html) {
        var doc = new window.DOMParser().parseFromString(html, 'text/html')
        var newRows = doc.getElementById('v5-parcel-rows-area')
        if (!newRows) {
          throw new Error('No list in response')
        }
        rows.innerHTML = newRows.innerHTML
        var heading = document.getElementById('v5-parcel-rows-heading')
        if (heading) {
          heading.setAttribute('tabindex', '-1')
          heading.focus({ preventScroll: true })
        }
      })
      .catch(function () {
        window.location.href = pageLink.href
      })
  })

  window.SfiGrasslandsV5ParcelSwap = { load: loadParcel }

  function start () {
    // Come back to the view the user chose last time
    var params = new URLSearchParams(window.location.search)
    // v5: the map and the land parcels list are on the page together, so the old
    // list-only view is used only when the URL asks for it
    if (params.get('view') === 'list') {
      setView('list')
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
