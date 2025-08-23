# Backend (Node/Express + MySQL)

## Setup
```bash
cp .env.example .env.development
# edit values
npm ci
npm run start:dev
```

## Notes
- Add your DB schema from `mysql.txt` to your MySQL instance.
- For auth/invite flows, integrate endpoints from `routes.additions.js` into your existing `routes.js`.
