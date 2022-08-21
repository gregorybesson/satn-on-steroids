# SATN on Steroids

This project uses the last version of [Shopify App Template - Node](https://github.com/Shopify/shopify-app-template-node) and stay in sync with it.

For now, we use the most up to date branch : cli_three

And it adds extra features to make developing Shopify apps a breeze!

## Why Satn on Steroids?
Shopify App Template - Node based on cli 3 is a great project: It boosts your productivity and helps you to build Shopify apps in a breeze.
But there is a catch : As it is a template, it is not easy to update it when new features are added to the cli 3.

I've taken another route, while respecting the original project's philosophy : I've forked the project and I'm keeping it up to date with the latest features of the cli 3.
And I develop the Shopify app as a package !

Yes you read it right, I develop the Shopify app as a package, and I just have to add it to package.json in the web subdirectory. And everything works as expected: I can use the cli 3 to build, launch, deploy, etc. my app:

- The backend routes are discovered automatically.
- The frontend routes are discovered automatically.

I've also added features (see below) but I plan to put these features in their own package.

## How does it work?
### Backend
The `web/index.js` needs these 2 additions:
```
// SATN
  import serveStatic from "serve-static";
  import dotenv from "dotenv";
  import { DynamoSessionStorage } from "./dynamoSessionStorage/index.js";
  import * as db from "./database/index.js";
  import path from 'path';
  import { fileURLToPath } from 'url';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  global.appRoot = path.resolve(__dirname);
  dotenv.config();
  //import router from "geofilter";
  // The DynamoDB table must be created the very first time the server is launched.
  // If it already exists, it continues
  await db.createTable();
// /SATN
```

and
```
  // SATN
  const modules = process.env.MODULES.split(",")
  for (const module of modules) {
    const mod = await import(module);
    app.use('/app', mod.router);
    app.use(`/app/${module}/api/*`,verifyRequest(app, { billing: billingSettings}));
  };
  app.use('/public', serveStatic(`${process.cwd()}/public/`, { index: false }));
  // /SATN
```

- We need to add the `serve-static` middleware to serve a new /public route. This may be useful if you want to host files like images, pdf, etc.
- We add the dotenv package because we may need to use additional environment variables (see an example below).
```
SHOPIFY_API_KEY=xxx
SHOPIFY_API_SECRET=xxx
SCOPES=read_products,write_products,write_customers,write_draft_orders
HOST=livingcolor.ngrok.io
BACKEND_PORT=8081

WEBHOOKS=APP_UNINSTALLED
DATABASE=satn
S3BUCKET=shopify-satn

EMAIL_FROM="Starter" <gregory.besson@livingcolor.fr>
EMAIL_JOB_TO="Starter" <gregory.besson@livingcolor.fr>
EMAIL_CUSTOMER_SERVICE_TO="Customer service" <gregory.besson@livingcolor.fr>
EMAIL_BCC=gregory.besson@livingcolor.fr,gregory.besson+1@livingcolor.fr

# BILLING: choose between: NONE, ONE-TIME, SUBSCRIPTION, SUBSCRIPTION-NO-DEV (the dev store don't pay)
BILLING=NONE

# MODULES: list all modules to install
MODULES="geofilter"

...
```
- `DynamoSessionStorage` is our session storage adapter for DynamoDB. I plan to push a PR to Shopify so that they can include it in their project.
- db is the dynamodb database module. It is a simple wrapper around the AWS SDK.
- the following code is just to have the __dirname variable available + expose it as a global var to the packages you'll build
```
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.appRoot = path.resolve(__dirname);
```
- `await db.createTable();` is just there so that it creates the dynamoDB database the first time you launch the app.
- The following code is the secret sauce of Satn on Steroids: It allows you to add your own routes to the app. You just have to add the name of your package in the MODULES environment variable. And you can add as many packages as you want.
```
  const modules = process.env.MODULES.split(",")
  for (const module of modules) {
    const mod = await import(module);
    app.use('/app', mod.router);
  };
```

We've also added these directories (but plan to remove it progressively):
- `web/cacheProvider` : a cache provider for your apps
- `web/database` : the dynamoDB database module
- `web/dynamoSessionStorage` : the session storage adapter for DynamoDB
- `web/mail` : a mail module to send emails for your apps
- `web/public` : the public directory where you can host files like images, pdf, etc.
- `web/s3` : a s3 module to upload files to s3 for your apps

All of these wrappers will be moved to their own packages so that it doesn't pollute the web directory.

### Frontend
The `web/frontend/App.jsx` needs this addition:
```
let pages = import.meta.globEager("./pages/**/!(*.test.[jt]sx)*.([jt]sx)");

// SATN
let modulesPages = import.meta.globEager("./node_modules/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
pages = { ...modulesPages, ...pages };
const links = Object.keys(pages).filter(key => !key.includes('index') && !key.includes('NotFound')).map((key) => {
  let destination = key
    .replace(/\.\/node_modules\/(.*)\/frontend\/pages/, "")
    .replace("./pages", "")
    .replace(/\.(t|j)sx?$/, "")
  let label = destination
    .replace('/', '')
    .replace(/\b[a-z]/, (firstLetter) => firstLetter.toUpperCase())

  return {
    destination,
    label,
  }
});
// /SATN
```

- The following code searches for all the pages in the node_modules /frontend/pages directory and adds them to the pages object.
```
let modulesPages = import.meta.globEager("./node_modules/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
pages = { ...modulesPages, ...pages };
```

- The rest of the code will be used to generate the navigation menu.

The `web/frontend/Routes.jsx` needs this addition:
```
.map((key) => {
      let path = key
        .replace(/\.\/node_modules\/(.*)\/frontend\/pages/, "")   <=====
        .replace("./pages", "")
```
- This single line removes the undesirable part of the path of your Shopify app package.

For development, we need to add a line to the proxy filter in `web/frontend/vite.config.js`:
```
proxy: {
  "^/(\\?.*)?$": proxyOptions,
  "^/app/(.*)/api(/|(\\?.*)?$)": proxyOptions, <=======
  "^/api(/|(\\?.*)?$)": proxyOptions,
},
```

## New features
- mail service : The mailer is based on NodeMailer and uses the Shopify Liquid Template Engine: The mail templates are stored in the shopify theme and can be edited by the merchant as liquid files !
- CRON service : You can CRON whatever service you need
- AWS wrappers :
  - S3 service : You can save or get any file on a S3 share (import images, export a catalog of products...)
  - DynamoDB database : We use DynamoDB to persist stores offline access_token and you can use DynamoDB to persist whatever you need.
- Cache service : very useful if you need to cache rarely written / frequently read data like a products collection filter or whatever

# Installation
This project respects the Shopify App Template - Node installation process:
1. git clone this project
2. git submodule init (to install the frontend submodule)
3. git submodule update (to install the frontend submodule)
4. SHOPIFY_API_KEY=your_api_key yarn shopify app build
5. yarn shopify app dev

If this address doesn't work:
https://xxxxx.ngrok.io?shop=myshop.myshopify.com&host=base64host

try adding `/api/auth` to this url:
https://xxxxx.ngrok.io/api/auth?shop=myshop.myshopify.com&host=base64host

Enjoy!

## Alternative way to install / deploy in production
1. git clone this project
2. git submodule init (to install the frontend submodule)
3. git submodule update (to install the frontend submodule)
4. SHOPIFY_API_KEY=your_api_key yarn shopify app build
5. go to the `web` directory and rename the .env.sample and update the values
6. launch `yarn dev` in the `web` directory
7. go to the `frontend` directory and launch : SHOPIFY_API_KEY=xxxxxx FRONTEND_PORT=56000 BACKEND_PORT=8081 HOST=livingcolor.ngrok.io npm run dev (BACKEND_PORT and HOST are the ones you find in your `/web/.env` file )
8. Use ngrok to expose YOUR FRONTEND PORT (56000 in my case) to the internet: `ngrok http 56000 --subdomain=livingcolor`
9. Optional (only if you want to access some routes without passing by the proxy like the /public directory) : Use ngrok to expose YOUR BACKEND PORT (8081 in my case) to the internet: `ngrok http 8081 --subdomain=livingcolor2`

:rocket: Enjoy !

# Architecture of your Shopify App
## Introduction
As explained, the whole idea behind this project is to let clear the orginal projet Shopify App Template - Node from all the code that is not related to the Shopify App Template - Node project.
It means that you'll develop your app in a separate project and you'll just have to add the name of your package in the MODULES environment variable + make an `npm install` of your package.

## How to create your own package
During the development phase, you'll create the app in the `web` directory. But when you'll be ready to deploy your app, you'll have to create a separate project and install it as a dependency of the `web` project.

The organisation of your Shopify app project is that simple:
- frontend
  - frontend/assets
  - frontend/components
  - frontend/hooks
  - frontend/pages
- routes
  - routes/index.js
- services
  - services/index.js
index.js
package.json

# Develop your first Shopify App: Geofilter
## Introduction
We will create a real shopify app that will allow to redirect visitors of a shop to another URL depending on the country they are coming from (based on th IP address). This project is complex enough to illustrate all the feature of Satn on Steroids.

TBD