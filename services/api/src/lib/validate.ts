import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/** Parses and replaces req.body with the validated value; a ZodError on failure is forwarded to the error handler. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
