import dotenv from "dotenv";
import _ from "lodash";
import * as db from "../database";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const AWS = require("aws-sdk");
AWS.config.update({
  region: "eu-west-3",
});
const s3 = new AWS.S3();

dotenv.config();
const { SHOP, S3BUCKET } = process.env;

export const fileExists = async (pathFile) => {
  const params = { Bucket: S3BUCKET, Key: pathFile };
  let found = false;
  try {
    const headCode = await s3.headObject(params).promise();
    //console.log('headCode', headCode);

    found = true;
  } catch (headErr) {
    if (headErr.code === "NotFound") {
      // Handle no object on cloud here
    }
  }

  return found;
};

/**
 * https://myshopicloz.s3.eu-west-3.amazonaws.com/socloz.xml
 *
 * s3.put(fileStream, ftpFile.name, S3BUCKET)
 * Fichier de sauvegarde SoCloz
 */
export const saveS3 = async (pathFile, content, replace = true) => {
  try {
    let createFile = true;
    if (!replace) {
      createFile = !(await fileExists(pathFile));
    }
    if (createFile) {
      console.log("saveS3 appelé pour sauvegarder", pathFile);
      const extn = path.extname(pathFile);
      let contentType = "application/octet-stream";
      if (extn == ".png") contentType = "image/png";
      if (extn == ".gif") contentType = "image/gif";
      if (extn == ".jpg") contentType = "image/jpeg";
      const params = {
        Bucket: S3BUCKET,
        Key: `${pathFile}`,
        Body: content,
        ContentType: contentType,
      };
      try {
        const s3Response = await s3.putObject(params).promise();
        db.log(SHOP, "saveS3", {
          success: true,
          message: `${S3BUCKET}/${pathFile}`,
        });
      } catch (e) {
        console.log(err);
        db.log(SHOP, "saveS3", {
          success: false,
          message: `${S3BUCKET}/${pathFile}`,
        });
      }
    } else {
      console.log("ce fichier existe déjà", pathFile);
    }
  } catch (e) {
    console.log("saveS3 error", e);
  }
};

//   const today = moment().startOf('day');
//   const listParams = {
//     Bucket: S3BUCKET,
//     Prefix: dir,
//   };

//   const listedObjects = await s3.listObjectsV2(listParams).promise();

//   console.log("deleting s3 files", listedObjects.Contents.length);

//   if (listedObjects.Contents.length === 0) return;

//   const deleteParams = {
//     Bucket: S3BUCKET,
//     Delete: { Objects: [] },
//   };

//   listedObjects.Contents.forEach(({ Key, LastModified }) => {
//     if (moment(LastModified).isBefore(today)) {
//       deleteParams.Delete.Objects.push({ Key });
//     }
//   });

//   await s3.deleteObjects(deleteParams).promise();

//   if (listedObjects.IsTruncated) await emptyS3Directory(dir);
// };
export const emptyS3Directory = async (dir) => {
  const listParams = {
    Bucket: S3BUCKET,
    Prefix: dir,
  };

  const listedObjects = await s3.listObjectsV2(listParams).promise();

  console.log("deleting s3 files", listedObjects.Contents.length);

  if (listedObjects.Contents.length === 0) return;

  const deleteParams = {
    Bucket: S3BUCKET,
    Delete: { Objects: [] },
  };

  listedObjects.Contents.forEach(({ Key }) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3.deleteObjects(deleteParams).promise();

  if (listedObjects.IsTruncated) await emptyS3Directory(dir);
};

/**
 * https://myshopicloz.s3.eu-west-3.amazonaws.com/socloz.xml
 *
 * s3.put(fileStream, ftpFile.name, S3BUCKET)
 * Fichier de sauvegarde SoCloz
 */
export const listS3Directory = async (dir) => {
  const listParams = {
    Bucket: S3BUCKET,
    Prefix: dir,
  };

  const listedObjects = await s3.listObjectsV2(listParams).promise();
  console.log("list of s3 files", listedObjects.Contents.length);

  if (listedObjects.Contents.length === 0) return [];

  return listedObjects.Contents;
};

/**
 * https://myshopicloz.s3.eu-west-3.amazonaws.com/socloz.xml
 *
 * s3.put(fileStream, ftpFile.name, S3BUCKET)
 * Fichier de sauvegarde SoCloz
 */
export const deleteObject = async (pathFile) => {
  const deleteParams = {
    Bucket: S3BUCKET,
    Delete: { Objects: [{ Key: pathFile }] },
  };

  //console.log("pathFile", pathFile);

  try {
    await s3.deleteObjects(deleteParams).promise();
  } catch (e) {
    console.log("deleteObject error", e);
  }

  return true;
};
