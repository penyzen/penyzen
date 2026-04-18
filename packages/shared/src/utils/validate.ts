import { z, ZodSchema } from 'zod';
import { ValidationError } from '../errors/ValidationError';

/**
 * Validates data against a Zod schema.
 * Throws ValidationError with field-level messages on failure.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    const key = path || '_root';
    if (!fields[key]) fields[key] = [];
    fields[key]!.push(issue.message);
  }

  throw new ValidationError('Validation failed', fields);
}

/**
 * Parses a JSON string body and validates it.
 * Throws ValidationError if body is not valid JSON or fails schema.
 */
export function validateBody<T>(schema: ZodSchema<T>, rawBody: string | null | undefined): T {
  if (!rawBody) {
    throw new ValidationError('Request body is required', { _root: ['Body cannot be empty'] });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ValidationError('Invalid JSON', { _root: ['Body must be valid JSON'] });
  }
  return validate(schema, parsed);
}

// Re-export z for convenience so services only import from @penyzen/shared
export { z };
