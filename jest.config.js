export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  transform: {},
  // En el navegador los imports llevan versión ('./x.js?v=2') por la caché de
  // GitHub Pages; aquí se ignora para que los módulos puros también la usen.
  moduleNameMapper: { '^(\\.{1,2}/.+\\.js)\\?v=[\\w.]+$': '$1' },
  collectCoverageFrom: ['assets/js/cart.js', 'assets/js/lotes.js', 'assets/js/hero.js', 'assets/js/clientes-util.js', 'assets/js/stock.js', 'assets/js/precios.js', 'assets/js/catalogo-cache.js', 'assets/js/imagenes.js', 'assets/js/pos-cliente.js'],
};
