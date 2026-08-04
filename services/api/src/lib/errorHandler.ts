import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "./httpError.js";

/** Centralized error handler — must be registered last, after all routes. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    return res.status(400).json({ error: "invalid_request", issues: err.issues });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code });
  }

  console.error(err);
  res.status(500).json({ error: "internal_error" });
}
