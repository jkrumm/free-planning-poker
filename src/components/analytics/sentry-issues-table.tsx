'use client';

import React, { useMemo, useState } from 'react';

import { Badge, Card, Table, Tabs, Text, Tooltip } from '@mantine/core';

import {
  IconBug,
  IconEyeOff,
  IconInfoCircle,
  IconMessage,
  IconUser,
} from '@tabler/icons-react';

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

// Check if issue is user feedback
const isUserFeedback = (issue: SentryIssuesResponse): boolean => {
  const title = issue.title.toLowerCase();
  return (
    title.includes('feedback') ||
    title.includes('user report') ||
    title.includes('user submission') ||
    issue.issueType === 'feedback'
  );
};

// Get level color for badges
const getLevelColor = (level: string): string => {
  switch (level) {
    case 'fatal':
      return 'red';
    case 'error':
      return 'red';
    case 'warning':
      return 'orange';
    case 'info':
      return 'gray';
    case 'debug':
      return 'gray';
    default:
      return 'gray';
  }
};

// Get status color
const getStatusColor = (status: string, substatus: string): string => {
  if (status === 'resolved') return 'green';
  if (substatus === 'new') return 'blue';
  return 'gray';
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

const IssueRow = ({ issue }: { issue: SentryIssuesResponse }) => {
  const isFeedback = isUserFeedback(issue);

  return (
    <Table.Tr
      key={issue.id}
      onClick={() => window.open(issue.permalink, '_blank')}
      style={{ cursor: 'pointer' }}
      className={`hover:bg-gray-100 dark:hover:bg-gray-800 ${!issue.hasSeen ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
    >
      <Table.Td className="align-middle text-left px-2 py-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isFeedback && (
              <Badge size="xs" color="purple" variant="filled">
                FEEDBACK
              </Badge>
            )}
            <Badge
              size="xs"
              color={getLevelColor(issue.level)}
              variant="filled"
            >
              {issue.level.toUpperCase()}
            </Badge>
            <Badge
              size="xs"
              color={getStatusColor(issue.status, issue.substatus)}
              variant="light"
            >
              {issue.substatus}
            </Badge>
            {!issue.hasSeen && (
              <Tooltip label="New issue">
                <IconEyeOff size={14} className="text-blue-500" />
              </Tooltip>
            )}
          </div>
          <Text fw={500} size="sm" className="line-clamp-2">
            {issue.title}
          </Text>
          {issue.culprit && (
            <Text size="xs" c="dimmed" className="truncate">
              {issue.culprit}
            </Text>
          )}
        </div>
      </Table.Td>
      <Table.Td className="align-middle text-left px-2">
        <div className="flex flex-col gap-1 text-center">
          <Text size="sm">{formatLastSeen(issue.lastSeen)}</Text>
          <Text size="xs" c="dimmed">
            Age: {formatAge(issue.firstSeen)}
          </Text>
        </div>
      </Table.Td>
      <Table.Td className="align-middle text-left px-2">
        <TrendChart data={issue.stats} />
      </Table.Td>
      <Table.Td className="align-middle text-center px-2">
        <div className="flex flex-col gap-1">
          <Text fw={600} size="sm">
            {issue.count.toLocaleString()}
          </Text>
          <div className="flex items-center justify-center gap-1">
            <IconUser size={12} />
            <Text size="xs" c="dimmed">
              {issue.userCount}
            </Text>
          </div>
        </div>
      </Table.Td>
    </Table.Tr>
  );
};

export const SentryIssuesTable = ({
  issues,
}: {
  issues: SentryIssuesResponse[];
}) => {
  const [activeTab, setActiveTab] = useState<string>('errors');

  const categorizedIssues = useMemo(() => {
    const userFeedback = issues.filter(isUserFeedback);
    const errors = issues.filter(
      (issue) =>
        !isUserFeedback(issue) &&
        (issue.level === 'fatal' ||
          issue.level === 'error' ||
          issue.level === 'warning'),
    );
    const messages = issues.filter(
      (issue) =>
        !isUserFeedback(issue) &&
        (issue.level === 'info' || issue.level === 'debug'),
    );

    return {
      userFeedback,
      errors,
      messages,
    };
  }, [issues]);

  const renderTable = (issueList: SentryIssuesResponse[]) => (
    <div className="overflow-y-scroll max-h-[600px]">
      <Table
        highlightOnHover
        stickyHeader
        withRowBorders={true}
        className="p-0 m-0"
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className="text-left px-2 min-w-[300px]">
              Issue Details
            </Table.Th>
            <Table.Th className="text-left px-2 min-w-[100px]">
              Timeline
            </Table.Th>
            <Table.Th className="text-left px-2 min-w-[100px]">
              Trend (14d)
            </Table.Th>
            <Table.Th className="text-center px-2 min-w-[80px]">
              Events
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {issueList.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );

  return (
    <Card withBorder radius="md" padding="0">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value ?? 'errors')}
      >
        <Tabs.List className="md:px-4 pt-1">
          <Tabs.Tab
            value="errors"
            className="px-2 md:px-6"
            leftSection={<IconBug size={16} />}
          >
            Errors{' '}
            <Badge variant="light" color="gray" size="sm">
              {categorizedIssues.errors.length}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab
            value="messages"
            className="px-2 md:px-6"
            leftSection={<IconInfoCircle size={16} />}
          >
            Messages{' '}
            <Badge variant="light" color="gray" size="sm">
              {categorizedIssues.messages.length}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab
            value="userFeedback"
            className="px-2 md:px-6"
            leftSection={<IconMessage size={16} />}
          >
            Feedback{' '}
            <Badge variant="light" color="gray" size="sm">
              {categorizedIssues.userFeedback.length}
            </Badge>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="errors" pt={0}>
          {categorizedIssues.errors.length > 0 ? (
            renderTable(categorizedIssues.errors)
          ) : (
            <div className="text-center py-8 text-gray-500">
              <IconBug size={48} className="mx-auto mb-4 opacity-50" />
              <Text size="lg">No errors found</Text>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="messages" pt={0}>
          {categorizedIssues.messages.length > 0 ? (
            renderTable(categorizedIssues.messages)
          ) : (
            <div className="text-center py-8 text-gray-500">
              <IconInfoCircle size={48} className="mx-auto mb-4 opacity-50" />
              <Text size="lg">No messages found</Text>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="userFeedback" pt={0}>
          {categorizedIssues.userFeedback.length > 0 ? (
            renderTable(categorizedIssues.userFeedback)
          ) : (
            <div className="text-center py-8 text-gray-500">
              <IconMessage size={48} className="mx-auto mb-4 opacity-50" />
              <Text size="lg">No user feedback found</Text>
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
};
