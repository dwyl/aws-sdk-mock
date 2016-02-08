# aws-sdk-mock

AWSome mocks for Javascript aws-sdk services.

[![Build Status](https://travis-ci.org/dwyl/aws-sdk-mock.svg?branch=master)](https://travis-ci.org/dwyl/aws-sdk-mock)
[![codecov.io](https://codecov.io/github/dwyl/aws-sdk-mock/coverage.svg?branch=master)](https://codecov.io/github/dwyl/aws-sdk-mock?branch=master)
[![Dependency Status](https://david-dm.org/dwyl/aws-sdk-mock.svg)](https://david-dm.org/dwyl/aws-sdk-mock)
[![devDependency Status](https://david-dm.org/dwyl/aws-sdk-mock/dev-status.svg)](https://david-dm.org/dwyl/aws-sdk-mock#info=devDependencies)

[![NPM](https://nodei.co/npm-dl/aws-sdk-mock.png?months=3)](https://nodei.co/npm/aws-sdk-mock/)

If you are *new* to Amazon WebServices Lambda
(*or need a refresher*),
please checkout our our  
***Beginners Guide to AWS Lambda***:
https://github.com/dwyl/learn-aws-lambda

## Why?

Testing your code is *essential* everywhere you need *reliability*.

Using stubs means you can prevent a specific method from being called directly.

## What?

Uses Sinon.js under the hood to mock the AWS SDK services and associated methods.

## *How*? (*Usage*)

### *install* `aws-sdk-mock` from NPM

```sh
npm install aws-sdk-mock --save-dev
```

### Use in your Tests

```js

import AWS from 'aws-sdk-mock';

AWS.mock('DynamoDB', 'putItem', function (params, callback){
  callback(null, "successfully put item in database");
});

AWS.mock('SNS', 'publish');

/**
    TESTS
**/

AWS.restore('SNS', 'publish');
AWS.restore('DynamoDB');
// or AWS.restore(); this will restore all the methods and services 
```

## Documentation

### `AWS.mock(service, method, replace)`

Replaces a method on an AWS service with a replacement function or string.

- `service`: AWS service to mock e.g. SNS, DynamoDB, S3
- `method` : method on AWS service to mock e.g. 'publish' (for SNS), 'putItem' for 'DynamoDB'
- `replace` : a string or function to replace the method

### `AWS.restore(service, method)`

Removes the mock to restore the specified AWS service

Optional:
- `service` : AWS service to restore - If only the service is specified, all the methods are restored
- `method`  : Method on AWS service to restore

If no arguments are given to `AWS.restore` then all the services and their associated methods are restored
i.e. equivalent to a 'restore all' function.


## Background Reading
