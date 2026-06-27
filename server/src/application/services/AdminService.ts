import type { IUserRepository } from '../../domain/repositories';
import type { Role } from '../../domain/entities/types';
import { ROLES } from '../../domain/entities/types';
import { BadRequestError, NotFoundError } from '../../shared/errors';

export class AdminService {
  constructor(private readonly users: IUserRepository) {}

  async listUsers() {
    const users = await this.users.list();
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    }));
  }

  async updateRole(targetId: string, role: Role) {
    if (!ROLES.includes(role)) throw new BadRequestError('잘못된 권한입니다.');
    const user = await this.users.findById(targetId);
    if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');
    const updated = await this.users.updateRole(targetId, role);
    return { id: updated.id, name: updated.name, email: updated.email, role: updated.role };
  }

  async deleteUser(actorId: string, targetId: string) {
    if (actorId === targetId) throw new BadRequestError('본인 계정은 삭제할 수 없습니다.');
    const user = await this.users.findById(targetId);
    if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');
    await this.users.delete(targetId);
  }
}
