module.exports = {
	testEnvironment: 'node',
	testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
	transform: {
		'^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.json' }]
	},
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1"
	},
	testPathIgnorePatterns: ['<rootDir>/tests/', '<rootDir>/public/', '<rootDir>/__tests__/submarine-upgrade-integration.test.tsx'],
	modulePathIgnorePatterns: ['<rootDir>/contracts/'],
	transformIgnorePatterns: [
		'node_modules/(?!(msw|@mswjs|until-async))',
	],
	extensionsToTreatAsEsm: ['.ts', '.tsx', '.jsx'],
	testTimeout: 20000
};
