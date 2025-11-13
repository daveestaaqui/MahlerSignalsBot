import type { Response } from "express";

type ResponseWithBody<T> = Response & { body?: T; statusCode?: number };

export function createMockResponse<T = unknown>(): ResponseWithBody<T> {
  const res: Partial<ResponseWithBody<T>> = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this as ResponseWithBody<T>;
    },
    json(payload: T) {
      this.body = payload;
      return this as ResponseWithBody<T>;
    },
  };

  return res as ResponseWithBody<T>;
}
