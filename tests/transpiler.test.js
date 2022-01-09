const { Transpiler } = require('../dist');
const fs = require('fs');
const path = require('path');
const testFolder = path.resolve(__dirname, 'scripts');

describe('parse', function() {
	describe('default scripts', function() {
		fs
			.readdirSync(testFolder)
			.forEach(file => {
				const filepath = path.resolve(testFolder, file);

				test(path.basename(filepath), async () => {
					const result = await (new Transpiler({ target: filepath }).parse());

					expect(Object.values(result)).toMatchSnapshot();
				});
			});
	});
});