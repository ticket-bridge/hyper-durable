declare global {
  interface HyperDurable {
    id: DurableObjectId,
    state: DurableObjectState,
    storage: DurableObjectStorage,
    router: Router
    storageMap: Map<string, boolean>
  }
}
