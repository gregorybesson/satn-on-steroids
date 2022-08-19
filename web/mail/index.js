import dotenv from "dotenv";
import { Liquid } from "liquidjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");

dotenv.config();

AWS.config.update({
  region: "eu-west-1",
});

let transporter = nodemailer.createTransport({
  SES: new AWS.SES({
    apiVersion: "2010-12-01",
  }),
});

const { SHOP } = process.env;

/**
 *
 *
 * @param {String} from
 * @param {String} to
 * @param {String} subject
 * @param {String} template
 * @param {Object} changeset
 * @param {Array} attachments
 */
 export const sendMail = async (
  client,
  from,
  to,
  subject,
  template,
  changeset,
  bcc = [],
  attachments = []
) => {
  // Example of syntax for attachments
  // attachments: [
  //  {
  //    path: '/path/to/file.txt'
  //  }
  // ]
  //console.log('sendMail', from, to, subject, template, changeset, bcc);

  // TODO: use the regular Shopify API to get the snippet
  let snippet = await shopify.getAsset(client, template);

  // TODO: handle translations see. https://github.com/wturnerharris/liquidjs-shopify-plugins/blob/master/filters/translations.js
  const engine = new Liquid();
  const tpl = engine.parse(snippet.asset.value);
  const html = await engine.render(tpl, { ...changeset });
  //console.log('html', html)
  // send welcome email
  let mailOptions = {
    from: from,
    to: to,
    bcc: bcc,
    subject: subject,
    text: "",
    html: html,
    attachments: attachments,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Message sent: ", info);
    }
  });
};
