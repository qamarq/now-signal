'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const statusOptions = [
  { value: 'for-you', label: 'For You' },
  { value: 'all', label: 'All Events' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'early', label: 'Early' },
  { value: 'watch', label: 'Watch' },
];

const sortOptions = [
  { value: 'time', label: 'Latest First' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'earlyScore', label: 'Early Score' },
  { value: 'confirmScore', label: 'Confirm Score' },
];

function EventsFilterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || 'for-you';
  const currentSort = searchParams.get('sort') || 'time';

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'for-you') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'time') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <Tabs
        value={currentStatus}
        onValueChange={handleStatusChange}
        className="w-full sm:w-auto">
        <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:inline-grid">
          {statusOptions.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="text-xs sm:text-sm">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 shrink-0">
        <Label
          htmlFor="sort-select"
          className="text-sm text-muted-foreground whitespace-nowrap">
          Sort by:
        </Label>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger id="sort-select" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function EventsFilter() {
  return (
    <Suspense fallback={<div className="h-10" />}>
      <EventsFilterInner />
    </Suspense>
  );
}
