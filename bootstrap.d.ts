
import { GathererConfig, ComponentList, GathererComponent } from "./gatherer";
import { Application } from "./app";

/**
 * Bootstraps an application by configuring and using a gatherer instance and adding
 * all components that match the specified criteria.
 * 
 * @param rootDirs An array paths of directories containing components
 * @param config A configuration object specializing the bootstrap process
 */
export function bootstrap(rootDirs: Array<string>, config: GathererConfig): Application;
