import { HyperDurable } from './HyperDurable';
import { HyperError } from './HyperError';

export class HyperNamespaceProxy<T extends HyperDurable<ENV>, ENV> implements DurableObjectNamespace {
  namespace: DurableObjectNamespace;
  ref: T;

  newUniqueId: (_options?: DurableObjectNamespaceNewUniqueIdOptions) => DurableObjectId;
  idFromName: (name: string) => DurableObjectId;
  idFromString: (hexId: string) => DurableObjectId;

  constructor(
    namespace: DurableObjectNamespace,
    ref: new (state: DurableObjectState, env: ENV) => T
  ) {
    this.namespace = namespace;
    // Create a reference of the DO to check for methods / properties
    // @ts-ignore
    this.ref = new ref({}, {});

    this.newUniqueId = namespace.newUniqueId;
    this.idFromName = namespace.idFromName;
    this.idFromString = namespace.idFromString;

    const handler = {
      get: (target: any, key: string, receiver: any) => {
        // Return bound stub getter
        if (key === 'get') return this.get.bind(this);

        // If prop is another function, bind `this` to the original namespace
        return typeof target[key] === 'function'
          ? target[key].bind(namespace)
          : Reflect.get(target, key, receiver);
      }
    };

    return new Proxy(this, handler);
  }

  get(id: DurableObjectId) {
    // All of our prop getters & methods return Promises, since everything uses the
    // fetch interface.
    type PromisedGetStub = {
      [Prop in keyof T]?:
        T[Prop] extends Function
        ? () => Promise<unknown>
        : Promise<unknown>;
    };
    // All of our props have setters formatted as: setProperty()
    type SetStub = {
      [Prop in keyof T as T[Prop] extends Function ? never : `set${Capitalize<string & Prop>}`]?:
        (newValue: T[Prop]) => Promise<unknown>
    }
    type HyperStub = DurableObjectStub & PromisedGetStub & SetStub;

    const stub = this.namespace.get(id);
    const hyperStub: HyperStub = Object.assign<DurableObjectStub, object>(stub, {});

    function createHyperRequest(action: string, key: string, payload?: object) {
      return new Request(`https://hd.io/${action}/${key}`, {
        body: payload ? JSON.stringify(payload) : null,
        method: payload ? 'POST' : 'GET',
        headers: {
          'Content-Type': payload ? 'application/json' : null,
        },
      });
    }

    async function sendHyperRequest(durable: DurableObjectStub, request: Request) {
      const promise = durable.fetch(request);
      return promise.then(res => res.json());
    }

    const handler = {
      get: (_target: object, key: string) => {
        // Short circuit for fetch to maintain manual access
        if (key === 'fetch') return hyperStub.fetch.bind(hyperStub);

        if (typeof this.ref[key] === 'function') {
          // Anonymous function to pass args
          return function (...args: any[]) {
            const request = createHyperRequest('call', key, { args });
            return sendHyperRequest(hyperStub, request);
          }
        }

        // Property Setter
        if (key.startsWith('set')) {
          // Anonymous function to pass args
          return function (value: unknown) {
            const realKey = key[3].toLowerCase() + key.slice(4);
            const request = createHyperRequest('set', realKey, { value });
            return sendHyperRequest(hyperStub, request);
          }
        }

        // Property Getter
        const request = createHyperRequest('get', key);
        return sendHyperRequest(hyperStub, request);
      }
    }

    return new Proxy<HyperStub>(hyperStub, handler);
  }
}

export const proxyHyperDurables = <DO extends HyperDurable<ENV>, ENV>(
  env: ENV,
  doBindings: { [key: string]: new (state: DurableObjectState, env: ENV) => DO }
) => {
  const newEnv: {
    [Prop in keyof ENV]?:
      ENV[Prop] extends DurableObjectNamespace
      // TODO: Only change type for those in doBindings
      ? HyperNamespaceProxy<DO, ENV>
      : ENV[Prop];
  } = {};
  for (const [key, value] of Object.entries(doBindings)) {
    if (!(value.prototype instanceof HyperDurable)) {
      throw new HyperError(`Class "${value.name}" does not extend HyperDurable`);
    }
    newEnv[key] = new HyperNamespaceProxy(env[key], value);
  }
  for (const [key, value] of Object.entries(env)) {
    if (!newEnv[key]) newEnv[key] = value;
  }
  return newEnv;
}
