import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, test, expect } from 'vitest';
import { UnitInput, EtcSelect } from '../src/components/inputs';

function UnitHarness() {
  const [v, setV] = useState('kg');
  return (
    <>
      <UnitInput value={v} onChange={setV} />
      <span data-testid="val">{v}</span>
    </>
  );
}

function EtcHarness() {
  const [s, setS] = useState({ value: '50L', etc: '' });
  return (
    <>
      <EtcSelect
        options={['5gal', '50L', '100L', '200L', '기타']}
        value={s.value}
        etc={s.etc}
        onChange={(value, etc) => setS({ value, etc })}
      />
      <span data-testid="value">{s.value}</span>
      <span data-testid="etc">{s.etc}</span>
    </>
  );
}

describe('입력 컴포넌트', () => {
  test('UnitInput: 기타 선택 후 직접 입력하면 값이 반영된다', async () => {
    render(<UnitHarness />);
    await userEvent.selectOptions(screen.getByRole('combobox'), '기타');
    const input = screen.getByPlaceholderText(/단위 입력/);
    await userEvent.type(input, 'box');
    expect(screen.getByTestId('val').textContent).toBe('box');
  });

  test('EtcSelect: 기타 선택 시 직접 입력란이 나타나고 etc에 반영된다', async () => {
    render(<EtcHarness />);
    await userEvent.selectOptions(screen.getByRole('combobox'), '기타');
    expect(screen.getByTestId('value').textContent).toBe('기타');
    const input = screen.getByPlaceholderText(/직접 입력/);
    await userEvent.type(input, '특수창고');
    expect(screen.getByTestId('etc').textContent).toBe('특수창고');
  });
});
