import { DynamoDB, Select } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { APIGatewayEvent } from "aws-lambda";
import { AuthObject } from "../types";
import jwt from "jsonwebtoken";

const client = new DynamoDB({});
const docClient = DynamoDBDocument.from(client);

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
  if (event.headers.Authorization) {
    const authToken = event.headers.Authorization.split(" ")[1];
    const authObject: AuthObject = jwt.decode(authToken);
    const userId = authObject["cognito:username"];

    const params: QueryCommandInput = {
      TableName: process.env.TABLE_NAME || "",
      KeyConditionExpression: "userId = :pk",
      ExpressionAttributeValues: {
        ":pk": userId,
      },
      Select: Select.SPECIFIC_ATTRIBUTES,
      ProjectionExpression: "transactionId, #name, #type, amount",
      ExpressionAttributeNames: {
        "#type": "type",
        "#name": "name",
      },
    };
    try {
      const response = await docClient.query(params);
      resp.headers["Content-Type"] = "application/json";
      resp.statusCode = 200;
      resp.body = JSON.stringify(response.Items);
    } catch (error) {
      console.log(error);
      resp.statusCode = 500;
      resp.body = "Something went wrong";
    }
  }
  return resp;
};
