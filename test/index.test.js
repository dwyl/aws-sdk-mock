var test     = require('tape');
var awsMock = require('../index.js');
var AWS      = require('aws-sdk');

test('AWS.mock function should mock AWS service and method on the service', function(t){
  t.test('mock function replaces method with a function that returns replace string', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    })
  });
  t.test('mock function replaces method with replace function', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    })
  })
  t.test('method is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "test");
    });
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    })
  })
  t.test('service is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, "test");
    });
    sns.subscribe({}, function(err, data){
      st.equals(data, 'test');
      awsMock.restore('SNS');
      st.end();
    })
  })
  // t.test('all the methods on a service are restored', function(st){
  //   awsMock.restore('SNS');
  //   st.end();
  // })
  // t.test('only the method on the service is restored', function(st){
  //   awsMock.restore('SNS', 'publish');
  //   st.end();
  // })
  // t.test('all the services are restored', function(st){
  //   awsMock.restore('SNS', 'publish');
  //   st.end();
  // })
  t.end();
});
