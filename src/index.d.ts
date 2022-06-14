/// <reference types="@cloudflare/workers-types" />

import { Router } from "itty-router";

export interface HyperState<T> extends DurableObjectState {
  dirty: Set<Extract<keyof T, string>>;
  initialized?: Promise<void>;
  persisted: Set<Extract<keyof T, string>>;
  tempKey: string;
}

export class HyperDurable<T extends object, Env = unknown> {
  readonly isProxy?: boolean;
  readonly original?: any;
  env: Env;
  state: HyperState<T>;
  storage: DurableObjectStorage;
  router: Router;

  constructor(state: DurableObjectState, env: Env);

  initialize(): Promise<void>;
  load(): Promise<void>;
  persist(): Promise<void>;
  destroy(): Promise<void>
  toObject(): T;
  fetch(request: Request): Promise<Response>;
}

export class HyperNamespaceProxy<DO extends HyperDurable<any, Env>, Env> {
  namespace: DurableObjectNamespace;
  ref: DO;
  newUniqueId: (_options?: DurableObjectNamespaceNewUniqueIdOptions) => DurableObjectId;
  idFromName: (name: string) => DurableObjectId;
  idFromString: (hexId: string) => DurableObjectId;

  constructor(
    namespace: DurableObjectNamespace,
    ref: new (state: DurableObjectState, env: Env) => DO
  );
  get(id: DurableObjectId): DurableObjectStub & {
      [Prop in keyof DO]:
        DO[Prop] extends (...args: any) => any
        ? (...args: Parameters<DO[Prop]>) => Promise<ReturnType<DO[Prop]>>
        : Promise<DO[Prop]>;
    } & {
      [Prop in keyof DO as DO[Prop] extends Function ? never : `set${Capitalize<string & Prop>}`]:
        (newValue: DO[Prop]) => Promise<DO[Prop]>
    };
}

export function proxyHyperDurables<DO extends HyperDurable<any, Env>, Env>(
  env: Env,
  doBindings: { [key: string]: new (state: DurableObjectState, env: Env) => DO }
): {
  [Prop in keyof typeof doBindings]: HyperNamespaceProxy<DO, Env>
}
