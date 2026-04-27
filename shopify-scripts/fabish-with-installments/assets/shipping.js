
class ShippingCalculator extends HTMLElement {
  constructor() {
    super();
    this.errors = this.querySelector('#ShippingCalculatorErrors');
    this.success = this.querySelector('#wrapper-response');
    this.zip = this.querySelector('#address_zip');
    this.country = this.querySelector('#address_country');
    this.province = this.querySelector('#address_province');
    this.button = this.querySelector('.get-rates');

    // Initialize country-province selector
    new Shopify.CountryProvinceSelector('address_country', 'address_province', {
      hideElement: 'address_province_container'
    });

    // Bind event
    this.button.addEventListener('click', this.onSubmitHandler.bind(this));
  }

  onSubmitHandler() {
    this.errors.classList.add('hidden');
    this.success.classList.add('hidden');
    this.button.classList.add('loading');
    this.button.setAttribute('disabled', true);

    const body = JSON.stringify({
      shipping_address: {
        zip: this.zip.value,
        country: this.country.value,
        province: this.province.value
      }
    });

    fetch(`${window.routes.cart_url}/shipping_rates.json`, { ...fetchConfig('javascript'), body })
      .then(response => response.json())
      .then(parsedState => {
        if (parsedState.shipping_rates) {
          this.success.innerHTML = parsedState.shipping_rates
            .map(rate => `<p>${rate.name}: ${rate.price} ${Shopify.currency.active}</p>`)
            .join('');
          this.success.classList.remove('hidden');
        } else {
          this.errors.querySelector('.errors').innerHTML = Object.entries(parsedState)
            .map(([attr, messages]) => `${attr.charAt(0).toUpperCase() + attr.slice(1)} ${messages[0]}`)
            .join('; ');
          this.errors.classList.remove('hidden');
        }
      })
      .catch(console.error)
      .finally(() => {
        this.button.classList.remove('loading');
        this.button.removeAttribute('disabled');
      });
  }
}

customElements.define('shipping-calculator', ShippingCalculator);