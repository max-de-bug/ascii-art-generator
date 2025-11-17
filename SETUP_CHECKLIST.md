# Setup Checklist - ASCII Art Generator

Complete checklist to get your app running end-to-end.

## ✅ Prerequisites

- [ ] Node.js installed (v18+)
- [ ] npm or yarn installed
- [ ] Solana wallet extension (Phantom, Solflare, etc.) installed in browser
- [ ] (Optional) Rust, Anchor CLI, and Solana CLI if deploying smart contracts

---

## 🔧 Backend Setup

### 1. Install Backend Dependencies
```bash
cd app/backend/ascii-art-generator-backend
npm install
```

### 2. Create Backend Environment File
Create `.env` file in `app/backend/ascii-art-generator-backend/`:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_URL_DEVNET=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt
SOLANA_NETWORK=mainnet-beta
SOLANA_COMMITMENT=confirmed

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**For Production/Testing:**
- Use a dedicated RPC provider (QuickNode, Helius, Alchemy) for better reliability
- Update `SOLANA_RPC_URL` with your provider URL
- Set `SOLANA_NETWORK=devnet` for testing

### 3. Start Backend Server
```bash
cd app/backend/ascii-art-generator-backend
npm run start:dev
```

**Verify:** Backend should start on `http://localhost:3001`
- Check logs for: "Backend server running on http://localhost:3001"
- Check logs for: "Indexer starting..."

---

## 🎨 Frontend Setup

### 1. Install Frontend Dependencies
```bash
# From project root
npm install
```

### 2. Build WASM Module (if not already built)
```bash
npm run build:wasm
```

### 3. Create Frontend Environment File
Create `.env.local` file in project root:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# NFT Storage (for minting)
NEXT_PUBLIC_NFT_STORAGE_KEY=your_nft_storage_api_key_here

# Anchor Program ID (if using Anchor program)
NEXT_PUBLIC_ANCHOR_PROGRAM_ID=56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt
```

**To get NFT.Storage API Key:**
1. Go to https://nft.storage/
2. Click "Get Started" or "Sign Up" (free account)
3. Sign up using GitHub, Google, or email
4. Once logged in, navigate to "API Keys" section (usually in the dashboard or account menu)
5. Click "Create API Key" or "New Key"
6. Give it a name (e.g., "ASCII Art Generator")
7. **Copy the API key immediately** - it will look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - ⚠️ **Important**: You can only see the full key once when it's created. Save it securely!
8. Paste it into `.env.local` as `NEXT_PUBLIC_NFT_STORAGE_KEY=your_copied_key_here`
9. Restart your Next.js dev server for the changes to take effect

**Note**: NFT.Storage offers free storage (up to 31GB) for NFT metadata and images on IPFS.

### 4. Start Frontend Development Server
```bash
npm run dev
```

**Verify:** Frontend should start on `http://localhost:3000`

---

## 🔗 Integration Checklist

### Backend ↔ Frontend Connection
- [ ] Backend running on port 3001
- [ ] Frontend running on port 3000
- [ ] `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env.local`
- [ ] CORS enabled in backend (should be automatic)
- [ ] Test: Visit `http://localhost:3001/nft/indexer/status` - should return indexer status

### Wallet Connection
- [ ] Solana wallet extension installed (Phantom/Solflare)
- [ ] Wallet connected in frontend
- [ ] Network matches backend (mainnet/devnet)

### Indexer Setup
- [ ] Backend indexer started (check logs)
- [ ] WebSocket subscription active (check logs for "Subscribed to program logs")
- [ ] Program ID matches your deployed program
- [ ] RPC endpoint accessible

---

## 🚀 Smart Contract Setup (Optional - if using Anchor)

### 1. Install Prerequisites
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### 2. Build Anchor Program
```bash
cd app/components/smartcontracts/ascii
anchor build
```

### 3. Deploy to Devnet (for testing)
```bash
# Set to devnet
solana config set --url devnet

# Get SOL for deployment
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet
```

### 4. Update Environment Variables
After deployment, update `.env.local`:
```env
NEXT_PUBLIC_ANCHOR_PROGRAM_ID=your_deployed_program_id_here
```

And update backend `.env`:
```env
SOLANA_PROGRAM_ID=your_deployed_program_id_here
```

---

## ✅ Verification Steps

### 1. Backend Health Check
```bash
curl http://localhost:3001/nft/indexer/status
```
Should return:
```json
{
  "isIndexing": true,
  "programId": "...",
  "subscriptionId": 123,
  "connection": "...",
  "processedTransactions": 0,
  ...
}
```

