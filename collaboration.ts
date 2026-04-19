import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

export interface CollaborationEvent {
  type: "card_moved" | "card_created" | "card_updated" | "card_deleted" | "user_joined" | "user_left" | "cursor_moved";
  boardId: number;
  userId: number;
  userName: string;
  data?: any;
  timestamp: Date;
}

export interface UserPresence {
  userId: number;
  userName: string;
  boardId: number;
  cursorPosition?: { x: number; y: number };
  lastActivity: Date;
}

/**
 * Real-time collaboration service using Socket.IO
 * Handles live updates, cursor tracking, and user presence across Kanban boards
 */
export class CollaborationService {
  private io: SocketIOServer | null = null;
  private userPresence: Map<string, UserPresence> = new Map();

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // Configure based on environment
        methods: ["GET", "POST"],
      },
      path: "/api/socket.io",
    });

    this.setupEventHandlers();
    console.log("[Collaboration] Socket.IO server initialized");
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on("connection", (socket) => {
      console.log(`[Collaboration] Client connected: ${socket.id}`);

      // Join board room
      socket.on("join_board", (data: { boardId: number; userId: number; userName: string }) => {
        const { boardId, userId, userName } = data;
        const roomName = `board:${boardId}`;
        
        socket.join(roomName);
        
        // Track user presence
        const presence: UserPresence = {
          userId,
          userName,
          boardId,
          lastActivity: new Date(),
        };
        this.userPresence.set(socket.id, presence);

        // Notify others
        const event: CollaborationEvent = {
          type: "user_joined",
          boardId,
          userId,
          userName,
          timestamp: new Date(),
        };
        socket.to(roomName).emit("collaboration_event", event);

        // Send current users in the board
        const boardUsers = this.getUsersInBoard(boardId);
        socket.emit("board_users", boardUsers);

        console.log(`[Collaboration] User ${userName} joined board ${boardId}`);
      });

      // Leave board room
      socket.on("leave_board", (data: { boardId: number }) => {
        const { boardId } = data;
        const roomName = `board:${boardId}`;
        const presence = this.userPresence.get(socket.id);

        if (presence) {
          socket.leave(roomName);
          
          const event: CollaborationEvent = {
            type: "user_left",
            boardId,
            userId: presence.userId,
            userName: presence.userName,
            timestamp: new Date(),
          };
          socket.to(roomName).emit("collaboration_event", event);

          this.userPresence.delete(socket.id);
          console.log(`[Collaboration] User ${presence.userName} left board ${boardId}`);
        }
      });

      // Cursor movement
      socket.on("cursor_move", (data: { boardId: number; x: number; y: number }) => {
        const { boardId, x, y } = data;
        const presence = this.userPresence.get(socket.id);

        if (presence) {
          presence.cursorPosition = { x, y };
          presence.lastActivity = new Date();

          const event: CollaborationEvent = {
            type: "cursor_moved",
            boardId,
            userId: presence.userId,
            userName: presence.userName,
            data: { x, y },
            timestamp: new Date(),
          };

          socket.to(`board:${boardId}`).emit("collaboration_event", event);
        }
      });

      // Card moved
      socket.on("card_moved", (data: { boardId: number; cardId: number; targetColumnId: number }) => {
        const presence = this.userPresence.get(socket.id);
        if (presence) {
          const event: CollaborationEvent = {
            type: "card_moved",
            boardId: data.boardId,
            userId: presence.userId,
            userName: presence.userName,
            data: { cardId: data.cardId, targetColumnId: data.targetColumnId },
            timestamp: new Date(),
          };

          socket.to(`board:${data.boardId}`).emit("collaboration_event", event);
        }
      });

      // Card created
      socket.on("card_created", (data: { boardId: number; card: any }) => {
        const presence = this.userPresence.get(socket.id);
        if (presence) {
          const event: CollaborationEvent = {
            type: "card_created",
            boardId: data.boardId,
            userId: presence.userId,
            userName: presence.userName,
            data: { card: data.card },
            timestamp: new Date(),
          };

          socket.to(`board:${data.boardId}`).emit("collaboration_event", event);
        }
      });

      // Card updated
      socket.on("card_updated", (data: { boardId: number; cardId: number; updates: any }) => {
        const presence = this.userPresence.get(socket.id);
        if (presence) {
          const event: CollaborationEvent = {
            type: "card_updated",
            boardId: data.boardId,
            userId: presence.userId,
            userName: presence.userName,
            data: { cardId: data.cardId, updates: data.updates },
            timestamp: new Date(),
          };

          socket.to(`board:${data.boardId}`).emit("collaboration_event", event);
        }
      });

      // Card deleted
      socket.on("card_deleted", (data: { boardId: number; cardId: number }) => {
        const presence = this.userPresence.get(socket.id);
        if (presence) {
          const event: CollaborationEvent = {
            type: "card_deleted",
            boardId: data.boardId,
            userId: presence.userId,
            userName: presence.userName,
            data: { cardId: data.cardId },
            timestamp: new Date(),
          };

          socket.to(`board:${data.boardId}`).emit("collaboration_event", event);
        }
      });

      // Disconnect
      socket.on("disconnect", () => {
        const presence = this.userPresence.get(socket.id);
        if (presence) {
          const event: CollaborationEvent = {
            type: "user_left",
            boardId: presence.boardId,
            userId: presence.userId,
            userName: presence.userName,
            timestamp: new Date(),
          };

          socket.to(`board:${presence.boardId}`).emit("collaboration_event", event);
          this.userPresence.delete(socket.id);
        }

        console.log(`[Collaboration] Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Get all users currently in a board
   */
  private getUsersInBoard(boardId: number): UserPresence[] {
    const users: UserPresence[] = [];
    this.userPresence.forEach((presence) => {
      if (presence.boardId === boardId) {
        users.push(presence);
      }
    });
    return users;
  }

  /**
   * Broadcast event to all users in a board
   */
  broadcastToBoard(boardId: number, event: CollaborationEvent) {
    if (this.io) {
      this.io.to(`board:${boardId}`).emit("collaboration_event", event);
    }
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

// Export singleton instance
export const collaborationService = new CollaborationService();
