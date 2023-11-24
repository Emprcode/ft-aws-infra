import { APIGatewayEvent } from "aws-lambda";

import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument, PutCommandInput } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import * as jwt from "jsonwebtoken";
import { AuthObject } from "../types";

const client = new DynamoDB({});
const ddbDocClient = DynamoDBDocument.from(client);

interface Payload {
  amount: number;
  name: string;
  type: string;
}

export const handler = async (event: APIGatewayEvent) => {
  console.log(event);
  const resp = {
    statusCode: 400,
    isBase64Encoded: false,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Credentials": true,
      "Access-Control-Allow-Origin": "*",
    },
    body: "Bad request",
  };
  if (event.headers.Authorization && event.body) {
    const transactionId = uuidv4();

    const authToken = event.headers.Authorization.split(" ")[1];

    const authObject: AuthObject = jwt.decode(authToken);

    const userId = authObject["cognito:username"];

    const payload: Payload = JSON.parse(event.body);
    const { name, type, amount } = payload;

    const params: PutCommandInput = {
      TableName: process.env.TABLE_NAME || "",
      Item: { userId, name, type, amount, transactionId },
    };
    try {
      await ddbDocClient.put(params);
      resp.statusCode = 200;
      resp.body = "Success";
    } catch (error) {
      console.log(error);
      resp.statusCode = 500;
      resp.body = "Something went wrong";
    }
  }
  return resp;
};
