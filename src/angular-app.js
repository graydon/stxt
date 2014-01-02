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


stxtModule.controller(
    'stxtPeerCtrl',['$scope', 'stxtPeer', function($scope, stxtPeer) {

        $scope.new_agent_and_group = function() {
            stxtPeer.then(function(peer) {
                var tag = stxt.Tag.new_group($scope.groupToAdd);
                var agent = peer.new_agent_with_new_group(tag, null);
                agent.save().then(function() {
                    peer.list_agents().then(function(agents) {
                        $scope.$apply(function() {
                            $scope.agents = agents;
                        });
                    });
                });
            });
        };

        $scope.username = "none";
        stxtPeer.then(function(peer) {
            peer.get_root_agent().then(function(agent) {
                var from = agent.from().toString();
                $scope.$apply(function() {
                    $scope.username = from;
                    $scope.agents = [ agent.id ];
                });
            });
        });
    }]);

})();
