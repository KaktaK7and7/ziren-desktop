# Ziren Desktop

Desktop-клиент Ziren на Tauri, React и TypeScript. Он отвечает за вход в
аккаунт, интерфейс, запуск и остановку локального Python Core.

## Границы безопасности

- Пароль отправляется только в `https://www.ziren.store/api/desktop/login`.
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
