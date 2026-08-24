// Check your answers — sfi-grasslands-v3/check-your-answers.html
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var changeLinks = document.querySelectorAll('a.govuk-link[href*="from=check-your-answers"]')

    changeLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        sessionStorage.setItem('editingFromCheckYourAnswers', 'true')
      })
    })
  })
})()
