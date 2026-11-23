---
title: "This week in cloud equivalents: Nov 2 – Nov 8, 2026"
date: 2026-11-09
description: "Q Developer in the console is now the AWS assistant, IAM roles meet Identity Center, keyless cross-cloud DataSync, and post-quantum TLS at the edge."
tags: [weekly, aws, azure, gcp]
compares: [cloud-console-assistant, workforce-sso, cloud-iam, online-data-migration, cdn]
sources:
  - title: "Amazon Q Developer in console is now the AWS assistant (AWS What's New, Nov 5, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/q-developer-renamed-aws-assistant/
  - title: "Azure Copilot overview (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/copilot/overview
  - title: "Gemini Cloud Assist overview (Google Cloud documentation)"
    url: https://docs.cloud.google.com/cloud-assist/overview
  - title: "Introducing AWS account access manager: IAM role flexibility with centralized workforce access (AWS Security Blog, Nov 5, 2026)"
    url: https://aws.amazon.com/blogs/security/introducing-aws-account-access-manager-iam-role-flexibility-with-centralized-workforce-access/
  - title: "What is Azure role-based access control (Azure RBAC)? (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/role-based-access-control/overview
  - title: "IAM overview (Google Cloud documentation)"
    url: https://docs.cloud.google.com/iam/docs/overview
  - title: "AWS DataSync Enhanced mode supports OpenID Connect (OIDC) for Google Cloud and Microsoft Azure (AWS What's New, Nov 4, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/datasync-enhanced-oidc-google-azure/
  - title: "Configure access to a source: Amazon S3 (Storage Transfer Service documentation)"
    url: https://docs.cloud.google.com/storage-transfer/docs/source-amazon-s3
  - title: "Get started with cloud-to-cloud migration in Azure Storage Mover (Microsoft Learn)"
    url: https://learn.microsoft.com/en-us/azure/storage-mover/cloud-to-cloud-migration
  - title: "Generally Available: Azure Front Door TLS key exchange policy with post-quantum support (Azure Updates, Nov 5, 2026)"
    url: https://azure.microsoft.com/updates?id=577668
  - title: "Supported protocols and ciphers between viewers and CloudFront (Amazon CloudFront Developer Guide)"
    url: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-viewer-protocols-ciphers.html
  - title: "AWS Support for Post-Quantum Confidentiality (AWS)"
    url: https://aws.amazon.com/security/post-quantum-cryptography/aws-pq-readiness-confidentiality/
  - title: "Post-quantum TLS (Cloud Load Balancing documentation)"
    url: https://docs.cloud.google.com/load-balancing/docs/post-quantum-tls
  - title: "SSL policies overview (Cloud Load Balancing documentation)"
    url: https://docs.cloud.google.com/load-balancing/docs/ssl-policies-concepts
  - title: "Retirement: Azure Fluid Relay (Azure Updates, Nov 2, 2026)"
    url: https://azure.microsoft.com/updates?id=570498
  - title: "Retirement: OT security in Microsoft Defender for IoT (Azure Updates, Nov 2, 2026)"
    url: https://azure.microsoft.com/updates?id=576255
  - title: "AWS Security Hub now provides an SBOM inventory for your compute resources (AWS What's New, Nov 6, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/security-hub-sbom-inventory/
  - title: "Amazon RDS now supports per snapshot billing (AWS What's New, Nov 2, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/amazon-rds-per-snapshot-billing/
  - title: "New Microsoft Certified: Supply Chain Management AI Consultant Associate (Microsoft Skills Hub Blog)"
    url: https://techcommunity.microsoft.com/t5/the-skills-hub-blog/new-microsoft-certified-supply-chain-management-ai-consultant/ba-p/4564533
---

This week's single-vendor recaps are long lists of launches. Four of them change how the clouds line up, so that's what this post covers: a rename that every AWS-to-Azure cheat sheet now has wrong, a change to how AWS hands out workforce access that makes it look a little more like Azure and Google Cloud, a cross-cloud migration fix, and post-quantum TLS arriving at the edge on all three clouds.

## Amazon Q Developer in the console is now "the AWS assistant"

