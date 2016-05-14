# aws-sdk-mock

AWSome mocks for Javascript aws-sdk services.

[![Build Status](https://travis-ci.org/dwyl/aws-sdk-mock.svg?branch=master)](https://travis-ci.org/dwyl/aws-sdk-mock)
[![codecov.io](https://codecov.io/github/dwyl/aws-sdk-mock/coverage.svg?branch=master)](https://codecov.io/github/dwyl/aws-sdk-mock?branch=master)
[![Dependency Status](https://david-dm.org/dwyl/aws-sdk-mock.svg)](https://david-dm.org/dwyl/aws-sdk-mock)
[![devDependency Status](https://david-dm.org/dwyl/aws-sdk-mock/dev-status.svg)](https://david-dm.org/dwyl/aws-sdk-mock#info=devDependencies)

[![NPM](https://nodei.co/npm-dl/aws-sdk-mock.png?months=3)](https://nodei.co/npm/aws-sdk-mock/)

This module was created to help test AWS Lambda functions but can be used in any situation where the AWS SDK needs to be mocked.

If you are *new* to Amazon WebServices Lambda
(*or need a refresher*),
please checkout our our  
***Beginners Guide to AWS Lambda***:
https://github.com/dwyl/learn-aws-lambda

* [Why](#why)
* [What](#what)
* [Getting Started](#how)
* [Documentation](#documentation)
* [Background Reading](#background-reading)

## Why?

Testing your code is *essential* everywhere you need *reliability*.

Using stubs means you can prevent a specific method from being called directly. In our case we want to prevent the actual AWS services to be called while testing functions that use the AWS SDK.

## What?

Uses Sinon.js under the hood to mock the AWS SDK services and their associated methods.

## *How*? (*Usage*)

### *install* `aws-sdk-mock` from NPM

```sh
npm install aws-sdk-mock --save-dev
```

### Use in your Tests

```js

var AWS = require('aws-sdk-mock');

AWS.mock('DynamoDB', 'putItem', function (params, callback){
  callback(null, "successfully put item in database");
});

AWS.mock('SNS', 'publish', 'test-message');

/**
    TESTS
**/

AWS.restore('SNS', 'publish');
AWS.restore('DynamoDB');
// or AWS.restore(); this will restore all the methods and services
```

**NB: The AWS Service needs to be initialised inside the function being tested in order for the SDK method to be mocked** e.g for an AWS Lambda function example 1 will cause an error `region not defined in config`  whereas in example 2 the sdk will be successfully mocked.

Example 1:
```js
var AWS      = require('aws-sdk');
var sns      = AWS.SNS();
var dynamoDb = AWS.DynamoDB();

exports.handler = function(event, context) {
  // do something with the services e.g. sns.publish
}
```

Example 2:
```js
var AWS = require('aws-sdk');

exports.handler = function(event, context) {
  var sns      = AWS.SNS();
  var dynamoDb = AWS.DynamoDB();
  // do something with the services e.g. sns.publish
}
```

### Nested services

It is possible to mock nested services like `DynamoDB.DocumentClient`. Simply use this dot-notation name as the `service` parameter to the `mock()` and `restore()` methods:

```
AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
  callback(null, {Item: {Key: 'Value'}});
});
```

**NB: Use caution when mocking both a nested service and its parent service.** The nested service should be mocked before and restored after its parent:

```
// OK
AWS.mock('DynamoDB.DocumentClient', 'get', 'message');
AWS.mock('DynamoDB', 'describeTable', 'message');
AWS.restore('DynamoDB');
AWS.restore('DynamoDB.DocumentClient');

// Not OK
AWS.mock('DynamoDB', 'describeTable', 'message');
AWS.mock('DynamoDB.DocumentClient', 'get', 'message');

// Not OK
AWS.restore('DynamoDB.DocumentClient');
AWS.restore('DynamoDB');
```

### Don't worry about the constructor configuration
Some constructors of the aws-sdk will require you to pass through a configuration object.

```js
var csd = new AWS.CloudSearchDomain({
  endpoint: 'your.end.point',
  region: 'eu-west'
});
```
Most mocking solutions with throw an `InvalidEndpoint: AWS.CloudSearchDomain requires an explicit 'endpoint' configuration option` when you try to mock this.


**aws-sdk-mock** will take care of this during mock creation so you **won't get any configuration errors**!<br>
If configurations errors still  occur it means you passed wrong configuration in your implementation.


### Setting the `aws-sdk` module explicitly

Project structures that don't include the `aws-sdk` at the top level `node_modules` project folder will not be properly mocked.  An example of this would be installing the `aws-sdk` in a nested project directory. You can get around this by explicitly setting the path to a nested `aws-sdk` module using `setSDK()`.

Example:
```js
var path = require('path');
var AWS = require('aws-sdk-mock');

AWS.setSDK(path.resolve('../../functions/foo/node_modules/aws-sdk'));

/**
    TESTS
**/
```

## Documentation

### `AWS.mock(service, method, replace)`

Replaces a method on an AWS service with a replacement function or string.


| Param | Type | Optional/Required | Description     |
| :------------- | :------------- | :------------- | :------------- |
| `service`      | string    | Required     | AWS service to mock e.g. SNS, DynamoDB, S3     |
| `method`      | string    | Required     | method on AWS service to mock e.g. 'publish' (for SNS), 'putItem' for 'DynamoDB'     |
| `replace`      | string or function    | Required     | A string or function to replace the method   |


### `AWS.restore(service, method)`

Removes the mock to restore the specified AWS service

| Param | Type | Optional/Required | Description     |
| :------------- | :------------- | :------------- | :------------- |
| `service`      | string    | Optional     | AWS service to restore - If only the service is specified, all the methods are restored     |
| `method`      | string    | Optional     | Method on AWS service to restore    |

If `AWS.restore` is called without arguments (`AWS.restore()`) then all the services and their associated methods are restored
i.e. equivalent to a 'restore all' function.


### `AWS.setSDK(path)`

Explicitly set the require path for the `aws-sdk`

| Param | Type | Optional/Required | Description     |
| :------------- | :------------- | :------------- | :------------- |
| `path`      | string    | Required     | Path to a nested AWS SDK node module     |


## Background Reading

* [Mocking using Sinon.js](http://sinonjs.org/docs/)
* [AWS Lambda](https://github.com/dwyl/learn-aws-lambda)

**Contributions welcome! Please submit issues or PRs if you think of anything that needs updating/improving**
