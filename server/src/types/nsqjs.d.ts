declare module 'nsqjs' {
  import { EventEmitter } from 'events';

  export class Writer extends EventEmitter {
    constructor(host: string, port: number, options?: any);
    connect(): void;
    close(): void;
    publish(topic: string, data: string | Buffer, callback?: (err: Error | null) => void): void;
    on(event: 'ready', listener: () => void): this;
    on(event: 'closed', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export class Reader extends EventEmitter {
    constructor(topic: string, channel: string, options?: any);
    connect(): void;
    close(): void;
    on(event: 'message', listener: (msg: Message) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'nsqd_connected', listener: (host: string, port: number) => void): this;
    on(event: 'nsqd_closed', listener: (host: string, port: number) => void): this;
  }

  export interface Message {
    id: string;
    body: Buffer;
    attempts: number;
    timestamp: number;
    finish(): void;
    requeue(delay?: number, backoff?: boolean): void;
    touch(): void;
    json(): any;
  }
}
