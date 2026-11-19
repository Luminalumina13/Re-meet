export type Lang = "uk" | "en";

export interface Step {
  id: string;
  title: string;
  text: string;
  image: string;
  alt: string;
}

export interface Qa {
  q: string;
  a: string;
}

export interface HowToContent {
  intro: { title: string; lead: string };
  steps: Step[];
  tips: { title: string; items: string[] };
  cta: { text: string; search: string; faq: string };
  faq: { title: string; lead: string; items: Qa[] };
  form: {
    title: string;
    lead: string;
    message: string;
    messagePlaceholder: string;
    contact: string;
    contactPlaceholder: string;
    contactHint: string;
    consent: string;
    send: string;
    sending: string;
    thanks: string;
    again: string;
  };
}

export const howto: Record<Lang, HowToContent> = {
  uk: {
    intro: {
      title: "Як це працює",
      lead: "Привіт! Re:meeet допомагає знайти квитки на вихідні й зустрітися з людьми, які живуть далеко. Ми не продаємо квитки: збираємо варіанти з кількох джерел, показуємо їх у зручному вигляді, а купуєте ви вже на сайті авіакомпанії чи агрегатора. Ось що тут можна робити.",
    },
    steps: [
      {
        id: "weekend",
        title: "1. Шукайте квитки на вихідні",
        text: "Оберіть, звідки й куди летите, і вихідні: Сб–Нд, Пт–Нд, Пт–Пн чи інші дати. За замовчуванням ми показуємо рейси, які вилітають не надто рано (не раніше 08:00, а в п'ятницю не раніше 12:00) і повертають увечері, між 17:00 і 23:30, щоб ви встигли відпочити. Час можна змінити в «Налаштуваннях часу». Кожен варіант має оцінку комфорту, а список можна відсортувати за найкращим, найдешевшим, найшвидшим чи найзручнішим.",
        image: "/how/search.jpg",
        alt: "Форма пошуку: маршрут, пасажири, вихідні й кнопка «Знайти»",
      },
      {
        id: "results",
        title: "2. Порівнюйте варіанти",
        text: "Той самий переліт із кількох джерел ми зводимо в одну картку: бачите найнижчу ціну, номери рейсів, пересадки й ціни інших сайтів для порівняння. Кнопка «Відкрити» веде на сайт продавця, де можна купити квиток.",
        image: "/how/results.jpg",
        alt: "Список рейсів із цінами, пересадками та оцінкою комфорту",
      },
      {
        id: "flex",
        title: "3. Гнучкі дати: можливо, дешевше в інший день",
        text: "Таблиця цін на кілька днів навколо ваших дат. Натисніть ціну, і ми знайдемо квитки саме на ці дні. Ми рахуємо пару «туди й назад» лише тоді, коли рейс назад вилітає щонайменше через 3 години після прильоту, тож дешевий переліт не зіпсує подорож.",
        image: "/how/flex.jpg",
        alt: "Таблиця найнижчих цін: дні вильоту і повернення",
      },
      {
        id: "explore",
        title: "4. «Куди завгодно»: коли знаєте лише скільки готові летіти",
        text: "Оберіть місто вильоту, дати й найбільший час польоту в один бік, наприклад до 4 годин. Ми покажемо, куди можна потрапити, і приблизні ціни. Кожен напрямок можна відкрити й одразу перейти до пошуку.",
        image: "/how/explore.jpg",
        alt: "Картки напрямків із цінами й часом польоту",
      },
      {
        id: "meetup",
        title: "5. Зустріч друзів: щоб бути разом якнайдовше",
        text: "Додайте друзів і їхні аеропорти (можна кілька), а також міста, де ви хочете зустрітися. Ми підберемо кожному рейс туди й назад так, щоб усі були в одному місці якнайдовше. Повзунок «Скільки коштує година разом» допомагає обрати між часом і грошима. Якщо хтось живе в місті зустрічі, він стає господарем і нікуди не летить. Далі видно, хто й коли на місці та яка ціна в усіх разом.",
        image: "/how/meetup.jpg",
        alt: "План зустрічі: часова шкала друзів і загальна ціна",
      },
      {
        id: "watch",
        title: "6. Відстежуйте ціну, а не перевіряйте щодня",
        text: "Натисніть «Відстежувати» біля пошуку чи плану зустрічі, за бажання вкажіть ціну, яка вас влаштує. Ми перевірятимемо ціни самі й повідомимо, коли вона впаде, з'являться нові пропозиції або буде досягнуто вашу ціну. Повідомлення приходять на сторінку «Відстеження» та, якщо підключите, у Telegram. Там же можна поставити відстеження на паузу чи видалити.",
        image: "/how/watch.jpg",
        alt: "Сторінка відстежень із історією цін і сповіщеннями",
      },
      {
        id: "share",
        title: "7. Діліться посиланням",
        text: "Кнопка «Поділитися» створює посилання, яке відтворює форму й запускає той самий пошук. Надішліть його другу замість скріншота, і вам не доведеться пояснювати, що ви шукали.",
        image: "",
        alt: "",
      },
    ],
    tips: {
      title: "Кілька порад",
      items: [
        "Подорожуєте з дітьми? Вкажіть дітей 2–11 років і немовлят до 2 років окремо: ціна рахується для кожного тарифу, а кожне немовля летить з дорослим.",
        "Не прив'язані до одного дня? Відкрийте «Гнучкі дати» й подивіться, чи не дешевше в сусідній день.",
        "Дивіться не лише на ціну, а й на час у дорозі та пересадки. Оцінка комфорту допомагає швидко відсіяти зайве.",
        "У друга два аеропорти поруч? Додайте обидва: ми оберемо найдешевший, а туди й назад він летітиме з того самого аеропорту.",
        "Ціну для відстеження ставте трохи нижче нинішньої, так повідомлення прийде якраз тоді, коли варто діяти.",
        "Перед купівлею завжди перевіряйте ціну й умови на сайті продавця: ціни змінюються швидко, а багаж чи вибір місця часто коштують окремо.",
        "Плануєте зустріч із кількома друзями? Спробуйте кілька міст і подивіться, де сумарно дешевше й довше разом.",
      ],
    },
    cta: {
      text: "Готові спробувати?",
      search: "Знайти квитки",
      faq: "Питання й відповіді",
    },
    faq: {
      title: "Питання й відповіді",
      lead: "Відповіді на те, що нас запитують найчастіше. Не знайшли своє? Напишіть нам нижче.",
      items: [
        { q: "Ви продаєте квитки?", a: "Ні. Ми збираємо пропозиції з кількох джерел і показуємо їх разом. Купуєте ви на сайті продавця, куди веде кнопка «Відкрити»." },
        { q: "Звідки беруться ціни й рейси?", a: "Ми запитуємо кілька сервісів одночасно: Kiwi.com, lastminute.com і напряму Ryanair. Однакові перельоти з різних джерел зводимо в одну картку й показуємо найнижчу ціну та ціни інших сайтів для порівняння." },
        { q: "Чому на сайті продавця ціна інша?", a: "Ціни на квитки змінюються швидко, а ми на кілька хвилин зберігаємо відповіді, щоб пошук працював швидко. Перед купівлею перевіряйте ціну на сайті продавця." },
        { q: "Скільки це коштує?", a: "Користуватись Re:meeet безкоштовно. Сервіс підтримує реклама." },
        { q: "Чи потрібна реєстрація?", a: "Ні, акаунта немає. Достатньо відкрити сайт." },
        { q: "Де мої відстеження й чому їх не видно в іншому браузері?", a: "Без акаунта відстеження прив'язані до вашого браузера: ми зберігаємо там секретний ключ, який підтверджує, що вони ваші. Тож в іншому браузері чи після очищення cookie вони недоступні. Підключений Telegram продовжить присилати повідомлення." },
        { q: "Як підключити Telegram?", a: "Відкрийте «Відстеження», натисніть «Підключити Telegram» біля потрібного відстеження й у боті натисніть Start. Посилання одноразове й діє 15 хвилин. Далі повідомлення приходитимуть у чат, а в боті є команда /list для керування відстеженнями." },
        { q: "Як працює планувальник зустрічі?", a: "Для кожного друга ми шукаємо рейси туди й назад із його аеропортів і обираємо такі, щоб усі були в одному місці якнайдовше. Ви налаштовуєте, наскільки для вас важлива година разом порівняно з грошима. Хто живе в місті зустрічі, стає господарем без перельоту." },
        { q: "Що таке «Демо-дані»?", a: "Так позначені тестові рейси, які показуються, коли недоступні справжні джерела. Це не реальні пропозиції, купити їх не можна." },
        { q: "Чи входить у ціну багаж?", a: "Це залежить від тарифу авіакомпанії, а ми не завжди можемо його визначити. Перед купівлею перевірте умови на сайті продавця: багаж, вибір місця й реєстрація часто коштують окремо." },
        { q: "Як ви обираєте «найкращі» варіанти?", a: "Ми рахуємо оцінку комфорту за часом вильоту й повернення, прямими рейсами та швидкістю, а потім поєднуємо її з ціною. Ви завжди можете відсортувати за найдешевшим чи найшвидшим." },
        { q: "Чи можна шукати з дітьми й немовлятами?", a: "Так. Вкажіть дорослих, дітей від 2 до 11 років і немовлят до 2 років, усього до 9 пасажирів. Кожне немовля летить із дорослим." },
        { q: "Які мови підтримуються?", a: "Українська й англійська. Перемикач мови є вгорі сторінки." },
        { q: "Чи є застосунок для телефона?", a: "Ми готуємо застосунки для iOS та Android. Поки що сайт зручно працює й на телефоні." },
        { q: "Що ви робите з моїми даними?", a: "Ми збираємо мінімум і не просимо реєстрації. Деталі, зокрема про cookie, реклами й аналітику, дивіться в Політиці конфіденційності." },
      ],
    },
    form: {
      title: "Лишилось питання?",
      lead: "Напишіть нам. Ми читаємо кожне повідомлення, хоча відповісти одразу вдається не завжди.",
      message: "Ваше питання",
      messagePlaceholder: "Розкажіть, що цікавить або що працює не так",
      contact: "Як вам відповісти (необов'язково)",
      contactPlaceholder: "Пошта або нік у Telegram",
      contactHint: "Якщо нічого не вказати, ми не зможемо відповісти особисто.",
      consent: "Надсилаючи повідомлення, ви погоджуєтесь, що ми його обробимо за Політикою конфіденційності.",
      send: "Надіслати",
      sending: "Надсилаємо…",
      thanks: "Дякуємо! Ми отримали ваше повідомлення.",
      again: "Написати ще",
    },
  },
  en: {
    intro: {
      title: "How it works",
      lead: "Hi! Re:meeet helps you find flights for weekends and meet up with people who live far away. We don’t sell tickets: we collect options from several sources, show them in one place, and you buy on the airline’s or the agent’s own site. Here is what you can do.",
    },
    steps: [
      {
        id: "weekend",
        title: "1. Search flights for the weekend",
        text: "Pick where you fly from and to, and the weekend: Sat–Sun, Fri–Sun, Fri–Mon or other dates. By default we show flights that don’t leave too early (not before 08:00, and not before 12:00 on a Friday) and bring you home in the evening, between 17:00 and 23:30, so you actually get to rest. You can change the times in “Time settings”. Every option gets a comfort score, and you can sort by best, cheapest, fastest or most comfortable.",
        image: "/how/search.jpg",
        alt: "The search form: route, travellers, weekend and the Search button",
      },
      {
        id: "results",
        title: "2. Compare the options",
        text: "The same flight from several sources becomes one card: you see the lowest price, flight numbers, connections and the prices on other sites for comparison. “Open” takes you to the seller’s site, where you can buy the ticket.",
        image: "/how/results.jpg",
        alt: "A list of flights with prices, connections and a comfort score",
      },
      {
        id: "flex",
        title: "3. Flexible dates: it may be cheaper another day",
        text: "A price grid for a few days around your dates. Tap a price and we search exactly those days. We only pair an outbound and a return when the return leaves at least 3 hours after you land, so a cheap flight won’t ruin the trip.",
        image: "/how/flex.jpg",
        alt: "A grid of lowest prices by departure and return day",
      },
      {
        id: "explore",
        title: "4. “Anywhere”: when you only know how long you’re willing to fly",
        text: "Choose the city you leave from, the dates and the longest one-way flight, for example up to 4 hours. We show where you can go and roughly what it costs. Open any destination to jump straight into a search.",
        image: "/how/explore.jpg",
        alt: "Destination cards with prices and flight times",
      },
      {
        id: "meetup",
        title: "5. Meet up with friends: be together for as long as possible",
        text: "Add your friends and their airports (several are fine) and the cities where you’d like to meet. For everyone we pick an outbound and a return so that all of you are in the same place for as long as possible. The “What an hour together is worth” slider helps you balance time and money. A friend who lives in the meeting city becomes the host and doesn’t fly. You then see who is there when, and the total price for everyone.",
        image: "/how/meetup.jpg",
        alt: "A meetup plan: a timeline of friends and the total price",
      },
      {
        id: "watch",
        title: "6. Track the price instead of checking every day",
        text: "Press “Track” next to a search or a meetup plan and, if you like, set a price you’d be happy with. We re-check the prices on our own and tell you when the price drops, new offers appear or your price is reached. Messages arrive on the “Tracking” page and, if you connect it, in Telegram. You can pause or delete a tracker there too.",
        image: "/how/watch.jpg",
        alt: "The tracking page with price history and alerts",
      },
      {
        id: "share",
        title: "7. Share a link",
        text: "“Share” creates a link that recreates the form and runs the same search. Send it to a friend instead of a screenshot, and you won’t have to explain what you were looking for.",
        image: "",
        alt: "",
      },
    ],
    tips: {
      title: "A few tips",
      items: [
        "Travelling with kids? Enter children aged 2–11 and infants under 2 separately: the price is calculated for each fare, and every infant flies with an adult.",
        "Not tied to one day? Open “Flexible dates” and see whether the next day is cheaper.",
        "Look beyond the price: travel time and connections matter. The comfort score helps you weed out the rest.",
        "A friend with two airports nearby? Add both: we pick the cheapest one and fly out and back from the same airport.",
        "Set the tracking price a little below today’s, so the message arrives just when it’s worth acting.",
        "Always check the price and conditions on the seller’s site before you buy: prices change fast, and baggage or seat choice often cost extra.",
        "Planning to meet several friends? Try a few cities and see where it’s cheaper in total and you’re together longer.",
      ],
    },
    cta: {
      text: "Ready to try it?",
      search: "Search flights",
      faq: "Questions and answers",
    },
    faq: {
      title: "Questions and answers",
      lead: "Answers to what we get asked most. Can’t find yours? Write to us below.",
      items: [
        { q: "Do you sell tickets?", a: "No. We collect offers from several sources and show them together. You buy on the seller’s site, where the “Open” button takes you." },
        { q: "Where do prices and flights come from?", a: "We query several services at once: Kiwi.com, lastminute.com and Ryanair directly. The same flight from different sources becomes one card with the lowest price and the other sites’ prices for comparison." },
        { q: "Why is the price on the seller’s site different?", a: "Ticket prices change quickly, and we keep answers for a few minutes so searches stay fast. Always check the price on the seller’s site before you buy." },
        { q: "How much does it cost?", a: "Re:meeet is free to use. The service is supported by ads." },
        { q: "Do I need to sign up?", a: "No, there are no accounts. Just open the site." },
        { q: "Where are my trackers, and why can’t I see them in another browser?", a: "Without an account, trackers are tied to your browser: we keep a secret key there that proves they are yours. So in another browser, or after clearing cookies, they are not available. A connected Telegram keeps sending you messages." },
        { q: "How do I connect Telegram?", a: "Open “Tracking”, press “Connect Telegram” next to the tracker and press Start in the bot. The link is one-time and valid for 15 minutes. After that messages arrive in the chat, and the bot has a /list command for managing trackers." },
        { q: "How does the meetup planner work?", a: "For each friend we look for flights out and back from their airports and pick the ones that keep everyone in the same place for as long as possible. You set how much an hour together matters compared with money. Someone who lives in the meeting city becomes the host and doesn’t fly." },
        { q: "What is “Demo data”?", a: "That’s the label on test flights shown when the real sources are unavailable. They aren’t real offers and can’t be bought." },
        { q: "Is baggage included in the price?", a: "It depends on the airline’s fare, and we can’t always tell. Check the conditions on the seller’s site before you buy: baggage, seat choice and check-in often cost extra." },
        { q: "How do you choose the “best” options?", a: "We compute a comfort score from departure and return times, direct flights and speed, then combine it with the price. You can always sort by cheapest or fastest." },
        { q: "Can I search with kids and infants?", a: "Yes. Enter adults, children aged 2–11 and infants under 2, up to 9 travellers in all. Every infant flies with an adult." },
        { q: "Which languages are supported?", a: "Ukrainian and English. The language switch is at the top of the page." },
        { q: "Is there a phone app?", a: "We’re working on iOS and Android apps. For now the site works well on a phone too." },
        { q: "What do you do with my data?", a: "We collect as little as possible and don’t ask you to sign up. For details, including cookies, ads and analytics, see the Privacy Policy." },
      ],
    },
    form: {
      title: "Still have a question?",
      lead: "Write to us. We read every message, although we can’t always reply right away.",
      message: "Your question",
      messagePlaceholder: "Tell us what you’d like to know or what isn’t working",
      contact: "How can we reply (optional)",
      contactPlaceholder: "Email or Telegram username",
      contactHint: "If you leave nothing, we can’t reply to you personally.",
      consent: "By sending, you agree that we will process your message under the Privacy Policy.",
      send: "Send",
      sending: "Sending…",
      thanks: "Thank you! We got your message.",
      again: "Write another",
    },
  },
};

/**
 * Intrinsic sizes of the screenshots. Without them the lazy images have no height until they load, the page grows
 * after an in-page link jumped to a step and the browser ends up a step or two too high.
 */
export const imageSize: Record<string, [number, number]> = {
  "/how/search.jpg": [1200, 594],
  "/how/results.jpg": [1200, 612],
  "/how/flex.jpg": [1200, 541],
  "/how/explore.jpg": [1200, 838],
  "/how/meetup.jpg": [1200, 767],
  "/how/watch.jpg": [840, 540],
};
