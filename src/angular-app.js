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

stxtModule.filter('abbrev', function() {
    return stxt.Fmt.abbrev;
});

stxtModule.factory('stxtStorage', function() {
    return new stxt.Store("mem", "Memory", stxt.Store.Memory.driver);
});


stxtModule.factory('stxtPeer', ['stxtStorage',
                                function($stxtStorage) {
    return stxt.Peer.attach($stxtStorage, "user", "pw");
}]);


stxtModule.controller(
    'stxtPeerCtrl',['$scope', 'stxtPeer', function($scope, stxtPeer) {

        $scope.peer = null;
        $scope.root_agent = null;
        $scope.curr_agent = null;
        $scope.agents = null;
        $scope.msgs = null;

        function refresh_agents() {
            stxtPeer.then(function(peer) {
                peer.list_agents().then(function(agents) {
                    $scope.$apply(function() {
                        $scope.agents = agents;
                    });
                });
            });
        }

        function refresh_msgs() {
            var msgs = [];
            if ($scope.curr_agent) {
                var mm = $scope.curr_agent.get_graph().get_all_msgs_sorted();
                mm.forEach(
                    function(msg) {
                        msgs.push({id: msg.id,
                                   kind: msg.kind,
                                   from: msg.from.toString(),
                                   time: msg.time,
                                   body: msg.body
                                  });
                    });
                $scope.msgs = msgs;
            }
        }

        $scope.new_agent_and_group = function() {
            stxtPeer.then(function(peer) {
                var tag = stxt.Tag.new_group($scope.groupToAdd);
                var agent = peer.new_agent_with_new_group(tag, null);
                agent.add_ping();
                agent.save().then(refresh_agents);
            });
        };

        $scope.new_msg = function() {
            if ($scope.curr_agent) {
                $scope.curr_agent.add_chat($scope.msgToAdd);
                $scope.curr_agent.save().then(refresh_msgs);
            }
        };

        $scope.set_curr_agent = function(gid) {
            if ($scope.peer) {
                $scope.curr_agent.save().then(function() {
                    return $scope.peer.get_agent(gid);
                }).then(function(agent) {
                    $scope.$apply(function() {
                        $scope.curr_agent = agent;
                        refresh_msgs();
                    });
                });
            }
        };


        stxtPeer.then(function(peer) {
            peer.get_root_agent().then(function(agent) {
                $scope.$apply(function() {
                    $scope.peer = peer;
                    $scope.root_agent = agent;
                    $scope.curr_agent = agent;
                    refresh_agents();
                    refresh_msgs();
                });
            });
        });
    }]);

})();
