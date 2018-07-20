
export interface DecoratorFunction {
    (fn: Function): Function;
}

export interface DecoratorConfig {
    priority?: number;
    onError?: Function;
}

export interface ChannelConfig {
    priority?: number;
    onError?: Function;
}

export interface ChannelCollection {
    [index: string]: Function;
    [index: string]: Array<any>;
}

export interface ChannelObject {
    call(...args): any;
    onError(listener: Function) : ChannelObject; 
}

export interface ChannelFacade {
    [index: string]: Function;
}

export interface ChannelFacadeMapping {
    [index: string]: string;
}

export interface ChannelInterface {
    [index: string]: Function;
}

export interface ChannelInterfaceClient extends ChannelInterface {
    [index: string]: Function;
}

export interface ChannelInterfaceDefinition extends ChannelInterface {
    [index: string]: Function;
}

/**
 * A plugin host instance.
 */
export interface PluginHost {
    
    /**
     * Destroys the PluginHost instance and releases its resources.
     */
    destroy(): void;
    
    /**
     * Subscribes a listener to a message.
     * 
     * @param messageName The name of the message.
     * @param fn The listener that should be subscribed.
     */
    on(messageName: string, fn: Function): void;
    
    /**
     * Alias for `on`.
     * 
     * @param messageName The name of the message.
     * @param fn The subscribed listener.
     */
    subscribe(messageName: string, fn: Function): void;
    
    /**
     * Subscribes a listener to a message and removes the listeners after the first
     * the first message received.
     * 
     * @param messageName The name of the message.
     * @param fn The listener that should be subscribed.
     */
    once(messageName: string, fn: Function): void;
    
    /**
     * Removes a listener from a message.
     * 
     * @param messageName The name of the message.
     * @param fn The subscribed listener.
     */
    removeListener(messageName: string, fn: Function): void;
    
    /**
     * Alias for `removeListener`.
     * 
     * @param messageName The name of the message.
     * @param fn The subscribed listener.
     */
    unsubscribe(messageName: string, fn: Function): void;
    
    /**
     * Publishes a message on the plugin host.
     * 
     * @param messageName The name of the message.
     * @param data Optional payload.
     */
    publish(messageName: string, data?: any) : void;
    
    /**
     * Connects a listener to a channel.
     * 
     * @param channel The name of the channel.
     * @param fn A listener function.
     * @param config An optional config object.
     */
    connect(channel: string, fn: Function, config?: ChannelConfig): void;
    
    /**
     * Connects many implementations to channels.
     * 
     * @param implementations An object that maps channel names to implementation functions.
     */
    connectMany(implementations: ChannelCollection): void;
    
    /**
     * Disconnects an implementation from a channel.
     * 
     * @param channel The name of the channel to subscribe to.
     * @param fn The implementation function that gets subscribed to the channel.
     */
    disconnect(channel: string, fn: Function): void;
    
    /**
     * Decorates a channel.
     * 
     * @param channel The name of the channel that shall be decorated.
     * @param fn A decorator function that takes a function and wraps it in another function.
     * @param config An optional DecoratorConfig object.
     */
    decorate(channel: string, fn: DecoratorFunction, config?: DecoratorConfig): void;
    
    /**
     * Decorates *all* channels.
     */
    decorate(fn: DecoratorFunction, config?: DecoratorConfig): void;
    
    /**
     * Removes a decorator function from a channel.
     * 
     * @param channel Name of the channel
     * @param fn The decorator function
     */
    removeDecorator(channel: string, fn: DecoratorFunction): void;
    channel(channelName: string): ChannelObject;
    isChannel(thing: any): boolean;
    isChannelObject(thing: any): boolean;
    call(channel: string, args?: Array, onError?: Function): any;
    isFacade(thing: any): boolean;
    createFacade(methods: ChannelFacadeMapping): ChannelFacade;
    isInterface(thing: any): boolean;
    isInterfaceClient(thing: any): boolean;
    isInterfaceDefinition(thing: any): boolean;
    getInterface(name: string, methodNames: Array<string>): ChannelInterfaceClient;
    createInterface(name: string, methods: ChannelCollection): ChannelInterfaceDefinition;
    connectInterface(iface: ChannelInterfaceDefinition): void;
    disconnectInterface(iface: ChannelInterfaceDefinition): void;
}

export function create() : PluginHost;
