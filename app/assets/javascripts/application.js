//
// For guidance on how to add JavaScript see:
// https://prototype-kit.service.gov.uk/docs/adding-css-javascript-and-images
//

window.GOVUKPrototypeKit.documentReady(() => {
  // Add JavaScript here
  $(document).ready(function(){
  $("#searchbox").keyup(function(){ 
      var filter = $(this).val(), count = 0;
      $(".govuk-form-group li").each(function(){
          if ($(this).text().search(new RegExp(filter, "i")) < 0) {
              $(this).fadeOut();
          } else {
              $(this).show();
              count++;
          }
      });
      var numberItems = count;
      $("#result-count").text("Number of Results = "+count);
  });
});
})

