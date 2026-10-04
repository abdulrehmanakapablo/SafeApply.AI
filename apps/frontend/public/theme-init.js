// Runs before first paint (loaded from <head>) so the page never flashes the
// wrong theme. External file because the CSP blocks inline scripts.
;(function () {
  var t = 'dark'
  try {
    var s = localStorage.getItem('sa-theme')
    if (s === 'light' || s === 'dark') t = s
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', t)
})()
