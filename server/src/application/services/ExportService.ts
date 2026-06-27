import ExcelJS from 'exceljs';
import type {
  IVisitRepository,
  IWishlistRepository,
  IRegionRepository,
} from '../../domain/repositories';

const STATUS_LABEL: Record<string, string> = {
  VISITED: '방문함',
  PLANNED: '계획중',
  UNVISITED: '미방문',
};

export interface BackupData {
  version: 1;
  exportedAt: string;
  visits: Array<{
    province: string;
    district: string;
    status: string;
    visitDate: string | null;
    memo: string | null;
    visibility: string;
  }>;
  wishlist: Array<{ province: string; district: string }>;
}

export class ExportService {
  constructor(
    private readonly visits: IVisitRepository,
    private readonly wishlists: IWishlistRepository,
    private readonly regions: IRegionRepository,
  ) {}

  /** xlsx 버퍼 생성 */
  async toExcel(userId: string): Promise<Buffer> {
    const visits = await this.visits.listByUser(userId);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Travel Korea Tracker';
    const ws = wb.addWorksheet('방문기록');
    ws.columns = [
      { header: '시도', key: 'province', width: 18 },
      { header: '시군구', key: 'district', width: 16 },
      { header: '상태', key: 'status', width: 10 },
      { header: '방문일', key: 'visitDate', width: 14 },
      { header: '메모', key: 'memo', width: 50 },
      { header: '공개범위', key: 'visibility', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const v of visits) {
      ws.addRow({
        province: v.region?.provinceName ?? '',
        district: v.region?.district ?? '',
        status: STATUS_LABEL[v.status] ?? v.status,
        visitDate: v.visitDate ? new Date(v.visitDate).toISOString().slice(0, 10) : '',
        memo: v.memo ?? '',
        visibility: v.visibility,
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** JSON 백업 데이터 생성 */
  async toJson(userId: string): Promise<BackupData> {
    const [visits, wishlist] = await Promise.all([
      this.visits.listByUser(userId),
      this.wishlists.listByUser(userId),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      visits: visits.map((v) => ({
        province: v.region?.provinceName ?? '',
        district: v.region?.district ?? '',
        status: v.status,
        visitDate: v.visitDate ? new Date(v.visitDate).toISOString() : null,
        memo: v.memo ?? null,
        visibility: v.visibility,
      })),
      wishlist: wishlist.map((w) => ({
        province: w.region?.provinceName ?? '',
        district: w.region?.district ?? '',
      })),
    };
  }

  /** JSON 백업 복원 (지역명 기준 매칭). 반환: 복원된 건수 */
  async importJson(userId: string, data: BackupData): Promise<{ visits: number; wishlist: number }> {
    if (!data || data.version !== 1) {
      throw new Error('지원하지 않는 백업 형식입니다.');
    }
    const regions = await this.regions.listAll();
    const key = (p: string, d: string) => `${p}|${d}`;
    const regionMap = new Map(regions.map((r) => [key(r.provinceName, r.district), r.id]));

    let visitCount = 0;
    for (const v of data.visits ?? []) {
      const regionId = regionMap.get(key(v.province, v.district));
      if (!regionId) continue;
      await this.visits.upsert({
        userId,
        regionId,
        status: (v.status as any) ?? 'VISITED',
        visitDate: v.visitDate ? new Date(v.visitDate) : null,
        memo: v.memo ?? null,
        visibility: (v.visibility as any) ?? 'PRIVATE',
      });
      visitCount++;
    }

    let wishCount = 0;
    for (const w of data.wishlist ?? []) {
      const regionId = regionMap.get(key(w.province, w.district));
      if (!regionId) continue;
      await this.wishlists.add(userId, regionId);
      wishCount++;
    }
    return { visits: visitCount, wishlist: wishCount };
  }
}
