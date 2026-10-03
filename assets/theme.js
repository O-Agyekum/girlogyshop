/* girlogy theme — interactions. No dependencies. */
(function () {
  'use strict';

  var routes = (window.theme && window.theme.routes) || {};
  var strings = (window.theme && window.theme.strings) || {};
  var lastFocus = null;

  /* ---------- helpers ---------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function toast(message) {
    var el = qs('#Toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'Toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  function openPanel(panel) {
    if (!panel) return;
    lastFocus = document.activeElement;
    panel.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    var focusable = qs('button, a, input', panel.querySelector('[data-panel]') || panel);
    if (focusable) setTimeout(function () { focusable.focus(); }, 50);
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.removeAttribute('open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    qsa('.drawer[open], .mobile-menu[open], .search-modal[open]').forEach(closePanel);
  });

  /* ---------- generic open/close triggers ---------- */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open]');
    if (opener) {
      var target = document.getElementById(opener.getAttribute('data-open'));
      if (target) {
        e.preventDefault();
        if (target.id === 'CartDrawer') { refreshCartDrawer().then(function () { openPanel(target); }); }
        else { openPanel(target); }
        if (target.id === 'SearchModal') { var input = qs('input[type="search"]', target); if (input) input.focus(); }
      }
      return;
    }
    var closer = e.target.closest('[data-close]');
    if (closer) {
      e.preventDefault();
      closePanel(closer.closest('.drawer, .mobile-menu, .search-modal'));
    }
  });

  /* ---------- hero slideshow ---------- */
  qsa('[data-slideshow]').forEach(function (show) {
    var slides = qsa('.hero__slide', show);
    var dots = qsa('.hero__dot', show);
    if (slides.length < 2) return;
    var index = 0;
    var delay = parseInt(show.getAttribute('data-autoplay'), 10) * 1000;
    var timer = null;

    function go(i) {
      slides[index].classList.remove('is-active');
      if (dots[index]) dots[index].setAttribute('aria-current', 'false');
      index = (i + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      if (dots[index]) dots[index].setAttribute('aria-current', 'true');
    }
    function start() { if (delay > 0) timer = setInterval(function () { go(index + 1); }, delay); }
    function stop() { clearInterval(timer); }

    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { stop(); go(i); start(); }); });
    show.addEventListener('mouseenter', stop);
    show.addEventListener('mouseleave', start);
    start();
  });

  /* ---------- quantity buttons ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qty]');
    if (!btn) return;
    var input = btn.parentElement.querySelector('input');
    if (!input) return;
    var min = parseInt(input.min || '0', 10);
    var value = (parseInt(input.value, 10) || 0) + (btn.getAttribute('data-qty') === 'plus' ? 1 : -1);
    input.value = Math.max(min, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ---------- cart ---------- */
  function cartIsDrawer() { return !!qs('#CartDrawer'); }

  function updateCartCount(count) {
    qsa('[data-cart-count]').forEach(function (el) {
      el.textContent = count > 0 ? count : '';
      el.setAttribute('data-count', count);
    });
  }

  function refreshCartDrawer() {
    var drawer = qs('#CartDrawer');
    if (!drawer) return Promise.resolve();
    return fetch(routes.root + '?section_id=cart-drawer')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-drawer-content]');
        var current = qs('[data-drawer-content]', drawer);
        if (fresh && current) current.innerHTML = fresh.innerHTML;
        var count = fresh ? parseInt(fresh.getAttribute('data-item-count'), 10) || 0 : 0;
        updateCartCount(count);
      })
      .catch(function () {});
  }

  function changeLine(key, quantity) {
    var drawer = qs('#CartDrawer');
    if (drawer) drawer.classList.add('is-loading');
    return fetch(routes.cartChange + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function () { return refreshCartDrawer(); })
      .catch(function () { toast(strings.error); })
      .finally(function () { if (drawer) drawer.classList.remove('is-loading'); });
  }

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-line-key]');
    if (!input || !e.target.closest('#CartDrawer')) return;
    changeLine(input.getAttribute('data-line-key'), parseInt(input.value, 10) || 0);
  });

  document.addEventListener('click', function (e) {
    var remove = e.target.closest('[data-remove-line]');
    if (!remove || !remove.closest('#CartDrawer')) return;
    e.preventDefault();
    changeLine(remove.getAttribute('data-remove-line'), 0);
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-ajax-cart]');
    if (!form || !cartIsDrawer()) return;
    e.preventDefault();
    var button = form.querySelector('[type="submit"]');
    if (button) button.setAttribute('aria-disabled', 'true');

    fetch(routes.cartAdd + '.js', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    })
      .then(function (r) {
        return r.json().then(function (data) { if (!r.ok) throw data; return data; });
      })
      .then(function () {
        return refreshCartDrawer().then(function () { openPanel(qs('#CartDrawer')); });
      })
      .catch(function (err) { toast((err && err.description) || strings.error); })
      .finally(function () { if (button) button.removeAttribute('aria-disabled'); });
  });

  /* ---------- variant picker ---------- */
  qsa('[data-product]').forEach(function (root) {
    var json = qs('script[data-product-json]', root);
    if (!json) return;
    var product = JSON.parse(json.textContent);
    var idInput = qs('input[name="id"]', root);
    var addButton = qs('[data-add-button]', root);
    var priceEl = qs('[data-price]', root);

    function selectedOptions() {
      return qsa('[data-option-index]', root).map(function (group) {
        var checked = qs('input:checked', group);
        var select = qs('select', group);
        return checked ? checked.value : select ? select.value : null;
      });
    }

    function formatMoney(cents) {
      var format = root.getAttribute('data-money-format') || '€{{amount_with_comma_separator}}';
      var value = (cents / 100).toFixed(2);
      var withComma = value.replace('.', ',');
      return format
        .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, withComma)
        .replace(/\{\{\s*amount\s*\}\}/, value)
        .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100));
    }

    function update() {
      var options = selectedOptions();
      var variant = product.variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === options[i]; });
      });

      if (!variant) {
        if (addButton) { addButton.setAttribute('disabled', ''); addButton.textContent = strings.unavailable; }
        return;
      }

      idInput.value = variant.id;

      if (addButton) {
        if (variant.available) { addButton.removeAttribute('disabled'); addButton.textContent = strings.addToCart; }
        else { addButton.setAttribute('disabled', ''); addButton.textContent = strings.soldOut; }
      }

      if (priceEl) {
        var onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
        priceEl.classList.toggle('price--sale', !!onSale);
        priceEl.innerHTML =
          '<span class="price__current">' + formatMoney(variant.price) + '</span>' +
          (onSale ? '<s class="price__compare">' + formatMoney(variant.compare_at_price) + '</s>' : '');
      }

      if (variant.featured_media) {
        var media = qs('[data-media-id="' + variant.featured_media.id + '"]', root);
        if (media) media.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }

      if (root.hasAttribute('data-update-url')) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }

      /* mark unavailable choices for the first option based on other selections */
      qsa('[data-option-index]', root).forEach(function (group) {
        var index = parseInt(group.getAttribute('data-option-index'), 10);
        qsa('input', group).forEach(function (input) {
          var test = options.slice();
          test[index] = input.value;
          var match = product.variants.find(function (v) {
            return v.options.every(function (opt, i) { return opt === test[i]; });
          });
          input.classList.toggle('is-unavailable', !match || !match.available);
        });
      });
    }

    root.addEventListener('change', function (e) {
      if (e.target.closest('[data-option-index]')) update();
    });
    update();
  });

  /* ---------- collection sort ---------- */
  qsa('[data-sort-select]').forEach(function (select) {
    select.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', select.value);
      url.searchParams.delete('page');
      window.location.href = url.toString();
    });
  });
})();

/* ---------- product recommendations ---------- */
(function () {
  var holders = document.querySelectorAll('[data-recommendations][data-url]');
  Array.prototype.forEach.call(holders, function (holder) {
    if (holder.children.length) return;
    fetch(holder.getAttribute('data-url'))
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-recommendations]');
        if (fresh && fresh.innerHTML.trim()) holder.innerHTML = fresh.innerHTML;
      })
      .catch(function () {});
  });
})();
