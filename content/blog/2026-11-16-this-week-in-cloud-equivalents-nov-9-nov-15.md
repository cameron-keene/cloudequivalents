---
title: "This week in cloud equivalents: Nov 9 – Nov 15, 2026"
date: 2026-11-16
description: "Front Door edge actions and mTLS go GA, Secrets Manager replicates across accounts, Amazon Quick becomes AWS Quick, and AWS ships a local emulator."
tags: [weekly, aws, azure, gcp, certification]
compares: [edge-functions-lightweight, edge-functions-full, cdn, secrets-management, work-assistant, patching]
sources:
  - title: "Generally Available: Azure Front Door edge actions (Azure Updates, Nov 10, 2026)"
    url: https://azure.microsoft.com/updates?id=579310
  - title: "Customization at the edge by using Azure Front Door edge actions (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/frontdoor/edge-actions
  - title: "Generally Available: Azure Front Door mutual TLS authentication (Azure Updates, Nov 12, 2026)"
    url: https://azure.microsoft.com/updates?id=577678
  - title: "Public Preview: JWT validation with Azure Front Door Auth Policy (Azure Updates, Nov 12, 2026)"
    url: https://azure.microsoft.com/updates?id=577673
  - title: "Mutual TLS authentication with CloudFront (Viewer mTLS) (Amazon CloudFront Developer Guide)"
    url: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/mtls-authentication.html
  - title: "Validate a simple token in a CloudFront Functions viewer request (Amazon CloudFront Developer Guide)"
    url: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_kvs_jwt_verify_section.html
  - title: "Introduction to CloudFront Functions (Amazon CloudFront Developer Guide)"
    url: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html
  - title: "Mutual TLS overview (Cloud Load Balancing documentation)"
    url: https://docs.cloud.google.com/load-balancing/docs/mtls
  - title: "Service Extensions overview (Google Cloud documentation)"
    url: https://docs.cloud.google.com/service-extensions/docs/overview
  - title: "AWS Secrets Manager now supports cross-account replication (AWS What's New, Nov 13, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/secrets-manager-cross-account/
  - title: "Reliability in Azure Key Vault (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/key-vault/general/disaster-recovery-guidance
  - title: "Azure Key Vault backup and restore (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/key-vault/general/backup
  - title: "Choose a secret replication policy (Secret Manager documentation)"
    url: https://docs.cloud.google.com/secret-manager/docs/choosing-replication
  - title: "Amazon Quick is now AWS Quick (AWS What's New, Nov 9, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/amazon-quick-aws-quick/
  - title: "Amazon Q Developer in console is now the AWS assistant (AWS What's New, Nov 5, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/q-developer-renamed-aws-assistant/
  - title: "Test your applications against AWS locally with AWS Emulator (AWS News Blog, Nov 11, 2026)"
    url: https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/
  - title: "Use the Azurite emulator for local Azure Storage development (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite
  - title: "What is the Azure Cosmos DB emulator? (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/cosmos-db/emulator
  - title: "Overview of the Azure Service Bus emulator (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/overview-emulator
  - title: "gcloud beta emulators (Google Cloud SDK reference)"
    url: https://docs.cloud.google.com/sdk/gcloud/reference/beta/emulators
  - title: "AWS Systems Manager simplifies onboarding of Google Cloud VMs for centralized management (AWS What's New, Nov 13, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/systems-manager-google-cloud-support/
  - title: "What is Multicloud connector enabled by Azure Arc? (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/azure-arc/multicloud-connector/overview
  - title: "VM Manager documentation (Google Cloud)"
    url: https://docs.cloud.google.com/compute/vm-manager/docs
  - title: "Don't just prompt AI — architect it: Introducing the Professional Agentic Architect Certification (Google Cloud Blog, Nov 11, 2026)"
    url: https://cloud.google.com/blog/topics/training-certifications/google-cloud-agentic-architect-certification-dont-just-prompt-ai-design-it/
  - title: "Retirement: Azure Data Share will be retired on November 12, 2029 (Azure Updates, Nov 13, 2026)"
    url: https://azure.microsoft.com/updates?id=578818
  - title: "Retirement: Support for .NET 8 and .NET 9 on Static Web Apps is ending November 10, 2026 (Azure Updates, Nov 9, 2026)"
    url: https://azure.microsoft.com/updates?id=575106
---

Most of this week's launches were single-cloud detail. This post picks the five changes that move how AWS, Azure and Google Cloud line up: Azure Front Door catching up with CloudFront at the edge, AWS Secrets Manager crossing account boundaries, another AWS rename, a local emulator that works differently from what Azure and Google offer, and AWS managing Google Cloud VMs. Certifications and retirements are at the end.

## Azure Front Door edge actions and mTLS are now GA

Azure moved three Front Door features this week, and together they close most of the gap with CloudFront for edge logic:

