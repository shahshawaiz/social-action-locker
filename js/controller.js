

console.log('controler js load start...');

var app = angular.module("module_app", []);

app.controller("controller_options", function($scope) {

	console.log('controller loading');
	// 1. get social-action from remote parse-shah
	media_facebook_response = fetch_actions(media_facebook);


    $scope.firstName = "John";
    $scope.lastName = "Doe";
});

