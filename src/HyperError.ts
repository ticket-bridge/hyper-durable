export class HyperError extends Error {
  allow?: string;
  details: string;
  status?: number;

  constructor(message: string, options?: {
    details?: string,
    status?: number,
    allow?: string
  }) {
    super(message);

    this.name = 'HyperError';
    this.details = options?.details || '';
    this.status = options?.status;
    this.allow = options?.allow;
  }
}
