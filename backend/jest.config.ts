export default {
  displayName: '@budget-app/backend',
  preset: '../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', {
      jsc: {
        target: 'es2017',
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        keepClassNames: true,
        externalHelpers: true,
        loose: true,
      },
      module: {
        type: 'es6',
      },
      sourceMaps: true,
      swcrc: false,
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
