'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import fs from 'fs';
import nuclideUri from '../../nuclide-remote-uri';
import invariant from 'assert';
import Module from 'module';

import {generateProxy} from './proxy-generator';
import {parseServiceDefinition} from './service-parser';

// Proxy dependencies
import Rx from 'rxjs';
import {trackOperationTiming} from '../../nuclide-analytics';

import type {
  ReturnKind,
  Type,
  Parameter,
} from './types';

export type RpcContext = {
  callRemoteFunction(functionName: string, returnType: ReturnKind, args: Object): any;
  callRemoteMethod(
    objectId: number,
    methodName: string,
    returnType: ReturnKind,
    args: Object
  ): any;
  createRemoteObject(
    interfaceName: string,
    thisArg: Object,
    unmarshalledArgs: Array<any>,
    argTypes: Array<Parameter>
  ): void;
  disposeRemoteObject(object: Object): Promise<void>;
  marshal(value: any, type: Type): any;
  unmarshal(value: any, type: Type): any;
  marshalArguments(
    args: Array<any>,
    argTypes: Array<Parameter>
  ): Promise<Object>;
  unmarshalArguments(
    args: Object,
    argTypes: Array<Parameter>
  ): Promise<Array<any>>;
};

export type ProxyFactory = (context: RpcContext) => Object;

/** Cache for remote proxies. */
const proxiesCache: Map<string, ProxyFactory> = new Map();

export function createProxyFactory(
  serviceName: string,
  preserveFunctionNames: boolean,
  definitionPath: string,
): ProxyFactory {
  invariant(
    nuclideUri.isAbsolute(definitionPath),
    `"${definitionPath}" definition path must be absolute.`
  );
  if (!proxiesCache.has(definitionPath)) {
    const filename = nuclideUri.parsePath(definitionPath).name + 'Proxy.js';
    const definitionSource = fs.readFileSync(definitionPath, 'utf8');
    const defs = parseServiceDefinition(definitionPath, definitionSource);
    const code = generateProxy(serviceName, preserveFunctionNames, defs);

    const m = loadCodeAsModule(code, filename);
    m.exports.inject(Rx.Observable, trackOperationTiming);

    proxiesCache.set(definitionPath, m.exports);
  }

  const factory = proxiesCache.get(definitionPath);
  invariant(factory != null);

  return factory;
}

function loadCodeAsModule(code: string, filename: string): Module {
  const m = new Module();
  m.filename = m.id = nuclideUri.join(__dirname, filename);
  m.paths = []; // Prevent accidental requires by removing lookup paths.
  m._compile(code, filename);

  return m;
}

// Export caches for testing.
export const __test__ = {
  proxiesCache,
};
