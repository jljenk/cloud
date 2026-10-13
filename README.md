# Word cloud

A small event app for AWS Amplify. The host creates a word cloud, shares a participant link, and reveals the cloud only on a private admin screen.

Participants can submit a word or short phrase. They never receive other people's words or the cloud. The admin link shows a live response count, then a full-screen cloud after **Show word cloud**.

## Cost

The backend is pay-per-request and stays near $0 while nobody is using it:

- DynamoDB on-demand, no global indexes, and no table scans
- One ARM Lambda (256 MB, 10 second timeout) behind an API Gateway HTTP API, throttled to about 5 requests per second
- No Cognito, AppSync, VPC, NAT gateway, or provisioned capacity
- CloudWatch logs expire after 7 days
- Amplify Hosting serves a static build. You pay for build minutes when you deploy, plus a tiny amount of storage

Amplify Data is not used. Its DynamoDB tables default to provisioned capacity, which bills while the app is idle.

The word-cloud table is retained if you delete the stack, so a deploy does not wipe an event. An on-demand table with no traffic has no request charges. Storage is a fraction of a cent.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server runs the same request handler as the Lambda, with an in-memory store at http://localhost:8787. That store is empty each time you restart, and it is not used in production.

```bash
npm test
npm run build
```

## Deploy on Amplify

This repo is an Amplify Gen 2 app. `ampx` expects Node.js 22 or newer.

1. Push the repo to GitHub.
2. In the Amplify console, create a new app, connect the repo, and let it use the `amplify.yml` build spec. The backend and the static frontend deploy together.
3. Open **Hosting > Rewrites and redirects** and add the rule in [redirects.json](redirects.json), so `/c/...` and `/a/...` open the app instead of a 404. Amplify does not read that file on its own. In the console that rule is source `/<*>`, target `/index.html`, type **404 (Rewrite)**.

4. Open the deployed URL, create a cloud, and save both links. The admin link cannot be recovered. The secret is stored only as a hash.

After local sandbox work, delete it so a dev stack is not left running:

```bash
npx ampx sandbox
npx ampx sandbox delete
```

Sandbox deploys the real pay-per-request API. Day-to-day UI work does not need it.