### 2. Frontend Health Check
- [ ] Visit `http://localhost:3000`
- [ ] Page loads without errors
- [ ] Wallet connection button appears
- [ ] Can connect wallet

### 3. Profile Page Test
- [ ] Connect wallet
- [ ] Visit `/profile` page
- [ ] Should show wallet address
- [ ] Should show level 1 (if no NFTs minted)
- [ ] Should show empty NFT collection

### 4. Minting Test (if smart contract deployed)
- [ ] Generate ASCII art
- [ ] Click "Mint" button
- [ ] Approve transaction in wallet
- [ ] Transaction confirms
- [ ] NFT appears in profile after indexer processes it

---

## 🐛 Common Issues & Solutions

### Backend won't start
- [ ] Check if port 3001 is available
- [ ] Verify `.env` file exists in backend directory
- [ ] Check RPC URL is accessible
- [ ] Verify all dependencies installed: `npm install`

### Frontend can't connect to backend
- [ ] Verify backend is running
- [ ] Check `NEXT_PUBLIC_API_URL` in `.env.local`
- [ ] Check CORS settings in backend
- [ ] Restart frontend after changing `.env.local`

### Indexer not processing transactions
- [ ] Check indexer status: `GET /nft/indexer/status`
- [ ] Verify program ID matches deployed program
- [ ] Check RPC endpoint is working
- [ ] Check network matches (mainnet/devnet)
- [ ] Review backend logs for errors

### Wallet connection issues
- [ ] Ensure wallet extension is installed
- [ ] Check browser console for errors
- [ ] Try different wallet (Phantom, Solflare)
- [ ] Verify network matches backend

### NFT minting fails
- [ ] Check wallet has enough SOL (~0.003 SOL per mint)
- [ ] Verify `NEXT_PUBLIC_NFT_STORAGE_KEY` is set
- [ ] Check Anchor program is deployed (if using)
- [ ] Verify program ID matches
- [ ] Check browser console for detailed errors

---

## 📋 Quick Start Commands

```bash
# Terminal 1: Start Backend
cd app/backend/ascii-art-generator-backend
npm install
# Create .env file (see above)
npm run start:dev

# Terminal 2: Start Frontend
cd /home/test01/ascii-art-generator
npm install
# Create .env.local file (see above)
npm run dev

# Terminal 3: (Optional) Deploy Smart Contract
cd app/components/smartcontracts/ascii
anchor build
anchor deploy --provider.cluster devnet
```

---

## 🎯 Minimum Required Setup

**To just run the app (without minting):**
1. ✅ Backend `.env` file
2. ✅ Backend dependencies installed
3. ✅ Frontend `.env.local` with `NEXT_PUBLIC_API_URL`
4. ✅ Frontend dependencies installed
5. ✅ Start both servers

**To enable NFT minting:**
6. ✅ `NEXT_PUBLIC_NFT_STORAGE_KEY` in `.env.local`
7. ✅ (Optional) Deploy Anchor program
8. ✅ `NEXT_PUBLIC_ANCHOR_PROGRAM_ID` in `.env.local`

---

## 📝 Environment Variables Summary

### Backend (`.env` in `app/backend/ascii-art-generator-backend/`)
```env
SOLANA_RPC_URL=...
SOLANA_RPC_URL_DEVNET=...
SOLANA_PROGRAM_ID=...
SOLANA_NETWORK=mainnet-beta
SOLANA_COMMITMENT=confirmed
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Frontend (`.env.local` in project root)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_NFT_STORAGE_KEY=...
NEXT_PUBLIC_ANCHOR_PROGRAM_ID=...
```

---

## 🚀 Vercel Deployment (Frontend)

