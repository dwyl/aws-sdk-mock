var simple = require('simple-mock');
var _AWS = require('aws-sdk');

var core = {};

exports.mock = function (service, method) {
  core[service] = {};
  core[service].Constructor = _AWS[service];
  createStub(service, method, function (err, data) {
    if (err) return console.log(err);
    return data;
  });
};

exports.restore = function () {
  simple.restore();
};

function createStub (service, method, next) {
  simple.mock(_AWS, service, function () {
    var client = new core[service].Constructor();
    next(null, applyMock(client, method));
  });
}

function applyMock (client, method) {
  return simple.mock(client, method);
}
