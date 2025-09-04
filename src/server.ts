import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import contactRouter from './routes/contact';
import subscribeRouter from './routes/subscribe';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// parse allowed origins once (trim items)
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS ?? '*';
const allowedOrigins = allowedOriginsEnv === '*' 
  ? ['*'] 
  : allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));

// use cors middleware
app.use(cors({
  origin: (origin, callback) => {
    // If no origin (curl/server or same origin), allow it
    if (!origin) return callback(null, true);

    // allow wildcard '*' (no credentials)
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // reject
    return callback(new Error(`CORS blocked by allowedOrigins: ${origin}`));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 204, // for legacy browsers
  // credentials: true, // enable only if you need cookies/auth; then do not use '*' origin
}));

// basic rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', contactRouter);
app.use('/api', subscribeRouter);

// error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
});

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('🚀 Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Needed for Vercel to use this file as an API handler
export default app;