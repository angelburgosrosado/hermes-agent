
/**
 * @fileoverview The file mananage dT Theme cookie based CompareList 
 * dT_General.js, axios, vue libs are dependencies. 
 * @package
 */
class dT_CompareList {

    constructor() {
        this.CompareListData = [];

        this.LOCAL_STORAGE_CompareLIST_KEY = 'shopify-Comparelist';
        this.LOCAL_STORAGE_DELIMITER = ',';
    }

    setListLocalStorageKey(LOCAL_STORAGE_CompareLIST_KEY, LOCAL_STORAGE_DELIMITER) {
        this.LOCAL_STORAGE_CompareLIST_KEY = LOCAL_STORAGE_CompareLIST_KEY;
        this.LOCAL_STORAGE_DELIMITER = LOCAL_STORAGE_DELIMITER;
    }

    setupGrid(listType) {
        var Comparelist = this.getComparelist();

        var requests = Comparelist.map(function (handle) {
            var productTileTemplateUrl = '/products/' + handle + '?view=json';

            var getProductsList =  this.getProductResponse(productTileTemplateUrl);

            return getProductsList;
        }.bind(this));
      

       return Promise.all(requests).then(function (responses) {
              var ComparelistProductCards = responses.join('%$$%');
              var ComparelistProductCards = ComparelistProductCards;

              var a_ComparelistRecords = ComparelistProductCards.split("%$$%");

              let recordsObj = [];

              if (Array.isArray(a_ComparelistRecords) && a_ComparelistRecords.length) {
                  var index = 0;
                  a_ComparelistRecords.forEach(record => {
                      var a_record = record.split("~~");

                      var recordObj = {
                              id:             a_record[0],
                              product_title:  a_record[1],
                              product_handle: a_record[2],
                              product_image:  a_record[3],
                              vendor:         a_record[4],
                              type:           a_record[5],
                              money_price:    a_record[6],
                              price_min:      a_record[7],
                              price_max:      a_record[8],
                              available:      a_record[9],
                              price_varies:   a_record[10],
                              variant_id:     a_record[11],
                              variant_title:  a_record[12],
                              sku:            a_record[13],
                              description:    a_record[14],
                              quantity:       "1",
                              product_url:    '/products/'+a_record[2]
                      };

                      recordsObj[index] = recordObj;

                      index = index + 1;

                  });

              }

              return recordsObj;

         }).then(function(data) {
         
             this.CompareListData = data;  
         
             return data;

         }.bind(this));

    }

    getCompareListRecords()
    {
        return this.CompareListData;
    }


    getProductResponse(url) {
            
      var responseResult = fetch(url)
      	.then((response) => { 
          //console.log(response); 
          return response.text(); })
      	.then((data) => { 
          //console.log(data); 
          return data.replace(/^\s*[\r\n]/gm, ''); });
     
      return responseResult;
      
    }

    getTotalCount() {
		return this.getComparelist().length;
    }
  
    getComparelist() {
        var Comparelist = localStorage.getItem(this.LOCAL_STORAGE_CompareLIST_KEY) || false;
        if (Comparelist) return Comparelist.split(this.LOCAL_STORAGE_DELIMITER);
        return [];
    }

    setComparelist(array) {
        var Comparelist = array.join(this.LOCAL_STORAGE_DELIMITER);
        if (array.length) localStorage.setItem(this.LOCAL_STORAGE_CompareLIST_KEY, Comparelist);
        else localStorage.removeItem(this.LOCAL_STORAGE_CompareLIST_KEY);
        return Comparelist;
    }

    updateComparelist(handle) {
        var Comparelist = this.getComparelist();
        var indexInComparelist = Comparelist.indexOf(handle);
        if (indexInComparelist === -1) Comparelist.push(handle);
        else Comparelist.splice(indexInComparelist, 1);
        return this.setComparelist(Comparelist);
    }

    removeComparet(handle) {
        var Comparelist = this.getComparelist();

        Comparelist = this.remove(Comparelist, handle);

        return this.setComparelist(Comparelist);  
    }

    resetComparelist() {
        return this.setComparelist([]);
    }

