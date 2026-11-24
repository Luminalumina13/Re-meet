# Privacy Policy

Re:meeet service · Version {{version}} · Effective: {{effective}}

## 1. Who we are

The Re:meeet service (the “Service”) is owned and operated by {{nameEn}} (tax ID (RNOKPP) {{edrpou}}, address: {{address}}; “the Company”, “we”). We are the controller of the personal data we process through the Service. For any privacy question write to {{email}}.

This Policy explains what data we process, why, who receives it and how you can control it. It applies together with the [Terms of Use](/terms).

## 2. In short

- You do not need to register or create an account to use the Service.
- We do not sell tickets or take payments. We do not collect payment details, passport data or precise location.
- We turn on analytics (Google Analytics via Google Tag Manager) and Google AdSense only after you agree. Without your consent their cookies are not set.
- We send your search parameters (airports, dates, number of travellers, cabin) to flight data providers to obtain offers. Friends' names are not sent to them.
- If you create a price tracker or connect Telegram, we store the related data until you delete it.
- We do not sell personal data.

## 3. What data we process

### 3.1. Search parameters

Departure and destination airports, dates or weekends, the number of travellers (adults, children, infants: a count only, no names or ages), cabin, time-of-day filters and limits on price or stops. On their own these do not identify you, but they are technically linked to the IP address a request came from.

### 3.2. Meetup planner

The names of friends and their home airports that you enter. Names can be personal data of third parties. Enter them only if you have the right to do so or those people's consent. Names are not sent to flight data providers: only airports and dates reach them.

### 3.3. Price trackers

