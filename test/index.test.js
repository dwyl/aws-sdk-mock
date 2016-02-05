var test     = require('tape');
var awsMock = require('../index.js');
var AWS      = require('aws-sdk');

test('AWS.mock function should mock AWS service and method on the service', function(t){
  t.test('Mocked method returns data', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      st.end()
    })
  })
  t.end();
});
