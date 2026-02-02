import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class MasterOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;
    if (user.isMaster || user.isAdmin) return true;
    throw new ForbiddenException('Access restricted to master or admin');
  }
}
