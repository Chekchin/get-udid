# UDID Finder

Website ឲ្យអ្នកប្រើ iPhone/iPad ទាញយក UDID ដោយខ្លួនឯង។ មិនត្រូវការ npm package ណាមួយទេ (Node.js 16+ តែប៉ុណ្ណោះ)។

## របៀបដំណើរការ

```bash
node server.js          # ឬ npm start
```

បើកលើ `http://localhost:3000` (សម្រាប់តែមើល UI)។

## ⚠️ ចំណាំសំខាន់: ត្រូវការ HTTPS

iOS នឹងទទួលយក profile តែពេល site ដំណើរការលើ **HTTPS** ដែលមាន certificate ត្រឹមត្រូវប៉ុណ្ណោះ។ ជម្រើស deploy ងាយៗ:

- **Render / Railway / Fly.io / Vercel (Node)** – បានទទួល HTTPS ដោយស្វ័យប្រវត្តិ
- **VPS + Nginx + Let's Encrypt (certbot)** – proxy ទៅ port 3000 ហើយបញ្ជូន header `X-Forwarded-Proto` និង `Host`
- សាកល្បងលើម៉ាស៊ីនខ្លួនឯង: `cloudflared tunnel --url http://localhost:3000` ឬ `ngrok http 3000`

## Environment variables (ជម្រើស)

| ឈ្មោះ | ន័យ |
|---|---|
| `PORT` | port របស់ server (លំនាំដើម 3000) |
| `PUBLIC_URL` | ឧ. `https://udid.example.com` ប្រសិនបើ auto-detect មិនត្រឹមត្រូវ |
| `ORG_NAME` | ឈ្មោះដែលបង្ហាញក្នុងទំព័រ install profile |

## ដំណើរការ

1. `GET /profile.mobileconfig` → ផ្ញើ profile ប្រភេទ *Profile Service*
2. អ្នកប្រើ install → iOS ផ្ញើ POST ទៅ `/enroll` ជាមួយ UDID
3. server ឆ្លើយ **301** ទៅ `/result` ដើម្បីបង្ហាញ UDID

## បន្ថែម (ជម្រើស)

Profile ត្រូវបានបង្ហាញថា "Not Signed" ពេល install។ ដើម្បីឲ្យបង្ហាញ "Verified" អ្នកអាច sign `.mobileconfig` ដោយប្រើ SSL certificate របស់ domain អ្នក (`openssl smime -sign`)។
