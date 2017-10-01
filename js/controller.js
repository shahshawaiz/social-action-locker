
console.log('controler js load');
var app = angular.module("module_app", []);

app.controller("controller_options", function($scope) {

    chrome.storage.sync.get('media_facebook', function(items){
      console.log(items);
    });

    $scope.firstName = "John";
    $scope.lastName = "Doe";
});