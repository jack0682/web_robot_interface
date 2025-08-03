// paho-mqtt 타입 정의
declare module 'paho-mqtt' {
  export class Client {
    constructor(host: string, port: number, path: string, clientId: string);
    
    onConnected?: () => void;
    onConnectionLost?: (responseObject: any) => void;
    onMessageArrived?: (message: Message) => void;
    
    connect(options: any): void;
    disconnect(): void;
    subscribe(topic: string, options?: any): void;
    unsubscribe(topic: string, options?: any): void;
    send(message: Message): void;
  }
  
  export class Message {
    constructor(payload: string);
    destinationName: string;
    payloadString: string;
    qos: number;
    retained: boolean;
  }
}