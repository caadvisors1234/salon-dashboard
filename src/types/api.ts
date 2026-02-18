export type ApiSuccessResponse<T = unknown> = { success: true; data: T };
export type ApiErrorResponse = { success: false; error: string };
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
