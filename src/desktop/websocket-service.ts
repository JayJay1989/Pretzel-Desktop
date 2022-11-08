import { StreamDeckAction } from '../desktop-integration';
// @ts-ignore
import express, { Express } from 'express';
import { createServer, Server as HttpServer, IncomingMessage } from 'http';
// @ts-ignore
import WebSocket, { Server as WssServer } from 'ws';

export default class WebSocketServerService {
  private expressApp: Express;
  private httpServer: HttpServer;
  private port: number;
  private wss: WssServer;

  public playerClient: WebSocket = null;
  public streamDeckClients: WebSocket[] = [];

  public constructor(port: number) {
    this.port = port;
    this.expressApp = express();
    this.httpServer = createServer(this.expressApp);
    this.wss = new WssServer({ server: this.httpServer });
    this.httpServer.listen(this.port);

    this.wss.on('connection', (webSocket: WebSocket, request: IncomingMessage) => {
      const urlSearchParams = new URLSearchParams(request.url.split('?')[1]);

      if (urlSearchParams.has('client') && urlSearchParams.get('client') === 'player') {
        this.initPlayerConnection(webSocket);
      } else if (urlSearchParams.has('client') && urlSearchParams.get('client') === 'streamdeck') {
        this.initStreamDeckConnection(webSocket);
      } else {
        throw Error('Invalid WebSocket client.');
      }
    });
  }

  public close(): void {
    this.wss.close();
    this.httpServer.close();
  }

  private initPlayerConnection(webSocket: WebSocket): void {
    this.playerClient = webSocket;

    this.playerClient.on('message', (message: string): void => {
      this.streamDeckClients.forEach((client: WebSocket): void => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    });
  }

  private initStreamDeckConnection(webSocket: WebSocket): void {
    this.streamDeckClients.push(webSocket);

    webSocket.on('close', (): void => {
      this.playerClient?.send(
        JSON.stringify({
          action: StreamDeckAction.StreamDeckDisconnected,
        })
      );
    });

    webSocket.on('message', (message: string): void => {
      this.playerClient?.send(message.toString());
    });

    this.playerClient?.send(
      JSON.stringify({
        action: StreamDeckAction.StreamDeckConnected,
      })
    );
  }
}
