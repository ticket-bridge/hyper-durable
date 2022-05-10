import { Router } from 'itty-router';
import { DurableObjectState, DurableObjectStorage } from '@miniflare/durable-objects';

interface HyperState extends DurableObjectState {
  dirty?: Set<string>;
  tempKey?: string;
}

export class HyperDurable<Env = unknown> implements DurableObject {
  readonly isProxy?: boolean;
  readonly original?: HyperDurable;
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
        return typeof target[key] === 'function' ? target[key].bind(receiver) : target[key];
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

        target[key] = value;
        return true;
      }
    };

    const hyperProxy = new Proxy(this, handler);

    // All operations flow through this router
    this.router
      .get('/get/:key', request => {
        const key = request.params.key;
        const value = this[key];

        if (typeof value === 'function') {
          return new Response(JSON.stringify({
            value: `Cannot get method ${key} (try POSTing /call/${key})`
          }));
        } else if (typeof value === 'undefined') {
          return new Response(JSON.stringify({
            value: `Property ${key} does not exist`
          }));
        }
        return new Response(JSON.stringify({
          value
        }));
      })
      .post('/set/:key', request => {
        return new Response(JSON.stringify({
          value: 5
        }));
      })
      .post('/call/:key', request => {
        return new Response(JSON.stringify({
          value: 5
        }));
      })
      .all('*', request => {
        return new Response(JSON.stringify({
          errors: [
            {
              message: 'Not found',
              details: 'Could not match this route to an operation'
            }
          ]
        }), { status: 404 })
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
      console.error(e);
      return false;
    }
  }

  async destroy() {
    try {
      this.state.dirty.clear();
      this.state.tempKey = '';
      this.storage.deleteAll();
    } catch(e) {
      console.error(e);
      return false;
    }
  }

  async fetch(request: Request): Promise<Response> {
    return this.router
      .handle(request)
      .catch(e => {
        return new Response(JSON.stringify({
          errors: [
            {
              message: e.message || 'Internal Server Error'
            }
          ]
        }), { status: e.status || 500 });
      });
  }
}
