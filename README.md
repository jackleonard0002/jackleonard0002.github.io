# Whimsical Wands Website

A multi-page storefront for a custom wand and painting business, built with HTML, CSS, JavaScript, and a Node/Express API for protected order and admin actions.

## Pages

- `index.html` - Home page with hero, featured products, testimonials, and CTA
- `shop.html` - Product catalog with dynamic rendering and category filters
- `cart.html` - Cart page with quantity controls and subtotal summary
- `admin.html` - Admin dashboard for product management, orders, and analytics
- `about.html` - Brand story and process
- `contact.html` - Commission inquiry form

## Tech Stac 
- HTML5
- CSS3
- Vanilla JavaScript
- Node.js + Express API
- Firebase Authentication for Google sign-in
- Firebase Admin SDK for backend token verification

## Features

- Responsive navigation with mobile menu toggle
- Product cards and category filtering on shop page
- Cart page with persistent item quantities and subtotal
- Cart storage linked to signed-in Google account on this browser
- Shipping address capture on checkout with optional save-for-next-time behavior
- Currency selector in the header with live conversion for displayed prices
- Place order action that sends protected orders to the backend API
- Admin product CRUD UI (add/edit/delete) backed by role-checked API routes
- Order list and analytics served from protected backend endpoints
- Smooth scrolling for in-page links
- Semantic HTML and accessible labels/focus states
- Optional Google sign-in support with Firebase Authentication

Currency conversion notes:

- Base product prices are stored in GBP.
- Display currency can be changed from the header selector.
- Live exchange rates are fetched automatically from exchange-rate APIs and cached in localStorage for resilience.

## Run Locally

1. Start the frontend on `http://localhost:5500` using a static server.
2. Start the API on `http://localhost:8787` with `node server/src/index.js`.
3. Open `index.html` in the browser after both servers are running.

If you want a quick static server for the site, the existing VS Code task can run `python -m http.server 5500`.

## Deploy Frontend To GitHub Pages

This repository now includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that publishes the static frontend to GitHub Pages whenever you push to `main`.

1. Push this repository to GitHub.
2. In GitHub, open `Settings > Pages`.
3. Under Build and deployment, set Source to `GitHub Actions`.
4. Commit and push to `main` (or run the workflow manually from the Actions tab).
5. After deployment, your site will be available at your GitHub Pages URL.

Important:

- GitHub Pages can host only the static frontend, not the Node/Express API in `server/`.
- For frontend features that call the API (orders, admin, address, auth-protected actions), deploy the API to a backend host (for example Render, Railway, Fly.io, or Azure).
- After deploying the API, replace `https://REPLACE_WITH_YOUR_API_ORIGIN` in these files with your real API origin:
	- `js/main.js`
	- `js/admin.js`
	- `js/cart.js`
	- `js/settings.js`
	- `js/product.js`

## Notes

- The image files under `assets/images/` are placeholders and should be replaced with real brand assets.

## Google Login Setup (Firebase)

1. Create a Firebase project in the Firebase Console.
2. In your project, add a Web App and copy the Firebase config values.
3. Go to Authentication > Sign-in method and enable Google provider.
4. Add authorized domains:
	- `localhost` for local testing
	- your production domain when deployed
5. Open `js/auth.js` and replace:
	- `REPLACE_WITH_FIREBASE_API_KEY`
	- `REPLACE_WITH_FIREBASE_AUTH_DOMAIN`
	- `REPLACE_WITH_FIREBASE_PROJECT_ID`
	- `REPLACE_WITH_FIREBASE_APP_ID`
6. Run the site on a local server (`http://localhost`), not `file://`.

When configured, the header will show a `Sign in with Google` button and display the user profile after login.

## Backend Setup

1. Copy `.env.example` to `.env`.
2. Set `FRONTEND_ORIGIN` to the site origin, usually `http://localhost:5500`.
3. Set `ADMIN_EMAILS` to a comma-separated list of admin Google accounts.
4. Provide Firebase Admin credentials using `FIREBASE_SERVICE_ACCOUNT_JSON` or application default credentials.
5. Start the API with `node server/src/index.js`.

The API exposes:

- `GET /api/health`
- `GET /api/products`
- `POST /api/orders` for signed-in users
- `GET /api/me/address` for signed-in users
- `PUT /api/me/address` for signed-in users
- `GET /api/orders/me` for signed-in users
- `GET /api/admin/products` for admins
- `POST /api/admin/products` for admins
- `PUT /api/admin/products/:id` for admins
- `DELETE /api/admin/products/:id` for admins
- `GET /api/admin/orders` for admins
- `GET /api/admin/analytics` for admins

## Admin Access Setup

1. Set your admin email(s) in `.env` via `ADMIN_EMAILS`.
2. Sign in with one of those Google accounts.
3. Open `admin.html` to manage products, view orders, and review analytics.

Admin data now lives on the backend JSON store in `server/data/store.json`, and admin routes are enforced by Firebase token verification plus the admin allowlist or custom claim.

Shipping addresses are stored per authenticated user in the backend profile store and copied into each order as a snapshot so old orders do not change when a user updates their default address later.


- Hellobe