    isAddedIntoList(handle) {
        var Comparelist = this.getComparelist();  
        
        return Comparelist.includes(handle);
    }

    remove(arr) {
        var what, a = arguments, L = a.length, ax;
        while (L > 1 && arr.length) {
            what = a[--L];
            while ((ax= arr.indexOf(what)) !== -1) {
                arr.splice(ax, 1);
            }
        }
        return arr;
    };
}


async function getDTProduct(url) {
    
 
    try {
      let res = await fetch(url);

      return res.text().then(function (text) {      
        return text;
      });

        
    } catch (error) {
        console.log(error);
    }
}

class dTXCompare extends HTMLElement {
    constructor() {
      super();

      this.dTCompareList = new dT_CompareList();
      this.dTCompareList.setListLocalStorageKey('dt-compare-list', ',');

      this.debouncedOnSubmit = debounce((event) => {
        this.onSubmitHandler(event);
      }, 500);


      this.addCompareList = this.querySelector('.add-compare');
      this.productHandle = this.addCompareList.getAttribute('data-product_handle');

      this.addCompareList.addEventListener('click', this.debouncedOnSubmit.bind(this));

      this.initLoad();
    }

    onSubmitHandler(event) {
        event.preventDefault();

        if (this.dTCompareList.isAddedIntoList(this.productHandle)) {
             window.location = "/pages/compare";
        } else {
          const CompTotal = this.dTCompareList.getTotalCount();
       console.log("CompTotal=="+CompTotal);
    if (CompTotal > 3) {   
      var CompareModal = document.getElementById("compareModal");
      var XBtn = document.getElementById("compareModalClose");
      document.querySelector('body').classList.add('alert-overlay-wrapper');
      CompareModal.style.display = "block"; 
      XBtn.onclick = function() {
        CompareModal.style.display = "none";
        document.querySelector('body').classList.remove('alert-overlay-wrapper');
      }    
      
      
     console.log("LastAdded=="+this.productHandle);
      const AnItem = this.productHandle
      delete localStorage.AnItem;
      return;
    }
          else {
          
            this.addCompareList.classList.add("adding");

            this.dTCompareList.updateComparelist(this.productHandle);

            setTimeout(this.postAdd.bind(this), 1000);
          }
        }
    }

    postAdd() {
       var dtxCount = document.getElementsByClassName('dtxc-compare-count');
    if (dtxCount.length > 0) {
    document.querySelector(".dtxc-compare-count").setAttribute('count',this.dTCompareList.getTotalCount());
    } 
        this.addCompareList.classList.remove("adding");
        this.addCompareList.classList.add("added");   
    }

    initLoad() {
        if (this.dTCompareList.isAddedIntoList(this.productHandle)) {
            this.addCompareList.classList.add("added");
        }    
    }
}    

customElements.define('dtx-compare', dTXCompare);



class dTXComparetGrid extends HTMLElement {
    constructor() {
        super();
         
        this.gridTemplate = this.querySelector('.grid_template');

        this.dtxTable = this.querySelector(".dtx-table");
        this.dtxNoRecord = this.querySelector(".dtx-grid-empty");
      
        this.grid_type = this.getAttribute('grid_type');     
        //this.initLoad();
       
    }

    initLoad() {

        var dTCompareList = new dT_CompareList();
        if ("compareList" == this.grid_type) {
          dTCompareList.setListLocalStorageKey('dt-compare-list', ',');
        }
        
        dTCompareList.setupGrid().then(function(data) {
           this.generateGrid(data);          
           return data;
        }.bind(this));  

       var dtxCount = document.getElementsByClassName('grid-count-bubble');      
 
   }
  
   generateGrid(a_records) {
      var data = this.gridTemplate.innerHTML;
      
     
     if (typeof a_records[0].product_handle !== 'undefined') {
      if (a_records.length > 0 ) {

          a_records.forEach(function(record) { 

              var newRow = this.dtxTable.insertRow(this.dtxTable.rows.length);           
              newRow.id = 'row_' + record.id;
              newRow.innerHTML = this.buidRow(record);
           

          }.bind(this));
        
        this.dtxNoRecord.classList.add("dtx-grid-hide");
        this.dtxTable.classList.add("dtx-grid-show");
        
      }
     }else {
       this.dtxTable.classList.add("dtx-grid-hide");
       this.dtxNoRecord.classList.add("dtx-grid-show");
     }

  }
  
