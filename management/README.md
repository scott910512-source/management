# 🧪 화학공장 수불관리 시스템

원재료 · 부재료 · **Canister(용기)** 를 관리하는 **사내망 전용** 재고/수불 관리 시스템입니다.
데이터는 별도 DB 없이 **서버 PC의 CSV 파일**에 저장되고, 거기서 읽어 관리됩니다.

> **목표(Goal)** — 화학공장 수불 관리원이 원재료·부재료·Canister를 안정적으로 관리하기 위한 도구.
> **UI** — Apple 느낌(화이트 베이스 · 카드형 · 둥근 모서리 · 절제된 포인트 컬러).

---

## 🧱 아키텍처

```
[사용자 브라우저들] ──사내망(HTTP)──▶ [서버 담당 PC 1대]
                                         ├─ Express API (Node.js)
                                         ├─ React 정적 페이지 서빙
                                         └─ CSV 파일 저장소 (server/data/*.csv)
```

- **Frontend**: React 18 + Vite (SPA), 순수 CSS 디자인 시스템(Apple 스타일)
- **Backend**: Node.js + Express, 세션 로그인(express-session), 비밀번호 해시(bcrypt)
- **저장소**: CSV 파일 (UTF-8 BOM, Excel 호환). 파일별 비동기 락으로 동시 쓰기 충돌 방지
- **서버 PC만** Node.js가 필요하며, **사용자는 브라우저 접속만** 하면 됩니다(설치 불필요).

---

## 📂 폴더 구조

```
chem-inventory/
├─ server/                  # Express 백엔드
│  ├─ src/
│  │  ├─ index.js           # 진입점(시드 + 서버 기동)
│  │  ├─ app.js             # Express 앱(라우트/세션/정적 서빙/에러)
│  │  ├─ lib/               # csv, store(락), seed, tx, ids, http
│  │  ├─ middleware/auth.js # 로그인/관리자 권한
│  │  └─ routes/            # auth, users, rawMaterials, subMaterials,
│  │                        # canisters, transactions, dashboard, settings, meta
│  ├─ tests/                # Jest + Supertest (API/CSV)
│  └─ data/                 # ★ CSV 저장소(최초 실행 시 자동 생성, git 제외)
└─ client/                  # React 프론트엔드
   ├─ src/pages/            # Dashboard, RawMaterials, SubMaterials,
   │                        # Canisters, CanisterDetail, Transactions, Admin, Settings, Login, Signup
   ├─ src/components/       # ui(모달/토스트/배지/막대), inputs(단위·기타 선택)
   └─ tests/                # Vitest + Testing Library
```

---

## 🚀 실행 방법

### 0) 사전 준비 (서버 PC 1회)
- Node.js 18+ 설치 (권장 20/22 LTS)

### 1) 설치
```bash
cd chem-inventory
npm install        # 루트(concurrently)
npm run setup      # server + client 의존성 설치
```

### 2-A) 개발 모드 (코드 수정하며 보기)
```bash
npm run dev
# server: http://localhost:4000 , client(dev): http://localhost:5173
# 브라우저에서 http://localhost:5173 접속
```

### 2-B) 운영 모드 (사내 배포, 권장)
```bash
npm run build      # React 빌드 → client/dist
npm start          # Express가 빌드된 화면 + API를 4000 포트로 함께 서빙
# 사내 사용자는 http://<서버PC_IP>:4000 으로 접속
```
> 포트 변경: `PORT=8080 npm start` · 데이터 폴더 변경: `DATA_DIR=D:\chem-data npm start`

### 기본 계정
| 구분 | 아이디 | 비밀번호 |
|------|--------|----------|
| 관리자 | `admin` | `admin1234` |
| 등록자(예시) | `user1` | `user1234` |

> **운영 시작 시 `admin` 비밀번호를 반드시 변경**하고, `SESSION_SECRET` 환경변수를 임의 값으로 설정하세요.

---

## 🗂️ 데이터(CSV) 파일

`server/data/` 에 항목별로 저장됩니다. **Excel에서 바로 열어도 한글이 깨지지 않습니다(UTF-8 BOM).**

