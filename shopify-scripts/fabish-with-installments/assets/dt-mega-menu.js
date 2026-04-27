$(document).ready(function ($) {
  "use strict"; 
  function megaMenu() {
    if($('.default_dropdown').length > 0 ) {
    if ($("#header .page-full-width").length) {
      var parentRow = $("#header .page-full-width > .row");
      var parentLeft = parseInt(parentRow.css("marginLeft").replace("px", ""));
    } else {
      var parentRow = $("#header .page-width .row");
      var parentLeft = parseInt(parentRow.offset().left);
    }
    var parentWidth = parentRow.width();

    $("#header .dt-nav li:not(.close-nav)").each(function () {
      var thisItem = $(this);
      if (thisItem.hasClass("menu-item-has-children")) {
        var thisItemLeft = thisItem.find(".megamenu_megamenu > a").offset().left;
        var menuLeft = parseInt(thisItemLeft - parentLeft);
        thisItem.find(".sub-menu-block").css("width", parentWidth);
       }
    });

    $("sticky-header .dt-nav li:not(.close-nav)").each(function () {
      var thisItem = $(this);
      if (thisItem.hasClass("menu-item-has-children")) {
        var thisItemLeft = thisItem.find(".megamenu_megamenu > a").offset().left;
        var menuLeft = parseInt(thisItemLeft - parentLeft);        
        thisItem.find(".sub-menu-block").css("width", parentWidth);      
      }
    });
    window.setTimeout(function () {
      $(window).trigger("resize");
    }, 800);

    }
  }
  var megaMenuResize = false;
  $(window).bind("resize", function () {
    if (!megaMenuResize) {
      megaMenu();
      megaMenuResize = true;
    }
  });
  megaMenu();
});

$(function () {
  if ($(window).width() >= 1200) {
    $(".deskTabs a").click(function () {
      let id = $(this).attr("href");
      $(".deskTabs li").removeClass("active");
      $(this).parent().addClass("active");
      $(this).parent().parent().parent().parent().addClass("active");
      $(".tabs-content li.dt-sc-menu-tabs").hide();
      $(this).parent().parent().parent().parent().find(id).show();

      return false;
    });
  }
  if ($(window).width() <= 1199) {
    $(".mobileTabs .tabs  li").each(function () {
      $(this).click(function () {
        $(this).next("div").slideToggle(0);
      });
    });
  }
});
$(document).ready(function () {
  $("#category-menu-button").click(function () {
    $(this).toggleClass("open");
    $(".category-wrapper").toggleClass("open");
    $(".category-wrapper").slideToggle(0);
  });
});

