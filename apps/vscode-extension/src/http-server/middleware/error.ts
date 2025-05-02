import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};
