$(document).ready(function () {
  $(".video__btn-play").on("click", function (e) {
    e.preventDefault();
    $('body').addClass('overlay-active');
    $(".video-container, .video-wrapper, .pop-up__video-close , .video-popup").css('display','flex');
    var srchref = "",
        autoplay = "",
        id = $(this).data("id");
    if ($(this).data("type") == "vimeo")
      var srchref = "//player.vimeo.com/video/";
    else if ($(this).data("type") == "youtube")
      var srchref = "https://www.youtube.com/embed/";
    if ($(this).data("autoplay") == true) autoplay = "?autoplay=1";
    $("#video-popup-iframe").attr("src", srchref + id + autoplay);
    $("#video-popup-iframe").on("load", function () {
      $(".video-wrapper").show();
    });
  });

  $(".pop-up__video-close").on("click", function (e) {
     $('body').removeClass('overlay-active');
    $(".video-container, .video-wrapper, .pop-up__video-close , .video-popup").css('display','none');
    $("#video-popup-iframe").attr("src", "");
  });
});



// $(document).ready(function() { 
// // Watch More Link click handlers
//     const $popup = $('.video-popup');
//     const $modal = $('#modal');
//     const $closeIcon = $('.close');
//     const $watchMoreLink = $('.watch-more');
//     var youTubeUrl = $('.video-container iframe').attr('src');

//     $watchMoreLink.click(function(e) {
//         $popup.fadeIn(200);
//         $modal.fadeIn(200);
//         e.preventDefault();
//         $('body').addClass('overlay-active');
//        $(this).closest('.video-container iframe').attr('src', youTubeUrl+"?&amp;autoplay=1&amp;mute=1");
//     });
//     $closeIcon.click(function () {
//         $popup.fadeOut(200);
//         $modal.fadeOut(200);
//        $('body').removeClass('overlay-active');
//        $(this).parent('.video-popup').find('.video-container iframe').attr('src', youTubeUrl+"?&amp;autoplay=0&amp;mute=0");
//     });
//     // for escape key
//     $(document).on('keyup',function(e) {
//         if (e.key === "Escape") {
//            $popup.fadeOut(200);
//            $modal.fadeOut(200);
//           $('.video-container iframe').attr('src', youTubeUrl+"?&amp;autoplay=0&amp;mute=0");
//           $('body').removeClass('overlay-active');
//         }
//     });
//     // click outside of the popup, close it
//     $modal.on('click', function(e){
//         $popup.fadeOut(200);
//         $modal.fadeOut(200);
//        $('body').removeClass('overlay-active');
//       $(this).parent('.video-popup').find('.video-container iframe').attr('src', youTubeUrl+"?&amp;autoplay=0&amp;mute=0");
//     });
// });