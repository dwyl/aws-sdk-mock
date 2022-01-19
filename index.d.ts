// TypeScript Version: 3.2
import { Request, AWSError } from 'aws-sdk/lib/core';
import AWS = require('aws-sdk/clients/all');

export type ClientName = keyof typeof AWS;
export type Client<C extends ClientName> = InstanceType<(typeof AWS)[C]>;

export type ExtractMethod<T extends {}> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never };

export type MethodName<C extends ClientName> = keyof ExtractMethod<Client<C>>;
export type Method<C extends ClientName, M extends MethodName<C>> = ExtractMethod<Client<C>>[M];

export type AWSRequest<C extends ClientName, M extends MethodName<C>> = Method<C, M> extends AWSMethod<infer P, any> ? P : never;
export type AWSCallback<C extends ClientName, M extends MethodName<C>> = Method<C, M> extends AWSMethod<any, infer D> ? {
  (err: undefined, data: D): void;
  (err: AWSError, data?: undefined): void;
} : never;

export interface AWSMethod<P, D> {
  (params: P, callback?: Callback<D>): Request<D, AWSError>;
  (callback?: Callback<D>): Request<D, AWSError>;
}

export type Callback<D> = (err: AWSError | undefined, data: D) => void;

export function mock<C extends ClientName, M extends MethodName<C>>(
  service: C,
  method: M,
  replace: (params: AWSRequest<C, M>, callback: AWSCallback<C, M>) => void
): void;
export function mock<C extends ClientName>(service: C, method: MethodName<C>, replace: any): void;

export function remock<C extends ClientName, M extends MethodName<C>>(
  service: C,
  method: M,
  replace: (params: AWSRequest<C, M>, callback: AWSCallback<C, M>) => void
): void;
export function remock<C extends ClientName>(service: C, method: MethodName<C>, replace: any): void;

export function restore<C extends ClientName>(service?: C, method?: MethodName<C>): void;

export function setSDK(path: string): void;
export function setSDKInstance(instance: typeof import('aws-sdk')): void;