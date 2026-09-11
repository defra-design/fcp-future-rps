/* Loaded by sfi-agreement-v1/offer-email.html and offer-updated-email.html
   Fills #offer-email-date with the current UK date and time. */
(function () {
  var el = document.getElementById('offer-email-date')
  if (!el) {
    return
  }

  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).formatToParts(new Date())

  var values = {}
  parts.forEach(function (part) {
    if (part.type !== 'literal') {
      values[part.type] = part.value
    }
  })

  var day = values.day || ''
  var month = values.month || ''
  var year = values.year || ''
  var hour = values.hour || ''
  var minute = values.minute || ''
  var dayPeriod = String(values.dayPeriod || 'am').toLowerCase().replace(/\s/g, '')
  var timeZone = values.timeZoneName || 'GMT'

  el.textContent = 'Date: ' + day + ' ' + month + ' ' + year +
    ' at ' + hour + ':' + minute + dayPeriod + ' ' + timeZone
})()
