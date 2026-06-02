export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature or capability
        'fix',      // Bug fix
        'refactor', // Code restructuring (no functional change)
        'perf',     // Performance improvement
        'docs',     // Documentation only
        'style',    // Formatting, linting, UI polish
        'test',     // Adding or updating tests
        'chore',    // Build, CI, dependencies, tooling
        'revert',   // Revert a previous commit
        'wip',      // Work in progress (squash before merge)
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'ai',           // ag-associates-ai/backend
        'dashboard',    // ag-associates-ai/frontend
        'platform',     // ag-platform Turborepo
        'mobile',       // ag-platform/apps/mobile
        'intake',       // ag-platform/services/intake-api
        'docs',         // documentation
        'proto',        // prototypes
        'ci',           // CI/CD
        'noi',          // NOI automation
        'rpa',          // RPA executor
        'telegram',     // Telegram bot
        'otp',          // OTP bridge
        'comms',        // auto-communication
        'email',        // email intake
        'release',      // release/versioning
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
  },
}
