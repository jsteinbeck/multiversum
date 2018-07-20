
import { ChannelFacade } from "./host";
import { ComponentDefinition } from "./gatherer";

/**
 * A Multiversum application instance.
 */
export interface Application extends ChannelFacade {
    
    /**
     * Broadcasts a message to all listeners subscribed for the `messageName`.
     * 
     * @param messageName Name of the message to be published
     * @param data Optional payload for the message
     */
    publish(messageName: string, data?: any): void;
    
    /**
     * Subscribes listener `fn` to message `messageName`.
     * 
     * @param messageName Name of the message that the listener shall be subscribed to
     * @param fn A callback function as listener
     */
    subscribe(messageName: string, fn: Function): void;
    
    /**
     * Unsubscribes listener `fn` from message `messageName`.
     * 
     * @param messageName Name of the message that the listener shall be unsubscribed from
     * @param fn The subscribed listener callback
     */
    unsubscribe(messageName: string, fn: Function): void;
    
    /**
     * Subscribes listener `fn` to message `messageName` and removes it after the first
     * time the message has been published.
     * 
     * @param messageName Name of the message that the listener shall be subscribed to
     * @param fn A callback function as listener
     */
    once(messageName: string, fn: Function): void;
    
    /**
     * Initializes the application and all added components. The components are sorted
     * using a dependency graph so that they can be initialized in the correct order.
     */
    init(): void;
    
    /**
     * Releases all resources and calls the `.destroy()` method on all components that have it.
     * Once this method has been called, the app is no longer usable.
     */
    destroy(): void;
    
    /**
     * Adds a component to the app. If the app has already been initialized using `.init()`,
     * the component will be initialized immediately. Otherwise, the component will be
     * initialized along with all other added components when the `.init()` method is called.
     * 
     * @param component A component definition
     */
    addComponent(component: ComponentDefinition): void;
    
    /**
     * Removes a component from the application. Calls the component's `.destroy()` method
     * if it exists.
     * 
     * @param component A component definition
     */
    removeComponent(component: ComponentDefinition): void;
    
    /**
     * Returns `true` when a component with the supplied name and version number is registered
     * with the application.
     * 
     * @param name The name of the component to check
     * @param version The version of the component
     */
    hasComponent(name: string, version: string): boolean;
}

/**
 * Creates a new Multiversum application instance.
 */
export function create(): Application;
