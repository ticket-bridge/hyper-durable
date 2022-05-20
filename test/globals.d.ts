declare global {
  interface Environment {
    COUNTER: DurableObjectNamespace
  }
  function getMiniflareBindings(): Environment;
  function getMiniflareDurableObjectStorage(
    id: DurableObjectId
  ): Promise<DurableObjectStorage>;
}

export {};
