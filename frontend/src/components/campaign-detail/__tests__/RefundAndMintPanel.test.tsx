// frontend/src/components/campaign-detail/__tests__/RefundAndMintPanel.test.tsx
//
// Unit tests cho RefundAndMintPanel component.
// Kiểm tra: visibility, text content, button state, và callback invocation.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RefundAndMintPanel from '../RefundAndMintPanel';

// ─── Props mặc định (trạng thái "sạch") ────────────────────────────────────
const defaultProps = {
  showRefund: false,
  showMint: false,
  hasRefunded: false,
  refundPending: false,
  refundConfirming: false,
  refundConfirmed: false,
  refundHash: undefined,
  mintPending: false,
  mintConfirming: false,
  mintConfirmed: false,
  mintHash: undefined,
  mintProfileSaving: false,
  defaultDisplayName: '',
  onRefund: jest.fn(),
  onMint: jest.fn(),
};

function renderPanel(overrides = {}) {
  return render(<RefundAndMintPanel {...defaultProps} {...overrides} />);
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. VISIBILITY
// ──────────────────────────────────────────────────────────────────────────────
describe('Visibility', () => {
  it('không render gì khi showRefund=false và showMint=false', () => {
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it('hiển thị panel hoàn tiền khi showRefund=true', () => {
    renderPanel({ showRefund: true });
    expect(screen.getByText('Chiến dịch không đạt mục tiêu')).toBeInTheDocument();
  });

  it('không hiển thị panel mint khi showMint=false', () => {
    renderPanel({ showRefund: true });
    expect(screen.queryByText('NFT chứng nhận quyên góp')).not.toBeInTheDocument();
  });

  it('hiển thị panel mint khi showMint=true', () => {
    renderPanel({ showMint: true });
    expect(screen.getByText('NFT chứng nhận quyên góp')).toBeInTheDocument();
  });

  it('hiển thị cả hai panel khi showRefund=true và showMint=true', () => {
    renderPanel({ showRefund: true, showMint: true });
    expect(screen.getByText('Chiến dịch không đạt mục tiêu')).toBeInTheDocument();
    expect(screen.getByText('NFT chứng nhận quyên góp')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. TRẠNG THÁI HOÀN TIỀN (Refund State)
// ──────────────────────────────────────────────────────────────────────────────
describe('Refund button state', () => {
  it('hiển thị nút "Yêu cầu hoàn tiền" khi hasRefunded=false và chưa confirmed', () => {
    renderPanel({ showRefund: true, hasRefunded: false });
    expect(screen.getByRole('button', { name: /Yêu cầu hoàn tiền/i })).toBeInTheDocument();
  });

  it('nút bị disabled khi refundPending=true', () => {
    renderPanel({ showRefund: true, refundPending: true });
    expect(screen.getByRole('button', { name: /Đợi xác nhận từ ví/i })).toBeDisabled();
  });

  it('nút bị disabled khi refundConfirming=true', () => {
    renderPanel({ showRefund: true, refundConfirming: true });
    expect(screen.getByRole('button', { name: /Đang xác nhận/i })).toBeDisabled();
  });

  it('hiển thị "✅ Bạn đã rút tiền hoàn lại thành công" khi hasRefunded=true', () => {
    renderPanel({ showRefund: true, hasRefunded: true });
    // Text này xuất hiện cả trong mô tả lẫn success box → dùng getAllByText
    const elements = screen.getAllByText(/Bạn đã rút tiền hoàn lại thành công/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
    // Nút hoàn tiền phải biến mất
    expect(screen.queryByRole('button', { name: /Yêu cầu hoàn tiền/i })).not.toBeInTheDocument();
  });

  it('hiển thị "✅ Bạn đã rút tiền hoàn lại thành công" khi refundConfirmed=true', () => {
    renderPanel({ showRefund: true, refundConfirmed: true });
    expect(screen.getByText(/Bạn đã rút tiền hoàn lại thành công/i)).toBeInTheDocument();
  });



  it('gọi onRefund() khi nhấn nút Yêu cầu hoàn tiền', async () => {
    const onRefund = jest.fn();
    renderPanel({ showRefund: true, onRefund });
    await userEvent.click(screen.getByRole('button', { name: /Yêu cầu hoàn tiền/i }));
    expect(onRefund).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. TRẠNG THÁI MINT
// ──────────────────────────────────────────────────────────────────────────────
describe('Mint button state', () => {
  it('hiển thị nút "Mint chứng chỉ"', () => {
    renderPanel({ showMint: true });
    expect(screen.getByRole('button', { name: /Mint chứng chỉ/i })).toBeInTheDocument();
  });

  it('nút mint bị disabled khi mintPending=true', () => {
    renderPanel({ showMint: true, mintPending: true });
    expect(screen.getByRole('button', { name: /Đợi xác nhận từ ví/i })).toBeDisabled();
  });

  it('nút mint bị disabled khi mintProfileSaving=true', () => {
    renderPanel({ showMint: true, mintProfileSaving: true });
    expect(screen.getByRole('button', { name: /Đang lưu hồ sơ/i })).toBeDisabled();
  });

  it('mở form nhập tên khi nhấn "Mint chứng chỉ"', async () => {
    renderPanel({ showMint: true });
    await userEvent.click(screen.getByRole('button', { name: /Mint chứng chỉ/i }));
    expect(screen.getByPlaceholderText(/Nhập tên hiển thị/i)).toBeInTheDocument();
  });

  it('nút "Xác nhận và mint" bị disabled khi chưa nhập tên', async () => {
    renderPanel({ showMint: true });
    await userEvent.click(screen.getByRole('button', { name: /Mint chứng chỉ/i }));
    expect(screen.getByRole('button', { name: /Xác nhận và mint/i })).toBeDisabled();
  });

  it('gọi onMint(displayName) khi nhập tên và xác nhận', async () => {
    const onMint = jest.fn();
    renderPanel({ showMint: true, onMint });
    await userEvent.click(screen.getByRole('button', { name: /Mint chứng chỉ/i }));

    const input = screen.getByPlaceholderText(/Nhập tên hiển thị/i);
    await userEvent.type(input, 'Nguyen Van A');
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận và mint/i }));

    expect(onMint).toHaveBeenCalledWith('Nguyen Van A');
  });

  it('đóng form khi nhấn Hủy', async () => {
    renderPanel({ showMint: true });
    await userEvent.click(screen.getByRole('button', { name: /Mint chứng chỉ/i }));
    expect(screen.getByPlaceholderText(/Nhập tên hiển thị/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Hủy/i }));
    expect(screen.queryByPlaceholderText(/Nhập tên hiển thị/i)).not.toBeInTheDocument();
  });

  it('hiển thị "Mint chứng chỉ thành công!" sau khi mintConfirmed=true và có mintHash', () => {
    renderPanel({ showMint: true, mintConfirmed: true, mintHash: '0xabc' });
    expect(screen.getByText(/Mint chứng chỉ thành công!/i)).toBeInTheDocument();
  });



  it('không gọi onMint() nếu tên chỉ có khoảng trắng', async () => {
    const onMint = jest.fn();
    renderPanel({ showMint: true, onMint });
    await userEvent.click(screen.getByRole('button', { name: /Mint chứng chỉ/i }));

    const input = screen.getByPlaceholderText(/Nhập tên hiển thị/i);
    await userEvent.type(input, '   ');
    // Nút vẫn bị disabled vì trim() = ''
    expect(screen.getByRole('button', { name: /Xác nhận và mint/i })).toBeDisabled();
    expect(onMint).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. TEXT MÔ TẢ TRẠNG THÁI REFUND
// ──────────────────────────────────────────────────────────────────────────────
describe('Refund status text', () => {
  it('hiển thị "Bạn có thể yêu cầu hoàn tiền." khi hasRefunded=false', () => {
    renderPanel({ showRefund: true, hasRefunded: false });
    expect(screen.getByText(/Bạn có thể yêu cầu hoàn tiền\./i)).toBeInTheDocument();
  });

  it('hiển thị "Bạn đã rút tiền hoàn lại thành công." khi hasRefunded=true', () => {
    renderPanel({ showRefund: true, hasRefunded: true });
    expect(screen.getByText(/Bạn đã rút tiền hoàn lại thành công\./i)).toBeInTheDocument();
  });
});
