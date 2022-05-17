import { expect } from 'chai';
import {
  DurableObjectId,
  DurableObjectNamespace,
  DurableObjectState,
  DurableObjectStorage
} from '@miniflare/durable-objects';
import { MemoryStorage } from '@miniflare/storage-memory';
import { Miniflare } from 'miniflare';

import { HyperNamespaceProxy, proxyHyperDurables } from './HyperNamespaceProxy';

describe('HyperNamespaceProxy', () => {
  const mf = new Miniflare({
    modules: true,
    scriptPath: 'test/Counter.js',
    durableObjects: {
      COUNTER: 'Counter'
    }
  });
  const res = await mf.dispatchFetch("http://hd.io/get/counter");
  console.log(res);

  let Counter: HyperNamespaceProxy | undefined;
  let counter: HyperDurableStub | undefined;

  beforeEach(async () => {
    const storage = new DurableObjectStorage(new MemoryStorage());
    const namespace = new DurableObjectNamespace('Counter', async id => new DurableObjectState(id, storage));
    Counter = new HyperNamespaceProxy(namespace);
    const id = new DurableObjectId('testName', 'testHexId');
    counter = Counter.get(id);
  });

  test('is a DurableObjectNamespace', () => {
    expect(Counter.get).to.be.a('function');
    expect(Counter.newUniqueId).to.be.a('function');
    expect(Counter.idFromName).to.be.a('function');
    expect(Counter.idFromString).to.be.a('function');
  });

  describe('stub', () => {
    test('allows regular access to fetch function', async () => {
      const request = new Request('https://hd.io/get/counter');
      const response = await counter.fetch(request);
      expect(await response.json()).to.deep.equal({
        value: 1
      });
    });

    test('throws when get throws', async () => {
      expect(await counter.xyz).to.deep.equal({
        errors: [
          {
            message: 'Property xyz does not exist',
            details: ''
          }
        ]
      });
    });

    test('proxies fetch for getting properties', async () => {
      expect(await counter.counter).to.equal(1);
    });

    test('proxies fetch for setting properties', async () => {
      counter.counter = 2;
      expect(await counter.counter).to.equal(2);
    });

    test('proxies fetch for other methods', async () => {
      expect(await counter.increment()).to.equal(2);
    });
  });
});

describe('proxyHyperDurables', () => {

});
