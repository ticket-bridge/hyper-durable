import { expect } from 'chai';
import {
  DurableObjectId,
  DurableObjectState,
  DurableObjectStorage,
} from '@miniflare/durable-objects';
import { MemoryStorage } from '@miniflare/storage-memory';

import { HyperError } from './HyperError';

import { Counter } from '../test/index';

describe('HyperDurable', () => {
  const bindings = getMiniflareBindings();
  let counter: Counter | undefined;

  beforeEach(() => {
    const id = new DurableObjectId('testName', 'testHexId');
    const storage = new DurableObjectStorage(new MemoryStorage());
    const state = new DurableObjectState(id, storage);
    counter = new Counter(state, bindings);
  });

  describe('this proxy', () => {
    test('is a Durable Object', () => {
      expect(counter.fetch).to.be.a('function');
    });

    test('is a proxy (traps isProxy to confirm)', () => {
      expect(counter.isProxy).to.be.true;
    });

    test('maintains a Set of all dirty properties', () => {
      expect(counter.state.dirty).to.be.a('Set').that.has.all.keys('counter', 'objectLikeProp');
    })

    test('reflects other getters', () => {
      expect(counter.counter).to.equal(1);
      expect(counter.objectLikeProp).to.deep.equal([]);
    });

    test('tracks dirty props in state when setting properties to new values', () => {
      // In the test class, the state starts dirty because properties are set in the constructor
      // Clear the record of dirty props from state
      counter.state.dirty.clear();

      // Identical values don't need to be persisted
      counter.counter = 1;
      expect(counter.state.dirty).to.be.empty;
      counter.counter = 2;
      expect(counter.state.dirty).to.have.all.keys('counter');
    });

    test('binds methods to itself', () => {
      counter.state.dirty.clear();
      counter.increment();
      expect(counter.counter).to.equal(2);
      expect(counter.state.dirty).to.have.all.keys('counter');
    });

    test('tracks object-like dirty props', () => {
      counter.state.dirty.clear();
      counter.objectLikeProp.push('test');
      expect(counter.objectLikeProp).to.deep.equal(['test']);
      expect(counter.state.dirty).to.have.all.keys('objectLikeProp');
    });
  });

  describe('storage', () => {
    test('initializes with empty storage', async () => {
      expect(await counter.storage.list()).to.deep.equal(new Map());
    });

    test('initializes with previously persisted properties', async () => {
      const id = new DurableObjectId('testName', 'testHexId');
      const storage = new DurableObjectStorage(new MemoryStorage());
      const state = new DurableObjectState(id, storage);
      counter = new Counter(state, bindings);
      counter.abc = 5;
      await counter.persist();

      // Create new Counter instance with same underlying storage
      counter = new Counter(new DurableObjectState(id, storage), bindings);
      const request = new Request('https://hd.io/get/abc');
      const response = await counter.fetch(request);
      expect(await response.json()).to.deep.equal({
        value: 5
      });
    });

    test('initialize throws when storage throws', async () => {
      const id = new DurableObjectId('testName', 'testHexId');
      const storage = new DurableObjectStorage(new MemoryStorage());
      storage.get = async () => { throw new Error };
      const state = new DurableObjectState(id, storage);
      counter = new Counter(state, bindings);

      try {
        await counter.initialize();
      } catch(e) {
        expect(e).to.be.instanceOf(HyperError);
        expect(e.message).to.equal('Something went wrong while initializing object');
      }
    });

    test('persists dirty data', async () => {
      counter.counter = 2;
      counter.objectLikeProp.push('three');
      await counter.persist();
      expect(counter.state.dirty).to.be.empty;
      expect(await counter.storage.get('persisted')).to.deep.equal(new Set(['counter', 'objectLikeProp']));
      expect(await counter.storage.get('counter')).to.equal(2);
      expect(await counter.storage.get('objectLikeProp')).to.deep.equal(['three']);
    });

    test('persist throws when storage throws', async () => {
      const id = new DurableObjectId('testName', 'testHexId');
      const storage = new DurableObjectStorage(new MemoryStorage());
      storage.put = async () => { throw new Error };
      const state = new DurableObjectState(id, storage);
      counter = new Counter(state, bindings);

      try {
        await counter.persist();
      } catch(e) {
        expect(e).to.be.instanceOf(HyperError);
        expect(e.message).to.equal('Something went wrong while persisting object');
      }
    });

    test('removes all persisted data when destroying object', async () => {
      await counter.persist();
      await counter.destroy();
      expect(await counter.storage.list()).to.deep.equal(new Map());
      expect(counter.state.persisted).to.deep.equal(new Set());
      expect(counter.state.dirty).to.deep.equal(new Set());
    });

    test('destroy throws when storage throws', async () => {
      const id = new DurableObjectId('testName', 'testHexId');
      const storage = new DurableObjectStorage(new MemoryStorage());
      storage.deleteAll = async () => { throw new Error };
      const state = new DurableObjectState(id, storage);
      counter = new Counter(state, bindings);

      try {
        await counter.destroy();
      } catch(e) {
        expect(e).to.be.instanceOf(HyperError);
        expect(e.message).to.equal('Something went wrong while destroying object');
      }
    });

    test('returns all custom data from toObject', async () => {
      counter.counter = 2;
      await counter.persist();
      const obj = counter.toObject();
      expect(obj).to.deep.equal({
        counter: 2,
        objectLikeProp: []
      });
    });
  });

  describe('fetch', () => {
    describe('/get', () => {
      test('returns value from memory', async () => {
        const request = new Request('https://hd.io/get/counter');
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          value: 1
        });
        expect(response.status).to.equal(200);
      });

      test('throws when requesting a nonexistent key', async () => {
        const request = new Request('https://hd.io/get/xyz');
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Property xyz does not exist',
              details: ''
            }
          ]
        });
        expect(response.status).to.equal(404);
      });

      test('throws when attempting to access a method', async () => {
        const request = new Request('https://hd.io/get/increment');
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Cannot get method increment',
              details: 'Try POSTing /call/increment'
            }
          ]
        });
        expect(response.status).to.equal(400);
      });

      test('throws with non-GET method', async () => {
        const request = new Request('https://hd.io/get/counter', {
          body: JSON.stringify({}),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Cannot POST /get',
              details: 'Use a GET request'
            }
          ]
        });
        expect(response.headers.get('allow')).to.equal('GET');
        expect(response.status).to.equal(405);
      });

      test('throws with a malformed path', async () => {
        const request = new Request('https://hd.io/get/counter/hello');
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Not found',
              details: ''
            }
          ]
        });
        expect(response.status).to.equal(404);
      });
    });
    
    describe('/set', () => {
      test('changes value in memory, persists data, and returns value', async () => {
        const request = new Request('https://hd.io/set/counter', {
          body: JSON.stringify({
            value: 5
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          value: 5
        });
        expect(response.status).to.equal(200);
        expect(counter.counter).to.equal(5);
        expect(await counter.storage.get('counter')).to.equal(5);
      });

      test('adds new properties in memory, persists data, and returns value', async () => {
        const request = new Request('https://hd.io/set/abc', {
          body: JSON.stringify({
            value: 99
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          value: 99
        });
        expect(response.status).to.equal(200);
        expect(counter.abc).to.equal(99);
        expect(await counter.storage.get('abc')).to.equal(99);
      });

      test('throws when attempting to access a method', async () => {
        const request = new Request('https://hd.io/set/increment', {
          body: JSON.stringify({
            value: 99
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Cannot set method increment',
              details: 'Try POSTing /call/increment'
            }
          ]
        });
        expect(response.status).to.equal(404);
      });

      test('throws with non-POST method', async () => {
        const request = new Request('https://hd.io/set/counter');
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Cannot GET /set',
              details: 'Use a POST request with a body: { value: "some-value" }'
            }
          ]
        });
        expect(response.headers.get('allow')).to.equal('POST');
        expect(response.status).to.equal(405);
      });

      test('throws with a malformed path', async () => {
        const request = new Request('https://hd.io/set/counter/hello', {
          body: JSON.stringify({
            value: 5
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Not found',
              details: ''
            }
          ]
        });
        expect(response.status).to.equal(404);
      });

      test('throws with no posted value', async () => {
        const request = new Request('https://hd.io/set/counter', {
          body: JSON.stringify({}),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Unknown value',
              details: 'Request body should be: { value: "some-value" }'
            }
          ]
        });
        expect(response.status).to.equal(400);
      });
    });
    
    describe('/call', () => {
      test('calls method with no parameters and returns result', async () => {
        const request = new Request('https://hd.io/call/increment', {
          body: JSON.stringify({
            args: []
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          value: null
        });
        expect(response.status).to.equal(200);
        expect(counter.counter).to.equal(2);
      });

      test('calls method with arguments from body and returns result', async () => {
        const request = new Request('https://hd.io/call/sayHello', {
          body: JSON.stringify({
            args: ['HyperDurable']
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          value: 'Hello HyperDurable!'
        });
        expect(response.status).to.equal(200);
      });

      test('bubbles up errors from method', async () => {
        const request = new Request('https://hd.io/call/throws', {
          body: JSON.stringify({
            args: []
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Problem while calling method',
              details: 'Mistake'
            }
          ]
        });
        expect(response.status).to.equal(500);
      });

      test('throws when calling a property', async () => {
        const request = new Request('https://hd.io/call/counter', {
          body: JSON.stringify({
            args: []
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Cannot call property counter',
              details: 'Try GETing /get/counter'
            }
          ]
        });
        expect(response.status).to.equal(404);
      });

      test('throws when calling a method with incorrectly constructed arguments', async () => {
        const request = new Request('https://hd.io/call/sayHello', {
          body: JSON.stringify({
            args: { 0: 'wrongArg' }
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Unknown arguments',
              details: 'Request body should be: { args: ["someArg"] }'
            }
          ]
        });
        expect(response.status).to.equal(400);
      });

      test('throws with non-POST method', async () => {
        const request = new Request('https://hd.io/call/increment');
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Cannot GET /call',
              details: 'Use a POST request with a body: { args: ["someArg"] }'
            }
          ]
        });
        expect(response.headers.get('allow')).to.equal('POST');
        expect(response.status).to.equal(405);
      });

      test('throws with a malformed path', async () => {
        const request = new Request('https://hd.io/call/counter/hello', {
          body: JSON.stringify({
            args: [5]
          }),
          method: 'POST'
        });
        const response = await counter.fetch(request);
        expect(await response.json()).to.deep.equal({
          errors: [
            {
              message: 'Not found',
              details: ''
            }
          ]
        });
        expect(response.status).to.equal(404);
      });
    });
  });
});