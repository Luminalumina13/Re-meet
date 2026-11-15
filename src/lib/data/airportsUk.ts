/** Ukrainian names for the cities and countries in the airport table, used by autocomplete. */
export const CITY_UK: Record<string, string> = {
  Kyiv: "Київ", Lviv: "Львів", Odesa: "Одеса", Warsaw: "Варшава", Kraków: "Краків", Katowice: "Катовіце",
  Rzeszów: "Жешув", Gdańsk: "Гданськ", Wrocław: "Вроцлав", Poznań: "Познань", Chișinău: "Кишинів",
  Iași: "Яси", Bucharest: "Бухарест", "Cluj-Napoca": "Клуж-Напока", Budapest: "Будапешт", Košice: "Кошиці",
  Bratislava: "Братислава", Vilnius: "Вільнюс", Kaunas: "Каунас", Riga: "Рига", Tallinn: "Таллінн",
  Prague: "Прага", Vienna: "Відень", Berlin: "Берлін", Munich: "Мюнхен", Frankfurt: "Франкфурт",
  Hamburg: "Гамбург", Düsseldorf: "Дюссельдорф", Cologne: "Кельн", Stuttgart: "Штутгарт", Leipzig: "Лейпциг",
  Nuremberg: "Нюрнберг", Zürich: "Цюрих", Geneva: "Женева", Basel: "Базель", Ljubljana: "Любляна",
  Zagreb: "Загреб", Split: "Спліт", Dubrovnik: "Дубровник", Belgrade: "Белград", Sofia: "Софія", Varna: "Варна",
  Tirana: "Тирана", Skopje: "Скоп'є", Podgorica: "Подгориця", Amsterdam: "Амстердам", Eindhoven: "Ейндговен",
  Brussels: "Брюссель", Luxembourg: "Люксембург", Paris: "Париж", Lyon: "Ліон", Nice: "Ніцца",
  Marseille: "Марсель", Toulouse: "Тулуза", Bordeaux: "Бордо", Nantes: "Нант", London: "Лондон",
  Manchester: "Манчестер", Birmingham: "Бірмінгем", Edinburgh: "Единбург", Glasgow: "Глазго", Bristol: "Брістоль",
  Dublin: "Дублін", Copenhagen: "Копенгаген", Stockholm: "Стокгольм", Gothenburg: "Гетеборг", Oslo: "Осло",
  Bergen: "Берген", Helsinki: "Гельсінкі", Reykjavík: "Рейк'явік", Madrid: "Мадрид", Barcelona: "Барселона",
  Palma: "Пальма", Málaga: "Малага", Valencia: "Валенсія", Seville: "Севілья", Alicante: "Аліканте",
  Lisbon: "Лісабон", Porto: "Порту", Faro: "Фару", Rome: "Рим", Milan: "Мілан", Venice: "Венеція",
  Bologna: "Болонья", Florence: "Флоренція", Naples: "Неаполь", Catania: "Катанія", Palermo: "Палермо",
  Bari: "Барі", Athens: "Афіни", Thessaloniki: "Салоніки", Heraklion: "Іракліон", Valletta: "Валлетта",
  Larnaca: "Ларнака", Istanbul: "Стамбул", Antalya: "Анталья", Tbilisi: "Тбілісі", Yerevan: "Єреван",
  "Tel Aviv": "Тель-Авів", Dubai: "Дубай", Doha: "Доха", "New York": "Нью-Йорк", Boston: "Бостон",
  Chicago: "Чикаго", Miami: "Маямі", "Los Angeles": "Лос-Анджелес", "San Francisco": "Сан-Франциско",
  Toronto: "Торонто", Montréal: "Монреаль", Vancouver: "Ванкувер",
};

export const COUNTRY_UK: Record<string, string> = {
  UA: "Україна", PL: "Польща", MD: "Молдова", RO: "Румунія", HU: "Угорщина", SK: "Словаччина", LT: "Литва",
  LV: "Латвія", EE: "Естонія", CZ: "Чехія", AT: "Австрія", DE: "Німеччина", CH: "Швейцарія", SI: "Словенія",
  HR: "Хорватія", RS: "Сербія", BG: "Болгарія", AL: "Албанія", MK: "Північна Македонія", ME: "Чорногорія",
  NL: "Нідерланди", BE: "Бельгія", LU: "Люксембург", FR: "Франція", GB: "Велика Британія", IE: "Ірландія",
  DK: "Данія", SE: "Швеція", NO: "Норвегія", FI: "Фінляндія", IS: "Ісландія", ES: "Іспанія", PT: "Португалія",
  IT: "Італія", GR: "Греція", MT: "Мальта", CY: "Кіпр", TR: "Туреччина", GE: "Грузія", AM: "Вірменія",
  IL: "Ізраїль", AE: "ОАЕ", QA: "Катар", US: "США", CA: "Канада",
};

/** Lower-case, strip diacritics and unify apostrophes, so "Krakow" finds Kraków and "Скоп’є" finds Скоп'є. */
export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’ʼ`]/g, "'")
    .replace(/ł/g, "l")
    .trim();
}
