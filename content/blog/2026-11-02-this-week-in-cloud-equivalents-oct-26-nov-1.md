---
title: "This week in cloud equivalents: Oct 26 – Nov 1, 2026"
date: 2026-11-02
description: "Google Cloud gets an EVS-style self-managed VMware option, hard spend caps and RDS-style blue/green, plus AWS exam cutoffs and Microsoft's no-exam Pro Badge."
tags: [weekly, aws, azure, gcp, certification]
compares: [vmware-cloud, blue-green-upgrades, agent-tools, workflow-orchestration, web-application-firewall, ddos-protection]
sources:
  - title: "Introducing VMware solution on Google Cloud (Google Cloud Blog, Oct 27, 2026)"
    url: https://cloud.google.com/blog/products/infrastructure-modernization/vmware-solution-on-google-cloud/
  - title: "Google Cloud spend caps now generally available (Google Cloud Blog, Oct 30, 2026)"
    url: https://cloud.google.com/blog/topics/cost-management/google-cloud-spend-caps-now-generally-available/
  - title: "Configuring budget actions (AWS Cost Management User Guide)"
    url: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html
  - title: "Create and manage budgets (Microsoft Cost Management)"
    url: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets
  - title: "Azure spending limit (Microsoft Cost Management)"
    url: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit
  - title: "Announcing Cloud SQL for MySQL blue-green deployments (Google Cloud Blog, Oct 28, 2026)"
    url: https://cloud.google.com/blog/products/databases/cloud-sql-blue-green-deployments/
  - title: "Overview of Amazon RDS Blue/Green Deployments (Amazon RDS User Guide)"
    url: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-overview.html
  - title: "Register now: Updated Developer Associate and Solutions Architect Professional exams (AWS Training and Certification Blog, Oct 27, 2026)"
    url: https://aws.amazon.com/blogs/training-and-certification/register-now-updated-developer-associate-and-solutions-architect-professional-exams/
  - title: "Introducing a credential based on real work, no test required (Microsoft Skills Hub Blog, Oct 28, 2026)"
    url: https://techcommunity.microsoft.com/t5/the-skills-hub-blog/introducing-a-credential-based-on-real-work-no-test-required/ba-p/4519039
  - title: "Generally Available: Azure MCP Server 3.0 (Azure Updates, Oct 29, 2026)"
    url: https://azure.microsoft.com/updates?id=578662
  - title: "AWS Step Functions workflows now available as AI agent tools (AWS What's New, Oct 29, 2026)"
    url: https://aws.amazon.com/about-aws/whats-new/2026/10/step-functions-workflows-ai-agent-tools/
  - title: "Create remote MCP servers from Standard workflows (Azure Logic Apps documentation)"
    url: https://learn.microsoft.com/en-us/azure/logic-apps/set-up-model-context-protocol-server-standard
  - title: "Generally Available: Azure Front Door profile and route level WAF policies (Azure Updates, Oct 27, 2026)"
    url: https://azure.microsoft.com/updates?id=578153
  - title: "Generally Available: HTTP DDoS ruleset for Azure Front Door Premium WAF (Azure Updates, Oct 29, 2026)"
    url: https://azure.microsoft.com/updates?id=578681
  - title: "AWS WAF Distributed Denial of Service (DDoS) prevention rule group (AWS WAF Developer Guide)"
    url: https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-anti-ddos.html
  - title: "Announcing: Migrate Azure Container Apps logging destination from Log Analytics to Azure Monitor (Azure Updates, Oct 28, 2026)"
    url: https://azure.microsoft.com/updates?id=577689
---

Most of this week's launches only matter if you live on one cloud. A few of them change how the clouds line up against each other, and that's what this post is about. The biggest mover was Google Cloud, which shipped two features that close gaps where AWS already had an answer, and a third, hard spending caps, where it now goes further than both AWS and Azure.

## Google Cloud now has a self-managed VMware option, like Amazon EVS

