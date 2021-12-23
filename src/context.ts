import { ParserValidator } from 'greybel-core';
import NamespaceGenerator from './utils/namespace-generator';
import LiteralsMapper from './utils/literals-mapper';

export interface ContextOptions {
	variablesCharset?: string;
	variablesExcluded?: string[];
	modulesCharset?: string;
}

export default class Context {
	modules: NamespaceGenerator;
	variables: NamespaceGenerator;
	literals: LiteralsMapper;
	data: Map<string, any>;

	constructor(options: ContextOptions) {
		const me = this;

		me.modules = new NamespaceGenerator({
			characters: options.modulesCharset,
			forbidden: (new ParserValidator).getNatives()
		});

		me.variables = new NamespaceGenerator({
			characters: options.variablesCharset,
			defaultNamespaces: [
				'BACKSLASH_CODE',
				'NEW_LINE_OPERATOR',
				'MODULES',
				'EXPORTED',
				'__REQUIRE',
				'MAIN',
				'module'
			],
			forbidden: options.variablesExcluded
		});

		me.literals = new LiteralsMapper(me.variables);
		me.data = new Map();
	}
}