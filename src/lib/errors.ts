export class ConflictError extends Error {
  constructor(message = 'This record was modified by another user. Refresh before saving.') {
    super(message)
    this.name = 'ConflictError'
  }
}

export function isConflictError(error: unknown): boolean {
  return error instanceof ConflictError
}
