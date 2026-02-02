import { test, expect } from '@playwright/test';

test('로비 페이지 접속 및 제목 확인', async ({ page }) => {
  await page.goto('/');
  
  // 페이지 제목 또는 특정 텍스트가 포함되어 있는지 확인
  await expect(page).toHaveTitle(/frontend/i);
  
  // '게임 시작' 또는 '방 만들기'와 같은 버튼이 있는지 확인
  const startButton = page.getByRole('button');
  await expect(startButton.first()).toBeVisible();
});

test('서버 연결 상태 확인', async ({ page }) => {
  await page.goto('/');
  
  // 소켓 연결 성공 시 나타나는 UI 요소가 있다면 확인
  // 예를 들어 "서버 연결됨" 등의 텍스트
});
