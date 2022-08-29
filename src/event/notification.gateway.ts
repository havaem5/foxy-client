import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse } from '@nestjs/websockets';
import { Model } from 'mongoose';

import { Server, Socket } from 'socket.io';
import { User, UserDocument } from 'src/schemas/user.schema';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'notifications',
})
export class NotificationGateway {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>, private jwtService: JwtService) {}
    @WebSocketServer()
    server: Server;
    users: ISocketUser[] = [];

    verifyToken(client: Socket) {
        if (client.handshake.headers.authorization && client.handshake.headers.authorization.split(' ')[1] !== 'null') {
            return this.jwtService.verify(client.handshake.headers.authorization.split(' ')[1], {
                secret: process.env.JWT_SECRET,
            })._id;
        }
        return null;
    }

    async handleConnection(client: Socket) {
        const userId = this.verifyToken(client);
        if (userId) {
            this.server.emit(`online/${userId}`, {
                status: true,
                data: null,
            });
            const isExist = this.users.find((item) => item.user === userId);
            if (!isExist) {
                this.users.push({ user: userId, id: [client.id] });
            } else {
                isExist.id.push(client.id);
            }
        }
    }

    async handleDisconnect(client: Socket) {
        const user = this.users.find((u) => u.id.includes(client.id));
        if (user) {
            if (user.id.length === 1) {
                const response = await this.userModel.findByIdAndUpdate(
                    user.user,
                    {
                        lastLogin: new Date().toISOString(),
                    },
                    { new: true },
                );
                this.users = this.users.filter((u) => u.user !== user.user);
                this.server.emit(`online/${user.user}`, {
                    status: false,
                    data: response.lastLogin,
                });
            } else {
                user.id = user.id.filter((id) => id !== client.id);
            }
        }
    }

    @SubscribeMessage('online')
    checkOnLine(@MessageBody() userId: string): WsResponse<any> {
        return {
            event: 'online',
            data: { status: !!this.users.find((item) => item.user === userId), data: null, userId },
        };
    }

    sendNotification(userId: string, data: any, type: 'notification' | 'message') {
        if (this.users.find((item) => item.user === userId)) {
            this.server.emit(userId, {
                type,
                data: data,
            });
        }
    }

    @SubscribeMessage('identity')
    async identity(@MessageBody() data: number): Promise<number> {
        return data;
    }
}