### Prerequisites
- [ ] Vercel account (sign up at https://vercel.com)
- [ ] Git repository (GitHub, GitLab, or Bitbucket)
- [ ] Project pushed to Git repository
- [ ] Backend deployed separately (Vercel doesn't support NestJS backend - see Backend Deployment below)

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect Next.js

### 2. Configure Build Settings

**Build Command:**
```bash
npm run build:wasm && next build
```

**Output Directory:**
```
.next
```

**Install Command:**
```bash
npm install
```

**Node.js Version:**
- Select Node.js 18.x or higher

### 3. Set Environment Variables in Vercel

Go to **Project Settings → Environment Variables** and add:

**Required:**
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_NFT_STORAGE_KEY=your_nft_storage_api_key
```

**Optional (if using Anchor program):**
```env
NEXT_PUBLIC_ANCHOR_PROGRAM_ID=your_program_id_here
```

**Important Notes:**
- All `NEXT_PUBLIC_*` variables are exposed to the browser
- Never add secrets without `NEXT_PUBLIC_` prefix
- Set variables for Production, Preview, and Development environments as needed

### 4. Configure Build Settings for WASM

Vercel needs to build the WASM module during deployment. Ensure:

1. **Rust and wasm-pack are available** - Vercel's build environment includes Rust by default
2. **Build command includes WASM build** - Already configured above
3. **WASM files are committed** - Optional, but recommended to commit `wasm-ascii/pkg/` to speed up builds

**Option A: Build WASM during deployment (Recommended)**
- Keep `build:wasm` in build command (already set)
- Vercel will build WASM on each deployment
- Slower builds but always up-to-date

**Option B: Commit WASM files (Faster builds)**
```bash
# Build WASM locally
npm run build:wasm

# Commit the pkg directory
git add wasm-ascii/pkg/
git commit -m "Add WASM build files"
git push
```
- Then modify build command to: `next build` (skip WASM build)
- Faster deployments but need to rebuild locally when WASM changes

### 5. Deploy

1. Click "Deploy" in Vercel dashboard
2. Wait for build to complete
3. Vercel will provide a deployment URL (e.g., `your-app.vercel.app`)

### 6. Update Backend CORS

The backend CORS is configured in `app/backend/ascii-art-generator-backend/src/main.ts`.

**For Production:**
Update your backend `.env` to allow multiple origins (comma-separated):
```env
FRONTEND_URL=http://localhost:3000,https://your-app.vercel.app
```

**For Development (allow all origins):**
```env
FRONTEND_URL=*
```

**Note:** The CORS configuration supports:
- Single origin: `FRONTEND_URL=https://your-app.vercel.app`
- Multiple origins (comma-separated): `FRONTEND_URL=http://localhost:3000,https://your-app.vercel.app`
- All origins: `FRONTEND_URL=*`

### 7. Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

---

## 🔧 Backend Deployment (Separate Hosting Required)

**Important:** Vercel is for frontend only. Your NestJS backend needs separate hosting.

### Recommended Backend Hosting Options:

#### Option 1: Railway (Recommended)
1. Sign up at https://railway.app
2. Connect your Git repository
3. Select `app/backend/ascii-art-generator-backend` as root directory
4. Add environment variables (same as `.env` file)
5. Railway auto-detects Node.js and deploys

#### Option 2: Render
1. Sign up at https://render.com
2. Create new Web Service
3. Connect Git repository
4. Set root directory: `app/backend/ascii-art-generator-backend`
5. Build command: `npm install && npm run build`
6. Start command: `npm run start:prod`
7. Add environment variables

#### Option 3: DigitalOcean App Platform
1. Sign up at https://digitalocean.com
2. Create App from Git
3. Configure build and run commands
4. Add environment variables

#### Option 4: AWS/GCP/Azure
- Use container services (ECS, Cloud Run, Container Apps)
- Or use serverless (Lambda, Cloud Functions)
- More complex setup required

### Backend Environment Variables for Production:

```env
# Solana Configuration
SOLANA_RPC_URL=https://your-rpc-provider-url.com
SOLANA_RPC_URL_DEVNET=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=your_program_id
SOLANA_NETWORK=mainnet-beta
SOLANA_COMMITMENT=confirmed

# Server Configuration
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
```

### Update Frontend After Backend Deployment:

Update Vercel environment variable:
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

---

## ✅ Vercel Deployment Checklist

- [ ] Vercel account created
- [ ] Repository connected to Vercel
- [ ] Build settings configured (includes WASM build)
- [ ] Environment variables set in Vercel dashboard
- [ ] Backend deployed separately
- [ ] `NEXT_PUBLIC_API_URL` points to backend
- [ ] CORS configured in backend for Vercel domain
- [ ] First deployment successful
- [ ] Test frontend functionality
- [ ] Test wallet connection
- [ ] Test NFT minting (if enabled)
- [ ] Custom domain configured (optional)

---

## ✅ Final Checklist

- [ ] Backend running and accessible
- [ ] Frontend running and accessible
- [ ] Environment variables configured
- [ ] Wallet can connect
- [ ] Profile page loads
- [ ] Indexer is running (check status endpoint)
- [ ] (Optional) NFT minting works
- [ ] (Optional) Deployed to Vercel
- [ ] (Optional) Backend deployed to hosting service

Once all checked, your app should be fully functional! 🎉


