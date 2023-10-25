/// <reference path="types.ts"" />
"use strict";

/**
 * Helpers to mock the AWS SDK Services using sinon.js under the hood
 * Export two functions:
 * - mock
 * - restore
 *
 * Mocking is done in two steps:
 * - mock of the constructor for the service on AWS
 * - mock of the method on the service
 **/

import type { SinonExpectation, SinonSpy, SinonStubStatic, SinonStubbedInstance } from "sinon";
import sinon = require("sinon");

import traverse = require("traverse");

import AWS_SDK = require("aws-sdk");

const { Readable } = require("stream");

import {
  type ReplaceFn,
  type ClientName,
  type MethodName,
  type mock,
  type remock,
  type restore,
  type setSDK,
  type setSDKInstance,
  type Client,
  type AWSCallback,
  type AWSRequest,
} from "./types";

// TYPES -----------------------------------
// AWS type that is to serve as a mock
type AWS_Stub = {
  _isMockFunction: boolean;
  isSinonProxy: boolean;
};

type AWS_MOCK = {
  mock?: typeof mock;
  remock?: typeof remock;
  restore?: typeof restore;
  setSDK?: typeof setSDK;
  setSDKInstance?: typeof setSDKInstance;
  Promise: Awaited<Promise<any>>;
};

type Replace<C extends ClientName, M extends MethodName<C>> = {
  replace: ReplaceFn<C, M>;
  stub?: SinonStubStatic;
};

type MethodMock = {
  [key: string]: Replace<ClientName, MethodName<ClientName>>;
};

interface Service {
  Constructor: new (...args: any[]) => any;
  methodMocks: MethodMock;
  invoked: boolean;
  clients?: Client<ClientName>[];
  stub?: SinonStubStatic;
}

type ExtendedClient = Client<ClientName> & {
  options: {
    attrValue: ClientName;
    paramValidation: boolean;
  };
  api: {
    operations: any;
  };
};

type SERVICES<T extends string> = {
  [key in T]: Service;
};

// PACKAGE ---------------------------------
// Real AWS instance from 'aws-sdk'
let _AWS: typeof AWS_SDK = AWS_SDK;

const AWS: AWS_MOCK = {
  Promise: global.Promise,
};
const services: Partial<SERVICES<ClientName>> = {};

/**
 * Sets the aws-sdk to be mocked.
 */
AWS.setSDK = function (path: string) {
  _AWS = require(path);
};

AWS.setSDKInstance = function (sdk: typeof AWS_SDK) {
  _AWS = sdk;
};

/**
 * Stubs the service and registers the method that needs to be mocked.
 */
AWS.mock = function <C extends ClientName, M extends MethodName<C> & string>(
  service: C,
  method: M,
  replace: ReplaceFn<ClientName, MethodName<ClientName>>
) {
  // If the service does not exist yet, we need to create and stub it.
  if (!services[service]) {
    const service_to_add: Service = {
      // Save the real constructor so we can invoke it later on.
      // Uses traverse for easy access to nested services (dot-separated)
      Constructor: traverse(_AWS).get(service.split(".")),
      methodMocks: {},
      invoked: false,
    };

    services[service] = service_to_add;
    mockService(service);
  }

  const service_obj = services[service];
  const methodName = method as MethodName<ClientName>;

  // Register the method to be mocked out.
  if (!service_obj?.methodMocks[methodName]) {
    // Adding passed mock method
    if (service_obj !== undefined) service_obj.methodMocks[methodName] = { replace: replace };

    // If the constructor was already invoked, we need to mock the method here.
    if (service_obj?.invoked) {
      service_obj?.clients?.forEach((client) => {
        mockServiceMethod(service, client, methodName, replace);
      });
    }
  }

  return service_obj?.methodMocks[method];
};

/**
 * Stubs the service and registers the method that needs to be re-mocked.
 */
AWS.remock = function <C extends ClientName, M extends MethodName<C> & string>(
  service: C,
  method: M,
  replace: ReplaceFn<ClientName, MethodName<ClientName>>
) {
  // If the method is inside the service, we restore the method
  if (services[service]?.methodMocks[method]) {
    restoreMethod(service, method);

    const service_obj = services[service];
    if (service_obj !== undefined) {
      service_obj.methodMocks[method] = {
        replace: replace,
      };
    }
  }

  const methodName = method as MethodName<ClientName>;
  // We check if the service was invoked or not. If it was, we mock the service method with the `replace` function
  if (services[service]?.invoked) {
    services[service]?.clients?.forEach((client) => {
      mockServiceMethod(service, client, methodName, replace);
    });
  }

  return services[service]?.methodMocks[method];
};

/**
 * Stub the constructor for the service on AWS.
 * E.g. calls of new AWS.SNS() are replaced.
 */
