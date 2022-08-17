# SATN on Steroids

This project uses the last version of [Shopify App Template - Node](https://github.com/Shopify/shopify-app-template-node) and stay in sync with it.

For now, we use the most up to date branch : cli_three

And it adds extra features to make developing Shopify apps a breeze!

## New features
- mail service : The mailer is based on NodeMailer and uses the Shopify Liquid Template Engine: The mail templates are stored in the shopify theme and can be edited by the merchant as liquid files !
- CRON service : You can CRON whatever service you need
- S3 service : You can save or get any file on a S3 share (import images, export a catalog of products...)
- DynamoDB database : We use DynamoDB to persist stores offline access_token and you can use DynamoDB to persist whatever you need.
- Cache service : very useful if you need to cache rarely written / frequently read data like a products collection filter or whatever

# Installation
This project respects the Shopify App Template - Node installation process:
1. git clone this project
2. SHOPIFY_API_KEY=your_api_key npm run shopify app build
3. npm run shopify app dev

If this address doesn't work:
https://xxxxx.ngrok.io?shop=myshop.myshopify.com&host=base64host

try adding `/api/auth` to this url:
https://xxxxx.ngrok.io/api/auth?shop=myshop.myshopify.com&host=base64host

Enjoy!

# Architecture

## Backend
All of your backend code should take place in the /web/app directory.
We use the Express Router component to discover all the routes in the /web/app/routes directory.

### /web/app
Under this directory, you may
- add CRON jobs in cron/index.js
- customize code in webhooks in routes/webhooksRouter
- Add new routes : Create a Router file (take inspiration from webhooksRouter) and import it in routes/index.js
- Add new services : Create a service file (take inspiration from mailerService) and import it in services/index.js

## Frontend
TBD

# Develop your first Shopify App
TBD

You're good to go :rocket: