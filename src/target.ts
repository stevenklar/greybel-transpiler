import Context from './context';
import {
	Parser,
	ASTChunk,
	ASTLiteral
} from 'greybel-core';
import { ResourceHandler } from './resource';
import Dependency from './dependency';
import EventEmitter from 'events';

export interface TargetOptions {
	target: string;
	resourceHandler: ResourceHandler;
	context: Context;
}

export interface TargetParseOptions {
	disableLiteralsOptimization?: boolean;
	disableNamespacesOptimization?: boolean;
}

export interface TargetParseResultItem {
	chunk: ASTChunk;
	dependency: Dependency;
}

export interface TargetParseResult {
	main: TargetParseResultItem;
	nativeImports: Map<string, TargetParseResultItem>;
}

export default class Target extends EventEmitter {
	target: string;
	resourceHandler: ResourceHandler;
	context: Context;

	constructor(options: TargetOptions) {
		super();

		const me = this
		const resourceHandler = options.resourceHandler;

		if (!resourceHandler.has(options.target)) {
			throw new Error('Target ' + options.target + ' does not exist...'); 
		}

		me.target = resourceHandler.resolve(options.target);
		me.resourceHandler = resourceHandler;
		me.context = options.context;
	}

	parse(options: TargetParseOptions): TargetParseResult {
		const me = this;
		const resourceHandler = me.resourceHandler;
		const context = me.context;
		const content = resourceHandler.get(me.target);

		me.emit('parse-before', me.target);

		const parser = new Parser(content);
		const chunk = parser.parseChunk();
		let namespaces : Set<string> = new Set([...chunk.namespaces]);
		let literals = [].concat(chunk.literals);
		const nativeImports: Map<string, TargetParseResultItem> = new Map();

		for (const nativeImport of chunk.nativeImports) {
			const subTarget = resourceHandler.getTargetRelativeTo(me.target, nativeImport);
			const subContent = resourceHandler.get(subTarget);
			const subParser = new Parser(subContent);
			const subChunk = subParser.parseChunk();
			const subDependency = new Dependency({
				target: subTarget,
				resourceHandler,
				chunk: subChunk,
				context
			});
			subDependency.findDependencies();

			namespaces = new Set([...namespaces, ...subChunk.namespaces]);
			literals = literals.concat(subChunk.literals);

			nativeImports.set(nativeImport, {
				chunk: subChunk,
				dependency: subDependency
			});
		}

		if (!options.disableNamespacesOptimization) {
			namespaces.forEach((namespace: string) => context.variables.createNamespace(namespace));
		}

		if (!options.disableLiteralsOptimization) {
			literals.forEach((literal: ASTLiteral) => context.literals.add(literal));
		}

		const dependency = new Dependency({
			target: me.target,
			resourceHandler,
			chunk,
			context
		});
		dependency.findDependencies();

		return {
			main: {
				chunk,
				dependency
			},
			nativeImports
		};
	}
}