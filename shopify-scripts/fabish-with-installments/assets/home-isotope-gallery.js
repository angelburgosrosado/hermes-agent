 $(document).ready(function(){
    isotopeGallery(); 
    $(document).on('click', '.gallery-filter .button', function(){
      $('.gallery-filter .button').removeClass('active');
      $('.gallery-filter .button-group').toggleClass('expanded');
      $(this).addClass('active');
    
    });
    
    $(document).click(function(event) {
      if (!$(event.target).closest(".gallery-filter").length) {
        $("body").find(".gallery-filter .button-group").removeClass("expanded");
      }
    });
    });

  function isotopeGallery() {
  this.isotopAdd = document.querySelector('[id^="isotope-gallery-"]');  
  this.cutterSize = this.isotopAdd.getAttribute('data-spacing');  
  this.gridITems = this.isotopAdd.querySelector('[id^="isotope-grid-"]');    
  this.filterTab = this.isotopAdd.querySelector('[id^="filters-tab-"]');    

    console.log(this.isotopAdd+"\n"+this.cutterSize+"\n"+this.gridITems+"\n"+this.filterTab);
  if (!this.isotopAdd) { return; }          
  var $grid = $(this.gridITems).isotope({
               // layoutMode: 'masonryHorizontal',
                itemSelector: '.isotope-selector',   
               // percentPosition: true,                
               // masonryHorizontal: {
               //    rowHeight: 100
               //  }
                masonry: {
                  columnWidth: '.grid-sizer',
                  gutter: this.cutterSize
                } 
                  });


    var filters = {};
    $(this.filterTab).on( 'click', '.button', function( event ) {
      var $button = $( event.currentTarget );
    // get group key
    var $buttonGroup = $button.parents('.button-group');
    var filterGroup = $buttonGroup.attr('data-filter-group');
    // set filter for group
    filters[ filterGroup ] = $button.attr('data-filter');
    // combine filters
    var filterValue = concatValues( filters );
    // set filter for Isotope
    $grid.isotope({ filter: filterValue });
  });
  // change is-checked class on buttons
  $('.button-group').each( function( i, buttonGroup ) {
    var $buttonGroup = $( buttonGroup );
    $buttonGroup.on( 'click', 'button', function( event ) {
      $buttonGroup.find('.is-checked').removeClass('is-checked');
      var $button = $( event.currentTarget );
      $button.addClass('is-checked');
    });
  });

  // flatten object by concatting values
  function concatValues( obj ) {
    var value = '';
    for ( var prop in obj ) {
      value += obj[ prop ];
    }
    return value;
  }


  $('.gallery').magnificPopup({
    type: 'image',
    closeOnBgClick: 'true',
    enableEscapeKey: 'true',
    mainClass: 'mfp-img-mobile isotope-gallery',
    image: {
      verticalFit: true
    }
  });
}

document.addEventListener('shopify:block:select', function(event) {
  isotopeGallery();
  const blockSelectedIsSlide = event.target.classList.contains('isotope-selector');
  if (!blockSelectedIsSlide) return;
  if (blockSelectedIsSlide) {
  isotopeGallery();
  };
});

document.addEventListener('shopify:block:deselect', function(event) {
  const blockDeselectedIsSlide = event.target.classList.contains('isotope-selector');
  if (!blockDeselectedIsSlide) return;
if (blockDeselectedIsSlide) {
  isotopeGallery();
  };
});

  document.addEventListener("shopify:section:load", function(event) {
  if (document.getElementById(`shopify-section-${event.detail.sectionId}`).classList.contains('isotope-gallery')) {
   isotopeGallery();  
  }
});     
  

document.addEventListener('shopify:section:reorder', () => isotopeGallery());
document.addEventListener('shopify:section:select', () => isotopeGallery());
document.addEventListener('shopify:section:deselect', () => isotopeGallery());
document.addEventListener('shopify:inspector:activate', () => isotopeGallery());
document.addEventListener('shopify:inspector:deactivate', () => isotopeGallery());
