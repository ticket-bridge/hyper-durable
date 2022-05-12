import { Router } from 'itty-router';
import { DurableObjectState, DurableObjectStorage } from '@miniflare/durable-objects';
import { HyperError } from './HyperError';

interface HyperState extends DurableObjectState {
  dirty?: Set<string>;
  tempKey?: string;
}

export class HyperDurable<Env = unknown> implements DurableObject {
  readonly isProxy?: boolean;
  readonly original?: any;
  env: Env;
  state: HyperState;
  storage: DurableObjectStorage;
  router: Router;

  constructor(state: DurableObjectState, env: Env) {
    this.env = env;
    this.state = state;
    this.state.dirty = new Set();
    this.state.tempKey = '';
    this.storage = state.storage;
    this.router = Router();

    // Traps for getting and setting props
    const handler = {
      get: (target: any, key: string, receiver: any) => {
        // Reserved key to confirm this is a proxy
        if (key === 'isProxy') return true;

        // Reserved key to get the underlying object
        if (key === 'original') return target;

        // console.log(`Getting ${target}.${typeof key === 'string' ? key : 'unknown'}`);

        const prop = target[key];

        // Short-circuit if can't access 
        if (!prop) return Reflect.get(target, key, receiver);

        const reservedKeys = new Set(['state', 'storage', 'router']);

        // Recursively proxy any object-like properties, except reserved keys
        // This enables us to keep track of deeply-nested changes to props
        if (typeof prop === 'object' && !prop.isProxy && !reservedKeys.has(key)) {
          target[key] = new Proxy(prop, handler);
        }

        // If we're getting a proxied top-level property of the Durable Object,
        // save the key to persist the deeply-nested property
        if (target[key].isProxy && this === target) this.state.tempKey = key;

        // If prop is a function, bind `this`
        return typeof target[key] === 'function'
          ? target[key].bind(receiver)
          : Reflect.get(target, key, receiver);
      },
      set: (target: any, key: string, value: any) => {
        // console.log(`Setting ${target}.${key} to equal ${value}`);
        
        // Add key to persist data 
        if (target[key] !== value) {
          if (this === target) {
            this.state.dirty.add(key);
          } else {
            this.state.dirty.add(this.state.tempKey);
          }
        }

        Reflect.set(target, key, value);
        return true;
      }
    };

    const hyperProxy = new Proxy(this, handler);

    // All operations flow through this router
    this.router
      .get('/get/:key', request => {
        const key = request.params.key;
        const value = hyperProxy[key];

        if (typeof value === 'function') {
          throw new HyperError(`Cannot get method ${key}`, {
            details: `Try POSTing /call/${key}`,
            status: 400
          });
        } else if (typeof value === 'undefined') {
          throw new HyperError(`Property ${key} does not exist`, { status: 404 });
        }

        return new Response(JSON.stringify({
          value
        }));
      })
      .post('/set/:key', async request => {
        const key = request.params.key;
        const json = await request.json();
        const newValue = json.value;

        if (newValue === undefined) {
          throw new HyperError('Unknown value', {
            details: 'Request body should be: { value: "some-value" }',
            status: 400
          });
        }
        if (typeof hyperProxy[key] === 'function') {
          throw new HyperError(`Cannot set method ${key}`, {
            details: `Try POSTing /call/${key}`,
            status: 404
          });
        }

        hyperProxy[key] = newValue;
        return new Response(JSON.stringify({
          value: newValue
        }));
      })
      .post('/call/:key', async request => {
        const key = request.params.key;
        const json = await request.json();
        const { args } = json;

        if (args === undefined || !Array.isArray(args)) {
          throw new HyperError('Unknown arguments', {
            details: 'Request body should be: { args: ["someArg"] }',
            status: 400
          });
        }
        if (typeof hyperProxy[key] !== 'function') {
          throw new HyperError(`Cannot call property ${key}`, {
            details: `Try GETing /get/${key}`,
            status: 404
          });
        }

        let value: any;

        try {
          console.log(`calling ${key} with ${args}`);
          value = hyperProxy[key](...args);
        } catch(e) {
          throw new HyperError('Problem while calling method', {
            details: e.message || '',
            status: 500
          });
        }

        return new Response(JSON.stringify({
          value: value ? value : null
        }));
      })
      .all('*', ({ url, method }) => {
        const pathname = new URL(url).pathname;
        method = method.toUpperCase();
        switch(pathname.split('/')[1]) {
          case('get'):
            if (method !== 'GET') {
              throw new HyperError(`Cannot ${method} /get`, {
                details: 'Use a GET request',
                status: 405,
                allow: 'GET'
              });
            }
            break;
          case('set'):
            if (method !== 'POST') {
              throw new HyperError(`Cannot ${method} /set`, {
                details: 'Use a POST request with a body: { value: "some-value" }',
                status: 405,
                allow: 'POST'
              });
            }
            break;
          case('call'):
            if (method !== 'POST') {
              throw new HyperError(`Cannot ${method} /call`, {
                details: 'Use a POST request with a body: { args: ["someArg"] }',
                status: 405,
                allow: 'POST'
              });
            }
            break;
        }
        throw new HyperError('Not found', { status: 404 });
      });

    return hyperProxy;
  }

  // Removes all dirty props from Set (they won't be persisted)
  clear() {
    this.state.dirty.clear();
  }

  // Persist all dirty props
  async persist() {
    try {
      for (let key of this.state.dirty) {
        const value = this[key].isProxy ? this[key].original : this[key];
        await this.storage.put(key, value);
        this.state.dirty.delete(key);
      }
      return true;
    } catch(e) {
      throw new HyperError('Something went wrong while persisting object', {
        details: e.message || ''
      });
    }
  }

  async destroy() {
    try {
      this.state.dirty.clear();
      this.state.tempKey = '';
      this.storage.deleteAll();
    } catch(e) {
      throw new HyperError('Something went wrong while destroying object', {
        details: e.message || ''
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    return this.router
      .handle(request)
      .then(async response => {
        if (this.state.dirty.size > 0) {
          await this.persist();
        }
        return response;
      })
      .catch(e => {
        return new Response(JSON.stringify({
          errors: [
            {
              message: e.message || 'Internal Server Error',
              details: e.details || ''
            }
          ]
        }),
        {
          status: e.status || 500,
          headers: e.allow ? {
            Allow: e.allow
          } : {}
        });
      });
  }
}
