import { expect } from 'chai';

import { HyperNamespaceProxy, proxyHyperDurables } from './HyperNamespaceProxy';

describe('HyperNamespaceProxy', () => {
  let { COUNTER } = getMiniflareBindings();
  const Counter = new HyperNamespaceProxy(COUNTER);

  const id = Counter.newUniqueId();
  const counter = Counter.get(id);

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

    // These tests spin forever - have to implement stub
  //   test('throws when get throws', async () => {
  //     expect(await counter.xyz).to.deep.equal({
  //       errors: [
  //         {
  //           message: 'Property xyz does not exist',
  //           details: ''
  //         }
  //       ]
  //     });
  //   });

  //   test('proxies fetch for getting properties', async () => {
  //     expect(await counter.counter).to.equal(1);
  //   });

  //   test('proxies fetch for setting properties', async () => {
  //     counter.counter = 2;
  //     expect(await counter.counter).to.equal(2);
  //   });

  //   test('proxies fetch for other methods', async () => {
  //     expect(await counter.increment()).to.equal(2);
  //   });
  });
});

describe('proxyHyperDurables', () => {
  test('proxies only durable object namespaces', () => {
    // TODO: Add tests
    expect(proxyHyperDurables());
  });
});
