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

export type ReplaceFn<C extends ClientName, M extends MethodName<C>> = (params: AWSRequest<C, M>, callback: AWSCallback<C, M>) => void

export function mock<C extends ClientName, M extends MethodName<C>>(
  service: C,
  method: M,
  replace: ReplaceFn<C, M>,
): void;
export function mock<C extends ClientName, NC extends NestedClientName<C>>(service: NestedClientFullName<C, NC>, method: NestedMethodName<C, NC>, replace: any): void;
export function mock<C extends ClientName>(service: C, method: MethodName<C>, replace: any): void;

export function remock<C extends ClientName, M extends MethodName<C>>(
  service: C,
  method: M,
  replace: ReplaceFn<C, M>,
): void;
export function remock<C extends ClientName>(service: C, method: MethodName<C>, replace: any): void;
export function remock<C extends ClientName, NC extends NestedClientName<C>>(service: NestedClientFullName<C, NC>, method: NestedMethodName<C, NC>, replace: any): void;

export function restore<C extends ClientName>(service?: C, method?: MethodName<C>): void;
export function restore<C extends ClientName, NC extends NestedClientName<C>>(service?: NestedClientFullName<C, NC>, method?: NestedMethodName<C, NC>): void;

export function setSDK(path: string): void;
export function setSDKInstance(instance: typeof import('aws-sdk')): void;

/**
 * The SDK defines a class for each service as well as a namespace with the same name.
 * Nested clients, e.g. DynamoDB.DocumentClient, are defined on the namespace, not the class.
 * That is why we need to fetch these separately as defined below in the NestedClientName<C> type
 * 
 * The NestedClientFullName type supports validating strings representing a nested clients name in dot notation
 * 
 * We add the ts-ignore comments to avoid the type system to trip over the many possible values for NestedClientName<C>
 */
export type NestedClientName<C extends ClientName> = keyof typeof AWS[C];
// @ts-ignore
export type NestedClientFullName<C extends ClientName, NC extends NestedClientName<C>> = `${C}.${NC}`;
// @ts-ignore
export type NestedClient<C extends ClientName, NC extends NestedClientName<C>> = InstanceType<(typeof AWS)[C][NC]>;
// @ts-ignore
export type NestedMethodName<C extends ClientName, NC extends NestedClientName<C>> = keyof ExtractMethod<NestedClient<C, NC>>;
