import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';
import productsRouter from './routes/products.js';
import shipmentsRouter from './routes/shipments.js';
import overviewRouter from './routes/overview.js';
import authRouter from './routes/auth.js';
import brandsRouter from './routes/brands.js';

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/brands', brandsRouter);
app.use('/products', productsRouter);
app.use('/shipments', shipmentsRouter);
app.use('/overview', overviewRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation error', errors: err.issues });
  }

  if (err instanceof Error) {
    return res.status(500).json({ message: err.message });
  }

  return res.status(500).json({ message: 'Unknown server error' });
});
