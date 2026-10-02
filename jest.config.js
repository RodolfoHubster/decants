export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  transform: {},
  collectCoverageFrom: ['assets/js/cart.js', 'assets/js/lotes.js', 'assets/js/hero.js', 'assets/js/clientes-util.js', 'assets/js/stock.js', 'assets/js/precios.js', 'assets/js/catalogo-cache.js', 'assets/js/imagenes.js', 'assets/js/pos-cliente.js'],
};
