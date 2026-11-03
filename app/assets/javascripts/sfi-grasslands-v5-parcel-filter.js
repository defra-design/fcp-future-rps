// "Find a land parcel" filters the land parcels list as you type (3 November 2026).
// Replaces the suggestions dropdown. Every parcel is already in the list (rows off the current
// page are hidden), so filtering needs no request. While filtering, every match shows and the
// page links are hidden. Enter with one match opens it in place (the row's link, which the
// layout script loads without a reload). Without JavaScript the search button reloads the page
// with ?find=, which the server filters the same way.
;(function () {
  var input = document.getElementById('v5-find')
  var form = document.getElementById('v5-find-form')
  if (!input || !form) {
    return
  }

  function key (value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase()
  }

  function apply () {
    var area = document.getElementById('v5-parcel-rows-area')
    if (!area) {
      return []
    }
    var term = key(input.value)
    // Kept with the parcel form, so "Add another parcel" brings the list back filtered
    var field = document.querySelector('[data-v5-list-filter-field]')
    if (field) {
      field.value = input.value.trim()
    }
    var rows = Array.prototype.slice.call(area.querySelectorAll('[data-v5-row-key]'))
    var count = area.querySelector('[data-v5-list-count]')
    var pages = area.querySelector('[data-v5-list-pages]')
    var empty = area.querySelector('[data-v5-list-empty]')
    var emptyTerm = area.querySelector('[data-v5-list-empty-term]')
    var currentPage = pages && pages.querySelector('[aria-current="page"]')
    var page = currentPage ? currentPage.textContent.trim() : '1'
    var matches = []

    rows.forEach(function (row) {
      var show = term
        ? row.getAttribute('data-v5-row-key').indexOf(term) !== -1
        : row.getAttribute('data-v5-row-page') === page
      row.classList.toggle('app-v5-hidden', !show)
      if (term && show) {
        matches.push(row)
      }
    })

    if (count) {
      var text = term
        ? 'Showing ' + matches.length + ' of ' + count.getAttribute('data-v5-total') + ' parcels'
        : count.getAttribute('data-v5-page-count')
      if (count.textContent.trim() !== text) {
        count.textContent = text
      }
    }
    if (pages) {
      pages.classList.toggle('app-v5-hidden', Boolean(term))
    }
    var clearInline = area.querySelector('[data-v5-list-clear-inline]')
    if (clearInline) {
      clearInline.classList.toggle('app-v5-hidden', !term)
    }
    if (empty) {
      empty.classList.toggle('app-v5-hidden', !(term && matches.length === 0))
      if (emptyTerm) {
        emptyTerm.textContent = input.value.trim()
      }
    }
    return matches
  }

  var timer = null
  input.addEventListener('input', function () {
    window.clearTimeout(timer)
    // A short pause so the count is read out once, not after every key
    timer = window.setTimeout(apply, 150)
  })

  // The map script opens an exact reference itself (and stops the submit). Otherwise one
  // match opens it; more than one, or none, just leaves the filtered list.
  form.addEventListener('submit', function (event) {
    if (event.defaultPrevented) {
      return
    }
    if (!key(input.value)) {
      event.preventDefault()
      apply()
      return
    }
    var matches = apply()
    event.preventDefault()
    if (matches.length === 1) {
      var link = matches[0].querySelector('[data-v5-parcel-link]')
      if (link) {
        link.click()
      }
    }
  })

  // "Clear search" in the empty list
  document.addEventListener('click', function (event) {
    var clear = event.target.closest && event.target.closest('[data-v5-list-clear]')
    if (!clear) {
      return
    }
    event.preventDefault()
    input.value = ''
    apply()
    input.focus()
  })

  // The list is swapped in place when a parcel or a list page is opened: filter it again
  var area = document.getElementById('v5-parcel-rows-area')
  if (area && window.MutationObserver) {
    new window.MutationObserver(function () {
      if (key(input.value)) {
        apply()
      }
    }).observe(area, { childList: true })
  }
})()
