# Averroes Villa - QR-Code Digital Food Menu

A premium, high-performance, mobile-first digital food menu designed for luxury hospitality venues like **Averroes Villa**.

This menu works entirely on the client side using:
- **HTML5 & Vanilla ES6+ JavaScript**: State management, live-search, swipe-tabs, and dynamic calculations.
- **Tailwind CSS v3 (CDN)**: Modern layout design system, clean typography, transitions, and hover animations.
- **FontAwesome (CDN)**: Vector iconography.
- **WhatsApp Integration**: Checkout compilation that formats ordered items and routes the customer to direct message the hotel reception (`+2348000000000`) with their Room Number.

---

## 📂 Directory Structure

```
averroes-food-menu/
├── index.html          # Main HTML markup, Tailwind setup & layout structure
├── menu.json           # Food item database (Naira pricing, categories, sensory descriptions, images)
├── README.md           # This documentation file
└── assets/
    └── js/
        └── app.js      # State engine (Async fetch, search/filter logic, active cart & WhatsApp redirect)
```

---

## 🚀 Running Locally

Because the application uses `fetch()` to load the `menu.json` file asynchronously, web browsers will restrict this file access when opening the `index.html` directly from the local disk (`file://` protocol) due to **CORS (Cross-Origin Resource Sharing)** security policy.

To preview or run the menu locally, you must run a simple HTTP server. Below are the easiest ways to do so:

### Option A: VS Code Live Server (Recommended)
1. Open the `averroes-food-menu` directory in VS Code.
2. If you don't have it, install the **Live Server** extension by Ritwick Dey.
3. Click the **Go Live** button at the bottom-right corner of the editor.
4. Your browser will open the application automatically at `http://127.0.0.1:5500`.

### Option B: Node.js (npx)
If you have Node.js installed, open your terminal in the project directory and run:
```bash
npx serve .
```
Open `http://localhost:3000` (or the port specified in terminal) in your browser.

### Option C: Python
If you have Python installed, open your terminal in the directory and run:

**Python 3.x:**
```bash
python -m http.server 8000
```
Open your browser and navigate to `http://localhost:8000`.

---

## 🌐 Production Deployment

Since this app is entirely static (HTML, CSS, JS), you can deploy it for free using various static hosting providers:

1. **Netlify**:
   - Drag and drop the `averroes-food-menu` folder onto [Netlify Drop](https://app.netlify.com/drop).
2. **Vercel**:
   - Run `npx vercel` inside the folder or link it to a GitHub repository on Vercel.
3. **GitHub Pages**:
   - Push the folder to a GitHub repository.
   - Go to **Settings > Pages** and enable GitHub Pages for the `main`/`master` branch.
4. **AWS S3 / Google Cloud Storage**:
   - Upload the folder contents to a public-read bucket and configure static website hosting.

Once hosted, link the deployment URL to a QR code generator (like QR Code Monkey) and print the QR codes to place on the hotel rooms' bedside tables or restaurant dining tables.

---

## 🛠 Customizing the Menu

To edit, add, or remove menu items, simply open the [menu.json](file:///c:/Users/DELL/Downloads/averroes-food-menu/menu.json) file and adjust the objects.
Ensure every object adheres to the schema:
```json
{
  "id": 7,
  "name": "Dish Name",
  "category": "Local",
  "price": 6000,
  "description": "Sensory dish description.",
  "image": "https://images.unsplash.com/photo-..."
}
```
Available categories are: `"Local"`, `"Continental"`, `"Grills"`, or `"Drinks"`.
