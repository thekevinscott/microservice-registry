'use strict';

var Promise = require('bluebird');
var discover = require('node-discover')();
var _ = require('lodash');
var zlib = require('zlib');

var found_services = {};

discover.on('added', function(obj) {
  // sometimes random objects come through;
  // I don't know why
  if ( obj && obj.advertisement ) {
    found_services[obj.advertisement.name] = obj.advertisement;

    if ( service.services_missing.length ) {
      service.services_missing.map(function(service_missing, i) {
        if ( service_missing === obj.advertisement.name ) {
          // Boom! we found it
          service.services_missing.splice(i,i+1);
        }
      });

      if ( service.services_missing.length === 0 ) {
        service.readyCallback();
      }
    }

    if ( service.callbacks[obj.advertisement.name] ) {
      service.callbacks[obj.advertisement.name]();
      delete service.callbacks[obj.advertisement.name];
    }
  }
});

var service = {
  expected_services: {},
  callbacks: {},
  services_missing: [],
  options: {},
  readyCallback: function() {},
  advertise: function() {
    const broadcast_packet = _.extend({ name: this.name }, this.options);

    zlib.gzip(JSON.stringify(broadcast_packet), function(error, compressed_packet) {
      if ( ! error ) {
        if ( compressed_packet.length > 1218 ) {
          throw new Error("node-discover can only handle strings up to 1218 characters");
        }
        console.log('compressed packet', compressed_packet);
        discover.advertise(compressed_packet);
      }
    });
  },
  register: function(name, options) {
    if ( ! name ) {
      throw "Provide arguments for register";
    }
    this.name = name;
    this.options = _.extend({ available: false, services: [] }, options || {});

    this.options.services.map(function(service) {
      if ( service.name ) {
        this.expected_services[service] = _.extend({available: false}, service);
      } else {
        this.expected_services[service] = {
          name: service,
          available: false
        };
      }
    }.bind(this));

    this.advertise();
  },

  ready: function(callback) {
    return new Promise(function(resolve, reject) {
      function broadcastReady() {
        this.options.available = true;
        this.advertise();
        if ( callback ) {
          callback();
        }
        resolve();
      }
      // Iterate through the services we expect to be available
      var services_missing = Object.keys(this.expected_services).filter(function(key) {
        return !found_services[key] || !found_services[key].available;
      }.bind(this));

      if ( services_missing.length === 0 ) {
        broadcastReady.call(this);
      } else {
        this.services_missing = services_missing;
        this.readyCallback = function() {
          broadcastReady.call(this);
        }
      }
    }.bind(this));
  },

  get: function(key) {
    return found_services[key];
  }
};

module.exports = service;
