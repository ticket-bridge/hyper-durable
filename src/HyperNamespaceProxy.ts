import { HyperDurable } from './HyperDurable';
import { HyperError } from './HyperError';

export class HyperNamespaceProxy<DO extends HyperDurable<any, Env>, Env> implements DurableObjectNamespace {
  namespace: DurableObjectNamespace;
  ref: DO;

  newUniqueId: (_options?: DurableObjectNamespaceNewUniqueIdOptions) => DurableObjectId;
  idFromName: (name: string) => DurableObjectId;
  idFromString: (hexId: string) => DurableObjectId;

  constructor(
    namespace: DurableObjectNamespace,
    ref: new (state: DurableObjectState, env: Env) => DO
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
    type PromisedGetStub<DO extends HyperDurable<any, Env>, Env> = {
      [Prop in keyof DO]?:
        DO[Prop] extends (...args: any) => any
        ? (...args: Parameters<DO[Prop]>) => Promise<ReturnType<DO[Prop]>>
        : Promise<DO[Prop]>;
    };
    // All of our props have setters formatted as: setProperty()
    type SetStub<DO extends HyperDurable<any, Env>, Env> = {
      [Prop in keyof DO as DO[Prop] extends Function ? never : `set${Capitalize<string & Prop>}`]?:
        (newValue: DO[Prop]) => Promise<DO[Prop]>
    }
    type HyperStub<DO extends HyperDurable<any, Env>, Env> =
      DurableObjectStub & PromisedGetStub<DO, Env> & SetStub<DO, Env>;

    const stub = this.namespace.get(id);
    const hyperStub: HyperStub<DO, Env> = Object.assign<DurableObjectStub, object>(stub, {});

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
      return promise.then(async res => {
        return await res.json();
      }).then((res: { value?: unknown, errors?: { message: string, details: string }[] }) => {
        if (res.hasOwnProperty('value')) return res.value;
        if (res.hasOwnProperty('errors')) {
          for (const error of res.errors) {
            throw new HyperError(error.message, {
              details: error.details
            });
          }
        }
      });
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

    return new Proxy<HyperStub<DO, Env>>(hyperStub, handler);
  }
}

export const proxyHyperDurables = <DO extends HyperDurable<any, Env>, Env>(
  env: Env,
  doBindings: { [key: string]: new (state: DurableObjectState, env: Env) => DO }
) => {
  const newEnv: {
    [Prop in keyof typeof doBindings]?: HyperNamespaceProxy<DO, Env>
  } = {};
  for (const [key, value] of Object.entries(doBindings)) {
    if (!(value.prototype instanceof HyperDurable)) {
      throw new HyperError(`Class "${value.name}" does not extend HyperDurable`);
    }
    newEnv[key] = new HyperNamespaceProxy(env[key], value);
  }
  return newEnv;
}
