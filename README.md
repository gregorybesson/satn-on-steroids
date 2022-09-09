# SATN on Steroids

This project uses the last version of [Shopify App Template - Node](https://github.com/Shopify/shopify-app-template-node) and stay in sync with it (for now, we use the most up to date branch : cli_three).

and it brings on the developer's table a new dimension to make developing Shopify apps a breeze!

## Why Satn on Steroids?
Shopify App Template - Node (S A T N... you see? ;) based on cli 3 is a great project: It boosts your productivity and helps you to build Shopify apps in a breeze.
But there is a catch : As it is a template, it is not easy to update it when new features are added to the cli 3.

I've taken another route, while respecting the original project's philosophy : I've forked the project and I'm keeping it up to date with the latest features of the cli 3.
But I make possible to develop your app as a package (on your private NPM registry or on your github account).

Yes you read it right, I develop the Shopify app as a package, and I just have to add it to package.json in the web subdirectory. And everything works as expected: I can use the cli 3 to build, launch, deploy, etc. my app:

- The backend routes are discovered automatically.
- The frontend routes are discovered automatically.

I've also added features (see below) so that you go faster! As these features are packages, use it or not, it's up to you!

## How does it work?
### Introduction
With just minor modifications to the cli 3, you can develop your app as a package. I've also removed the subgit frontend directory (I don't like subgit), and set the frontend backbone in its own directory, on the same level of `web` (see the project structure below in the chapter **How to create your own package**).

Of course you don't have to do anything described in this section as it's already done, but if you want to, you can read it to understand or modify the changes detailed here.

Here are the sole modifications made to the original project:

### Backend
The `web/index.js` needs these 2 additions:
```
// SATN
  import { dynamo, DynamoSessionStorage } from 'satn-aws-wrapper';
  import serveStatic from "serve-static";
  import dotenv from "dotenv";
  import path from 'path';
  import { fileURLToPath } from 'url';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  global.appRoot = path.resolve(__dirname);
  dotenv.config();
  //import router from "geofilter";
  // The DynamoDB table must be created the very first time the server is launched.
  // If it already exists, it continues
  await dynamo.createTable();
  const DEV_INDEX_PATH = `${process.cwd()}/../frontend/`;
  const PROD_INDEX_PATH = `${process.cwd()}/../frontend/dist/`;
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
- dynamo is the dynamodb database module. It is a simple wrapper around the AWS SDK. For now, both `DynamoSessionStorage` and `dynamo` are in the public package `satn-aws-wrapper` that you're free to use!
- the following code is just to have the __dirname variable available + expose it as a global var to the packages you'll build
```
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.appRoot = path.resolve(__dirname);
```
- `await dynamo.createTable();` is just there so that it creates the dynamoDB database the first time you launch the app.
- The following code is the secret sauce of Satn on Steroids: It allows you to add your own routes to the app. You just have to add the name of your package in the MODULES environment variable. And you can add as many packages as you want.
```
  const modules = process.env.MODULES.split(",")
  for (const module of modules) {
    const mod = await import(module);
    app.use('/app', mod.router);
    app.use(`/app/${module}/api/*`,verifyRequest(app, { billing: billingSettings}));
  };
```
- Note that I'm not big fan of git submodules, I've moved the frontend directory in the root directory of the project + I've made it a first class citizen in the project as it will become a "gateway" to gather frontends from all your apps (see below).
```
const DEV_INDEX_PATH = `${process.cwd()}/../frontend/`;
const PROD_INDEX_PATH = `${process.cwd()}/../frontend/dist/`;
```
(don't forget to comment out these variables lower in the code)

We've also added these directories (but plan to remove it progressively):
- `web/cacheProvider` : a cache provider for your apps
- `web/mail` : a mail module to send emails for your apps
- `web/public` : the public directory where you can host files like images, pdf, etc.

`web/cacheProvider` and `web/mail` will be moved eventually to their own packages so that it doesn't pollute the web directory.

### Frontend
We've used this project as a starting point for the frontend: https://github.com/Shopify/shopify-frontend-template-react and made some additions so that all the frontends of your apps are gathered in the same place.

The `web/frontend/App.jsx` needs this addition:
```
let pages = import.meta.globEager("./pages/**/!(*.test.[jt]sx)*.([jt]sx)");

