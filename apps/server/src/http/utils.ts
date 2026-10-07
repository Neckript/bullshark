import http from 'http';

class HttpValidationError extends Error {
  field: string;
  status: number;

  constructor(field: string, message: string, status = 400) {
    super(message);
    this.name = 'HttpValidationError';
    this.field = field;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Answers a request whose body may still be streaming in. The unread remainder
 * would be parsed as the next request on a keep-alive socket, so the connection
 * is closed once the response has flushed.
 */
const sendJsonAndCloseConnection = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  status: number,
  body: object
) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    Connection: 'close'
  });
  res.end(JSON.stringify(body), () => req.destroy());
};

export { HttpValidationError, sendJsonAndCloseConnection };
