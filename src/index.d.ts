/// <reference types="@cloudflare/workers-types" />

import { Router } from "itty-router";

export interface HyperState extends DurableObjectState {
  dirty: Set<string>;
  initialized?: Promise<void>;
  persisted: Set<string>;
  tempKey: string;
}

export class HyperDurable<Env = unknown> {
  readonly isProxy?: boolean;
  readonly original?: any;
  env: Env;
  state: HyperState;
  storage: DurableObjectStorage;
  router: Router;

  constructor(state: DurableObjectState, env: Env);

  initialize(): Promise<void>;
  load(): Promise<void>;
  persist(): Promise<void>;
  destroy(): Promise<void>
  toObject(): object;
  fetch(request: Request): Promise<Response>;
}

export class HyperNamespaceProxy<T extends HyperDurable<ENV>, ENV> {
  namespace: DurableObjectNamespace;
  ref: T;
  newUniqueId: (_options?: DurableObjectNamespaceNewUniqueIdOptions) => DurableObjectId;
  idFromName: (name: string) => DurableObjectId;
  idFromString: (hexId: string) => DurableObjectId;

  constructor(
    namespace: DurableObjectNamespace,
    ref: new (state: DurableObjectState, env: ENV) => T
  );
  get(id: DurableObjectId): DurableObjectStub & {
      [Prop in keyof T]:
        T[Prop] extends Function
        ? () => Promise<unknown>
        : Promise<unknown>;
    } & {
      [Prop in keyof T as T[Prop] extends Function ? never : `set${Capitalize<string & Prop>}`]:
        (newValue: T[Prop]) => Promise<unknown>
    };
}

export function proxyHyperDurables<DO extends HyperDurable<ENV>, ENV>(
  env: ENV,
  doBindings: { [key: string]: new (state: DurableObjectState, env: ENV) => DO }
): {
  [Prop in keyof typeof doBindings]: HyperNamespaceProxy<DO, ENV>
}
