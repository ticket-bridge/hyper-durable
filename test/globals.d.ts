declare global {
  interface Env {
    COUNTER: DurableObjectNamespace
  }
  function getMiniflareBindings(): Env;
  function getMiniflareDurableObjectStorage(
    id: DurableObjectId
  ): Promise<DurableObjectStorage>;
}

export {};
