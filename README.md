# Mendoza Guazon app: front end only

app/config.js   <- set your backend URL here
app/api.js      <- the only file that talks to the backend (adapt it if the backend's routes differ)
API.md          <- what the app expects from the backend
Push to GitHub, then Settings > Pages > Source: GitHub Actions. Live at https://USERNAME.github.io/REPO/
The backend must: use https, allow CORS from https://USERNAME.github.io (headers Authorization + Content-Type; methods GET, POST, PATCH).
