# wehavepastebinathome

A self-hosted pastebin with optional client-side encryption.

## Features

- Create pastes with optional title, syntax highlighting, and expiry
- **End-to-end encryption** — content is encrypted in the browser before being sent; the server never sees plaintext
  - No password: a random key is generated and embedded in the share URL (`/id#key`)
  - With password: encrypted with your password, not included in the URL
- Syntax highlighting via highlight.js (viewer)
- Slug-based URLs when a title is set (`/my-paste`), random IDs otherwise
- Auto-expiry with daily cleanup
- Rate limiting (30 pastes per IP per 15 minutes)

## Running locally

```bash
npm install
npm run dev     # auto-restarts on file changes
# or
npm start       # production
```

Runs at http://localhost:3000. The SQLite database (`pastes.db`) is created automatically on first run.

## Deploying to AWS

Provisions a `t3.micro` EC2 instance (free tier eligible) with nginx + PM2.

**Prerequisites**

- [Terraform](https://developer.hashicorp.com/terraform/install)
- [AWS CLI](https://aws.amazon.com/cli/) configured (`aws configure`)
- An EC2 key pair — create one in the AWS console and download the `.pem` file

**First deploy**

```bash
cd terraform
terraform init
terraform apply -var="key_name=your-key-name"
# note the public_ip from the output

cd ..
./scripts/deploy.sh <public_ip> ~/.ssh/your-key-name.pem
```

**Subsequent deploys**

```bash
./scripts/deploy.sh <public_ip> ~/.ssh/your-key-name.pem
```

**Adding HTTPS** (requires a domain pointing at the server IP)

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<ip>
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Project structure

```
server.js          Express app — routes, rate limiting, ID generation
db.js              SQLite wrapper (node:sqlite)
public/
  index.html       Create paste form
  paste.html       Paste viewer
  crypto.js        Shared Web Crypto API helpers (PBKDF2 + AES-GCM)
terraform/
  main.tf          EC2 instance, security group, Elastic IP
  variables.tf     region, key_name, instance_type
  outputs.tf       public IP, SSH command, URL
scripts/
  setup.sh         User data — installs Node.js, nginx, PM2 on first boot
  deploy.sh        Rsyncs code and restarts PM2
```

## Security

Encryption uses the browser's built-in Web Crypto API — no external libraries.

- **Key derivation:** PBKDF2-HMAC-SHA256, 210,000 iterations, 16-byte random salt per paste
- **Encryption:** AES-GCM 256-bit, 12-byte random IV per paste
- **Wire format:** `base64url(salt[16] + iv[12] + ciphertext)` stored in the database
- The URL fragment (`#key`) is never sent to the server by the browser

> **Note:** E2E encryption protects data at rest on the server. HTTPS is required to prevent a network attacker from tampering with the JavaScript. Run behind nginx + Certbot in production.
