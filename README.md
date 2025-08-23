# KidsMin Portal (Monorepo)

**Structure**
- `backend/`: Node/Express + MySQL API
- `frontend/kidsmin-portal/`: Angular 20 app

## Quickstart

### Backend
```bash
cd backend
cp .env.example .env.development
# edit values
npm ci
npm run start:dev
```

### Frontend
```bash
cd frontend/kidsmin-portal
# If the Angular app isn't present yet, create it with Angular CLI:
# ng new kidsmin-portal --routing --style=scss
npm ci
npm run start
```

## CI
GitLab CI builds the backend (lint/test) and frontend (build). Add deployment stages later as needed.


## Windows quick push
```powershell
git init
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git add .
git commit -m "chore: initial monorepo (backend + frontend skeleton)"
git branch -M main
# HTTPS
git remote add origin https://gitlab.com/<your-namespace>/kidsmin-portal.git
git push -u origin main
# or SSH
git remote add origin git@gitlab.com:<your-namespace>/kidsmin-portal.git
git push -u origin main
```