When you create a tracker we store its name, the query parameters (including friends' names in a meetup tracker), the target price, the history of prices and events found, and notification settings: the webhook address if you entered one, and the Telegram chat ID and language if you connected the bot.

### 3.4. Telegram bot

If you connect Telegram we receive your chat ID, the language code of your Telegram app, and the commands and button presses you send to the bot. Messages are carried by Telegram, which processes data under its own privacy policy.

If you press “Open on the website” in the bot (or send the /site command), the bot creates a one-time link valid for 10 minutes. It opens the website in the browser you choose with access to the trackers connected to your chat. A technical access cookie is set in that browser (see the section on cookies), and only its irreversible hash is stored with the tracker. Do not forward the link: whoever opens it first gets access to those trackers.

### 3.5. Technical data

IP address, date and time of a request, page address, browser and device type. They end up in server logs so we can keep the Service secure, detect abuse and fix faults.

### 3.6. “Share” links

The Share button creates an address that contains your search parameters and, in the meetup planner, the friends' names and airports. This data is visible to anyone you give the link to. Share it with care.

### 3.7. Questions via the form

If you write to us through the form on the “Questions and answers” page, we receive the text of your message and, if you gave them, your contact details (an email or a Telegram username). The message arrives in the Service owner’s Telegram chat and is not stored on our server. Please don’t include unnecessary personal data in it.

To filter out automated (spam) submissions, the form uses the Cloudflare Turnstile check. It runs in your browser, and Cloudflare receives your IP address, browser data and how you interact with the page in order to tell a person from a bot. The script is loaded only on the page with the form and is not used for advertising or profiling.

### 3.8. Protecting search from bots

To keep automated programs from using the search (they use up the ticket services' limits and load the server), we:

- count searches per IP address. The counter is kept only in the server's memory for no longer than a day and is not linked to anything else. If there are too many searches in a short time, searching is paused for a while;
- once an hour check that a person is searching, using Cloudflare Turnstile (as on the question form, see 3.7). Usually the check passes unnoticed; only sometimes Cloudflare asks you to click a box. The Turnstile script is loaded only when a check is needed. After it, a technical `remeeet_human` cookie is set in your browser (see section 8).

## 4. Why we process data and on what basis

- **To show search results** and run the features of the Service: this is necessary to provide the Service you request (performance of a contract under the [Terms](/terms)).
- **To run trackers and send notifications:** necessary to fulfil your request. For Telegram, your consent also applies, which you give by opening the connect link and pressing Start in the bot. You can withdraw it at any time.
- **To answer your question** sent through the form: our legitimate interest in communicating with users, and your consent where you gave a contact.
- **To protect the Service** from abuse, spam and failures (including the Cloudflare Turnstile check on the question form and in search, and limiting the number of searches): our legitimate interest in security and stability.
- **To measure visits and show ads** (Google Analytics via Google Tag Manager, Google AdSense): only with your consent, which you can withdraw.
- **To comply with legal obligations.**

## 5. Who receives data

- **Flight data providers.** To find offers we send the route, dates, number of travellers and cabin to services such as Kiwi.com, lastminute.com and Ryanair, and, where configured, Duffel and Amadeus. Names and contact details are not sent to them. These companies then act under their own policies.
- **Telegram**, if you connected the bot (to deliver messages) or sent a question through the form (the message reaches us in Telegram).
- **Cloudflare, Inc.** (the Turnstile check on the question form and in search): receives your IP address and technical browser data to determine that a person is using the site, and processes them under its own policy (https://www.cloudflare.com/privacypolicy/).
- **Infrastructure providers** (hosting, network) that process data on our behalf.
- **Public authorities** where there is a lawful request.
- **Airline and aggregator websites.** When you follow a link to such a site you leave the Service. What happens to your data there is governed by their policies.

- **Google** (Google Ireland Limited and Google LLC), if you agreed to analytics and ads: Google Tag Manager loads the measurement tag, Google Analytics measures visits and Google AdSense shows ads. Google receives your cookie identifier, IP address, device data and what you do on the site, and may process them under its own policy (https://policies.google.com/privacy).

We do not sell personal data. Data for advertising goes to Google only with your consent.

## 6. International transfers

Our providers and Telegram may process data in various countries, including outside Ukraine and the European Economic Area. We choose providers that apply appropriate safeguards, but we do not control the internal processes of third-party services.

## 7. How long we keep data

- **Search responses** are kept temporarily in a server cache for up to 10 minutes.
- **Trackers** are kept until you delete them (the Delete button on the Tracking page or in the bot).
- **The Telegram chat ID** is deleted when you disconnect Telegram or block the bot.
- **Form questions** are kept in Telegram only as long as needed to answer, and then deleted.
- **Server logs** are kept for up to 30 days.
- **The per-IP search counter** (section 3.8) is kept only in the server's memory for no longer than a day.
- **Data in your browser** (see section 8) stays until you clear it.

After these periods we delete the data or anonymise it, unless the law requires longer retention.

## 8. Cookies and browser storage

Without your consent we do not set analytics or advertising cookies. To work, the Service stores in your browser (localStorage and sessionStorage) your chosen language and theme, your consent answer, and the filled form and search results within the open tab so they do not disappear when you return from a carrier site. For price trackers, the `remeeet_owner` cookie (httpOnly, up to two years) holds a secret token proving the trackers are yours. This data is necessary for the Service and works only for its operation. After the check that a person is searching (section 3.8), the `remeeet_human` cookie (httpOnly, 1 hour) holds a signed mark of the passed check with no data about you. During the check on the question form and in search, Cloudflare Turnstile may also store technical data in your browser that it needs for bot protection; it is not used for advertising.

If you press “Accept”, Google Tag Manager, Google Analytics and Google AdSense may set their own cookies and identifiers (for example `_ga`) for statistics and ad serving. You can withdraw consent any time via “Cookie settings” in the footer and delete cookies in your browser settings. Declining does not limit the Service’s features.

## 9. Your rights

You have the right to: confirm whether we process your data and access it; ask for correction or deletion; restrict processing or object to it; receive your data in a portable format; withdraw consent (for example disconnect Telegram with the Disconnect button on the Tracking page or by blocking the bot).

To exercise these rights write to {{email}}. Because the Service has no accounts, we may ask for a tracker link or chat ID to confirm the data relates to you. We reply without undue delay and within 30 days.

You may also complain to a supervisory authority. In Ukraine this is the Ukrainian Parliament Commissioner for Human Rights. Residents of the EU may contact the data protection authority of their country.

## 10. Security

We apply reasonable technical and organisational measures: an encrypted connection (HTTPS), restricted access to systems, and keeping secret keys out of the code. No system can guarantee absolute security, so do not enter into the Service anything you would not trust to an online service.

## 11. Children

The Service is not intended for people under 16 and we do not knowingly collect their data. The number of children and infants in a search is only a number used to calculate fares. If you believe a child has given us their data, write to us and we will delete it.

## 12. Changes to this Policy

We may update this Policy. We publish the new version on this page with a new date and version number and announce material changes in the Service in advance. Continuing to use the Service after a change takes effect means you have read the new version.

## 13. Contact

{{nameEn}}, tax ID (RNOKPP) {{edrpou}}, {{address}}. Email: {{email}}. Website: {{site}}.
