export default function ProdDashboard() {
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>종합현황</div>
      <div className="muted" style={{ fontSize: 15 }}>생산 KPI·수율·공정별 현황을 한눈에 확인하는 대시보드입니다.<br />데이터 매핑 후 활성화됩니다.</div>
    </div>
  );
}