function mockService(service: ClientName) {
  const nestedServices: string[] = service.split(".");

  const method = nestedServices.pop();
  const object = traverse(_AWS).get(nestedServices);

  // Method type guard
  if (!method) return;

  const service_obj = services[service];

  if (service_obj) {
    const serviceStub = sinon.stub(object, method).callsFake(function (...args) {
      service_obj.invoked = true;

      /**
       * Create an instance of the service by calling the real constructor
       * we stored before. E.g. const client = new AWS.SNS()
       * This is necessary in order to mock methods on the service.
       */
      const client = new service_obj.Constructor(...args);
      service_obj.clients = service_obj.clients || [];
      service_obj.clients.push(client);

      // Once this has been triggered we can mock out all the registered methods.
      for (const key in service_obj.methodMocks) {
        const methodKey = key as MethodName<ClientName>;
        const objectMethodMock = service_obj.methodMocks[key]
        if(objectMethodMock) {
          mockServiceMethod(service, client, methodKey, objectMethodMock.replace);
        }
      }
      return client;
    });
    service_obj.stub = serviceStub;
  }
}

/**
 * Wraps a sinon stub or jest mock function as a fully functional replacement function
 *
 * If you want to help us better define the `replace` function (without having to use any), please open a PR
 * (especially if you're a TS wizard 🧙‍♂️).
 *
 * We're not entirely sure if SinonStubbedInstance<any> is correct,
 * but we're adding this instead of `replace: any` to maintain specificity.
 */
function wrapTestStubReplaceFn(replace: ReplaceFn<ClientName, MethodName<ClientName>> | AWS_Stub | SinonStubbedInstance<any>) {
  if (typeof replace !== "function") {
    if (!(replace._isMockFunction || replace.isSinonProxy)) {
      return replace;
    }
  } else {
    return (params: AWSRequest<ClientName, MethodName<ClientName>>, cb: AWSCallback<ClientName, MethodName<ClientName>> | undefined) => {
      // If only one argument is provided, it is the callback.
      // So we make the callback equal the params.
      let callback: typeof params | AWSCallback<ClientName, MethodName<ClientName>>;
      if (cb === undefined || !cb) {
        callback = params;
      }

      // If not, the callback is the passed cb
      else {
        callback = cb;
      }

      // Spy on the users callback so we can later on determine if it has been called in their replace
      const cbSpy = sinon.spy(callback) as SinonSpy;
      try {
        // The replace function can also be a `functionStub`.
        // Call the users replace, check how many parameters it expects to determine if we should pass in callback only, or also parameters
        const result = replace.length === 1 ? replace(cbSpy) : replace(params, cbSpy);
        // If the users replace already called the callback, there's no more need for us do it.
        if (cbSpy.called) {
          return;
        }
        if (typeof result.then === "function") {
          result.then(
            (val: any) => callback(undefined, val),
            (err: any) => callback(err)
          );
        } else {
          callback(undefined, result);
        }
      } catch (err) {
        callback(err);
      }
    };
  }
}

/**
 *  Stubs the method on a service.
 *
 * All AWS service methods take two argument:
 *  - params: an object.
 *  - callback: of the form 'function(err, data) {}'.
 */
