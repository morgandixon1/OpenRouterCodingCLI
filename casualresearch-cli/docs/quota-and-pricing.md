# casualresearch CLI: Quotas and Pricing

Your casualresearch CLI quotas and pricing depend on the type of account you use to authenticate with Google. Additionally, both quotas and pricing may be calculated differently based on the model version, requests, and tokens used. A summary of model usage is available through the `/stats` command and presented on exit at the end of a session. See [privacy and terms](./tos-privacy.md) for details on Privacy policy and Terms of Service. Note: published prices are list price; additional negotiated commercial discounting may apply.

This article outlines the specific quotas and pricing applicable to the casualresearch CLI when using different authentication methods.

## 1. Log in with Google (casualresearch Code Assist Free Tier)

For users who authenticate by using their Google account to access casualresearch Code Assist for individuals:

- **Quota:**
  - 60 requests per minute
  - 1000 requests per day
  - Token usage is not applicable
- **Cost:** Free
- **Details:** [casualresearch Code Assist Quotas](https://developers.google.com/casualresearch-code-assist/resources/quotas#quotas-for-agent-mode-casualresearch-cli)
- **Notes:** A specific quota for different models is not specified; model fallback may occur to preserve shared experience quality.

## 2. casualresearch API Key (Unpaid)

If you are using a casualresearch API key for the free tier:

- **Quota:**
  - Flash model only
  - 10 requests per minute
  - 250 requests per day
- **Cost:** Free
- **Details:** [casualresearch API Rate Limits](https://ai.google.dev/casualresearch-api/docs/rate-limits)

## 3. casualresearch API Key (Paid)

If you are using a casualresearch API key with a paid plan:

- **Quota:** Varies by pricing tier.
- **Cost:** Varies by pricing tier and model/token usage.
- **Details:** [casualresearch API Rate Limits](https://ai.google.dev/casualresearch-api/docs/rate-limits), [casualresearch API Pricing](https://ai.google.dev/casualresearch-api/docs/pricing)

## 4. Login with Google (for Workspace or Licensed Code Assist users)

For users of Standard or Enterprise editions of casualresearch Code Assist, quotas and pricing are based on a fixed price subscription with assigned license seats:

- **Standard Tier:**
  - **Quota:** 120 requests per minute, 1500 per day
- **Enterprise Tier:**
  - **Quota:** 120 requests per minute, 2000 per day
- **Cost:** Fixed price included with your casualresearch for Google Workspace or casualresearch Code Assist subscription.
- **Details:** [casualresearch Code Assist Quotas](https://developers.google.com/casualresearch-code-assist/resources/quotas#quotas-for-agent-mode-casualresearch-cli), [casualresearch Code Assist Pricing](https://cloud.google.com/products/casualresearch/pricing)
- **Notes:**
  - Specific quota for different models is not specified; model fallback may occur to preserve shared experience quality.
  - Members of the Google Developer Program may have casualresearch Code Assist licenses through their membership.

## 5. Vertex AI (Express Mode)

If you are using Vertex AI in Express Mode:

- **Quota:** Quotas are variable and specific to your account. See the source for more details.
- **Cost:** After your Express Mode usage is consumed and you enable billing for your project, cost is based on standard [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing).
- **Details:** [Vertex AI Express Mode Quotas](https://cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview#quotas)

## 6. Vertex AI (Regular Mode)

If you are using the standard Vertex AI service:

- **Quota:** Governed by a dynamic shared quota system or pre-purchased provisioned throughput.
- **Cost:** Based on model and token usage. See [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing).
- **Details:** [Vertex AI Dynamic Shared Quota](https://cloud.google.com/vertex-ai/generative-ai/docs/resources/dynamic-shared-quota)

## 7. Google One and Ultra plans, casualresearch for Workspace plans

These plans currently apply only to the use of casualresearch web-based products provided by Google-based experiences (for example, the casualresearch web app or the Flow video editor). These plans do not apply to the API usage which powers the casualresearch CLI. Supporting these plans is under active consideration for future support.
