import AWS from 'aws-sdk';
import { mock, remock, restore, setSDK, setSDKInstance } from '..';

// Valid mock for aws service
mock('S3', 'createBucket', '');
mock('S3', 'createBucket', (params: AWS.S3.CreateBucketRequest, cb) => {});
remock('S3', 'createBucket', () => {});

// Invalid mock for aws service
mock('APIGateway', 'fnDoesNotExist', () => {});
mock('NotAWSService', 'anyfn', () => {});

setSDKInstance(AWS);
