export type TTokenPayload = {
  userId: number;
  exp: number;
  // Optional because tokens minted before token revocation existed carry no
  // such claim. getUserByToken reads a missing claim as 0.
  tokenVersion?: number;
};

export type TConnectionInfo = {
  ip?: string;
  os?: string;
  device?: string;
  userAgent?: string;
};