function mockServiceMethod(
  service: ClientName,
  client: Client<ClientName>,
  method: MethodName<ClientName>,
  replace: ReplaceFn<ClientName, MethodName<ClientName>>
) {
  replace = wrapTestStubReplaceFn(replace);

  const service_obj = services[service];

  // Service type guard
  if (!service_obj) return;

  const serviceMethodMock = service_obj.methodMocks[method]

  // Service method mock type guard
  if (!serviceMethodMock) return;

  serviceMethodMock.stub = sinon.stub(client, method).callsFake(function () {
    const args = Array.prototype.slice.call(arguments);

    let userArgs: string | Function[];
    let userCallback: Function;

    if (typeof args[(args.length || 1) - 1] === "function") {
      userArgs = args.slice(0, -1);
      userCallback = args[(args.length || 1) - 1];
    } else {
      userArgs = args;
    }

    const havePromises = typeof AWS.Promise === "function";

    let promise: typeof AWS.Promise;
    let resolve: (value: any) => any;
    let reject: (value: any) => any;
    let storedResult: Awaited<Promise<any>>;

    const tryResolveFromStored = function () {
      if (storedResult && promise) {
        if (typeof storedResult.then === "function") {
          storedResult.then(resolve, reject);
        } else if (storedResult.reject) {
          reject(storedResult.reject);
        } else {
          resolve(storedResult.resolve);
        }
      }
    };

    const callback = function (err: unknown, data: unknown) {
      if (!storedResult) {
        if (err) {
          storedResult = { reject: err };
        } else {
          storedResult = { resolve: data };
        }
      }
      if (userCallback) {
        userCallback(err, data);
      }
      tryResolveFromStored();
    };

    const request = {
      promise: havePromises
        ? function () {
            if (!promise) {
              promise = new AWS.Promise(function (resolve_: any, reject_: any) {
                resolve = resolve_;
                reject = reject_;
              });
            }
            tryResolveFromStored();
            return promise;
          }
        : undefined,
      createReadStream: function () {
        if (storedResult instanceof Readable) {
          return storedResult;
        }
        if (replace instanceof Readable) {
          return replace;
        } else {
          const stream = new Readable();
          stream._read = function () {
            if (typeof replace === "string" || Buffer.isBuffer(replace)) {
              this.push(replace);
            }
            this.push(null);
          };
          return stream;
        }
      },
      on: function (eventName: string, callback: Function) {
        return this;
      },
      send: function (callback: Function) {
        callback(storedResult.reject, storedResult.resolve);
      },
    };

    // different locations for the paramValidation property
    const _client = client as ExtendedClient;
    const config = _client.config || _client.options || _AWS.config;
    if (config.paramValidation) {
      try {
        // different strategies to find method, depending on whether the service is nested/unnested
        const inputRules = ((_client.api && _client.api.operations[method as keyof typeof _client.api.operations]) || _client[method] || {}).input;
        if (inputRules) {
          const params = userArgs[(userArgs.length || 1) - 1];
          // @ts-ignore
          new _AWS.ParamValidator((_client.config || _AWS.config).paramValidation).validate(inputRules, params);
        }
      } catch (e: unknown) {
        callback(e, null);
        return request;
      }
    }

    // If the value of 'replace' is a function we call it with the arguments.
    if (typeof replace === "function") {
      const concatUserArgs = userArgs.concat([callback]) as [params: never, callback: any];
      const result = replace.apply(replace, concatUserArgs);
      if (storedResult === undefined && result != null && (typeof result.then === "function" || result instanceof Readable)) {
        storedResult = result;
      }
    }
    // Else we call the callback with the value of 'replace'.
    else {
      callback(null, replace);
    }
    return request;
  });
}

/**
 * Restores the mocks for just one method on a service, the entire service, or all mocks.
 *
 * When no parameters are passed, everything will be reset.
 * When only the service is passed, that specific service will be reset.
 * When a service and method are passed, only that method will be reset.
 */
AWS.restore = function <C extends ClientName>(service?: C, method?: MethodName<C>) {
  if (!service) {
    restoreAllServices();
  } else {
    if (method) {
      restoreMethod(service, method);
    } else {
      restoreService(service);
    }
  }
};

/**
 * Restores all mocked service and their corresponding methods.
 */
function restoreAllServices() {
  for (let serviceKey in services) {
    const service = serviceKey as ClientName;
    restoreService(service);
  }
}

/**
 * Restores a single mocked service and its corresponding methods.
 */
function restoreService(service: ClientName) {
  if (services[service]) {
    restoreAllMethods(service);

    const serviceObj = services[service];
    if (serviceObj) {
      const stubFun = services[service]?.stub as SinonExpectation;
      if (stubFun) {
        stubFun.restore();
      }
    }

    delete services[service];
  } else {
    console.log("Service " + service + " was never instantiated yet you try to restore it.");
  }
}

/**
 * Restores all mocked methods on a service.
 */
function restoreAllMethods(service: ClientName) {
  for (const method in services[service]?.methodMocks) {
    const methodName = method as MethodName<ClientName>;
    restoreMethod(service, methodName);
  }
}

/**
 * Restores a single mocked method on a service.
 */
function restoreMethod<C extends ClientName, M extends MethodName<C>>(service: C, method: M) {
  const methodName = method as string;

  const serviceObj = services[service]

  // Service type guard
  if(!serviceObj) {
    console.log("Method " + service + " was never instantiated yet you try to restore it.");
    return
  }

  const serviceMethodMock = serviceObj.methodMocks[methodName]

  // Service method mock type guard
  if(!serviceMethodMock) return

  // restore this method on all clients
  const serviceClients = services[service]?.clients;
  if (serviceClients) {
    // Iterate over each client and get the mocked method and restore it
    serviceClients.forEach((client) => {
      const mockedClientMethod = client[methodName as keyof typeof client] as SinonSpy;
      if (mockedClientMethod && typeof mockedClientMethod.restore === "function") {
        mockedClientMethod.restore();
      }
    });
  }
  delete services[service]?.methodMocks[methodName];
}

(function () {
  const setPromisesDependency = _AWS.config.setPromisesDependency;
  /* istanbul ignore next */
  /* only to support for older versions of aws-sdk */
  if (typeof setPromisesDependency === "function") {
    AWS.Promise = global.Promise;
    _AWS.config.setPromisesDependency = function (p) {
      AWS.Promise = p;
      return setPromisesDependency(p);
    };
  }
})();

module.exports = AWS;
