"use strict";

angular.module('app.controllers', [])

.controller('StatusCtrl', function($scope, GpsService, $rootScope, $cordovaNetwork,
  Properties, AlarmsService, $timeout, GoogleMaps) {

    var mapIntervalId = null,
    liveMap = null,
    liveMarker = null,
    circles = null,
    mapOptions = null,
    circleOptions = null;

    $scope.gpsError = 1;
    $scope.internetActive = 0;
    $scope.serviceStatus = null;

    // Updates GPS sensor
    $scope.$watch(function() {
      return GpsService.error;
    }, function(newValue) {
        $scope.gpsError = newValue;
    });

    // Load properties
    Properties.get(function(props) {
      mapOptions = props.mapOptions;
      circleOptions = props.circleOptions;
    });

    // Obtains service's status
    GpsService.isRunning(function (isIt) {
      $scope.serviceStatus = isIt;
    });

    // Toggle background service
    $scope.toggleService = function() {

      GpsService.isRunning(function(isIt) {

        console.log('Service running: ' + isIt);

        if (isIt)
          GpsService.stop();
        else
          GpsService.start();

        $scope.serviceStatus = !isIt;

        // Tells angular to update view
        $timeout(function() {
          $scope.$apply();
        });
      })
    };

    // Click on map text
    $scope.loadMap = function() {

      $scope.loadingMap = true;

      GoogleMaps.init().then(function() {

          // Center based on GPS positions
          mapOptions.center = new google.maps.LatLng
                  (GpsService.coords.lat, GpsService.coords.long);

          // Creates the map
          liveMap = new google.maps.Map(document.getElementById("liveMap"), mapOptions);

          // Creates marker (user)
          liveMarker = new google.maps.Marker({
              position: mapOptions.center,
              map: liveMap
          });

          // Draw a circle for every enable alarm
          drawAlarmCircles();

          // Starts interval to update map periodicaly
          mapIntervalId = setInterval(function() {

              // Cannot go on without new location
              if (GpsService.error)
                return 0;

              // Updates center position
              mapOptions.center = new google.maps.LatLng
                      (GpsService.coords.lat, GpsService.coords.long);

              // Set new center to map and marker
              liveMap.panTo(mapOptions.center);
              liveMarker.setPosition(mapOptions.center);

          }, mapOptions.updateInterval);

        $scope.loadingMap = false;
      });
    }

    function drawAlarmCircles() {
      var alarms = AlarmsService.getEnabledAlarms(),
          circles = [];

      for(var i in alarms)
        circles.push(new google.maps.Circle(angular.extend({
          map: liveMap,
          center: new google.maps.LatLng(alarms[i].lat, alarms[i].long),
          radius: alarms[i].radius
        }, circleOptions)));
    }

    // Check internet connection
    document.addEventListener("deviceready", function() {
        $scope.internetActive = $cordovaNetwork.isOnline();

        // Online event
        $rootScope.$on('$cordovaNetwork:online', function(event, networkState){
          $scope.internetActive = 1;
        });

        // Offline event
        $rootScope.$on('$cordovaNetwork:offline', function(event, networkState){
          $scope.internetActive = 0;
        });
      }, false);

      // Destroy map when enter view again
      // So we can update circles
      $scope.$on('$ionicView.enter', function(e) {
        if (mapIntervalId) {
          clearInterval(mapIntervalId);
          $scope.loadMap();
        }
      });
})

