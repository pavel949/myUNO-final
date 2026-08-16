# 🔐 GitHub Secrets Setup для автоматической чинки

Для того чтобы **автоматические workflows** могли чинить миграции, нужно настроить GitHub Secrets.

## 🚀 Что нужно сделать

### Шаг 1️⃣: Получить DATABASE_URL из Supabase

1. Перейди на **supabase.com** → твой проект
2. В левом меню: **Settings** → **Database**
3. Найди **Connection string** → выбери **URI**
4. Скопируй весь URL (начинается с `postgresql://`)

**Будет выглядеть так:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

### Шаг 2️⃣: Добавить в GitHub Secrets

1. Открой репозиторий на GitHub
2. **Settings** (вкладка)
3. В левом меню: **Secrets and variables** → **Actions**
4. Нажми **New repository secret**
5. **Name:** `DATABASE_URL`
6. **Value:** Вставь скопированный URL из Supabase
7. Нажми **Add secret**

✅ Готово!

---

## 🤖 Как работают workflows

### Workflow 1: `fix-migration.yml`

**Запускается:**
- 📍 Вручную (кнопка "Run workflow" в Actions)
- 📅 По расписанию (каждый час)
- 📤 При каждом push на эту ветку

**Что делает:**
1. Проверяет наличие DATABASE_URL
2. Пытается разрешить миграцию
3. Проверяет build
4. Комментирует результат в PR

### Workflow 2: `auto-fix-on-failure.yml`

**Запускается:**
- 🚨 Автоматически когда CI падает
- 🔍 Анализирует причину падения
- ⚡ Сразу пытается чинить

**Что делает:**
1. Обнаруживает ошибку CI
2. Автоматически запускает fix
3. Уведомляет в PR

---

## ✅ Проверка

После добавления `DATABASE_URL`:

1. Перейди в **Actions**
2. Выбери **🔧 Fix Prisma Migration (AUTO)**
3. Нажми **Run workflow**
4. Жди результата 🚀

**Успех будет выглядеть так:**
```
✅ Migration fixed successfully!
✅ Build verified
```

---

## ❓ Если не работает

### Ошибка: "DATABASE_URL is empty"
**Решение:** Проверь, что secret добавлен правильно в GitHub Settings

### Ошибка: "Can't reach database"
**Решение:** 
- Проверь, что URL правильный (скопировал всё целиком)
- Проверь, что Supabase проект включен
- Попробуй переподключиться на Supabase

### Ошибка: "P3009: found failed migrations"
**Это хорошо!** Это значит workflow попал в корень проблемы. Нужно:
1. Проверить, что CONNECTION_POOL_SIZE достаточный
2. Или перезагрузить Supabase базу

---

## 🔄 Полный процесс

```
1. Добавляешь DATABASE_URL в GitHub Secrets
   ↓
2. Коммитишь код на ветку
   ↓
3. GitHub Actions запускается автоматически
   ↓
4. Workflow разрешает миграцию
   ↓
5. Workflow проверяет build
   ↓
6. Комментирует результат в PR
   ↓
7. ✅ Всё готово!
```

---

## 🛡️ Безопасность

✅ **DATABASE_URL в GitHub Secrets:**
- Зашифрован
- Видно только GitHub Actions
- Не видно в логах
- Можешь удалить когда угодно

❌ **Никогда не:**
- Не коммитьте URL в код
- Не пишите в PR
- Не отправляйте по email

---

## 📞 Поддержка

Если всё ещё не работает:
1. Проверь логи в GitHub Actions (красная ✗ или жёлтая ⚠️)
2. Скопируй ошибку
3. Проверь docs/FIXING_MIGRATION_ISSUES.md
4. Свяжись с админом проекта

---

**Готово? Начни с шага 1️⃣!** 🚀
