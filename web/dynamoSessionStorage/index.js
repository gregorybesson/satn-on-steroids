// Import the Session type from the library
import {Session} from '@shopify/shopify-api/dist/auth/session/index.js';
import _ from "lodash";
import * as db from "../database/index.js";
import { Shopify } from "@shopify/shopify-api";

async function storeCallback(session) {
  //console.log('storeCallback called', session);

  const payload = { ...session }
  payload.expires = '' + session.expires
  //delete payload.id
  const sk = `session#id#${session.id}`;

  try {
    let record = await db.addItem({
      store: payload.shop,
      sk: sk,
      session: payload
    });

    if (!record) {
      const key = { store: 'all', sk: sk };
      var changeset = {
        UpdateExpression: "set #session = :x",
        ExpressionAttributeNames: { "#session": "session" },
        ExpressionAttributeValues: { ":x": payload },
      };

      await db.updateItem(key, changeset);
    }

    return true
  } catch (err) {
    console.log('err', err);

    return false
  }
}

async function loadCallback(id) {
  const shop = id.replace('offline_', '')
  const sk = `session#id#${id}`;
  const key = { store: shop, sk: sk };
  const item = await db.getItem(key);

  if (!_.isEmpty(item) && _.get(item, "Item.session")) {
    const session = new Session(id)
    const { shop, state, scope, accessToken, isOnline, expires, onlineAccessInfo } = _.get(item, "Item.session")
    session.shop = shop
    session.state = state
    session.scope = scope
    session.expires = expires ? new Date(expires) : undefined
    session.isOnline = isOnline
    session.accessToken = accessToken
    session.onlineAccessInfo = onlineAccessInfo
    session.isActive = () => {
      return true;
      // return session.accessToken &&
      //   session.expires ? session.expires > new Date() : true;
    };

    return session
  }

  return undefined
}

async function deleteCallback(id) {
  const shop = id.replace('offline_', '')
  console.log('deleteCallback called', id);
  const sk = `session#id#${id}`;
  const key = { store: shop, sk: sk };
  const result = await db.removeItem(key);

  return result;
}

async function deleteSessionsCallback(shop) {
  const sessions = await findSessionsByShopCallback(shop);
  for (const session of sessions) {
    await deleteCallback(session.id);
  }
}

async function findSessionsByShopCallback(shop) {
  //const cleanShop = sanitizeShop(shop, true)!;
  let sessions = [];

  const params = {
    KeyConditionExpression: "#st = :store and begins_with(#sk, :session)",
    ExpressionAttributeNames: {
      "#st": "store",
      "#sk": "sk",
    },
    ExpressionAttributeValues: {
      ":store": shop,
      ":session": "session#id#",
    },
  };
  const result = await db.query(params);
  console.log('result', result);

  for (const item of result.Items) {
    if (_.get(item, "session.shop") === shop) {
      console.log('_.get(item, "session")', _.get(item, "session"));

      const { shop, id, state, scope, accessToken, isOnline, expires, onlineAccessInfo } = _.get(item, "session")
      const session = new Session(id)
      session.shop = shop
      session.state = state
      session.scope = scope
      session.expires = expires ? new Date(expires) : undefined
      session.isOnline = isOnline
      session.accessToken = accessToken
      session.onlineAccessInfo = onlineAccessInfo
      session.isActive = () => {
        return session.accessToken && session.expires ? session.expires > new Date() : true;
      };

      sessions.push(session);
    }
  }

  return sessions;
}

export const DynamoSessionStorage = new Shopify.Session.CustomSessionStorage(
  storeCallback,
  loadCallback,
  deleteCallback,
  deleteSessionsCallback,
  findSessionsByShopCallback,
)