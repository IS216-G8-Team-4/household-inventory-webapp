# Household Inventory Web App

A web application that helps households **track food inventory, monitor expiry dates, and reduce food waste** through recipe recommendations and community food sharing.

Developed for **SMU IS216: Web Application Development II (AY2025–26 Term 1)**.

⚠️ **Project Status**  
This project is **no longer actively maintained**. The application was previously hosted on Vercel for demonstration purposes but the deployment is no longer available.

---

# Problem Statement

Singapore generated **755,000 tonnes of food waste in 2023**, with only **18% recycled**. Food waste accounts for roughly **half of the 1.5 kg of waste discarded daily by households**.

Households often purchase more groceries than they can consume before expiration. Without proper tracking, food is frequently forgotten in fridges or pantries until it spoils. This leads to unnecessary waste, higher household spending, and environmental impact.

---

# Solution

The Household Inventory Web App helps households manage the **entire food lifecycle**:

- Track household food inventory
- Monitor expiry dates with alerts
- Generate recipes using existing ingredients
- Donate surplus food to nearby communities

The project supports **UN SDG 12: Responsible Consumption and Production**.

---

# Key Features

### Inventory Tracking
- Add, edit, and delete food items
- Track expiry dates and categories
- Filter items by type or expiry urgency

### Expiry Alert System
Notifications to prevent spoilage:
- **3 days before** – reminder with recipe suggestions  
- **1 day before** – urgent alert  
- **Expiry day** – donation options  

Includes dashboard colour coding (green → yellow → red).

### Recipe Recommendation
Generates recipes based on available ingredients using **TheMealDB API**, with filters for:
- dietary goals
- cuisine preferences
- cooking time

### Community Food Sharing
Users can donate surplus food:
- Upload item photo and expiry date
- Browse nearby items via **Google Maps API**
- Coordinate pickup through in-app messaging

### Analytics Dashboard
Displays:
- monthly food wastage
- estimated cost savings
- CO₂ emissions prevented
- consumption patterns

### User Accounts
- Email registration
- Household profiles with dietary preferences
- Multiple users sharing the same inventory

---

# Demo Accounts

**Account with inventory**

Username  
`arwen.tan.2024@computing.smu.edu.sg`

Password  
`Reminisce77#`

**Account with empty inventory**

Username  
`arwenalyssa@gmail.com`

Password  
`12345678`

---

# Tech Stack

**Frontend**
- Vue 3
- Vite

**APIs**
- TheMealDB API
- Google Maps API

**Hosting**
- Vercel (previous deployment)

---

# Development Setup

This project uses **Vue 3 with Vite**.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Vue (Official) – Volar Extension](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

Disable **Vetur** if installed.

---

## Recommended Browser Setup

### Chromium-based browsers (Chrome, Edge, Brave)

Install:
- [Vue.js Devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)

Enable:
- [Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)

### Firefox

Install:
- [Vue.js Devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)

Enable:
- [Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

---

# Project Setup

Install dependencies:
```bash
npm install
```

Run development server with hot reload:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```
