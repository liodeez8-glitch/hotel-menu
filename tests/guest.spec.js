const { test, expect } = require('@playwright/test');

const APP_URL = 'http://localhost:8080/index.html';

test.describe('Guest (Customer) Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and go to the app
    await page.goto(APP_URL);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(APP_URL);
  });

  test('Menu loads on page open', async ({ page }) => {
    await expect(page.locator('#brand-name')).toHaveText('Averroes Restaurant');
    await expect(page.locator('#menu-container')).toBeVisible();
    await expect(page.locator('.food-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('Search for Jollof', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    await searchInput.fill('Jollof');
    await page.waitForTimeout(500); // debounce wait
    const foodCards = page.locator('.food-card');
    const count = await foodCards.count();
    expect(count).toBeGreaterThan(0);
    const firstTitle = await foodCards.first().locator('h3').textContent();
    expect(firstTitle.toLowerCase()).toContain('jollof');
  });

  test('Category navigation', async ({ page }) => {
    await page.locator('button.cat-pill:has-text("Continental Dishes")').click();
    // Verify it scrolls/filters correctly (check active class on pill)
    await expect(page.locator('button.cat-pill:has-text("Continental Dishes")')).toHaveClass(/active/);
  });

  test('Add items to cart and check badge', async ({ page }) => {
    const firstFoodCardAddBtn = page.locator('.food-card button.add-to-cart-btn').first();
    await firstFoodCardAddBtn.click();
    const badge = page.locator('#cart-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');
  });

  test('Increase/decrease quantities in cart', async ({ page }) => {
    // Add item
    await page.locator('.food-card button.add-to-cart-btn').first().click();
    
    // Open cart drawer
    await page.locator('#cart-toggle').click();
    const cartDrawer = page.locator('#cart-drawer');
    await expect(cartDrawer).toBeVisible();
    
    // Increase qty
    await page.locator('.qty-increase').first().click();
    await expect(page.locator('.qty-value').first()).toHaveText('2');
    
    // Decrease qty
    await page.locator('.qty-decrease').first().click();
    await expect(page.locator('.qty-value').first()).toHaveText('1');
  });

  test('Clear cart', async ({ page }) => {
    await page.locator('.food-card button.add-to-cart-btn').first().click();
    await page.locator('#cart-toggle').click();
    
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#clear-cart-btn').click();
    
    await expect(page.locator('#cart-badge')).toBeHidden();
  });

  test('Place order', async ({ page }) => {
    await page.locator('.food-card button.add-to-cart-btn').first().click();
    await page.locator('#cart-toggle').click();
    await page.locator('#checkout-btn').click();
    
    // Fill checkout form
    await page.locator('#order-location').selectOption('Hotel Room');
    await page.locator('#order-identifier').fill('Room 101');
    
    // Submit
    await page.locator('#confirm-order-btn').click();
    
    // Wait for success toast or redirect
    await expect(page.locator('.toast.show')).toContainText('Order placed successfully');
    
    // Drawer should close
    await expect(page.locator('#checkout-drawer')).not.toHaveClass(/translate-x-0/);
  });

  test('View order history', async ({ page }) => {
    // First place an order
    await page.locator('.food-card button.add-to-cart-btn').first().click();
    await page.locator('#cart-toggle').click();
    await page.locator('#checkout-btn').click();
    await page.locator('#order-location').selectOption('Hotel Room');
    await page.locator('#order-identifier').fill('Room 101');
    await page.locator('#confirm-order-btn').click();
    await page.waitForTimeout(1000);
    
    // Go to orders view
    await page.locator('#orders-toggle').click();
    await expect(page.locator('#my-orders-view')).not.toHaveClass(/hidden/);
    
    const orderItems = page.locator('.order-history-item');
    expect(await orderItems.count()).toBeGreaterThan(0);
    await expect(orderItems.first()).toContainText('PENDING');
  });

  test('Send chat message', async ({ page }) => {
    // Open chat
    await page.locator('#chat-toggle').click();
    // Add location info to start chat
    await page.locator('#chat-location-input').selectOption('Hotel Room');
    await page.locator('#chat-identifier-input').fill('Room 202');
    await page.locator('#start-chat-btn').click();

    await expect(page.locator('#chat-drawer')).toBeVisible();
    
    // Start chat if no order
    await page.locator('#chat-reply-input').fill('Hello staff!');
    await page.locator('#chat-reply-form button[type="submit"]').click();
    
    // Check message is displayed
    const message = page.locator('#chat-view-messages').last();
    await expect(message).toContainText('Hello staff!');
  });
});
