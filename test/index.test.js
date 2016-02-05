var test     = require('tape');
var awsMock = require('../index.js');
var AWS      = require('aws-sdk');

test('AWS.mock function should mock AWS service and method on the service', function(t){
  t.test('Mocked method returns data', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end()
    })
  })
  t.test('Unmocked method should work as normal', function(st) {
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.subscribe({}, function (err, data) {
      console.log(err);
      console.log(data);
      st.end();
    });
  })
  t.end();
});
