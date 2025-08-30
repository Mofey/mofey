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

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '*';
const allowedOrigins = allowedOriginsEnv === '*' ? [] : allowedOriginsEnv.split(',').map(s => s.trim());

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));

app.use(cors({
  origin: allowedOrigins.length ? (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server or same-origin
    if (allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  } : true
}));

// basic rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', contactRouter);
app.use('/api', subscribeRouter);

// error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
});

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('🚀 Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
