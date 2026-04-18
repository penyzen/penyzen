import { AppError } from './AppError';

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}
