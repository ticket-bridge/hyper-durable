import { expect } from 'chai';

import { HyperNamespaceProxy, proxyHyperDurables } from './HyperNamespaceProxy';

import { Counter } from '../test/index';

describe('HyperNamespaceProxy', () => {
  const bindings = getMiniflareBindings();
  const COUNTER = new HyperNamespaceProxy<Counter>(bindings.COUNTER, Counter);
  const id = COUNTER.newUniqueId();
  let counter = COUNTER.get(id);

  beforeEach(async () => {
    const id = COUNTER.newUniqueId();
    counter = COUNTER.get(id);
  });

  test('is a DurableObjectNamespace', () => {
    expect(COUNTER.get).to.be.a('function');
    expect(COUNTER.newUniqueId).to.be.a('function');
    expect(COUNTER.idFromName).to.be.a('function');
    expect(COUNTER.idFromString).to.be.a('function');
  });

  describe('stub', () => {
    test('allows regular access to fetch function', async () => {
      const request = new Request('https://hd.io/get/counter');
      const response = await counter.fetch(request);
      expect(await response.json()).to.deep.equal({
        value: 1
      });
    });

    test('proxies fetch for getting properties', async () => {
      expect(await counter.counter).to.deep.equal({
        value: 1
      });
    });

    test('throws when get throws', async () => {
      // @ts-expect-error
      expect(await counter.xyz).to.deep.equal({
        errors: [
          {
            message: 'Property xyz does not exist',
            details: ''
          }
        ]
      });
    });

    test('proxies fetch for setting properties', async () => {
      expect(await counter.setCounter(5)).to.deep.equal({
        value: 5
      });
      expect(await counter.counter).to.deep.equal({
        value: 5
      });
    });

    test('proxies fetch for other methods', async () => {
      expect(await counter.increment()).to.deep.equal({
        value: null
      });
      expect(await counter.counter).to.deep.equal({
        value: 2
      });
    });
  });
});

describe('proxyHyperDurables', () => {
  const bindings = getMiniflareBindings();

  test('proxies only durable object namespaces', () => {
    const { COUNTER } = proxyHyperDurables(bindings, { COUNTER: Counter });
    const id = COUNTER.newUniqueId();
    // expect(COUNTER.get(id)).to.be.instanceOf(HyperStub);
  });
});
