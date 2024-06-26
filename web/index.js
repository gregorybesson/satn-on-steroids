// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import cookieParser from "cookie-parser";
import { Shopify, LATEST_API_VERSION } from "@shopify/shopify-api";

import applyAuthMiddleware from "./middleware/auth.js";
import verifyRequest from "./middleware/verify-request.js";
import { setupGDPRWebHooks } from "./gdpr.js";
import productCreator from "./helpers/product-creator.js";
import redirectToAuth from "./helpers/redirect-to-auth.js";
import { BillingInterval } from "./helpers/ensure-billing.js";
import { AppInstallations } from "./app_installations.js";

// SATN
import { dynamo, DynamoSessionStorage } from 'satn-aws-wrapper';
import * as cacheProvider from "satn-cache-provider";
import serveStatic from "serve-static";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';
import * as winston from 'winston';
import * as Sentry from "@sentry/node";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.appRoot = path.resolve(__dirname);
// The DynamoDB table must be created the very first time the server is launched.
// If it already exists, it continues
await dynamo.createTable();
cacheProvider.start(function (err) {
  if (err) console.error(err);
});
const DEV_INDEX_PATH = `${process.cwd()}/../frontend/`;
const PROD_INDEX_PATH = `${process.cwd()}/../frontend/dist/`;
const isProd = process.env.NODE_ENV === "production";
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});
// /SATN

const USE_ONLINE_TOKENS = false;

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

// TODO: There should be provided by env vars
//const DEV_INDEX_PATH = `${process.cwd()}/frontend/`;
//const PROD_INDEX_PATH = `${process.cwd()}/frontend/dist/`;

const DB_PATH = `${process.cwd()}/database.sqlite`;

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https?:\/\//, ""),
  HOST_SCHEME: "https",
  API_VERSION: LATEST_API_VERSION,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: DynamoSessionStorage,
});

Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
  path: "/api/webhooks",
  webhookHandler: async (_topic, shop, _body) => {
    await AppInstallations.delete(shop);
  },
});

// The transactions with Shopify will always be marked as test transactions, unless NODE_ENV is production.
// See the ensureBilling helper to learn more about billing in this template.
const BILLING_SETTINGS = {
  required: false,
  // This is an example configuration that would do a one-time charge for $5 (only USD is currently supported)
  // chargeName: "My Shopify One-Time Charge",
  // amount: 5.0,
  // currencyCode: "USD",
  // interval: BillingInterval.OneTime,
};

// This sets up the mandatory GDPR webhooks. You’ll need to fill in the endpoint
// in the “GDPR mandatory webhooks” section in the “App setup” tab, and customize
// the code when you store customer data.
//
// More details can be found on shopify.dev:
// https://shopify.dev/apps/webhooks/configuration/mandatory-webhooks
setupGDPRWebHooks("/api/webhooks");

// SATN - We instantiate the webhooks from the module(s)
const modules = process.env.MODULES?.split(",") || [];
for (const module of modules) {
  const mod = await import(module);
  try {
    mod.webhooksInit();
    mod.cronInit();
  } catch (e) {
    console.log('webhooksInit error', e);
  }
};
if (!isProd) {
  const devmodules = process.env.DEV_MODULES?.split(",") || [];
  for (const devmodule of devmodules) {
    console.log('dev module:', devmodule);
    const mod = await import(`../app/${devmodule}/index.js`);
    try {
      mod.webhooksInit(Shopify);
      mod.cronInit();
    } catch (e) {
      console.log('error:', e);
    }
  };
}
// /SATN