// SATN
// SATN
  let modulesPages = import.meta.globEager("./node_modules/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
  pages = { ...modulesPages, ...pages };
  let devModulesPages = import.meta.globEager("./../app/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
  pages = { ...devModulesPages, ...pages };
  const links = Object.keys(pages).filter(key => !key.includes('index') && !key.includes('NotFound')).map((key) => {
    let destination = key
      .replace(/\.\/\.\.\/app\/(.*)\/frontend\/pages/, "")
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

And you need to change the navigationLinks to: `navigationLinks={links}`

- The following code searches for all the pages in the node_modules /frontend/pages directory and adds them to the pages object.
```
let modulesPages = import.meta.globEager("./node_modules/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
pages = { ...modulesPages, ...pages };
```

- The following code searches for all the pages in the /app directory for the modules you develop and adds them to the pages object.
```
let devModulesPages = import.meta.globEager("./../app/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
  pages = { ...devModulesPages, ...pages };
```

- The rest of the code will be used to generate the navigation menu.

The `web/frontend/Routes.jsx` needs this addition:
```
.map((key) => {
      let path = key
        .replace(/\.\/\.\.\/app\/(.*)\/frontend\/pages/, "")      <===== FOR YOUR DEV MODULES
        .replace(/\.\/node_modules\/(.*)\/frontend\/pages/, "")   <===== FOR YOUR PACKAGED MODULES
        .replace("./pages", "")
```
- This single line removes the undesirable part of the path of your Shopify app package.

For development, we need to modify `web/frontend/vite.config.js`:
1. we need to add 2 lines to the proxy filter:
```
proxy: {
  "^/(\\?.*)?$": proxyOptions,
  "^/app/(.*)/api(/|(\\?.*)?$)": proxyOptions,  <=== Your routes for the admin pages
  "^/app(/|(\\?.*)?$)": proxyOptions,           <=== All other routes
  "^/api(/|(\\?.*)?$)": proxyOptions,
},
```
2. We add the `fs` attribute to the server entry so that vite can find files one level up to the project root (your dev modules in /app)
```
fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
```
3. During the production compilation, we want to deduplicate the Shopify libs. The resolve entry becomes:
```
resolve: {
  preserveSymlinks: true,
  dedupe: [
    '@shopify/app-bridge-react',
    '@shopify/app-bridge-utils',
    '@shopify/polaris',
    '@shopify/shopify-api',
  ],
},
```

## New features
It's not all, included in this project, you'll find really useful addons:
- mail service : The mailer is based on NodeMailer and uses the Shopify Liquid Template Engine: **The mail templates are stored in the shopify theme and can be edited by the merchant as liquid files !**
- CRON service : You can CRON whatever service you need (Yes! it's included also!)
- AWS wrappers :
  - S3 service : You can save or get any file on a S3 share (import images, export a catalog of products...)
  - DynamoDB database : We use DynamoDB to persist stores offline access_token and you can use DynamoDB to persist whatever you need.
- Cache service : very useful if you need to cache rarely written / frequently read data like a products collection filter or whatever

# Installation (Here we go!)
```
This project respects the Shopify App Template - Node installation process:
1. git clone this project
2. SHOPIFY_API_KEY=your_api_key yarn shopify app build
3. yarn shopify app dev

If this address doesn't work:
https://xxxxx.ngrok.io?shop=myshop.myshopify.com&host=base64host

try adding `/api/auth` to this url:
https://xxxxx.ngrok.io/api/auth?shop=myshop.myshopify.com&host=base64host

Enjoy!

## Alternative way to install / deploy in production
1. git clone this project
2. SHOPIFY_API_KEY=your_api_key yarn shopify app build
3. go to the `web` directory and rename the .env.sample and update the values
4. launch `yarn dev` in the `web` directory
5. go to the `frontend` directory and rename the .env.sample and update the values
6. launch `yarn dev` (BACKEND_PORT and HOST are the ones you find in your `/web/.env` file )
6. Use ngrok to expose YOUR FRONTEND PORT (taken from `FRONTEND_PORT` in your .env file) to the internet: `ngrok http 56000 --subdomain=livingcolor` (FRONTEND_PORT=56000 in my example)
7. (very) Optional (only if you want to access some routes without passing by the proxy like the /public directory) : Use ngrok to expose YOUR BACKEND PORT (8081 in my case) to the internet: `ngrok http 8081 --subdomain=livingcolor2`
8. Install the app: `https://livingcolor.ngrok.io/api/auth?shop=yourdevshop.myshopify.com&host=bGl2aW5nY29sb3Iubmdyb2suaW8=&embedded=1` (bGl2aW5nY29sb3Iubmdyb2suaW8= : livingcolor.ngrok.io in base64)

:rocket: Enjoy !

# Architecture of your Shopify App
## Introduction
As explained, the whole idea behind this project is to let clear the original projet Shopify App Template - Node from all the code that is not related to the Shopify App Template - Node project.
It means that you'll develop your app in a separate directory and you'll just have to add the name of your package in the MODULES environment variable + make an `npm install` of your package.

## How to create your own package
During the development phase, you'll create the app in the `/app` directory (this directory is in the .gitignore file of satn, so that it's never seen by satn git).
Just proceed as usually: npm init your package to set it up. You 'll use this directory in the /app directory during the dev (and you could even keep it in production), but I strongly advise to deploy it in your npm provate registry so that you just have to install it as a npm package in production.


The organisation of your Shopify app project inside the app directory is that simple:
- app
  - MySuperApp
    - extensions
      - ... your extensions
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
    shopify.app.toml

** Important **
package.json has to include the following:
```
  "devDependencies": {
    "@shopify/app": "^3.0.0",
    "@shopify/cli": "^3.0.0"
  }
```
and the script `"deploy": "shopify app deploy"` to be able to deploy your app extensions with `yarn deploy`

# Develop your first Shopify App: Geofilter
## Introduction
We will create a real shopify app that will allow to redirect visitors of a shop to another URL depending on the country they are coming from (based on th IP address). This project is complex enough to illustrate all the features of Satn on Steroids:

- We need to create an admin page that will allow to configure the redirections
- We need to persist these redirections in the database
- We need to create a service that will allow to get the redirections from the database on the frontend
- We need to create a `theme extension` to display the content on the shop and give the shop admin the ability to configure the look and feel of the front.

It means that we will:
- Create the express routes in `/routes/index.js`
- Create the service in `/services/index.js`
- Create the admin page in `/frontend`
- Create the theme extension in `/extensions`

After this tutorial you'll become a real Shopify App developer ! A Satnist !

TBD
