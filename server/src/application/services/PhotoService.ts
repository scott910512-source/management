import fs from 'fs';
import path from 'path';
import type {
  IPhotoRepository,
  IVisitRepository,
  PhotoRecord,
} from '../../domain/repositories';
import { env } from '../../config/env';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';

export class PhotoService {
  constructor(
    private readonly photos: IPhotoRepository,
    private readonly visits: IVisitRepository,
  ) {}

  /** 사진 추가 (방문당 최대 maxPhotosPerVisit 장 제한) */
  async add(userId: string, visitId: string, filename: string, caption?: string): Promise<PhotoRecord> {
    const visit = await this.visits.findById(visitId);
    if (!visit) throw new NotFoundError('방문 기록을 찾을 수 없습니다.');
    if (visit.userId !== userId) throw new ForbiddenError('본인의 기록에만 사진을 추가할 수 있습니다.');

    const count = await this.photos.countByVisit(visitId);
    if (count >= env.maxPhotosPerVisit) {
      // 제한 초과 시 업로드된 파일 정리
      this.safeUnlink(filename);
      throw new BadRequestError(`사진은 방문당 최대 ${env.maxPhotosPerVisit}장까지 등록할 수 있습니다.`);
    }
    return this.photos.add(visitId, `/uploads/${filename}`, caption ?? null);
  }

  async list(visitId: string): Promise<PhotoRecord[]> {
    return this.photos.listByVisit(visitId);
  }

  async delete(userId: string, photoId: string): Promise<void> {
    const photo = await this.photos.findById(photoId);
    if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다.');
    const visit = await this.visits.findById(photo.visitId);
    if (!visit || visit.userId !== userId) throw new ForbiddenError('삭제 권한이 없습니다.');
    await this.photos.delete(photoId);
    this.safeUnlink(path.basename(photo.imagePath));
  }

  private safeUnlink(filename: string): void {
    try {
      fs.unlinkSync(path.join(env.uploadDir, filename));
    } catch {
      /* 파일이 없으면 무시 */
    }
  }
}
