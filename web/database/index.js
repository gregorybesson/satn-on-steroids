import dotenv from "dotenv";
import _ from "lodash";
import moment from "moment";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
dotenv.config();

const { DATABASE } = process.env;
const AWS = require("aws-sdk");

AWS.config.update({
  region: "eu-west-3",
});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();
const delay = ms => new Promise(res => setTimeout(res, ms));

export const createTable = async () => {
  var params = {
    TableName: DATABASE,
    KeySchema: [
      { AttributeName: "store", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "store", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10,
    },
  };

  try {
    const data = await dynamodb.createTable(params).promise();
    console.log("CreateTable Success");
    console.log(data);
    // wait for the table to get activated
    await delay(5000);

    return data;
  } catch (err) {
    console.log("CreateTable Failure", err.message);

    return false;
  }
};

export const addItem = async (item) => {
  var params = {
    TableName: DATABASE,
    Item: item,
  };

  try {
    const data = await docClient.put(params).promise();

    return data;
  } catch (err) {
    console.log("addItem Failure", err.message);

    return false;
  }
};

export const getItem = async (key) => {
  var params = {
    TableName: DATABASE,
    Key: key,
  };

  try {
    const data = await docClient.get(params).promise();
    // console.log("getItem Success");
    // console.log(data);

    return data;
  } catch (err) {
    console.log("getItem Failure", err.message, params);

    return false;
  }
};

export const updateItem = async (key, changeset) => {
  const params = {
    TableName: DATABASE,
    Key: key,
    ReturnValues: "ALL_NEW",
    ...changeset,
  };

  //console.log("update", params);

  try {
    const data = await docClient.update(params).promise();
    //console.log("updateItem Success");
    //console.log(data);

    return data;
  } catch (err) {
    console.log("updateItem Failure", err.message);

    return false;
  }
};

export const removeItem = async (key) => {
  var params = {
    TableName: DATABASE,
    Key: key,
  };

  try {
    const data = await docClient.delete(params).promise();
    console.log("Success");
    console.log(data);

    return data;
  } catch (err) {
    console.log("Failure", err.message);

    return false;
  }
};

export const deleteTable = async () => {
  var params = {
    TableName: DATABASE,
  };

  try {
    const data = await dynamodb.deleteTable(params).promise();
    console.log("Success");
    console.log(data);

    return data;
  } catch (err) {
    console.log("Failure", err.message);

    return false;
  }
};

export const query = async (params) => {
  params = {
    TableName: DATABASE,
    ...params,
  };

  try {
    const data = await docClient.query(params).promise();
    //console.log("Success");
    //console.log(data);

    return data;
  } catch (err) {
    console.log("Failure", err.message);

    return false;
  }
};

export const scan = async (searchQuery) => {
  var params = {
    TableName: process.env.PRODUCTS_TABLE,
    FilterExpression: "contains (title, :title)",
    ExpressionAttributeValues: {
      ":title": searchQuery,
    },
  };

  try {
    const data = await docClient.scan(params).promise();
    console.log("Success");
    console.log(data);

    return data;
  } catch (err) {
    console.log("Failure", err.message);

    return false;
  }
};

export const getLastCall = async (shopId, keyLastCall) => {
  const key = { store: shopId, sk: "settings" };
  const item = await getItem(key);
  //console.log('Store', item);

  if (
    !_.isEmpty(item) &&
    _.get(item, `Item.fastmag.inventory[${keyLastCall}]`)
  ) {
    return _.get(item, `Item.fastmag.inventory[${keyLastCall}]`);
  }

  return null;
};

export const setLastCall = async (shopId, lastCall, keyLastCall) => {
  const key = { store: shopId, sk: "settings" };
  let item = await getItem(key);
  let json = _.get(item, "Item.fastmag.inventory", {});

  json[keyLastCall] = lastCall;

  try {
    const changeset = {
      UpdateExpression: "SET fastmag.inventory = :x",
      ExpressionAttributeValues: { ":x": json },
    };
    item = await updateItem(key, changeset);
  } catch (e) {
    const changeset = {
      UpdateExpression:
        "SET fastmag.inventory = if_not_exists(fastmag.inventory, :x)",
      ExpressionAttributeValues: { ":x": json },
    };
    item = await updateItem(key, changeset);
  }

  return item;
};

export const log = async (shop, action, data) => {
  const now = moment().tz("Europe/Paris").format().replace(/\..+/, "");
  const sk = `log#action#${action}-date#${now}`;

  try {
    await addItem({
      store: shop,
      sk: sk,
      createdAt: now,
      data: data,
    });
  } catch (e) {
    console.log("erreur action ", action, e);
  }

  return sk;
};

export const updateSettings = async (shop, settings) => {
  const key = { store: shop, sk: "settings" };
  let item = await getItem(key);
  let changeset = {
    store: shop,
    sk: "settings"
  }
  changeset[key] = settings

  if (!item || _.isEmpty(item)) {
    item = await addItem(changeset);
  } else {
    changeset = {
      UpdateExpression: "set #key = :x",
      ExpressionAttributeNames: { "#key": key },
      ExpressionAttributeValues: { ":x": settings },
    };

    item = await updateItem(key, changeset);
  }

  return item
}