// export for test use only
export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === "production",
  billingSettings = BILLING_SETTINGS
) {
  const app = express();
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
    ],
    tracesSampleRate: 1.0,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  app.set("use-online-tokens", USE_ONLINE_TOKENS);
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));

  applyAuthMiddleware(app, {
    billing: billingSettings,
  });

  // Do not call app.use(express.json()) before processing webhooks with
  // Shopify.Webhooks.Registry.process().
  // See https://github.com/Shopify/shopify-api-node/blob/main/docs/usage/webhooks.md#note-regarding-use-of-body-parsers
  // for more details.
  app.post("/api/webhooks", async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (e) {
      console.log(`Failed to process webhook: ${e.message}`);
      if (!res.headersSent) {
        res.status(500).send(e.message);
      }
    }
  });

  // All endpoints after this point will require an active session
  app.use(
    "/api/*",
    verifyRequest(app, {
      billing: billingSettings,
    })
  );

  app.get("/api/shop", async (req, res) => {
    //console.log('/api/shop');
    
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );

    res.json({
      shop: session?.shop
    });
  });

  app.get("/api/products/count", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    const { Product } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );

    const countData = await Product.count({ session });
    res.status(200).send(countData);
  });

  app.get("/api/products/create", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    let status = 200;
    let error = null;

    try {
      await productCreator(session);
    } catch (e) {
      console.log(`Failed to process products/create: ${e.message}`);
      status = 500;
      error = e.message;
    }
    res.status(status).send({ success: status === 200, error });
  });

  // All endpoints after this point will have access to a request.body
  // attribute, as a result of the express.json() middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // SATN
  const modules = process.env.MODULES?.split(",") || [];
  for (const module of modules) {
    const mod = await import(module);
    mod.shopifyInit();
    app.use(`/app/${module}/public`, serveStatic(`${process.cwd()}/node_modules/${module}/public/`, { index: false }));
    app.use('/app', mod.router);
    app.use(`/app/${module}/api/*`,verifyRequest(app, { billing: billingSettings}));
  };
  if (!isProd) {
    const devmodules = process.env.DEV_MODULES?.split(",") || [];
    for (const devmodule of devmodules) {
      console.log('dev module:', devmodule);
      const mod = await import(`../app/${devmodule}/index.js`);
      mod.shopifyInit();
      app.use(`/app/${devmodule}/public`, serveStatic(`${process.cwd()}/../app/${devmodule}/public/`, { index: false }));
      app.use('/app', mod.router);
      app.use(`/app/${devmodule}/api/*`,verifyRequest(app, { billing: billingSettings}));
    };
  }
  app.use('/public', serveStatic(`${process.cwd()}/public/`, { index: false }));
  // /SATN

  app.use((req, res, next) => {
    const shop = Shopify.Utils.sanitizeShop(req.query.shop);
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader(
        "Content-Security-Policy",
        `frame-ancestors https://${encodeURIComponent(
          shop
        )} https://admin.shopify.com;`
      );
    } else {
      res.setHeader("Content-Security-Policy", `frame-ancestors 'none';`);
    }
    next();
  });

  if (isProd) {
    const compression = await import("compression").then(
      ({ default: fn }) => fn
    );
    // const serveStatic = await import("serve-static").then(
    //   ({ default: fn }) => fn
    // );
    app.use(compression());
    app.use(serveStatic(PROD_INDEX_PATH, { index: false }));
  }

  app.use("/*", async (req, res, next) => {

    if (typeof req.query.shop !== "string") {
      res.status(500);
      return res.send("No shop provided sorry");
    }

    const shop = Shopify.Utils.sanitizeShop(req.query.shop);
    const appInstalled = await AppInstallations.includes(shop);

    if (!appInstalled) {
      return redirectToAuth(req, res, app);
    }

    if (Shopify.Context.IS_EMBEDDED_APP && req.query.embedded !== "1") {
      try {
        const embeddedUrl = Shopify.Utils.getEmbeddedAppUrl(req);

        return res.redirect(embeddedUrl + req.path);
      } catch (e) {
        console.log("TODO: handle error");
      }
    }

    const htmlFile = join(
      isProd ? PROD_INDEX_PATH : DEV_INDEX_PATH,
      "index.html"
    );

    return res
      .status(200)
      .set("Content-Type", "text/html")
      .send(readFileSync(htmlFile));
  });

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  return { app };
}

createServer().then(({ app }) => app.listen(PORT));
