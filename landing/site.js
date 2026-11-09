(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var colors = ['#c8402b', '#e8892b', '#f0b44c', '#7a5238'];

  window.burst = function (x, y) {
    if (reduce) return;
    for (var i = 0; i < 14; i++) {
      var p = document.createElement('span');
      p.className = 'pop';
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.background = colors[i % colors.length];
      var a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      p.style.setProperty('--x', Math.cos(a) * d + 'px');
      p.style.setProperty('--y', Math.sin(a) * d - 20 + 'px');
      p.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      document.body.appendChild(p);
      setTimeout(function (el) { el.remove(); }.bind(null, p), 900);
    }
  };
  window.burstAt = function (el) { var r = el.getBoundingClientRect(); window.burst(r.left + r.width / 2, r.top + r.height / 2); };

  // scroll reveal
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .15 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('in'); }); }
})();
