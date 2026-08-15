import { FC } from 'react';
import { MarketplaceHeader, MarketplaceGrid } from '@/app/components/marketplace';

// Demo data - replace with real data from browse module
const DEMO_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Сан-Сюэ Резиденция',
    description: 'Премиум жилищный комплекс в центре Пхукета с видом на город',
    locationValue: 'Катху, Пхукет',
    unitCount: 24,
    availableCount: 8,
    averagePrice: 85000,
    averageRating: 4.8,
    brand: 'myUNO' as const,
    coverImage: '/api/placeholder?w=1200&h=600&text=San+Sai+Residence',
  },
  {
    id: 'proj-2',
    name: 'Берег Лагуна',
    description: 'Роскошный берег с прямым доступом к пляжу и спортивными услугами',
    locationValue: 'Бангтао, Пхукет',
    unitCount: 36,
    availableCount: 12,
    averagePrice: 120000,
    averageRating: 4.9,
    brand: 'ClearView' as const,
    coverImage: '/api/placeholder?w=1200&h=600&text=Laguna+Beach',
  },
  {
    id: 'proj-3',
    name: 'Волшебный остров',
    description: 'Эксклюзивное развитие с виллами и бунгало в тропическом раю',
    locationValue: 'Патонг, Пхукет',
    unitCount: 18,
    availableCount: 5,
    averagePrice: 150000,
    averageRating: 4.7,
    brand: 'Ignatev' as const,
    coverImage: '/api/placeholder?w=1200&h=600&text=Enchanted+Isle',
  },
];

const DEMO_PROPERTIES = [
  {
    id: 'prop-1',
    title: 'Современная квартира с видом на город',
    price: 3500,
    location: 'Катху, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Modern+Condo',
    rating: 4.92,
    reviewCount: 127,
    instantBook: true,
    superhost: true,
    verified: true,
  },
  {
    id: 'prop-2',
    title: 'Вилла класса люкс с бассейном',
    price: 8900,
    location: 'Бангтао, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Luxury+Villa',
    rating: 4.88,
    reviewCount: 89,
    instantBook: false,
    superhost: true,
    verified: true,
  },
  {
    id: 'prop-3',
    title: 'Уютная студия в центре города',
    price: 2100,
    location: 'Патонг, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Cozy+Studio',
    rating: 4.76,
    reviewCount: 156,
    instantBook: true,
    superhost: false,
    verified: true,
  },
  {
    id: 'prop-4',
    title: 'Пентхаус с террасой на крыше',
    price: 12500,
    location: 'Море, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Penthouse',
    rating: 4.95,
    reviewCount: 243,
    instantBook: true,
    superhost: true,
    verified: true,
  },
  {
    id: 'prop-5',
    title: 'Апартаменты семейного типа',
    price: 4200,
    location: 'Катху, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Family+Apt',
    rating: 4.81,
    reviewCount: 98,
    instantBook: true,
    superhost: false,
    verified: true,
  },
  {
    id: 'prop-6',
    title: 'Бунгало в тропическом саду',
    price: 5600,
    location: 'Бангтао, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Bungalow',
    rating: 4.83,
    reviewCount: 112,
    instantBook: false,
    superhost: true,
    verified: false,
  },
  {
    id: 'prop-7',
    title: 'Квартира рядом со службами и магазинами',
    price: 2800,
    location: 'Катху, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Central+Apt',
    rating: 4.71,
    reviewCount: 67,
    instantBook: true,
    superhost: false,
    verified: true,
  },
  {
    id: 'prop-8',
    title: 'Шикарная вилла с бесконечным бассейном',
    price: 15800,
    location: 'Пхукет-Таун, Пхукет',
    image: '/api/placeholder?w=400&h=300&text=Infinity+Pool',
    rating: 4.97,
    reviewCount: 201,
    instantBook: false,
    superhost: true,
    verified: true,
  },
];

const BrowsePage: FC = () => {
  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">
      <MarketplaceHeader
        onSearchChange={(query) => console.log('Search:', query)}
        onFilterClick={() => console.log('Filter clicked')}
      />

      <main className="py-8">
        <MarketplaceGrid
          view="all"
          properties={DEMO_PROPERTIES}
          projects={DEMO_PROJECTS}
          onPropertyClick={(id) => console.log('Property clicked:', id)}
          onProjectClick={(id) => console.log('Project clicked:', id)}
          onPropertyHeartClick={(id) => console.log('Favorited:', id)}
        />
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Поддержка
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Справочный центр</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Связь с нами</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Безопасность</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Сообщество
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Стать хозяином</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Работа</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Блог</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Компания
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">О нас</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Конфиденциальность</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Условия</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Языки
              </h3>
              <select className="text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2">
                <option>Русский</option>
                <option>English</option>
                <option>ไทย</option>
              </select>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              © 2026 myUNO — Игнатьевское имение. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BrowsePage;
