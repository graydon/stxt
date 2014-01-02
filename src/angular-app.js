// Copyright 2014 Mozilla Foundation.
//
// Licensed under the Apache License, Version 2.0
// <LICENSE.txt or http://www.apache.org/licenses/LICENSE-2.0>
// This file may not be copied, modified, or distributed
// except according to those terms.

/* global angular */
/* global stxt */

// This file wires Stxt into AngularJS

(function() {
"use strict";
var stxtModule = angular.module('stxt', []);


stxtModule.factory('stxtStorage', function() {
    return new stxt.Store("mem", "Memory", stxt.Store.Memory.driver);
});


stxtModule.factory('stxtPeer', ['stxtStorage',
                                function($stxtStorage) {
    return stxt.Peer.attach($stxtStorage, "user", "pw");
}]);


stxtModule.controller('stxtCtrl', ['$scope', 'stxtPeer',
                                   function($scope, stxtPeer) {
    $scope.username = "none";
    stxtPeer.then(function(peer) {
        console.log("controller got peer");
        peer.get_root_agent().then(function(agent) {
            var from = agent.from().toString();
            console.log("controller got root agent: " + from);
            $scope.$apply(function() {
                $scope.username = from;
            });
        });
    });
}]);

})();
