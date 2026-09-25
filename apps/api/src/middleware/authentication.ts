import type { RequestHandler } from 'express';

import type { UserRole } from '@navalha/contracts';
import { getActiveUser } from '../modules/auth/service.js';

export const requireUser: RequestHandler = (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
    });
    return;
  }

  void getActiveUser(userId)
    .then((user) => {
      if (!user) {
        response.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
        });
        return;
      }
      response.locals.user = user;
      next();
    })
    .catch(next);
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.user as { role?: UserRole } | undefined;
    if (!user || !roles.includes(user.role as UserRole)) {
      response.status(403).json({
        error: { code: 'FORBIDDEN', message: 'This account cannot access this resource.' },
      });
      return;
    }
    next();
  };
}