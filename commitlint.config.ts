import type { SyncRule, UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 80],
    'body-max-line-length': [2, 'always', 300],
    'body-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [2, 'always'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-case': [0], // Disable default scope-case rule
    'scope-enum': [0], // Disable scope enum if needed
    'scope-pattern': [2, 'always'], // Enable custom scope pattern rule
    'subject-empty': [2, 'never'],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-full-stop': [2, 'never', '.'],
  },
  plugins: [
    {
      rules: {
        'scope-pattern': ((parsed) => {
          const scope = parsed.scope;
          // Allow only: no scope OR Linear token pattern (JK-[number])
          if (!scope) return [true];

          const isLinearToken = /^JK-\d+$/.test(scope);

          if (isLinearToken) {
            return [true];
          }

          return [
            false,
            `scope must be a Linear token (JK-[number]) or omitted entirely`,
          ];
        }) as SyncRule,
      },
    },
  ],
};

export default Configuration;
