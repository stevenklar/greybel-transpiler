const { Minifier } = require('../dist');
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
					const result = new Minifier({ code: fs.readFileSync(filepath, 'utf-8') }).minify();

					expect(result).toMatchSnapshot();
				});

				test(path.basename(filepath) + ' uglify', async () => {
					const result = new Minifier({ code: fs.readFileSync(filepath, 'utf-8'), uglify: true }).minify();

					expect(result).toMatchSnapshot();
				});
			});
	});
});