export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/'],
  modulePathIgnorePatterns: ['/.claude/worktrees/'],
  transform: {},
  collectCoverageFrom: ['assets/js/cart.js', 'assets/js/lotes.js', 'assets/js/hero.js', 'assets/js/clientes-util.js', 'assets/js/stock.js', 'assets/js/precios.js'],
};
