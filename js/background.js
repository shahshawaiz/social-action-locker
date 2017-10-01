
/**
 * contribute at github.com/shahshawaiz/social-action-locker
 * 
 */

/**
 * constants
 */

console.log('background js load start...');

var endpoint = 'http://parse-shah.herokuapp.com/parse/classes/SocialLockerActions';
var endpoint_app_id = 'parse-shah';

var media_facebook = 1;
var media_twitter = 2;

var media_defaults = [
  media_facebook
];

var media_action_id_facebook_nf_like = 1; // newsfeed like
var media_action_id_facebook_nf_comment = 2; // newsfeed comment
var media_action_id_facebook_nf_share = 3; //newsfeed share
var media_action_id_facebook_cs_like = 4; //comment secion like
var media_action_id_facebook_cs_reply = 5; // comment section reply/ like reply

var action_media_facebook_id_defaults = [
  media_action_id_facebook_nf_like,
  media_action_id_facebook_nf_comment,
  media_action_id_facebook_nf_share,
  media_action_id_facebook_cs_like,
  media_action_id_facebook_cs_reply,
];

/**
* fetch social-action properties
*
* header 
*   X-Parse-Application-Id   : pasre-shah
*   Content-Type            : application/json
* 
* endpoints
*   http://parse-shah.herokuapp.com/parse/classes/SocialLockerActions
*   http://parse-shah.herokuapp.com/parse/classes/SocialLockerActions?where={"media":1, "extension_id: 3"}
* 
*/
function fetch_actions(media_id){

	var xhr = new XMLHttpRequest();

	// pre checks
	// xhr.onreadystatechange = function(){
	//   if (this.readyState == 4 && this.status == 200){

	//   }else{

	//   } 
	// };

	endpoint_with_media = endpoint + '?where={"media":' + media_id + '}';

	jQuery.ajax({
         url: endpoint_with_media,
         type: "GET",
         beforeSend: function(xhr){
      			xhr.setRequestHeader('X-Parse-Application-Id', endpoint_app_id);
      			xhr.setRequestHeader('Content-Type', 'application/json');
         },
         success: function(res) {
            // facebook storage
            set_storage('media_facebook', 'test');
         }
  });
}

/**
 * set storage variable
 * @param {[type]} media_facebook_response [description]
 */
function set_storage(key, value){

    chrome.storage.local.set({key: value}, function() {
      // Notify that we saved.
    });
}

/**
 * get storage variable
 * @param {[type]} media_facebook_response [description]
 */
function get_storage(key){

    results = {};

    chrome.storage.local.get(key, function (result) {
        results = result;
    });

    return results;
}

// storage listner
chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (key in changes) {
    var storageChange = changes[key];
    console.log(key.toString());    
    console.log(storageChange);
  }
});

// chrome.runtime.onMessage.addListener(function(response, sender, sendResponse){
// });
