'use client';

import React from 'react';

import { Card, Table, Text } from '@mantine/core';

import type { SentryIssuesResponse } from 'fpp/server/api/routers/sentry.router';

// Format timestamp to show like "8hr ago" or "1wk" or "6d ago"
const formatLastSeen = (timestamp: string): string => {
  const now = new Date();
  const lastSeen = new Date(timestamp);
  const diffMs = now.getTime() - lastSeen.getTime();

  // Convert to seconds, minutes, hours, days, weeks
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk = Math.floor(diffDay / 7);

  if (diffWk > 0) return `${diffWk}wk ago`;
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}hr ago`;
  if (diffMin > 0) return `${diffMin}min ago`;
  return `${diffSec}s ago`;
};

// Format age to show like "1yr" or "2mo" or "3wk" or "5d" (simplified)
const formatAge = (timestamp: string): string => {
  const now = new Date();
  const firstSeen = new Date(timestamp);
  const diffMs = now.getTime() - firstSeen.getTime();

  // Convert to days, weeks, months, years
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWk = Math.floor(diffDay / 7);
  const diffMo = Math.floor(diffDay / 30);
  const diffYr = Math.floor(diffDay / 365);

  // Only show the largest unit
  if (diffYr > 0) return `${diffYr}yr`;
  if (diffMo > 0) return `${diffMo}mo`;
  if (diffWk > 0) return `${diffWk}wk`;
  return `${diffDay}d`;
};

// Simple bar chart component for trend data without tooltips
const TrendChart = ({ data }: { data: number[] }) => {
  const maxValue = Math.max(...data, 1); // Ensure we don't divide by zero

  return (
    <div className="flex items-end h-8 gap-[1px]">
      {data.map((value, index) => {
        const height = (value / maxValue) * 100;
        return (
          <div
            key={index}
            className="bg-blue-500 w-1 hover:bg-blue-700 transition-colors duration-200"
            style={{ height: `${Math.max(height, 4)}%` }}
          />
        );
      })}
    </div>
  );
};

export const SentryIssuesTable = ({
  issues,
}: {
  issues: SentryIssuesResponse[];
}) => {
  const rows = issues.map((issue, index) => (
    <Table.Tr
      key={index}
      onClick={() => window.open(issue.permalink, '_blank')}
      style={{ cursor: 'pointer' }}
      className="hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <Table.Td className="align-middle text-left px-1">
        <Text fw={500} size="sm">
          {issue.type}: {issue.title}
        </Text>
      </Table.Td>
      <Table.Td className="align-middle text-left px-1">
        {formatLastSeen(issue.lastSeen)}
      </Table.Td>
      <Table.Td className="align-middle text-left px-1">
        {formatAge(issue.firstSeen)}
      </Table.Td>
      <Table.Td className="align-middle text-left px-1">
        <TrendChart data={issue.stats} />
      </Table.Td>
      <Table.Td className="align-middle text-left mono px-1">
        {issue.count}
      </Table.Td>
      <Table.Td className="align-middle text-left mono px-1">
        {issue.userCount}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Card withBorder radius="md" padding="0" className="mb-12">
      <div className="overflow-y-scroll max-h-[400px]">
        <Table
          highlightOnHover
          stickyHeader
          withRowBorders={true}
          className="p-0 m-0"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="text-left px-1">Issue</Table.Th>
              <Table.Th className="text-left min-w-[120px] px-1">
                Last Seen
              </Table.Th>
              <Table.Th className="text-left px-1">Age</Table.Th>
              <Table.Th className="text-left px-1">Trend 14d</Table.Th>
              <Table.Th className="text-left px-1">Events</Table.Th>
              <Table.Th className="text-left px-1">Users</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </div>
    </Card>
  );
};
