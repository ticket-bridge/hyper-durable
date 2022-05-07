import { Router } from 'itty-router';
import { DurableObjectState, DurableObjectStorage } from '@miniflare/durable-objects';

interface HyperState extends DurableObjectState {
  dirty?: Set<string>;
}

export class HyperDurable implements DurableObject {
  readonly isProxy?: boolean;
  id: DurableObjectId | string;
  state: HyperState;
  storage: DurableObjectStorage;
  router: Router;

  constructor(state: DurableObjectState, env: unknown) {
    this.id = state.id;
    this.state = state;
    this.state.dirty = new Set();
    this.storage = state.storage;
    this.router = Router();

    // Traps for getting and setting props
    const handler = {
      get: (target: any, key: string, receiver: any) => {
        // Reserved key to confirm this is a proxy
        if (key === 'isProxy') return true;

        // console.log(`Getting ${target}.${typeof key === 'string' ? key : 'unknown'}`);

        const prop = target[key];

        // Recursively proxy any object-like properties, except state
        // This enables us to keep track of deeply-nested changes to props
        if (typeof prop === 'object' && !prop.isProxy && key !== 'state') {
          target[key] = new Proxy(prop, handler);
        }

        // If prop is a function, bind `this` to `receiver` (anything inheriting from HyperDurable)
        return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
      },
      set: (target: any, key: string, value: any) => {
        // console.log(`Setting ${target}.${key} to equal ${value}`);
        
        // Push key to persist data 
        if (target[key] !== value) {
          this.state.dirty.add(key);
        }

        target[key] = value;
        return true;
      }
    };

    const hyperProxy = new Proxy(this, handler);

    // All operations flow through this router
    this.router
      .get('/get/:key', () => {})
      .post('/set/:key', () => {})
      .post('/call/:key', () => {})
      .all('*', () => {});

    return hyperProxy;
  }

  async clear(): Promise<string> {
    this.state.dirty.clear();
    return new Promise(() => 'false');
  }

  async persist(): Promise<string> {
    return new Promise(() => 'true');
  }

  async fetch(request: Request): Promise<Response> {
    return new Response();
  }
}
