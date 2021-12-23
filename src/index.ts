import { ASTBase } from 'greybel-core';
import Context from './context';
import generateCharsetMap from './utils/charset-generator';
import { ResourceProvider, ResourceHandler } from './resource';
import Target, { TargetParseResult, TargetParseResultItem } from './target';
import Transformer, { TransformerDataObject } from './transformer';
import Dependency from './dependency';
import {
	HEADER_BOILERPLATE,
	MODULE_BOILERPLATE,
	MAIN_BOILERPLATE
} from './boilerplates';
import defaultFactory, { BuildMap } from './build-map/default';
import uglifyFactory from './build-map/uglify';

export interface TranspilerOptions {
	target?: string;
	output?: string;
	name?: string;
	context?: Context;

	obfuscation?: boolean;
	uglify?: boolean;
	installer?: boolean;
	excludedNamespaces?: string[];
	disableLiteralsOptimization?: boolean;
	disableNamespacesOptimization?: boolean;

	resourceHandler?: ResourceHandler;
}

export interface TranspilerParseResult {
	[key: string]: string
}

export default class Transpiler {
	target: string;
	context: Context;
	resourceHandler: ResourceHandler;

	obfuscation: boolean;
	uglify: boolean;
	installer: boolean;
	disableLiteralsOptimization: boolean;
	disableNamespacesOptimization: boolean;

	constructor(options: TranspilerOptions) {
		const me = this;

		me.target = options.target;
		me.resourceHandler = options.resourceHandler || new ResourceProvider().getHandler();
		
		const charsetMap = generateCharsetMap(options.obfuscation);

		me.context = new Context({
			variablesCharset: charsetMap.variables,
			variablesExcluded: options.excludedNamespaces,
			modulesCharset: charsetMap.modules
		});

		me.obfuscation = options.obfuscation || true;
		me.uglify = options.uglify || false;
		me.installer = options.installer || false;
		me.disableLiteralsOptimization = options.disableLiteralsOptimization || false;
		me.disableNamespacesOptimization = options.disableNamespacesOptimization || false;
	}

	getBuildMapFactory(): (
		make: (item: ASTBase, _data: TransformerDataObject) => string,
		context: Context
	) => BuildMap {
		const me = this;
		return me.uglify ? uglifyFactory : defaultFactory;
	}

	parse(): TranspilerParseResult {
		const me = this;
		const mapFactory = me.getBuildMapFactory();
		const context = me.context;
		const target = new Target({
			target: me.target,
			resourceHandler: me.resourceHandler,
			context: me.context
		});
		const targetParseResult: TargetParseResult = target.parse({
			disableLiteralsOptimization: me.disableLiteralsOptimization,
			disableNamespacesOptimization: me.disableNamespacesOptimization
		});

		//create builder
		const tempVarForGlobal = context.variables.createNamespace('globals');
		const transformer = new Transformer(mapFactory, context);
		const mainModule = targetParseResult.main;
		const mainModuleName = context.modules.get(mainModule.dependency.getId());
		const headerBoilerplate = transformer.transform(HEADER_BOILERPLATE);
		const moduleBoilerplate = transformer.transform(MODULE_BOILERPLATE);
		const mainBoilerplate = transformer.transform(MAIN_BOILERPLATE);
		const build = (
			mainDependency: Dependency,
			optimizeLiterals: boolean,
			isNativeImport: boolean
		): string => {
			const modules: { [key: string]: string } = {};
			const iterator = function(item: Dependency) {
				const moduleName = context.modules.get(item.getId());
				let dependency;

				if (moduleName in modules) return;
				if (moduleName != mainModuleName && !item.isInclude) {
					const code = transformer.transform(item.chunk);
					modules[moduleName] = moduleBoilerplate
						.replace('"$0"', '"' + moduleName + '"')
						.replace('"$1"', code);
				}
				
				item.dependencies.forEach(iterator);
			};

			iterator(mainDependency);

			const processed = [];

			if (!isNativeImport) {
				if (optimizeLiterals) {
					const literalMapping = context.literals.getMapping();

					processed.push('globals.' + tempVarForGlobal + '=globals');

					Object.values(literalMapping).forEach(function(literal) {
						if (literal.namespace == null) return;
						processed.push(tempVarForGlobal + '.' + literal.namespace + '=' + literal.literal.raw);
					});
				}
			
				processed.push(headerBoilerplate);
			}

			Object.keys(modules).forEach((moduleKey: string) => processed.push(modules[moduleKey]));
			
			const code = transformer.transform(mainDependency.chunk);

			if (isNativeImport) {
				processed.push(code);
			} else {
				const moduleCode = mainBoilerplate.replace('"$0"', code);
				processed.push(moduleCode);
			}
		
			return processed.join('\n');
		};

		return {
			[mainModuleName]: build(
				mainModule.dependency,
				!me.disableLiteralsOptimization,
				false
			),
			...Object.values(targetParseResult.nativeImports).reduce((
				result: TranspilerParseResult,
				value: TargetParseResultItem
			) => {
				return {
					...result,
					[value.dependency.target]: build(
						value.dependency,
						!me.disableLiteralsOptimization,
						true
					)
				};
			}, {})
		};
	}
}