import type { IWishlistRepository, IRegionRepository, WishlistRecord } from '../../domain/repositories';
import { NotFoundError } from '../../shared/errors';

export class WishlistService {
  constructor(
    private readonly wishlists: IWishlistRepository,
    private readonly regions: IRegionRepository,
  ) {}

  async add(userId: string, regionId: string): Promise<WishlistRecord> {
    const region = await this.regions.findById(regionId);
    if (!region) throw new NotFoundError('존재하지 않는 지역입니다.');
    return this.wishlists.add(userId, regionId);
  }

  async remove(userId: string, regionId: string): Promise<void> {
    await this.wishlists.remove(userId, regionId);
  }

  async list(userId: string): Promise<WishlistRecord[]> {
    return this.wishlists.listByUser(userId);
  }
}
