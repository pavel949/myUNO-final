export const PROPERTY_FACT_KEYS = [
  { key: 'listing.floor', namespace: 'listing', description: 'Unit floor label', en: 'Floor {value}', ru: 'Этаж {value}', th: 'ชั้น {value}', status: 'ok' as const },

  { key: 'catalog.views.pool.label', namespace: 'catalog.views', description: 'Unit view: pool', en: 'Pool view', ru: 'Вид на бассейн', th: 'วิวสระว่ายน้ำ', status: 'ok' as const },
  { key: 'catalog.views.mountain.label', namespace: 'catalog.views', description: 'Unit view: mountain', en: 'Mountain view', ru: 'Вид на горы', th: 'วิวภูเขา', status: 'ok' as const },
  { key: 'catalog.views.greenery.label', namespace: 'catalog.views', description: 'Unit view: greenery', en: 'Greenery view', ru: 'Вид на зелень', th: 'วิวพื้นที่สีเขียว', status: 'ok' as const },

  { key: 'catalog.unit_features.high_ceiling.label', namespace: 'catalog.unit_features', description: 'Unit feature: high ceiling', en: 'High ceiling', ru: 'Высокий потолок', th: 'เพดานสูง', status: 'ok' as const },
  { key: 'catalog.unit_features.top_floor.label', namespace: 'catalog.unit_features', description: 'Unit feature: top floor', en: 'Top floor', ru: 'Верхний этаж', th: 'ชั้นบนสุด', status: 'ok' as const },
  { key: 'catalog.unit_features.kitchen.label', namespace: 'catalog.unit_features', description: 'Unit feature: kitchen', en: 'Kitchen', ru: 'Кухня', th: 'ครัว', status: 'ok' as const },
  { key: 'catalog.unit_features.balcony.label', namespace: 'catalog.unit_features', description: 'Unit feature: balcony', en: 'Balcony', ru: 'Балкон', th: 'ระเบียง', status: 'ok' as const },
] as const;
