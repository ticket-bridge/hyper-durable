declare global {
  function getMiniflareBindings(): { COUNTER: DurableObjectNamespace };
  function getMiniflareDurableObjectStorage(
    id: DurableObjectId
  ): Promise<DurableObjectStorage>;
}

export {};
