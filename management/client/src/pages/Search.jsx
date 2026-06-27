import { SmartSearch } from '../components/SmartSearch';

export default function Search() {
  return (
    <>
      <div className="page-head">
        <div className="desc">자연어로 재고·수불을 검색하세요. (완전 오프라인, 데이터 기반 — 숫자를 지어내지 않습니다)</div>
      </div>
      <SmartSearch autoFocus big />
      <div className="card card-pad" style={{ marginTop: 4 }}>
        <h3 style={{ marginBottom: 8 }}>이렇게 물어보세요</h3>
        <ul style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
          <li><b>사용/입고량</b> — "이번달 톨루엔 사용량", "지난달 촉매펠릿 입고량", "올해 황산 사용"</li>
          <li><b>재고</b> — "톨루엔 재고", "활성탄 잔량"</li>
          <li><b>부족</b> — "부족 품목", "안전재고 미달"</li>
          <li><b>Canister</b> — "세정의뢰 Canister", "사용중 용기", "톨루엔 Canister"</li>
          <li><b>수불 내역</b> — "이번주 수불 내역", "오늘 입고"</li>
          <li><b>이상</b> — "선입선출 이상", "이번달 이상발생"</li>
        </ul>
        <p className="hint" style={{ marginTop: 10 }}>※ 품목명은 자동 인식됩니다(품목 추가 시 바로 적용). 더 자유로운 대화형 질문은 내부 LLM 연동으로 확장할 수 있습니다.</p>
      </div>
    </>
  );
}
