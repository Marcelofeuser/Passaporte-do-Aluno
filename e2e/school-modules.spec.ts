import { test, expect } from '@playwright/test';

test.describe('Passaporte-do-Aluno - E2E Tests', () => {
  
  test('deve carregar a página inicial / portal de família', async ({ page }) => {
    await page.goto('/portal');
    await expect(page).toHaveURL(/portal/);
  });

  test('deve navegar pelo módulo de biblioteca', async ({ page }) => {
    await page.goto('/school/library');
    await expect(page.locator('body')).toContainText('Biblioteca');
  });

  test('deve navegar pelo módulo de cantina', async ({ page }) => {
    await page.goto('/school/canteen');
    await expect(page.locator('body')).toContainText('Cantina');
  });

  test('deve navegar pelo módulo de disciplina', async ({ page }) => {
    await page.goto('/school/discipline');
    await expect(page.locator('body')).toContainText('Disciplina');
  });

  test('deve navegar pelo passaporte digital', async ({ page }) => {
    await page.goto('/school/pass');
    await expect(page.locator('body')).toContainText('Passaporte');
  });

  test('deve navegar pelo módulo de notificações', async ({ page }) => {
    await page.goto('/school/notifications');
    await expect(page.locator('body')).toContainText('Comunicados');
  });

});
