module.exports = {
	testEnvironment: 'node',
	testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
	transform: {
		'^.+\\.[jt]s$': ['babel-jest', { configFile: './babel.config.json' }]
	},
	modulePathIgnorePatterns: ['<rootDir>/contracts/'],
	extensionsToTreatAsEsm: ['.ts'],
	testTimeout: 20000
};