| 파일 | 내용 |
|------|------|
| `users.csv` | 계정(비밀번호 해시), 역할(user/admin), 상태(pending/approved/rejected) |
| `raw_materials.csv` | 원재료: 품목명/수량/단위/안전재고/입고일 |
| `sub_materials.csv` | 부재료: 입고일/Lot No/무게(잔량·입고)/업체명/단위 |
| `canisters.csv` | Canister 마스터: No./사이즈/위치/상태 |
| `canister_history.csv` | 용기이력카드: 반입/반출/상태변경 이력 |
| `transactions.csv` | 원·부재료 수불(입고/출고) 내역 |
| `settings.csv` | 안전재고 경고 비율(%) 등 |

> **백업**: `server/data/` 폴더를 주기적으로 복사하면 전체 백업이 됩니다.
> 시드 초기화: `npm run seed`(파일이 없을 때만 생성) / 강제 재생성: `npm --prefix server run seed`.

---

## ✅ 기능 (요구사항 매핑)

- **원재료**: 품목명/수량/단위(kg·ea·L·기타)/입고일, 안전재고 기준수량, 수불(입고/출고)
- **부재료**: 입고일/Lot No/무게/업체명/단위, **품목별 내역현황**, 소진 시 무게 차감
- **Canister**: No. + 사이즈(5gal/50L/100L/200L/기타) + 위치(2공장현장/3류창고/4류창고/기타) + 상태(수령/사용중/사용완료/세정의뢰/사용금지/기타)
  - **용기이력카드**: 반입/반출/상태변경 이력을 용기별로 추적, 개수 집계(위치/사이즈/상태)
- **수불 처리**: 원·부재료·Canister 모두 사용 시 자동 수불/이력 기록
- **대시보드**: 원재료 수량·안전재고 비율(설정 가능), Canister 현황(위치별/제품별/상세구분별)
- **권한**: 등록자(추가/수정) · 관리자(모든 수정·삭제, 가입 승인). 모든 변경에 작성자/일시 기록
- **가입**: 사용 신청 → 관리자 승인 후 로그인
- **CSV Export**: 수불 내역·용기 이력·각 목록을 **필터 적용 상태로** CSV 다운로드

> 예시 데이터는 항목별 3건씩 시드되어 있습니다.

---

## 🧪 테스트

```bash
npm test                      # 백엔드 + 프론트 전체
npm --prefix server test      # 백엔드(Jest+Supertest) — API/권한/CSV/엣지케이스
npm --prefix client test      # 프론트(Vitest+RTL) — 입력/표시/로그인
```
점검된 엣지 케이스: 출고 수량 초과, 미승인 로그인, 중복 ID/Lot/Canister No., 마지막 관리자 보호,
권한 분기(등록자 삭제 403), CSV 인코딩(BOM)·콤마/따옴표/줄바꿈 처리 등.

---

## 🔒 운영 주의사항 (시니어 재점검 요약)

- **계정/보안**: `admin` 비밀번호 변경, `SESSION_SECRET` 지정. HTTPS가 가능하면 쿠키 `secure` 적용 권장.
- **데이터 무결성**: 파일별 비동기 락으로 읽기-수정-쓰기 직렬화. `server/data/` 정기 백업 필수.
- **단일 PC 의존**: 서버 PC가 켜져 있어야 사용 가능. 전원/네트워크 안정성 확보 권장.
- **세션 저장소**: 기본 메모리 세션이라 서버 재시작 시 재로그인 필요(데이터에는 영향 없음).

---

## 💡 사용성 개선 제안 (선택 적용)

현장 운영 관점에서 추가하면 좋은 항목입니다. 필요 시 알려주시면 반영합니다.

1. 안전재고 미달 **자동 알림**(대시보드 상단 배너/사내 메신저 연동)
2. Canister **즐겨찾기/최근 사용** 및 QR/바코드 스캔 입력(현장 태블릿)
3. **감사 로그**(누가 무엇을 언제 변경했는지 전 항목 추적) 별도 화면
4. 부재료 **선입선출(FIFO)** 출고 가이드 및 유효기간 관리
5. CSV 외 **Excel(.xlsx)** 내보내기, 월간 수불 요약 리포트
6. 데이터 폴더 **자동 일일 백업**(스냅샷) 스크립트
```
