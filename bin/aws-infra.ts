#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsInfraStack } from "../lib/aws-infra-stack";

const envs = ["Dev", "Staging", "Prod"];
const app = new cdk.App();

envs.map((env) => {
  new AwsInfraStack(app, `${env}-AwsInfraStack`, {
    env: {
      region: "ap-southeast-2",
    },
    envName: env,
  });
});
