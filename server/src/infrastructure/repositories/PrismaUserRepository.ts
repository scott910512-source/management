import { prisma } from '../db/prisma';
import type { IUserRepository, UserRecord } from '../../domain/repositories';
import type { Role } from '../../domain/entities/types';

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    return (await prisma.user.findUnique({ where: { id } })) as UserRecord | null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return (await prisma.user.findUnique({ where: { email } })) as UserRecord | null;
  }

  async create(data: { name: string; email: string; password: string; role?: Role }): Promise<UserRecord> {
    return (await prisma.user.create({
      data: { name: data.name, email: data.email, password: data.password, role: data.role ?? 'USER' },
    })) as UserRecord;
  }

  async list(): Promise<UserRecord[]> {
    return (await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })) as UserRecord[];
  }

  async updateRole(id: string, role: Role): Promise<UserRecord> {
    return (await prisma.user.update({ where: { id }, data: { role } })) as UserRecord;
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return prisma.user.count();
  }
}
