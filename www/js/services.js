"use strict";

angular.module('app.services', [])

// get / persist / clear
.factory('Properties', function($localForage, $http) {

  var properties = null,
  propertiesFile = 'properties.json',
  dbInstance = $localForage.createInstance({name: 'properties'});

  function retrieve(callback) {

    // Already loaded properties
    if(properties != null)
    return callback(properties);

    // Tries to retrieve from database
    dbInstance.getItem('properties').then(function(data) {

      console.log('Properties loaded from database: ' + angular.toJson(data));

      if((properties = data) != null)
      return callback(properties);

      // No database properties, let's read from file
      $http.get(propertiesFile).then(function(res) {
        console.log('Properties loaded from file: ' + angular.toJson(res.data));

        properties = res.data;
        callback(properties);

      }, function(err) {
        console.log('Fail to read default properties file: ' + err);
      });
    });
  }

  function persist() {

    // No reason to store this
    delete properties.mapOptions.center;

    dbInstance.setItem('properties', properties).then(function(data) {
      console.log('Properties saved: ' + angular.toJson(data));
    });
  }

  function clear() {
    dbInstance.clear(function() {
      console.log('Properties cleared!');
    });
  }

  return {
    "get": retrieve,
    "persist": persist,
    "clear": clear
  };
})

.service('GpsService', function(Properties, $rootScope) {

  var self = this,
  myService = null,
  properties = null;

  this.coords = { lat: 0.0, long: 0.0 };
  this.error = 1;

  // Just call from run and you're all set
  this.start = function() {

    // Cannot start without it
    if (!window.cordova)
      return;

    Properties.get(function(props) {

      properties = props.gpsOptions;

      if (!myService)
        myService = cordova.require(props.serviceFactory).create(props.serviceName);

      myService.getStatus(manageStatus, logError);
    });
  }

  this.notifyAlarmChanges = function(alarms) {
    console.log('Notifying alarm changes...');

    if (properties) {
      properties.alarms = alarms;
      sendProperties();
    }
  }

  this.stop = function() {

    self.error = 1;

    if (myService)
      myService.stopService(function(data) {
        console.log('Service is stopped!');
      }, logError);
  }

  this.isRunning = function(callback) {

    if (!myService)
      return callback(false);

    myService.getStatus(function(data) {
      callback(data.ServiceRunning);
    }, logError);
  }

  function manageStatus(data) {
    if (data.ServiceRunning)
    resetTimer();
    else
    myService.startService(resetTimer, logError);
  }

  function resetTimer() {

    myService.registerForBootStart(function(data) {
      console.log('Service is registered for bootstart!;');
    }, logError);

    myService.disableTimer(enableTimer, logError);
  }

  function enableTimer(data) {
    sendProperties();

    myService.enableTimer(properties.watchInterval, registerForUpdates, logError);
  }

  function registerForUpdates(data) {
    if (!data.RegisteredForUpdates)
    myService.registerForUpdates(updateHandler, logError);
  }

  function updateHandler(data) {

    if (data.LatestResult != null) {
      try {
        console.log('Data from service: ' + angular.toJson(data.LatestResult));

        if (data.LatestResult.lat && data.LatestResult.long) {
          self.coords.lat = data.LatestResult.lat;
          self.coords.long = data.LatestResult.long;
        }

        // Tells angular to update
        $rootScope.$apply(function() {
            self.error = data.LatestResult.error;
        });

      } catch (err) {
        logError(err);
      }
    }
  }

  function logError(e) {
    console.log("Error during service operation: " + e.ErrorMessage);
  }

  function sendProperties() {

    if(!myService)
      return;

    myService.setConfiguration(properties, function(data) {
      console.log('Properties successfully sent to service!');
    }, logError);
  }

})

.service('AlarmsService', function($localForage, GpsService) {

  var alarms = [],
      self = this,
      dbInstance = $localForage.createInstance({name: 'alarms'});

  this.getAlarms = function() {
    return alarms;
  }

  this.getEnabledAlarms = function() {
    return alarms.filter(function(a) {return a.enabled});
  }

  this.toggleEnabled = function(index) {
    alarms[index].enabled ^= true;

    this.saveAlarm(alarms[index]);
  }

  this.deleteAlarm = function(id) {

    if (!id)
    return;

    for (var i = 0; i < alarms.length; i++)
    if (alarms[i].id == id) {
      alarms.splice(i, 1);
      break;
    }

    console.log('Alarm deleted: ' + id);

    dbInstance.removeItem(id);

    // Notify service to stop watching for this alarm
    GpsService.notifyAlarmChanges(this.getEnabledAlarms());
  }

  this.saveAlarm = function(alarm) {

    // If it's a new alarm, gives an ID and push
    if (alarm && !alarm.id) {
      alarm.id = Date.now();
      alarms.push(alarm);
    }

    dbInstance.setItem(alarm.id, alarm).then(function() {
      console.log('Persisted alarm: ' + angular.toJson(alarm));
    });

    GpsService.notifyAlarmChanges(this.getEnabledAlarms());
  }

  function retrieveAlarms() {

    dbInstance.iterate(function(value, key, iterationNumber) {
      alarms.push(value);
    }).then(function() {
      console.log('Retrieved alarms: ' + angular.toJson(alarms));
      GpsService.notifyAlarmChanges(self.getEnabledAlarms());
    });
  }

  retrieveAlarms();
})

.factory('GoogleMaps', function($window, $q){

      var mapsDefer = $q.defer(),
          asyncUrl = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCt8G8aITVsHp5Dycls5hPzhDlKV1ViqeY&l&libraries=places&callback=initMaps',
          hasCalledScript = false;

      // async loader
      var asyncLoad = function() {

          if (!hasCalledScript) {
            var script = document.createElement('script');
            script.src = asyncUrl;
            document.body.appendChild(script);

            hasCalledScript = true;
          }

          return mapsDefer.promise;
      };

      // callback
      $window.initMaps = function () {
          mapsDefer.resolve();
      };

      return {
          init : asyncLoad
      };
});

/*
.factory('FileService', function() {

  var tempFolder = 'com.ricardofagodoy.temp';

  function checkFiredAlarms(callback){

    if (!window.cordova)
      callback(0);

    window.resolveLocalFileSystemURL(cordova.file.cacheDirectory + tempFolder, function(dirEntry) {
      dirEntry.createReader().readEntries(function(entries) {

        if(entries && entries[0]) {
          console.log("Found alarm file: " + entries[0]);
          callback(entries[0].name);
          entries[0].remove();
        } else {
          console.log("No alarm file found!");
          callback(0);
        }
      });
    }, function(e) {
      console.log(e);
      callback(0);
    });
  }

  return {checkFiredAlarms: checkFiredAlarms};

});

$cordovaGeolocation
var watch = null;

this.startWatching = function() {

watch = setInterval(function() {

$cordovaGeolocation.getCurrentPosition(properties).then(
function (position) {
self.coords.error = 0;
self.coords.lat = position.coords.latitude;
self.coords.long = position.coords.longitude;
}, function(err) {
self.coords.error = 1;
});
}, properties.watchInterval);
};

this.stopWatching = function() {
clearInterval(watch);
watch = null;
};

this.toggleWatching = function() {
if(watch == null)
this.startWatching();
else
this.stopWatching();
};

this.isWatching = function() {
return watch != null;
};

Properties.get(function(props) {

properties = props.gpsOptions;

// Updated lat/long obtained from GPS
self.coords = { lat: properties.defaultLat,
long: properties.defaultLong,
error: 1 };

// Start service to watch gps positions
self.startWatching();
});
*/
