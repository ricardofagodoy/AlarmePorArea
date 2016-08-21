"use strict";

angular.module('app', ['ionic', 'ngCordova', 'app.controllers', 'app.services', 'LocalForageModule'])

.run(function($ionicPlatform, $rootScope, $ionicTabsDelegate, GpsService) {

  $ionicPlatform.ready(function() {

    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }

    if (window.StatusBar)
      StatusBar.styleDefault();

    // Starts background service
    GpsService.start();

    // Tabs swipe handler
    $rootScope.goForward = function () {

        var selected = $ionicTabsDelegate.selectedIndex();

        if (selected != -1 && selected < 2)
          $ionicTabsDelegate.select(selected + 1);
    };

    $rootScope.goBack = function () {

        var selected = $ionicTabsDelegate.selectedIndex();

        if (selected != -1 && selected > 0)
          $ionicTabsDelegate.select(selected - 1);
    };

    if (window.navigator && window.navigator.splashscreen)
      navigator.splashscreen.hide();
  });
})

.config(function($stateProvider, $urlRouterProvider, $localForageProvider) {

    $localForageProvider.config({
        name        : 'alarmePorArea',
        description : 'My simple alarm storage'
    });

  $stateProvider

  .state('tab', {
    url: '/tab',
    abstract: true,
    templateUrl: 'templates/tabs.html'
  })

  .state('tab.status', {
    url: '/status',
    views: {
      'tab-status': {
        templateUrl: 'templates/tab-status.html',
        controller: 'StatusCtrl'
      }
    }
  })

  .state('tab.alarmes', {
      url: '/alarmes',
      views: {
        'tab-alarmes': {
          templateUrl: 'templates/tab-alarmes.html',
          controller: 'AlarmesCtrl'
        }
      }
    })

  .state('tab.ajustes', {
    url: '/ajustes',
    views: {
      'tab-ajustes': {
        templateUrl: 'templates/tab-ajustes.html',
        controller: 'AjustesCtrl'
      }
    }
  })

  // not used
  .state('goneoffalarm', {
    url: '/goneoffalarm/:id',
    templateUrl: 'templates/goneoff-alarm.html',
    controller: 'GoneoffalarmCtrl'
  });

  $urlRouterProvider.otherwise('/tab/alarmes');
});
