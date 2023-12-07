import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  CognitoUserPoolsAuthorizer,
  Cors,
  EndpointType,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import * as dotenv from "dotenv";
import { Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
dotenv.config();

interface AwsInfraStacksProps extends cdk.StackProps {
  envName: string;
}

export class AwsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsInfraStacksProps) {
    super(scope, id, props);
    const table = new Table(this, "transactionTable", {
      partitionKey: {
        name: "userId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "transactionId",
        type: AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const func = new lambda.NodejsFunction(this, "postTransaction", {
      entry: path.join(__dirname, "./lambda/post-transaction.ts"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    func.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:PutItem"],
        effect: Effect.ALLOW,
        resources: [table.tableArn],
      })
    );
    const getFunc = new lambda.NodejsFunction(this, "getTransactions", {
      entry: path.join(__dirname, "./lambda/get-transactions.ts"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    getFunc.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:Query"],
        effect: Effect.ALLOW,
        resources: [table.tableArn],
      })
    );
    const deleteFunc = new lambda.NodejsFunction(this, "deleteTransaction", {
      entry: path.join(__dirname, "./lambda/delete-transaction.ts"),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });
    deleteFunc.addToRolePolicy(
      new PolicyStatement({
        actions: ["dynamodb:DeleteItem"],
        effect: Effect.ALLOW,
        resources: [table.tableArn],
      })
    );

    const userPool = UserPool.fromUserPoolId(
      this,
      "userpool",
      process.env.USERPOOL_ID || ""
    );
    const auth = new CognitoUserPoolsAuthorizer(this, "authUser", {
      cognitoUserPools: [userPool],
    });

    const restApi = new RestApi(this, "transactionApi", {
      endpointTypes: [EndpointType.REGIONAL],
    });
    //restapi
    new StringParameter(this, "ApiGatewayUrlParam", {
      stringValue: restApi.url,
      parameterName: "/finance-tracker/api-endpoint",
    });

    const transaction = restApi.root.addResource("transactions", {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
      },
    });
    transaction.addMethod("GET", new LambdaIntegration(getFunc), {
      authorizer: auth,
    });
    transaction.addMethod("POST", new LambdaIntegration(func), {
      authorizer: auth,
    });

    transaction.addMethod("DELETE", new LambdaIntegration(deleteFunc), {
      authorizer: auth,
    });

    //s3 bucket for web hosting
    const hostingBucket = new Bucket(this, "HostingBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new StringParameter(this, "HostingBucketNameParameter", {
      stringValue: hostingBucket.bucketName,
      parameterName: `/${props.envName}/finance-tracker/hosting-bucket-name`,
    });
  }
}
