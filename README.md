# aws-sdk-mock

AWSome mocks for Javascript aws-sdk services.

[![Build Status](https://img.shields.io/travis/dwyl/aws-sdk-mock/master.svg?style=flat-square)](https://travis-ci.org/dwyl/aws-sdk-mock)
[![codecov.io](https://img.shields.io/codecov/c/github/dwyl/aws-sdk-mock/master.svg?style=flat-square)](http://codecov.io/github/dwyl/aws-sdk-mock?branch=master)
[![Dependency Status](https://david-dm.org/dwyl/aws-sdk-mock.svg?style=flat-square)](https://david-dm.org/dwyl/aws-sdk-mock)
[![devDependency Status](https://david-dm.org/dwyl/aws-sdk-mock/dev-status.svg?style=flat-square)](https://david-dm.org/dwyl/aws-sdk-mock#info=devDependencies)
[![Known Vulnerabilities](https://snyk.io/test/github/dwyl/aws-sdk-mock/badge.svg?targetFile=package.json&style=flat-square)](https://snyk.io/test/github/dwyl/aws-sdk-mock?targetFile=package.json)

<!-- broken see: https://github.com/dwyl/aws-sdk-mock/issues/161#issuecomment-444181270
[![NPM](https://nodei.co/npm-dl/aws-sdk-mock.png?months=3)](https://nodei.co/npm/aws-sdk-mock/)
-->

This module was created to help test AWS Lambda functions but can be used in any situation where the AWS SDK needs to be mocked.

If you are *new* to Amazon WebServices Lambda
(*or need a refresher*),
please checkout our our  
***Beginners Guide to AWS Lambda***:
<https://github.com/dwyl/learn-aws-lambda>

* [Why](#why)
* [What](#what)
* [Getting Started](#how)
* [Documentation](#documentation)
* [Background Reading](#background-reading)

## Why?

Testing your code is *essential* everywhere you need *reliability*.

Using stubs means you can prevent a specific method from being called directly. In our case we want to prevent the actual AWS services to be called while testing functions that use the AWS SDK.

## What?

Uses [Sinon.js](https://sinonjs.org/) under the hood to mock the AWS SDK services and their associated methods.

## *How*? (*Usage*)

### *install* `aws-sdk-mock` from NPM

```sh
npm install aws-sdk-mock --save-dev
```

### Use in your Tests

#### Using plain JavaScript

```js

const AWS = require('aws-sdk-mock');

AWS.mock('DynamoDB', 'putItem', function (params, callback){
  callback(null, 'successfully put item in database');
});

AWS.mock('SNS', 'publish', 'test-message');

// S3 getObject mock - return a Buffer object with file data
AWS.mock('S3', 'getObject', Buffer.from(require('fs').readFileSync('testFile.csv')));


/**
    TESTS
**/

AWS.restore('SNS', 'publish');
AWS.restore('DynamoDB');
AWS.restore('S3');
// or AWS.restore(); this will restore all the methods and services
```

#### Using TypeScript

```typescript
import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GetItemInput } from 'aws-sdk/clients/dynamodb';

beforeAll(async (done) => {
  //get requires env vars
  done();
 });

describe('the module', () => {

/**
    TESTS below here
**/

  it('should mock getItem from DynamoDB', async () => {
    // Overwriting DynamoDB.getItem()
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB', 'getItem', (params: GetItemInput, callback: Function) => {
      console.log('DynamoDB', 'getItem', 'mock called');
      callback(null, {pk: 'foo', sk: 'bar'});
    })

    const input:GetItemInput = { TableName: '', Key: {} };
    const dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    expect(await dynamodb.getItem(input).promise()).toStrictEqual({ pk: 'foo', sk: 'bar' });

    AWSMock.restore('DynamoDB');
  });

  it('should mock reading from DocumentClient', async () => {
    // Overwriting DynamoDB.DocumentClient.get()
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params: GetItemInput, callback: Function) => {
      console.log('DynamoDB.DocumentClient', 'get', 'mock called');
      callback(null, {pk: 'foo', sk: 'bar'});
    });

    const input:GetItemInput = { TableName: '', Key: {} };
    const client = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    expect(await client.get(input).promise()).toStrictEqual({ pk: 'foo', sk: 'bar' });

    AWSMock.restore('DynamoDB.DocumentClient');
  });
});
```

#### Sinon

You can also pass Sinon spies to the mock:

```js
const updateTableSpy = sinon.spy();
AWS.mock('DynamoDB', 'updateTable', updateTableSpy);

// Object under test
myDynamoManager.scaleDownTable();

// Assert on your Sinon spy as normal
assert.isTrue(updateTableSpy.calledOnce, 'should update dynamo table via AWS SDK');
const expectedParams = {
  TableName: 'testTableName',
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1
  }
};
assert.isTrue(updateTableSpy.calledWith(expectedParams), 'should pass correct parameters');
```

**NB: The AWS Service needs to be initialised inside the function being tested in order for the SDK method to be mocked** e.g for an AWS Lambda function example 1 will cause an error `ConfigError: Missing region in config`  whereas in example 2 the sdk will be successfully mocked.

Example 1:

```js
const AWS      = require('aws-sdk');
const sns      = AWS.SNS();
const dynamoDb = AWS.DynamoDB();

exports.handler = function(event, context) {
  // do something with the services e.g. sns.publish
}
```

Example 2:

```js
const AWS = require('aws-sdk');

exports.handler = function(event, context) {
  const sns      = AWS.SNS();
  const dynamoDb = AWS.DynamoDB();
  // do something with the services e.g. sns.publish
}
```

Also note that if you initialise an AWS service inside a callback from an async function inside the handler function, that won't work either.

Example 1 (won't work):

```js
exports.handler = function(event, context) {
  someAsyncFunction(() => {
    const sns      = AWS.SNS();
    const dynamoDb = AWS.DynamoDB();
    // do something with the services e.g. sns.publish
  });
}
```

Example 2 (will work):

```js
exports.handler = function(event, context) {
  const sns      = AWS.SNS();
  const dynamoDb = AWS.DynamoDB();
  someAsyncFunction(() => {
    // do something with the services e.g. sns.publish
  });
}
```

### Nested services

It is possible to mock nested services like `DynamoDB.DocumentClient`. Simply use this dot-notation name as the `service` parameter to the `mock()` and `restore()` methods:

```js
AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
  callback(null, {Item: {Key: 'Value'}});
});
```

**NB: Use caution when mocking both a nested service and its parent service.** The nested service should be mocked before and restored after its parent:

```js
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
const csd = new AWS.CloudSearchDomain({
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
const path = require('path');
const AWS = require('aws-sdk-mock');

AWS.setSDK(path.resolve('../../functions/foo/node_modules/aws-sdk'));

/**
    TESTS
**/
```

### Setting the `aws-sdk` object explicitly

Due to transpiling, code written in TypeScript or ES6 may not correctly mock because the `aws-sdk` object created within `aws-sdk-mock` will not be equal to the object created within the code to test. In addition, it is sometimes convenient to have multiple SDK instances in a test. For either scenario, it is possible to pass in the SDK object directly using `setSDKInstance()`.

Example:

```js
// test code
const AWSMock = require('aws-sdk-mock');
import AWS from 'aws-sdk';
AWSMock.setSDKInstance(AWS);
AWSMock.mock('SQS', /* ... */);

// implementation code
const sqs = new AWS.SQS();
```

### Configuring promises

If your environment lacks a global Promise constructor (e.g. nodejs 0.10), you can explicitly set the promises on `aws-sdk-mock`. Set the value of `AWS.Promise` to the constructor for your chosen promise library.

Example (if Q is your promise library of choice):

```js
const AWS = require('aws-sdk-mock'),
    Q = require('q');

AWS.Promise = Q.Promise;


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

### `AWS.remock(service, method, replace)`

Updates the `replace` method on an existing mocked service.

| Param | Type | Optional/Required | Description     |
| :------------- | :------------- | :------------- | :------------- |
| `service`      | string    | Required     | AWS service to mock e.g. SNS, DynamoDB, S3     |
| `method`      | string    | Required     | method on AWS service to mock e.g. 'publish' (for SNS), 'putItem' for 'DynamoDB'     |
| `replace`      | string or function    | Required     | A string or function to replace the method   |

### `AWS.setSDK(path)`

Explicitly set the require path for the `aws-sdk`

| Param | Type | Optional/Required | Description     |
| :------------- | :------------- | :------------- | :------------- |
| `path`      | string    | Required     | Path to a nested AWS SDK node module     |

### `AWS.setSDKInstance(sdk)`

Explicitly set the `aws-sdk` instance to use

| Param | Type | Optional/Required | Description     |
| :------------- | :------------- | :------------- | :------------- |
| `sdk`      | object    | Required     | The AWS SDK object     |

## Background Reading

* [Mocking using Sinon.js](http://sinonjs.org/docs/)
* [AWS Lambda](https://github.com/dwyl/learn-aws-lambda)

**Contributions welcome! Please submit issues or PRs if you think of anything that needs updating/improving**
