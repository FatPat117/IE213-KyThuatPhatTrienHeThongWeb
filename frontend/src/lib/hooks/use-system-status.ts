'use client';

import { useContext } from 'react';
import { StatusContext, type StatusContextType, type StatusType, type StatusMessage } from '../context/status';

export function useSystemStatus(): StatusContextType {
  const context = useContext(StatusContext);

  if (!context) {
    throw new Error(
      'useSystemStatus phải được sử dụng trong StatusProvider. Hãy chắc chắn StatusProvider bao bọc cây thành phần của bạn.'
    );
  }

  return context;
}

export function useHasStatus(): boolean {
  const { status } = useSystemStatus();
  return status !== null;
}

export function useStatusType(): StatusType {
  const { status } = useSystemStatus();
  return status?.type || null;
}
