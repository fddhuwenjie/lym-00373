import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { Operation, CollaboratorCursor, WsMessage } from '../../shared/types';
import { WorkbookService } from '../services/workbookService';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedClient {
  ws: WebSocket;
  workbookId: number;
  userId: string;
  userName: string;
  color: string;
  lastActive: number;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#6366f1'
];

export class CollaborationServer {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private cursors: Map<number, Map<string, CollaboratorCursor>> = new Map();

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupHandlers();
    
    server.on('upgrade', (request, socket, head) => {
      const pathname = request.url || '';
      const match = pathname.match(/^\/ws\/workbooks\/(\d+)$/);
      
      if (!match) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      const workbookId = parseInt(match[1], 10);
      
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, workbookId);
      });
    });
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, _request, workbookId: number) => {
      const clientId = uuidv4();
      const colorIndex = this.clients.size % COLORS.length;
      
      const client: ConnectedClient = {
        ws,
        workbookId,
        userId: clientId,
        userName: `User ${this.clients.size + 1}`,
        color: COLORS[colorIndex],
        lastActive: Date.now()
      };

      this.clients.set(clientId, client);
      
      if (!this.cursors.has(workbookId)) {
        this.cursors.set(workbookId, new Map());
      }

      this.send(ws, {
        type: 'welcome',
        payload: {
          userId: clientId,
          userName: client.userName,
          color: client.color,
          collaborators: this.getCollaborators(workbookId, clientId)
        }
      });

      this.broadcast(workbookId, {
        type: 'hello',
        payload: {
          userId: clientId,
          userName: client.userName,
          color: client.color
        }
      }, clientId);

      ws.on('message', (data) => {
        try {
          const message: WsMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(clientId);
      });
    });
  }

  private handleMessage(clientId: string, message: WsMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActive = Date.now();

    switch (message.type) {
      case 'operation':
        this.handleOperation(clientId, message.payload as unknown as Operation);
        break;
      case 'cursor':
        this.handleCursor(clientId, message.payload as { sheetId: string; cellId: string });
        break;
      case 'sync':
        this.handleSync(clientId, message.payload as { version: number });
        break;
    }
  }

  private handleOperation(clientId: string, operation: Operation): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const maxLamportTime = WorkbookService.getMaxLamportTime(client.workbookId);
    operation.lamportTime = Math.max(operation.lamportTime || 0, maxLamportTime + 1);
    operation.userId = clientId;
    operation.userName = client.userName;
    operation.timestamp = Date.now();
    operation.id = operation.id || uuidv4();

    const currentVersion = WorkbookService.getVersion(client.workbookId);
    const version = currentVersion + 1;

    WorkbookService.createOperation({
      ...operation,
      workbookId: client.workbookId,
      version
    });
    WorkbookService.updateVersion(client.workbookId, version);

    this.broadcast(client.workbookId, {
      type: 'operation',
      payload: { ...operation, version }
    }, clientId);
  }

  private handleCursor(clientId: string, payload: { sheetId: string; cellId: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const workbookCursors = this.cursors.get(client.workbookId);
    if (!workbookCursors) return;

    const cursor: CollaboratorCursor = {
      userId: clientId,
      userName: client.userName,
      sheetId: payload.sheetId,
      cellId: payload.cellId,
      color: client.color,
      lastActive: Date.now()
    };

    workbookCursors.set(clientId, cursor);

    this.broadcast(client.workbookId, {
      type: 'cursor',
      payload: cursor as unknown as Record<string, unknown>
    }, clientId);
  }

  private handleSync(clientId: string, payload: { version: number }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const operations = WorkbookService.getOperationsSince(client.workbookId, payload.version);
    
    this.send(client.ws, {
      type: 'sync',
      payload: {
        version: WorkbookService.getVersion(client.workbookId),
        operations
      }
    });
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    
    const workbookCursors = this.cursors.get(client.workbookId);
    if (workbookCursors) {
      workbookCursors.delete(clientId);
    }

    this.broadcast(client.workbookId, {
      type: 'hello',
      payload: {
        userId: clientId,
        userName: client.userName,
        color: client.color,
        disconnected: true
      }
    });
  }

  private send(ws: WebSocket, message: WsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(workbookId: number, message: WsMessage, excludeClientId?: string): void {
    for (const [clientId, client] of this.clients) {
      if (client.workbookId === workbookId && clientId !== excludeClientId) {
        this.send(client.ws, message);
      }
    }
  }

  private getCollaborators(workbookId: number, excludeClientId: string): CollaboratorCursor[] {
    const collaborators: CollaboratorCursor[] = [];
    const workbookCursors = this.cursors.get(workbookId);
    
    for (const [clientId, client] of this.clients) {
      if (client.workbookId === workbookId && clientId !== excludeClientId) {
        const cursor = workbookCursors?.get(clientId);
        collaborators.push({
          userId: clientId,
          userName: client.userName,
          sheetId: cursor?.sheetId || '',
          cellId: cursor?.cellId || '',
          color: client.color,
          lastActive: client.lastActive
        });
      }
    }
    
    return collaborators;
  }

  public close(): void {
    this.wss.close();
  }
}
