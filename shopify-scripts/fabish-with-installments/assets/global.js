// let regionNames = new Intl.DisplayNames(['en'], {type: 'region'});
// var IsoKode = regionNames.of('IN'); 

  

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

document.querySelectorAll('[id^="AccessibleNav"] .sub-menu-block').forEach((subMenu) => {
  subMenu.setAttribute('role', 'menu');
});

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if(summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function() {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function(event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch(e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if(navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener('focus', () => {
    if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

    if (mouseClick) return;

    currentFocusedElement = document.activeElement;
    currentFocusedElement.classList.add('focused');

  }, true);
}

function pauseAllMedia() {
  document.querySelectorAll('.js-youtube').forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  document.querySelectorAll('.js-vimeo').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video').forEach((video) => video.pause());
  document.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true })

    this.querySelectorAll('button').forEach(
      (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;
    event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
    const IncValue = this.input.value;
    var priceElement =  document.querySelector('.product__info-container');
    var priceElementDIV = document.querySelector('.price-wrapper');
    if(!priceElementDIV) return;
    var currentPrice =  priceElement.querySelector('.product-price-current');   
    const priceData = currentPrice.dataset.price;   
    var SubPrice = priceData.replace(/[^0-9\.]/g, '');   
    var ReultPrice =  SubPrice.replace(/^(\.+)/g, '');     
    var EvalPrice = parseInt(ReultPrice)    
    var subtotal = (IncValue * EvalPrice);                   
    var subtotalElement =  document.getElementById('subtotal-value');    
    if(!subtotalElement) return;
    subtotalElement.innerText = Shopify.formatMoney(subtotal+'.00', DT_THEME.moneyFormat);        
  }
}

customElements.define('quantity-input', QuantityInput);
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
  };
}

/*
 * Shopify Common JS
 *
 */
if ((typeof window.Shopify) == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function(fn, scope) {
  return function() {
    return fn.apply(scope, arguments);
  }
};

Shopify.setSelectorByValue = function(selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function(target, eventName, callback) {
  target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
};

Shopify.postLink = function(path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for(var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
  this.countryEl         = document.getElementById(country_domid);
  this.provinceEl        = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function() {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function() {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function(e) {
    var opt       = this.countryEl.options[this.countryEl.selectedIndex];
    var raw       = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function(selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function(selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  }
};

class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach((summary) =>
      summary.addEventListener('click', this.onSummaryClick.bind(this))
    );
    this.querySelectorAll('button:not(.localization-selector)').forEach((button) =>
      button.addEventListener('click', this.onCloseButtonClick.bind(this))
    );
    
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;
    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;
    openDetailsElement === this.mainDetailsToggle ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary')) : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    var topBarHeight = document.getElementById('shopify-section-top-bar').offsetHeight;    
    document.getElementById("menu-drawer").style.top = '-'+topBarHeight+"px";    
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest('.has-submenu');
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);

      if (window.matchMedia('(max-width: 990px)')) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        parentMenuElement && parentMenuElement.classList.add('submenu-open');
        !reducedMotion || reducedMotion.matches
          ? addTrapFocus()
          : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });
    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach((details) => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach((submenu) => {
      submenu.classList.remove('submenu-open');
    });
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);

    if (event instanceof KeyboardEvent) elementToFocus?.setAttribute('aria-expanded', false);
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement))
        this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute('open');
        if (detailsElement.closest('details[open]')) {
          trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
  }

  openMenuDrawer(summaryElement) {
    this.header = this.header || document.querySelector('.section-header');
    this.borderOffset =
      this.borderOffset || this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom') ? 1 : 0;
    document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`);
    this.header.classList.add('menu-open');

    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });

    summaryElement.setAttribute('aria-expanded', true);
    window.addEventListener('resize', this.onResize);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;    
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove('menu-open');
    window.removeEventListener('resize', this.onResize);
  }

  onResize = () => {
    this.header &&
      document.documentElement.style.setProperty(
        '--header-bottom-position',
        `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`
      );
    document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
  };
}

customElements.define('header-drawer', HeaderDrawer);


class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener(
      'click',
      this.hide.bind(this, false)
    );
    this.addEventListener('keyup', (event) => {
      if (event.code.toUpperCase() === 'ESCAPE') this.hide();
    });
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove('overflow-hidden');
    document.body.dispatchEvent(new CustomEvent('modalClosed'));
    this.removeAttribute('open');
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;
    button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener('click', this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute('loaded')) {
      const content = document.createElement('div');
      content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));

      this.setAttribute('loaded', true);
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
      if (focus) deferredElement.focus();
    }
  }
}

customElements.define('deferred-media', DeferredMedia);

class SliderComponent extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = false;
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    this.initPages();
    const resizeObserver = new ResizeObserver((entries) => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter((element) => element.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(
      (this.slider.clientWidth - this.sliderItemsToShow[0].offsetLeft) / this.sliderItemOffset
    );
    this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {  
    if (!this.slider || !this.nextButton) return;

    const previousPage = this.currentPage;
    this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage != previousPage) {
      this.dispatchEvent(
        new CustomEvent('slideChanged', {
          detail: {
            currentPage: this.currentPage,
            currentElement: this.sliderItemsToShow[this.currentPage - 1],
          },
        })
      );
    }

    if (this.enableSliderLooping) return;

    if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.slider.scrollLeft === 0) {
      this.prevButton.setAttribute('disabled', 'disabled');
    } else {
      this.prevButton.removeAttribute('disabled');
    }

    if (this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1])) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
    return element.offsetLeft + element.clientWidth <= lastVisibleSlide && element.offsetLeft >= this.slider.scrollLeft;
  }

  onButtonClick(event) {
    event.preventDefault();
    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition =
      event.currentTarget.name === 'next'
        ? this.slider.scrollLeft + step * this.sliderItemOffset
        : this.slider.scrollLeft - step * this.sliderItemOffset;
    this.setSlidePosition(this.slideScrollPosition);
  }

  setSlidePosition(position) {
    this.slider.scrollTo({
      left: position,
    });
  }
}

customElements.define('slider-component', SliderComponent);


class SlideshowComponent extends SliderComponent {
  constructor() {
    super();
    this.slider = this.querySelector('[data-slider-options]');
    this.init();
  }

  init() {
    const predefine = {
      effect: 'slide',
      direction: 'horizontal',
      autoplay: true,
      autoplaySpeed: 5,
      space: 0,
      center: true,
      options: {},
    };    
    const slider_options = this.slider.getAttribute('data-slider-options');
    if (slider_options === null || slider_options === '') {
      return null;
    }
    const grouping = $.extend(true, predefine, JSON.parse(slider_options));
    
    const isNumberic = /^\d+$/;
    Object.keys(grouping).forEach((key) => {
      if (typeof grouping[key] === 'string' && isNumberic.test(grouping[key])) {
        grouping[key] = parseInt(grouping[key], 10);
      }
    });
    let autoplay = false;
    if (grouping.auto_play > 0) {
      autoplay = {
        delay: grouping.auto_play * 1000,
      };
    }
    let loop = false;
    if (grouping.loop === 'true' || grouping.loop === true) {
      loop = true;
    }
    const option = $.extend(true, {
      init: false,
      spaceBetween: 0,
      loop,
      autoplay,
      speed: 2000,
      navigation: {
        nextEl: this.slider.querySelector('.swiper-button-next'),
        prevEl: this.slider.querySelector('.swiper-button-prev'),
      },
      pagination: {
        el: this.slider.querySelector('.swiper-pagination'),
        clickable: true,
      },
      lazy: true,
      effect: grouping.effect,
    }, grouping.options);
    const container = this.slider.querySelector('[data-swiper-slider]');
    const initiate = new Swiper(container, option);
    initiate.on('init', () => {
    initiate.update();
    });
    initiate.init();
  }
}

customElements.define('slideshow-component', SlideshowComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('change', this.onVariantChange);
  }

  onVariantChange() {
    this.updateOptions();
    this.updateMasterId();
    this.toggleAddButton(true, '', false);
    this.updatePickupAvailability();
    this.updateVariantStatuses();
    this.removeErrorMessage();

    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
    } else {
      this.updateMedia();
      this.updateURL();
      this.updateVariantInput();
      this.renderProductInfo();
      this.updateShareUrl();
    }
  }

  updateOptions() {
    this.options = Array.from(this.querySelectorAll('select'), (select) => select.value);
  }

  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options.map((option, index) => {
        return this.options[index] === option;
      }).includes(false);
    });
  }

  updateMedia() {
    if (!this.currentVariant) return;
    if (!this.currentVariant.featured_media) return;

    const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
    mediaGallery.setActiveMedia(`${this.dataset.section}-${this.currentVariant.featured_media.id}`, true);

    const modalContent = document.querySelector(`#ProductModal-${this.dataset.section} .product-media-modal__content`);
    if (!modalContent) return;
    const newMediaModal = modalContent.querySelector( `[data-media-id="${this.currentVariant.featured_media.id}"]`);
    modalContent.prepend(newMediaModal);
  }

  updateURL() {
    if (!this.currentVariant || this.dataset.updateUrl === 'false') return;
    window.history.replaceState({ }, '', `${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateShareUrl() {
    const shareButton = document.getElementById(`Share-${this.dataset.section}`);
    if (!shareButton || !shareButton.updateUrl) return;
    shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updateVariantStatuses() {
    const selectedOptionOneVariants = this.variantData.filter(
      (variant) => this.querySelector(':checked').value === variant.option1
    );
    const inputWrappers = [...this.querySelectorAll('.product-form__input')];
    inputWrappers.forEach((option, index) => {
      if (index === 0) return;
      const optionInputs = [...option.querySelectorAll('input[type="radio"], option')];
      const previousOptionSelected = inputWrappers[index - 1].querySelector(':checked').value;
      const availableOptionInputsValue = selectedOptionOneVariants
        .filter((variant) => variant.available && variant[`option${index}`] === previousOptionSelected)
        .map((variantOption) => variantOption[`option${index + 1}`]);
      this.setInputAvailability(optionInputs, availableOptionInputsValue);
    });
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach((input) => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.innerText = input.getAttribute('value');
      } else {
        console.log(input.getAttribute('value'));
        input.innerText = window.variantStrings.unavailable_with_option.replace('[value]', input.getAttribute('value'));
      }
    });
  }
  updatePickupAvailability() {     
  const pickUpAvailability = document.querySelector('pickup-availability');
    if (!pickUpAvailability) return;
    if (this.currentVariant && this.currentVariant.available) {   
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm) productForm.handleErrorMessage();
  }

  renderProductInfo() {
    fetch(`${this.dataset.url}?variant=${this.currentVariant.id}&section_id=${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html')
        const destination = document.getElementById(`price-${this.dataset.section}`);
        const source = html.getElementById(`price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);        
        if (source && destination) destination.innerHTML = source.innerHTML;
        const skuSource = html.getElementById(`Sku-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
        const skuDestination = document.getElementById(`Sku-${this.dataset.section}`);
        const inventorySource = html.getElementById(`Inventory-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
        const inventoryDestination = document.getElementById(`Inventory-${this.dataset.section}`);
        
        if (skuSource && skuDestination) {
          skuDestination.innerHTML = skuSource.innerHTML;
        //  skuDestination.classList.toggle('visibility-hidden', skuSource.classList.contains('visibility-hidden'));
        }

         if (inventorySource && inventoryDestination) inventoryDestination.innerHTML = inventorySource.innerHTML;
        const price = document.getElementById(`price-${this.dataset.section}`);

       const stickyDestination = document.getElementById(`sticky-price-${this.dataset.section}`);
       const stickySource = html.getElementById(`sticky-price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
         if (stickySource && stickyDestination) stickyDestination.innerHTML = stickySource.innerHTML;
        
        const stickyPrice = document.getElementById(`sticky-price-${this.dataset.section}`); 
        if (stickyPrice) stickyPrice.classList.remove('visibility-hidden');
        this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);

        const subTotal = document.getElementById(`subtotal-${this.dataset.section}`);
        const destination2 = document.getElementById(`subtotal-${this.dataset.section}`);
        const source2 = html.getElementById(`subtotal-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
        if (source2 && destination2) destination2.innerHTML = source2.innerHTML;

        if (inventoryDestination)
        inventoryDestination.classList.toggle('visibility-hidden', inventorySource.innerText === '');
      });
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForm = document.getElementById(`product-form-${this.dataset.section}`);
     const stickButton = document.getElementById('sticky-bar-button');
    
    if (!productForm) return;
    const addButton = productForm.querySelector('[name="add"]');
   
    
    const addButtonText = productForm.querySelector('[name="add"] > span');
    if (!addButton) return;
    
    
    if (disable) {
      addButton.setAttribute('disabled', 'disabled');    
      if (text) addButtonText.textContent = text;
    } else {
      addButton.removeAttribute('disabled');      
      addButtonText.textContent = window.variantStrings.addToCart;
    }

     if (!stickButton) return;    
    if (disable) {      
      stickButton.setAttribute('disabled', 'disabled');      
    } else {      
      stickButton.removeAttribute('disabled');      
    }
    if (!modifyClass) return;
  }

  setUnavailable() {
    const button = document.getElementById(`product-form-${this.dataset.section}`);
    const sku = document.getElementById(`Sku-${this.dataset.section}`);
    const addButton = button.querySelector('[name="add"]');
    const addButtonText = button.querySelector('[name="add"] > span');
    const price = document.getElementById(`price-${this.dataset.section}`); 
    const stickyPrice = document.getElementById(`sticky-price-${this.dataset.section}`); 
    const inventory = document.getElementById(`Inventory-${this.dataset.section}`);
    
    if (!addButton) return;
    addButtonText.textContent = window.variantStrings.unavailable;        
  //  if (sku) sku.classList.add('visibility-hidden');
     //if (inventory) inventory.classList.add('visibility-hidden');
  }

  getVariantData() {
    this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }
}

customElements.define('variant-selects', VariantSelects);

class VariantRadios extends VariantSelects {
  constructor() {
    super();
  }
  
 setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach((input) => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.classList.remove('disabled');
      } else {
        input.classList.add('disabled');
      }
    });
  }
  updateOptions() {
    const fieldsets = Array.from(this.querySelectorAll('fieldset'));
    this.options = fieldsets.map((fieldset) => {            
      fieldset.querySelector('.append-options-values').lastChild.textContent = Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;      
      return Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;      
    });
  }
}

customElements.define('variant-radios', VariantRadios);
class SwiperSlider extends HTMLElement {
    constructor() {
        super(), 
        this.slider = this.querySelector("[data-slider-options]"),
        this.init();
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    577: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    992: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('swiper-slider', SwiperSlider);


class TeamSlider extends HTMLElement {
    constructor() {
        super(), 
        this.slider = this.querySelector("[data-slider-options]"),
        this.init();
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    577: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    992: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                   1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-team-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('team-slider', TeamSlider);

class TestSlider extends HTMLElement {
    constructor() {
        super(), 
        this.slider = this.querySelector("[data-slider-options]"),
        this.init();
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
              fadeEffect: {
              crossFade: true
                },
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    577: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    992: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                  1280: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-test-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('test-slider', TestSlider);

class megaSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 20,
                loop: l,
                autoplay: s,
                preventClicks: true,
                preventClicksPropagation: true,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".dt-mega-coll__next"),
                    prevEl: this.slider.querySelector(".dt-mega-coll__prev")
                },
                scrollbar: {
                    el: ".swiper-scrollbar",
                    hide: true,
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1,
                        spaceBetween: 15
                    },
                    576: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    781: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('mega-menu-slider', megaSlider);

class FeaturedSwiperSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                autoplay: s,
                preventClicks: true,
                preventClicksPropagation: true,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                // scrollbar: {
                //     el: ".swiper-scrollbar",
                //     hide: true,
                // },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    type: "progressbar",
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    361: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1,
                        spaceBetween: 15
                    },
                    576: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    781: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1201: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('featured-swiper-slider', FeaturedSwiperSlider);

/*collection-list*/
class CollectionSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        let e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        let i = $.extend(!0, {
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            t = /^\d+$/;
        Object.keys(i).forEach(e => {
            "string" == typeof i[e] && t.test(i[e]) && (i[e] = parseInt(i[e], 10))
        });
        let s = !1;
        i.auto_play > 0 && (s = {
            delay: 1e3 * i.auto_play
        });
        let l = !1,
            o = !1;
        "true" === i.loop || !0 === i.loop ? l = !0 : 1 === i.loop ? (l = !0, o = !0) : (o = !1, l = !1);
        let n = $.extend(!0, {
                init: !1,
                loop: l,
                autoplay: s,
                centeredSlides: r,
                effect: "coverflow",
                spaceBetween: 0,
                coverflowEffect: {
                    rotate: 0,
                    stretch: 0,
                    depth: 300,
                    modifier: 1,
                    slideShadows: !0
                },
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: i.mobile,
                        slidesPerColumn: 1
                    },
                    560: {
                        slidesPerView: i.tablet,
                        slidesPerColumn: 1
                    },
                    768: {
                        slidesPerView: i.desktop,
                        slidesPerColumn: 1
                    },
                    992: {
                        slidesPerView: i.desktop,
                        slidesPerColumn: 1
                       
                    }
                }
            }, i.options),
            r = this.slider.querySelector("[data-collection-slider]"),
            a = new Swiper(r, n);
        a.on("init", () => {
            a.update()
        }), a.init()
    }
}
customElements.define("collection-slider", CollectionSlider);

class CollectionSwiperSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let l = !1;
        t.auto_play > 0 && (l = {
            delay: 1e3 * t.auto_play
        });
        let s = !1,
            o = !1;
        "true" === t.loop || !0 === t.loop ? s = !0 : 1 === t.loop ? (s = !0, o = !0) : (o = !1, s = !1);
        const r = $.extend(!0, {
                init: !1,
                
                loop: s,
                autoplay: l,
                centeredSlides: o,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    type: "progressbar",
                },
              //     scrollbar: {
              //   el: ".swiper-scrollbar",
              //  // hide: true,
              // },               
                lazy: !0,
          focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1,
                         spaceBetween: 10
                    },
                   480: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1,
                         spaceBetween: 30
                    },
                    577: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1,
                         spaceBetween: 30
                    },
                    900: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1,
                         spaceBetween: 30
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1,
                         spaceBetween: 30
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            p = new Swiper(n, r);
        p.on("init", (() => {
            p.update()
        })), p.init()
    }
}
customElements.define("collection-swiper-slider", CollectionSwiperSlider);
class Accordion {
    constructor(i) {
        this.el = i, this.summary = i.querySelector("summary"), this.content = i.querySelector(".accordion__content"), this.animation = null, this.isClosing = !1, this.isExpanding = !1, this.summary.addEventListener("click", (i => this.onClick(i)))
    }
    onClick(i) {
        i.preventDefault(), this.el.style.overflow = "hidden", this.isClosing || !this.el.open ? this.open() : (this.isExpanding || this.el.open) && this.shrink()
    }
    shrink() {
        this.isClosing = !0;
        const i = `${this.el.offsetHeight}px`,
            t = `${this.summary.offsetHeight}px`;
        this.animation && this.animation.cancel(), this.animation = this.el.animate({
            height: [i, t]
        }, {
            duration: 400,
            easing: "ease-out"
        }), this.animation.onfinish = () => this.onAnimationFinish(!1), this.animation.oncancel = () => this.isClosing = !1
    }
    open() {
        this.el.style.height = `${this.el.offsetHeight}px`, this.el.open = !0, window.requestAnimationFrame((() => this.expand()))
    }
    expand() {
        this.isExpanding = !0;
        const i = `${this.el.offsetHeight}px`,
            t = `${this.summary.offsetHeight+this.content.offsetHeight}px`;
        this.animation && this.animation.cancel(), this.animation = this.el.animate({
            height: [i, t]
        }, {
            duration: 400,
            easing: "ease-out"
        }), this.animation.onfinish = () => this.onAnimationFinish(!0), this.animation.oncancel = () => this.isExpanding = !1
    }
    onAnimationFinish(i) {
        this.el.open = i, this.animation = null, this.isClosing = !1, this.isExpanding = !1, this.el.style.height = this.el.style.overflow = ""
    }
}
document.querySelectorAll(".dt-details").forEach((i => {
    new Accordion(i)
}));
$("#accordian li").click((function() {
    var e = $(this),
        o = e.closest("ul"),
        t = o.find(".active"),
        i = e.closest("li"),
        l = i.hasClass("active"),
        s = 0;
    o.find("ul").slideUp((function() {
        ++s == o.find("ul").length && t.removeClass("active")
    })), l || (i.children("ul").slideDown(), i.addClass("active"))
})); 


 if($(".footer-links").length > 0) {
  $(".footer-links").each(function() {
    $(this).on('click', function() {
       if ($(this).hasClass('open')) {
              $(this).removeClass('open');
            } else {
              $(this).addClass('open');
            }
    });
  });
 }
 if($(".footer_address").length > 0) {
    $(".footer_address").each(function() {
    $(this).on('click', function() {
       if ($(this).hasClass('open')) {
              $(this).removeClass('open');
            } else {
              $(this).addClass('open');
            }
    });
  });
  }

$(document).ready(function () {
    const isAccordionEnabled = $("#enable_accordian"); // Fetch the element with the ID
    console.log("Accordion enabled:", isAccordionEnabled.length > 0); // Check if it exists



    if (isAccordionEnabled) {
        // Initialize accordion functionality
        document.querySelectorAll(".dt-details").forEach((i) => {
            new Accordion(i); // Ensure Accordion is defined elsewhere
        });

        // Footer menu toggle for smaller screens
        if (window.innerWidth < 767) {
            if ($(".footer_menu").length > 0) {
                $(".footer_menu").hide();
                $(".footer-links").each(function () {
                    $(this)
                        .find(".footer__title")
                        .on("click", function () {
                            $(this).toggleClass("open");
                            $(this).next("ul").slideToggle("slow");
                        });
                });
            }

            if ($(".footer_newsletter").length > 0) {
                $(".footer-block__newsletter").hide();
                $(".footer_newsletter").each(function () {
                    $(this)
                        .find(".footer-block__heading")
                        .on("click", function () {
                            $(this).toggleClass("open");
                            $(".footer-block__newsletter").slideToggle("slow");
                        });
                });
            }

            if ($(".footer_address").length > 0) {
                $(".footer--address").hide();
                $(".footer_address").each(function () {
                    $(this)
                        .find(".footer-block__heading")
                        .on("click", function () {
                            $(this).toggleClass("open");
                            $(".footer--address").slideToggle("slow");
                        });
                });
            }
        }
    } else {
        // If accordion is not enabled, ensure footer-block__details-content is displayed
        document.querySelectorAll(".footer-block__details-content").forEach((el) => {
            el.style.display = "block";
        });
    }
});



class InstaSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        let e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        let i = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            t = /^\d+$/;
        Object.keys(i).forEach(e => {
            "string" == typeof i[e] && t.test(i[e]) && (i[e] = parseInt(i[e], 10))
        });
        let s = !1;
        i.auto_play > 0 && (s = {
            delay: 1e3 * i.auto_play
        });
        let l = !1,
            o = !1;
        "true" === i.loop || !0 === i.loop ? l = !0 : 1 === i.loop ? (l = !0, o = !0) : (o = !1, l = !1);
        let n = $.extend(!0, {
                init: !1,
                spaceBetween: i.gap,
                loop: l,
                autoplay: s,
                centeredSlides: o,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                breakpoints: {
                    320: {
                        slidesPerView: i.mobile,
                        slidesPerColumn: 1
                    },
                    576: {
                        slidesPerView: i.tablet,
                        slidesPerColumn: 1
                    },
                    992: {
                        slidesPerView: i.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: i.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, i.options),
            r = this.slider.querySelector("[data-insta-slider]"),
            a = new Swiper(r, n);
        a.on("init", () => {
            a.update()
        }), a.init()
    }
}
customElements.define("insta-slider", InstaSlider);

class FlexSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        let e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        let i = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            t = /^\d+$/;
        Object.keys(i).forEach(e => {
            "string" == typeof i[e] && t.test(i[e]) && (i[e] = parseInt(i[e], 10))
        });
        let s = !1;
        i.auto_play > 0 && (s = {
            delay: 1e3 * i.auto_play
        });
        let l = !1,
            o = !1;
        "true" === i.loop || !0 === i.loop ? l = !0 : 1 === i.loop ? (l = !0, o = !0) : (o = !1, l = !1);
        let n = $.extend(!0, {
                init: !1,
                spaceBetween: 0,
                loop: l,
                autoplay: s,
                centeredSlides: o,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                breakpoints: {
                    320: {
                        slidesPerView: i.mobile,
                        slidesPerColumn: 1,
                        centeredSlides: false,
                    },
                    560: {
                        slidesPerView: i.tablet,
                        slidesPerColumn: 1,
                        centeredSlides: false,
                    },
                    990: {
                        slidesPerView: i.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, i.options),
            r = this.slider.querySelector("[data-flex-slider]"),
            a = new Swiper(r, n);
        a.on("init", () => {
            a.update()
        }), a.init()
    }
}
customElements.define("flex-slider", FlexSlider);


class RecommendationSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                autoplay: s,
                preventClicks: true,
                preventClicksPropagation: true,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0,
                    type: "progressbar",
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    576: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    990: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1541: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('recommendation-slider', RecommendationSlider);


class collectionSwiperSliderNew extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",               
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: true,
                grabCursor: true,
                direction: "horizontal",
                preloadImages: false,    
                lazy: true,
                // mousewheel: true,
                autoplay: s,
                preventClicks: true,
                preventClicksPropagation: true,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                  el: this.slider.querySelector(".swiper-pagination"), 
                   type: "progressbar",
                },                
              // scrollbar: {
              //   el: ".swiper-scrollbar",
              //   hide: true,
              // },
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    440: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    750: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    1024: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1,
                        spaceBetween: 50
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('collection-swiper-slider-2', collectionSwiperSliderNew);
class MultiSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    577: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    991: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('multi-slider', MultiSlider);

class BlogSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    577: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    990: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('blog-slider', BlogSlider);
class GridSwiper extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 60,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    576: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                     991: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-grid-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}




customElements.define('grid-swiper', GridSwiper);
class SupportSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    560: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    992: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('support-slider', SupportSlider);

class GridSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "horizontal",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: l,
                preventClicks: true,
          preventClicksPropagation: true,
                autoplay: s,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                    el: this.slider.querySelector(".swiper-pagination"),
                    clickable: !0
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    576: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                     991: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('grid-slider', GridSlider);







/*Reveal*/
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting){
            entry.target.classList.add('reveal');
        }
       // else{entry.target.classList.remove('reveal');}
    });
});
const hiddenElements = document.querySelectorAll('.shopify-section');
hiddenElements.forEach((el) => observer.observe(el));




document.querySelectorAll('[id^="shopify-section-"]').forEach((card, index) => {
  console.log = function(){};
   if(card.classList.contains('section-featured-collection') || card.classList.contains('section-collection-list')) {     
    const topHeading = card.querySelectorAll('.for-arrow-alignment');        
    const cardHeight = parseInt(topHeading[0].clientHeight);
    const topValue = cardHeight / 2 + 5;
    const cardTopCSS = "calc(50% - "+topValue+'px)';     
    const swiperContainer = card.querySelector('.swiper');    
     if(!swiperContainer) return;
    const swiperPrevElement = swiperContainer.querySelector('.swiper-button-prev');    
    const swiperNextElement = swiperContainer.querySelector('.swiper-button-next');     
    if(!swiperPrevElement || !swiperNextElement) return
    swiperPrevElement.setAttribute('style', 'top:'+cardTopCSS);    
    swiperNextElement.setAttribute('style', 'top:'+cardTopCSS);
      
  }        
});


document.querySelectorAll('[id^="block-tab-1"]').forEach((arrowTab, index) => {
  console.log = function(){};
   if(arrowTab.classList.contains('product-tab-carousel')) {    
    const topHeading = arrowTab.querySelectorAll('.for-arrow-alignment');     
    const cardHeight = parseInt(topHeading[0].clientHeight);    
    const topValue = cardHeight / 2 + 5;
    const cardTopCSS = "calc(50% - "+topValue+'px)';
    const swiperContainer = arrowTab.querySelector('.swiper-container');
      if(!swiperContainer) return;
    const swiperPrevElement = swiperContainer.querySelector('.swiper-button-prev');    
    const swiperNextElement = swiperContainer.querySelector('.swiper-button-next');
     if(!swiperPrevElement || !swiperNextElement) return
    swiperPrevElement.setAttribute('style', 'top:'+cardTopCSS);    
    swiperNextElement.setAttribute('style', 'top:'+cardTopCSS);
  }        
});




let accountModel = document.querySelector('[id^="login-modal__"]');
let accountButton = document.querySelector('.header__icon--account');
let accountClose = document.querySelector('.details-modal-close');
if(accountButton){
  accountButton.addEventListener("click", function (e) {    
  accountModel.classList.toggle('login-modal-active');
});
accountClose.addEventListener("click", function (e) {    
  accountModel.classList.remove('login-modal-active');
});
}


document.querySelectorAll('[id^="shopify-section-"]').forEach((card, index) => {
   if(card.classList.contains('featured-blog')) {     
    const topHeading = card.querySelectorAll('.for-arrow-alignment');        
    const cardHeight = parseInt(topHeading[0].clientHeight);
    const topValue = cardHeight / 2 + 5;
    const cardTopCSS = "calc(50% - "+topValue+'px)';     
    const swiperContainer = card.querySelector('.swiper');    
     if(!swiperContainer) return;
    const swiperPrevElement = swiperContainer.querySelector('.swiper-button-prev');    
    const swiperNextElement = swiperContainer.querySelector('.swiper-button-next');     
    if(!swiperPrevElement || !swiperNextElement) return
    swiperPrevElement.setAttribute('style', 'top:'+cardTopCSS);    
    swiperNextElement.setAttribute('style', 'top:'+cardTopCSS);
  }        
});



class FeaturedVerticalSlider extends HTMLElement {
    constructor() {
        super(), this.slider = this.querySelector("[data-slider-options]"), this.init()
    }
    init() {
        const e = this.slider.getAttribute("data-slider-options");
        if (null === e || "" === e) return null;
        const t = $.extend(!0, {
                effect: "slide",
                direction: "vertical",
                autoplay: !0,
                autoplaySpeed: 5,
                space: 30,
                center: !0,
                options: {}
            }, JSON.parse(e)),
            i = /^\d+$/;
        Object.keys(t).forEach((e => {
            "string" == typeof t[e] && i.test(t[e]) && (t[e] = parseInt(t[e], 10))
        }));
        let s = !1;
        t.auto_play > 0 && (s = {
            delay: 1e3 * t.auto_play
        });
        let l = !1,
            r = !1;
        "true" === t.loop || !0 === t.loop ? l = !0 : 1 === t.loop ? (l = !0, r = !0) : (r = !1, l = !1);
        const o = $.extend(!0, {
                init: !1,
                spaceBetween: 30,
                loop: false,
                grabCursor: true,
                autoplay: s,
                preventClicks: true,
                preventClicksPropagation: true,
                direction: "vertical",
                // mousewheel: true,
                centeredSlides: r,
                navigation: {
                    nextEl: this.slider.querySelector(".swiper-button-next"),
                    prevEl: this.slider.querySelector(".swiper-button-prev")
                },
                pagination: {
                  el: this.slider.querySelector(".swiper-pagination"),
                  type: "progressbar",
                },
                lazy: !0,
                focusableElements: 'input, select, option, textarea, video, label',
                breakpoints: {
                    320: {
                        slidesPerView: t.mobile,
                        slidesPerColumn: 1
                    },
                    576: {
                        slidesPerView: t.tablet,
                        slidesPerColumn: 1
                    },
                    1024: {
                        slidesPerView: t.laptop,
                        slidesPerColumn: 1
                    },
                    1200: {
                        slidesPerView: t.desktop,
                        slidesPerColumn: 1
                    }
                }
            }, t.options),
            n = this.slider.querySelector("[data-swiper-slider]"),
            a = new Swiper(n, o);
        a.on("init", (() => {
            a.update()
        })), a.init()
    }
}
customElements.define('featured-vertical-slider', FeaturedVerticalSlider);


//contact multicolumn 
if($('.multicolumn-list__item').length > 0 ){
var allItems = document.querySelectorAll(".multicolumn-list__item");
 var items = document.querySelector(".multi-column").querySelectorAll(".multicolumn-list__item");
  items.forEach(item => {    
    item.addEventListener("mouseover", () => {      
       items.forEach(image => {
      image.classList.remove('active');
    });
      item.classList.add("active");  
  });
  });
}


//variant swatch color 
function handleSwatchGroups(container) {
  container.querySelectorAll('.variant-option-color').forEach(function (swatchGroup) {
    const swatches = swatchGroup.querySelectorAll('.color-values');
    const maxVisible = 3;

    if (swatches.length > maxVisible) {
      swatches.forEach((swatch, index) => {
        if (index >= maxVisible) {
          swatch.classList.add('hidden-swatch');
          swatch.style.display = 'none';
        }
      });

      const toggleBtn = swatchGroup.querySelector('.color-values-plus a');
      if (toggleBtn && !toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = "true";
        toggleBtn.addEventListener('click', function (e) {
          e.preventDefault();
          swatches.forEach(swatch => {
            swatch.style.display = 'inline-block';
          });
          toggleBtn.closest('.color-values-plus').style.display = 'none';
        });
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  
  handleSwatchGroups(document);
  const observer = new MutationObserver(function (mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            handleSwatchGroups(node);
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});