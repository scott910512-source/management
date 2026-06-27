import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Bars, statusColor } from '../src/components/ui';

describe('UI 컴포넌트', () => {
  test('Bars: 항목과 값을 렌더링한다', () => {
    render(<Bars data={{ '2공장현장': 3, '3류창고': 1 }} />);
    expect(screen.getByText('2공장현장')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('Bars: 빈 데이터는 안내 문구', () => {
    render(<Bars data={{}} />);
    expect(screen.getByText('데이터 없음')).toBeInTheDocument();
  });

  test('statusColor: 상태별 색상 매핑', () => {
    expect(statusColor('사용중')).toBe('blue');
    expect(statusColor('세정의뢰')).toBe('orange');
    expect(statusColor('사용금지')).toBe('red');
    expect(statusColor('수령')).toBe('green');
  });
});
