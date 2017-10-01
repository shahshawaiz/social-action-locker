
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
         success: function(response) {
            // facebook storage
            status = set_storage({ 'media_facebook' : response.results }, function(){
                console.log('Storage Update: ' + 'media_facebook');
            });
         }
  });
}

/**
 * get storage variable
 */
function get_storage(key, callback){
    chrome.storage.local.get(key, callback);
}

/**
 * set storage variable
 */
function set_storage(objects, callback){
    chrome.storage.local.set(objects, callback);
}

/**
 * remove storage variable
 */
function remove_storage(key, callback){
    chrome.storage.local.remove(key, callback);
}


/**
 * remove storage variable
 */
function clear_storage(callback){
    chrome.storage.local.clear(callback);
}

// storage listner
chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (key in changes) {
    var storageChange = changes[key];
    console.log(storageChange);
  }
});

// chrome.runtime.onMessage.addListener(function(response, sender, sendResponse){
// });
