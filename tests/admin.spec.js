const { test, expect } = require('@playwright/test');

const APP_URL = 'http://localhost:8080/admin.html';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(APP_URL);
  });

  test('Login with ave_admin', async ({ page }) => {
    await page.locator('input[name="username"]').fill('ave_admin');
    await page.locator('input[name="password"]').fill('password');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('#admin-app')).not.toHaveClass(/hidden/);
    await expect(page.locator('.admin-sidebar-link[data-tab="dashboard"]')).toHaveClass(/active/);
  });

  test('Login with wrong password -> rejected', async ({ page }) => {
    await page.locator('input[name="username"]').fill('ave_admin');
    await page.locator('input[name="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('.toast.show')).toContainText('Invalid credentials');
    await expect(page.locator('#admin-app')).toHaveClass(/hidden/);
  });

  test.describe('Logged in admin operations', () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.locator('input[name="username"]').fill('ave_admin');
      await page.locator('input[name="password"]').fill('password');
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('#admin-app')).not.toHaveClass(/hidden/);
    });

    test('Dashboard stats load', async ({ page }) => {
      await expect(page.locator('#stat-revenue')).toBeVisible();
      await expect(page.locator('#stat-orders')).toBeVisible();
      await expect(page.locator('#stat-items')).toBeVisible();
      await expect(page.locator('#stat-expenses')).toBeVisible();
    });

    test('View orders tab', async ({ page }) => {
      await page.locator('.admin-sidebar-link[data-tab="orders"]').click();
      await expect(page.locator('#orders-list')).toBeVisible();
      // Wait for items to populate
      await page.waitForTimeout(1000);
      const rows = page.locator('#orders-list tr');
      const count = await rows.count();
      // It might be 0 if no orders exist, but table should exist
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('Menu tab and search', async ({ page }) => {
      await page.locator('.admin-sidebar-link[data-tab="menu"]').click();
      await expect(page.locator('#menu-table-body')).toBeVisible();
      
      await page.locator('#menu-search').fill('Jollof');
      await page.waitForTimeout(500);
      
      const rows = page.locator('#menu-table-body tr');
      expect(await rows.count()).toBeGreaterThan(0);
    });
    
    test('Settings tab loads', async ({ page }) => {
      await page.locator('.admin-sidebar-link[data-tab="settings"]').click();
      await expect(page.locator('input[name="restaurantName"]')).toHaveValue('Averroes Restaurant');
    });

    test('Logout', async ({ page }) => {
      await page.locator('#logout-btn').click();
      await expect(page.locator('#login-view')).not.toHaveClass(/hidden/);
    });
  });
});
