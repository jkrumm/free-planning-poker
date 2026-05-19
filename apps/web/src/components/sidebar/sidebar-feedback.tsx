import React from 'react';

import { Text } from '@mantine/core';

import SidebarContent from 'fpp/components/sidebar/sidebar-content';

// Feedback submission temporarily disabled — Sentry.captureFeedback was the
// previous backend and has been removed. Will be replaced with a webhook
// (GitHub issue / Slack / TickTick) in a follow-up; see docs/otel-migration/.
const SidebarFeedback = () => {
  return (
    <SidebarContent
      childrens={[
        {
          title: 'Feedback',
          content: (
            <div className="text-left w-full">
              <Text size="sm">
                Found a bug or have feedback? Please open an issue on{' '}
                <a
                  href="https://github.com/jkrumm/free-planning-poker/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                .
              </Text>
            </div>
          ),
        },
      ]}
    />
  );
};

export default SidebarFeedback;
