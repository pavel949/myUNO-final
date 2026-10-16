# Production media acceptance — 16 октября2026

Выполнено около22:53ICT на существующем production alias my-uno-final.vercel.app, deployment dpl_4hoKajzkxCMc1nRrp5LKzoBmSW7v / source408ad99abfae9e7e67b6f518a736b751d72a7283. Это проверка старого deployed build, не доказательство развёртывания PR295. Использована существующая browser admin session Pavel; credentials не извлекались и auth не подделывалась.

## Фактический сценарий

1. Открыт существующий непубличный QA unit TEST Unit Upload2026-10-12, id30da8815-7d34-440f-b675-e5d053bb6899, в QA project1b2acd36-d448-4ce6-bec6-dc9b2eb2c424. Новая физическая недвижимость, ownership, брони и деньги не создавались.
2. Через штатный gallery editor загружен единственный синтетический PNG myuno-media-acceptance-20261016.png,9978bytes,960×640. Изображение явно помечено как test и не изображает продаваемый объект.
3. Сервер подтвердил «Галерея сохранена». Число фотографий изменилось с1 на2; прежняя обложка сохранена.
4. После полного reload и повторного открытия шага7 обе фотографии присутствуют. Новый img complete=true, naturalWidth960, naturalHeight640; источник — public.blob.vercel-storage.com.
5. Read-only SQL подтвердил media asset9d28db25-d088-4722-8f16-45cd259741ad, image/png,9978bytes, encrypted=false, связь с этим QA unit. Unit остаётся draft, permitted_use_confirmed_at=null. Ни publish, ни подтверждение разрешённого использования не выполнялись.

Дополнительно внешний GET вернул200, image/png,9978bytes; содержимое побайтно совпало с загруженным PNG. SHA256: e0bc22360d82a069c361d198abf20871ffdee897a90145a0ca0dec20338dd979.

[Снимок после reload](media-upload.jpg).

## Границы доказательства

Passed: реальная browser→Blob→finalize→DB gallery→reload→image render цепочка для разрешённого admin и существующего draft. Это не isolated mock. Test image оставлен только в QA gallery как evidence.

Не проверены этим сценарием: foreign-identity denial live, oversized/MIME отказ, interrupted-upload retry live, private receipts/passports, публичная галерея коммерческого объекта, OIDC-only path на новом build. Наличие2 фото не делает unit media-ready (минимум3), а media-ready не даёт права на публикацию или бронирование.

Оценка после этой проверки: код8.5/10, production5/10. Один доказанный capability не снимает критические release/migration/content/operational blockers и не подтверждает9/10.
