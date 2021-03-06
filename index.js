var Service,
    Characteristic;
var fetch = require('node-fetch');
var Queue = require('promise-queue');

var maxConcurrent = 1;
var maxQueue      = Infinity;
var queue         = new Queue(maxConcurrent, maxQueue);

module.exports = function (homebridge) {
  Service        = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-tasmota-http-dimmer', 'TasmotaHTTPDimmer', TasmotaHTTPDimmerAccessory);
};

function TasmotaHTTPDimmerAccessory(log, config) {
  this.log      = log;
  this.config   = config;
  this.name     = this.config['name'];
  this.relay    = this.config['relay'] || '';
  this.timeout  = this.config['timeout'] || 10000;
  this.hostname = this.config['hostname'] || 'led_strip';
  this.user     = this.config['user'] || 'admin';
  this.pass     = this.config['pass'] || 'admin';
  this.auth_url = '?user=' + this.user + '&password=' + this.pass;

  var informationService = new Service.AccessoryInformation();
  informationService
    .setCharacteristic(Characteristic.Manufacturer, 'LNH-Strip')
    .setCharacteristic(Characteristic.Model, 'homebridge-lnh-strip')
    .setCharacteristic(Characteristic.SerialNumber, '0101');

  this.service = new Service.Lightbulb(this.name);
  this.service
    .getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));
  this.service
    .addCharacteristic(new Characteristic.Brightness())
    .on('get', this.getBrightness.bind(this))
    .on('set', this.setBrightness.bind(this));

  this.log('LNH-Strip Initialized');
}

TasmotaHTTPDimmerAccessory.prototype = {
  _request(cmd, cb) {
    const url = 'http://' + this.hostname + '/cm' + this.auth_url + '&cmnd=' + cmd;
    this.log('requesting: ' + url);
    queue.add(async () => {
      const res = await fetch(url, {
        timeout: this.timeout,
      });
      let error,
          text;
      try {
        text = await res.text();
      } catch (e) {
        error = e;
      }
      cb(error, text, text);
    });
  },
  getState:      function (callback) {
    const self = this;

    this._request('Power' + this.relay, function (error, response, body) {
      if (error) {
        self.log('error: ' + error);
        return callback(error);
      }
      const json  = JSON.parse(body);
      const power = json['POWER' + self.relay];
      self.log('LED: ' + self.hostname + ' Get State: ' + power);
      if (power === 'OFF') {
        callback(null, 0);
      } else if (power === 'ON') {
        callback(null, 1);
      }
    });
  },
  setState:      function (toggle, callback) {
    var newstate = '%20Off';
    if (toggle) {
      newstate = '%20On';
    }
    const self = this;
    this._request('Power' + this.relay + newstate, function (error, response, body) {
      if (error) {
        self.log('error: ' + error);
        return callback(error);
      }
      var json    = JSON.parse(body);
      const power = json['POWER' + self.relay];
      self.log('LED: ' + self.hostname + ' Set State to: ' + power);
      if (power === 'OFF') {
        callback();
      }
      if (power === 'ON') {
        callback();
      }
    });
  },
  getBrightness: function (callback) {
    const self = this;
    this._request('Dimmer', function (error, response, body) {
      if (error) {
        self.log('error: ' + error);
        return callback(error);
      }
      const jsonreply = JSON.parse(body);
      self.log('LED: ' + self.hostname + ' Get Brightness: ' + jsonreply.Dimmer);
      callback(null, jsonreply.Dimmer);
    });
  },
  setBrightness: function (brightness, callback) {
    const self = this;
    this._request('Dimmer%20' + brightness, function (error, response, body) {
      if (error) {
        self.log('error: ' + error);
        return callback(error);
      }
      const jsonreply = JSON.parse(body);
      self.log('LED: ' + self.hostname + ' Set Brightness to: ' + jsonreply.Dimmer);
      if (jsonreply.Dimmer === brightness) {
        callback();
      } else {
        self.log('LED: ' + self.hostname + ' ERROR Setting Brightness to: ' + brightness);
        callback();
      }
    });
  },
  getServices:   function () {
    return [this.service];
  },
};

