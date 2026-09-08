import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 ignores rejected promises returned by route handlers: an `await`
 * that throws (for example a refused upload) would leave the request hanging
 * until the browser times out and print an unhandled rejection. Wrapping every
 * controller with this helper forwards the error to the JSON error handler in
 * server.ts instead, so the admin panel gets a real error message.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (req: any, res: Response, next: NextFunction) => unknown;

export function asyncHandler(fn: AnyHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}