On Oct 27, Google Cloud made the [VMware solution on Google Cloud](https://cloud.google.com/blog/products/infrastructure-modernization/vmware-solution-on-google-cloud/) generally available. It runs VMware Cloud Foundation (VCF) 9.x on dedicated Compute Engine Z3 bare metal, with full root access to ESXi, vCenter, NSX Manager and the rest of the VCF stack. You bring your own portable VCF subscription from Broadcom, and you (or a partner) handle updates.

That's a different operating model from Google Cloud VMware Engine, which Google describes in the same post as the turnkey option: VCF 5.2, role-based vCenter admin rights, and patching managed by Google. Google now offers both.

Why it matters for comparisons:

- Our [Amazon EVS vs Google Cloud VMware Engine](/compare/aws-evs-vs-gcp-vmware-engine/) page maps EVS to VMware Engine and lists the operating model as the main difference, because EVS is self-managed in your VPC. Google now has a self-managed counterpart on bare metal, so the closer match for EVS is the new VMware solution, while VMware Engine lines up better with [Azure VMware Solution](/compare/aws-evs-vs-azure-vmware-solution/), which Microsoft operates.
- The licensing story is now the same on all three clouds: bring a portable VCF subscription from Broadcom.
- On Azure, the VMware option we map is Azure VMware Solution, which Microsoft operates. If you're moving from EVS to Azure and want to keep root access to the whole stack, that's a real difference to plan for.

## Spend caps that actually stop usage, and how AWS and Azure compare

On Oct 30, Google Cloud made [spend caps on Cloud Billing budgets](https://cloud.google.com/blog/topics/cost-management/google-cloud-spend-caps-now-generally-available/) generally available. A cap pauses usage of eligible services in a project once the budget is hit, without deleting resources. With GA you also get an API (part of the Cloud Billing Budgets API), automatic monthly resets, and estimated live costs in Cost Reports. Google says caps for AI services trigger within minutes using those estimates. Two caveats from the announcement: caps apply to eligible services, and Provisioned Throughput is never halted.

Here's how that lines up with the other two clouds:

| | Google Cloud | AWS | Azure |
|---|---|---|---|
| Built-in hard stop on spend | Spend caps on budgets, per project, for eligible services | No general cap. [Budget actions](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html) can apply an IAM policy or SCP, or target specific EC2 or RDS instances, automatically or after approval | [Budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets) only notify; resources aren't affected. They can call an action group that runs your own automation |
| Closest "stop everything" switch | Spend cap | An SCP deny applied by a budget action stops new provisioning; running resources keep billing unless targeted | The [spending limit](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit), only on free and credit-based subscriptions, fixed at the credit amount, not available on pay-as-you-go |

If you're coming from Google Cloud to AWS or Azure, the habit "set a cap and forget it" doesn't carry over. On AWS you build the guardrail from budget actions; on Azure you write the automation behind an action group. We don't have a cost-management mapping on this site yet, and this is a good reason to add one.

## Cloud SQL gets blue/green upgrades, which RDS has had for a while

On Oct 28, Google announced [blue-green deployments for Cloud SQL for MySQL](https://cloud.google.com/blog/products/databases/cloud-sql-blue-green-deployments/) in preview. Cloud SQL clones your instance, upgrades the clone to the target version, keeps it in sync with replication, and at switchover moves the IP address, instance name and backups to the upgraded instance. Google says PostgreSQL support is coming.

That's the same shape as [Amazon RDS Blue/Green Deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-overview.html), which supports RDS for MySQL, MariaDB and PostgreSQL and keeps names and endpoints at switchover. Our [RDS Blue/Green vs Google Cloud](/compare/aws-rds-blue-green-vs-gcp/) page currently says Cloud SQL has no blue/green feature, which is no longer true for MySQL. It's still preview and MySQL-only, so treat it as a partial match for now. The Azure side of [the same comparison](/compare/aws-rds-blue-green-vs-azure-postgresql-major-version-upgrade/) is unchanged this week.

## Certifications: two AWS cutoffs this month, and a Microsoft badge with no exam

The [AWS Training and Certification Blog](https://aws.amazon.com/blogs/training-and-certification/register-now-updated-developer-associate-and-solutions-architect-professional-exams/) opened registration for the updated Developer Associate (DVA-C03) and Solutions Architect Professional (SAP-C03) exams on Oct 27. The last day to take SAP-C02 is Nov 16, 2026, and the last day for DVA-C02 is Nov 30, 2026. AWS says the new exam guides include a comparison of old and new domains. If you're mid-prep on the old versions, book now or plan to switch.

On the Microsoft side, the [Skills Hub Blog](https://techcommunity.microsoft.com/t5/the-skills-hub-blog/introducing-a-credential-based-on-real-work-no-test-required/ba-p/4519039) announced Microsoft Pro Badge on Oct 28. The first one is Pro Badge: GitHub Copilot. There's no exam: you opt in with a personal GitHub account, and your level is calculated from how you use Copilot over time. At launch it supports Beginner, Intermediate and Proficient, and you need Proficient to earn the badge. Microsoft says it works alongside certifications rather than replacing them, and Enterprise Managed User accounts aren't supported yet.

There's no AWS equivalent of a usage-based credential today. For an AWS developer moving to Azure, the exam route is still the main one; see our [exam guides for AWS engineers](/exams/) for which Azure exam lines up with what you already know.

## Agents and MCP: workflows become tools on both AWS and Azure

Two launches point the same way:

- AWS made [Step Functions workflows available as AI agent tools](https://aws.amazon.com/about-aws/whats-new/2026/10/step-functions-workflows-ai-agent-tools/) through Amazon Bedrock AgentCore Gateway on Oct 29. The agent picks the workflow and input; Step Functions runs the steps as defined. Standard and Express workflows both work.
- Azure made [Azure MCP Server 3.0](https://azure.microsoft.com/updates?id=578662) generally available the same day, adding Terraform, Azure Backup and Advisor tools. It includes breaking changes, so check the upgrade guidance first.

The closest Azure counterpart to the Step Functions launch is [Logic Apps Standard workflows exposed as remote MCP servers](https://learn.microsoft.com/en-us/azure/logic-apps/set-up-model-context-protocol-server-standard), which is still in preview. The pattern is the same (a deterministic workflow behind an MCP tool), but the AWS version is wired through AgentCore Gateway, while Logic Apps serves MCP directly from the workflow app. See [Step Functions vs Logic Apps](/compare/aws-step-functions-vs-azure-logic-apps/) and [AgentCore Gateway vs Foundry agent tools](/compare/aws-agentcore-gateway-vs-azure-foundry-agent-tools/) for the wider mapping.

## Smaller changes worth knowing

- **Azure Front Door WAF** now supports policies at the [profile and route level](https://azure.microsoft.com/updates?id=578153), not just per domain, with the most specific scope winning. It also made the adaptive [HTTP DDoS ruleset](https://azure.microsoft.com/updates?id=578681) generally available for Front Door Premium. The nearest AWS feature is the [AWS WAF anti-DDoS managed rule group](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-anti-ddos.html). See [AWS WAF vs Azure WAF](/compare/aws-waf-vs-azure-waf/) and [AWS Shield vs Azure DDoS Protection](/compare/aws-shield-vs-azure-ddos-protection/).
- **Azure Container Apps** marked the Log Analytics logging destination as [legacy](https://azure.microsoft.com/updates?id=577689) and recommends moving to the Azure Monitor destination. If your queries, dashboards or alerts read the `ContainerAppConsoleLogs_CL` or `ContainerAppSystemLogs_CL` tables, you're on the legacy destination and should plan the move. More context in [Amazon ECS vs Azure Container Apps](/compare/aws-ecs-vs-azure-container-apps/).
