
   
jQuery(document).ready(function($){

  console.log('content js loading...');


  function disable_likes(action_selectors){

    // var action_selectors = "[data-testid='fb-ufi-likelink'], .comment_link, [data-testid='ufi_share_link_loaded'], [data-testid='ufi_comment_like_link'], .UFIReplyLink, [data-testid='ufi_reply_like_link']";

    $("body").find(action_selectors).each(function(){

      // state = this.hasClass(disabled);
      state = true;

      // add attributes
      $.fn.extend({
          update_attributes: function(state) {
              return this.each(function() {
                  var $this = $(this);

                  if(state == true){
                    cursor = "not-allowed";
                    text = $this.text();
                  }else{
                    cursor = "pointer";
                    text = "Locked";
                    
                  }

                  $this.css("cursor", cursor);
                  $this.data('disabled', state);
                  $this.attr('disabled', state);
                  $this.text(text);

                  $this.toggleClass('disabled', state);
              });
          },
          replace_tag: function(state){
              return this.each(function(){
                  if(state == true){
                    replacementTag = 'span';
                  }else{
                    replacementTag = 'a';                    
                  }

                  var outer = this.outerHTML;

                  // Replace opening tag
                  var regex = new RegExp('<' + this.tagName, 'i');
                  var newTag = outer.replace(regex, '<' + replacementTag);

                  // Replace closing tag
                  regex = new RegExp('</' + this.tagName, 'i');
                  newTag = newTag.replace(regex, '</' + replacementTag);

                  $(this).replaceWith(newTag);
              });                   
          }
      });

      // disable routine
      $(this).update_attributes(true);
      $(this).replace_tag(true);

    });    
  }

  function test(){
     chrome.runtime.sendMessage('helow');    
  }

  function init(){

    var action_selectors = {};

    // 1. get storage variables
    action_selectors = get_storage('media_facebook', function(result){
        
        result.media_facebook.forEach(function(action) {

          for (var selector in action){
              if (action.hasOwnProperty(selector) && selector == 'selector') {
                disable_likes( action[selector] );
              }
          }

        });

    });

  }

  setInterval(function() {
    init();
  }, 5000);

});