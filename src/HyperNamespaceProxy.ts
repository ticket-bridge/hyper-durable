export const proxyDurable = namespace => {
  const handler = {
    get: (target: any, key: string, receiver: any) => {

    }
  };

  return new Proxy(namespace, handler);
}

export const proxyHyperDurables = () => {

}