  buidRow(record) {
    var templateData = this.gridTemplate.innerHTML;    
    templateData = templateData.replace(/{item.product_handle}/gi, record.product_handle);
    templateData = templateData.replace(/{item.product_url}/gi,    record.product_url);
    templateData = templateData.replace(/{item.product_image}/gi,  record.product_image);
    templateData = templateData.replace(/{item.product_title}/gi,  record.product_title);
    templateData = templateData.replace(/{item.money_price}/gi,    record.money_price);
    templateData = templateData.replace(/{item.variant_id}/gi,     record.variant_id);    
    if(record.type){    
    templateData = templateData.replace(/{item.product_type}/gi,   record.type);
    }
    else {
     templateData = templateData.replace(/{item.product_type}/gi,   'Nil'); 
    }   
     if(record.sku){      
    templateData = templateData.replace(/{item.product_sku}/gi,    record.sku);
    }
    else {
     templateData = templateData.replace(/{item.product_sku}/gi,    'Nil');
    }
    if(record.vendor){      
    templateData = templateData.replace(/{item.product_vendor}/gi, record.vendor);
    }
    else {
     templateData = templateData.replace(/{item.product_vendor}/gi,    'Nil');
    }
     if(record.description){   
    templateData = templateData.replace(/{item.product_description}/gi,    record.description);
     }
    else {
     templateData = templateData.replace(/{item.product_description}/gi,    'Nil');
    }
    if(record.available == 'true') {
    templateData = templateData.replace(/{item.available}/gi,     DT_THEME.strings.in_stock);  
    }
    else {
    templateData = templateData.replace(/{item.available}/gi,     window.variantStrings.soldOut);
    }
    return templateData;       
    
  }
  
  connectedCallback() {
    // console.log('Custom square element added to page.');
     this.initLoad();
   
  }
  
  
}

customElements.define('dtx-compare-grid', dTXComparetGrid);



class dTXRemoveCompareItem extends HTMLElement {
  
    constructor() {
        super();
         
        this.removeItem = this.querySelector('.remove-item');


        this.debouncedOnSubmit = debounce((event) => {
      	  this.removeListItem(event);
      	}, 500);

      
        this.grid_type = this.getAttribute('grid_type');
      
        this.productHandle = this.removeItem.getAttribute('data-product_handle');

        this.removeItem.addEventListener('click', this.debouncedOnSubmit.bind(this));

    }
  
    removeListItem(event)
    {
      event.preventDefault();
      
      var dTCompareList = new dT_CompareList();
      if ("compareList" == this.grid_type) {
        dTCompareList.setListLocalStorageKey('dt-compare-list', ',');
      }
        

      dTCompareList.removeComparet(this.productHandle);
      
      window.location.reload();
    }  
  
}

customElements.define('dtx-remove-compare-item', dTXRemoveCompareItem);



class dTXCompareCount extends HTMLElement {
  
  static get observedAttributes() {
    return ['count'];
  }  
  
  constructor() {
      super();
         
      this.gridCountBubble = this.querySelector('.grid-count-bubble');
      
      this.grid_type = this.getAttribute('grid_type');
     
      this.initLoad();
  }
  
  initLoad() {

      var dTCompareList = new dT_CompareList();
      if ("compareList" == this.grid_type) {
        dTCompareList.setListLocalStorageKey('dt-compare-list', ',');
      }
      
      var totalCount = dTCompareList.getTotalCount();
      
      //this.setAttribute('count', totalCount);   
      this.gridCountBubble.querySelector("span").innerHTML = totalCount;
     
    const loadCount = this.gridCountBubble.querySelector("span").innerHTML;
    if(parseInt(loadCount) == 0) {   
      document.querySelector('.dtxc-compare-count').classList.add('count-zero');
    } else{
      document.querySelector('.dtxc-compare-count').classList.add('count-exist');
    }
    
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
      this.initLoad();
  }
  
  
}

customElements.define('dtx-compare-count', dTXCompareCount);





