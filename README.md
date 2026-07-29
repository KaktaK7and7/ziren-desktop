# Ziren Desktop

Desktop-клиент Ziren на Tauri, React и TypeScript. Он отвечает за вход в
аккаунт, интерфейс, запуск и остановку локального Python Core.

## Границы безопасности

- В release пароль отправляется только в
  `https://www.ziren.store/api/desktop/login`. Debug-сборка использует
  изолированное тестовое окружение.
- Полученный desktop-токен передаётся Core через переменную окружения, а не
  через аргументы процесса.
- Для локального API Core создаётся отдельный случайный
  `ZIREN_LOCAL_API_TOKEN`. Он живёт только в памяти текущего окна и процесса.
- Все обращения к `127.0.0.1:8787` проходят через
  `src/services/localApi.ts`, который добавляет локальный токен.
- При выходе серверная desktop-сессия отзывается, Core останавливается, оба
  локальных токена очищаются.

## Проверки

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Для полной Rust-проверки необходим установленный stable Rust toolchain и
системные зависимости Tauri.

## Тестовое окружение

Release-сборки всегда используют production gateway
`https://www.ziren.store`. `npm run tauri dev` по умолчанию использует
`https://auth-site-p0-security-test.up.railway.app`. При необходимости debug
gateway можно временно заменить:

```powershell
$env:VITE_AUTH_SITE_URL = "https://your-staging-gateway.up.railway.app"
npm run tauri dev
```

Desktop передаёт этот же origin Python Core при запуске, поэтому отдельная
переменная для Tauri/Rust больше не нужна. Значение должно быть HTTPS origin
без дополнительного пути, query-параметров и логина с паролем.

## Хроника связи

Первый сюжетный MVP находится в `StoryModal`. Он загружает состояние аккаунта
через auth gateway, проводит пользователя через три выбора пролога и показывает
спойлер-безопасную карту памяти. Прогресс не хранится в `localStorage`;
локально запоминается только факт первого показа окна.
