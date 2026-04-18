export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Cents-to-dollars helper for display (never use for calculations) */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Dollars-to-cents helper for storage */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
