declare enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    AUDIO = 'audio',
}
declare interface iMessageCreate {
    idReceive: string;
    messages: [
        {
            type: MessageType;
            value: string;
        },
    ];
    exp: number;
}
