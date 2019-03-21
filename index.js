var Service,
    Characteristic;
var request = require('request');

module.exports = function (homebridge) {
  Service        = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-tasmota-http-led-strip', 'TasmotaHTTPLEDStrip', TasmotaHTTPLEDStripAccessory);
};

function TasmotaHTTPLEDStripAccessory(log, config) {
  this.log      = log;
  this.config   = config;
  this.name     = this.config['name'];
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

  this.service
      .addCharacteristic(new Characteristic.Hue())
      .on('get', this.getHue.bind(this))
      .on('set', this.setHue.bind(this));

  this.service
      .addCharacteristic(new Characteristic.Saturation())
      .on('get', this.getSaturation.bind(this))
      .on('set', this.setSaturation.bind(this));

  this.log('LNH-Strip Initialized');
}

TasmotaHTTPLEDStripAccessory.prototype = {
  _request(cmd, cb) {
    const url = 'http://' + this.hostname + '/cm' + this.auth_url + '&cmnd=' + cmd;
    request(url, cb);
  },
  getState:      function (callback) {
    const that = this;

    this._request('Power', function (error, response, body) {
      if (error) {
        return callback(error);
      }
      const json = JSON.parse(body);
      that.log('LED: ' + that.hostname + ' Get State: ' + json.POWER);
      if (json.POWER === 'OFF') {
        callback(null, 0);
      } else if (json.POWER === 'ON') {
        callback(null, 1);
      }
    });
  },
  setState:      function (toggle, callback) {
    var newstate = '%20Off';
    if (toggle) {
      newstate = '%20On';
    }
    const that = this;
    this._request('Power' + newstate, function (error, response, body) {
      if (error) {
        return callback(error);
      }
      var json = JSON.parse(body);
      that.log('LED: ' + that.hostname + ' Set State to: ' + json.POWER);
      if (json.POWER === 'OFF') {
        callback();
      }
      if (json.POWER === 'ON') {
        callback();
      }
    });
  },
  getBrightness: function (callback) {
    const that = this;
    this._request('Dimmer', function (error, response, body) {
      if (error) {
        return callback(error);
      }
      const jsonreply = JSON.parse(body);
      that.log('LED: ' + that.hostname + ' Get Brightness: ' + jsonreply.Dimmer);
      callback(null, jsonreply.Dimmer);
    });
  },
  setBrightness: function (brightness, callback) {
    const that = this;
    this._request('HsbColor3%20' + brightness, function (error, response, body) {
      if (error) {
        return callback(error);
      }
      const jsonreply = JSON.parse(body);
      that.log('LED: ' + that.hostname + ' Set Brightness to: ' + jsonreply.Dimmer);
      if (jsonreply.Dimmer === brightness) {
        callback();
      } else {
        that.log('LED: ' + that.hostname + ' ERROR Setting Brightness to: ' + brightness);
        callback();
      }
    });
  },

  getHue: function (callback) {
    this._request('HsbColor', function (error, response, responseBody) {
      if (error) {
        return callback(error);
      }
      const json     = JSON.parse(responseBody);
      const hsbcolor = json.HSBColor;
      const hsb      = hsbcolor.split(',');
      callback(null, hsb[0]);
    });
  },

  setHue: function (level, callback) {
    this._request('HsbColor1%20' + level, function (error, response, responseBody) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  },

  getSaturation: function (callback) {
    this._request('HsbColor', function (error, response, responseBody) {
      if (error) {
        return callback(error);
      }
      const json     = JSON.parse(responseBody);
      const hsbcolor = json.HSBColor;
      const hsb      = hsbcolor.split(',');
      callback(null, hsb[1]);
    });
  },

  setSaturation: function (level, callback) {
    this._request('HsbColor2%20' + level, function (error, response, responseBody) {
      callback();
    });
  },
  getServices:   function () {
    return [this.service];
  },
};

