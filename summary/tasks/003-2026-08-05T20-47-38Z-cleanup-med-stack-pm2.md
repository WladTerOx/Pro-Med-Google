# 003 — Убрать процесс med-stack из PM2 (или вынести конфиг)

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟡 средний
**Связано с:** tasks/002 (новый ecosystem.config.cjs не должен нести чужой процесс)

## Проблема

В PM2 есть процесс `med-stack` (`pm2 list` → status `errored`, 4 рестарта), который запускает `bash -c "docker compose up -d"` из `/root`. Это конфиг для **gemini-live стека** (postgres + gemini-live-app + telegram-bot), а не Pro-Med.

Сейчас он errored и ничего не делает, но захламляет `pm2 list` и сбивает с толку.

## Что сделать

**Вариант А (рекомендую):** удалить процесс целиком, gemini-live пусть управляется только `docker compose up -d` из `/root` напрямую (или через systemd).

```
pm2 delete med-stack
```

**Вариант Б:** если хочется оставить — вынести конфиг из Pro-Med:
1. Создать `/root/med-stack.ecosystem.config.cjs`.
2. В PM2: `pm2 delete med-stack && pm2 start /root/med-stack.ecosystem.config.cjs`.
3. Удалить `med-stack` из Pro-Med (см. задачу 002).

## Где

- PM2: `pm2 delete med-stack`.

## Зачем

- Убрать мёртвый/неиспользуемый процесс из PM2.
- Изолировать конфиг Pro-Med от посторонних сервисов.
- `pm2 list` показывает только то, что относится к этому проекту.

## Acceptance criteria

- `pm2 list` не содержит `med-stack`.
- Если используется Вариант Б — `med-stack` запускается из файла вне Pro-Med и работает корректно.