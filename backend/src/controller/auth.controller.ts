import 'reflect-metadata';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entity/user.entity';
import logger from '../utils/logger';
import { z } from 'zod';

const router = Router();

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/^\S+$/, "Password must not contain spaces")
  .regex(/\p{Ll}/u, "Must include at least one lowercase letter")
  .regex(/\p{Lu}/u, "Must include at least one uppercase letter")
  .regex(/\p{Nd}/u, "Must include at least one digit");

const generateTokens = (userId: string, username: string) => {
  const accessToken = jwt.sign(
    { userId, username },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, username },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const checkPasswordParse = passwordSchema.safeParse(password);

    if (!checkPasswordParse.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: checkPasswordParse.error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }
    
    const userRepository = AppDataSource.getRepository(User);
    const existingUser = await userRepository.findOne({ where: { username } });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepository.create({
      username,
      passwordHash
    });
    
    await userRepository.save(user);
    
    const { accessToken, refreshToken } = generateTokens(user.id, user.username);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
    logger.info(`User registered: ${username}`);
    
    const {id, passwordHash: passwrdHash, ...userWithoutPassword} = user;
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(`SET app.current_user_id = $1`, [id]);
    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword,
      accessToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { username } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user.id, user.username);
    
    logger.info(`User logged in: ${username}`);
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(`SET app.current_user_id = $1`, [user.id]);
    const {passwordHash, ...userWithoutPassword} = user;
    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // In a production app, you would blacklist the refresh token
      // For now, we'll just return success
      logger.info('User logged out');
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
