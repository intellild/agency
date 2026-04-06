declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        type: string;
      };
    }
  }
}

export {};
