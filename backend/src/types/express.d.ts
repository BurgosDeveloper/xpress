declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: "USER" | "DRIVER" | "ADMIN";
      };
    }
  }
}

export {};