- **Edge actions are generally available** ([announcement](https://azure.microsoft.com/updates?id=579310), Nov 10). They're lightweight JavaScript functions that run while Front Door processes a request or response, inside a Hyperlight micro-VM. The [documentation](https://learn.microsoft.com/en-us/azure/frontdoor/edge-actions) now lists both client request and client response invocation points, a 16 KB code limit, a 10 ms execution limit, three versions per edge action, and JavaScript as the only language. It applies to Front Door Standard and Premium.
- **Mutual TLS is generally available** on Front Door Premium ([announcement](https://azure.microsoft.com/updates?id=577678), Nov 12). It has four modes: require and validate, require without validation, validate when presented, or pass through to the origin. When the certificate goes to the origin, it arrives in the `X-Azure-ClientCertificate` header. At GA you only need to upload the trusted root CA to Key Vault. Clients then have to send their intermediates during the handshake.
- **JWT validation with Auth Policy is in public preview** on Front Door Premium ([announcement](https://azure.microsoft.com/updates?id=577673), Nov 12). It validates bearer tokens issued by Microsoft Entra ID against the issuer and audience you configure. Block mode returns HTTP 401 and Log mode only records the result. Microsoft points out that your app still owns authorization, and that you have to lock down origin access so clients can't go around Front Door.

How this compares across the three clouds:

| | AWS (CloudFront) | Azure (Front Door) | Google Cloud |
|---|---|---|---|
| Lightweight code at the edge | [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html), JavaScript on viewer request and viewer response | Edge actions (now GA), JavaScript on client request and client response, 16 KB / 10 ms | [Service Extensions](https://docs.cloud.google.com/service-extensions/docs/overview) plugins in the load balancer and Media CDN data path |
| Client certificates (mTLS) | [Viewer mTLS](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/mtls-authentication.html) with required, optional and passthrough modes | Premium tier, four modes (GA) | [mTLS on Application Load Balancers](https://docs.cloud.google.com/load-balancing/docs/mtls), set on the target HTTPS proxy |
| Bearer token (JWT) checks | Code it yourself in CloudFront Functions (AWS publishes a [sample](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_kvs_jwt_verify_section.html) that verifies an HS256 token with a key from KeyValueStore) | Configure Auth Policy for Entra ID tokens (preview), or write the check in edge actions | Not covered in this post |

Azure's custom-code option at the edge is no longer preview, and it now runs on responses too, which is much closer to CloudFront Functions' viewer request and response events. See [CloudFront Functions vs Front Door rules engine](/compare/aws-cloudfront-functions-vs-azure-front-door-rules-engine/). Lambda@Edge still has no Azure equivalent. The edge actions limits haven't changed, so heavier logic still belongs in regional Functions or Container Apps behind Front Door ([Lambda@Edge on Azure](/compare/aws-lambda-at-edge-vs-azure/)). If you're studying for AZ-700 with an ANS-C01 or DVA-C02 background, think of "edge actions ≈ CloudFront Functions" and "Auth Policy ≈ the JWT check you'd otherwise write in a function". See also [CloudFront vs Front Door](/compare/aws-cloudfront-vs-azure-front-door/).

## Secrets Manager now replicates across accounts

On Nov 13, AWS added [cross-account replication to Secrets Manager](https://aws.amazon.com/about-aws/whats-new/2026/11/secrets-manager-cross-account/). It builds on the multi-Region replication that already existed. A central team owns and rotates the primary secret, and each consuming account gets a local copy that stays current, without sharing KMS keys or writing cross-account secret policies. The replica is an independent resource encrypted with a customer managed KMS key that the replica account owns. It updates whenever the primary changes, including on rotation, and you can promote it to a standalone secret. AWS pitches it for recovery accounts too, so you have a live copy that's isolated from a compromised or ransomware-hit primary account. It's available in every Region where Secrets Manager runs.

The other clouds approach this differently:

- **Azure Key Vault** handles replication for you. Microsoft [replicates vault contents](https://learn.microsoft.com/en-us/azure/key-vault/general/disaster-recovery-guidance) within the region and, where one exists in the same geography, to the paired region. Copying secrets between vaults yourself is a manual [backup and restore](https://learn.microsoft.com/en-us/azure/key-vault/general/backup), one object at a time, and a backup can only be restored into a vault in the same Azure subscription and geography. Neither page describes a managed, always-in-sync replica in another subscription.
- **Google Cloud Secret Manager** sets a [replication policy](https://docs.cloud.google.com/secret-manager/docs/choosing-replication) on each secret, either automatic (Google picks the regions) or user-managed (you pick the locations). Replication is synchronous. The policy controls where a secret lives, not which projects get a copy.

The services still line up closely: see [Secrets Manager vs Key Vault](/compare/aws-secrets-manager-vs-azure-key-vault/) and [Secrets Manager vs Secret Manager](/compare/aws-secrets-manager-vs-gcp-secret-manager/). The new difference is who keeps copies in sync. On AWS, where the account is the isolation boundary, the provider will now keep copies in sync across accounts for you. On Azure and Google Cloud, the documented features cover regional resilience, and cross-subscription or cross-project access is something you design yourself.

## Amazon Quick is now AWS Quick

On Nov 9, AWS [renamed Amazon Quick to AWS Quick](https://aws.amazon.com/about-aws/whats-new/2026/11/amazon-quick-aws-quick/), and its BI capability Amazon Quick Sight is now AWS Quick Sight. AWS says nothing changes for customers: no action needed, and no changes to data, settings or pricing. That makes two AWS assistant renames in two weeks: on Nov 5, [Amazon Q Developer in the console became the AWS assistant](https://aws.amazon.com/about-aws/whats-new/2026/11/q-developer-renamed-aws-assistant/).

AWS Quick still lines up with Microsoft 365 Copilot and Gemini Enterprise; see [Quick vs Microsoft 365 Copilot](/compare/aws-quick-vs-azure-m365-copilot/) and [Quick vs Gemini Enterprise](/compare/aws-quick-vs-gcp-gemini-enterprise/). In older study material you may see three names for the BI piece: QuickSight, Amazon Quick Sight and AWS Quick Sight. They all refer to the same thing.

## AWS Emulator: one local endpoint for every modeled AWS API

On Nov 11, AWS released [AWS Emulator](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/) as generally available, with no service fee and source code on GitHub. It runs locally over HTTPS (`127.0.0.1:9297`), and the AWS CLI, SDKs and coding agents reach it by changing environment variables, with no code changes. It's built from the same AWS API models the SDKs use, so it covers any service that has a published model. AWS publishes per-service fidelity scores, and operations that aren't implemented return HTTP 501. AWS is clear about the limits: it doesn't evaluate IAM or resource policies the way AWS does, and each instance is a single account with no cross-account or cross-Region behavior.

Azure and Google Cloud approach local testing per service:

| | AWS | Azure | Google Cloud |
|---|---|---|---|
| Approach | One emulator for all modeled APIs | One emulator per service | One emulator per service, through `gcloud` |
| Examples | S3, DynamoDB and anything else with an API model, at varying fidelity | [Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite) (Blob, Queue, Table), [Cosmos DB emulator](https://learn.microsoft.com/en-us/azure/cosmos-db/emulator), [Service Bus emulator](https://learn.microsoft.com/en-us/azure/service-bus-messaging/overview-emulator) | [`gcloud beta emulators`](https://docs.cloud.google.com/sdk/gcloud/reference/beta/emulators): Bigtable, Datastore, Firestore, Pub/Sub, Spanner |

If your test suite moves between clouds, plan for a different shape on each: one emulator to configure on AWS, versus a set of per-service emulators on Azure and Google Cloud. On every cloud, still test permissions against the real thing.

## Systems Manager can now onboard Google Cloud VMs

On Nov 13, AWS extended [Systems Manager Cloud Connector to Google Cloud](https://aws.amazon.com/about-aws/whats-new/2026/11/systems-manager-google-cloud-support/). It deploys the SSM Agent to existing Google Cloud VMs at scale, so you can use Session Manager, Run Command, State Manager, Patch Manager, Automation and Inventory on them alongside EC2, on-premises and Azure machines.

Azure already works from the other direction: the [multicloud connector enabled by Azure Arc](https://learn.microsoft.com/en-us/azure/azure-arc/multicloud-connector/overview) discovers EC2 instances and Google Cloud VMs and installs the Connected Machine agent (Google Cloud support is in preview). Google Cloud's [VM Manager](https://docs.cloud.google.com/compute/vm-manager/docs) is documented for Compute Engine fleets. So AWS and Azure each want to be the single pane for VMs across all three clouds, and Google Cloud's tool stays focused on its own VMs.

On [Patch Manager vs Update Manager](/compare/aws-patch-manager-vs-azure-update-manager/), the "hybrid" difference used to mean on-premises. It now means other clouds too, on both sides. This is relevant for SOA-C03 and AZ-104 candidates, since multicloud onboarding is starting to show up in both vendors' management stories.

## Certifications

- **Google Cloud launched the Professional Agentic Architect certification** ([announcement](https://cloud.google.com/blog/topics/training-certifications/google-cloud-agentic-architect-certification-dont-just-prompt-ai-design-it/), Nov 11). It has a hybrid format: a proctored multiple-choice exam plus hands-on labs on Google Skills where you build, test and debug agent workflows. The five domains cover low-code agents, coding agents, custom agents on the Gemini platform with open-source frameworks, evaluation and deployment, and security and governance. A required live-lab component is unusual for a cloud certification.
- No new AWS or Microsoft certification posts appeared in the official feeds during this window. For the Azure exams that build on AWS experience, see our [exam guides for AWS engineers](/exams/).

## Retirements and smaller changes

- **Azure Data Share retires on Nov 12, 2029** ([notice](https://azure.microsoft.com/updates?id=578818)). Microsoft suggests Fabric external data sharing, Data Factory or Fabric Data Factory pipelines, or Azure SQL Database data virtualization (preview), and says these aren't one-to-one replacements and there's no automatic migration.
- **Static Web Apps managed Functions APIs on .NET 8 and .NET 9 lost support on Nov 10, 2026** ([notice](https://azure.microsoft.com/updates?id=575106), posted only the day before). Apps keep running but no longer get security updates, and the fix is moving to .NET 10 on the isolated worker model.
