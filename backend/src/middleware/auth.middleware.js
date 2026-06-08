import dotenv from 'dotenv';
import logger from '../config/logger.js';
import { supabaseAdmin } from '../config/supabase.js';

dotenv.config();

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Token is empty' });
    }

    // Verify token using Supabase Auth service (no JWT Secret needed)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      logger.warn(`Failed token verification attempt: ${error ? error.message : 'No user returned'}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach user payload to request
    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    logger.error(`Error in authMiddleware: ${error.message}`);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
