import { expect } from 'chai';

import { HyperError } from './HyperError';
import { HyperNamespaceProxy, proxyHyperDurables } from './HyperNamespaceProxy';

import { Counter } from '../test/index';

describe('HyperNamespaceProxy', () => {
  const bindings = getMiniflareBindings();
  const COUNTER = new HyperNamespaceProxy(bindings.COUNTER, Counter);
  let id = COUNTER.newUniqueId();
  let counter = COUNTER.get(id);

  beforeEach(async () => {
    id = COUNTER.newUniqueId();
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
      expect(await counter.counter).to.equal(1);
    });

    test('throws when get throws', async () => {
      try {
        // @ts-expect-error
        await counter.xyz;
      } catch(e) {
        expect(e).to.be.instanceOf(HyperError);
        expect(e.message).to.equal('Property xyz does not exist');
      }
    });

    test('proxies fetch for setting properties', async () => {
      expect(await counter.setCounter(5)).to.equal(5);
      expect(await counter.counter).to.equal(5);
    });

    test('proxies fetch for other methods', async () => {
      expect(await counter.increment()).to.equal(null);
      expect(await counter.counter).to.equal(2);
    });
  });
});

describe('proxyHyperDurables', () => {
  const bindings = getMiniflareBindings();

  test('returns empty object when passed no durable object bindings', () => {
    const newBindings = proxyHyperDurables(bindings, {});
    expect(newBindings).to.deep.equal({});
  });

  test('proxies durable object bindings', () => {
    const { COUNTER } = proxyHyperDurables(bindings, { COUNTER: Counter });
    const id = COUNTER.newUniqueId();
    const counter = COUNTER.get(id);
    expect(counter.setCounter).to.be.a('function');
  });

  test('throws when passed a non-durable object binding', () => {
    try {
      // @ts-expect-error
      proxyHyperDurables(bindings, { COUNTER: class Fake {} })
    } catch(e) {
      expect(e).to.be.instanceOf(HyperError);
      expect(e.message).to.equal('Class "Fake" does not extend HyperDurable');
    }
  });
});
