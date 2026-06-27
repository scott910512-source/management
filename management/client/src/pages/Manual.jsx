const G = '/guide';

function Step({ title, children, img }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="step">
        <div className="txt">{children}</div>
        {img && <img src={`${G}/${img}`} alt={title} loading="lazy" />}
      </div>
    </>
  );
}

export default function Manual() {
  return (
    <div className="manual">
      <div className="page-head">
        <div className="desc">처음 사용하시는 분을 위한 간단 사용 안내입니다.</div>
      </div>

      <div className="card card-pad">
        <Step title="1. 종합현황 (한눈에 보기)" img="guide-dashboard.png">
          <p>로그인하면 나오는 첫 화면입니다.</p>
          <ul>
            <li><b>퀵메뉴</b> — 원/부재료 입고·사용, Canister 수불을 바로 시작</li>
            <li><b>경고</b> — 안전재고 부족·용량 초과를 확인/삭제</li>
            <li><b>원·부재료 현황</b> — 제품별로 묶여 부족 품목은 빨간색</li>
            <li><b>Canister 현황 / 진행 Task</b></li>
            <li>좌측 상단 <b>공장 선택</b>으로 1·2공장 전환(권한 있는 경우)</li>
          </ul>
        </Step>

        <Step title="2. 원·부재료 입고 / 사용" img="guide-raw.png">
          <p><b>입고</b> = [+ 원재료 입고]로 품목·Lot·수량·단위·입고일을 등록합니다. (품목 선택 시 단위·업체·Lot양식 자동)</p>
          <p><b>사용</b> = [− 원재료 사용]에서 품목 → 재고 있는 Lot → 수량을 입력합니다.</p>
          <p>입고일이 더 빠른 Lot이 있는데 사용하면 <b>선입선출 경고</b>가 뜨고, 강제 사용 시 [이상발생 목록]에 자동 기록됩니다.</p>
        </Step>

        <Step title="3. Canister 관리" img="guide-canister.png">
          <p>용기를 제품(내용물)별로 관리합니다.</p>
          <ul>
            <li>[+ Canister 등록] — 새 용기 등록</li>
            <li>[↔ 이력 등록] — 기존 용기 선택 → 반입/반출(내용물·무게)</li>
            <li>No.·사이즈 변경은 관리자만, 위치/상태는 이력 등록으로</li>
            <li>용기를 클릭하면 <b>용기이력카드</b>(반입/반출 이력)</li>
          </ul>
        </Step>

        <Step title="4. AI 검색 (자연어)" img="guide-search.png">
          <p>좌측 <b>[AI 검색]</b> 또는 종합현황 상단 검색창에 말로 물어보세요.</p>
          <ul>
            <li>“이번달 톨루엔 사용량”, “부족 품목”, “세정의뢰 Canister”</li>
            <li>“톨루엔 재고”, “이번주 수불 내역”, “선입선출 이상”</li>
          </ul>
          <p>실제 데이터로 계산해 답과 목록을 보여줍니다(숫자를 지어내지 않음).</p>
        </Step>

        <Step title="5. 역할 · 공장 · 데이터">
          <ul>
            <li><b>통합관리자/팀관리자</b> = 1·2공장 모두 / <b>공장관리자·사용자</b> = 본인 공장만</li>
            <li><b>팀관리자</b>는 전체를 보지만 <b>등록·수불·삭제 불가(조회 전용)</b></li>
            <li>자료는 <b>공장별로 분리</b> 저장되고, 서버 켤 때마다 <b>자동 백업</b>됩니다</li>
          </ul>
          <p className="hint">문의: 생산2팀 임종수 PL</p>
        </Step>
      </div>
    </div>
  );
}