On Nov 5, AWS [renamed Amazon Q Developer in the AWS Management Console and the Console Mobile Apps](https://aws.amazon.com/about-aws/whats-new/2026/11/q-developer-renamed-aws-assistant/) to the AWS assistant. AWS says it's the same account-aware guidance and actions under a new name, that it's currently offered for free, and that existing Q Developer Pro subscribers keep their Pro tier capabilities.

This finishes splitting up a name that used to cover two different products:

| | AWS | Azure | Google Cloud |
|---|---|---|---|
| Assistant inside the cloud console | AWS assistant (was Q Developer in the console) | [Azure Copilot](https://learn.microsoft.com/en-us/azure/copilot/overview) | [Gemini Cloud Assist](https://docs.cloud.google.com/cloud-assist/overview) |
| Coding assistant in the IDE | Kiro (replacing the Q Developer IDE plugins) | GitHub Copilot | Gemini Code Assist, moving to Antigravity |

The mapping itself doesn't change: the console assistant still lines up with Azure Copilot and Gemini Cloud Assist. What changes is the name you'll search for. If you see "Amazon Q Developer" in an older study guide, check whether it means the console assistant (now the AWS assistant) or the IDE plugins (now Kiro). Our [Q Developer vs Azure Copilot](/compare/aws-q-developer-vs-azure-copilot/) and [Q Developer vs Gemini Cloud Assist](/compare/aws-q-developer-vs-gcp-gemini-cloud-assist/) pages still use the old name and will be updated. For the IDE side, see [Kiro vs GitHub Copilot](/compare/aws-kiro-vs-azure-github-copilot/).

## AWS account access manager: IAM roles, assigned centrally

Also on Nov 5, AWS introduced [account access manager](https://aws.amazon.com/blogs/security/introducing-aws-account-access-manager-iam-role-flexibility-with-centralized-workforce-access/), a new part of IAM that lets you assign your existing IAM roles in member accounts to users and groups from an organization instance of IAM Identity Center. Until now the choice was either federating into each account separately (full IAM role flexibility, but per-account setup) or using Identity Center permission sets (one federation point, but uniform roles). Account access manager gives you the single federation point and keeps the per-account roles, with their own trust policies, tags and paths.

Details worth knowing from the AWS post:

- Each assignment ("entitlement") is a user or group, an account, and an IAM role ARN instead of a permission set. Roles need a trust policy statement that lets the `account-access.amazonaws.com` service assume them.
- Sessions carry the individual user's identity through trusted identity propagation, so actions are attributed to the person even when several people share one role.
- Users sign in through a new account access portal or the AWS access portal, and get CLI credentials with `aws login`. `aws sso configure` doesn't work with these assignments.
- It's free, uses its own `account-access` API namespace and CloudTrail events, and is enabled by default in commercial Regions (not opt-in Regions, GovCloud or China).

Why it matters if you're moving between clouds: on Azure and Google Cloud the "per-account federation" problem never existed in the same form. On Azure, you assign [Azure RBAC roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/overview) to Entra ID users and groups at a management group, subscription, resource group or resource scope, all from the same tenant. On Google Cloud, [IAM](https://docs.cloud.google.com/iam/docs/overview) grants roles to users and groups on the organization, folders or projects. AWS still keeps the role inside each account, but with account access manager the day-to-day model (assign a group to a role in a place, centrally) now looks much closer to what Azure and Google Cloud engineers expect.

On our site, [IAM Identity Center vs Entra ID](/compare/aws-iam-identity-center-vs-azure-entra-id/) describes Identity Center access to AWS accounts as going through permission sets only. That's now incomplete, and the page needs a line on account access manager. The [IAM vs Entra ID](/compare/aws-iam-vs-azure-entra-id/) and [IAM vs Google Cloud IAM](/compare/aws-iam-vs-gcp-cloud-iam/) pages are a good companion read.

## DataSync drops long-lived keys for Azure and Google Cloud sources

On Nov 4, AWS added [OpenID Connect (OIDC) authentication to DataSync Enhanced mode](https://aws.amazon.com/about-aws/whats-new/2026/11/datasync-enhanced-oidc-google-azure/) for Google Cloud Storage and Azure Blob Storage locations. DataSync uses an IAM role to get short-lived credentials from Google Cloud or Microsoft Entra ID and refreshes them automatically. You no longer need HMAC keys or SAS tokens to pull data from the other cloud.

That brings the three migration tools closer together on identity:

- **Into Google Cloud:** [Storage Transfer Service](https://docs.cloud.google.com/storage-transfer/docs/source-amazon-s3) can already read from Amazon S3 with federated identity. You create an AWS IAM role that trusts `accounts.google.com` and give Storage Transfer Service the role ARN, instead of an access key.
- **Into Azure:** [Storage Mover's cloud-to-cloud migration](https://learn.microsoft.com/en-us/azure/storage-mover/cloud-to-cloud-migration) from S3 goes through an Azure Arc multicloud connector for AWS, which you authorize by deploying a CloudFormation template that Azure generates.
- **Into AWS:** DataSync can now do the equivalent in the other direction for Blob Storage and Cloud Storage.

If your security team blocks long-lived cross-cloud keys, all three directions now have a keyless option. Our [DataSync vs Storage Mover](/compare/aws-datasync-vs-azure-storage-mover/) and [DataSync vs Storage Transfer Service](/compare/aws-datasync-vs-gcp-storage-transfer-service/) pages don't mention authentication yet; that's worth adding.

## Post-quantum TLS at the edge, now on all three clouds

On Nov 5, Azure made a [TLS key exchange policy for Azure Front Door](https://azure.microsoft.com/updates?id=577668) generally available. You can pick a predefined Standard or Enhanced policy, or a Custom one that selects specific classical and hybrid post-quantum key exchange groups. Microsoft notes that hybrid post-quantum key exchange needs TLS 1.3 and only covers client-to-edge connections, not Front Door to your origin.

How the three CDNs and edge load balancers compare on this:

| | Amazon CloudFront | Azure Front Door | Google Cloud load balancers |
|---|---|---|---|
| Hybrid post-quantum key exchange | [X25519MLKEM768 and SecP256r1MLKEM768](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-viewer-protocols-ciphers.html), TLS 1.3 only | Hybrid post-quantum groups through the new key exchange policy, TLS 1.3 only | [X25519MLKEM768](https://docs.cloud.google.com/load-balancing/docs/post-quantum-tls), for clients that advertise TLS 1.3 and support it |
| How you turn it on | [AWS says](https://aws.amazon.com/security/post-quantum-cryptography/aws-pq-readiness-confidentiality/) it works on all existing viewer security policies by default, with no reconfiguration | Choose a Standard, Enhanced or Custom key exchange policy | The SSL policy setting; Google's [rollout timeline](https://docs.cloud.google.com/load-balancing/docs/ssl-policies-concepts) enables it by default after October 2026, and `DEFERRED` holds it off until October 2027 |
| Edge to origin | AWS lists origin support as coming soon | Not covered | Frontend connections only |

The practical takeaway is the same on every cloud: the edge can now negotiate post-quantum key exchange with modern browsers, but the hop to your origin is a separate problem. See [CloudFront vs Front Door](/compare/aws-cloudfront-vs-azure-front-door/) and [CloudFront vs Cloud CDN](/compare/aws-cloudfront-vs-gcp-cloud-cdn/).

## Retirements and smaller changes

- **Azure Fluid Relay retires on June 2, 2027.** Microsoft's [retirement notice](https://azure.microsoft.com/updates?id=570498) says the open-source Fluid Framework stays available and the replacement is a self-hosted Fluid service, which you operate yourself. We don't map Fluid Relay on this site, and there's no managed Fluid service on AWS or Google Cloud to move to, so self-hosting is the path on any cloud.
- **Microsoft Defender for IoT's OT security component is being deprecated,** with full deprecation planned for October 2029 after a three-year transition ([notice](https://azure.microsoft.com/updates?id=576255)). Enterprise IoT capabilities in Defender for Endpoint aren't affected. Not on our site today.
- **AWS Security Hub now has an SBOM inventory** built from the SBOMs Amazon Inspector generates for EC2, ECR images and Lambda, at no extra cost in Security Hub Essentials ([announcement](https://aws.amazon.com/about-aws/whats-new/2026/11/security-hub-sbom-inventory/)). It adds weight to the "one scanner across VMs, containers and functions" difference on [Inspector vs Defender for Servers](/compare/aws-inspector-vs-azure-defender-for-servers/) and [Inspector vs Artifact Analysis](/compare/aws-inspector-vs-gcp-artifact-analysis/).
- **Amazon RDS now shows snapshot cost per snapshot** instead of rolled up per instance, using cost allocation tags, on by default at no charge ([announcement](https://aws.amazon.com/about-aws/whats-new/2026/11/amazon-rds-per-snapshot-billing/)). Handy if you're comparing backup storage spend before a move.
- **Certifications:** no AWS, Azure or Google Cloud infrastructure exam changes in the official certification feeds this week. Microsoft's one new credential is the [Supply Chain Management AI Consultant Associate](https://techcommunity.microsoft.com/t5/the-skills-hub-blog/new-microsoft-certified-supply-chain-management-ai-consultant/ba-p/4564533) (Exam AB-330, in beta), which is about Dynamics 365 rather than Azure infrastructure. For the Azure exams that line up with AWS experience, see our [exam guides for AWS engineers](/exams/).
