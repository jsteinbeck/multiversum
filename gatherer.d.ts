
import { PluginHost } from "./host";

/**
 * A Component instance.
 */
export interface Component {
    [index: string]: Function;
    
    /**
     * Initializes the component. Will be called by the application.
     */
    init?(): void;
    
    /**
     * Destroys the component and releases its resources. Will be called by the application.
     */
    destroy?(): void;
}

/**
 * Configuration object for creating a Gatherer instance.
 */
export interface GathererConfig {
    [index: string]: any;
    
    /**
     * A list of file (glob) patterns for component definition files.
     */
    patterns: Array<string>;
    
    /**
     * Filters the gathered component definitions. If it returns `true` the component
     * will be used, if it returns `false` the component will be discarded.
     * 
     * @param component The component definition to check
     * @param filePath The component definition's path
     * @param config The current gatherer config
     */
    filter?(component: ComponentDefinition, filePath?: string, config?: GathererConfig) : boolean;
}

/**
 * An object defining a component through its meta data. This data is usually taken
 * from a component definition file (JSON format).
 */
export interface ComponentDefinition {
    
    /**
     * The name of the component.
     */
    name: string;
    
    /**
     * The components version (uses semantic versioning).
     */
    version?: string;
    
    /**
     * Creates the component.
     * 
     * @param context The context (PluginHost instance) for the component
     */
    create(context?: PluginHost) : Component;
    
    /**
     * The name of the application this component is intended to be used with.
     */
    application?: string;
    
    /**
     * A semantic versioning comparator of application versions supported by the component.
     */
    applicationVersion?: string;
    
    /**
     * An array of application steps/phases the component can be used at. This can be used,
     * for example, to make sure a component is used only in the CLI part of a software project,
     * but not in the server part.
     */
    applicationSteps?: Array<string>;
}

/**
 * An object mapping component names to component definitions.
 */
export interface ComponentList {
    [index: string]: ComponentDefinition;
}

/**
 * Multiversum component definition gatherer.
 */
export interface GathererComponent extends Component {
    
    /**
     * Initializes the gatherer.
     */
    init(): void;
    
    /**
     * Destroys the gatherer and releases its resources.
     */
    destroy(): void;
    
    /**
     * Finds all component definition files in the supplied `rootDirs` and returns their
     * contents as a ComponentList.
     * 
     * @param rootDirs List of directories containing component definition files
     * @param config Gatherer configuration
     */
    gather(rootDirs: Array<string>, config?: GathererConfig): ComponentList;
    
    /**
     * Finds all component definition files in a directory and returns an array containing
     * the paths to the found definition files.
     * 
     * @param rootDir Path to the directory to check for component definition files
     * @param config Gatherer configuration
     */
    gatherFileNames(rootDir: string, config?: GathererConfig): Array<string>;
    
    /**
     * Takes a component definition object with a `file` property and returns a component
     * definition where the `file` property has been resolved as a `create` function that
     * initializes the component when called.
     * 
     * @param definition A component definition object
     */
    resolveComponent(definition: ComponentDefinition) : ComponentDefinition;
    
    /**
     * Resolves a list of components. See `resolveComponent(defintion)`.
     * 
     * @param list A list of component definitions
     */
    resolveComponents(list: ComponentList): ComponentList;
}

/**
 * Creates a Multiversum component gatherer instance.
 * 
 * @param context A plugin host
 */
export function create(context: PluginHost) : GathererComponent;
