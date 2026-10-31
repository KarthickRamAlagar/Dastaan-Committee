'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Status } from '@dastaan/shared';
import { ApiError, post } from '../../lib/api';

export function useRefreshTickets() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['tickets'] }), qc.invalidateQueries({ queryKey: ['ticket'] }), qc.invalidateQueries({ queryKey: ['stats'] }), qc.invalidateQueries({ queryKey: ['notif-count'] })]);
}
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

export function useTicketActions() {
  const refresh = useRefreshTickets();
  const status = useMutation({
    mutationFn: (v: { id: string; to: Exclude<Status, 'pending'> }) => post(`/tickets/${v.id}/status`, { status: v.to }),
    onSuccess: () => { toast.success('Status updated'); void refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return { status };
}
