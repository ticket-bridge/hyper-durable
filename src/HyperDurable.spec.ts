import { expect } from 'chai';

import { HyperDurable } from './HyperDurable';

describe('HyperDurable', () => {
  // Test class
  class Counter extends HyperDurable {
    counter: number;
    deeplyNested: string[];

    constructor(state: DurableObjectState, env: unknown) {
      super(state, env);
      this.counter = 1;
      this.deeplyNested = [];
    }

    increment() {
      this.counter++;
    }

    sayHello(name: string) {
      return `Hello ${name}!`;
    }
  }
  let counter: Counter | undefined;

  beforeEach(() => {
    counter = new Counter({}, {});
  });

  describe('this proxy', () => {
    test('is extendable by Durable Object classes', () => {
      expect(counter).to.be.instanceOf(HyperDurable);
    });

    test('is a proxy (traps isProxy get to confirm)', () => {
      expect(counter.isProxy).to.be.true;
    });

    test('maintains a Map of all persistable properties', () => {
      expect(counter.storageMap).to.be.a('Map').that.has.all.keys('counter', 'deeplyNested');
    })

    test('reflects other getters', () => {
      expect(counter.counter).to.equal(1);
    });

    test('tracks dirty state when setting properties to new values', () => {
      // In the test class, the state starts dirty because properties are set in the constructor
      counter.clear();

      // Identical values don't need to be persisted
      counter.counter = 1;
      expect(counter.state.dirty).to.be.false;
      counter.counter = 2;
      expect(counter.state.dirty).to.be.true;
      expect(counter.storageMap.get('counter')).to.be.true;
    });

    test('binds methods to itself', () => {
      counter.increment();
      expect(counter.counter).to.equal(2);
      expect(counter.state.dirty).to.be.true;
      expect(counter.storageMap.get('counter')).to.be.true;
    });

    test('proxies deeply nested objects and sets dirty state', () => {
      expect(counter.deeplyNested.isProxy).to.be.true;
      counter.deeplyNested.push('test');
      expect(counter.deeplyNested).to.deep.equal(['test']);
      expect(counter.state.dirty).to.be.true;
      expect(counter.storageMap.get('deeplyNested')).to.be.true;
    });
  });

  describe('storage', () => {
    test('initializes with empty storage', async () => {
      expect(await counter.storage.list()).to.deep.equal(new Map());
    });

    test('persists dirty data', async () => {
      expect(await counter.storage.get('counter')).to.equal(undefined);
      expect(await counter.storage.get('deeplyNested')).to.equal(undefined);
      await counter.persist();
      expect(counter.state.dirty).to.be.false;
      expect(await counter.storage.get('counter')).to.equal(1);
      expect(await counter.storage.get('deeplyNested')).to.deep.equal([]);
    });
  });

  describe('fetch', () => {
    test('/get returns value from memory', async () => {
      expect(await counter.fetch('api.hyperdurable.io/get/counter')).to.equal(1);
    });

    test('/get throws when requesting nonexistent key', async () => {
      expect(await counter.fetch('api.hyperdurable.io/get/xyz')).to.deep.equal({
        message: 'property xyz does not exist'
      });
    });

    test('/set changes value in memory, persists data, and returns value', async () => {
      expect(await counter.fetch('api.hyperdurable.io/set/counter', { body: 5 })).to.equal(5);
      expect(counter.counter).to.equal(5);
      expect(await counter.storage.get('counter')).to.equal(5);
    });

    test('/set adds new properties in memory, persists data, and returns value', async () => {
      expect(await counter.fetch('api.hyperdurable.io/set/abc', { body: 99 })).to.equal(99);
      expect(counter.abc).to.equal(99);
      expect(await counter.storage.get('abc')).to.equal(99);
    });

    test('/get and /set throw when attempting to access a method', async () => {
      expect(await counter.fetch('api.hyperdurable.io/get/increment')).to.deep.equal({
        message: 'cannot get method increment (try fetching /call/increment)'
      });
      expect(await counter.fetch('api.hyperdurable.io/set/increment')).to.deep.equal({
        message: 'cannot set method increment (try fetching /call/increment)'
      });
    });

    test('/call executes method with no parameters and returns result', async () => {
      expect(await counter.fetch('api.hyperdurable.io/call/increment')).to.equal(undefined);
      expect(counter.counter).to.equal(2);
    });

    test('/call executes method with parameters from body and returns result', async () => {
      expect(await counter.fetch('api.hyperdurable.io/call/sayHello', {
        body: {
          name: 'HyperDurable'
        }
      })).to.equal('Hello HyperDurable!');
    });
  });
});