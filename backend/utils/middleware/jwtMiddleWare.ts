import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

export const generateAccessToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
};

export const verifyToken = (token: string): object | string => {
  return jwt.verify(token, JWT_SECRET);
};

app.post('/login', (req: Request, res: Response) => {
  const user = { id: 1, username: 'john' }; // Example user

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set refresh token as HttpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  });

  res.json({ accessToken });
});

const jwtMiddleware = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      (req as any).user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ message: 'Invalid or expired access token' });
    }
  } else {
    return res.status(401).json({ message: 'Authorization header missing' });
  }
};

app.get('/protected', jwtMiddleware, (req: Request, res: Response) => {
  res.json({ message: 'You are authorized!', user: (req as any).user });
});

app.post('/refresh', (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing' });

  try {
    const decoded = verifyToken(refreshToken);
    const newAccessToken = generateAccessToken(decoded as object);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
