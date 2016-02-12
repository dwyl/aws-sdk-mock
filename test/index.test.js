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
  t.test('multiple methods can be mocked on the same service', function(st){
    awsMock.mock('Lambda', 'getFunction', function(params, callback) {
      callback(null, 'message');
    });
    awsMock.mock('Lambda', 'createFunction', function(params, callback) {
      callback(null, 'message');
    });
    var lambda = new AWS.Lambda();
    lambda.getFunction({}, function(err, data) {
      st.equals(data, 'message');
      lambda.createFunction({}, function(err, data) {
        st.equals(data, 'message');
        st.end();
      })
    });
  });
  t.test('all the methods on a service are restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    st.equals(AWS.SNS.isSinonProxy, true);

    awsMock.restore('SNS');

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.end();
  })
  t.test('only the method on the service is restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    st.equals(AWS.SNS.isSinonProxy, true);
    st.equals(sns.publish.isSinonProxy, true);

    awsMock.restore('SNS', 'publish');

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), true);
    st.equals(sns.publish.hasOwnProperty('isSinonProxy'), false);
    st.end();
  })
  t.test('all the services are restored when no arguments given to awsMock.restore', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    awsMock.mock('DynamoDB', 'putItem', function(params, callback){
      callback(null, "test");
    });
    var sns      = new AWS.SNS();
    var dynamoDb = new AWS.DynamoDB();

    st.equals(AWS.SNS.isSinonProxy, true);
    st.equals(AWS.DynamoDB.isSinonProxy, true);
    st.equals(sns.publish.isSinonProxy, true);
    st.equals(dynamoDb.putItem.isSinonProxy, true);

    awsMock.restore();

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.equals(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equals(sns.publish.hasOwnProperty('isSinonProxy'), false);
    st.equals(dynamoDb.putItem.hasOwnProperty('isSinonProxy'), false);
    st.end();
  })
  t.end();
});
