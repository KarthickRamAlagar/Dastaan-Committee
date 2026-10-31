'use client';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { get } from '../lib/api';
import { Input, Select } from './ui/form';

/** The Lead's committee's sub-committees, from the final list. Empty when the committee has none defined. */
export const useSubCommittees = () => useQuery({ queryKey: ['sub-committees'], queryFn: () => get<string[]>('/users/sub-committees'), staleTime: 5 * 60_000 });

/** A drop-down of the committee's sub-committees; falls back to a text box if the committee has no list. Spread react-hook-form's register() or value/onChange into it. */
export function SubCommitteeSelect(props: Omit<ComponentProps<typeof Select>, 'children'>) {
  const subs = useSubCommittees();
  if (subs.data && subs.data.length === 0) return <Input {...(props as ComponentProps<typeof Input>)} maxLength={60} autoComplete="off" />;
  return (
    <Select {...props}>
      <option value="">Choose a sub-committee</option>
      {subs.data?.map((s) => <option key={s} value={s}>{s}</option>)}
    </Select>
  );
}