.controller('AlarmesCtrl', function($scope, $ionicModal, Properties, GpsService, AlarmsService, GoogleMaps) {

      var alarmMap = null,
      circleArea = null,
      mapOptions = null,
      circleOptions = null,
      seachBoxInput = null;

      $scope.deleteMode = 0;
      $scope.markedForDeletion = [];
      $scope.currentAlarm = {};
      $scope.alarms = AlarmsService.getAlarms();

      // Load properties
      Properties.get(function(props) {
        mapOptions = props.mapOptions;
        circleOptions = props.circleOptions;
      })

      $ionicModal.fromTemplateUrl('alarmDetails.html', {
        scope: $scope,
        animation: 'slide-in-up'
      }).then(function(modal) {
        $scope.modal = modal;
      });

      $scope.toggleEnabled = function(index) {
        AlarmsService.toggleEnabled(index);
      }

      $scope.deleteHandler = function() {

        // If icon is trash can, just get into delete mode
        if(!$scope.deleteMode)
          $scope.deleteMode = 1;
        else {
          // If it's check mark, call service to delete
          for(var i in $scope.markedForDeletion)
            AlarmsService.deleteAlarm($scope.markedForDeletion[i]);

          $scope.clearDelete();
        }
      }

      $scope.clearDelete = function() {
        $scope.markedForDeletion = [];
        $scope.deleteMode = 0;
      }

      $scope.markForDeletion = function(id) {

        if(!$scope.deleteMode)
          return;

        var i = -1;

        // Adds or removes index from deletion list
        if((i = $scope.markedForDeletion.indexOf(id)) != -1)
          $scope.markedForDeletion.splice(i, 1);
        else
          $scope.markedForDeletion.push(id);
      }

      $scope.newAlarm = function() {
        // New alarm is created already enabled
        $scope.currentAlarm = {enabled: 1};
        showModal('Novo alarme');
      }

      $scope.editAlarm = function(index) {
        // Load current alarm data
        $scope.currentAlarm = $scope.alarms[index];
        showModal('Editar alarme');
      }

      $scope.saveCurrentAlarm = function() {

        // Sets map data to currentAlarm
        $scope.currentAlarm.lat = circleArea.center.lat();
        $scope.currentAlarm.long = circleArea.center.lng();
        $scope.currentAlarm.radius = circleArea.radius;

        // Save it!
        AlarmsService.saveAlarm($scope.currentAlarm);

        // Clear it!
        $scope.currentAlarm = {};

        // Hide it!
        $scope.modal.hide();
      }

      function showModal(title) {

        $scope.modal.title = title;
        $scope.modal.show();

        $scope.loadingMap = true;

        GoogleMaps.init().then(function () {

          var center = null,
              radius = null;

          // If it's an edit mode
          if($scope.currentAlarm.id) {
            center = new google.maps.LatLng($scope.currentAlarm.lat, $scope.currentAlarm.long);
            radius = $scope.currentAlarm.radius;
          } else {
            center = new google.maps.LatLng(GpsService.coords.lat, GpsService.coords.long);
            radius = circleOptions.defaultRadius;
          }

          mapOptions.center = center;

          alarmMap = new google.maps.Map(document.getElementById("alarmMap"), mapOptions);

          google.maps.event.addListenerOnce(alarmMap, 'idle', function(){
              $scope.loadingMap = false;
              $scope.$apply();
          });

          circleArea = new google.maps.Circle(
            angular.extend({
              map: alarmMap,
              center: center,
              radius: radius,
              editable: true,
              draggable: true
            }, circleOptions));

          // Create the search box and link it to the UI element.
          if (!seachBoxInput)
            seachBoxInput = document.getElementById('pac-input');

          var searchBox = new google.maps.places.SearchBox(seachBoxInput);
          alarmMap.controls[google.maps.ControlPosition.TOP_LEFT].push(seachBoxInput);

          alarmMap.addListener('bounds_changed', function() {
            searchBox.setBounds(alarmMap.getBounds());
          });

          // User typed some location
          searchBox.addListener('places_changed', function() {

            var places = searchBox.getPlaces();

            if (places.length == 0)
              return;

            var center = new google.maps.LatLng(places[0].geometry.location.lat(),
                                                places[0].geometry.location.lng());

            // Go to user's typed location
            alarmMap.panTo(center);
            circleArea.setCenter(center);
          });
        });
      }

      // Solve click on places suggestions (ionic bug)
      $scope.disableTap = function() {
            var container = document.getElementsByClassName('pac-container');
            angular.element(container).attr('data-tap-disabled', 'true');

            var backdrop = document.getElementsByClassName('backdrop');
            angular.element(backdrop).attr('data-tap-disabled', 'true');

            angular.element(container).on("click", function() {
                document.getElementById('pac-input').blur();
            });
      }
})

.controller('AjustesCtrl', function($scope, Properties, GpsService) {

        $scope.Properties = null;
        $scope.temporaryProps = null;
        $scope.locked = 1;

        // Load properties
        Properties.get(function(props) {

          $scope.Properties = props;

          $scope.temporaryProps = {
                "updateInterval": props.mapOptions.updateInterval / 1000,
                "gpsInterval": props.gpsOptions.gpsInterval / 1000,
                "gpsBackgroundInterval": props.gpsOptions.gpsBackgroundInterval / 1000,
                "gpsAge": props.gpsOptions.gpsAge / 1000,
                "watchInterval": props.gpsOptions.watchInterval / 1000
          };
        })

        $scope.toggleLock = function() {
          if(!$scope.locked) {

            $scope.Properties.mapOptions.updateInterval = $scope.temporaryProps.updateInterval * 1000;
            $scope.Properties.gpsOptions.gpsInterval = $scope.temporaryProps.gpsInterval * 1000;
            $scope.Properties.gpsOptions.gpsBackgroundInterval = $scope.temporaryProps.gpsBackgroundInterval * 1000;
            $scope.Properties.gpsOptions.gpsAge = $scope.temporaryProps.gpsAge * 1000;
            $scope.Properties.gpsOptions.watchInterval = $scope.temporaryProps.watchInterval * 1000;

            Properties.persist();
          }

          $scope.locked ^= 1;
        }

        $scope.resetProperties = function() {
          Properties.clear();
          console.log('Properties cleared!');
        }
})

// not used
.controller('GoneoffalarmCtrl', function($scope, $stateParams) {
      $scope.alarmId = $stateParams.id;
});
