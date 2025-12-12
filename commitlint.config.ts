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
          // Allow no scope or Linear token pattern (JK-[number]) or lowercase scope
          if (!scope) return [true];

          const isLinearToken = /^JK-\d+$/.test(scope);
          const isLowerCase = scope === scope.toLowerCase();

          if (isLinearToken || isLowerCase) {
            return [true];
          }

          return [
            false,
            `scope must be lowercase or match Linear token pattern (JK-[number])`,
          ];
        }) as SyncRule,
      },
    },
  ],
};

export default Configuration;
