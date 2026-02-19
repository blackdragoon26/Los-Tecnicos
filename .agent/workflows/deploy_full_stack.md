---
description: How to deploy the full stack application (Smart Contracts, Backend, Frontend)
---

# Full Stack Deployment Workflow

This workflow outlines the steps to deploy the entire "Los Tecnicos" application, ensuring that smart contract changes are correctly propagated to the backend and frontend.

## Prerequisites

-   `stellar-cli` installed and configured.
-   Access to Render (for Backend) and Vercel (for Frontend).
-   `git` installed and configured.

## 1. Deploy Smart Contracts

This is the **source of truth**. When you deploy contracts, you get new Contract IDs. These IDs must be updated in the backend.

1.  Navigate to the project root.
2.  Run the deployment script:
    ```bash
    ./stellar_smart_contract/deploy.sh
    ```
    *This script automatically updates `backend/.env` with the new `MARKETPLACE_CONTRACT_ID` and `TOKEN_CONTRACT_ID`.*

## 2. Deploy Backend (Render)

The backend needs the **new** environment variables from Step 1.

1.  **Commit and Push** the changes to `backend/.env` (or specifically the new Contract IDs) to your git repository.
    *   *Note: Ensure you are not committing sensitive secrets like keys if the repo is public. If using Render's Environment Variables UI, you must manually update them there with the values from your local `backend/.env`.*
2.  **Trigger Deployment**:
    -   If you have auto-deploy enabled on Render, pushing to `main` (or your branch) will trigger a build.
    -   Otherwise, manually trigger a deploy in the Render dashboard.
3.  **Verify**:
    -   Check Render logs to ensure the backend starts up with the new configuration.

## 3. Deploy Frontend (Vercel)

The frontend connects to the deployed backend.

1.  **Check Configuration**:
    -   Ensure `frontend/.env.production` (or Vercel Environment Variables) points `NEXT_PUBLIC_API_URL` to your **Render Backend URL** (e.g., `https://los-tecnicos-backend.onrender.com/api/v1`).
    -   **Important**: Do NOT use `localhost` for the deployed frontend.
2.  **Trigger Deployment**:
    -   Pushing to `main` usually triggers a Vercel deployment.
3.  **Verify**:
    -   Open your Vercel URL.
    -   Check the console to ensure it's connecting to the Render backend (not localhost).

## Summary of Data Flow

1.  **Smart Contract** (Deploy) -> Outputs **Contract IDs**.
2.  **Contract IDs** -> specific to -> **Backend Environment**.
3.  **Backend** -> provides API to -> **Frontend**.
